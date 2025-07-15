import { User, Model} from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import * as Fetcher from "node-fetch";

import prisma from "../../lib/prismadb";

import {getWidthOfDrawRatio, getHeightOfDrawRatio} from "../../components/DrawRatioSelector";
import {callReplicateAndWaitResult, throwToTrash, swapFace} from "./workflowAgent";
import {log, warn, error} from "../../utils/debug";
import { authOptions } from "./auth/[...nextauth]";
import * as global from "../../utils/globalUtils";
import { moveToFileServer, uploadDataToServer, uploadToReplicate } from "../../utils/fileServer";
import {translate} from "../../utils/localTranslate";
import {config, system} from "../../utils/config";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {BaseCVService} from "../../ai/cv/BaseCVService";
import * as AIS from "../../ai/AIService";
import {getRedirectedUrl, getPathOfURL, isURL, getBase64Code} from "../../utils/fileUtils";
import {callAPI} from "../../utils/apiUtils";
import {AliCVService} from '../../ai/cv/AliCVService';
import * as debug from "../../utils/debug";
import { generateRectMaskImage, generateMaskImageFromPNG } from "../../utils/imageUtils";
import * as vu from "../../utils/videoUtils";
import { moveToUploadio } from "../../utils/bytescale";
import * as enums from "../../utils/enums";
import * as iu from "../../utils/imageUtils";
import * as fs from "../../utils/fileServer";
    
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    log("--------enter pld agent----------");
    let { cmd, timeStamp, uid, ukey, params } = req.body;
    log(JSON.stringify(req.body));

    // 记录时间戳，防止用户使用代理时的重试机制导致重入
    if(timeStamp){
        log("timeStamp is: " + timeStamp);
        const ts = await global.globalGetAndDel("WORKFLOW_AGENT", timeStamp.toString());
        log("TS:" + ts);
        if(ts){
            log("Found timeStamp: " + timeStamp);
            // 等待
            // await new Promise((resolve) => setTimeout(resolve, 5000));            
            return; // res.status(enums.resStatus.expErr).json("错误重入");
        }else{
            // 没有时间戳记录，说明是第一次进入
            await global.globalSet("GENERATE", timeStamp.toString(), "true");
        }
    }
    
    // 处理用户登录
    let userEmail:string;
    let user:any;
    
    if(uid){
        user = await prisma.user.findUnique({
            where: { id: uid },
        });
        if(!user || user.actors.indexOf("api")<0){
            return res.status(enums.resStatus.expErr).json("非法的API调用");
        }else{
            userEmail = user.email;
        }
    }else{
        return res.status(enums.resStatus.expErr).json("非法的API调用，请先联系注册API调用权限");
    }
    
    if(user){
        params.email = userEmail;
    }else{
        return res.status(enums.resStatus.expErr).json("没有查询到API注册用户，请先联系注册API调用权限");
    }

    
    try { 
        switch(cmd){
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            case "TAKE_PHOTO_MODEL": {
                let outputWidth = getWidthOfDrawRatio(params.drawRatio);
                let outputHeight = getHeightOfDrawRatio(params.drawRatio);
                let poseImage = params.refImage;

                const model = await prisma.model.findUnique({
                    where:{id:params.modelId},
                    select:{code:true}
                });
                if(!model){
                    return res.status(enums.resStatus.expErr).json("未知的拍照套系");
                }
                log("step 1 用套系Lora生成人物的套系照片");                
                params.inference = "fofr / realvisxl-v3-multi-controlnet-lora";
                params.func = "lora";
                params.modelurl = model.code;
                params.imageUrl = poseImage; 
                params.timeStamp = Date.now();
                params.access = "PRIVATE";
                params.waitForUploadGenerated = true;
                params.width = outputWidth;
                params.height = outputHeight;
                const step1 = await callReplicateAndWaitResult( params);
                if(step1?.result && step1?.result?.genRoomId){
                    // 中间结果抛弃给TRASH_ACCOUNT
                    await throwToTrash(step1.result.genRoomId);                        
                }    
                log("STEP1:" + JSON.stringify(step1));
                if (step1.status !== enums.resStatus.OK) {
                    return res.status(step1.status).json(step1.result);
                }
                
                log("step 2 替换客户脸");
                let step2 = await swapFace(params.faceImage, step1.result.generated, userEmail);
                await prisma.room.update({ where:{ id:step2.result.genRoomId }, data:{ model: model.code } }); // 设置当前的modelcode

                return res.status(step2.status).json(step2.result);
            }
            
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            case "TAKE_PHOTO_QUICK":{
                const step1 = await swapFace(params.faceImage, params.refImage, userEmail);
                if(params.modelId){
                    const model = await prisma.model.findUnique({where:{id:params.modelId}, select:{code:true}});
                    if(model && model.code){
                        await prisma.room.update({ 
                            where:{ id:step1.result.genRoomId }, 
                            data:{ model: model.code } 
                        });                         
                    }else{                        
                        return res.status(enums.resStatus.expErr).json("未知的拍照套系");
                    }
                }
                return res.status(step1.status).json(step1.result);                
            }

            case "QUERY_MODEL_BY_SITE": {
                debug.log("---QUERY_MODEL_BY_SITE---");
                if(params.site){
                    let models:any[] = [];
                    let pageCount = 0;
                    let rowCount = 0;
                    let pageSize = params.pageSize;
                    let currentPage = params.currentPage;
                    
                    let whereTerm:any = {
                        func: "lora",
                        access: "PUBLIC",
                        status: "FINISH",
                        labels: {
                            contains: params.site
                        }                    
                    };
    
                    rowCount = await prisma.model.count({where:whereTerm});
                    pageCount = Math.ceil(rowCount / pageSize);        
                    models = await prisma.model.findMany({
                        where: whereTerm,
                        take: pageSize,
                        skip: (currentPage-1) * pageSize,
                        orderBy: [
                          { sysScore: 'desc' },
                          { runtimes: 'desc' },                      
                          { createTime: 'desc' }
                        ],
                        select:{
                            id: true,
                            code: true,
                            name: true,
                            coverImg: true,
                            price: true
                        }
                    });
                    debug.log("Model rows:" + models.length);
                    
                    return res.status(200).json({pageCount, models});   
                }else{
                    return res.status(200).json({pageCount:0, models:[]});   
                }
            }

            case "QUERY_SAMPLE_BY_MODEL": {
                debug.log("---QUERY_SAMPLE_BY_MODEL---");

                if(params.modelId){
                    let pageSize = params.pageSize;
                    let currentPage = params.currentPage;                
                    const model = await prisma.model.findUnique({where:{id:params.modelId}, select:{code:true}});
                    if(!model){
                        return res.status(enums.resStatus.expErr).json("未知的拍照套系");
                    }
                    
                    let whereTerm:any = {
                        status: "SUCCESS",
                        sysScore : { gt: 3 },
                        model: model?.code,
                        resultType: "IMAGE",
                        
                    };
                    const roomCount = await prisma.room.count({where:whereTerm});
                    const pageCount = Math.ceil(roomCount / pageSize);         
                    const rooms = await prisma.room.findMany({
                        where: whereTerm,
                        take: pageSize,
                        skip: (currentPage-1) * pageSize,
                        orderBy: {
                            createdAt: 'desc',
                        },
                        select: {
                            outputImage: true,
                            id: true,
                        }                    
                    });
                    debug.log("-----updateRoom gotopage-----");
                    debug.log("current page:", currentPage);
                    debug.log("page count:", pageCount);
                    debug.log("page items:", rooms.length);
                    return res.status(200).json({pageCount, rooms});
                }else{
                    return res.status(200).json({pageCount:0, rooms:[]});
                }
            }

        }
        return res.status(enums.resStatus.expErr).json("未知的工作流命令");

    } catch (err) {
        error(err);
        res.status(500).json("接口发生未知错误，请查看后台日志");
    }
}

