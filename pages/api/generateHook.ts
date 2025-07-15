import fs from 'fs'
import path from 'path'
import * as Fetcher from "node-fetch";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { Room } from "@prisma/client";
import {useCredits, returnCreditsById} from "./creditManager";
import * as debug from "../../utils/debug";
import { moveToFileServer, uploadDataToServer } from "../../utils/fileServer";
import {config, defaultImage} from "../../utils/config";
import {translate} from "../../utils/localTranslate";
import {isURL, getRedirectedUrl, addWatermark, getFileServerOfURL} from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import * as dbLogger from "./dbLogger";


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    log("------------enter generate hook---------------");
    
    res.status(200).json({ message: "OK" });
    
    // @ts-ignore
    await doHook(req);  
}



async function doHook(req: NextApiRequest){
    
    const result = req.body;
    debug.log(JSON.stringify(result));
    
    // 回调可能是五种种状态
    // starting: the prediction is starting up. If this status lasts longer than a few seconds, then it's typically because a new worker is being started to run the prediction.
    // processing: the model is currently running.    
    // succeeded: the prediction completed successfully.
    // failed: the prediction encountered an error during processing.
    // canceled: the prediction was canceled by the user.
    if( result?.status != "succeeded" && result?.status != "failed" && result?.status != "canceled" // REP
       && result?.status != "OK" && result?.status != "ERROR" // fal
      ){
        // 只有三种状态允许继续
        return;
    }
    
    debug.log("waiting 3 seconds to avoid conflict");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    //log(result);
    //log(JSON.stringify(result));
    
    let genRooms:any = null;            
    let room:any = null;    
    let imgUrl = "FAILED";
    try {
        
        // 找到对应的记录
        let retry = 0;
        let replicateId:string = result.id || result.request_id;
        debug.log("replicatedId in generateHook:", replicateId);

        // 防止回调太快，主线程还没有生成图片记录
        while(retry++ < 3){
            debug.log("generate hook：第" + retry + "次查询记录");
            genRooms = await prisma.room.findMany({
                where: {
                    replicateId,
                },
                take: 1,
            });
            debug.log("generate hook found rooms：", JSON.stringify(genRooms));
            if(genRooms && genRooms.length > 0){
                break;
            }else{
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    
        
        if(genRooms && genRooms.length > 0){
            room = genRooms[0];
            let func = room.func;

            // 已经回调过的或者已经失败的记录不再执行回调
            if(room.replicateId == replicateId && room.callbacked == "N" && room.status != enums.roomStatus.failed && room.status != enums.roomStatus.success){
                // 先把状态置为'Y'，防止二次进入
                await prisma.room.update({
                    where: {
                        id: room.id,
                    },
                    data: {
                        callbacked: "Y",
                    }
                });
                
                // replicate返回的是succeeded 
                // SDAPI返回的是success
                
                //log("generate Hook get result" + JSON.stringify(result));
                //      log("result:" + result);
                // xiankgx/face-swap使用不同的错误标记方式
                let isFailed:boolean = false;
                let failedMsg:string = "";

                switch(room.aiservice){
                    case "REP":
                        isFailed = result?.output?.status == "failed" || result?.output?.status == "canceled";
                        failedMsg = result?.output?.msg || result?.error as string || "";
                        break;

                    case "FAL":
                        isFailed = result?.status != "OK";
                        failedMsg = result?.payload?.detail?.msg || result?.payload?.detail?.[0]?.msg || result?.payload?.detail;
                        break;

                }
                
                if(!isFailed && ( (result.output && (result.status == "succeeded" || result.status == "success")) || (result.payload && result.status == "OK") )){
                    // 不同模型对应的输出图片位置不一样
                    // let i = ( func=="deco" || func=="draft" || func=="garden" ) ? 1 : 0;
                    switch(room.aiservice){
                        case "REP":                    
                            if(Array.isArray(result?.output)){
                                // ahmdyassr/mask-clothing:1c60fd50bf0e5fb2ccbd93403cf163d5586ab8939139167ac82d29ebb047e84f                        
                                if(result.version == "1c60fd50bf0e5fb2ccbd93403cf163d5586ab8939139167ac82d29ebb047e84f"){
                                    imgUrl = result.output[0];
                                }else if(result.version == "9451bfbf652b21a9bccc741e5c7046540faa5586cfa3aa45abc7dbb46151a4f7"){
                                    imgUrl = result.output[0].image;
                                }else{
                                    imgUrl = result.output[result.output.length-1];
                                }
                            }else{
                                imgUrl = result.output?.image as string || result.output?.media_path as string || result.output?.audio_output as string || result.output as string;
                            }
                            break;

                        case "FAL":
                            imgUrl = result?.payload?.video?.url || result?.payload?.image?.url || result?.payload?.images[0]?.url;
                            break;
                    }
                    
                    log(room?.id, "RESULT in HOOK, imgUrl is :" + imgUrl);
                    
                    // 如果图片还没有上传的文件服务器
                    // 把图片上传到文件服务器
                    // 这通常是用户生成图片的时候超时异常导致的
                    if(!room.outputImage || getFileServerOfURL(room.outputImage) != process.env.FILESERVER || room.outputImage.indexOf(defaultImage.roomCreating)>=0 ){
                        log(room?.id, "if it's final step, generate hook need to upload the output image to Filserver......");
                        if(isURL(imgUrl) && !(room.status == enums.roomStatus.midstep || room.status == enums.roomStatus.midsucc)){
                            let uploadImg = await moveToFileServer(imgUrl);
                            if(uploadImg){
                                log("upload image in generate hook success");
                                imgUrl = uploadImg;
                                log("moved to upload.io：" + imgUrl);                            
                            }else{
                                log("move to upload.io failed!!!");
                            }
                        }
                    }else{
                        // 如果之前已经上传过就用之前上传的图片
                        imgUrl = room.outputImage;
                        log(room?.id, "still using old image:" + imgUrl);
                    }
            
                    // 如果有seed，就记录seed;
                    let seed = null;
                    if(room.aiservice == "REP"){
                        try{
                            const lines = result.logs.split("\n");
                            for(const line of lines){                            
                                if(line.startsWith("Using seed:")){
                                    seed = line.substr(11).trim();                                    
                                    log(room?.id, `found seed: ${seed}`);
                                    break;
                                }
                            }
                        }catch(e){
                            error(room?.id, "get seed from replicate error:", e);                
                        }
                    }
                    
                    // 如果上传失败还是记录AI服务器上的图片地址
                    // 但是AI服务器会定期删除图片
                    // 无论何种情况，只要生成了就更新图片生成结果
                    // log("Exist Room found in generateHook:", JSON.stringify(room));

                    let bigBody:any;
                    if(room.bodystr){
                        bigBody = JSON.parse(room.bodystr);                    
                    }
                    let thisStep:any;
                    if(!bigBody){
                        bigBody = {};
                    }
                    if(!bigBody.STEPS){
                        bigBody.STEPS = [];
                    }
                    log(room?.id, "Exist Room bodystr found in generateHook:", JSON.stringify(bigBody));
                    
                    for(const step of bigBody.STEPS){
                        if(step.REP_ID == result.id){
                            thisStep = step;
                            thisStep.OUTPUT_BODY = result;                            
                            break;
                        }
                    }
                    
                    const roomData:any = {
                        bodystr: JSON.stringify(bigBody),
                        outputImage: imgUrl,
                        status: (room.status == enums.roomStatus.midstep || room.status == enums.roomStatus.midsucc) ? enums.roomStatus.midsucc : enums.roomStatus.success,
                        seed: seed ? seed : null,
                    };
                    if(func == "voiceTranslate"){
                        roomData.prompt = result.output?.text_output;
                    }
                    const newRoom = await prisma.room.update({
                        where: {
                            id: room.id,
                        },
                        data: roomData
                    });
                    //log("Room updated in generateHook:", JSON.stringify(newRoom));

                    /*
                    // 如果一切正常就开始给创作者分账
                    // 用户分账金额 = 取整(模型的价格/2)
                    if(func == "lora"){
                        // await accountingForLora(room, imgUrl);
                    }else if(rooms.includes(func as roomType)){
                        // await accountingForPrompt(room);
                    }else if(func == "zoomIn"){
                        // await accountingForZoomIn(room);
                    }
                    */
          
                
                }else{
                    // 处理失败情况
                    error(room?.id, `generateHook dealing with error: ${failedMsg}`);            
                    let outputMsg = "AI服务器执行任务失败，原因未知，请稍后重试！"; // 本次运行的" + config.creditName + "已经被退回。";                    
                    try{
                        let NSFW = false;
                        if(result?.status == "canceled"){
                            outputMsg = `AI任务在服务器端被取消！`; // 本次运行的${config.creditName}已经被退回。`;
                        }else if(failedMsg && ( failedMsg.includes("NSFW") || failedMsg.includes("sensitive") )){
                            outputMsg = "您的内容不符合规范，请避免使用过于敏感的提示词或图片、视频！";
                            NSFW = true;
                        }else if(failedMsg && failedMsg.indexOf("CUDA out of memory") >= 0){
                            outputMsg = "需要处理的图片或视频尺寸太大，请试着减少尺寸或缩短视频再试试。"; // 本次运行的" + config.creditName + "已经被退回。";
                        }else if(failedMsg && failedMsg.toLowerCase().indexOf("no face") >= 0){
                            outputMsg = "在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 不要使用只包含头部的照片。如果在原图中选择了区域，请试着扩大您选择的区域。"; //  本次运行的" + config.creditName + "已经被退回。";
                        }else if(failedMsg == "Failure to pass the risk control system"){
                            outputMsg = "生成的内容不适合展示，请避免使用过于敏感的提示词，或者使用涉及色情、恐怖等不当内容的照片。";
                        }else{
                            if(failedMsg){
                                outputMsg = `${await translate(failedMsg, "en", "zh")}
                                没有生成任何结果。`; // 本次运行的${config.creditName}已经被退回。`;
                            }else{
                                outputMsg = `没有生成任何结果。`; // 本次运行的${config.creditName}已经被退回。`;
                            }
                        }
                    }catch(err){
                        error(room?.id, "generate Hook error: ", err);
                    }finally{                        
                        // 更新图片失败信息
                        const newRoom = await prisma.room.update({
                            where: {
                                id: room.id,
                            },
                            data: {
                                outputImage: outputMsg,
                                status: enums.roomStatus.midfail,
                            }
                        });
                    }
                }   
            }
        }
    }catch(err){
        error(room?.id, "generate Hook error: ", err);
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
