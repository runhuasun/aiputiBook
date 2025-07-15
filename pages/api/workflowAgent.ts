import { User, Model} from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import * as Fetcher from "node-fetch";

import prisma from "../../lib/prismadb";
import {useCredits, returnCredits} from "./creditManager";

import {getWidthOfDrawRatio, getHeightOfDrawRatio} from "../../components/DrawRatioSelector";

import {log, warn, error} from "../../utils/debug";
import { authOptions } from "./auth/[...nextauth]";
import * as global from "../../utils/globalUtils";
import { moveToFileServer, uploadDataToServer, uploadToReplicate } from "../../utils/fileServer";
import {translate} from "../../utils/localTranslate";
import {config, system, defaultImage} from "../../utils/config";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {BaseCVService} from "../../ai/cv/BaseCVService";
import * as AIS from "../../ai/AIService";
import {getRedirectedUrl, getPathOfURL, isURL, getBase64Code, addWatermark, getFileServerOfURL} from "../../utils/fileUtils";
import {callAPI} from "../../utils/apiUtils";
import {AliCVService} from '../../ai/cv/AliCVService';
import {AliyunTTS} from '../../ai/tts/AliyunTTS';

import * as debug from "../../utils/debug";
import { generateRectMaskImage, generateMaskImageFromPNG } from "../../utils/imageUtils";
import * as vu from "../../utils/videoUtils";
import { moveToUploadio } from "../../utils/bytescale";
import * as enums from "../../utils/enums";
import * as iu from "../../utils/imageUtils";
import * as fs from "../../utils/fileServer";
import * as fc from "../../utils/funcConf";
import * as monitor from "../../utils/monitor";
import * as au from "../../utils/audioUtils";

    
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    log("--------enter workflow agent----------");
    let { cmd, timeStamp, uid, ukey, params, priceUnits } = req.body;
    log(JSON.stringify(req.body));

    // 记录时间戳，防止用户使用代理时的重试机制导致重入
    if(timeStamp){
        log("timeStamp is: " + timeStamp);
        const ts = await global.globalGetAndDel("WORKFLOW_AGENT", timeStamp.toString());
        log("global中的记录:" + ts);
        if(ts){
            log("Found timeStamp: " + timeStamp);
            // 等待
            // await new Promise((resolve) => setTimeout(resolve, 5000));      
            error("workflowAgent.ts发生错误重入！！！！！！！！！！！！！！！！！！！！！！已经返回unexpRetryErr");
            return res.status(enums.resStatus.unexpRetryErr).json("错误重入");
        }else{
            // 没有时间戳记录，说明是第一次进入
            await global.globalSet("WORKFLOW_AGENT", timeStamp.toString(), "true");
        }
    }
    
    // 处理用户登录
    const session = await getServerSession(req, res, authOptions);
    let userEmail = null;
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
        if(params?.email){
            userEmail = params.email;
        }else if (session?.user?.email) {
            userEmail = session.user.email;
        }
        if(!userEmail){
            return res.status(enums.resStatus.expErr).json("新用户请先点右上角[登录]按钮，极简注册哦！");
        }
        user = await prisma.user.findUnique({
            where: {
                email: userEmail,
            },
        });
    }
    
    if(user){
        params.email = userEmail;
    }else{
        return res.status(enums.resStatus.expErr).json("新用户请先点右上角[登录]按钮，极简注册哦！");
    }

    // 处理价格扣费
    // 价格和功能、模型、子功能相关
    // let price = 0;
    // price = getPriceByCMD(config, cmd, model, priceUnits);

    monitor.logApiRequest(req, res, session, user, {cmd, params});
    
    try { 
        switch(cmd){

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////
            case "createSpeaker": {
                let modelId:string;
                const exist = await prisma.model.findMany({
                    where: { name: params.name }
                });
                if(exist && exist.length>0){
                    return res.status(enums.resStatus.expErr).json(`您的音色名字已经存在，请换一个名字！`);
                }
                
                const vocals = params.cleanVoice ? (await au.extractVocals(params.dataset, "T")) : params.dataset;                
                if(vocals){
                    switch(params.trainer){
                        case "aliyun_cosyvoice_v1":
                            const tts = new AliyunTTS();
                            const voiceId = await tts.cloneSpeaker(vocals);
                            if(voiceId){
                                const m = await prisma.model.create({
                                    data:{
                                        code: `ALIYUN***cosyvoice-v1-${voiceId}`,
                                        name: params.name,
                                        func: "voice",
                                        status: "FINISH",
                                        trainSrv: "aliyun_cosyvoice_v1",
                                        datasets: params.dataset,
                                        userId: user.id,
                                        usedCredits: 0,
                                        proId: voiceId,
                                        price: 5,
                                        url: "",
                                        proMsg: "",
                                        coverImg: "",
                                        aiservice: "ALIYUN",
                                        language: "zh",
                                        labels:"",
                                        theme: "CUSTOM",
                                        channel: "PUBLIC",
                                        access: "PRIVATE"
                                    }
                                });
                                if(m){
                                    let demo = `这是${params.name}的声音效果！你对这个声音效果满意吗？轻轻的我走了，正如我轻轻的来，我挥一挥衣袖，不带走一片云彩...`;
                                    const vData = await tts.textToVoice(demo, m.code);
                                    if(vData && typeof vData === 'string' && vData.trim() !== ''){
                                        const remoteFile = await uploadDataToServer(Buffer.from(vData, 'base64'), "audio/x-mpeg", "temp.mp3");
                                        if(remoteFile){
                                            await prisma.model.update({
                                                data: { 
                                                    desc: remoteFile
                                                },
                                                where:{
                                                    id: m.id
                                                }
                                            });
                                            log("为" + m.code + '(' + m.name + ')添加样本语音：' + remoteFile);
                                            const result = {
                                                id: m.id,
                                                generated: remoteFile
                                            }
                                            return res.status(enums.resStatus.OK).json(result);                                        
                                        }
                                    }                              
                                }
                            }
                    }
                }
                return res.status(enums.resStatus.expErr).json(`克隆声音时发生意外失败！`);
            }
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////
            case "TRAIN_LORA_BY_ALBUM": {
                if(params.fileMode == "ALBUM" || params.fileMode == "FILE"){
                    debug.log("pre count");
                    const fileCount = await prisma.albumRoom.count({ where:{
                        albumId: params.albumId,
                        status: { 
                            not: enums.albumStatus.deleted
                        }
                    } });
                    if(fileCount < 10){
                        return res.status(enums.resStatus.expErr).json(`至少需要10张照片，而相册中只有${fileCount}张照片。`);
                    }

                    debug.log("STEP1: 压缩相册成为一个ZIP");
                    const step1 = await callAPI(config.website+"/api/albumManager", {
                        cmd:"ZIP", 
                        email: params.email,
                        id:params.albumId,
                        waitForZipped: true
                    });
                    if (step1.status !== enums.resStatus.OK) {
                        return res.status(step1.status).json(step1.result);
                    }else{
                        params.inputFiles = step1.result.zippedFile;
                    }
                }

                debug.log("STEP2: 启动训练任务");
                const step2 = await callAPI(config.website+"/api/trainLoRA", params);
                return res.status(step2.status).json(step2.result);                    
            }


            default: {
                // 转发调用
                params.timeStamp = Date.now();
                params.email = userEmail;
                
                const step1 = await callAPI(config.website+"/api/generate", params);
                return res.status(step1.status).json(step1.result);                                
            }
        }
            
        return res.status(enums.resStatus.expErr).json("未知的工作流命令");

    } catch (err) {
        error(err, JSON.stringify(req.body));
        res.status(enums.resStatus.expErr).json("当前用户太多，服务器过于繁忙发生错误，请稍后重试！本次运行的" + config.creditName + "已经被退回。");
    }
}








export async function callReplicateAndWaitResult(params:any, onLongTimeWait?:()=>void){
    let ret:any;
    try{
        if(!params.timeStamp){
            params.timeStamp = Date.now();
        }     
        if(!params.waitResultRetryTimes){
            params.waitResultRetryTimes = 10;
        }
        ret = await callAPI(config.website+"/api/generate", params);
    }catch(e){
        debug.error("callReplicateAndWaitResult.callAPI Exception:", e);
    }

    debug.log(`callReplicateAndWaitResult wait ${params.waitResultRetryTimes} times over!`);
    //debug.log(`callReplicateAndWaitResult ret ${ret}`);        
    //debug.log(`callReplicateAndWaitResult ret.status ${ret?.status}`);    
    debug.log(`callReplicateAndWaitResult ret.result ${JSON.stringify(ret?.result)}`);        
    // 如果任务创建成功，但是结果还没有被生成出来
    if(ret && (ret.status == enums.resStatus.waitForResult || ret.status == enums.resStatus.unexpRetryErr) && ret?.result?.genRoomId){
        if(onLongTimeWait){
            debug.log(`callReplicateAndWaitResult:执行回调onLongTimeWait`);
            onLongTimeWait();
        }

        debug.log(`callReplicateAndWaitResult:开始尝试从数据库中读取状态`);                    
        for(let i=0; i<100; i++){
            debug.log(`callReplicateAndWaitResult:第${i}次尝试`);            
            const room = await prisma.room.findUnique({
                where: {id: ret.result.genRoomId },
                select: {outputImage: true, status: true}
            });
            if(room){
                if((room.status == enums.roomStatus.success) || (room.status == enums.roomStatus.midsucc)){
                    ret.result.generated = room.outputImage;
                    ret.status = enums.resStatus.OK;
                    break;
                }else if(room.status == enums.roomStatus.failed){
                    ret.result.generated = room.outputImage;
                    ret.status = enums.resStatus.unknownErr;
                    break;
                }else{
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }else{
                break;
            }
        }
    }

    return ret;
}


export async function throwToTrash(roomId: string){
    return await prisma.room.update({ where:{ id:roomId }, data:{ userId:system.users.trashId } });
}


export async function advanceSwapFace(faceImage:string, poseImage:string, userEmail:string, 
                                      option?:{ freeOfCharge?:boolean, roomId?:string, doNotUploadToServer?:boolean, isIntermediateStep?:boolean}){
    // 标准换脸只换五官，加入这个步骤是为了学习脸型
    const res = await callReplicateAndWaitResult( {
        func: "omni-zero-fal", 
        access: "PRIVATE",
        email: userEmail,
        waitForUploadGenerated : true,
        doNotUploadToServer: option?.doNotUploadToServer,
        isIntermediateStep: option?.isIntermediateStep,
        freeOfCharge: option?.freeOfCharge,  
        roomId: option?.roomId,
        params: {
            inputText: "a person",
            prompt: "a person",
            base_image: poseImage,
            base_image_strength: 0.5,                            
            composition_image: poseImage,
            composition_image_strength: 1,
            style_image: poseImage,
            style_image_strength: 1,
            identity_image: faceImage,
            identity_image_strength: 1,
            depth_image: poseImage,
            depth_image_strength: 1,
        }
    });

    if(res.status != enums.resStatus.OK) {
        return res;
    }else{
        await throwToTrash(res.result.genRoomId);

        // 第一步有可能会获得一个放大的结果，所以要把尺寸缩小
        const metaPoseImage = await iu.getImageMeta(poseImage);
        const metaResImage = await iu.getImageMeta(res.result.generated);
        let resImage = res.result.generated;
        if(metaPoseImage && metaPoseImage.width && metaPoseImage.height && 
           metaResImage && metaResImage.width && metaResImage.height){
            if(metaResImage.width > metaResImage.height && metaResImage.width > metaPoseImage.width){
                resImage = await iu.resizeImage(resImage, metaPoseImage.width);
            }else if(metaResImage.width < metaResImage.height && metaResImage.height > metaPoseImage.height){
                resImage = await iu.resizeImage(resImage, metaPoseImage.height);
            }
            
        }
        return await swapFace(faceImage, resImage, userEmail);
    }
    return res;
}

export async function swapFace(faceImage:string, poseImage:string, userEmail:string, 
                               option?:{ freeOfCharge?:boolean, roomId?:string, doNotUploadToServer?:boolean, isIntermediateStep?:boolean} ){
    let func = "faceswap";
    const wh = 50; // watermark height;
    
    // 执行换脸操作
    const res = await callReplicateAndWaitResult( {    
        func,
        timeStamp : Date.now(),
        access : "PRIVATE",
        email: userEmail,
        waitForUploadGenerated : true,
        doNotUploadToServer: option?.doNotUploadToServer,
        isIntermediateStep: option?.isIntermediateStep,
        freeOfCharge: option?.freeOfCharge,
        roomId:option?.roomId,
        params : { 
            swap_image: faceImage,
            target_image: poseImage
        }
    });    
    return res;
}

// freeOfCharge
export async function refine(imageURL:string, userEmail:string, roomId?:string){
    const res = await callReplicateAndWaitResult( {
        func: "zoomIn",
        email: userEmail,
        freeOfCharge: true,
        roomId,
        params: {
            image: imageURL, 
            codeformer_fidelity: 1,            
            background_enhance: true, 
            face_upsample: true,
            upscale: 1,
        }
    });   

    return res;
}

export async function advanceRefine(imageURL:string, userEmail:string, roomId?:string, prompt?:string){
    const res = await callReplicateAndWaitResult( {
        func: "simImage",
        roomId,
        freeOfCharge: true,
        isIntermediateStep: true,
        doNotUploadToServer: true,
        email: userEmail,
        access:"PRIVATE",
        params:{
            imageURL,
            prompt: prompt || "a photo",
            promptStrength: 0.4
        }
    });
    return res;
}


async function createNewRoom(funcCode:string, userEmail:string, price:number, status?:string){
    try{
        return await prisma.room.create({
            data: {
                replicateId: String(Date.now()),
                user: {
                    connect: {
                        email: userEmail,
                    },
                },
                inputImage: "",
                outputImage: defaultImage.roomCreating,
                status: status || enums.roomStatus.creating,
                zoomInImage: "",
                prompt: "",
                func: funcCode,
                usedCredits: price,
                model: "",
                access: "PRIVATE", // 图片缺省都是私有的，除非前端特别要求
                viewTimes: 0, // Math.floor(Math.random() * 10) + 1, // 只有查看数量是可以给一个初始值的
                dealTimes: 0, // 牵涉到结算，所以必须真实
                likes: 0,
                aiservice: "",
                predicturl: "",
                bodystr: "",
                seed: null,
                resultType: ""
            },
        });
    }catch(e){
        error("createNewRoom:", e);
    }
}


async function setStatus(res:any, status:number, result:any, room:any, user:any, price:number){
    log("setStatus:" , status, JSON.stringify(result), JSON.stringify(room), JSON.stringify(user), price);
    res.status(status).json(result);
    try{
        if( room && res.status != enums.resStatus.OK ){
            error("setStatus: ", res?.status);
            await prisma.room.update({ 
                where:{ id:room.id }, 
                data:{ 
                    status: enums.roomStatus.failed,
                    outputImage: `${status}: ${result}`,
                } 
            });      
        }
        if( (res.status != enums.resStatus.OK) && (res.status != enums.resStatus.NSFW) ){
            returnCredits(user, price, enums.creditOperation.CREATE_ROOM, room.id);             
        }
    }catch(e){
        error("workflowAgent setStatus exception:", e, status, JSON.stringify(result), JSON.stringify(room), JSON.stringify(user), price);
    }
}

//    const poseImageMeta = await iu.getImageMeta(poseImage);
//    if(poseImageMeta && poseImageMeta.height && poseImageMeta.width && poseImageMeta.height > 500){
//        func = "faceswap_with_watermark";
//    }


/*
    if(func == "faceswap_with_watermark" && res.status == enums.resStatus.OK && res.result.generated && poseImageMeta && poseImageMeta.height && poseImageMeta.width){
        
        // 非阿里云图片装到阿里云        
        if(!fs.inBucket(poseImage)){ 
            poseImage = await moveToFileServer(poseImage, "T");
        }
        // 从原图上截取水印区域的图像        
        let pathOfRectImage = getPathOfURL(poseImage) +
                        `?x-oss-process=image/crop,x_${0},y_${poseImageMeta.height-wh},w_${poseImageMeta.width},h_${wh}`;         
        if(pathOfRectImage && pathOfRectImage.startsWith("/")){
            pathOfRectImage = pathOfRectImage.substring(1);
        }
        const base64Url = Buffer.from(pathOfRectImage!).toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
        // 把水印区域图像贴到新图上        
        let finalImage = `${res.result.generated}?x-oss-process=image/watermark,image_${base64Url},g_nw,x_${0},y_${poseImageMeta.height-wh}`;
   
        // 返回合并后的结果
        finalImage = await moveToFileServer(finalImage, "U");

        // 更新生成结果
        await prisma.room.update({ 
            where:{ id:res.result.genRoomId }, 
            data:{ outputImage: finalImage} 
        });
    
        res.result.generated = finalImage;
    }
*/
