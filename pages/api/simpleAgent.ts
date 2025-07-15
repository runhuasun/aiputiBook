import { User, Model} from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import * as Fetcher from "node-fetch";

import prisma from "../../lib/prismadb";
import {log, warn, error} from "../../utils/debug";
import { authOptions } from "./auth/[...nextauth]";
import * as global from "../../utils/globalUtils";
import {translate} from "../../utils/localTranslate";
import {config, system, defaultImage} from "../../utils/config";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {callAPI} from "../../utils/apiUtils";
import {AliCVService} from '../../ai/cv/AliCVService';
import * as monitor from "../../utils/monitor";
import * as AIS from "../../ai/AIService";
import * as enums from "../../utils/enums";
import * as fs from "../../utils/fileServer";
import {TencentTTS} from '../../ai/tts/TencentTTS';
import * as fu from "../../utils/fileUtils";
import * as gu from "../../utils/globalUtils";
import * as vu from "../../utils/videoUtils";
import * as au from "../../utils/audioUtils";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    log("--------enter simple agent----------");
    let { cmd, params } = req.body;
    log(JSON.stringify(req.body));

    // 验证来自已知网站
    const referer = req.headers.referer;
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string') ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
    if (referer) {
        // 此处可以进行来源检测或域名匹配
        log('Request from:', referer);
        // 还可以基于来源域进行条件操作
        if (referer.indexOf(config.domainName) >= 0) {
            log('来源验证通过');
        } else {
            res.status(enums.resStatus.invader).json('非法访问来源');
        }
    } else {
        res.status(enums.resStatus.unExpErr).json('无法验证来源');
    }
    const session = await getServerSession(req, res, authOptions);
    monitor.logApiRequest(req, res, session, null, {cmd, params});

    let jsonResponse:any;
    
    try { 
        switch(cmd){
            case "recognizeImage":
                // 识别当前图片的内容
                const cv = AIS.createCVInstance("REP", "recogImgByPrompt");
                if(cv){
                    const getURL = await cv.predict({
                        image: params.imageURL,
                        prompt: params.prompt,
                        // max_new_tokens: 300,
                        // max_length: 400,
                        temperature: 1
                    });  
                    if(getURL){
                        const enDesc = await cv.getPredictResult(getURL);
                        log("recognition:" + enDesc);
                        const zhDesc = await translate(enDesc, "en", "zh");
                        log("translate to:" + zhDesc);
                        return res.status(enums.resStatus.OK).json({text: zhDesc});                        
                    }
                }
                return res.status(enums.resStatus.unknownErr).json("识别图片发生未知错误！");                
                
                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            case "auditImage":
                jsonResponse = await AliCVService.auditImage(params.imageURL);
                if(jsonResponse?.status == "ERROR"){
                    error(jsonResponse.message);
                    return res.status(enums.resStatus.taskNotStart).json(jsonResponse.message);                
                }else{
                    return res.status(enums.resStatus.OK).json({generated: JSON.stringify(jsonResponse.scenes)});
                }  
            case "detectFace": {
                const cache = await gu.globalGet("SIMPLE_AGENT", `AI_CACHE_${cmd}_${params.imageURL}`);
                if(cache){
                    return res.status(enums.resStatus.OK).json({generated: cache});
                }
                jsonResponse = await AliCVService.detectFaces(params.imageURL); 
                if(jsonResponse?.status == "ERROR"){
                    error(jsonResponse.message);
                    return res.status(enums.resStatus.taskNotStart).json(jsonResponse.message);                
                }else{
                    const result = JSON.stringify(jsonResponse.faces);
                    await gu.globalSet("SIMPLE_AGENT", `AI_CACHE_${cmd}_${params.imageURL}`, result);
                    return res.status(enums.resStatus.OK).json({generated: result});
                }  
            }
            case "recognizeFace":  {
//                const cache = await gu.globalGet("SIMPLE_AGENT", `AI_CACHE_${ip}_${cmd}_${params.imageURL}`);
//                if(cache){      
//                    log("hit cache:", cache);                  
//                    return res.status(enums.resStatus.OK).json({generated: cache});
//                }
                jsonResponse = await AliCVService.recognizeFaces(params.imageURL); 
                if(jsonResponse?.status == "ERROR"){
                    error(jsonResponse.message);
                    return res.status(enums.resStatus.taskNotStart).json(jsonResponse.message);                
                }else{
                    const result = JSON.stringify(jsonResponse.faces);
//                    await gu.globalSet("SIMPLE_AGENT", `AI_CACHE_${ip}_${cmd}_${params.imageURL}`, result);
                    return res.status(enums.resStatus.OK).json({generated: result});
                }  
            }
            case "segment":  {
                const cache = await gu.globalGet("SIMPLE_AGENT", `AI_CACHE_${ip}_${cmd}_${params.target}_${params.imageURL}`);
                if(cache){
                    log("hit cache:", cache);                  
                    return res.status(enums.resStatus.OK).json({generated: cache});
                }                
                let mask:string;
                switch(params.target){
                    case "body":
                        mask = await AliCVService.segmentBody(params.imageURL, {returnForm:"mask"}); 
                        break;
                    case "cloth":
                        mask = await AliCVService.segmentCloth(params.imageURL, {returnForm:"mask"}); 
                        break;
                    case "hat":
                        const hatParts = await AliCVService.segmentClothParts(params.imageURL, {returnForm:"mask", outMode:1, clothClass:["hat"]}); 
                        mask = hatParts?.hat;
                        break;
                    case "shoes":
                        const shoeParts = await AliCVService.segmentClothParts(params.imageURL, {returnForm:"mask", outMode:1, clothClass:["shoes"]}); 
                        mask = shoeParts?.shoes;
                        break;                    
                    case "skin":
                        mask = await AliCVService.segmentSkin(params.imageURL, {returnForm:"mask"}); 
                        break;
                    case "head":
                        mask = await AliCVService.segmentHead(params.imageURL); 
                        break;
                    case "hair":
                        mask = await AliCVService.segmentHair(params.imageURL); 
                        break;
                    default:
                        return res.status(enums.resStatus.unknownErr).json(`AI暂时不具备识别${params.target}区域的能力，请换一个目标`);                
                }                        
                if(mask){
                    await gu.globalSet("SIMPLE_AGENT", `AI_CACHE_${ip}_${cmd}_${params.target}_${params.imageURL}`, mask);                    
                    return res.status(enums.resStatus.OK).json({generated: mask});
                }else{
                    error("segment error...");
                    return res.status(enums.resStatus.unknownErr).json("AI没有识别到目标，或者识别发生意外失败");                
                }
                break;
            }
            case "recognizeVoice":
                const ais = new TencentTTS();
                const format = fu.getFileExtFromURL(params.voiceURL)?.toLowerCase();
                const text = await ais.voiceToText(params.voiceURL, format); 
                if(!text){
                    error("simpleAgent:语音识别失败" + params.voiceURL);
                    return res.status(enums.resStatus.unknownErr).json("语音识别由于未知原因失败！");                
                }else{
                    return res.status(enums.resStatus.OK).json({text:text});
                }  
                break;
            
            case "uploadToOSS":
                const newURL = await fs.moveToFileServer(params.imageURL, "T");
                if(jsonResponse?.status == "ERROR"){
                    error("simpleAgent:上传文件失败");
                    return res.status(enums.resStatus.unknownErr).json("上传文件失败");                
                }else{
                    return res.status(enums.resStatus.OK).json({generated: newURL});
                } 
                break;

            case "videoTrim": {
                try{
                    const trimVideo = await vu.trimVideo(params.videoURL, params.trimStart, params.trimDuration);
                    if(trimVideo){
                        return res.status(enums.resStatus.OK).json({url:trimVideo});
                    }else{
                        return res.status(enums.resStatus.unknownErr).json("裁剪视频失败");                
                    }
                    log("trim video:", trimVideo);
                }catch(err){
                    error("trim Video, 裁剪视频时出错！", err);
                    return res.status(enums.resStatus.unknownErr).json("裁剪视频失败");                
                }        
                break;
            }

            case "audioTrim": {
                try{
                    const trimAudio = await au.trimAudio(params.audioURL, params.trimStart, params.trimDuration);
                    if(trimAudio){
                        return res.status(enums.resStatus.OK).json({url:trimAudio});
                    }else{
                        return res.status(enums.resStatus.unknownErr).json("裁剪音频失败");                
                    }
                    log("trim audio:", trimAudio);
                }catch(err){
                    error("trim audio, 裁剪音频时出错！", err);
                    return res.status(enums.resStatus.unknownErr).json("裁剪音频失败");                
                }        
                break;
            }
        }
            
        return res.status(enums.resStatus.expErr).json("未知的工作流命令");

    } catch (err) {
        error(err, JSON.stringify(req.body));
        res.status(enums.resStatus.unExpErr).json("当前用户太多，服务器过于繁忙发生错误，请稍后重试！");
    }
}

