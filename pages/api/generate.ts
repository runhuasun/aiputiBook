import * as Fetcher from "node-fetch";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { User, Model} from "@prisma/client";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";

import {useCredits, returnCredits} from "./creditManager";
import * as dbLogger from "./dbLogger";

import * as global from "../../utils/globalUtils";
import { moveToFileServer, uploadDataToServer } from "../../utils/fileServer";
import {translate} from "../../utils/localTranslate";
import {config, defaultImage} from "../../utils/config";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {BaseCVService} from "../../ai/cv/BaseCVService";
import * as AIS from "../../ai/AIService";
import {AliCVService} from "../../ai/cv/AliCVService";
import {FalCVService} from "../../ai/cv/FalCVService";

import {isURL, getRedirectedUrl, addWatermark} from "../../utils/fileUtils";
import * as debug from "../../utils/debug";
import {getPricePack} from "../../utils/funcConf";
import * as enums from "../../utils/enums";
import * as iu from "../../utils/imageUtils";
import * as mt from "../../utils/modelTypes";
import * as lu from "../../utils/loraUtils";

export type GenerateResponseData = {
    original: string | null;
    generated: string | null;
    id: string;
    genRoomId: string | null;
    replicateId?: string | null;
    seed?: string | null;    
};

  
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponseData | string>
) {
    let { 
        roomId, freeOfCharge, isIntermediateStep, priceUnits, waitResultRetryTimes, waitForUploadGenerated, doNotUploadToServer,
        imageUrl, theme, room, inputText, realText, func, modelurl, modelTheme, access, email, seed, params, 
        drawRatio, timeStamp, rid, inference, controlNet, controlStrength, loraScale, mask, width, height, refine, serviceLine } = req.body;

    log(roomId, "enter generate.ts:\n" + JSON.stringify(req.body));

    // 记录时间戳，防止用户使用代理时的重试机制导致重入
    if(timeStamp){
        log(roomId, "timeStamp is: " + timeStamp);
        const ts = await global.globalGetAndDel("GENERATE", timeStamp.toString());
        log(roomId, "TS:" + ts);
        if(ts){
            log(roomId, "Found timeStamp: " + timeStamp);

            // 等待
            // await new Promise((resolve) => setTimeout(resolve, 5000));            
            error(roomId, "generate.ts发生错误重入！！！！！！！！！！！！！！！！！！！！！！已经返回unexpRetryErr");
            return res.status(enums.resStatus.unexpRetryErr).json("AI服务器需要较长时间运行，请稍后点击左下角用户头像到我的空间里查看结果。");
        }else{
            // 没有时间戳记录，说明是第一次进入
            await global.globalSet("GENERATE", timeStamp.toString(), "true");
        }
    }
    
    // 处理用户登录
    const session = await getServerSession(req, res, authOptions);
    let userEmail = "";
    
    if(email){
        userEmail = email;
    }else if (session && session.user && session.user.email) {
        userEmail = session.user.email;
    }else{
        return res.status(enums.resStatus.unauthErr).json("新用户请先点左下角[登录]按钮，极简注册哦！");
    }
    
    // Get user from DB
    const user = await prisma.user.findUnique({
        where: {
            email: userEmail,
        },
    });

    if(!user){
        return res.status(enums.resStatus.unauthErr).json("新用户请先点左下角[登录]按钮，极简注册哦！");
    }else{
        log(roomId, `操作用户:[${user.name}]  [${user.id}]`);
    }


    /////////////////////////////////////////////////////////////////////////////////////////
    // 以下代码均基于用户已经注册
    /////////////////////////////////////////////////////////////////////////////////////////
    const model = modelurl ? 
        await prisma.model.findUnique({
            where: {
                code: modelurl,
            },
            select: {
                price: true,
            },
        }) : undefined;    

    let price = 0;
    if(!freeOfCharge){
        if(func == "createPrompt"){
            func = room;
            price = getPricePack(config, "createPrompt", func).price;
        }else{
            price = getPricePack(config, func, model, priceUnits, user).price;
        }
    }
    
    log(roomId, "本次任务需要credits:", price);
    
    // 调用AI服务生成各种图片前的预处理程序
    // Check if user has any credits left
  //  if(user.credits == undefined){
  //      const msg = "新用户请先点左下角[登录]按钮，极简注册哦！";
  //      debug.log(roomId, msg);
  //      return res.status(401).json(msg);
//    }else if (user?.credits <= 0) {
//        return res.status(402).json(`你已经没有` + config.creditName + `了，请先去买一些`);
//    }else 
    if(user.credits < price){
        const msg = `您的` + config.creditName + `不够了，请先去购买一些，再来尝试哦！`;
        debug.log(roomId, msg);
        return res.status(enums.resStatus.lackCredits).json(msg);
    }

    
    // 如果是图片放大请求，那么判断，如果已经被放大过就直接返回放大图
    /*
    if (func == "zoomIn") {
        const zoomed = await getZoomedRoom(params.image, user);
        
        if(zoomed){
            // 成功生成图片就返回图片，没有就返回错误信息
            return res.status(200).json(zoomed);
        }
    }      
    */
    
    try { 
        const cv =  await getCVServiceParams(user, req);
        log(roomId, "generated got cv params:", JSON.stringify(cv));
        
        waitForUploadGenerated = true; // 失败概率太高，强制等待 waitForUploadGenerated  || cv.waitForUploadGenerated;
        
        // 调用AI服务，如果失败就重试最多10次
        let retry = 0;
        let startResponse:any = null;
        let jsonStartResponse:any = null;
        let finalResponse:any = null;
        let jsonFinalResponse:any = null;        
        let taskStarted = false;
        let generatedImage: string | null = null;
        // let roomId = "";
        let replicateId = "";
        let originalImage = "";
        let defAcc = "PRIVATE";
        let body = cv.body;
        let cvs:any;
        let newRoom:any;
        let bigBody:any; // 放所有步骤的记录
        let thisStep:any; // 放本步骤的记录

        
        log(roomId, "---- NO.1 启动任务------");
        //log(roomId, "[cv.predicturl is:]", cv.predicturl);
        //log(roomId, "[cv.bodystr is:]", body);
        log(roomId, `--- roomId: ${roomId} ---`);
        thisStep = {
            TIME: new Date().toLocaleString(),
            FUNC: func,
            AISERVICE: cv.aiservice,
            INPUT_BODY:body
        };
        
        if(roomId){         
            const oldRoom = await prisma.room.findUnique({where:{id:roomId}});
            if(oldRoom){
                //log(roomId, `--- found oldRoom: ${JSON.stringify(oldRoom)} ---`);            
                if(oldRoom.bodystr){
                    bigBody = JSON.parse(oldRoom.bodystr);
                }
                if(!bigBody){
                    bigBody = {};
                }
                if(!bigBody.STEPS){
                    bigBody.STEPS = [];
                }
                bigBody.STEPS.push(thisStep);                
                
                const newData = {
                    replicateId: (new Date().getTime()).toString(),
                    outputImage: defaultImage.roomCreating,
                    status: isIntermediateStep ? enums.roomStatus.midstep : enums.roomStatus.creating,
                    prompt: inputText || realText || oldRoom.prompt || "",
                    func: oldRoom.func || func,
                    usedCredits: oldRoom.usedCredits || price,                    
                    model: modelurl || oldRoom.model || "no model",
                    access: oldRoom.access || defAcc, // 图片缺省都是开放的，除非前端特别要求
                    aiservice: cv.aiservice,
                    predicturl: cv.predicturl,
                    bodystr: JSON.stringify(bigBody),
                    seed: seed || oldRoom.seed,
                    resultType: func == "text2voice" ? "VOICE" : cv.resultType,
                    callbacked: "N",
                };
                newRoom = await prisma.room.update({
                    where:{id:roomId}, 
                    data:newData
                });
                //log(roomId, `--- updated to newRoom: ${JSON.stringify(newRoom)} ---`);                            
            }
        }
        if(!newRoom){
            log(roomId, `--- generate.ts: no exist room, create new room ---`);
            bigBody = {STEPS:[thisStep]};
            newRoom = await prisma.room.create({
                data: {
                    replicateId: (new Date().getTime()).toString(),
                    user: {
                        connect: {
                            email: userEmail,
                        },
                    },
                    inputImage: cv.inputImage || originalImage || "",
                    outputImage: defaultImage.roomCreating,
                    status: isIntermediateStep ? enums.roomStatus.midstep : enums.roomStatus.creating,
                    zoomInImage: "",
                    prompt: inputText || realText || cv.prompt || "",
                    func: func,
                    usedCredits: price,
                    model: modelurl ||  "no model",
                    access: defAcc, // 图片缺省都是开放的，除非前端特别要求
                    viewTimes: 0, // Math.floor(Math.random() * 10) + 1, // 只有查看数量是可以给一个初始值的
                    dealTimes: 0, // 牵涉到结算，所以必须真实
                    likes: 0,
                    aiservice: cv.aiservice,
                    predicturl: cv.predicturl,
                    bodystr: JSON.stringify(bigBody),
                    seed: seed ? seed : null,
                    resultType: func == "text2voice" ? "VOICE" : cv.resultType,
                    callbacked:"N"
                },
            });
            roomId = newRoom?.id;
           // log(roomId, `--- create new room in generate: ${JSON.stringify(newRoom)} ---`);
        }

        const needCredits = price;
        if(needCredits > 0){
            await useCredits(user, needCredits, enums.creditOperation.CREATE_ROOM, newRoom.id); 
        }
        
        if(func == "text2voice"){
            // 单独处理转语音
            try{
                const vData = await AIS.textToVoice(params.content, params.speaker, params.aiservice);
                inputText = params.content;
                if(vData && typeof vData === 'string' && vData.trim() != ''){
                    replicateId = (new Date().getTime()).toString();
                    const remoteFile = await uploadDataToServer(Buffer.from(vData, 'base64'), "audio/x-mpeg", replicateId+".mp3");
                    if(remoteFile){
                        taskStarted = true;
                        generatedImage = remoteFile;
                        jsonStartResponse = {id:replicateId};
                    }else{           
                        return res.status(enums.resStatus.FSE).json("语音合成结果文件上传失败！本次运行的" + config.creditName + "已经被退回。");
                    }                    
                }else{
                    return res.status(enums.resStatus.noResultErr).json("语音合成结果为空！本次运行的" + config.creditName + "已经被退回。");
                }
            }catch(e){
                error(roomId, "generate.ts 语音合成发生未知错误!");
                error(roomId, e);
                return res.status(enums.resStatus.unExpErr).json("语音合成发生未知错误！本次运行的" + config.creditName + "已经被退回。");                
            }
        }else if(cv.aiservice == "ALI"){
            cvs = AIS.createCVInstance(cv.aiservice, func);  
            if(cvs){
                switch(func){
                    case "recognizeFace":
                        jsonStartResponse = await AliCVService.recognizeFaces(body.input.imageURL);
                        break;
                    case "detectFace":
                        jsonStartResponse = await AliCVService.detectFaces(body.input.imageURL);
                        break;
                    case "auditImage":
                        jsonStartResponse = await AliCVService.auditImage(body.input.imageURL);
                        break;
                        
                    default:
                        jsonStartResponse = await cvs.predict(body.input);
                }
                // log(roomId, jsonStartResponse);
                if(jsonStartResponse?.status == "ERROR"){
                    error(roomId, jsonStartResponse.message);
                    return res.status(enums.resStatus.expErr).json(jsonStartResponse.message);                
                    // return res.status(enums.resStatus.taskErr).json("任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }else{
                    taskStarted = jsonStartResponse && jsonStartResponse.id;
                    generatedImage = jsonStartResponse.resultURL || JSON.stringify(jsonStartResponse.faces) || JSON.stringify(jsonStartResponse.scenes);
                    replicateId = jsonStartResponse.id;
                    originalImage = body.input.imageURL || body.input.videoUrl || "";                
                }
            }
        }else if(cv.aiservice == "FAL"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version) as FalCVService;   
            if(cvs){
                taskStarted = true;           
                jsonStartResponse = await cvs.predict(body.input);
                log(roomId, "FAL task submit result:", JSON.stringify(jsonStartResponse));
                if(jsonStartResponse){
                    if(cvs.cmd == "SUBMIT"){
                        generatedImage = "";
                        replicateId = jsonStartResponse.request_id;
                    }else{
                        if(jsonStartResponse.status == enums.resStatus.OK){
                            generatedImage = jsonStartResponse.url;
                            replicateId = new Date().toString();
                        }else{
                            await prisma.room.update({ where:{id:newRoom.id},  data: {outputImage: jsonStartResponse.message, status: enums.roomStatus.midfail}});
                            return res.status(jsonStartResponse.status).json(jsonStartResponse.message);                
                        }
                    }
                }else{
                    await prisma.room.update({ where:{id:newRoom.id},  data: {outputImage: "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因", status: enums.roomStatus.midfail}});                    
                    return res.status(enums.resStatus.taskErr).json("任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }
        }else if(cv.aiservice == "PI"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                const ret = await cvs.predict(body.input);
                if(ret?.status === enums.resStatus.OK && ret?.task_id){
                    jsonStartResponse = ret.task_id;
                    taskStarted = true;                               
                    replicateId = jsonStartResponse;
                }else{
                    return res.status(ret?.status || enums.resStatus.taskErr).json(await translate(ret?.message, "en", "zh") || "任务启动失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }
        }else if(cv.aiservice == "AM"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                const ret = await cvs.predict(body.input);
                if(ret?.status === enums.resStatus.OK && ret?.task_id){
                    jsonStartResponse = ret.task_id;
                    taskStarted = true;                               
                    replicateId = jsonStartResponse;
                }else{
                    return res.status(ret?.status || enums.resStatus.taskErr).json(await translate(ret?.message, "en", "zh") || "任务启动失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }            
        }else if(cv.aiservice == "WAVE"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                jsonStartResponse = await cvs.predict(body.input);
                if(jsonStartResponse){
                    taskStarted = true;                               
                    replicateId = jsonStartResponse;
                }else{
                    return res.status(enums.resStatus.taskErr).json("任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }            
        }else if(cv.aiservice == "BAIDU"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                const ret = await cvs.predict(body.input);
                if(ret?.status == enums.resStatus.OK){
                    jsonStartResponse = ret.task_id || ret.log_id;
                    taskStarted = true;                               
                    replicateId = jsonStartResponse;
                }else{
                    return res.status(ret?.status || enums.resStatus.taskErr).json(await translate(ret?.message, "en", "zh") || "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }            
        }else if(cv.aiservice == "BYTE"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                const ret = await cvs.predict(body.input);
                log(roomId, "Byte result:", JSON.stringify(ret));
                if(ret?.status == enums.resStatus.OK){
                    jsonStartResponse = ret.task_id || ret.id;
                    taskStarted = true;                               
                    replicateId = jsonStartResponse;
                }else{
                    return res.status(ret?.status || enums.resStatus.taskErr).json(ret?.message || "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                }
            }            
        }else if(cv.aiservice == "SEGMIND"){
            cvs = AIS.createCVInstance(cv.aiservice, body.version);   
            if(cvs){
                jsonStartResponse = await cvs.predict(body.input);
                if(jsonStartResponse?.status == enums.resStatus.OK){
                    taskStarted = true;                               
                    replicateId = new Date().toString();;
                    generatedImage = jsonStartResponse.result;
                }else{
                    error(roomId, "SEGMIND inference got ERROR:", jsonStartResponse);
                    if(jsonStartResponse){
                        const errMsg = await translate(jsonStartResponse.result, "en", "zh");
                        await prisma.room.update({ where:{id:newRoom.id},  data: {outputImage: errMsg, status: enums.roomStatus.midfail}});
                        return res.status(jsonStartResponse.status).json(errMsg);                
                    }else{
                        await prisma.room.update({ where:{id:newRoom.id},  data: {outputImage: "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因", status:enums.roomStatus.midfail}});
                        return res.status(enums.resStatus.taskErr).json("任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因");                
                    }
                }
            }            
        }else{
            // 重复试图调用AI服务器
            while(retry++ < 3){
                try{
                    log(roomId, "第" + retry + "次尝试访问服务器.......");        
                    
                    startResponse = await fetch(cv.predicturl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: cv.authstr,
                        },
                        body: JSON.stringify(body),
                        //       redirect: 'follow'
                        });
                    
                    jsonStartResponse = await startResponse.json();
                    if(jsonStartResponse){
                        // log(roomId, "[AI server response:]" + JSON.stringify(jsonStartResponse));
                    }
                } catch (err) {
                    error(roomId, "调用AI图片生成服务器发生异常");
                    error(roomId, err);               
                }
                
                if(func == "DALL-E" && jsonStartResponse){
                    if(jsonStartResponse.created){
                        log(roomId, "jsonStartResponse.created:" + jsonStartResponse.created);
                        taskStarted = true;
                        break;
                    }else if(jsonStartResponse.error.message.indexOf("our safety system") > 0){
                        return res.status(enums.resStatus.NSFW).json("生成的作品中包含有不适合的内容，请避免色情、暴力等题材！");
                    }
                }else if(startResponse && jsonStartResponse && jsonStartResponse.id && jsonStartResponse.status != "failed" ) {
                    taskStarted = true;
                    break;
                } else {
                    if(retry > 0){
                        log(roomId, "调用AI服务器失败，开始重新尝试");
                        error(roomId, startResponse);
                        error(roomId, JSON.stringify(jsonStartResponse));
                    }
                    // 每次失败等待5秒再重新尝试
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            } // end while retry

            // 有原图得获得原图，图片转换类的结果设为私有
            originalImage = (jsonStartResponse && jsonStartResponse.input) ? 
                (jsonStartResponse.input.image || jsonStartResponse.input.input_media || jsonStartResponse.input.image_path || jsonStartResponse.input.source_image || jsonStartResponse.input.target_image || jsonStartResponse.input.target || "") 
                : "";
            defAcc = access || (originalImage ? "PRIVATE" : "PUBLIC");            
        }

        log(roomId, "---- NO.2 检查任务启动结果------");        
        // 如果任务启动没有成功就归还credit，并且报错
        if(!taskStarted) {
            debug.warn(roomId, "任务没有启动成功！");
            return res.status(400).json("任务没有启动成功！");
        }
       
        // 对于DALL-E和SDAPI服务，此时已经生成完图片
        if(cv.aiservice == "DALLE"){
            replicateId = jsonStartResponse.created.toString();
            // @ts-ignore
            generatedImage = jsonStartResponse.data[0].url as string;
            log(roomId, "generatedImage:" + generatedImage);  
            
        }else if( cv.authstr == "SDAPI" ){
            log(roomId, "jsonStartResponse.id:" + jsonStartResponse.id);
            replicateId = jsonStartResponse.id.toString();
            if(jsonStartResponse.status == "success"){
                // @ts-ignore
                generatedImage = jsonStartResponse.output[0] as string;
            }
            log(roomId, "generatedImage:" + generatedImage);
        }else if( cv.aiservice == "REP"){
            replicateId = jsonStartResponse.id;
            if(jsonStartResponse.status == "succeeded"){
                if(!jsonStartResponse.output || (jsonStartResponse?.output?.msg == "no face" && jsonStartResponse?.output?.code == 500)){
                    return res.status(enums.resStatus.expErr).json("在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 如果在原图中选择了区域，请试着扩大您选择的区域。 ");
                }                
                // 获得返回的生成结果
                if(func == "maskCloth"){
                    if(Array.isArray(jsonStartResponse.output)){
                        generatedImage = jsonStartResponse.output[0] as string;
                    }
                }else if(func == "bigcolor"){
                    if(Array.isArray(jsonStartResponse.output)){
                        generatedImage = jsonStartResponse.output[0].image;
                    }                 
                }else{
                    generatedImage = Array.isArray(jsonStartResponse.output) ? 
                        (jsonStartResponse.output[jsonStartResponse.output.length-1] as string) : 
                        (jsonStartResponse.output?.image || jsonStartResponse.output as string || jsonStartResponse.output?.media_path || jsonStartResponse.output?.audio_output);
                    if(func == "voiceTranslate"){
                        realText = jsonStartResponse.output?.text_output;
                    }
                }
            }
        }

        log(roomId, "---- NO.3 只要启动任务就先创建一个记录------");  
        let outputBody = "";
        if(generatedImage){
            outputBody = (typeof jsonStartResponse == "string" && jsonStartResponse.startsWith("data:image")) ? "A Base64 Image" : jsonStartResponse;
        }
        thisStep.REP_ID = replicateId;
        thisStep.OUTPUT_BODY = outputBody;

        //log(roomId, `--- generate: update exist room ${roomId} ---`, JSON.stringify(thisStep), JSON.stringify(bigBody));
        newRoom = await prisma.room.update({
            where:{id:newRoom.id}, 
            data: {
                replicateId: String(replicateId),
                outputImage: generatedImage || defaultImage.roomCreating,
                bodystr: JSON.stringify(bigBody),
                status: generatedImage ? ( isIntermediateStep ? enums.roomStatus.midsucc : enums.roomStatus.success) : (isIntermediateStep ? enums.roomStatus.midstep : enums.roomStatus.creating),
            }
        });

        log(roomId, "---- NO.4 检查和等待任务执行结果------");    
        if(cv.aiservice == "FAL"){
            // do nothing
        }else if(cv.aiservice == "BAIDU"){
            const ret = await cvs.getPredictResult(jsonStartResponse);            
            if(ret?.status === enums.resStatus.OK){
                generatedImage = ret.result;
                if(!generatedImage){
                    return res.status(enums.resStatus.expErr).json(ret?.message);
                }
            }else{
                return res.status(ret.status).json(await translate(ret?.message, "en", "zh"));                
            }               
        }else if(cv.aiservice == "BYTE"){
            log(roomId, `jsonStartResponse: ${jsonStartResponse}`);
            const ret = await cvs.getPredictResult(jsonStartResponse);            
            if(ret?.status === enums.resStatus.OK){
                generatedImage = ret.result;
                if(!generatedImage){
                    return res.status(enums.resStatus.expErr).json(ret?.message);
                }
            }else{
                return res.status(ret.status).json(await translate(ret?.message, "en", "zh"));                
            }        
        }else if(cvs && jsonStartResponse && cv.aiservice == "WAVE"){
            generatedImage = await cvs.getPredictResult(jsonStartResponse);            
            if(!generatedImage){
                return res.status(enums.resStatus.expErr).json("在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 如果在原图中选择了区域，请试着扩大您选择的区域。");
            }
        }else if(cvs && jsonStartResponse && cv.aiservice == "AM"){
            const ret = await cvs.getPredictResult(jsonStartResponse);            
            if(ret?.status === enums.resStatus.OK){
                generatedImage = ret.result;
                if(!generatedImage){
                    return res.status(enums.resStatus.expErr).json(ret?.message);
                }
            }else{
                return res.status(ret.status).json(await translate(ret?.message, "en", "zh"));                
            }            
        }else if(cvs && jsonStartResponse && cv.aiservice == "PI"){
            const ret = await cvs.getPredictResult(jsonStartResponse);            
            if(ret?.status === enums.resStatus.OK){
                generatedImage = ret.result;
                if(!generatedImage){
                    return res.status(enums.resStatus.expErr).json(ret?.message);
                }
            }else{
                return res.status(ret.status).json(await translate(ret?.message, "en", "zh"));                
            }
        }else if( cv.aiservice == "ALI" && cvs && (jsonStartResponse != null) && !generatedImage ){
            // 很多情况阿里云的调用在之前已经生成结果，如果没有生成结果就在这里等待结果
            log(roomId, "等待ALIYUN结果");
            const ret = await cvs.getPredictResult(jsonStartResponse.id);
            if(ret?.status === enums.resStatus.OK){
                generatedImage = ret.result;
            }else{
                return res.status(ret.status).json(await translate(ret?.result, "en", "zh"));                                
            }
        }else if( cv.aiservice == "DALLE" && (jsonStartResponse != null)){
          
            // @ts-ignore
            roomId = jsonStartResponse.created.toString();
            
        }else if(jsonStartResponse != null && !generatedImage) {
            // 启动服务得到了正确返回，但是还没有生成结果的情况下，
            // 这里需要等待结果生成并获得结果数据
          
            // 如果直接调用没有返回图片，就到这里反复尝试
            let endpointUrl = ""; 
            let bodystr = "";
            if( ( cv.authstr == "SDAPI" ) && (jsonStartResponse != null) ){
                // @ts-ignore
                roomId = jsonStartResponse.id.toString();   
                endpointUrl = cv.predicturl + "/fetch/" + roomId;
                bodystr = JSON.stringify({
                    "key": process.env.SD_API_KEY,
                });        
                cv.predicturl = endpointUrl;
            }else{
                // replicate
                roomId = jsonStartResponse.id;
                endpointUrl = jsonStartResponse.urls.get;
                bodystr = JSON.stringify({endpointUrl});          
            }
            // GET request to get the status of the image restoration process & return the result when its ready
            let tryTimes = 0;
            const retryTimes = waitResultRetryTimes || 10;
            // 最多尝试
            log(roomId, `开始尝试从endpoint获取AI任务返回结果：${endpointUrl}`); 
            while (!generatedImage && tryTimes++ < retryTimes) {
                // Loop in 1s intervals until the alt text is ready
                finalResponse = null;
                jsonFinalResponse = null;

                try{
                    finalResponse = await fetch(cv.predicturl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: cv.authstr,
                        },
                        body:bodystr,
                    });
                    if(finalResponse){      
                        jsonFinalResponse = await finalResponse.json();
                    }                                     
                } catch (err) {
                    error(roomId, "调用AI服务器，获取图片生成状态时发生异常");
                    error(roomId, err);               
                }
                
                // @ts-ignore
                if (finalResponse && jsonFinalResponse && (jsonFinalResponse.status === "succeeded" || jsonFinalResponse.status === "success") ) {
                    if(!jsonFinalResponse.output || (jsonFinalResponse?.output?.msg == "no face" && jsonFinalResponse?.output?.code == 500)){
                        return res.status(enums.resStatus.expErr).json("在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 如果在原图中选择了区域，请试着扩大您选择的区域。");
                    }
                    
                    if(func == "maskCloth"){
                        if(Array.isArray(jsonFinalResponse.output)){
                            generatedImage = jsonFinalResponse.output[0] as string;
                        }
                    }else if(func == "bigcolor"){
                        if(Array.isArray(jsonFinalResponse.output)){
                            generatedImage = jsonFinalResponse.output[0].image;
                        }                          
                    }else{
                        generatedImage = Array.isArray(jsonFinalResponse.output) ? 
                            (jsonFinalResponse.output[jsonFinalResponse.output.length-1] as string) : 
                            (jsonFinalResponse.output?.image || jsonFinalResponse.output?.media_path || jsonFinalResponse.output?.audio_output || jsonFinalResponse.output as string);
                    }
                    if(func == "voiceTranslate"){
                        realText = jsonStartResponse.output?.text_output;
                    }                        
                   
                    if(generatedImage){
                        log(roomId, "generatedImage success:" + generatedImage);
                    }else{
                        error(roomId, "AI服务正常执行，但是没有返回任何结果，请检查您的输入内容是否符合要求");
                        return res.status(400).json("AI服务正常执行，但是没有返回任何结果，请检查您的输入内容是否符合要求");
                    }
                    // 如果有seed，就记录seed;
                    try{
                        const lines = jsonFinalResponse.logs.split("\n");
                         for(const line of lines){                            
                            if(line.startsWith("Using seed:")){
                                //log(roomId, "found seed");
                                seed = line.substr(11).trim();
                                //log(roomId, "seed from replicate:" + seed);
                                break;
                            }
                        }
                    }catch(e){
                        error(roomId, "get seed from replicate error:");                
                        error(roomId, e);
                    } 
                    break;
                } else if (finalResponse && jsonFinalResponse && jsonFinalResponse.status === "failed") {
                    let errorMsg = jsonFinalResponse.error as string;
                    error(roomId, errorMsg); 
                    if(errorMsg.indexOf("No face") >= 0 || errorMsg.indexOf("not find a face") >= 0){
                        return res.status(enums.resStatus.expErr).json("在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 如果在原图中选择了区域，请试着扩大您选择的区域。 ");
                    }else if(errorMsg.indexOf("NSFW") >= 0 || errorMsg.indexOf("flagged by safety filters") >= 0 || errorMsg.indexOf("does not pass safety checks") >= 0 || errorMsg.indexOf("sensitive") >=0){
                        return res.status(enums.resStatus.NSFW).json("生成的图片或视频包含有不适合的内容，请避免使用过于敏感或不雅的内容！");
                    }else if(errorMsg.indexOf("CUDA out of memory") >= 0){
                        return res.status(enums.resStatus.expErr).json("需要处理的图片或视频尺寸太大，请试着减少尺寸或缩短视频再试试。");
                    }else{
                        errorMsg = await translate(errorMsg, "en", "zh");
                        return res.status(500).json(`任务执行失败！${errorMsg} `);
                    }
                    break;
                }else if (finalResponse && jsonFinalResponse && jsonFinalResponse.status === "canceled") {  
                    return res.status(400).json("任务执行当中被意外取消，如果重复发生类似情况，请和系统管理员联系反馈！");
                } else {
                    log(roomId, `get REP ${jsonStartResponse?.id} result restry: ${tryTimes}`);
                    // 每次查询结果等待3秒
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
        }
        
        if (generatedImage) {
            log(roomId, "---- NO.5 如果任务在给定时间内返回结果就记录并返回结果------");        
            
            log(roomId, "图片在generated.ts里被成功生成:" + generatedImage);
            if( func != "text2voice" ){
                thisStep.REP_ID = replicateId;
                let response = generatedImage || jsonFinalResponse || jsonStartResponse;
                thisStep.OUTPUT_BODY = (typeof response == "string" && response.startsWith("data:image")) ? "A Base64 Image" : response;
                
                log(roomId, "generatedImage founded:", JSON.stringify(thisStep), JSON.stringify(bigBody));
                let roomData:any = {
                    status: isIntermediateStep ? enums.roomStatus.midsucc : enums.roomStatus.success,
                    bodystr: JSON.stringify(bigBody),
                    outputImage: generatedImage,
                };
                // 对于voiceTranslate更新输入内容
                if(func == "voiceTranslate" ){
                    roomData.prompt = realText;
                }
                
                // 首先更新成生成的原始图片
                await prisma.room.update({
                    where: {
                        id: newRoom.id,
                    },
                    data: roomData
                });  
                
                // 如果是个media文件异步上传到文件服务器
                if(!doNotUploadToServer){
                    if(isURL(generatedImage)){
                        if(waitForUploadGenerated){
                            let uploadImg = await moveToFileServer(generatedImage, "U");
                            if(uploadImg){
                                log(roomId, "图片在generated.ts被正确上传到:" + uploadImg); 
                                // 改为记录新的文件位置
                                generatedImage = uploadImg;
                                // 更新图片生成结果
                                await prisma.room.update({ where: {id: newRoom.id, }, data: { outputImage: uploadImg } });        
                            }
                        }else{
                            moveToFileServer(generatedImage, "U").then(async (uploadImg) => {
                                if(uploadImg){
                                    log(roomId, "图片在generated.ts被正确上传到:" + uploadImg); 
                                    // 改为记录新的文件位置
                                    generatedImage = uploadImg;
                                    // 更新图片生成结果
                                    await prisma.room.update({ where: {id: newRoom.id, }, data: { outputImage: uploadImg } });        
                                }            
                            });
                        }
                    }else{
                        // 如果不是图片那么不要显示，置为删除状态
                        await prisma.room.update({ where: {id: newRoom.id, }, data: { status: enums.roomStatus.delete } });        
                    }
                }
            }
          
            // 对于DALL-E等没有回调函数的调用，这里做一下分账处理
            //if(func == "DALL-E" || func == "text2voice" || cv.aiservice == "ALI"){
            //    accountingForPrompt(newRoom);
           // }
            
            // 成功生成图片就返回图片，没有就返回错误信息
            //log(roomId, "在generate.js里正确生成并返回图片:" + generatedImage);
            return res.status(200).json(
                {
                    original: originalImage,
                    generated: generatedImage,
                    id: roomId, // 这个ID不是存储room的ID，就是一个识别符，后续要调整
                    genRoomId: newRoom.id,
                    replicateId: replicateId,
                    seed
                }
            );
        }else{     
            warn(roomId, "---- NO.5 如果任务在给定时间内【没有】返回结果就通知用户一会去我的空间查看------");        
            //returnCredits(user, needCredits, enums.creditOperation.CREATE_ROOM, newRoom.id);                           
            //if(newRoom){
//                await prisma.room.update({ where: {id: newRoom.id, }, data: { 
//                    status: enums.roomStatus.delete
//                } });        
//            }
            let retStatus = enums.resStatus.waitForResult;
            if(cv.aiservice == "ALI"){
                return res.status(enums.resStatus.unExpErr).json("服务器发生内部错误，请稍后重试！本次运行的" + config.creditName + "已经被退回。");
            }else{
                return res.status(retStatus).json(
                    {
                        original: originalImage,
                        generated: generatedImage,
                        id: roomId,
                        genRoomId: newRoom.id,
                        replicateId: replicateId,
                        seed
                    }                
                );
            }
        }
      
    } catch (err) {
        error(roomId, err);
        res.status(enums.resStatus.unExpErr).json("当前用户太多，服务器过于繁忙，请稍后重试！本次运行的" + config.creditName + "已经被退回。");
    }
}







///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// const { imageUrl, theme, room, inputText, realText, func, price, modelurl, modelTheme, access, email, seed, params} = req.body;
// 获得调用CV服务的参数
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getCVServiceParams(user:User, req:NextApiRequest){

    let { roomId, imageUrl, theme, room, inputText, realText, func, price, modelurl, modelTheme, mandatorySafeCheck,
         access, email, seed, params, drawRatio, rid, inference, controlNet, controlStrength, loraScale, mask, width, height, refine, serviceLine} = req.body;
  
    let predicturl = process.env.REPLICATE_API_PROXY ? process.env.REPLICATE_API_PROXY : "http://gpt.aiputi.cn:7777/api/replicate";
    let authstr = "Token " + process.env.REPLICATE_API_KEY;
    let prompt = " " + (inputText ? inputText : "");
    let aiservice = "REP";
    let waitForUploadGenerated = false;
    let inputImage = imageUrl;
    let resultType = "IMAGE";
    
    let needSafeCheck:boolean = mandatorySafeCheck || process.env.SAFETY_CHECKER==="YES";
    let safety_tolerance = !needSafeCheck ? 5 : 4;

    if(func == "createPrompt"){
        func = room;
    }
    
    const negativePromptTemplate = (process.env.SAFETY_CHECKER=="YES" ? "NSFW, naked, nude, " : "") + 
     //   " (((too many fingers))), ((poorly drawn hands)), ((poorly drawn face)),  (((extra arms))),   (((extra legs))), (((frame))), (((canvas frame))), ((disfigured)),  ((deformed)),((extra limbs)), (((duplicate))), ((morbid)), ((mutilated)),  extra fingers, mutated hands,  (((mutation))), (((deformed))), ((ugly)), blurry, ((bad anatomy)), (((bad proportions))), cloned face,  out of frame,   (bad anatomy), ((missing arms)), ((missing legs)), (fused fingers), (((long neck))),  extra legs, extra arms,  cross-eye, body out of frame, ";
     "(semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime:1.4), text, close up, cropped, out of frame, worst quality, low quality, jpeg artifacts, pgly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck ";   
    const promptQualityControl = ", highres, 8K, best quality, finely detailed, award-winning ";      
    
    // 判断是否时DALL-E引擎，需要做特殊处理
    const isDALLE = func=="DALL-E" || (func=="logo" && room=="DALL-E") ? true : false;

    let imgWidth = width || 1024;
    let imgHeight = height || 1024;
    let imgWidthSmall = width || 768;
    let imgHeightSmall = height || 768;
    let flux_aspect_ratio = "1:1";
    let google_aspect_ratio = "1:1";
    let aspect_ratio = "1:1";
    let aliSize = "1024*1024";
    let hidreamRatio = "1024 × 1024 (Square)";
    let gptSize = "1024x1024";
    let wanxsize = '1024*1024';
    let adInpaintSize = '1024, 1024';

    if(!drawRatio){
        drawRatio = params?.ratio;
    }
    if(drawRatio){
        switch(drawRatio){
            case "916": 
                imgWidth = 576;
                imgHeight = 1024;
                imgWidthSmall = 576;
                imgHeightSmall = 1024;
                flux_aspect_ratio = "9:16";
                google_aspect_ratio = "9:16";                
                aspect_ratio = "9:16";
                aliSize = "576*1024";
                hidreamRatio = "768 × 1360 (Portrait)";
                gptSize = "1024x1536";
                wanxsize = '720*1280';     
                adInpaintSize = '768, 1344';
                break;
            case "169":
                imgHeight = 576;
                imgWidth = 1024;
                imgHeightSmall = 576;
                imgWidthSmall = 1024;
                flux_aspect_ratio = "16:9";
                google_aspect_ratio = "16:9";
                aspect_ratio = "16:9";
                aliSize = "1024*576";
                hidreamRatio = "1360 × 768 (Landscape)";
                gptSize = "1536x1024";
                wanxsize = '1280*720';          
                adInpaintSize = '1344, 768';
                break;
            case "43":
                imgHeight = 768;
                imgWidth = 1024;
                imgHeightSmall = 768;
                imgWidthSmall = 1024;
                flux_aspect_ratio = "5:4";                
                google_aspect_ratio = "4:3"; 
                aspect_ratio = "4:3";
                aliSize = "768*512";
                hidreamRatio = "1168 × 880 (Landscape)";
                gptSize = "1536x1024";
                wanxsize = '1024*768';    
                adInpaintSize = '1152, 896';
                break;
            case "34":
                imgHeight = 1024;
                imgWidth = 768;
                imgHeightSmall = 1024;
                imgWidthSmall = 768;
                flux_aspect_ratio = "4:5";                
                google_aspect_ratio = "3:4";
                aspect_ratio = "3:4";
                aliSize = "768*1024";
                hidreamRatio = "880 × 1168 (Portrait)";
                gptSize = "1024x1536";
                wanxsize = '768*1024'; 
                adInpaintSize = '896, 1152';                
                break;
            case "114":
                imgWidth = 736;
                imgHeight = 1024;
                imgHeightSmall = 888;
                imgWidthSmall = 576;
                flux_aspect_ratio = "2:3";                
                google_aspect_ratio = "3:4";   
                aspect_ratio = "3:4";
                aliSize = "768*1024";
                hidreamRatio = "1248 × 832 (Landscape)";
                gptSize = "1024x1536";
                wanxsize = '1076*768'; 
                adInpaintSize = '1024, 1024';                
                break;
        }
    }
    log(roomId, "-----------------1-----------------------------------");
    log(roomId, "imgWidth:" + imgWidth + ",imgHeight:" + imgHeight);
    
    let body:any = func=="DALL-E" ? {} : {
        webhook: process.env.WEBSITE_URL + "/api/generateHook",
        webhook_events_filter: ["completed"],
    };
        
    switch(func){

        // 阿里云的服务  
        case "wanx-ast":
            aiservice = "ALI";            
            body.input = {
                title: params.titles,
                sub_title: params.subTitles,
                text: params.texts,
                prompt_text_zh: params.prompt,
                image_url: params.imageURL,
                underlay: 1,
                logo: params.log
            }
            break;
            
        case "wanx-poster-generation-v1":
            aiservice = "ALI";            
            body.input = {
                title: params.title,
                sub_title: params.subTitle,
                body_text: params.bodyText,
                prompt_text_zh: params.prompt,
                wh_ratios: imgHeight > imgWidth ? "竖版" : "横版",
                "lora_name": params.lora,
                creative_title_layout: params.isCreative,
                "lora_weight": 0.8,
                "ctrl_ratio": 0.7,
                "ctrl_step": 0.7,
                "generate_mode": "generate",
                "generate_num": 1                                
            }
            break;
            
        case "wanx2.1-imageedit":
            aiservice = "ALI";            
            body.input = {
                function: "description_edit",
                prompt: params.prompt,
                base_image_url: params.image,
                params:{
                    n:1,
                }
            }
            if(params.mask){
                body.input.function = "description_edit_with_mask";
                body.input.mask_image_url = params.mask;
            }
            if(params.top_scale || params.bottom_scale || params.left_scale || params.right_scale){
                body.input.function = "expand";
                body.input.params = {
                    n:1,
                    "top_scale": params.top_scale,
                    "bottom_scale": params.bottom_scale,
                    "left_scale": params.left_scale,
                    "right_scale": params.right_scale,
                }
            }
            break;
            
        case "video2cartoon":
            aiservice = "ALI";
            inputImage = params.videoUrl;
            body.input = params;
            resultType = "VIDEO";
            break;
        case "video-style-transform":
            aiservice = "ALI";
            inputImage = params.videoUrl;
            body.input = {
                video_url: params.videoUrl,
                params: {
                    style: parseInt(params.cartoonStyle),
                    video_fps: 25
                }
            };
            resultType = "VIDEO";
            break;

        case "recognizeFace":
            {
                params.imageURL = await iu.resizeImage(params.imageURL, 2000); // 最大只允许2000像素
            }
        case "detectFace":
        case "auditImage":            
            resultType = "JSON";
            aiservice = "ALI";
            body.input = params;
            break;
            
        case "photo2cartoon":
        case "cartoonize":            
        case "faceTidyup":
        case "faceMakeup":
        case "faceFilter":
        case "enhanceFace":
        case "faceBeauty":
        case "segmentBody":
        case "segmentHair":
        case "segmentSkin":            
        case "retouchSkin":
        case "liquifyFace":
            aiservice = "ALI";
            body.input = params;
            resultType = "IMAGE";
            break;


        //////////////////////////////////////////////////////////////////////////////////            
        case "minimax-image-01":
            body.predictUrl = `https://api.replicate.com/v1/models/minimax/image-01/predictions`;
            waitForUploadGenerated = true; 
            body.input = {
                prompt: realText,
                aspect_ratio: aspect_ratio,
                prompt_optimizer: true
            }
            if(imageUrl){
                body.input.subject_reference = imageUrl;
            }
            break;

        case "minimax-video-01-director":
        case "minimax-video-01-live":
        case "minimax-video-01":{
            aiservice = "REP";
            const m = func.replace("minimax-", '');
            body.predictUrl = `https://api.replicate.com/v1/models/minimax/${m}/predictions`;
            body.input = {
                prompt: params.prompt,
                prompt_optimizer: true
                
            }
            if(params.imageURL){
                body.input.first_frame_image = params.imageURL;
            }   
            if(params.faceImage){
                body.subject_reference = params.faceImage;
            }
            resultType = "VIDEO";
            break;               
        }

        case "minimax-hailuo-02-standard":
        case "minimax-hailuo-02-pro": {
            let funcSegs: string[] = func?.split("-") || [];  // 使用可选链 + 默认值
            let type = funcSegs.pop() || "standard"; // 
            const source = params.imageURL ? "image" : "text";
            
            aiservice = "FAL";
            body.version = `fal-ai/minimax/hailuo-02/${type}/${source}-to-video`;                
            body.input = {
                prompt: params.prompt,                    
                aspect_ratio: params.ratio,
                duration: params.duration < 10 ? "6" : "10"
            }  
            if(params.imageURL){
                body.input.image_url = params.imageURL;
            }
            resultType = "VIDEO";
            break;            
        }              
            
        // 视频生成的服务
        case "text2video":{
        //    if(!serviceLine){
        //        serviceLine = process.env.SERVICE_TEXT2VIDEO;
        //    }
            serviceLine = "FAL"; // replicate不支持text2video
            if(serviceLine == "FAL"){
                aiservice = "FAL";
                body.input = {
                    prompt: params.prompt,
                    aspect_ratio: params.ratio,
                    duration: params.duration
                }
                switch(params.model){
                    case "PRO_PLUS":
                        body.version = "fal-ai/kling-video/v1.6/pro/text-to-video";
                        break;
                    case "PRO":
                        body.version = "fal-ai/kling-video/v1.5/pro/text-to-video";
                        break;
                    case "STANDARD":
                    default:
                        body.version = "fal-ai/kling-video/v1.6/standard/text-to-video";
                }
            }else{
                aiservice = "REP";
                body.input = {
                    prompt: params.prompt,
                    duration: params.duration,
                    aspect_ratio: params.ratio,
                }
                switch(params.model){
                    case "PRO_PLUS":
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-pro/predictions";
                        break;
                    case "PRO":
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-pro/predictions";
                        break;
                    case "STANDARD":
                    default:
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions";
                }
            }
            resultType = "VIDEO";
            break;
        }
        case "image2video":{
            if(!serviceLine){
                serviceLine = process.env.SERVICE_IMAGE2VIDEO;
            }
            if(serviceLine == "FAL"){
                aiservice = "FAL";
                body.input = {
                    prompt: params.prompt,
                    image_url: params.imageURL,
                    aspect_ratio: params.ratio,
                    duration: params.duration
                }  
                switch(params.model){
                    case "PRO_PLUS":
                        body.version = "fal-ai/kling-video/v1.6/pro/image-to-video";
                        break;
                    case "PRO":
                        body.version = "fal-ai/kling-video/v1.5/pro/image-to-video";
                        break;
                    case "STANDARD":
                    default:
                        body.version = "fal-ai/kling-video/v1.6/standard/image-to-video";
                }
            }else{
                aiservice = "REP";
                body.input = {
                    start_image: params.imageURL,
                    prompt: params.prompt,
                    duration: params.duration,
                    aspect_ratio: params.ratio,
                }
                switch(params.model){
                    case "PRO_PLUS":
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-pro/predictions";
                        break;
                    case "PRO":
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-pro/predictions";
                        break;
                    case "STANDARD":
                    default:
                        body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions";
                }
            }
            resultType = "VIDEO";
            break;
        }

        case "motion-2.0-480p":
            body.predictUrl = "https://api.replicate.com/v1/models/leonardoai/motion-2.0/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                aspect_ratio: params.ratio,
            }
            resultType = "VIDEO";
            break;

        case "kling-v2.1-master":
        case "kling-v2.1-standard":
        case "kling-v2-master":
        case "kling-v1.6-pro":
        case "kling-v1.6-standard":{
            let funcSegs: string[] = func?.split("-") || [];  // 使用可选链 + 默认值
            let type = funcSegs?.[2] || "standard"; // func == "kling-v1.6-pro" ? "pro" : "standard";
            let version = funcSegs?.[1] || "v1.6"; // 1.6;
            const source = params.imageURL ? "image" : "text";
            
            if(serviceLine == "FAL"){
                aiservice = "FAL";
                body.version = `fal-ai/kling-video/${version}/${type}/${source}-to-video`;                
                body.input = {
                    prompt: params.prompt,                    
                    aspect_ratio: params.ratio,
                    duration: params.duration
                }  
                if(params.imageURL){
                    body.input.image_url = params.imageURL;
                }
            }else{
                aiservice = "REP";
                body.predictUrl = `https://api.replicate.com/v1/models/kwaivgi/kling-${version}-${type}/predictions`;                
                body.input = {
                    prompt: params.prompt,
                    duration: params.duration,
                    aspect_ratio: params.ratio,
                }
                if(params.imageURL){
                    body.input.start_image = params.imageURL;
                }
            }
            resultType = "VIDEO";
            break;            
        }            

        case "google-veo-3-fast":{
            body.predictUrl = "https://api.replicate.com/v1/models/google/veo-3-fast/predictions";
            body.input = {
                prompt : await translate(params.prompt),
            }
            resultType = "VIDEO";
            break;    
        }
        case "google-veo-3":{
            body.predictUrl = "https://api.replicate.com/v1/models/google/veo-3/predictions";
            body.input = {
                prompt : await translate(params.prompt),
            }
            resultType = "VIDEO";
            break;    
        }
        case "google-veo-2":{
            aiservice = "FAL";
            body.input = {
                duration: "5s",
                prompt: await translate(params.prompt),
                aspect_ratio: params.ratio
            }
            if(params.imageURL){
                body.version = `fal-ai/veo2/image-to-video`;
                body.input.image_url = params.imageURL;
            }else{
                body.version = `fal-ai/veo2`;
            }
            resultType = "VIDEO";
            break;               
        }

        case "hunyuan-video-pro":
        case "hunyuan-video":{
            aiservice = "FAL";
            body.input = {
                resolution: "720p",
                prompt: params.prompt,
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
                num_frames: 129
            }  
            if(params.imageURL){
                body.version = "fal-ai/hunyuan-video-image-to-video";
            }else{
                body.version = "fal-ai/hunyuan-video";
            }
            if(func == "hunyuan-video-pro"){
                body.input.pro_mode = true;
            }
            resultType = "VIDEO";
            break;                
        }

        case "pika-v2.2-1080p":
        case "pika-v2.2-720p":{
            aiservice = "FAL";
            body.input = {
                resolution: func.split('-').pop(),
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
                duration: params.duration
            }  
            if(params.imageURL){
                body.version = "fal-ai/pika/v2.2/image-to-video";
            }else{
                body.version = "fal-ai/pika/v2.2/text-to-video";
            }
            resultType = "VIDEO";
            break;                
        }         

        case "magi-distilled":
        case "magi":
            aiservice = "FAL";
            body.input = {
                resolution: "720p",
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                num_frames: params.duration * 24, // 一秒24帧
                aspect_ratio: params.ratio,
                enable_safety_checker: needSafeCheck,
            }  
            if(params.imageURL){
                body.version = `fal-ai/${func}/image-to-video`;
            }else{
                body.version = `fal-ai/${func}`;
            }
            resultType = "VIDEO";
            break;                

        case "framepack-720p":
            aiservice = "FAL";
            body.input = {
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
                end_image_url: params.endImageURL,
                enable_safety_checker: needSafeCheck,
            }  
            if(params.endImageURL){
                body.version = "fal-ai/framepack/flf2v";
            }else{
                body.version = "fal-ai/framepack";
            }
            resultType = "VIDEO";
            break;   

        case "skyreels-i2v":
            aiservice = "FAL";
            body.version = "fal-ai/skyreels-i2v";
            body.input = {
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
            }  
            resultType = "VIDEO";
            break; 
            
        case "vidu-q1":
            aiservice = "FAL";
            body.input = {
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
                start_image_url: params.imageURL,
                end_image_url: params.endImageURL,
                enable_safety_checker: needSafeCheck,
            }  
            if(params.imageURL){
                if(params.endImageURL){
                    body.version = "fal-ai/vidu/q1/start-end-to-video";
                }else{
                    body.version = "fal-ai/vidu/q1/image-to-video";
                }
            }else{
                body.version = "fal-ai/vidu/q1/text-to-video";
            }
            resultType = "VIDEO";
            break;                

        case "pixverse-v4-1080p":
            aiservice = "REP";
            body.predictUrl = "https://api.replicate.com/v1/models/pixverse/pixverse-v4/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                quality: "1080p",
                image: params.imageURL,
                duration: params.duration,
                aspect_ratio: params.ratio,                
            }
            resultType = "VIDEO";
            break;  
            
        case "pixverse-v4.5-1080p":
            aiservice = "REP";
            body.predictUrl = "https://api.replicate.com/v1/models/pixverse/pixverse-v4.5/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                quality: "1080p",
                image: params.imageURL,
                duration: params.duration,
                aspect_ratio: params.ratio,   
            }
            if(params.endImageURL){
                body.input.last_frame_image = params.endImageURL;
            }
            resultType = "VIDEO";
            break;      

        case "pixverse-v3.5-540p":
        case "pixverse-v3.5-720p":
        case "pixverse-v3.5-1080p": {
            aiservice = "FAL";
            body.input = {
                resolution: func.split('-').pop(),
                prompt: await translate(params.prompt),
                image_url: params.imageURL,
                aspect_ratio: params.ratio,
                duration: params.duration,
                enable_safety_checker: needSafeCheck,
            }  
            if(params.imageURL){
                body.version = "fal-ai/pixverse/v3.5/image-to-video";
            }else{
                body.version = "fal-ai/pixverse/v3.5/text-to-video";
            }
            resultType = "VIDEO";
            break;                
        }
            
        case "luma-ray-2-540p":
        case "luma-ray-2-720p":  
        case "luma-ray-flash-2-540p":
        case "luma-ray-flash-2-720p": {           
            aiservice = "REP";
            const m = func.replace("luma-", '');
            body.predictUrl = `https://api.replicate.com/v1/models/luma/${m}/predictions`;
            body.input = {
                prompt: await translate(params.prompt),
                duration: params.duration==10 ? 9 : 5, // 不足十秒
                aspect_ratio: params.ratio
            }
            if(params.imageURL){
                body.input.start_image_url = params.imageURL;
            }
            if(params.endImageURL){
                body.input.end_image_url = params.endImageURL;
            }
            resultType = "VIDEO";
            break;               
        }    
    
        case "wan-2.1-i2v-480p":
        case "wan-2.1-t2v-480p":
        case "wan-2.1-i2v-720p":            
        case "wan-2.1-t2v-720p":{
            aiservice = "REP";
            body.predictUrl = `https://api.replicate.com/v1/models/wavespeedai/${func}/predictions`;
              body.input = {
                prompt: params.prompt,
            }
            if(params.imageURL && func.indexOf("i2v")>=0){
                const imgSize = await iu.getImageSize(params.imageURL);
                if(imgSize){
                    const maxArea = func.indexOf("480p")>=0 ? (imgSize.width>imgSize.height ? "832x480" : "480x832" ) : (imgSize.width>imgSize.height ? "1280x720" : "720x1280");
                    body.input.max_area = maxArea;
                }
                body.input.image = params.imageURL;
            }else{
                body.predictUrl.repace("-i2v-", "-t2v-");
                body.input.aspect_ratio = params.ratio;
            }
            resultType = "VIDEO";
            break;               
        }

        case "ltx-video-v097":
            aiservice = "FAL";
            if(aspect_ratio === "1:1"){
                aspect_ratio = "9:16";
            }
            body.input = {
                prompt: await translate(params.prompt),
                target_size: 640,
                resolution: "720p"
            }
            if(params.imageURL){
                body.version = "fal-ai/ltx-video-v097/image-to-video";
                body.input.image_url = params.imageURL;
            }else{
                body.input.aspect_ratio = aspect_ratio;
                body.version = "fal-ai/ltx-video-v097";                    
            }
            resultType = "VIDEO";
            break;  
            
        case "ltx-video":
            // fofr/ltx-video 983ec70a06fd872ef4c29bb6b728556fc2454125a5b2c68ab51eb8a2a9eaa46a
            body.version = "983ec70a06fd872ef4c29bb6b728556fc2454125a5b2c68ab51eb8a2a9eaa46a";
            body.input = {
                prompt: await translate(params.prompt) + " The people is moving slowly. The lighting is natural. The scene appears to be real-life footage.",
                target_size: 640,
                aspect_ratio: params.ratio,
                length: (params.duration / 5) * 128 + 1,
            }
            if(params.imageURL){
                body.input.image = params.imageURL;
            }
            resultType = "VIDEO";
            break;
            
        case "faceswapHD":
            aiservice = "PI";
            body.version = "faceswap";
            body.input = {
                target_image: params.target_image,
                swap_image: params.swap_image,
                result_type: "url"
            }            
            break;

        case "faceswapV4":
            aiservice = "SEGMIND";
            body.version = "faceswapV4";
            body.input = {
                target_image: params.target_image, 
                source_image: params.swap_image,
                model_type: params.model_type,
                swap_type: params.swap_type,
                style_type: params.style_type,
                "image_format": "jpeg",
                "image_quality": 90,   
                "base64": true,
                hardware: params.hardware,
            }
            break;
            
        case "byte-faceswap":
            aiservice = "BYTE";
            body.version = "byte-faceswap";
            body.input = {
                image_urls: [params.swap_image, params.target_image],
                do_risk: true,
                gpen: 1,
                skin: 0,                
            }
            break;
            
        case "faceswap": 
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FACESWAP;
            }
            if(serviceLine == "AM"){
                aiservice = "AM";
                body.version = "faceswap-V2";
                body.input = {
                    swap_image: params.swap_image,
                    target_image: params.target_image                    
                }
            }else if(serviceLine == "FAL"){ // 容易堵塞
                aiservice = "FAL";
                body.version = "fal-ai/face-swap";
                body.input = {
                    swap_image: params.swap_image,
                    base_image: params.target_image,    
                    
                    swap_image_url: params.swap_image,
                    base_image_url: params.target_image    
                }

                // REP的收费 $0.0014/秒，AVG:12秒 $0.0168
            }else if(serviceLine == "REP"){ // 容易发生重复旧结果，无解
                // xiankgx/face-swap:cff87316e31787df12002c9e20a78a017a36cb31fde9862d8dedd15ab29b7288
                aiservice = "REP";
                body.version = "cff87316e31787df12002c9e20a78a017a36cb31fde9862d8dedd15ab29b7288";
                body.input = {
                    source_image: params.swap_image,
                    target_image: params.target_image,
                    cache_days: 0
                }
            }else if(serviceLine == "REP_2"){ // 需要reboot
                // cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111
                aiservice = "REP";
                body.version = "d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";
                body.input = {
                    swap_image: params.swap_image,
                    input_image: params.target_image,
                }
            }else if(serviceLine == "REP_3"){ // cpu速度30秒
                // codeplugtech/face-swap:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34
                aiservice = "REP";
                body.version = "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34";
                body.input = {
                    swap_image: params.swap_image,
                    input_image: params.target_image,
                }
            }else if(serviceLine == "PI"){ // USD$.0.01/张 容易失败，并且不报错，偶发性缓慢
                aiservice = "PI";
                body.version = "faceswap";
                body.input = {
                    target_image: params.target_image,
                    swap_image: params.swap_image,
                    result_type: "url"
                }
            }else if(serviceLine == "SEGMIND"){ // $0.0015/秒 AVG:3秒  $0.0045 容易面部模糊
                aiservice = "SEGMIND";
                body.version = "faceswap";
                body.input = {
                    target_img: params.target_image,
                    source_img: params.swap_image,
                    "input_faces_index": 0,
                    "source_faces_index": 0,
                    "face_restore": "codeformer-v0.1.0.pth",
                    "base64": true                
                }
            }
            resultType = "IMAGE";                        
            break;
            

        // DALL-E的服务
        case "DALL-E":
            aiservice = "DALLE";
            resultType = "IMAGE";            
            let size = "1024x1024";
            switch(drawRatio){
                case "916" : 
                    size = "1024x1792";
                    break;
                case "169" : 
                    size = "1792x1024";
                    break;
            }                
            body.prompt = await translate(realText? realText : inputText);
            body.model = "dall-e-3";
            body.n = 1;
            body.style = "natural";
            body.size = size;
            predicturl = process.env.OPENAI_API_PROXY + "?CMD=text2img";
            authstr = "Bearer " + process.env.OPENAI_API_KEY;  
            break;


       // replicate服务         
            
        case "detectAnything":
            // franz-biz/yolo-world-xl:fd1305d3fc19e81540542f51c2530cf8f393e28cc6ff4976337c3e2b75c7c292"
            body.version = "fd1305d3fc19e81540542f51c2530cf8f393e28cc6ff4976337c3e2b75c7c292";
            body.input = {
                input_media : params.imageURL,
                max_num_boxes: 10,
                score_thr: 0.1,
                nms_thr: 0.5,
                return_json: false,
                class_names: "dog, cat, horse, eye, tongue, ear, person, nose, car, bus, bicycle, train, subway, airplane, ship, tree, sun, moon, cloud, grass, flower, chair, bottle, hat, shoe, t-shirt, skirt, hair",
            };
            resultType = "JSON";            
            break;
            
        case "epicrealismxl":
            // fofr / epicrealismxl-lightning-hades 0ca10b1fd361c1c5568720736411eaa89d9684415eb61fd36875b4d3c20f605a
            body.version = "0ca10b1fd361c1c5568720736411eaa89d9684415eb61fd36875b4d3c20f605a";
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                width: imgWidth,
                height: imgHeight, 
                output_format: "jpg",
                disable_safety_checker: !needSafeCheck,
            }; 
            if(imageUrl){body.input.image = imageUrl}            
            break;            

        // ----create prompt-----

        // -----FLUX-------
        case "flux-schnell":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_SCHNELL;
            }         
            switch(serviceLine){
                case "WAVE":{
                    aiservice = "WAVE";
                    body.version = func;
                    body.input = {
                        image: imageUrl || params?.image,
                        mask_image: mask || params?.mask,                        
                        size: aliSize,
                        prompt: await translate(realText) + promptQualityControl,
                        enable_base64_output: false,
                        enable_safety_checker: needSafeCheck
                    };
                    break;
                }
                case "ALI": 
                    if(!imageUrl){
                        aiservice = "ALI";
                        body.input = {
                            prompt: realText || inputText,
                            params: {
                                size: aliSize,
                                seed: parseInt(seed || 0),
                            }
                        };
                        break;                    
                    }
                case "FAL": {
                    aiservice = "FAL";
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        image_size: {
                            height: imgHeight,
                            width: imgWidth
                        },
                        enable_safety_checker: needSafeCheck,
                        sync_mode: true,        
                    }
                    if(imageUrl){
                        body.version = "fal-ai/flux/schnell/redux";    
                        body.input.image_url = imageUrl;
                    }else{
                        body.version = "fal-ai/flux/schnell";
                    }                    
                    break;
                }
                case "REP":{
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        output_format: "jpg",
                        output_quality: 100,
                        aspect_ratio: flux_aspect_ratio,
                        disable_safety_checker: !needSafeCheck,
                        safety_tolerance: safety_tolerance
                    };
                    if(imageUrl){
                        body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-redux-schnell/predictions`;
                        body.input.redux_image = imageUrl;                        
                    }else{
                        body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions`;
                    }                        
                    waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
                    break;
                }
            }
            break;

        case "flux-dev-ultra-fast":
            aiservice = "WAVE";
            body.version = func;
            body.input = {
                image: imageUrl || params?.image,
                mask_image: mask || params?.mask,                             
                size: aliSize,
                prompt: await translate(realText) + promptQualityControl,
                enable_base64_output: false,
                enable_safety_checker: needSafeCheck
            };
            break;
            
        case "flux-dev": {
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_DEV;
            }         
            switch(serviceLine){
                case "ALI": 
                    if(!imageUrl){
                        aiservice = "ALI";
                        body.input = {
                            prompt: realText || inputText,
                            params: {
                                size: aliSize,
                                seed: parseInt(seed || 0),
                            }
                        };
                        break;                    
                    }                       
                case "WAVE":
                    aiservice = "WAVE";
                    body.version = func;
                    body.input = {
                        image: imageUrl || params?.image,
                        mask_image: mask || params?.mask,                             
                        size: aliSize,
                        prompt: await translate(realText) + promptQualityControl,
                        enable_base64_output: false,
                        enable_safety_checker: needSafeCheck
                    };
                    break;
                case "REP":
                default: {
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        output_format: "jpg",
                        output_quality: 100,
                        aspect_ratio: flux_aspect_ratio,
                        disable_safety_checker: !needSafeCheck,
                        safety_tolerance: safety_tolerance
                    };
                    if(imageUrl){
                        body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions`;
                        body.input.redux_image = imageUrl;      
                        body.prompt_strength = 0.8;
                    }else{
                        body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions`;
                    }               
                    waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
                }            
            }
            break;
        }

        case "flux-merged": {
            aiservice = "ALI";
            body.input = {
                prompt: realText || inputText,
                params: {
                    size: aliSize,
                    seed: parseInt(seed || 0),
                }
            };
            break;                    
        }      
    
        case "flux-1.1-pro":
        case "flux-pro": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                output_format: "jpg",
                output_quality: 100,
                aspect_ratio: "custom",
                width: imgWidth,
                height: imgHeight,
                prompt_upsampling: false,
                disable_safety_checker: !needSafeCheck,
                safety_tolerance: safety_tolerance
            };
            if(imageUrl){
                body.input.image_prompt = imageUrl;
                body.input.image_prompt_strength = 0.8;
            }
            body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions`;
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
            break;
        }

        case "flux-pro-ultra":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_PRO_ULTRA;
            }
            switch(serviceLine){            
                case "FAL": {
                    aiservice = "FAL";
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        aspect_ratio: flux_aspect_ratio,                        
                        enable_safety_checker: needSafeCheck,
                        sync_mode: true, 
                        safety_tolerance: safety_tolerance,
                        raw: true                        
                    }
                    if(imageUrl){
                        body.version = "fal-ai/flux-pro/v1.1-ultra/redux";
                        body.input.image_url = imageUrl;
                        body.input.image_prompt_strength = 0.8;
                    }else{
                        body.version = "fal-ai/flux-pro/v1.1-ultra";
                    }
                    break;
                }
                case "REP":
                default: {
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        output_format: "jpg",
                        aspect_ratio: flux_aspect_ratio,
                        safety_tolerance: safety_tolerance,
                        raw: true
                    };
                    if(imageUrl){
                        body.input.image_prompt = imageUrl;
                        body.image_prompt_strength = 0.8;
                    }                    
                    body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions`;
                    waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
                    break;
                }
            }
            break;
            
        case "hyper-flux-8step":
            // bytedance/hyper-flux-8step:81946b1e09b256c543b35f37333a30d0d02ee2cd8c4f77cd915873a1ca622bad
            body.version = "81946b1e09b256c543b35f37333a30d0d02ee2cd8c4f77cd915873a1ca622bad";
            body.input = {
                prompt: await translate(realText? realText : inputText),
                aspect_ratio: "custom",
                width: imgWidth,
                height: imgHeight,
                disable_safety_checker: !needSafeCheck,
                output_quality: 100,
                output_format: "jpg",
            };
            break;
            
        case "flux-dev-realism":
            // xlabs-ai/flux-dev-realism:39b3434f194f87a900d1bc2b6d4b983e90f0dde1d5022c27b52c143d670758fa
            body.version = "39b3434f194f87a900d1bc2b6d4b983e90f0dde1d5022c27b52c143d670758fa";
            body.input = {
                prompt: await translate(realText? realText : inputText) ,
                aspect_ratio: flux_aspect_ratio,
                disable_safety_checker: !needSafeCheck,
                output_quality: 100,
                output_format: "jpg",
            };
            break;

        case "flux-cinestill":
            // adirik/flux-cinestill:216a43b9975de9768114644bbf8cd0cba54a923c6d0f65adceaccfc9383a938f
            body.version = "216a43b9975de9768114644bbf8cd0cba54a923c6d0f65adceaccfc9383a938f";
            body.input = {
                prompt: "CNSTLL, " + await translate(realText? realText : inputText) ,
                aspect_ratio: "custom",
                width: imgWidth,
                height: imgHeight,
                disable_safety_checker: !needSafeCheck,
                output_quality: 100,
                output_format: "jpg",
            };
            break;

        case "flux-half-illustration":
            // davisbrown/flux-half-illustration:687458266007b196a490e79a77bae4b123c1792900e1cb730a51344887ad9832
            body.version = "687458266007b196a490e79a77bae4b123c1792900e1cb730a51344887ad9832";
            body.input = {
                prompt: "In the style of TOK, " + await translate(realText? realText : inputText),
                aspect_ratio: flux_aspect_ratio,
                disable_safety_checker: !needSafeCheck,
                output_quality: 100,
                output_format: "jpg",
            };
            break;

        case "flux-lora-fill":
            aiservice = "FAL";
            body.version = "fal-ai/flux-lora-fill";                    
            body.input = {
                prompt: await translate(params.prompt),
                image_url: params.image,
                mask_url: params.mask,
                loras: [{
                    path:params.loraURL,
                    scale: params.loraScale || 1, 
                }],                                
                num_inference_steps : 35,
                image_size : {
                    width: imgWidth,
                    height: imgHeight
                },
                output_format : "jpeg",
                enable_safety_checker: needSafeCheck,
                sync_mode: true, 
                safety_tolerance: safety_tolerance,
            }
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器            
            break;
            
        case "flux-fill-dev":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_FILL_DEV;
            }
            switch(serviceLine){    
                case "WAVE":{
                    aiservice = "WAVE";
                    body.version = func;
                    body.input = {
                        image: params.image,
                        mask_image: params.mask,                        
                        size: aliSize,
                        prompt: await translate(realText) + promptQualityControl,
                        enable_base64_output: false,
                        enable_safety_checker: needSafeCheck
                    };
                    break;
                }
                case "FAL":{
                    aiservice = "FAL";
                    body.version = "fal-ai/flux-lora-fill";                    
                    body.input = {
                        prompt: await translate(params.prompt),
                        image_url: params.image,
                        mask_url: params.mask,
                        guidance_scale: params.guidance || 30,
                        num_inference_steps : 35,
                        image_size : {
                            width: imgWidth,
                            height: imgHeight
                        },
                        enable_safety_checker: needSafeCheck,
                        sync_mode: true, 
                        safety_tolerance: safety_tolerance,
                    }
                    break;
                }
                case "REP":
                default:{                    
                    body.input = {
                        prompt: await translate(params.prompt),
                        "image": params.image,
                        "mask": params.mask,
                        num_inference_steps: 35,
                        guidance: params.guidance || 30,
                        output_format: "jpg",
                        output_quality: 100,
                        prompt_upsampling: false,
                        disable_safety_checker: !needSafeCheck,
                        safety_tolerance: safety_tolerance,
                    };
                    body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-fill-dev/predictions`;
                }
            }
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
            break;
            
        case "flux-fill-pro":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_FILL_PRO;
            }
            switch(serviceLine){
                case "FAL":{
                    aiservice = "FAL";
                    body.version = "fal-ai/flux-pro/v1/fill";                    
                    body.input = {
                        prompt: await translate(params.prompt),
                        image_url: params.image,
                        mask_url: params.mask,
                        aspect_ratio: flux_aspect_ratio,                        
                        enable_safety_checker: needSafeCheck,
                        sync_mode: true, 
                        safety_tolerance: safety_tolerance,
                    }
                    break;
                }
                case "REP":
                default:{
                    body.input = {
                        prompt: await translate(params.prompt),
                        "image": params.image,
                        "mask": params.mask,
                        // guidance: 4,
                        output_format: "jpg",
                        output_quality: 100,
                        prompt_upsampling: params.prompt_upsampling,
                        disable_safety_checker: !needSafeCheck,
                        safety_tolerance: safety_tolerance,
                    };
                    body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions`;
                    waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
                    break;
                }
            }
            break;
            
        case "flux-dev-inpaint":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_INPAINT;
            }            
            switch(serviceLine){
                case "WAVE":{
                    aiservice = "WAVE";
                    body.version = func;
                    body.input = {
                        image: params.image,
                        mask_image: params.mask,                        
                        size: aliSize,
                        prompt: await translate(realText) + promptQualityControl,
                        enable_base64_output: false,
                        enable_safety_checker: needSafeCheck
                    };
                    break;
                }
                case "SEGMIND":
                    aiservice = "SEGMIND";
                    body.version = "flux-inpaint";
                    body.input = {
                        "base64": true,
                        "guidance_scale": 3.5,
                        "image": params.image,
                        "image_format": "jpeg",
                        "mask": params.mask,
                        "negative_prompt": "bad quality, painting, blur",
                        "num_inference_steps": 25,
                        "prompt": await translate(params.prompt),
                        "quality": 95,
                        "sampler": "euler",
                        "samples": 1,
                        "scheduler": "simple",
                        "strength": 0.9                
                    };
                    break;
                default:
                    // zsxkib/flux-dev-inpainting:ca8350ff748d56b3ebbd5a12bd3436c2214262a4ff8619de9890ecc41751a008
                    body.version = "ca8350ff748d56b3ebbd5a12bd3436c2214262a4ff8619de9890ecc41751a008";
                    body.input = params;
                    body.input.prompt = await translate(params.prompt);
                    body.input.output_format = "jpg";
            }
            break;

        case "flux-canny-pro":
            body.input = {
                prompt: await translate(params.prompt),
                control_image: params.imageURL,
                guidance: params.guidance || 30,
                output_format: "jpg",
                safety_tolerance: safety_tolerance,                
                disable_safety_checker: !needSafeCheck,
            };
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-canny-pro/predictions";
            break;
        case "flux-depth-pro":
            body.input = {
                prompt: await translate(params.prompt),
                control_image: params.imageURL,
                guidance: params.guidance,
                output_format: "jpg",
                safety_tolerance: safety_tolerance,                
                disable_safety_checker: !needSafeCheck,
            };
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-depth-pro/predictions";
            break;

        case "step1x-edit":
            // zsxkib/step1x-edit:12b5a5a61e3419f792eb56cfc16eed046252740ebf5d470228f9b4cf2c861610
            body.version = "12b5a5a61e3419f792eb56cfc16eed046252740ebf5d470228f9b4cf2c861610";
            body.input = {
                prompt: await translate(params.prompt),
                image: params.image,
                size_level: 1024,
                output_format: "jpg",
                output_quality: 100,
            }
            break;

        case "hidream-e1-full": {
            aiservice = "FAL";
            body.version = "fal-ai/hidream-e1-full";
            body.input = {
                image_url: params.image,
                edit_instruction: await translate(params.prompt),
                negative_prompt: negativePromptTemplate,
                sync_mode: true,
                enable_safety_checker : needSafeCheck,                        
                output_format: "jpeg",
            }
            break;
        }
            
        case "ideogram":
        case "ideogram-v2":
            // ideogram-ai/ideogram-v2
            body.predictUrl = `https://api.replicate.com/v1/models/ideogram-ai/ideogram-v2/predictions`;
            body.input = params;
            body.input.mask = await iu.reverseMaskImage(params.mask);
            body.input.prompt = await translate(params.prompt) ;
            break;

        case "ideogram-v3-turbo":
        case "ideogram-v3-balanced":
        case "ideogram-v3-quality":
            // ideogram-ai/ideogram-v3-quality            
            body.predictUrl = `https://api.replicate.com/v1/models/ideogram-ai/${func}/predictions`;
            body.input = {
                prompt: await translate(realText || inputText || params?.prompt),
                aspect_ratio,
            }
            if(imageUrl){
                body.input.style_reference_images = [imageUrl];
                body.input.style_typ = "Auto";
                if(!body.input.prompt){
                    body.input.prompt = "a photo";
                }
            }
            if(params?.image && params?.mask){
                body.input.image = params.image;
                body.input.mask = await iu.reverseMaskImage(params.mask);
            }            
            break;

        case "ideogram-v3-bg-turbo":
            aiservice = "FAL";
            body.version = "fal-ai/ideogram/v3/replace-background";
            body.input = {
                rendering_speed: "TURBO",
                expand_prompt: true,

                image_url: params.image_url,
                prompt: await translate(params.prompt),
                
                sync_mode: true,
                enable_safety_checker : needSafeCheck,                        
                output_format: "jpeg",
            }
            break;
            
        case "ideogram-t":
            // ideogram-ai/ideogram-v2
            body.predictUrl = `https://api.replicate.com/v1/models/ideogram-ai/ideogram-v2-turbo/predictions`;
            body.input = params;
            body.input.mask = await iu.reverseMaskImage(params.mask);
            body.input.prompt = await translate(params.prompt) ;
            break;
            
        case "take-off-eyeglasses":
            // storymy/take-off-eyeglasses c6e2acbb2d27694609bccbf05cf3669959591b6da3ab78c8b51c6886a913c5bc
            body.version = "c6e2acbb2d27694609bccbf05cf3669959591b6da3ab78c8b51c6886a913c5bc";
            body.input = {
                image: params.image
            }
            break;
            
        case "flux-pulid":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FLUX_PULID;
            }
            switch(serviceLine){
                case "SEGMIND":{
                    aiservice = "SEGMIND";
                    body.version = "flux-pulid";
                    body.input = {
                        "base64": true,                        
                        "seed": -1,
                        "width": imgWidth,
                        "height": imgHeight,
                        "prompt": await translate(realText? realText : inputText),
                        "main_face_image": params.swap_image,
                        "true_cfg": 1,
                        "id_weight": 1.05,
                        "num_steps": 20,
                        "start_step": 0,
                        "num_outputs": 1,
                        "output_format": "jpg",
                        "guidance_scale": 4,
                        "output_quality": 100,
                        "negative_prompt": negativePromptTemplate,
                        "max_sequence_length": 128
                    }
                    break;
                }
                case "FAL": {
                    aiservice = "FAL";
                    body.version = "fal-ai/flux-pulid";
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        reference_image_url: params.swap_image,
                        image_size : {
                            width: imgWidth,
                            height: imgHeight
                        },      
                        sync_mode: true,
                        enable_safety_checker : needSafeCheck,                        
                    }
                    break;
                }
                case "REP":
                default: {                    
                    // zsxkib/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b
                    aiservice = "REP";
                    body.version = "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b";
                    body.input = {
                        main_face_image: params.swap_image,
                        height: imgHeight,
                        width: imgWidth,
                        id_weight: 1.05,
                        output_quality: 100,
                        // output_format: "jpg",  // 会报错
                        prompt: await translate(realText? realText : inputText),
                        negative_prompt: negativePromptTemplate,
                    }
                }
            }
            break;

        case "omnigen":
            func = "omnigen-v1";
        case "omnigen-v2":
        case "omnigen-v1":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_OMNIGEN;
            }
            let imgs: string[] = [params.img1, params.img2, params.img3].filter(Boolean);

            switch(serviceLine){
                case "FAL":{
                    aiservice = "FAL";    
                    body.version = `fal-ai/${func}`;
                    body.input = {
                        prompt : await translate(params.prompt),
                        image_size : {
                            width: imgWidth,
                            height: imgHeight
                        },
                        sync_mode : true,
                        output_format : "jpeg",
                        enable_safety_checker : needSafeCheck,
                        input_image_urls : imgs
                    }                    
                    break;
                }
                case "REP":
                default:{
                    // chenxwh/omnigen:af66691a8952a0ce21b26e840835ad1efe176af159e10169ec5df6916338863b
                    // vectorspacelab/omnigen:af66691a8952a0ce21b26e840835ad1efe176af159e10169ec5df6916338863b
                    // lucataco/omnigen2:5b9ea1d0821a60be9c861ebfc3513d121ecd8cab1932d3aa8d703e517988502e
                    switch(func){
                        case "omnigen-v2":
                            body.version = "5b9ea1d0821a60be9c861ebfc3513d121ecd8cab1932d3aa8d703e517988502e";
                            break;
                        case "omnigen":
                        case "omnigen-v1":
                        default:
                            body.version = "af66691a8952a0ce21b26e840835ad1efe176af159e10169ec5df6916338863b";
                            break;
                    }
                    body.input = {
                        prompt : await translate(params.prompt),
                        img1 : params.img1,
                        img2 : params.img2,
                        img3 : params.img3,
                        image: params.img1, 
                        image_2 : params.img2, 
                        image_3 : params.img3,
                        use_input_image_size_as_output : false,
                        max_input_image_size : 2048,
                        max_input_image_side_length : 2048,
                        width : imgWidth,
                        height : imgHeight,
                    }
                    break;
                }
            }
            break;
            
        case "aura-flow":
            // lucataco/aura-flow-v0.2:e784141e567364018b6c24297273e910b80c468c60ccb2a2a6642c034c7d43ee
            body.version = "e784141e567364018b6c24297273e910b80c468c60ccb2a2a6642c034c7d43ee";
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                width: imgWidth,
                height: imgHeight, 
                output_format: "jpg",
                disable_safety_checker: !needSafeCheck,
            };          
            break;

        case "recraft-v3":{
            aiservice = "FAL";    
            body.version = "fal-ai/recraft-v3";
            body.input = {
                prompt: await translate(realText? realText : inputText),
                image_size : {
                    width: imgWidth,
                    height: imgHeight
                }
            }                    
            break;            
        }

        case "midjourney-imagine":
            aiservice = "PI";
            body.version = func;
            body.input = {
                prompt: await translate(realText? realText : inputText) + " --v 7",
                aspect_ratio: aspect_ratio,
                "process_mode": "turbo",
                "skip_prompt_check": false
            }            
            break;
            
        case "imagen-3-fast": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                negative_prompt: negativePromptTemplate,
                aspect_ratio: google_aspect_ratio,
                safety_filter_level: needSafeCheck ? "block_medium_and_above" : "block_only_high",
            };
            body.predictUrl = `https://api.replicate.com/v1/models/google/imagen-3-fast/predictions`;
            break;
        }    

        case "imagen-4-ultra":
        case "imagen-4-fast":
        case "imagen-4": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                aspect_ratio: google_aspect_ratio,
                safety_filter_level: needSafeCheck ? "block_medium_and_above" : "block_only_high",
                output_format: "jpg"
            };
            body.predictUrl = `https://api.replicate.com/v1/models/google/${func}/predictions`;
            break;
        }  
            
        case "imagen-3": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                aspect_ratio: google_aspect_ratio,
                safety_filter_level: needSafeCheck ? "block_medium_and_above" : "block_only_high",
            };
            body.predictUrl = `https://api.replicate.com/v1/models/google/imagen-3/predictions`;
            break;
        }       

                
            
        case "realistic":
            // 老模型：cloneofsimo/realistic_vision_v1.3
            // 20230506: mcai/edge-of-realism-v2.0
            // 候选： SDAPI edge-of-realism
            // 20230527: SDAPI realistic-vision-v13
            // 20230530: speed issue. roll back to mcai/edge-of-realism-v2.0
            // 20230913：lucataco / realvisxl-v1.0 b4cbb3181d03f013ad2b92de9d160373fa820dee177a1e63dd0ae44f592c3833
            // 20240402: lucataco/ realvisxl2-lcm 479633443fc6588e1e8ae764b79cdb3702d0c196e0cb2de6db39ce577383be77,
            // 20240520：adirik / realvisxl-v4.0 85a58cc71587cc27539b7c83eb1ce4aea02feedfb9a9fae0598cebc110a3d695
            body.version = "85a58cc71587cc27539b7c83eb1ce4aea02feedfb9a9fae0598cebc110a3d695";
            body.input = {
                num_inference_steps: 25,
                guidance_scale: 2,
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                width: imgWidth,
                height: imgHeight, 
                refine: "expert_ensemble_refiner",
                negative_prompt: negativePromptTemplate,
                disable_safety_checker: !needSafeCheck,
            }; 
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "sdxl-lighting":
            // 240313：bytedance/sdxl-lightning-4step:727e49a643e999d602a896c774a0658ffefea21465756a6ce24b7ea4165eba6a
            // 240709: bytedance/sdxl-lightning-4step:5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f
            body.version = "5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                // guidance_scale: 8,
                disable_safety_checker: !needSafeCheck
            };
            break;

        case "LCM":
            //   "fofr/latent-consistency-model:a83d4056c205f4f62ae2d19f73b04881db59ce8b81154d314dd34ab7babaa0f1",
            // 20240519：fofr/latent-consistency-model:683d19dc312f7a9f0428b04429a9ccefd28dbf7785fef083ad5cf991b65f406f            
            body.version = "a83d4056c205f4f62ae2d19f73b04881db59ce8b81154d314dd34ab7babaa0f1";
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                width: imgWidth,
                height: imgHeight,            
                negative_prompt: negativePromptTemplate,
                num_inference_steps: 6,
                disable_safety_checker: !needSafeCheck
            };      
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "dreamshaper":
            // cjwbw/dreamshaper 内存经常泄露，已经不适合用了
            // 20230520: 改成 mcai/dreamshaper-v5
            // 20230527 替换成SDAPI dream-shaper-8797
            // aiservice = "SDAPI";
            // predicturl = "https://stablediffusionapi.com/api/v3/dreambooth";
            // 20231130 bertagknowles/lcm-dreamshaper8:fc367d0b29168ee2ad6eb234251e44eaab51b2ca592195b248ac82265c303158
            // 20231130   "asiryan/dreamshaper_v8:67a08099114e6499824844bd80af802d1c8ab1c65cd313683e3971774217456b",
            // 20240402   "lucataco/dreamshaper-xl-turbo:0a1710e0187b01a255302738ca0158ff02a22f4638679533e111082f9dd1b615",
            // 0240520    "mcai / dreamshaper-v6-img2img: c7959eb3a86c09b449dacc11ce8bba295fda466fc6935ab8709e35f4f48c980c
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                disable_safety_checker: !needSafeCheck
            };      
            if(imageUrl){
                body.version = "c7959eb3a86c09b449dacc11ce8bba295fda466fc6935ab8709e35f4f48c980c";
                body.input.image = imageUrl;
            }else{
                body.version = "0a1710e0187b01a255302738ca0158ff02a22f4638679533e111082f9dd1b615";
            }
            break;            

        case "sdxl":
            // sd2.1 db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf
            // 20230804 sdxl 2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2
            // 20240519 stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b
            body.version = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) + promptQualityControl,
                refine: "expert_ensemble_refiner",                
                negative_prompt: negativePromptTemplate,
                disable_safety_checker: !needSafeCheck
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "sd3": {
            //   "stability-ai/stable-diffusion-3:72c05df2daf615fb5cc07c28b662a2a58feb6a4d0a652e67e5a9959d914a9ed2",
            let aspect_ratio = "9:16";
            switch(drawRatio){ 
                case "916":  aspect_ratio = "9:16"; break;
                case "169":  aspect_ratio = "9:16"; break;
                case "11":  aspect_ratio = "1:1"; break;                    
            }
            body.version = "72c05df2daf615fb5cc07c28b662a2a58feb6a4d0a652e67e5a9959d914a9ed2";
            body.input = {
                cfg: 4.5,
                prompt: await translate(realText),
                negative_prompt: negativePromptTemplate,
                aspect_ratio,
                output_quality: 100,
                output_format: "jpg",
            }
            break;
        }            

        case "sd3.5": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                output_format: "jpg",
                output_quality: 100,
                aspect_ratio: flux_aspect_ratio,
            };
            body.predictUrl = `https://api.replicate.com/v1/models/stability-ai/stable-diffusion-3.5-large/predictions`;
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
            if(imageUrl){body.input.image = imageUrl}            
            break;
        }    

        case "sd3.5-turbo": {
            body.input = {
                prompt: await translate(realText? realText : inputText),
                output_format: "jpg",
                output_quality: 100,
                aspect_ratio: flux_aspect_ratio,
            };
            body.predictUrl = `https://api.replicate.com/v1/models/stability-ai/stable-diffusion-3.5-large-turbo/predictions`;
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
            if(imageUrl){body.input.image = imageUrl}            
            break;
        }  
           
        case "proteus":
            // 240519 lucataco/proteus-v0.2:06775cd262843edbde5abab958abdbb65a0a6b58ca301c9fd78fa55c775fc019
            // 250315 datacte/proteus-v0.5:f72450d49fa7cb6ebfc940755b8935b5bc309f1a9d10119d5e66ca7cb228c4ca
            body.version = "f72450d49fa7cb6ebfc940755b8935b5bc309f1a9d10119d5e66ca7cb228c4ca";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                disable_safety_checker: !needSafeCheck
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;   

        case "epicrealism-v7":
            // charlesmccarthy/epicrealism-v7:7199497dd63b88bfd1b219bd8a1779d154d63b962f3467c947c10a68be66cf54
            body.version = "7199497dd63b88bfd1b219bd8a1779d154d63b962f3467c947c10a68be66cf54";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                disable_safety_checker: !needSafeCheck
            };
            break;   
            
        case "anything_V4":
            // V4引擎很容易NSFW先不用了
            // 20230517： cjwbw/anything-v3-better-vae 这个版本很容易内存溢出
            // 最后换回V4，等待将来替换
            // 2023-05-27 替换到SDAPI anything-v4
            // 231009: replicate: cjwbw / anything-v4.0
            body.version = "42a996d39a96aedc57b2e0aa8105dea39c9c89d9d266caf6bb4327a1c191b061";
            body.input = {
                width: drawRatio=="169" ? 1024 : 768,
                height: drawRatio=="916" ? 1024 : 768,              
                prompt: await translate(realText) ,
                negative_prompt: "photo, 3d, realistic, disfigured, kitsch, ugly, oversaturated, greain, low-res, deformed, blurry, bad anatomy, poorly drawn face, mutation, mutated, extra limb, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, blur, out of focus, long neck, long body, disgusting, poorly drawn, childish, mutilated, mangled, old, surreal, calligraphy, sign, writing, watermark, text, body out of frame, extra legs, extra arms, extra feet, out of frame, poorly drawn feet, cross-eye"
            };
            break;
            
        case "cartoon":
            // 20230527: change to Anything V3
            // 20231009: replicate: doriandarko / sdxl-hiroshinagai 563a66acc0b39e5308e8372bed42504731b7fec3bc21f2fcbea413398690f3ec
            // 20240408：asiryan / blue-pencil-xl-v2  06db33e3cd56700e2b0de541e65e2fc377604bebc97eb87b40e1d190fafa7ef4
            body.version = "06db33e3cd56700e2b0de541e65e2fc377604bebc97eb87b40e1d190fafa7ef4";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: "anime, illustration, sketch, " + await translate(realText) ,
                negative_prompt: "photo, 3d, realistic, disfigured, kitsch, ugly, oversaturated, greain, low-res, deformed, blurry, bad anatomy, poorly drawn face, mutation, mutated, extra limb, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, blur, out of focus, long neck, long body, disgusting, poorly drawn, childish, mutilated, mangled, old, surreal, calligraphy, sign, writing, watermark, text, body out of frame, extra legs, extra arms, extra feet, out of frame, poorly drawn feet, cross-eye"
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;            

        case "poi":
            // 2023-09-16 rileyhacks007 / sdxl-national-park-posters
            // 20240408: asiryan/realistic-vision-v6.0-b1:79840b7a2de6e3c5b4a5623cda51186fc532a8e64055cd7683b125eaeda3df53
            body.version = "79840b7a2de6e3c5b4a5623cda51186fc532a8e64055cd7683b125eaeda3df53";
            body.input = {
                image: imageUrl,
                width: imgWidth,
                height: imgHeight,              
                prompt: await translate(realText) ,
                negative_prompt: "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime), text, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck"
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;            

        case "ghiblify":{
            // fal-ai/omni-zero
            aiservice = "FAL";
            body.version = "fal-ai/ghiblify";            
            body.input = {
                image_url: params.imageURL,
                enable_safety_checker: needSafeCheck
            }
            break;
        }
            
        case "ghibli":
            // sd2.1 db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf
            // 20230909 grabielairu / ghibli 4b82bb7dbb3b153882a0c34d7f2cbc4f7012ea7eaddb4f65c257a3403c9b3253
            body.version = "4b82bb7dbb3b153882a0c34d7f2cbc4f7012ea7eaddb4f65c257a3403c9b3253";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: "Illustration in TOK style, " + await translate(realText) ,
                negative_prompt: ""
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;            

        case "barbie":
            body.version = "657c074cdd0e0098e39dae981194c4e852ad5bc88c7fbbeb0682afae714a6b0e";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: "In the style of TOK, " + await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "emoji":
            // sd2.1 db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf
            // 20230909 fofr / sdxl-emoji dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e
            body.version = "dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: "A TOK emoji of " + await translate(realText),
                negative_prompt: ""
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "appIcon":
            // nandycc/sdxl-app-icons      
            body.version = "5839ce85291601c6af252443a642a1cbd12eea8c83e41f27946b9212ff845dbf";
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                prompt: "an icon, " + await translate(realText),
                negative_prompt: "",
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;

        case "revAnimated":
            // pagebrain / rev-animated-v1-2-2      
            body.version = "fbcec918410a79b17859cbdb78204bc560578f844bbfe5ae6f7dbeb23dc44489";
            body.input = {
                width: imgWidthSmall,
                height: imgHeightSmall,              
                prompt: await translate(realText) + ", (Artgerm inspired:1.2), (pixiv contest winner:1.1), (octopus goddess:1.3), (Berserk art style:1.2), close-up portrait, goddess skull, (Senna from League of Legends:1.1), (Tatsumaki with green curly hair:1.2), card game illustration, thick brush, HD anime wallpaper, (Akali from League of Legends:1.1), 8k resolution",
                negative_prompt: "realisticvision-negative-embedding, EasyNegative, negative_hand-neg, ng_deepnegative_v1_75t, FastNegativeV"  ,
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;
            
        /* 画风 */
        case "laion":
            // laion模型 65a15f6e3c538ee4adf5142411455308926714f7d3f5c940d9f7bc519e0e5c1a
            // 20230527: change to SDAPI deliberate-v2
            // 20230528: roll back to laion 
            // 20240422: ai-forever/kandinsky-2.2:ad9d7879fbffa2874e1d909d1d37d9bc682889cc65b31f7bb00d2362619f194a
            body.version = "ad9d7879fbffa2874e1d909d1d37d9bc682889cc65b31f7bb00d2362619f194a";
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                guidance_scale: 4,
                width: imgWidthSmall,
                height: imgHeightSmall,  
                output_format: "jpeg"
            };     
            break;

        case "wanx2.1-t2i-plus":
        case "wanx2.1-t2i-turbo":
        case "wanx2.0-t2i-turbo":
        case "wanx-v1":
            aiservice = "ALI";
            body.input = {
                prompt: realText + promptQualityControl,
                negative_prompt: negativePromptTemplate,
                size: wanxsize,
                params: {
                    size : wanxsize,
                    seed: parseInt(seed) || 0
                }
            };
            if(imageUrl){body.input.ref_img = imageUrl}
            break;

            
        case "text2img":
        case "text2img_sd2.1":
            body.version = "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";
            body.input = {
                image_dimensions: "768x768",
                prompt: await translate(realText) + promptQualityControl,
                negative_prompt: negativePromptTemplate,
            };
            break;

        case "sana-sprint-1.6b":
            // nvidia/sana-sprint-1.6b:6ed1ce77cdc8db65550e76d5ab82556d0cb31ac8ab3c4947b168a0bda7b962e4
            body.version = "6ed1ce77cdc8db65550e76d5ab82556d0cb31ac8ab3c4947b168a0bda7b962e4";
            body.input = {
                width: imgWidth,
                height: imgHeight,    
                prompt: await translate(realText) + promptQualityControl,
                output_format: "jpg",
                output_quality: 90
            };
            break;
            
        case "sana":
            // nvidia/sana:c6b5d2b7459910fec94432e9e1203c3cdce92d6db20f714f1355747990b52fa6
            body.version = "c6b5d2b7459910fec94432e9e1203c3cdce92d6db20f714f1355747990b52fa6";
            body.input = {
                width: imgWidth,
                height: imgHeight,    
                prompt: await translate(realText) + promptQualityControl,
                output_format: "jpg",
                output_quality: 90
            };
            break;

        case "van-gogh":
        case "Monet":
        case "Leonardo-da-Vinci":
            // sdxl with prompt   
            // 20230804 sdxl 2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2
            // 20240519 stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b
            /*
            body.version = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
            body.input = {
               width: imgWidth,
               height: imgHeight,              
                refine: "expert_ensemble_refiner",                
                prompt: "an oil painting of " + await translate(realText) + ", in the style of " + func, 
                negative_prompt: "",
                disable_safety_checker: !needSafeCheck
            };
            if(imageUrl){body.input.image = imageUrl}            
            break;   
            */
            realText = `an oil painting in the style of ${func} , ${realText}`;
            func = "hidream-i1-full";            
        case "hidream-l1-fast":
           // prunaai/hidream-l1-fast:17c237d753218fed0ed477cb553902b6b75735f48c128537ab829096ef3d3645
            body.version = "17c237d753218fed0ed477cb553902b6b75735f48c128537ab829096ef3d3645";
            body.input = {
                resolution: hidreamRatio,
                prompt: await translate(realText) + promptQualityControl,
                output_format: "jpg",
                output_quality: 90
            };
            break;

        case "hidream-i1-dev":
        case "hidream-i1-full":
            aiservice = "WAVE";
            body.version = func;
            body.input = {
                size: aliSize,
                prompt: await translate(realText) + promptQualityControl,
                enable_base64_output: false,
                enable_safety_checker: needSafeCheck
            };
            break;

            
        case "flux.1-juiced":
            // prunaai/flux.1-juiced:19335b8316dee4169b78fd08cdb91db5678ae2c56a96d60d000dbb46e555c1ea
            body.version = "19335b8316dee4169b78fd08cdb91db5678ae2c56a96d60d000dbb46e555c1ea";
            body.input = {
                aspect_ratio: aspect_ratio,
                prompt: await translate(realText) + promptQualityControl,
                output_format: "jpg",
                output_quality: 90
            };
            break;

            //luma模型
        case "luma-photon":
            body.predictUrl = "https://api.replicate.com/v1/models/luma/photon/predictions";
            body.input = {
                prompt: await translate(realText || inputText || params?.prompt) + promptQualityControl,
                aspect_ratio: aspect_ratio,
            };
            if(imageUrl||params?.base_image){ 
                body.input.image_reference_url = imageUrl||params?.base_image; 
            }
            if(imageUrl||params?.style_image){ 
                body.input.style_reference_url = imageUrl||params?.style_image; 
            }
            if(imageUrl||params?.identity_image){ 
                body.input.character_reference_url = imageUrl||params?.identity_image; 
            }
            break;
            
        case "luma-photon-flash":
            body.predictUrl = "https://api.replicate.com/v1/models/luma/photon-flash/predictions";
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                aspect_ratio: aspect_ratio,
            };
            if(imageUrl||params?.base_image){ 
                body.input.image_reference_url = imageUrl||params?.base_image; 
            }
            if(imageUrl||params?.style_image){ 
                body.input.style_reference_url = imageUrl||params?.style_image; 
            }
            if(imageUrl||params?.identity_image){ 
                body.input.character_reference_url = imageUrl||params?.identity_image; 
            }
            break;
            
    // 字节的模型
        case "byte-video_avatar_imitator":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                image_url: params.faceImage,
                driving_video_info: {
                    store_type: 0,
                    video_url: params.drivingVideo,
                }
            }
            resultType = "VIDEO";
            break;

        case "doubao-seedance-1-0-lite":
            aiservice = "BYTE";
            body.version = "doubao-seedance-1-0-lite-t2v";
            body.input = {
                content: [
                    {
                        type: "text",
                        text: ` ${params.prompt}  --rs 720p --rt ${params.imageURL ? "adaptive" : params.ratio} --dur ${params.duration} --fps 24 `
                    },
                ]
            }
            if(params.imageURL){
                body.version = "doubao-seedance-1-0-lite-i2v";
                body.input.content.push({
                    type: "image_url",
                    image_url:{
                        url: params.imageURL
                    },
                    "role": "first_frame"                    
                });
            }
            if(params.endImageURL){
                body.input.content.push({
                    type: "image_url",
                    image_url:{
                        url: params.endImageURL
                    },
                    "role": "last_frame"
                });                
            }            
            resultType = "VIDEO";
            break;      
            
        case "doubao-seedance-pro":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                content: [
                    {
                        type: "text",
                        text: ` ${params.prompt}  --rs 1080p --rt ${params.imageURL ? "adaptive" : params.ratio} --dur ${params.duration} --fps 24 `
                    },
                ]
            }
            if(params.imageURL){
                body.input.content.push({
                    type: "image_url",
                    image_url:{
                        url: params.imageURL
                    }
                });
            }
            resultType = "VIDEO";
            break;
            
        case "jimeng_vgfm_l20":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                prompt: params.prompt,
                aspect_ratio: params.ratio,
            }
            if(params.imageURL){
                body.input.image_urls = [params.imageURL];
                body.version = "jimeng_vgfm_i2v_l20";
            }else{
                body.version = "jimeng_vgfm_t2v_l20";
            }
            resultType = "VIDEO";
            break;

            
        case "jimeng_general_2.1":
        case "byte-general-3.0":
        case "byte-general-2.1":
        case "byte-anime_v1.3.1":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                prompt: realText,
                width: (func=="byte-general-3.0" ? 2 : 1) * imgWidth,
                height: (func=="byte-general-3.0" ? 2 : 1) * imgHeight,
            }
            if(imageUrl){
                body.input.image_urls = [imageUrl];
            }
            break;

        case "byte-video_trans":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                url: params.videoURL,
                src_lan: params.sourceLang,
                tgt_lan: params.targetLang,     
                open_scenedet: true
            }
            resultType = "VIDEO";
            break;

            
        case "hasdx":
            body.version = "6d6e9b8c70d1447e946362d5c9060e42cb0f3e1ac122bdf725a0f3726cf67774";
            body.input = {
                prompt: await translate(realText? realText : inputText), 
                //                 " photo realistic, 20 megapixel, canon eos r3, detailed skin, detailed, detailed face, (photo realistic, realistic, dramatic, sharp focus, 8k)",
                negative_prompt: negativePromptTemplate,
            };     
            break;
/*
        case "designer":
            aiservice = "SDAPI";
            predicturl = "https://stablediffusionapi.com/api/v3/text2img";
            authstr = "";
            body.key = process.env.SD_API_KEY;
            body.width = imgWidthSmall.toString();
            body.height = imgHeightSmall.toString();              
            body.guidance_scale = 12;
            body.prompt = await translate(realText) + promptQualityControl;
            body.negative_prompt = negativePromptTemplate;
            body.samples = "1";
            body.num_inference_steps = "50";
            body.safety_checker = process.env.SAFETY_CHECKER;
            break;
            
        case "MidJourney-V4":
            // 20230516: prompthero/openjourney-v4 启动异常
            // 20230517: prompthero/openjourney
            // 20230527: SDAPI: midjourney
            // 20230528: SDAPI: midjourney-v4
            aiservice = "SDAPI";
            predicturl = "https://stablediffusionapi.com/api/v3/dreambooth";
            authstr = "";
            body.key = process.env.SD_API_KEY;
            body.model_id = "midjourney-v4";
            body.width = imgWidthSmall.toString();
            body.height = imgHeightSmall.toString();
            body.guidance_scale = 8;
            body.prompt = await translate(realText) + promptQualityControl;
            body.negative_prompt = negativePromptTemplate;
            body.samples = "1";
            body.num_inference_steps = "30";
            body.safety_checker = process.env.SAFETY_CHECKER;
            break;            
        */
            
        case "playground-v2":
            // 20231206："playgroundai/playground-v2-1024px-aesthetic:3519ebf3088c883951d9aa724391989bc5cd6df556d0907e1f5ef9a2707d8dbd"
            body.version = "3519ebf3088c883951d9aa724391989bc5cd6df556d0907e1f5ef9a2707d8dbd";
            body.input = {
                num_inference_steps: 50,
                guidance_scale: 8,
                scheduler: "DDIM", 
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                width: imgWidth,
                height: imgHeight,            
                negative_prompt: negativePromptTemplate,
                apply_watermark: false,
                disable_safety_checker: !needSafeCheck
            };         
            break;

        case "logo":
            if(room == "DALL-E"){
                body.prompt = "design a logo, " + theme + ", " + inputText + ", best quality";
                body.model = "dall-e-3";
                body.n = 1;
                body.size = "1024x1024";
                predicturl = process.env.OPENAI_API_PROXY + "?CMD=text2img";
                authstr = "Bearer " + process.env.OPENAI_API_KEY;
                aiservice = "DALLE";
            }else{
                body.version = "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";
                body.input = {
                    prompt: "design a logo, " + theme + ", " +  await translate(inputText) + ", best quality",
                    negative_prompt: "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face.",
                };
            }
            break;            

        case "kolors":
            body.input = {
                width: imgWidth,
                height: imgHeight,              
                // prompt: await translate(realText) + promptQualityControl,
                prompt: realText + promptQualityControl, // 该模型支持中文，不需要翻译
                negative_prompt: negativePromptTemplate,
                output_format: "jpg",
            };
            if(imageUrl){
                body.input.image = imageUrl;
                // asiryan/kolors:6f54f70da4ccaeb79084738ad549b7b222dd24229948083d49af110791beb0fe
                body.version = "6f54f70da4ccaeb79084738ad549b7b222dd24229948083d49af110791beb0fe";
            }else{
                // fofr/kolors:c5bd438224f440e81ac46e74cfa8bda2446dff397788c17385f31359ad2b7c7d
                body.version = "c5bd438224f440e81ac46e74cfa8bda2446dff397788c17385f31359ad2b7c7d";
            }
            break;


        case "gpt-image-1-low":
        case "gpt-image-1-medium":            
        case "gpt-image-1-high":                        
        case "gpt-image-1": {
            aiservice = "SEGMIND";
            let quality = "auto";
            const prefix = "gpt-image-1-";
            quality = func.startsWith(prefix) ? func.slice(prefix.length) : '';            
            
            body.version = "gpt-image-1";
            body.input = {
                prompt : realText || inputText,
                size: gptSize,
                quality,
                background: "opaque",
                output_compression: 100,
                output_format: "jpeg",
                moderation: "low",
                base64: true
            };
            break;
        }

        case "gpt-image-1-edit-low":
        case "gpt-image-1-edit-medium":            
        case "gpt-image-1-edit-high":              
        case "gpt-image-1-edit":
            aiservice = "SEGMIND";
            let quality = "auto";
            const prefix = "gpt-image-1-edit-";
            quality = func.startsWith(prefix) ? func.slice(prefix.length) : '';    
            
            body.version = "gpt-image-1-edit";
            body.input = {
                prompt : params.prompt,
                image_urls: params.imageURLs,
                quality,
                background: "opaque",
                output_compression: 100,
                output_format: "jpeg",       
                moderation: "low",
                mask: params.mask
            };
            break;            

        case "phoenix-1.0":
            body.predictUrl = "https://api.replicate.com/v1/models/leonardoai/phoenix-1.0/predictions";
            body.input = {
                prompt: (await translate(realText || inputText)).substring(0, 1450),
                style: "cinematic",
                aspect_ratio,
            }
            break;
            
        // -----end create prompt ------

        case "bagel-editing":
            // bytedance/bagel:7dd8def79e503990740db4704fa81af995d440fefe714958531d7044d2757c9c
            body.version = "7dd8def79e503990740db4704fa81af995d440fefe714958531d7044d2757c9c";
            body.input = {
                prompt : params.prompt,
                image : params.image,
                task: "image-editing",
                output_format: "jpg",
            }
            break;

        case "maskClothReverse":
        case "maskCloth":
            // ahmdyassr/mask-clothing:1c60fd50bf0e5fb2ccbd93403cf163d5586ab8939139167ac82d29ebb047e84f
            body.version = "1c60fd50bf0e5fb2ccbd93403cf163d5586ab8939139167ac82d29ebb047e84f";
            body.input = params;
            break;
       
        case "seg-beyond":
            aiservice = "SEGMIND";
            body.version = "seg-beyond";
            body.input = {
                styles: "V2,Enhance,Sharp",
                input_image : params.image,
                prompt : await translate(params.prompt),
                negative_prompt : "(Photo frame, blank space around), " +  negativePromptTemplate,
                left: params.outpaint_left,
                right: params.outpaint_right,
                top: params.outpaint_up,
                bottom: params.outpaint_down,
                "base64": true
            };
            break;

        case "ideogram-v3-reframe":
            aiservice = "FAL";
            body.version = "fal-ai/ideogram/v3/reframe";                    
            body.input = {
                rendering_speed: params.quality || "TURBO",
                image_url: params.image,
                image_urls: [params.image],
                image_size: {
                    width:params.scaledWidth,
                    height:params.scaledHeight
                }
            }
            break;

        case "byte-outpainting":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                custom_prompt: realText,
                image_urls: [params.image],
                left: params.left_scale,
                right: params.right_scale,
                top: params.top_scale,
                bottom: params.bottom_scale,                
            }
            break;      
            
        case "focus":
        case "outpaint":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_OUTPAINT;
            }
            switch(serviceLine){
                case "REP":{       
                    body.version = "a542ccf352995f3c41f0bcfaef641daa3058bf2b00e08e04feb0295334ab9804";
                    params.prompt = await translate(params.prompt);
                    params.negative_prompt = "(Photo frame, blank space around), " +  negativePromptTemplate;
                    body.input = params;
                    break;
                }
                case "SEGMIND":
                default: {
                    aiservice = "SEGMIND";
                    body.version = "focus-outpaint";
                    body.input = {
                        input_image : params.image,
                        prompt : await translate(params.prompt),
                        negative_prompt : "(Photo frame, blank space around), " +  negativePromptTemplate,
                        outpaint_selections : params.outpaint_selections,
                        "base64": true
                    };
                    break;
                }
            }
            break;

        case "kolors-virtual-try-on":
           if(!serviceLine){
                serviceLine = process.env.SERVICE_VTON;
            }            
            switch(serviceLine){
                case "FAL":{   
                    aiservice = "FAL";
                    body.version = "fal-ai/kling/v1-5/kolors-virtual-try-on";                    
                    body.input = params;
                    break;            
                }
                case "PI":
                default: {
                    aiservice = "PI";
                    body.version = "kolors-virtual-try-on";                    
                    body.input = {
                        model_input: params.human_image_url,
                        dress_input: params.garment_image_url,
                        batch_size: 1
                    }
                    break;            
                }
            }
            break;
                    
        case "flux-kontext-pro":
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                input_image: params.image || params.input_image,
                safety_tolerance: (params.image || params.input_image) ? 2 : safety_tolerance,
            }
            break;
        case "flux-kontext-max":
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-max/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                input_image: params.image || params.input_image,
                safety_tolerance: (params.image || params.input_image) ? 2 : safety_tolerance,
            }
            break;
        case "multi-image-kontext-pro":
            body.predictUrl = "https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-pro/predictions";
            body.input = {
                prompt: await translate(params.prompt),
                input_image_1: params.modelImage,
                input_image_2: params.productImage,
                aspect_ratio: aspect_ratio,
                output_format: "jpg",
                safety_tolerance: 2,
            }
            break;

            
        case "gemini-flash-edit":
            aiservice = "FAL";
            body.version = "fal-ai/gemini-flash-edit";                    
            body.input = {
                prompt: await translate(params.prompt),
                image_url: params.image,
            }
            break;

        case "byte-edit_v2.0":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                prompt: params.prompt,
                image_urls: [params.image]
            }
            break;            
            
        case "byte-inpainting-edit":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                custom_prompt: params.prompt,
                image_urls: [params.image, params.mask]
            }
            break;            
        case "inpaint":
            // mixinmax1990 / realisitic-vision-v3-inpainting: 555a66628ea19a3b820d28878a0b0bfad222a814a7f12c79a83dbdbf57873213
            body.version = "555a66628ea19a3b820d28878a0b0bfad222a814a7f12c79a83dbdbf57873213";
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            body.input = params;
            break;
        case "sd-inpaint":
            // stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3
            // zf-kbot/sd-inpaint:af731e421965ac3fd28422912632eafb881079fec5394bd0ffdeedb46590f725
            body.version = "af731e421965ac3fd28422912632eafb881079fec5394bd0ffdeedb46590f725";
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            params.max_size = 0;
            body.input = params;
            break;
        case "sdxl-inpaint":
            // lucataco/sdxl-inpainting:a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7
            // 240724 ikun-ai/inpainting-xl:8f812406b5175472d941d5a228d0a0a210b7ce450aa442bc348eab36b44b98a2
            body.version = "a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7";
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            body.input = params;
            break;

        case "flux-dev-inpainting-controlnet":
            // zsxkib/flux-dev-inpainting-controlnet:f9cb02cfd6b131af7ff9166b4bac5fdd2ed68bc282d2c049b95a23cea485e40d
            body.version = "f9cb02cfd6b131af7ff9166b4bac5fdd2ed68bc282d2c049b95a23cea485e40d";
            body.input = {
                prompt: await translate(params.prompt),
                negative_prompt: negativePromptTemplate,
                image: params.image,
                mask: params.mask,
                controlnet_conditioning_scale: params.controlStrengh,
                num_outputs: 1,
                output_format: "jpg",
                output_quality: 100
            }
            break;
            
        case "flux-controlnet-inpaint-lora":
            // fermatresearch/flux-controlnet-inpaint:46ae77d1d148dca1bd61c1215e99ee692c4cf01289a2bba681b14a58c04bda8f
            const lora = params?.loraCode ? await prisma.model.findUnique({where: {code: params?.loraCode}}) : undefined;            
            body.version = "46ae77d1d148dca1bd61c1215e99ee692c4cf01289a2bba681b14a58c04bda8f";
            body.input = {
                prompt: "TOK. " + (await translate(params.prompt || realText) || "a portrait photo"),
                image: params.image,
                control_image: params.image,
                mask: params.mask,
                lora_weights: (lora?.weights && lora.weights.indexOf("replicate.delivery")>=0) ? lora?.weights : lora?.safetensors,
                conditioning_scale: params.controlStrengh || 0.4,
                strength: params.imageStrength || 0.85,
                lora_scale: params.loraScale || 0.8,
            }
            break;
            
        case "inpaint_lora_facebody":{
            // batouresearch / sdxl-controlnet-lora-inpaint 35c927ab69062f7cc3fdd0ad4367832b08fdd98c60e5907651a6e03f4bb5d927 
             // fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16            
            // fofr / realvisxl-v3-multi-controlnet-lora 90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade
            const lora = params?.loraCode ? await prisma.model.findUnique({
                where: {
                    code: params?.loraCode,
                },
                select: {
                    url: true,
                    params: true,
                    trainSrv: true
                },
            }) : undefined;
            if(lora?.trainSrv == "ostris / flux-dev-lora-trainer"){
                body.version = lora!.url!.split(":").pop(); // runhuasun/m24030506:ab3c3c3c0d032d1fcf1019af4d388d51625e8086b93b9ab7f98ad0205f117319
                body.input = {
                    model: "dev",
                    prompt: "a photo of TOK. " + await translate(params.prompt || realText),
                    image: params.image,
                    mask: params.mask,
                    lora_scale: 1,
                    num_outputs: 1,
                    output_format: "jpg",
                    guidance_scale: 3.5,
                    output_quality: 90,
                    prompt_strength: 0.8,
                    extra_lora_scale: 1,
                    num_inference_steps: 28,
                    disable_safety_checker: !needSafeCheck,                    
                }
            }else{
                body.version = "90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade";                
                body.input = params;
                body.input.prompt = `a photo of TOK . ${await translate(params.prompt)}. ${promptQualityControl}`;
                body.input.negative_prompt = negativePromptTemplate;
                if(lora){
                    body.input.lora_weights = lora?.url;
                }
                body.input.disable_safety_checker = !!(!needSafeCheck);            
            }
        }
            break;   
            
        case "inpaint_lora_cloth":{
            // batouresearch / sdxl-controlnet-lora-inpaint 35c927ab69062f7cc3fdd0ad4367832b08fdd98c60e5907651a6e03f4bb5d927 
             // fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16            
            // fofr / realvisxl-v3-multi-controlnet-lora 90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade
            body.version = "90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade";
            body.input = params;
            body.input.disable_safety_checker = !!(!needSafeCheck);              
            if(params?.loraCode){
                const lora = await prisma.model.findUnique({
                    where: {
                        code: params?.loraCode,
                    },
                    select: {
                        url: true,
                        params: true,
                    },
                });
                if(lora){
                    if(lora.params){
                        const mp = JSON.parse(lora.params);
                        const aPrompt = await translate(mp?.aPrompt);
                        const nPrompt = `${mp?.nPrompt}, ${negativePromptTemplate}`;
                        const tokPrompt = "a photo of TOK, ";
                        body.input.prompt = `${tokPrompt} ${aPrompt}, ${promptQualityControl}`;
                        body.input.negative_prompt = nPrompt;
                    }else{
                        body.input.prompt = `a photo of TOK, ${promptQualityControl}`;
                    }
                    body.input.lora_weights = lora?.url;                    
                    break;
                }   
            }
            body.input.prompt = `${await translate(params.prompt)}, ${promptQualityControl}`;
            body.input.negative_prompt = negativePromptTemplate;
            break;            
        }            


        case "segfit-v1.1":
            aiservice = "SEGMIND";
            body.version = "segfit-v1.1";
            body.input = {
                outfit_image : params.clothImage,
                cloth_description: await translate(params.clothDesc),
                model_description: await translate(params.modelDesc),
                background_description: await translate(params.bgDesc),
                aspect_ratio: aspect_ratio,
                "image_format": "jpeg",                
                "base64": true
            };
            break;
            
        case "adInpaint":
            // logerzhu/ad-inpaint
            // 23-09-16 catacolabs / sdxl-ad-inpaint
            body.version = "9c0cb4c579c54432431d96c70924afcca18983de872e8a221777fb1416253359";
            body.input = {
                image: imageUrl,
                product_fill: theme,
                prompt: await translate(inputText),
                negative_prompt: negativePromptTemplate,
                img_size: adInpaintSize || "1024, 1024",
                condition_scale: 0.8,
                guidance_scale: 8,
                num_refine_steps: 20
            };       
            break;

            // 照片修复相关一组功能
        case "baidu-colourize":
            aiservice = "BAIDU";
            body.version = func;
            body.input = {
                image: params.input_image
            }
            break;
            
        case "byte-recolor":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                image_urls: [params.input_image],
                if_color: 2, // 0：不上色(不走色彩增强)；1：强制上色；2：自动色彩判断，黑白走上色逻辑，彩色走色彩增强。默认为 1
            }
            break;
            
        case "ddcolor":
            // arielreplicate/deoldify_image:0da600fab0c45a66211339f1c16b71345d22f26ef5fea3dca1bb90bb5711e950
            // 241108：pvitoria/chromagan:94a9ed3bf283fcd3950a04a5cc2fba3588baec1a0843921ef8028934406827e6
            // cjwbw/bigcolor : 9451bfbf652b21a9bccc741e5c7046540faa5586cfa3aa45abc7dbb46151a4f7
            // piddnad/ddcolor:ca494ba129e44e45f661d6ece83c4c98a9a7c774309beca01429b58fce8aa695
            body.version = "ca494ba129e44e45f661d6ece83c4c98a9a7c774309beca01429b58fce8aa695";
            body.input = {
                image: params.input_image
            }
            break;
        case "bigcolor":
            // cjwbw/bigcolor : 9451bfbf652b21a9bccc741e5c7046540faa5586cfa3aa45abc7dbb46151a4f7
            body.version = "9451bfbf652b21a9bccc741e5c7046540faa5586cfa3aa45abc7dbb46151a4f7";
            body.input = {
                image: params.input_image
            }
            break;
        case "deoldify_image":
            // arielreplicate/deoldify_image:0da600fab0c45a66211339f1c16b71345d22f26ef5fea3dca1bb90bb5711e950
            body.version = "0da600fab0c45a66211339f1c16b71345d22f26ef5fea3dca1bb90bb5711e950";
            body.input = {
                input_image: params.input_image,
                model_name: params.model_name,
            }
            break;
            
            
        case "simImage":
            // mcai/deliberate-v2-img2img c4205561f2a62095ae86c2fb9fd23115a4d5f1b7018a3ff8fb064058c02fb043
            // mcai/edge-of-realism-v2.0-img2img 0f7ba6926ca1e836e6dc64cf7e371402c9a4915851234378319f9b9b0f968fda
            // black-forest-labs/flux-dev
            body.input = {
                prompt: await translate(realText? realText : inputText) + promptQualityControl,
                image: params.imageURL,
                prompt_strength: params.promptStrength,
                output_format: "jpg",
                output_quality: 100,
                aspect_ratio: flux_aspect_ratio,
                disable_safety_checker: !needSafeCheck,
            };
            body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions`;
            waitForUploadGenerated = true; // 因为输出的图片无法在国内访问，所以要等待上传到文件服务器
            break;

        case "faceswap_with_watermark":
            // omniedgeio/face-swap:c2d783366e8d32e6e82c40682fab6b4c23b9c6eff2692c0cf7585fc16c238cfe       
            body.version = "c2d783366e8d32e6e82c40682fab6b4c23b9c6eff2692c0cf7585fc16c238cfe";
            body.input = {
                swap_image: params.swap_image,
                target_image: params.target_image                    
            };
            break;
            
/*        case "faceswap":
            // "lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d"
            // 20231127 yan-ops/face_swap:a7d6a0118f021279b8966473f302b1d982fd3920426ebd334e8f64d5caf84418
            // omniedgeio/face-swap:c2d783366e8d32e6e82c40682fab6b4c23b9c6eff2692c0cf7585fc16c238cfe    
            // 20240801 xiankgx/face-swap:cff87316e31787df12002c9e20a78a017a36cb31fde9862d8dedd15ab29b7288
            body.version = "cff87316e31787df12002c9e20a78a017a36cb31fde9862d8dedd15ab29b7288";
            body.input = {
                source_image: params.swap_image,
                target_image: params.target_image                    
            };
            break;
*/
        //////////////////////////////////////////////////////////////////////////////////////////////    
        // 视频相关模型    
        case "emo-v1":
            aiservice = "ALI";
            body.version = "emo-v1";
            body.input = {
                image_url: params.source_image,
                audio_url: params.driven_audio,
                face_bbox: params.face_bbox,
                ext_bbox: params.ext_bbox,
                params: {
                    style_level: params.style_level || "normal",
                }
            };
            resultType = "VIDEO";
            break;

        case "liveportrait":
            aiservice = "ALI";
            body.version = "liveportrait";
            body.input = {
                image_url: params.source_image,
                audio_url: params.driven_audio,
                params: {
                    template_id: params.style_level || "normal",
                }
            };
            resultType = "VIDEO";
            break;
            
        case "mmaudio":
            // zsxkib/mmaudio:266543bffbeba44ea3ffc114055b021ebb42e666960cbad0ff830bde26357c91
            body.version = "266543bffbeba44ea3ffc114055b021ebb42e666960cbad0ff830bde26357c91";
            resultType = "VIDEO";
            body.input = params;
            body.input.prompt = await translate(body.input.prompt);
            body.input.negative_prompt = " Speech, Noise, Sing. "
            break;
            
        case "sadTalker":
            // cjwbw/sadtalker:a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3
            body.version = "a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3";
            body.input = params;
            resultType = "VIDEO";            
            break;

        case "sonic":
            // zsxkib/sonic:a2aad29ea95f19747a5ea22ab14fc6594654506e5815f7f5ba4293e888d3e20f
            body.version = "a2aad29ea95f19747a5ea22ab14fc6594654506e5815f7f5ba4293e888d3e20f";
            body.input = {
                image: params.source_image,
                audio: params.driven_audio,
                dynamic_scale: params.dynamic_scale,
                min_resolution: 1024,
                keep_resolution: true
            };
            resultType = "VIDEO";            
            break;
            
        case "memo":
            // zsxkib/memo:b9950fa22507ee3647dceaa3dd8e133be75c7f822bb1b84b7bb92aa2c1bc135b
            body.version = "b9950fa22507ee3647dceaa3dd8e133be75c7f822bb1b84b7bb92aa2c1bc135b";
            body.input = {
                image: params.source_image,
                audio: params.driven_audio,
                resolution: 1024,
                max_audio_seconds: params.audio_length
            }
            resultType = "VIDEO";
            break;

        case "v-express":
            // zsxkib/v-express:e01226580ffa003adb191086383ae9c8d687ba1f37ddedd758351a28cf3488b2
            body.version = "e01226580ffa003adb191086383ae9c8d687ba1f37ddedd758351a28cf3488b2";
            let h = params.image_height;
            let w = params.image_width;
            if(h > 2048){
                w = Math.floor(w * (2048 / h));
                h = 2048;                
            }
            if(w > 2048){
                h = Math.floor(h * (2048 / w));                
                w = 2048;                
            }
            body.input = {
                reference_image: params.source_image,
                driving_audio: params.driven_audio,
                image_height: h,
                image_width: w,
                max_audio_seconds: params.audio_length,
                motion_mode: "normal",
            }
            resultType = "VIDEO";
            break;

        case "hallo":
            aiservice = "SEGMIND";
            body.version = "hallo";
            body.input = {
                "input_image": params.source_image,
                "input_audio": params.driven_audio,
                "base64": true
            };
            resultType = "VIDEO";
            break;
            
        case "faceswapFilter":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FACESWAP_FILTER_VIDEO;
            }            
            switch(serviceLine){
                case "SEGMIND_FF":
                    aiservice = "SEGMIND";
                    body.version = "faceswapFilter";
                    body.input = {
                        "source_image": params.source,
                        "target": params.target,
                        "pixel_boost": `1024x1024`, // '768x768', // `1024x1024`,
                        "face_selector_mode": "one",
                        "face_selector_order": params.targetOrder || "large-small",
                        "face_selector_gender": params.targetGender,
                        //"face_selector_race": "none",
                        //"reference_frame_number": 1,                
                        "base64": true
                    };
                    break;

                case "SEGMIND_FV": 
                default:
                    aiservice = "SEGMIND";
                    body.version = "faceswapVideo";
                    body.input = {
                        "source_img": params.source,
                        "video_input": params.target,
                        "face_restore": false,
                        "input_faces_index": `0,1,2,3,4,5`,
                        "source_faces_index": `0,1,2,3,4,5`,
                        "face_restore_visibility": 1,
                        "codeformer_weight": 0.95,
                        "detect_gender_input": params.targetGender || "no",
                        "detect_gender_source": params.targetGender || "no",
                        "frame_load_cap": 0,
                        "base64": true
                    };
                    break;     
            }
            resultType = "VIDEO";
            break;
            
        case "faceswapVideo":
            // philz1337 / faceswap-video
            // 备用 arabyai-replicate/roop_face_swap:11b6bf0f4e14d808f655e87e5448233cceff10a45f659d71539cafb7163b2e84
            //body.input = {
            //    swap_image: params.source, 
            //    target_video: params.target,                
            //};  
            // 20240113: okaris/roop:8c1e100ecabb3151cf1e6c62879b6de7a4b84602de464ed249b6cff0b86211d8 //已经被废除链接，但是还可以访问
            // okaris/roop-t4:5b6eca59a87bb8579739fe2185af02ab0f62f5e1ebc95f117697901847b92d89
            if(!serviceLine){
                serviceLine = process.env.SERVICE_FACESWAP_VIDEO;
            }
            switch(serviceLine){
                case "AM":
                    aiservice = "AM";
                    body.version = "faceswapVideo-V2";
                    body.input = {
                        swap_image: params.source,
                        target_video: params.target                    
                    }
                    break;

                case "AM_CAPIX":
                    aiservice = "AM";
                    body.version = "faceswapVideo-Capix";
                    body.input = {
                        swap_url: params.source,
                        target_url: params.target                    
                    }
                    break;
                    
                case "PI": // 无法查看队列
                    aiservice = "PI";
                    body.version = "faceswapVideo";
                    body.input = {
                        swap_image: params.source,
                        target_video: params.target                    
                    }
                    break;
                    
                case "FAL": // 容易堵塞队列死机
                    aiservice = "FAL";
                    body.version = "fal-ai/face-swap/video-to-video";
                    body.input = {
                        swap_image_url: params.source,
                        base_video_url: params.target                    
                    }
                    break;
                case "SEGMIND": // 不能异步返回，所以很难处理稍微长的视频，失败还要付钱！！！
                case "SEGMIND_FV":
                    aiservice = "SEGMIND";
                    body.version = "faceswapVideo";
                    body.input = {
                        "source_img": params.source,
                        "video_input": params.target,
                        "face_restore": true,
                        "input_faces_index": `${params.videoFaceIndex}`,
                        "source_faces_index": 0,
                        "face_restore_visibility": 1,
                        "codeformer_weight": 0.95,
                        "detect_gender_input": "no",
                        "detect_gender_source": "no",
                        "frame_load_cap": 0,
                        "base64": true
                    };
                    break;
                case "REP_2": // NSFW过于严格
                    // okaris/roop-a100-40gb:69080df07970c0a366cd63acf61850749428d1bf3b2abe544c97e233b9be5b10                
                    inputImage = params.source;
                    body.version = "69080df07970c0a366cd63acf61850749428d1bf3b2abe544c97e233b9be5b10";
                    body.input = {
                        source : params.source,
                        target : params.target,
                        keep_fps: true,
                        keep_frames: true,
                        enhance_face: true,
                    }
                    break;

                case "REP_L": // 偶尔会失败
                    // runhuasun/faceswap-video
                    body.predictUrl = `https://api.replicate.com/v1/deployments/runhuasun/faceswap-video/predictions`;                    
                    body.input = {
                        swap_image: params.source,
                        target_video: params.target,
                    }
                    break;
                
                case "REP":
                default:
                    // arabyai-replicate/roop_face_swap:11b6bf0f4e14d808f655e87e5448233cceff10a45f659d71539cafb7163b2e84                
                    inputImage = params.source;
                    body.version = "11b6bf0f4e14d808f655e87e5448233cceff10a45f659d71539cafb7163b2e84";
                    body.input = {
                        swap_image: params.source,
                        target_video: params.target,
                    }
            }
            resultType = "VIDEO";            
            break;
            
        case "portraitVideo":
            switch(params.service){
                case "fofr/live-portrait":
                    // fofr/live-portrait:067dd98cc3e5cb396c4a9efb4bba3eec6c4a9d271211325c477518fc6485e146"
                    body.version = "067dd98cc3e5cb396c4a9efb4bba3eec6c4a9d271211325c477518fc6485e146";
                    break;
                case "mbukerepo/live-portrait":
                    // mbukerepo/live-portrait:55392f840e8bfdc7af4d6139c67b6e713725e2b51dca63b53b499717902ea584
                    body.version = "55392f840e8bfdc7af4d6139c67b6e713725e2b51dca63b53b499717902ea584";
                    break;
            }
            body.input = params;      
            resultType = "VIDEO";            
            break;
        case "videoMatting":
           // "arielreplicate/robust_video_matting:73d2128a371922d5d1abf0712a1d974be0e4e2358cc1218e4e34714767232bac"
            body.version = "73d2128a371922d5d1abf0712a1d974be0e4e2358cc1218e4e34714767232bac";
            body.input = params; 
            resultType = "VIDEO";            
            break;

        case "videoretalk":
            aiservice = "ALI";
            body.version = "videoretalk";
            body.input = {
                video_url: params.face,
                audio_url: params.input_audio,
       //       ref_image_url: params.face_bbox,  // 输入视频中包含多张人脸时，VideoRetalk视频生成API仅能选择一张人脸作为目标替换其口型，实现口型与音频相匹配的效果。此参数用来指定以哪个人物作为目标。若不输入人脸参考图，默认将选择视频中第一个有人脸的画面中，人脸占比最大的人物为目标。
                params: {
                    video_extension: true,
                }
            };
            resultType = "VIDEO";
            break;

        case "kling-lip-sync":
            // kwaivgi/kling-lip-sync 
            body.input = {
                video_url: params.face,
                audio_file: params.input_audio
            } 
            body.predictUrl = "https://api.replicate.com/v1/models/kwaivgi/kling-lip-sync/predictions";
            resultType = "VIDEO";              
            break;
            
        case "retalk":
            // chenxwh/video-retalking : retalking:db5a650c807b007dc5f9e5abe27c53e1b62880d1f94d218d27ce7fa802711d67
            body.version = "db5a650c807b007dc5f9e5abe27c53e1b62880d1f94d218d27ce7fa802711d67";
            body.input = {
                face: params.face,
                input_audio: params.input_audio
            } 
            inputImage = params.face;
            resultType = "VIDEO";              
            break;

        case "lip-sync":
            aiservice = "FAL";
            body.version = "fal-ai/sync-lipsync";
            body.input = {
                video_url: params.face,
                audio_url: params.input_audio,
                sync_mode: "bounce", // "cut_off", loop
            }
            inputImage = params.face;
            resultType = "VIDEO";              
           
            // tmappdev/lipsync b7e775591e83379c7c99a3dea151002e92fcd6093609b05200df5fa04d53f1c1
            //        body.version = "b7e775591e83379c7c99a3dea151002e92fcd6093609b05200df5fa04d53f1c1";
            //        body.input = {
            //            video_input: params.face,
            //            audio_input: params.input_audio
            //        }
            break;

        case "musetalk":
            aiservice = "FAL";
            body.version = "fal-ai/musetalk";
            body.input = {
                source_video_url: params.face,
                audio_url: params.input_audio                    
            }
            inputImage = params.face;
            resultType = "VIDEO";              
            break;

        case "latentsync":
            aiservice = "FAL";
            body.version = "fal-ai/latentsync";
            body.input = {
                video_url: params.face,
                audio_url: params.input_audio,
                loop_mode: "pingpong", // loop
            }
            inputImage = params.face;
            resultType = "VIDEO";              
            break;
            
            
        case "audioswap":
            // charlesmccarthy/audioswap:b6460c4e74e71370f57a21a9ba7d7359de70ceab8d8f839cd82c45ec054fdac3
            body.version = "b6460c4e74e71370f57a21a9ba7d7359de70ceab8d8f839cd82c45ec054fdac3";
            body.input = {
                video1: params.videoWithAudio,
                video2: params.videoWithoutAudio
            }
            resultType = "VIDEO"
            break;
            
        //////////////////////////////////////////////////////////////////////////////////////////////    
        // 音频相关模型    
        case "fish-speech":
            // jichengdu/fish-speech:11f3e0394c06dcc099c0cbaf75f4a6e7da84cb4aaa5d53bedfc3234b5c8aaefc
            body.version = "11f3e0394c06dcc099c0cbaf75f4a6e7da84cb4aaa5d53bedfc3234b5c8aaefc";
            body.input = params;
            resultType = "VOICE";            
            break;
        
        case "music-01":
            inputImage = params.song_file || params.voice_file || params.instrumental_file;
            body.input = params;
            body.predictUrl = `https://api.replicate.com/v1/models/minimax/music-01/predictions`;
            resultType = "VOICE";            
            break;

        case "musicgen":
            // meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb
            body.version = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
            body.input = params;
            body.input.prompt = await translate(body.input.prompt);
            body.input.output_format = "mp3";
            resultType = "VOICE";            
            inputImage = params.input_audio;
            break;

        case "lyria-2":
            body.input = {
                prompt: await translate(params.prompt),
            }
            body.predictUrl = `https://api.replicate.com/v1/models/google/lyria-2/predictions`;
            resultType = "VOICE";            
            break;
            
        case "voiceTranslate":
            // cjwbw/seamless_communication:668a4fec05a887143e5fe8d45df25ec4c794dd43169b9a11562309b2d45873b0
            inputImage = params.input_audio;
            body.version = "668a4fec05a887143e5fe8d45df25ec4c794dd43169b9a11562309b2d45873b0";
            body.input = params;
            resultType = "VOICE";            
            break;

        case "text2voice":
            aiservice = params.aiservice;
            predicturl = "";
            prompt = params.content;
            body = params;
            resultType = "VOICE";            
            break;
        case "xtts":
            body.version = "684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e";
            body.input = params;
            resultType = "VOICE";            
            break;
            
        case "facefusion":
            // lucataco/modelscope-facefusion 52edbb2b42beb4e19242f0c9ad5717211a96c63ff1f0b0320caa518b2745f4f7
            body.version = "52edbb2b42beb4e19242f0c9ad5717211a96c63ff1f0b0320caa518b2745f4f7";
            body.input = params;
            break;

        case "zoomInVideo":
        case "real-esrgan-video":
            // lucataco/real-esrgan-video:c23768236472c41b7a121ee735c8073e29080c01b32907740cfada61bff75320
            body.version = "c23768236472c41b7a121ee735c8073e29080c01b32907740cfada61bff75320";
            let resolution:string = "FHD";
            switch(params.scale){
                case 4: resolution = "4k"; break;
                case 3: resolution = "2k"; break;
                default: resolution = "FHD";
            }                    
            body.input = {
                video_path : params.video,
                resolution
            }
            resultType = "VIDEO"
            break;

        case "gfpgan-video-RestoreFormer":
        case "gfpgan-video-v1.4":
        case "gfpgan-video-v1.3":            
            // pbarker/gfpgan-video:ea1116ce24126a411c7beb092e587bee24b25525c1b0e493e3a907904952ace3
            body.version = "ea1116ce24126a411c7beb092e587bee24b25525c1b0e493e3a907904952ace3";
            body.input = {
                video : params.video,
                scale : params.scale,
                version : func.split("-").pop(),
            }
            resultType = "VIDEO"
            break;

        case "byte-video_upscale":
            aiservice = "BYTE";
            body.version = func;            
            body.input = {
                url : params.video,
            }
            resultType = "VIDEO"
            break;

        case "gfpgan":
            // tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c
            body.version = "0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c";
            body.input = {
                img: params.image,
                scale: params.upscale || 2,
                version: "v1.4"
            }
            break;           
            
        case "zoomIn":
            // mv-lab/swin2sr 老模型，淘汰，贵，效果不佳
            // 05/16 nightmareai/real-esrgan  放大效果还不错，但是修复能力不强  
            // 05/16 night tencentarc/gfpgan
            // 备选模型 daanelson / real-esrgan-a100
            // prompt = "购买的放大图片";
            if(params.handfix){
                // "philz1337x/clarity-upscaler:0c237d34697731df3f3899fed7d162b93b9a2578bb167940218e771e7b3f4a48",
                body.version = "0c237d34697731df3f3899fed7d162b93b9a2578bb167940218e771e7b3f4a48";                
                body.input = params;                
            }else if(params.hdr){
                // "batouresearch/high-resolution-controlnet-tile:4af11083a13ebb9bf97a88d7906ef21cf79d1f2e5fa9d87b70739ce6b8113d29",
                body.version = "4af11083a13ebb9bf97a88d7906ef21cf79d1f2e5fa9d87b70739ce6b8113d29";
                body.input = params;
            }else if(params.repair){
                // tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c
                body.version = "0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c";
                body.input = {
                    img: params.image,
                    scale: params.upscale,
                    version: "v1.4"
                }
            }else{
                if(!serviceLine){
                    serviceLine = process.env.SERVICE_ZOOMIN;
                }                
                switch(serviceLine){
                    case "SEGMIND":
                        aiservice = "SEGMIND";
                        body.version = "codeformer";                        
                        body.input = {
                            image: params.image,
                            scale: params.upscale,
                            fidelity: params.codeformer_fidelity,
                            bg: params.background_enhance,
                            face: params.face_upsample,
                            "base64": true                                            
                        }
                        break;
                    case "REP":
                    default:
                        // 画面效果非常好 sczhou/codeformer 7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56                
                        body.version = "7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56";
                        body.input = params;                        
                }
            }
            break;

        case "analog":
            body.version = "1f7f51e8b2e43ade14fb7d6d62385854477e078ac870778aafecf70c0a6de006";
            body.input = {
                prompt: "analog style, " + await translate(realText? realText : inputText) + ", ",
                negative_prompt: negativePromptTemplate,
            };  
            break;

            ////////////////////////////////////////////////////////////////////////////////////////
            // remove background
            ////////////////////////////////////////////////////////////////////////////////////////
        case "removeBG":
        case "remove-bg":
            // 240630: lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1
            body.version = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003";
            body.input = {
                image: imageUrl,
            };
            break;
        case "birefnet":
            // men1scus/birefnet:f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7
            body.version = "f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7";
            body.input = {
                image: imageUrl,
            };
            break;
        case "rembg-enhance":
            // smoretalk/rembg-enhance:4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919
            body.version = "4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919";
            body.input = {
                image: imageUrl,
            };
            break;
        case "rembg":
            // cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003
            body.version = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003";
            body.input = {
                image: imageUrl,
            };
            break;
        case "background-remover":
            // 851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc
            body.version = "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";
            body.input = {
                image: imageUrl,
            };
            break;
            
            ////////////////////////////////////////////////////////////////////////////////////////
            // change background
            ////////////////////////////////////////////////////////////////////////////////////////
        case "byte-bgpaint":
            aiservice = "BYTE";
            body.version = func;
            body.input = {
                image_urls : [params.image_url],
                prompt : params.prompt,
                post_process : "SR",
            }   
            break;
            
        case "changeBG":
            // mridul-ai-217/image-inpainting
            // 20240612 wolverinn/realistic-background:ce02013b285241316db1554f28b583ef5aaaf4ac4f118dc08c460e634b2e3e6b
            body.version = "ce02013b285241316db1554f28b583ef5aaaf4ac4f118dc08c460e634b2e3e6b"
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            params.appended_prompt = "best quality";
            if(params.background_image){
                // zsxkib/ic-light-background:60015df78a8a795470da6494822982140d57b150b9ef14354e79302ff89f69e3                
                body.version = "60015df78a8a795470da6494822982140d57b150b9ef14354e79302ff89f69e3";
                params.width = imgWidth;
                params.height = imgHeight;
            }
            body.input = params;
            break;

        case "ic-light-background":
            // "zsxkib/ic-light-background:60015df78a8a795470da6494822982140d57b150b9ef14354e79302ff89f69e3",
            body.version = "60015df78a8a795470da6494822982140d57b150b9ef14354e79302ff89f69e3"
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            params.width = params.width || imgWidth;
            params.height = params.height || imgHeight;
            body.input = params;
            break;
            
        case "iclight-v2":
            aiservice = "FAL";
            body.version = "fal-ai/iclight-v2";            
            params.prompt = await translate(params.prompt);
            body.input = params;
            break;

            /////////////////////////////////////////////////////////////////////////////////
            // 人物写真相关
            // pulid-base效果差
            // omni-zero：女人模拟比较像，男性逼真程度一般            
            // instant-id 人物模拟很像
            // kolors-with-ipadapter 效果极其好，不能单独控制姿势
            // grandlineai/instant-id-photorealistic 效果好，就是尺寸不能单独控制，
        case "poseAndFace":
            // catio-apps/ip_adapter-face-controlnet-realistic_vision: be23435bf5ed42adeba5c524a025ad30a2ed402dbb3c507f6415f6529deaa706
            // catio-apps / photoaistudio-generate: 076923c3d56f92d97a7996f816ed7301b740c0457c5d097dc5713daf5521d66f      
            // 240331: "catio-apps/photoaistudio-generate:18232bfdbee5bb42fb3fb959ccd056777a91b461a97a677b6d4730b9215a076c",
            // 240522: "zsxkib/instant-id:491ddf5be6b827f8931f088ef10c6d015f6d99685e6454e6f04c8ac298979686"
            // 240727: "grandlineai/instant-id-photorealistic:03914a0c3326bf44383d0cd84b06822618af879229ce5d1d53bef38d93b68279" //不需要poseImage
            prompt = params.prompt;
            params.prompt = await translate(params.prompt) + promptQualityControl;
            params.negative_prompt = negativePromptTemplate;
            if(params.pose_image){
                body.version = "491ddf5be6b827f8931f088ef10c6d015f6d99685e6454e6f04c8ac298979686";
            }else{
                body.version = "03914a0c3326bf44383d0cd84b06822618af879229ce5d1d53bef38d93b68279";
            }
            body.input = params;          
            break;
            
        case "face2Photo":
            // lucataco/ip_adapter-sdxl-face 226c6bf67a75a129b0f978e518fed33e1fb13956e15761c1ac53c9d2f898c9af
            // 20240513: zsxkib/pulid:c169c3b8f6952cf895d043d7b56830b4e9a3e9409a026004e9efbd9da42912b4
            // && fofr/pulid-base:ff8800a68a85d1fed2bbba91c326ec82175b41a168e77c7c5b4653153ac9c3f1
            params.prompt = await translate(params.prompt);
            params.negative_prompt = negativePromptTemplate;
            body.input = params;
            if(params.checkpoint_model && params.checkpoint_model != "general"){
                body.version = "ff8800a68a85d1fed2bbba91c326ec82175b41a168e77c7c5b4653153ac9c3f1";
            }else{
                body.version = "c169c3b8f6952cf895d043d7b56830b4e9a3e9409a026004e9efbd9da42912b4";
            }
            break;


        case "face-detailer":
            aiservice = "SEGMIND";
            body.version = "face-detailer";
            body.input = {
                image: params.imageURL,
                prompt: await translate(params.prompt),
                negative_prompt: negativePromptTemplate,
                denoise: 0.4,
                "image_format": "jpeg",
                "image_quality": 100,   
                "base64": true                
            }
            break;
            
        case "expression-editor":
            // fofr/expression-editor:bf913bc90e1c44ba288ba3942a538693b72e8cc7df576f3beebe56adc0a92b86
            body.version = "bf913bc90e1c44ba288ba3942a538693b72e8cc7df576f3beebe56adc0a92b86";
            body.input = params;
            body.input.image = params.imageURL;
            body.input.output_format = "jpg";
            body.input.output_quality = 100;
            break;

        case "live-portrait-image":
            // pikachupichu25/live-portrait-image:f60012e7f8ebeeeff2fccbe6230161be65da2a4a017490b9b9c556b3e8183fec
            body.version = "f60012e7f8ebeeeff2fccbe6230161be65da2a4a017490b9b9c556b3e8183fec";
            body.input = {
                source_image: params.imageURL,
                driving_image: params.refImage,
                post_processing_eye: true,
                post_processing_lip: true,
            };
            break;
            
        case "stylePortrait":
        case "omni-zero-fal":
            if(!serviceLine){
                serviceLine = process.env.SERVICE_OMNI;
            }                
            switch(serviceLine){            
                case "FAL": {
                    // fal-ai/omni-zero
                    aiservice = "FAL";
                    body.version = "fal-ai/omni-zero";            
                    body.input = {
                        prompt: await translate(params.prompt),
                        negative_prompt: negativePromptTemplate,
                        image_url: params.base_image,
                        composition_image_url: params.composition_image,
                        style_image_url: params.style_image,
                        identity_image_url: params.identity_image,
                        image_strength: params.base_image_strength,
                        composition_strength: params.composition_image_strength,
                        depth_strength: params.depth_image_strength,
                        style_strength: params.style_image_strength,
                        identity_strength: params.identity_image_strength,
                        face_strength: params.identity_image_strength            
                    }
                    break;
                }
                case "REP":
                default: {
                    aiservice = "REP";
                    // okaris/omni-zero:63ae60eb91f6d09acc0ec5bb9892b330e63150cc50ee87d48e93ad73d25291f6
                    // 240905 okaris/omni-zero:036947f1e1961875eef47a561293978528bf3a847e79fedb20600c9ad25d0c59
                    body.version = "036947f1e1961875eef47a561293978528bf3a847e79fedb20600c9ad25d0c59";
                    body.input = {
                        model : "omni-zero-realism",
                        prompt: await translate(params.prompt),
                        negative_prompt : negativePromptTemplate,
                        image: params.base_image,
                        image_strength : params.base_image_strength,
                        composition_image : params.composition_image,
                        composition_strength : params.composition_image_strength,
                        style_image : params.style_image,
                        style_strength : params.style_image_strength,
                        identity_image : params.identity_image,
                        identity_strength : params.identity_image_strength,
                        depth_image : params.depth_image,
                        depth_strength : params.depth_image_strength
                    };
                }
            }
            resultType = "IMAGE";
            break;                

        case "styleTransfer":
            // fofr/style-transfer:f1023890703bc0a5a3a2c21b5e498833be5f6ef6e70e9daf6b9b3a4fd8309cf0
            body.version = "f1023890703bc0a5a3a2c21b5e498833be5f6ef6e70e9daf6b9b3a4fd8309cf0";
            body.input = params;
            body.input.prompt = await translate(params.prompt);            
            body.input.negative_prompt = negativePromptTemplate;
            break;
        case "style-transfer":
            // philz1337x/style-transfer:a15407d73d9669676d623e37ee3b6d43642439beec1b99639967d215bcf42fc4
            body.version = "a15407d73d9669676d623e37ee3b6d43642439beec1b99639967d215bcf42fc4";
            body.input = params;
            break;
            
        case "ipAdapter":
            // fofr/kolors-with-ipadapter:5a1a92b2c0f81813225d48ed8e411813da41aa84e7582fb705d1af46eea36eed
            body.version = "5a1a92b2c0f81813225d48ed8e411813da41aa84e7582fb705d1af46eea36eed";
            if(params){
                body.input = params;
                body.input.negative_prompt = negativePromptTemplate;
                body.input.width = params.width || imgWidth;
                body.input.height = params.height || imgHeight;
            }else{
                body.input = {
                    width: imgWidth,
                    height: imgHeight,              
                    prompt: `${realText}, ${promptQualityControl}`,
                    negative_prompt: negativePromptTemplate,
                    output_format: "jpg",
                    ip_adapter_weight_type: "style and composition",
                };
                if(imageUrl){body.input.image = imageUrl}            
            }
            break;

        case "instant-id-ipadapter-plus-face":
            // zsxkib/instant-id-ipadapter-plus-face:32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161
            body.version = "32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161";
            params.prompt = await translate(params.prompt);            
            params.negative_prompt = negativePromptTemplate;
            body.input = params;
            break;
          
        case "lora":
            log(roomId, "lora: ---> " + modelurl);
            let loraurl = modelurl;
            // 从数据库里找到对应的模型
            const model = await prisma.model.findUnique({
                where: {
                    code: modelurl,
                }
            });

            if((model?.trainSrv == "ostris / flux-dev-lora-trainer") && model.url){
                aiservice = "REP";
                body.version = model.url.split(":").pop(); // runhuasun/m24030506:ab3c3c3c0d032d1fcf1019af4d388d51625e8086b93b9ab7f98ad0205f117319
                // body.version = model.url.replace(":", "/"); // runhuasun/m24030506:ab3c3c3c0d032d1fcf1019af4d388d51625e8086b93b9ab7f98ad0205f117319
                if(model.channel == "PORTRAIT" || model.channel == "FASHION"){
                    realText = "a portrait photo of the TOK. " + await translate(realText);
                }else{
                    realText = "In the style of TOK . " + await translate(realText);
                }

                // 如果有参考图片，但是没有MASK，就用control net模仿                
                if(model && imageUrl && !mask && 
                   ( (model?.safetensors && model.safetensors.indexOf(".safetensors")>0) || 
                    (model?.weights && model.weights.indexOf(".tar")>0) ) 
                  ){ 
                    aiservice = "FAL";
                    body.version = "fal-ai/flux-control-lora-canny";                    
                    const image_size = await iu.getImageSize(imageUrl);
                    if(!model.safetensors && model.weights){
                        const st = await lu.extractAndUploadLora(model.weights);
                        if(st){
                            model.safetensors = st;
                            await prisma.model.update({where:{id:model.id}, data:{safetensors:st}});
                        }
                    }                    
                    body.input = {
                        prompt: `${await translate(realText)}, ${modelTheme == "FACE" ? ", detailed face " : ""}, ${promptQualityControl}`,
                        loras: [{
                            path: model.safetensors,
                            scale:(loraScale*2) || 0.9, 
                        }],
                        control_lora_image_url: imageUrl,
                        control_lora_strength: controlStrength || 1,
                        image_url: imageUrl,
                        sync_mode: true,
                        num_images: 1,
                        image_size,
                        enable_safety_checker: needSafeCheck,
                        output_format : "jpeg"                        
                    }                        
                }else{
                    body.input = {
                        model: "dev",
                        prompt:  realText,
                      //  lora_weights: body.version,
                      //  prompt: await translate(realText),
                        aspect_ratio: "custom",
                        width: imgWidth,
                        height: imgHeight,                      
                        //aspect_ratio: flux_aspect_ratio,
                        lora_scale: 1,
                        num_outputs: 1,
                        output_format: "jpg",
                        guidance_scale: 3.5,
                        //guidance: 3.5,
                        output_quality: 90,
                        prompt_strength: 0.8,
                        extra_lora_scale: 1,
                        num_inference_steps: 28,
                        disable_safety_checker: !needSafeCheck,                    
                    }
                }
                // body.predictUrl = `https://api.replicate.com/v1/models/black-forest-labs/flux-dev-lora/predictions`;
                if(imageUrl){body.input.image = imageUrl}
                if(mask){body.input.mask = mask}                
                
            }else if(model?.trainSrv == "fal-ai/flux-lora-general-training"){
                aiservice = "FAL";

                let image_size:any;
                if(imageUrl){
                    body.version = "fal-ai/flux-lora-canny";                    
                    image_size = await iu.getImageSize(imageUrl);
                }else{
                    body.version = "fal-ai/flux-general";                    
                    switch(drawRatio){ 
                        case "916":  image_size = "portrait_16_9"; break;
                        case "169":  image_size = "landscape_16_9"; break;
                        case "34":  image_size = "portrait_4_3"; break;
                        case "43":  image_size = "landscape_4_3"; break;
                        case "11":  image_size = "square_hd"; break;     
                        default: image_size = "square";
                    }                
                }
                body.input = {
                    prompt: `${await translate(realText)}, ${modelTheme == "FACE" ? ", detailed face " : ""}, ${promptQualityControl}`,
                    loras: [{
                        path: model.weights || model.url,
                        scale:(loraScale*2) || 0.9, 
                    }],
                    sync_mode: true,
                    num_images: 1,
                    image_size,
                    enable_safety_checker: needSafeCheck,
                    output_format : "jpeg"
                };
                if(imageUrl){                    
                    //body.input.controlnet_unions = [{
                    //    path: "InstantX/FLUX.1-dev-Controlnet-Union",
                    //    controls: [{
                    //        control_image_url: imageUrl,
                    //        control_mode: "pose",
                    //        conditioning_scale: 0.342 + (controlStrength/100),
                    //    }]
                    //}];
                    body.input.image_url = imageUrl;
                }                
            }else if(model && model.trainSrv == "b2a308762e36ac48d16bfadc03a65493fe6e799f429f7941639a6acec5b276cc"){
                // 兼容老版本                
                let modelVer = "db1c4227cbc7f985e335b2f0388cd6d3aa06d95087d6a71c5b3e07413738fa13";                
                // 不为空说明是用户自定义的模型
                // 就使用用户定义的模型位置
                loraurl = (model && model.url) ? model.url : (process.env.MODEL_LORA_PATH  + modelurl+ ".safetensors");
                let tPrompt = await translate(realText);
                let scheduler = "DDIM";
                if(room == "realistic"){
                    modelVer = "db1c4227cbc7f985e335b2f0388cd6d3aa06d95087d6a71c5b3e07413738fa13";            
                    tPrompt = "photo of <1> , " + tPrompt;
                }else if(room == "MidJourney-V4"){
                    modelVer = "f8e5074f993f6852679bdac9f604590827f11698fdbfc3f68a1f0c3395b46db6";                
                    tPrompt = "mdjrny-v4 style <1> ,  " + tPrompt;
                    scheduler = "K_EULER"; // 必须用这个
                }else if(room == "cartoon"){
                    modelVer = "59dffafb2e9d421001b8d2d694b06fb1ffdcd144b2eec66aba0db5a38d0c6f71";                
                    tPrompt = " <1> , comic, " + tPrompt;
                }else{
                    modelVer = "db1c4227cbc7f985e335b2f0388cd6d3aa06d95087d6a71c5b3e07413738fa13";            
                    tPrompt = "photo of <1> , " + tPrompt;
                }
                if(modelTheme == "FACE"){
                    tPrompt += ", detailed face ";
                }    
                tPrompt += promptQualityControl;
                body.version = modelVer;
                body.input = {
                    num_inference_steps: 30, // 大约18秒，平均每增加10步需要服务器增加1.2秒，0.0023美元/每秒，目前算法0.29元/次服务器成本
                    //     prompt_strength: 0.8,
                    guidance_scale: modelTheme == "STYLE" ? 3.5 : 8,   // 数值越大越严格遵守提示词
                    scheduler: scheduler, // K_EULER也还行，目前生成质量较好的调度器
                    lora_scales: "0.8",   // 数值越大lora影响力越大
                    prompt: tPrompt,
                    lora_urls: loraurl,
                    width: imgWidthSmall,
                    height: imgHeightSmall,            
                    negative_prompt: (room == "cartoon") ? negativePromptTemplate : ("((3d, cartoon, anime, sketches))," + negativePromptTemplate),
                };  
                if(imageUrl){body.input.image = imageUrl}
                
            }else{
                // 新版本的lora lucataco / realvisxl2-lora 9b5a0c77cd4f6bdb53a2c3d05b4774df02876d21dd7d37f13f518c03e996945b
                // 240313: zylim0702/sdxl-lora-customize-model:5a2b1cff79a2cf60d2a498b424795a90e26b7a3992fbd13b340f73ff4942b81e // 效果好，但是容易NSFW，不支持图生图
                // 240314:   "fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16",
                // 240316:  "fofr/realvisxl-v3-multi-controlnet-lora:90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade", //更逼真，但是没有训练工具，画面失真
                // 240317： "fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16",
                // 240522: back to lucataco /realvisxl2-lora 
                loraurl = (model && model.url) ? model.url : (process.env.MODEL_LORA_PATH  + modelurl+ ".safetensors");
                let tPrompt = await translate(realText);
                if(modelTheme == "FACE"){
                    tPrompt += ", detailed face ";
                }                    
                const modelParams = (model && model.params) ? JSON.parse(model.params) : undefined;
                //let aPrompt = (params && params.aPrompt) ? await translate(params.aPrompt) : '';
                let tokPrompt = "a photo of TOK, ";
                let nPrompt = (modelParams && modelParams.nPrompt) ? modelParams.nPrompt : 
                    ((tPrompt.indexOf("comic")<0 && tPrompt.indexOf("cartoon")<0) ? 
                     ("((3d, cartoon, anime, sketches))," + negativePromptTemplate) : negativePromptTemplate);
                body.input = {
                        Lora_url: loraurl,
                        lora_url: loraurl,
                        lora_weights: loraurl,
                        prompt: tokPrompt + tPrompt + promptQualityControl, // tokPrompt + aPrompt + tPrompt + promptQualityControl,
                        disable_safety_checker: !needSafeCheck,
                        apply_watermark: false,
                        num_inference_steps: 50, // 大约18秒，平均每增加10步需要服务器增加1.2秒，0.0023美元/每秒，目前算法0.29元/次服务器成本
                        prompt_strength: 0.8,
                        guidance_scale: modelTheme == "STYLE" ? 5 : 7.5,   // 数值越大越严格遵守提示词
                        scheduler: "K_EULER_ANCESTRAL", // K_EULER也还行，目前生成质量较好的调度器
                        lora_scale: loraScale || 0.9,   // 数值越大lora影响力越大
                        width: imgWidth,
                        height: imgHeight,            
                        negative_prompt: nPrompt,
                        // lucataco的refine总是报错，可能并没有实现
                        // refine: "base_image_refiner", //"expert_ensemble_refiner",
                        // refine_steps: 30
                        // high_noise_frac: 0.8,
                    };  
                switch(inference){
                    case "batouresearch / open-dalle-1.1-lora":
                        body.version = "2ade2cbfc88298b98366a6e361559e11666c17ed415d341c9ae776b30a61b196";
                        body.input.refine = "expert_ensemble_refiner";
                        if(imageUrl){
                            body.input.image = imageUrl;
                            body.input.prompt_strength = controlStrength;
                            if(mask){
                                body.input.mask = mask;
                            }                       
                        }
                        break;
                    case "omniedgeio / deepfashionsdxl":
                        body.version = "8b134cac45752cc9d253588f66396ceb284b2348fd1616e0c75fa0d7b56e0999";
                        body.input.hdr = 1;
                        body.input.refine = "base_image_refiner";
                        body.input.replicate_weights_url = loraurl;
                        if(imageUrl){
                            body.input.image = imageUrl;
                            body.input.img2img = true;
                            body.input.controlnet = true;
                            body.input.condition_scale = controlStrength * 2;
                            body.input.strength = controlStrength;
                            if(mask){
                                body.input.mask = mask;
                            }                       
                        }
                        break;

                    case "fofr / realvisxl-v3-multi-controlnet-lora":
                        body.version = "90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade";
                        body.input.refine = "base_image_refiner";                        
                        body.input.lora_weights = loraurl;
                        body.input.num_inference_steps = 30;
                        body.input.refine_steps = 30;
                        body.input.crop_based_on_salience = false; // 不要裁剪
                        if(imageUrl){
                            body.input.image = imageUrl;
                            body.input.prompt_strength = 1;
                            body.input.controlnet_1_image = imageUrl;
                            // body.input.sizing_strategy = "controlnet_1_image";
                            body.input.controlnet_1 = controlNet || "depth_midas"; // 画面颜色低精度模仿
                            body.input.controlnet_1_conditioning_scale = controlStrength;
                            body.input.controlnet_1_start = 0;
                            body.input.controlnet_1_end = controlStrength;
                            if(mask){
                                body.input.image = imageUrl;
                                body.input.mask = mask;
                            }
                        }
                        break;
                    case "fofr / sdxl-multi-controlnet-lora":
                        body.version = "89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16";
                        body.input.lora_weights = loraurl;
                        body.input.num_inference_steps = 30;
                        body.input.refine_steps = 30;
                        body.input.crop_based_on_salience = false; // 不要裁剪
                        if(imageUrl){
                            body.input.image = imageUrl;
                            body.input.prompt_strength = 1;
                            body.input.controlnet_1_image = imageUrl;
                            body.input.controlnet_1 = controlNet || "depth_midas"; // 画面颜色低精度模仿
                            body.input.controlnet_1_conditioning_scale = controlStrength;
                            body.input.controlnet_1_start = 0;
                            body.input.controlnet_1_end = controlStrength;
                            if(mask){
                                body.input.image = imageUrl;
                                body.input.mask = mask;
                            }
                        }
                        break;
                    case "batouresearch / sdxl-controlnet-lora":
                        body.version = "3bb13fe1c33c35987b33792b01b71ed6529d03f165d1c2416375859f09ca9fef";
                        body.input.lora_weights = loraurl;
                        body.input.num_inference_steps = 40;
                        body.input.refine = "base_image_refiner";
                        body.input.refine_steps = 40;
                        if(imageUrl){
                            body.input.image = imageUrl;
                            body.input.img2img = true;
                            body.input.condition_scale = controlStrength * 2;
                            body.input.strength = controlStrength;                            
                        }
                        break;
                    case "alexgenovese / sdxl-lora":
                        body.version = "423422aecd2567600cd6456fdcaef85f21a772e9fa1512311be1eeb4aa0bb0d5";
                        body.input.lora_url = loraurl;
                        body.input.refine = "expert_ensemble_refiner";
                        if(imageUrl){ body.input.image = imageUrl; }
                        break;
                    case "lucataco / ssd-lora-inference": 
                        body.version = "c12da324765b82d631da86b55b22d50e3533f49caa616f029517a0af328be570";
                        body.input.lora_url = loraurl;
                        if(imageUrl){ 
                            body.input.image = imageUrl; 
                            body.input.prompt_strength = controlStrength;
                        }                        
                        break;
                    case "zylim0702 / sdxl-lora-customize-model": // 支持img2img有问题
                        body.version = "5a2b1cff79a2cf60d2a498b424795a90e26b7a3992fbd13b340f73ff4942b81e";
                        body.input.Lora_url = loraurl;
                        body.input.refine = "expert_ensemble_refiner";
                        break;
                    case "lucataco / realvisxl2-lora-inference": // 支持img2img有问题
                    default:
                        body.version = "9b5a0c77cd4f6bdb53a2c3d05b4774df02876d21dd7d37f13f518c03e996945b";   
                        body.input.lora_url = loraurl;
                        if(imageUrl){body.input.image = imageUrl}
                        break;
                }       
                if(mask){body.input.mask = mask}
            }

            break;

        case "draftFree":
            // 23-05-23 升级成controlnet1.1  rossjillian / controlnet_1-1
            // 识别出图片中的内容
            // 23-09-28 升级为SDXL controlnet 1.1 zylim0702 / controlnet-v1-1-multi
            if(!inputText || inputText.trim().length==0){
                const cv = AIS.createCVInstance("REP", "recogImg");
                const getUrl = await cv!.predict({image:imageUrl});
                let imgDesc = await cv!.getPredictResult(getUrl);
                if(imgDesc.indexOf("Caption:")==0){
                    imgDesc = imgDesc.substring(8);
                }
                inputText = imgDesc;
            }
            body.version = "211486c3a33e26c7513c3ae4db00621f155bff401d3a241e260995e04bbbd88a";
            body.input = {
                image: imageUrl,
                autogenerated_prompt: false,
                // image_resolution: "768",
                structure: "scribble",
                prompt: await translate(inputText),
                "ddim_steps": 30,
                a_prompt:  " best quality, ultra-detailed ", 
                n_prompt:  negativePromptTemplate,
            };    
            break;
            
        case "deco":
            // jagilley/controlnet-hough
            // 23-09-28 升级为SDXL controlnet 1.1 zylim0702 / controlnet-v1-1-multi
            // jagilley / controlnet-hough 854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b
            // 24-12-25 flux-canny-dev
            // body.version = "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b";
            body.input = {
                //image: imageUrl,
                //autogenerated_prompt: false,
                //image_resolution: "768",
                //structure: "mlsd",
                prompt: await translate(realText),
                control_image: imageUrl,
                output_format: "jpg",
                output_quality: 100,
                disable_safety_checker: !needSafeCheck,
                //"ddim_steps": 30,
                //a_prompt: "best quality, extremely detailed, photo from Pinterest, interior design, cinematic photo, Highly detailed 8K, warm color schema, photo realistic, cinematic lighting, award-winning",
                //n_prompt: " extra digit, fewer digits, cropped, worst quality, low quality",
            };
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-depth-dev/predictions";
            break;
        case "draft":
            // controlnet 1.1
            // 23-09-28 升级为SDXL controlnet 1.1 zylim0702 / controlnet-v1-1-multi
            // jagilley / controlnet-hough 854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b
            // 24-12-25 flux-canny-dev
            // body.version = "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b";
            body.input = {
                prompt: await translate(realText),                
                control_image: imageUrl,
                output_format: "jpg",
                output_quality: 100,
                disable_safety_checker: !needSafeCheck,
                //autogenerated_prompt: false,
                //image_resolution: "768",
                //  structure: "mlsd",
                // "ddim_steps": 30,
                // a_prompt: "best quality, photo from Pinterest, cinematic photo, ultra-detailed, ultra-realistic, Highly detailed 8K, award-winning, interior design, photo realistic, natural lighting",
                // n_prompt:  " worst quality, low quality",
            };
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-canny-dev/predictions";
            break;
        case "garden":
            // jagilley / controlnet-normal
            // 23-09-28 升级为SDXL controlnet 1.1 zylim0702 / controlnet-v1-1-multi
            // 24-12-25 flux-canny-dev
            // body.version = "211486c3a33e26c7513c3ae4db00621f155bff401d3a241e260995e04bbbd88a";
            body.input = {
                //image: imageUrl,
                //autogenerated_prompt: false,
                //structure: "mlsd",
                //image_resolution: "768",
                prompt:  await translate(realText),
                control_image: imageUrl,
                output_format: "jpg",
                output_quality: 100,
                disable_safety_checker: !needSafeCheck,
                //"ddim_steps": 30,
                // "Scandinavian": 0.2,
                //a_prompt: " best quality, photo from Pinterest, cinematic photo, ultra-detailed, ultra-realistic, Highly detailed 8K, award-winning, interior design, photo realistic, natural lighting",
                //n_prompt:  " worst quality, low quality",
            };
            body.predictUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-depth-dev/predictions";
            switch(room){
                case "Minor":
                    // controlnet-hed  ver = "cde353130c86f37d0af4060cd757ab3009cac68eb58df216768f907f0d0a0653";
                    // controlnet1.1 softedge
                    // 20240409: SDXL Canny  "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd9751047043a5bbb4c184b", output
                    // body.version = "06d6fae3b75ab68a28cd2900afa6033166910dd09fd9751047043a5bbb4c184b";             
                    // body.input.negative_prompt = body.input.n_prompt;
                    // body.input.prompt = body.input.prompt; //  + body.input.a_prompt;
                    body.input.guidance = 10;
                    break;
                case "Basic":
                    // controlnet-normal ver = "cc8066f617b6c99fdb134bc1195c5291cf2610875da4985a39de50ee1f46d81c";
                    // body.input.structure = "normal";
                    body.input.guidance = 30;                    
                    break;
                case "Major":
                    // controlnet-seg ver = "f967b165f4cd2e151d11e7450a8214e5d22ad2007f042f2f891ca3981dbfba0d";
                    // mlsd
                    // jagilley / controlnet-hough 854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b output[1]
                    //body.version = "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b";
                    body.input.guidance = 50;                    
                    break;
                case "Thorough":
                    // jagilley / controlnet-hough ver = "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b";
                    // 20240409 jagilley / controlnet-scribble  435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117  output[1]
                    //body.version = "435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117";
                    body.input.guidance = 70;                    
                    break;
            }
            break;


        // 结束了所有FUNC的对应参数
        // 缺省的func执行    
        default: {
            body.version = rid;
            body.input = params;

            ////////////////////////////////////////////////////////////
            log(roomId, "处理aisha-ai-official");
            ///////////////////////////////////////////////////////////
            if(func.startsWith("aisha-ai-")){
                const m = mt.roomMap.get(func);
                log(roomId, "ROOM TYPE:", JSON.stringify(m));
                if(m && m.rid){
                    aiservice = "REP";
                    body.version = m.rid;
                    // 如果提供了参考图就识别成提示词
                    if(imageUrl && realText?.trim()?.length<10){
                        const cv = AIS.createCVInstance("REP", "recogImg");
                        const getUrl = await cv!.predict({image:imageUrl});
                        let imgDesc = await cv!.getPredictResult(getUrl);
                        if(imgDesc.indexOf("Caption:")==0){
                            imgDesc = imgDesc.substring(8);
                        }
                        realText += imgDesc;
                    }
                    body.input = {
                        prompt: await translate(realText? realText : inputText),
                        width: imgWidth,
                        height: imgHeight
                    };
                }
            }
            
            ////////////////////////////////////////////////////////////
            log(roomId, "处理flux finetune");
            ///////////////////////////////////////////////////////////
            if(func.startsWith("flux-ft-")){
                const m = mt.roomMap.get(func);
                log(roomId, "ROOM TYPE:", JSON.stringify(m));
                if(m && m.rid){
                    aiservice = "REP";
                    body.version = m.rid;
                    body.input = {
                        "model": "dev",
                        prompt: `In the style of ${m.trigger || "TOK"}, ${await translate(realText? realText : inputText)}`,
                        aspect_ratio: flux_aspect_ratio,
                        disable_safety_checker: !needSafeCheck,
                        output_quality: 100,
                        output_format: "jpg",
                        "go_fast": false,
                        "lora_scale": 1,
                        "megapixels": "1",
                        "num_outputs": 1,
                        "guidance_scale": 3.5,
                        "prompt_strength": 0.8,
                        "extra_lora_scale": 1,
                        "num_inference_steps": 28                        
                    };
                    if(imageUrl){
                        body.input.image = imageUrl;
                        body.input.prompt_strength = controlStrength || 0.8;
                        if(mask){
                            body.input.mask = mask;
                        }                       
                    }
                }
            }
        }
    }

        
    if(!isDALLE){  
        log(roomId, "body:");
        log(roomId, body);
        if(seed){
            log(roomId, "generate from seed:" + seed);
            if(aiservice == "REP" && body.input){
                body.input.seed = parseInt(seed);
            }else if(aiservice == "SDAPI"){
                body.seed = parseInt(seed);
            }
        }
    }
    

    return {
        body,
        resultType,
        predicturl,
        authstr,
        aiservice,
        prompt,
        inputImage,
        waitForUploadGenerated,        
    }
  
}


function log(roomId?:string, ...content:any){
    debug.log(roomId, content);
    dbLogger.log("Room", roomId, "generate", content);    
}
function warn(roomId?:string, ...content:any){
    debug.warn(roomId, content);
    dbLogger.warn("Room", roomId, "generate", content);    
}
function error(roomId?:string, ...content:any){
    debug.error(roomId, content);
    dbLogger.error("Room", roomId, "generate", content);    
}
