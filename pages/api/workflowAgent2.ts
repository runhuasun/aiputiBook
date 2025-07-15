import { Prisma, Room, User, Model} from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import * as Fetcher from "node-fetch";

import prisma from "../../lib/prismadb";
import {useCredits, returnCredits, giveUserModelIncome} from "./creditManager";

import {getWidthOfDrawRatio, getHeightOfDrawRatio} from "../../components/DrawRatioSelector";

import * as debug from "../../utils/debug";
import { authOptions } from "./auth/[...nextauth]";
import * as global from "../../utils/globalUtils";
import { moveToFileServer, uploadDataToServer, uploadToReplicate } from "../../utils/fileServer";
import {translate} from "../../utils/localTranslate";
import {config, system, defaultImage} from "../../utils/config";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {BaseCVService} from "../../ai/cv/BaseCVService";
import * as AIS from "../../ai/AIService";
import {getPathOfURL, isURL, isInUS, isBase64Image, getBase64Code, addWatermark, getFileServerOfURL, getFileTypeByURL, getVideoPoster, checkURLExists} from "../../utils/fileUtils";
import {callAPI} from "../../utils/apiUtils";
import {callAPIinServer} from "../../utils/apiServer";
import {AliCVService} from '../../ai/cv/AliCVService';
import * as AIService from "../../ai/AIService";
import {TencentTTS} from '../../ai/tts/TencentTTS';

import * as auc from "./appUserConfig";
import * as dbLogger from "./dbLogger";

import { generateRectMaskImage, generateMaskImageFromPNG } from "../../utils/imageUtils";
import * as vu from "../../utils/videoUtils";
import { moveToUploadio } from "../../utils/bytescale";
import * as enums from "../../utils/enums";
import * as iu from "../../utils/imageUtils";
import * as tu from "../../utils/textUtils";
import * as fs from "../../utils/fileServer";
import * as fc from "../../utils/funcConf";
import {getPricePack} from "../../utils/funcConf";
import * as monitor from "../../utils/monitor";
import * as face from "../../utils/faceUtils";
import * as audit from "../../utils/auditUtils";
import * as au from "../../utils/audioUtils";
import * as mt from"../../utils/modelTypes";
import * as fu from "../../utils/fileUtils";
import * as du from "../../utils/dateUtils";
import * as grade from "../../utils/grade";
import {enterWaitingList, leaveWaitingList} from "../../utils/threadUtils";
import * as lt from "../../utils/dropdownTypes";


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// workflow 调度控制代码
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 先定义类型（放在文件顶部或合适的位置）
interface TempFile {
  fileType: "URL" | "PATH";
  file: string;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    
    debug.log("--------enter workflow agent 2----------");
    let { 
        cmd, 
        timeStamp, // 用来防止代理重试进入的时间戳
        email, 
        params, 
        preRoomId, // 用来生成当前Room的前序Room
        priceModel, // 用来计算价格的模型，每个功能的数据结构可能都不一样
        priceUnits, // 用来处理按时长、或文件大小计算价格的参数
        needZoomIn, // 输出结果是否需要放大
        uid, ukey, // 外界访问的API专用，内部调用不要使用
        roomId, // 只在redoRoom的时候用，其它不需要
 //       putQRCode, // 如果需要加入官方二维码就传递True
    } = req.body;
    let putQRCode = true;
  
    debug.log(JSON.stringify(req.body));

    // 记录时间戳，防止用户使用代理时的重试机制导致重入
    if(timeStamp){
        const ts = await global.globalGetAndDel("WORKFLOW_AGENT", timeStamp.toString());
        if(ts){
            debug.error("workflowAgent2.ts发生错误重入！！！！！！！！！！！！！！！！！！！！！！已经返回unexpRetryErr");
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
        user = await prisma.user.findUnique({ where: { id: uid } });
        if(!user || user.actors.indexOf("api")<0){
            return res.status(enums.resStatus.expErr).json("非法的API调用");
        }else{
            userEmail = user.email;
        }
    }else{
        if(email || params?.email){
            userEmail = params.email || email;
        }else if (session?.user?.email) {
            userEmail = session.user.email;
        }
        if(!userEmail){
            return res.status(enums.resStatus.unauthErr).json("新用户请先点左下角[登录]按钮，极简注册哦！");
        }
        user = await prisma.user.findUnique({ where: { email: userEmail } });
    }
    
    if(user){
        params.email = userEmail;
    }else{
        return res.status(enums.resStatus.unauthErr).json("新用户请先点左下角[登录]按钮，极简注册哦！");
    }

    // 处理价格扣费
    // 价格和功能、模型、子功能相关
    // let price = 0;
    // price = getPriceByCMD(config, cmd, model, priceUnits);

    monitor.logApiRequest(req, res, session, user, {cmd, params});
    const modelCode = priceModel || params.func || params.modelurl || params.model;
    
    const {price, unpaidLimit, notVIPLimit} = getPricePack(config, cmd, modelCode, priceUnits, user);
    
    debug.log(`workflow Agent2: 本次任务使用的价格是：${price}，免费试用：${unpaidLimit}次`);
    let auditResult = "";
  
    if(roomId){
         debug.log("starting a workflow redo by administrator............."); 
    }else{
        // 处理点数不足情况
        if(user.credits < price){
            const msg = `您的` + config.creditName + `不够了，请先去购买一些，再来尝试哦！`;
            debug.log(msg);
            return res.status(enums.resStatus.lackCredits).json(msg);
        }  
        
        // 处理未付费用户限制
        if(unpaidLimit || notVIPLimit){
            if(user.boughtCredits < 1){ // unpay
                if(unpaidLimit && unpaidLimit < 0){
                    return res.status(enums.resStatus.paidOnly).json(`未付费用户不能试用该功能，请试用其它功能，或者付费升级后继续使用。谢谢您的试用！`);
                }else if(unpaidLimit && unpaidLimit > 0){
                    const times = await getUserModelUsedTimes(user.id, `${cmd}_${modelCode}`, config.websiteName);
                    if(times >= unpaidLimit){
                        return res.status(enums.resStatus.outofUnpaidLimit).json(`未付费用户只能试用${unpaidLimit}次该功能，请试用其它功能，或者付费升级后继续使用。谢谢您的试用！`);
                    }
                }        
            }
            // 处理非VIP用户限制
            if(user.boughtCredits < grade.grades[1].bc){
                if(notVIPLimit && notVIPLimit < 0){
                    return res.status(enums.resStatus.paidOnly).json(`${grade.grades[0].name}用户不能试用该功能，请试用其它功能，或者付费升级为${grade.grades[1].name}后继续使用。谢谢您的试用！`);
                }else if(notVIPLimit && notVIPLimit > 0){
                    const times = await getUserModelUsedTimes(user.id, `${cmd}_${modelCode}`, config.websiteName);
                    if(times >= notVIPLimit){
                        return res.status(enums.resStatus.outofUnpaidLimit).json(`${grade.grades[0].name}用户只能试用${notVIPLimit}次该功能，请试用其它功能，或者付费升级为${grade.grades[1].name}后继续使用。谢谢您的试用！`);
                    }
                }        
            }
            await addUserModelUsedTimes(user.id, `${cmd}_${modelCode}`, config.websiteName);
        }

        // 进行内容审核
        const imageKeys:{p:string, t:string}[] = [
            {p:'imageUrl', t:"IMAGE"},      
            {p:'imageURL', t:"IMAGE"},
            {p:'target_image', t:"IMAGE"},
            {p:'swap_image', t:"IMAGE"},
            {p:'image', t:"IMAGE"},
            {p:'source', t:'IMAGE'},
            {p:'target', t:'VIDEO'},
            {p:'videoURL', t:'VIDEO'},
        ];
        // 统一遍历
        for(const key of imageKeys){
            const url = params[key.p];
            if(url && isURL(url) && !fs.inOSSBucket(url)){ // 上传的时候已经保证只有安全的文件才会到OSS，所以不在OSS一定是P
                debug.warn("found UNSAFE INPUT URL, set ROOM to P state!!!");
                auditResult = "P";
                break;

              /*
                if(key.t === "IMAGE" && fu.isBase64Image(url)){
                    continue;
                }
                if(fu.isURL(url)){
                    auditResult = await audit.auditURL(url, key.t);
                    // 这几种情况绝对禁止！！！！！
                    if(["Z", "T", "D"].includes(auditResult)){
                        return await res.status(enums.resStatus.inputNSFW).json("您的输入内容不符合规范，无法为您处理！");
                    }
                    if((process.env.AUDIT_CHECK === "STRICT") && user.grade<2){
                        if(auditResult !== "N"){
                            return await res.status(enums.resStatus.inputNSFW).json("您的输入内容不符合规范，无法为您处理！");
                        }
                    }
                }
              */
            }
        }  
    }

   // if((process.env.AUDIT_CHECK === "STRICT") && user.grade<1){
   //     if(auditResult !== "N"){
    //        return await res.status(enums.resStatus.inputNSFW).json("您的输入内容不符合规范，无法为您处理！");
   //     }
   // }
  
    // 获得当前CMD对应功能的配置文件
    const funcObj = fc.getFuncByCode(config, cmd);

    // 创建运行任务的ROOM
    params.resultType = funcObj?.resultType || "IMAGE";
    let room:any = null;
    if(roomId){
        room = await prisma.room.findUnique({where:{id:roomId}});
    }
    if(!room){
        room = await createNewRoom(req.body, userEmail, price, enums.roomStatus.midstep, auditResult);
    }
    
    if(!room){
        return await setErrorStatus(res, enums.resStatus.unExpErr, "未知错误", room, user, price);
    }else{
        params.roomId = room.id;
    }

    if(!roomId){ // 二次任务不扣费，但是失败了会退费，因为大多数情况都是执行到一半的任务才需要二次执行
        // 先扣除
        if(!await useCredits(user, price, enums.creditOperation.CREATE_ROOM, room.id)){
            debug.error(`您的` + config.creditName + `扣除失败，roomId:${room?.id}，请稍后重试！`);
            return await setErrorStatus(res, enums.resStatus.unExpErr, `您的` + config.creditName + `扣除失败，请稍后重试！`, room, user, price);
        }
    }
        
    let finalResult:any;
    params.freeOfCharge = true;
    params.isIntermediateStep = true;
    params.doNotUploadToServer = true;
    params.needAuditResult = true;
    
    // prepare workflow data collection
    const context = {funcObj, res, user, userEmail, room, price, tempFiles:[] as TempFile[]};

    const funcWaitingListName = funcObj.name + (modelCode ? `_${modelCode}_` : `_`) + 'WAITING_LIST';
    // 处理并发数量问题
    if(funcObj?.maxWorkers && funcObj.maxWorkers>0){
        const waitResult = await enterWaitingList(funcWaitingListName, room.id, {
            queryInterval: 3,
            maxLen: 100,
            maxWorkers: funcObj.maxWorkers, 
            maxWaitTime: 86400 // 秒
        });
        if(waitResult != room.id){
            switch(waitResult){
                case enums.resStatus.timeout:
                    return await setErrorStatus(res, waitResult, "当前服务器过于繁忙，您的任务等待超时，请稍后再尝试！", room, user, price);
                case enums.resStatus.tooMuchWaiting:
                    return await setErrorStatus(res, waitResult, "当前功能过于火爆，您的前面有超过100位用户在等待，请稍后再尝试该功能！", room, user, price);
            }
        }
    }
    
    // log(context, "context:", JSON.stringify(context));
    try { 
        //if(cmd in funcs){
            const f = funcs[cmd];
            if(typeof f == "function"){
                finalResult = await f(context, params);
            }else{
                finalResult = await callReplicateAndWaitResultWithRes(context, params);
            }
        //}else{
        //    return await setErrorStatus(res, enums.resStatus.unExpErr, "未知的工作流命令！", room, user, price);
        //}

        // 这里只做最终成功后的处理，失败的返回比较复杂，需要在各自任务里处理
        if(finalResult){
            log(context, "Workflow Agents got finalResult:", JSON.stringify(finalResult));
            if(finalResult.result?.generated){ 
                // 如果需要放大就放大
                if(needZoomIn){
                    const zoomStep = await refine(context, finalResult.result.generated, 2);
                    if (zoomStep?.status == enums.resStatus.OK && zoomStep?.result?.genRoomId && zoomStep?.result?.generated) {
                        finalResult = zoomStep;
                    }                
                }
                
                // 对于图片类和图像类审计
                if(params.needAuditResult && (isURL(finalResult.result.generated) || isBase64Image(finalResult.result.generated)) ){
                    log(context, "Workflow Agents start to audit......");                    
                    try{
                        // 这里审计通过，不代表没问题，需要后期离线再次审计
                        // 这里审计有问题就先处理掉
                        if(!auditResult){
                            auditResult = await audit.auditURL(finalResult.result.generated, room.resultType);
                        }
                    }catch(err){
                        error(context, "workflow Agent2 Audit Exception:", err, finalResult.result.generated);
                    }
                    
                    switch(auditResult){
                        case "N": {
                            log(context, `Workflow Agents: ${finalResult.result.generated} is safe......`);                    
                            // 审计没有发现没有问题
                            finalResult.result.audit = null; 
                            if(getFileServerOfURL(finalResult.result.generated) != process.env.FILESERVER){
                                try{
                                    const fileInServer = await moveToFileServer(finalResult.result.generated);
                                    log(context, `Workflow Agents: ${finalResult.result.generated} moved to fileserver ${fileInServer}......`);                    
                                    if(fileInServer){
                                        finalResult.result.generated = fileInServer;
                                    }
                                }catch(err){
                                    error(context, "WorkflowAgent2 upload Fileserver Exception", err, JSON.stringify(req.body));
                                }
                            }else{
                                // 如果在临时目录，也换到正式目录，删除原来的文件
                                if(finalResult.result.generated.indexOf("/T/")>=0){
                                    const fileInPathU = await moveToFileServer(finalResult.result.generated, "U");
                                    if(fileInPathU){
                                        await fs.deleteFileByURL(finalResult.result.generated);
                                        finalResult.result.generated = fileInPathU;                                
                                    }
                                }
                            }
                            if(putQRCode){
                                if(room.resultType === "IMAGE"){
                                    // log(context, `Workflow Agents: add water mark to ${finalResult.result.generated} ......`);                                                
                                    // finalResult.result.generated = addWatermark(finalResult.result.generated, config, user);    
                                    log(context, `user.grade: ${user.grade}`);
                                    if(user.grade <= 0){
                                        log(context, `Workflow Agents: add QRCode to Image ${finalResult.result.generated} ......`);                                                                                  
                                        const imageWithQR = await iu.putWechatQR(finalResult.result.generated, config, user);    
                                        if(imageWithQR && (imageWithQR != finalResult.result.generated)){
                                            putToTempList(finalResult.result.generated, context);
                                            finalResult.result.generated = imageWithQR;
                                        }
                                    }
                                }
                                if(room.resultType === "VIDEO"){
                                    // log(context, `Workflow Agents: add water mark to ${finalResult.result.generated} ......`);                                                
                                    // finalResult.result.generated = addWatermark(finalResult.result.generated, config, user);    
                                    if(user.grade <= 0){
                                        log(context, `Workflow Agents: add QRCode to Video ${finalResult.result.generated} ......`);                                                                                  
                                        const videoWithQR = await vu.putWechatQR(finalResult.result.generated, config, user);    
                                        if(videoWithQR && (videoWithQR != finalResult.result.generated)){
                                            putToTempList(finalResult.result.generated, context);
                                            finalResult.result.generated = videoWithQR;
                                        }
                                    }
                                }
                            }
                            break;
                        }
                        case "P": {
                            // 初步审计发现可能有色情问题
                            finalResult.result.audit = "P";
                            warn(context, "workflowAgent2 found UNSAFE result:" + finalResult.result.generated);
                            try{
                                const fileInUS = await fs.backupToUS(finalResult.result.generated);
                                if(fileInUS && (fileInUS !== finalResult.result.generated)){
                                    putToTempList(finalResult.result.generated, context);
                                    finalResult.result.generated = fileInUS;
                                }
                            }catch(err){
                                error(context, "WorkflowAgent2 upload to US Exception", err, JSON.stringify(req.body));
                            }       
                            break;
                        }
                        case "T":
                        case "D":
                        case "Z": {
                            // 发现严重违规问题，直接删除所有文件
                            warn(context, "workflowAgent2 发现严重违规问题，直接删除所有文件，并返回错误:" + finalResult.result.generated);
                            try{
                                await fs.deleteFileByURL(finalResult.result.generated);
                            }catch(e){
                                error(context, "删除违规文件错误！可能不在文件服务器", e);
                            }
                            finalResult.result.generated = null;
                            await prisma.room.update({ 
                                where:{ id:room.id }, 
                                data:{ 
                                    audit: auditResult,
                                    callbacked: "Y", // 此时最终状态不再接受callback
                                    status: enums.roomStatus.failed,
                                    outputImage: "您的内容不符合规范，无法为您处理！"
                                } 
                            });                                       
                            return await setErrorStatus(res, enums.resStatus.NSFW, "您的内容不符合规范，无法为您处理！", room, user, price);
                        }
                    }
                }                    
    
                await prisma.room.update({ 
                    where:{ id:room.id }, 
                    data:{ 
                        audit: auditResult,
                        callbacked: "Y", // 此时最终状态不再接受callback
                        status: enums.roomStatus.success,
                        outputImage: finalResult.result.generated
                    } 
                });   

                // 这里是唯一正确结束函数的出口
                return res.status(enums.resStatus.OK).json(finalResult.result);  
            }else{                
                try{
                    error(context, "常规情况只要有finalResult，一定有finalResult.result.generated，这里是兜底意外情况");
                    return await setErrorStatus(res, 
                                                finalResult.status || enums.resStatus.noResultErr, 
                                                finalResult.result || "没有生成任何结果！", 
                                                room, user, price);
                }catch(err){
                    error(context, "worflowAgent2进行兜底结果处理时，发生未知异常：", err, JSON.stringify(finalResult));                    
                }
            }
        }else{
            error(context, "worflowAgent2执行命令时，finalResult没有返回任何结果");                                
            const fRoom = await prisma.room.findUnique({where:{id:room.id}});
            if(fRoom){
                let errData:any = { 
                    callbacked: "Y", // 此时最终状态不再接受callback
                    status: enums.roomStatus.failed,
                };
                if(fRoom.outputImage.indexOf("running.gif")>=0){
                    errData.outputImage = `系统发生未知错误，您的${config.creditName}已经被退回，请稍后重试。`;
                }
                // 只要没有返回finalResult，就设置失败标志
                await prisma.room.update({ 
                    where:{ id:room.id }, 
                    data: errData
                });                   
            }
        }
    } catch (err) {
        error(context, "worflowAgent2发生未知异常：", err, JSON.stringify(req.body));
        return await setErrorStatus(res, enums.resStatus.unExpErr, "发生未知错误！", room, user, price);
        // res.status(enums.resStatus.expErr).json("当前用户太多，服务器过于繁忙发生错误，请稍后重试！本次运行的" + config.creditName + "已经被退回。");
    }finally{
        // 离开队列
        leaveWaitingList(funcWaitingListName, room.id, {BPM:funcObj.BPM || 60, maxWorkers:funcObj?.maxWorkers});

        // 兜底：确保状态已更新
        if (room) {
            try {
                const currentRoom = await prisma.room.findUnique({ 
                    where: { id: room.id },
                    select: { status: true }
                });
                
                if (currentRoom?.status != enums.roomStatus.success) {
                    await prisma.room.update({
                        where: { id: room.id },
                        data: { status: enums.roomStatus.failed }
                    });
                }
            } catch (e) {
                error(context, "-----------需要引起注意-------------");
                error(context, "Failed to verify room status", e);
                error(context, "-----------需要引起注意-------------");                
            }
        }      
        // log(context, "删除临时文件");
        if(process.env.AUTO_DELETE_TEMP_FILE === "TRUE" && context?.tempFiles?.length>0){
            for(const temp of context?.tempFiles){
                if(temp.fileType == "URL"){
                    fs.deleteFileByURL(temp.file);
                }
                if(temp.fileType == "PATH"){
                    fs.deleteLocalFile(temp.file);
                }
            }
        }
    }
}



// 临时文件处理
async function createTempFile(fileURL:string|undefined|null, context:any){
    try{
        if(fileURL){
            const tempFile = await moveToFileServer(fileURL, "T");
            if(tempFile){
                putToTempList(tempFile, context);
                log(context, "createTempFile:" + tempFile);
                return tempFile;
            }
        }
    }catch(err){
        error(context, "exception in createTempFile:", err);
    }
    error(context, "createTempFile filed:" + fileURL);
    return fileURL;
}

async function createUSTempFile(fileURL:string|undefined|null, context:any, force:boolean=false){
    try{
        if(fileURL){
            if(force || isBase64Image(fileURL) || !isInUS(fileURL)){
                const usFile = await fs.backupToUS(fileURL);
                if(usFile){
                    putToTempList(usFile, context);
                    log(context, "createUSTempFile:" + usFile);                    
                    return usFile;
                }
            }
        }
    }catch(err){
        error(context, `exception in createUSTempFile: ${fileURL}`, err);
    }
    error(context, "createUSTempFile field:" + fileURL);
    return fileURL;    
}

function putToTempList(file:string|undefined|null, context:any, fileType:string="URL"):void{
    if(!context.tempFiles){
        context.tempFiles = [] as TempFile[];
    }
    if(file){
        context.tempFiles.push({fileType, file});
    }
}

// 创建本地临时文件
async function createLocalTempFile(fileURL:string|undefined|null, context:any){
    try{
        if(fileURL){
            const tempFile = await fs.downloadToLocal(fileURL);
            if(tempFile){
                putToTempList(tempFile, context, "PATH");
                log(context, "createLocalTempFile:" + tempFile);
                return tempFile;
            }
        }
    }catch(err){
        error(context, "exception in createTempFile:", err);
    }
    error(context, "createTempFile filed:" + fileURL);
    return "";
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// 工作流函数
// 如果有结果，无论失败成功，就返回finalResult
// 如果不返回，后续不做任何操作
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const funcs:any = {     
    "faceswap": async function(context:any, params:any){        
        let finalResult:any;
        try{
            // 开始处理
            let targetRect = params.target_rect;
            let targetImg = params.target_image;
            let needZoomIn:boolean = false; // params.target_image?.indexOf("x-oss-process=image/resize")>=0;
            
            if(targetRect && targetRect.width>10 && targetRect.height>10){
                // 把选择区域扩大一倍
                if(params.func.startsWith("faceswapV4")){
                    const imageSize = await iu.getImageSize(targetImg);
                    if (imageSize) {
                        const faceRect = { ...targetRect }; // 创建副本避免污染原始数据
                        const scale = params.faceUpScale || 1.6;
                        
                        // 计算理论扩大尺寸
                        const desiredWidth = faceRect.width * scale;
                        const desiredHeight = faceRect.height * scale;
                        
                        // 获取原区域中心坐标
                        const originalCenterX = faceRect.x + faceRect.width / 2;
                        const originalCenterY = faceRect.y + faceRect.height / 2;
                        
                        // 计算初始扩展坐标
                        let newX = originalCenterX - desiredWidth / 2;
                        let newY = originalCenterY - desiredHeight / 2;
                        
                        // 边界安全计算（关键修复）
                        // 计算实际可用空间
                        const maxRight = imageSize.width;
                        const maxBottom = imageSize.height;
                        
                        // 约束左边界和上边界
                        newX = Math.max(0, newX);
                        newY = Math.max(0, newY);
                        
                        // 约束右边界和下边界
                        const actualRight = Math.min(newX + desiredWidth, maxRight);
                        const actualBottom = Math.min(newY + desiredHeight, maxBottom);
                        
                        // 计算实际有效尺寸
                        const actualWidth = actualRight - newX;
                        const actualHeight = actualBottom - newY;
                        
                        // 二次中心校准（当尺寸受限时）
                        if (actualWidth < desiredWidth) {
                            newX = Math.max(0, originalCenterX - actualWidth / 2);
                        }
                        if (actualHeight < desiredHeight) {
                            newY = Math.max(0, originalCenterY - actualHeight / 2);
                        }
                        
                        // 最终边界检查
                        newX = Math.min(newX, maxRight - actualWidth);
                        newY = Math.min(newY, maxBottom - actualHeight);
                        
                        // 更新矩形区域（使用整数像素）
                        targetRect = {
                            x: Math.floor(newX),
                            y: Math.floor(newY),
                            width: Math.floor(actualWidth),
                            height: Math.floor(actualHeight)
                        };
                        
                        // 调试日志
                        log(context, `调整后区域: ${JSON.stringify(targetRect)} 图像尺寸: ${imageSize.width}x${imageSize.height}`);
                    }
                }
                const rectImageURL = await iu.cutRectFromImage(targetImg, {top:targetRect.y, left:targetRect.x, width:targetRect.width, height:targetRect.height});
                log(context, `调整后的rectImageURL: ${rectImageURL}`);
                putToTempList(rectImageURL, context);
                
                // 把小图上传到文件服务器的临时区域
                // 对小图进行换脸
                let step1:any;
                if(rectImageURL){
                    switch(params.func){
                        case "faceswapGPT":
                            step1 =  await swapFaceGPT(params.swap_image, rectImageURL, context);
                            break;
                        case "faceswapV4_S":
                            step1 = await swapFaceV4(params.swap_image, rectImageURL, 
                                                     {model_type: "speed", swap_type: params.swap_type, style_type: params.style_type, hardware:params.hardware},
                                                     context);
                            break;
                        case "faceswapV4_Q":
                            step1 = await swapFaceV4(params.swap_image, rectImageURL, 
                                                     {model_type: "quality", swap_type: params.swap_type, style_type: params.style_type, hardware:params.hardware},
                                                     context);    
                            break;
                        case "faceswapHD":
                            step1 = await swapFaceHD(params.swap_image, rectImageURL, context);
                            break;
                        case "faceswap":
                        default:
                            step1 = await swapFace(params.swap_image, rectImageURL, context);
                    };
                }                
                if(step1){
                    if(step1.result?.generated){
                        finalResult = step1;                    
                        // 把换脸结果按照给定的矩形，贴回原来的目标换图
                        let rectGenImage = step1.result.generated;
                        putToTempList(rectGenImage, context);

                        // 结果没法大于2048，所以在必要的时候需要放大
                        const genRect = await iu.getImageSize(rectGenImage);
                        if(genRect && genRect.width && genRect.height){
                            // faceswap太模糊，清晰化一下
                         // if(params.func !== "faceswapHD" || genRect.width<targetRect.width || genRect.height<targetRect.height){
                        //  if(genRect.width<targetRect.width || genRect.height<targetRect.height){    
                          if(params.refineResult || genRect.width<targetRect.width || genRect.height<targetRect.height){                          
                                const step12 = await refine(context, rectGenImage, 2);
                                if(step12.result.generated){
                                    const resizeStep11Image = await iu.resizeImageToSize(step12.result.generated, targetRect);
                                    if(resizeStep11Image){
                                        putToTempList(rectGenImage, context);
                                        rectGenImage = resizeStep11Image;
                                    }
                                }                                
                            }else if(genRect.width>targetRect.width || genRect.height>targetRect.height){
                                const resizeStep11Image = await iu.resizeImageToSize(step1.result.generated, targetRect);
                                if(resizeStep11Image){
                                    putToTempList(rectGenImage, context);
                                    rectGenImage = resizeStep11Image;
                                }
                            }
                        }

                        // 换脸结果照片
                        let faceImages = [{imageURL: rectGenImage, x: targetRect.x+10, y:targetRect.y+10, width: targetRect.width-20, height: targetRect.height-20}];
                        // 把没有参与换脸的照片也截取下来，并贴回去
                        const rectsOverlap = (a:any, b:any) => 
                            a.x < b.x + b.width && 
                            a.x + a.width > b.x && 
                            a.y < b.y + b.height && 
                            a.y + a.height > b.y;                        
                        if(params.func.indexOf("faceswapV4")>=0 && params?.targetFaces?.length>1){
                            for(const f of params.targetFaces){
                                //log(context, 'targetFace:', f, JSON.stringify(f));
                                const faceRect = {x:f.rect.left, y:f.rect.top, width:f.rect.width, height:f.rect.height};
                                if(!rectsOverlap(faceRect, params.target_rect)){
                                    const minFaceURL = await iu.cutRectFromImage(targetImg, {top:faceRect.y, left:faceRect.x, width:faceRect.width, height:faceRect.height});
                                    //log(context, `没参与换脸的脸部minFaceURL: ${minFaceURL}`);
                                    putToTempList(minFaceURL, context);
                                    faceImages.push({imageURL:minFaceURL, y:faceRect.y, x:faceRect.x, width:faceRect.width, height:faceRect.height});
                                }
                            }                    
                        }
                        let finalImage = await iu.putImagesOnImage(targetImg, faceImages, "U");
                        log(context, "faceswap finalImage:" + finalImage);

                        // 返回合并后的结果
                        step1.result.generated = finalImage;
                        finalResult = step1;
                    }else{
                        setErrorStatus(context.res, step1.status, step1.result, context.room, context.user, context.price);
                    }
                }else{
                    setErrorStatus(context.res, enums.resStatus.unExpErr, "换脸任务在处理输入图片时发生异常，请更换图片再尝试！", context.room, context.user, context.price);
                }
            }else{
                let step0:any;
                switch(params.func){
                    case "faceswapHD":
                        step0 = await swapFaceHD(params.swap_image, targetImg, context);
                        break;
                    case "faceswapV4_S":
                        step0 = await swapFaceV4(params.swap_image, targetImg, 
                                                 {model_type: "speed", swap_type: params.swap_type, style_type: params.style_type, hardware:params.hardware},
                                                 context);
                        break;
                    case "faceswapV4_Q":
                        step0 = await swapFaceV4(params.swap_image, targetImg, 
                                                 {model_type: "quality", swap_type: params.swap_type, style_type: params.style_type, hardware:params.hardware},
                                                 context);       
                        break;
                    case "facefusion":
                        step0 = await advanceSwapFace(params.swap_image, targetImg, context, {strength:params.strength});
                        break;
                    case "faceswap":
                    default:
                        step0 = await swapFace(params.swap_image, targetImg, context);
                };
                if(step0 && step0.status && step0.result){
                    if(step0.result?.generated){
                        finalResult = step0;
                    }else{
                        setErrorStatus(context.res, step0.status, step0.result, context.room, context.user, context.price);                    
                    }
                }else{
                    setErrorStatus(context.res, enums.resStatus.unExpErr, "换脸任务在处理输入图片时发生异常，请更换图片再尝试！", context.room, context.user, context.price);
                }
            }

            if(finalResult?.result?.generated){
                if(!needZoomIn){
                    const size = await iu.getImageSize(finalResult.result.generated);
                    const orgSize = await iu.getImageSize(targetImg);
                    if(size?.width && size?.height && orgSize?.width && orgSize?.height){
                        needZoomIn = (size?.width < 512 && size?.height < 512) ||
                        ((size.width+100)<orgSize.width || (size.height+100)<orgSize.height);
                    }
                }
                if(needZoomIn){
                    const step2 = await refine(context, finalResult.result.generated, 2);
                    if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                        putToTempList(finalResult.result.generated, context);
                        finalResult = step2;
                    }
                }
            }            
        }catch(err){
            error(context, "unkonwn exception in faceswap", err);
        }finally{
//            await prisma.room.update({ 
//                where:{ id:context.room.id }, 
//                data:{ 
//                    model: params.modelurl,
//                    prompt: params.inputText,
//                    status: finalResult ? enums.roomStatus.success : enums.roomStatus.failed,
//                } });        
        }
        return finalResult;
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
   "hairDesign": async function(context:any, params:any){        
        let finalResult:any;
      
        let step0:any;
        switch(params.func){
            case "faceswapHD":
                step0 = await swapFaceHD(params.swap_image, params.target_image, context);
                break;                
            case "faceswapV4_S":
                step0 = await swapFaceV4(params.swap_image, params.target_image, 
                                         {model_type: "speed", swap_type: "face", style_type: "style", hardware:"cost"},
                                         context);
                break;
            case "faceswap":
            default:
                step0 = await swapFace(params.swap_image, params.target_image, context);
        };
        if(step0 && step0.status && step0.result){
            if(step0.result?.generated){
                finalResult = step0;
            }else{
                setErrorStatus(context.res, step0.status, step0.result, context.room, context.user, context.price);                    
            }
        }else{
            setErrorStatus(context.res, enums.resStatus.unExpErr, "发型设计任务在处理输入图片时发生异常，请更换图片再尝试！", context.room, context.user, context.price);
        }

        if(finalResult?.result?.generated){
            const step2 = await refine(context, finalResult.result.generated, 2);
            if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                putToTempList(finalResult.result.generated, context);
                finalResult = step2;
            }
        }            
        return finalResult;
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
   "personalDesign": async function(context:any, params:any){        
        let finalResult:any;
      
        let step0:any;
        switch(params.func){
            case "faceswapHD":
                step0 = await swapFaceHD(params.swap_image, params.target_image, context);
                break;                
            case "faceswapV4_S":
                step0 = await swapFaceV4(params.swap_image, params.target_image, 
                                         {model_type: "speed", swap_type: "head", style_type: "style", hardware:"cost"},
                                         context);
                break;
            case "faceswap":
            default:
                step0 = await swapFace(params.swap_image, params.target_image, context);
        };
        if(step0 && step0.status && step0.result){
            if(step0.result?.generated){
                finalResult = step0;
            }else{
                setErrorStatus(context.res, step0.status, step0.result, context.room, context.user, context.price);                    
            }
        }else{
            setErrorStatus(context.res, enums.resStatus.unExpErr, "造型设计任务在处理输入图片时发生异常，请更换图片再尝试！", context.room, context.user, context.price);
        }

        if(finalResult?.result?.generated){
            const step2 = await refine(context, finalResult.result.generated, 2);
            if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                putToTempList(finalResult.result.generated, context);
                finalResult = step2;
            }
        }            
        return finalResult;
    },
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "createVoice": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "simVoice": async function(context:any, params:any){
        // 第一步清洁声音
        if(params.cleanVoice){
            params.params.speaker_reference = await au.extractVocals(params.params.speaker_reference, "T");                
            putToTempList(params.params.speaker_reference, context);
        }
        // 第二步识别文字
        if(!params.params.text_reference){
            const ais = new TencentTTS();
            const format = fu.getFileExtFromURL(params.params.speaker_reference)?.toLowerCase();
            params.params.text_reference = await ais.voiceToText(params.params.speaker_reference, format);        
        }
        // 第三步模仿声音
        params.waitResultRetryTimes = 30;
        return await callReplicateAndWaitResultWithRes(context, params);        
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "autoCaption": async function(context:any, params:any){
        let finalResult = null;
        finalResult = await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            params: params
        });
        return finalResult;
    },     
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "createPoster": async function(context:any, params:any){
        let finalResult = null;
        if(params.model === "wanx-poster-generation-v1"){
            finalResult = await callReplicateAndWaitResultWithRes(context, {
                func: params.func,
                drawRatio: params.drawRatio,
                params
            });
        }else{
            let prompt = ` 设计一张。${params.prompt}。画面中显示并且只显示以下文字：
            [TITLE] "${params.title}"
            [CONTENT] "${params.subTitle}"
            [EXPLANATION] "${params.bodyText}"            
            `;
            finalResult = await callReplicateAndWaitResultWithRes(context, {
                func: params.func,
                drawRatio: params.drawRatio,
                inputText: prompt,
                realText: prompt,
            });
        }
        return finalResult;
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "createPrompt": async function(context:any, params:any){
        let serviceLines:(string | undefined)[] = ["DEFAULT"];

        // 针对flux-merged做一下容错
        if(params.func == "flux-merged"){
            try{
                let maxLen = 1;
                let dayLimitTimes = 50;
                let slowDownRate = 3;
                if(context.user.boughtCredits > 1000){
                    maxLen = 3;
                    dayLimitTimes = 100;
                    slowDownRate = 1;
                }
                const waitResult = await enterUserWaitingList(context, params.func, 5, maxLen);                                    
                if(waitResult === enums.resStatus.tooMuchWaiting){
                    return setErrorStatus(context.res, enums.resStatus.tooMuchWaiting, "您已经启动了太多的同一任务，请等待前序任务执行完毕后再开始新任务。", context.room, context.user, context.price);
                }
                const times = await getUserModelUsedTimesPerDay(context, "flux-merged");
                if(times > dayLimitTimes){
                    log(context, `${context.user?.name}:${context?.user.id}使用太频繁，延迟${times}秒执行}`);
                    await new Promise((resolve) => setTimeout(resolve, ((times-dayLimitTimes) * slowDownRate * 1000)));
                }
                
                const step0 = await callReplicateAndWaitResultWithRes(context, params, undefined, serviceLines, false);

                await addUserModelUsedTimesPerDay(context, "flux-merged");            
 
                if(step0?.result?.generated){
                    return step0;
                }else{
                    params.func = "flux-dev-ultra-fast";
                }
            }catch(err){
                error(context, "flux-merged Exception:", err);
            }finally{
                await leaveUserWaitingList(context, params.func, 10);
            }
                
        }
        
        switch(params.func){
            case "flux-pro-ultra": {
                serviceLines = [process.env.SERVICE_FLUX_PRO_ULTRA!, process.env.SERVICE_FLUX_PRO_ULTRA_BACKUP!];
                break;
            }
            case "flux-schnell": {
                serviceLines = [process.env.SERVICE_FLUX_SCHNELL, process.env.SERVICE_FLUX_SCHNELL_BACKUP];
                break;                
                // 因为阿里schnell和dev免费，所以临时做这个转换
                // params.func = "flux-dev";
            }
            case "flux-dev": {
                serviceLines = [process.env.SERVICE_FLUX_DEV!, process.env.SERVICE_FLUX_DEV_BACKUP!];
                break;
            }
                
            default: 
                serviceLines = ["DEFAULT"];
        }
        
        return await callReplicateAndWaitResultWithRes(context, params, undefined, serviceLines);
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "photo2cartoon": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "removeBG": async function(context:any, params:any){
        if(params.method == "AUTO"){
            return await callReplicateAndWaitResultWithRes(context, params);
        }else{
            return {
                status: enums.resStatus.OK,
                result: {
                    generated: await iu.cutImageByMask(params.imageUrl, params.maskImage, true),
                    genRoomId: context.room.id
                }
            }
        }          
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "stylePortrait": async function(context:any, params:any){
        let finalResult:any;
        const step1 =  await callReplicateAndWaitResultWithRes(context, params);
        if(step1){
            finalResult = step1;
            
            if(params.func == "luma-photon" || params.face_image){
                log(context, "STEP2: face swap");
                const step2 = await swapFace(params.face_image, finalResult.result.generated, context);                           
                log(context, "STEP2 result:", JSON.stringify(step2));
                if(step2?.status == enums.resStatus.OK && step2?.result?.generated){
                    finalResult = step2;
                }
            }
            /*
            if(finalResult?.result?.generated){
                log(context, "STEP2: refine");
                const step3 = await refine(context, finalResult.result.generated, 2);
                if (step3?.status == enums.resStatus.OK && step3?.result?.genRoomId && step3?.result?.generated) {
                    finalResult = step3;
                }                
            } 
            */
        }
        
        return finalResult;
    },        
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "editImage": async function(context:any, params:any){
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated: params.imageURL,
                genRoomId: context.room.id
            }
        }
        return finalResult;
    },
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "cropImage": async function(context:any, params:any){
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated: params.imageURL,
                genRoomId: context.room.id
            }
        }
        if(params.rotate){
            finalResult.result.generated = await iu.rotateImage(params.imageURL, params.rotate);
        }else if(params.flip){
            finalResult.result.generated = await iu.flipImage(params.imageURL, params.flip);
        }else{
            let imageURL = params.imageURL;            
            if(!fs.inOSSBucket(imageURL)){
                log(context, "非阿里云图片或者不在aiputi桶里，就先上传到数据桶");                    
                imageURL = await createTempFile(imageURL, context);
            }       
    
            let transform = "";
            log(context, "如果scale不等于1, 按比例缩放");
            if(Math.abs(params.scale - 1)>0.001 && params.scale<10){
                 transform += `/resize,p_${Math.ceil(params.scale*100)}`;
            }
    
            log(context, "按给定的矩形从图片上切下一张小图");
            const rect = {
                x: Math.ceil(params.cropRect.x),
                y: Math.ceil(params.cropRect.y),
                width: Math.ceil(params.cropRect.width), 
                height: Math.ceil(params.cropRect.height)
            };
            transform += `/crop,x_${rect.x},y_${rect.y},w_${rect.width},h_${rect.height}`;
    
            const rectImageURL = imageURL.indexOf("x-oss-process=image")>0 ? `${imageURL}${transform}` : `${imageURL}?x-oss-process=image${transform}`;
            
            log(context, "rect image url:" + rectImageURL);
            finalResult.result.generated = await moveToFileServer(rectImageURL, "U");
        }

        return finalResult;
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "outpaint": async function(context:any, params:any){
        let finalResult:any;

        let resized = false;
        params.params.image = await iu.convertPNG2JPG(params.params.image); // PNG格式会有错误
        const imageSize = await iu.getImageSize(params.params.image);        
        params.params.prompt = `${params.params.prompt}
        The expanded content should be rich and continuous with the original image. The edges of the photo cannot have any borders or solid color areas.`;
        const devServices = [process.env.SERVICE_FLUX_FILL_DEV!, process.env.SERVICE_FLUX_FILL_DEV_BACKUP!,
                             process.env.SERVICE_FLUX_FILL_DEV!, process.env.SERVICE_FLUX_FILL_DEV_BACKUP!];
        const proServices = [process.env.SERVICE_FLUX_FILL_PRO!, process.env.SERVICE_FLUX_FILL_PRO_BACKUP!,
                             process.env.SERVICE_FLUX_FILL_PRO!, process.env.SERVICE_FLUX_FILL_PRO_BACKUP!];
        
        if(imageSize){        
            switch(params.model){
                case "ideogram-v3-reframe":{
                    params.func = "ideogram-v3-reframe";                            
                    params.params.scaledHeight = params.params.outpaint_up + params.params.outpaint_dow + imageSize.height;
                    params.params.scaledWidth = params.params.outpaint_left + params.params.outpaint_right + imageSize.width;
                    const step1 = await callReplicateAndWaitResultWithRes(context, params);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                    }
                    break;
                }
                case "byte-outpainting": {
                    params.func = "byte-outpainting";                            
                    params.params.top_scale = Math.min(params.params.outpaint_up / imageSize.height, 1);
                    params.params.bottom_scale = Math.min(params.params.outpaint_down / imageSize.height, 1);
                    params.params.left_scale = Math.min(params.params.outpaint_left / imageSize.width, 1);
                    params.params.right_scale = Math.min(params.params.outpaint_right / imageSize.width, 1);

                    const step1 = await callReplicateAndWaitResultWithRes(context, params);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                    }
                    break;
                }
                    
                case "wanx2.1-imageedit": {
                    params.func = "wanx2.1-imageedit";                            
                    params.params.top_scale = Math.min(params.params.outpaint_up / imageSize.height, 1) + 1;
                    params.params.bottom_scale = Math.min(params.params.outpaint_down / imageSize.height, 1) + 1;
                    params.params.left_scale = Math.min(params.params.outpaint_left / imageSize.width, 1) + 1;
                    params.params.right_scale = Math.min(params.params.outpaint_right / imageSize.width, 1) + 1;

                    const step1 = await callReplicateAndWaitResultWithRes(context, params);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                    }
                    break;
                }
                    
                case "seg-beyond": {
                    params.func = "seg-beyond";                            
                    const step1 = await callReplicateAndWaitResultWithRes(context, params);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                    }
                    break;
                }
                    
                case "focus":
                case "combo": {
                    if( imageSize.width>1024 || imageSize.height>1024 ){
                        log(context, `outpaint STEP0:${params.params.image} resize to 1024`);
                        params.params.image = await iu.resizeImage(params.params.image, 1024);
                        log(context, `new image is ${params.params.image}`);                
                        resized = true;
                    }
                    params.func = "focus";                            
                    const step1 = await callReplicateAndWaitResultWithRes(context, params, undefined, 
                                                                          [process.env.SERVICE_OUTPAINT!, process.env.SERVICE_OUTPAINT_BACKUP!]);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                    }
                    
                    if(params.model == "combo"){
                        const inputImageSize = await iu.getImageSize(params.params.image);
                        const step1Size = await iu.getImageSize(step1.result.generated);
                        if(inputImageSize && step1Size){
                            const wExt = step1Size.width - inputImageSize.width;
                            const hExt = step1Size.height - inputImageSize.height;                        
                            const leftExt = Math.round(wExt/2);
                            const rightExt = wExt - leftExt;
                            const topExt = Math.round(hExt/2);
                            const bottomExt = hExt - topExt;
                            // 用flux加强效果
                            params.params.mask = await iu.generateRectMaskImage(step1Size.width, step1Size.height, leftExt+10, 
                                                                                topExt+10, inputImageSize.width-20, inputImageSize.height-20, true);
                            params.params.image = step1.result.generated;
                            if(!params.params.prompt){
                                params.params.prompt_upsampling = true;
                            }    
                            params.func = "flux-fill-pro";                            
                            const step2 = await callReplicateAndWaitResultWithRes(
                                context, params, undefined, proServices);
                            if(step2){
                                log(context, `outpaint STEP2 result: ${JSON.stringify(step2)}`);                        
                                finalResult = step2;
                            }  
                        }
                    }   
                    break;
                }
                    
                default: {
                    // flux-fill
                    // 根据扩图区域，把现有图片四周加上白边,并且在四周羽化10个像素
                    params.params.image = await iu.addFrame(params.params.image, {
                        left:params.params.outpaint_left, right:params.params.outpaint_right, 
                        top:params.params.outpaint_up, bottom:params.params.outpaint_down}, { r: 0, g: 0, b: 0 });
    
                    // 根据扩图区域，生成一张和现有图片一样大的纯黑色MASK图片，四周也加上白边，比原图缩进N像素
                    let wN = 0; // Math.round(imageSize.width * 0.03);
                    let hN = 0; // Math.round(imageSize.height * 0.03);
                    params.params.mask = await iu.generateRectMaskImage(
                        imageSize.width + params.params.outpaint_left + params.params.outpaint_right, 
                        imageSize.height + params.params.outpaint_up + params.params.outpaint_down,
                        params.params.outpaint_left > 0 ?  (params.params.outpaint_left + wN) : 0, 
                        params.params.outpaint_up  > 0 ? (params.params.outpaint_up + hN) : 0,
                        params.params.outpaint_left > 0 ? (imageSize.width - 2*wN) : imageSize.width, 
                        params.params.outpaint_up > 0 ? (imageSize.height - 2*hN) : imageSize.height,
                        true // 反色MASK
                    );                        
                    if(!params.params.prompt){
                        params.params.prompt_upsampling = true;
                    }
    
                    let services = devServices;
                    switch(params.model){
                        case "flux-fill-dev": 
                            params.func = "flux-fill-dev";
                            params.guidance = 50;
                            services = devServices;
                            break;
                        case "flux-fill-pro":
                            params.func = "flux-fill-pro";
                            params.guidance = 50;
                            services = proServices;
                    }
                    // 调用flux-fill
                    const step1 = await callReplicateAndWaitResultWithRes(context, params, undefined, services);
                    if(step1){
                        log(context, `outpaint STEP1 result: ${JSON.stringify(step1)}`);                        
                        finalResult = step1;
                        resized = true; // 这种扩图经常会缩小图尺寸输出
                    }     
                }
            }
            
            // 如果曾经被缩小尺寸，就做一次放大，如果没有也需要refine一下质量
            if(finalResult?.result?.generated){
                if(resized){
                    const step3 = await refine(context, finalResult.result.generated, 2, {face_upsample:false, background_enhance:true});
                    log(context, `outpaint STEP3 result: ${JSON.stringify(step3)}`);                                            
                    if (step3?.status == enums.resStatus.OK && step3?.result?.genRoomId && step3?.result?.generated) {
                        finalResult = step3;
                    }                
                }
            }
        }
        return finalResult;            
    },   
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "recolorImage": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },     
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "dream": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "deco": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "draft": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "garden": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, params);
    },        
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "superCamera": async function(context:any, params:any){
        let finalResult:any;
        switch(params.func){
            case "flux-pulid": {
                params.params = { 
                    swap_image: params.swap_image,
                    prompt: params.realText,
                };
                let step1 = await callReplicateAndWaitResultWithRes(context, params, undefined, [
                    process.env.SERVICE_FLUX_PULID!, process.env.SERVICE_FLUX_PULID_BACKUP!
                ]);    
                if (step1) {
                    finalResult = step1;            
    
                    const step2 = await refine(context, finalResult.result.generated, 2);
                    if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                        finalResult = step2;
                    }
                }
                break;
            }

            case "minimax-image-01": {
                params.imageUrl = params.swap_image;
                const step1 = await callReplicateAndWaitResultWithRes(context, params);
                if(step1){
                    finalResult = step1;
                }
                break;
            }

          case "flux-kontext-pro":{
                const step1 = await callReplicateAndWaitResultWithRes(context, {
                    func: "flux-kontext-pro",
                    drawRatio: params.drawRatio,
                    params: {
                        prompt : params.realText,
                        input_image: params.swap_image
                    }
                });
                if(step1){
                    finalResult = step1;
                }
                break;
          }              
                
            default: {
                const step1 = await callReplicateAndWaitResultWithRes(context, params);
                if(step1){
                    finalResult = step1;
                    let step2;
                    if(params.swap_image){
                        const face = await iu.resizeImage(params.swap_image, 2000) || params.swap_image;
                        const target = await iu.resizeImage(finalResult.result.generated, 2000) || finalResult.result.generated;
                        switch(params.swapMode){
                            case "facefusion":
                                step2 = await advanceSwapFace(face, target, context);
                                break;
                            case "faceswap":
                                step2 = await swapFace(face, target, context);                                            
                                break;
                            case "faceswapHD":
                            default:
                                step2 = await swapFaceHD(face, target, context);                                            
                                if(!step2){
                                    step2 = await swapFace(face, target, context);                                            
                                }
                                break;
                        }
                        if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                            finalResult = step2;
                        }
                    }
                }
            }
        }
        return finalResult;
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "lora": async function(context:any, params:any){
        let finalResult:any;
        const lora = await prisma.model.findUnique({where:{code: params.modelurl }});

        if(lora){
            log(context, "STEP1: lora 绘图");
            switch(lora.trainSrv){
                case "pretrained":
                case "prompt":
                    params.func = lora.baseModel;
                    break;
                default:
                    params.func = "lora";
            }

            // 对吉卜力风做特殊处理，后续应该优化
            if(lora.code == "pretrained000010018" && params.imageUrl){
                params.func = "ghiblify";
                params.params = {
                    imageURL: params.imageUrl
                }
            }
            
            const step1 = await callReplicateAndWaitResultWithRes(context, params);
            finalResult = step1;
    
            if(lora.channel=="PORTRAIT" && lora.trainSrv != "ostris / flux-dev-lora-trainer"){
                log(context, "STEP2: 用FLUX优化画面");
                if(finalResult){
                    const step2 = await advanceRefine(context, finalResult.result.generated, params.realText);
                    finalResult = step2;
                }
                
                log(context, "STEP3: 替换客户脸");
                if (finalResult.status == enums.resStatus.OK && finalResult.result?.generated && params.loraCover) {
                    const step3 = await swapFace(params.loraCover, finalResult.result.generated, context);
                    if (step3.status == enums.resStatus.OK && step3.result?.generated) {
                        finalResult = step3;
                    }   
                }
            }

            // 如果模型还没有封面，把生成的图作为封面
            if(!lora.coverImg && finalResult.status == enums.resStatus.OK && finalResult.result.generated && isURL(finalResult.result.generated)){
                await prisma.model.update({
                    where: { code: params.modelurl },
                    data: { coverImg: finalResult.result.generated},
                });                     
            }

            if(finalResult?.result?.generated){
                const step4 = await refine(context, finalResult.result.generated, 2);
                log(context, `outpaint step4 result: ${JSON.stringify(step4)}`);                                            
                if (step4?.status == enums.resStatus.OK && step4?.result?.genRoomId && step4?.result?.generated) {
                    finalResult = step4;
                }                
            } 
            
            // 增加模型使用次数
            await prisma.model.update({
                where: { code: params.modelurl },
                data: { runtimes: {increment: 1 } },
            });                     

            // 如果使用了小模型，那么需要对模型进行分账
            if(lora.userId != context.user.id){
                giveUserModelIncome(lora.userId, lora.id, lora.price, Math.floor(lora.price/2));
            }
        }
        
        return finalResult;
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "takeGroupPhoto": async function(context:any, params:any){
        let finalResult:any;
        params.func = "omnigen-v2";
        const step1 = await callReplicateAndWaitResultWithRes(context, params, undefined, [process.env.SERVICE_OMNIGEN!, process.env.SERVICE_OMNIGEN_BACKUP!]);
        if(step1){
            finalResult = step1;
            const step2 = await refine(context, finalResult.result.generated, 2);
            if (step2?.status == enums.resStatus.OK && step2?.result?.generated) {
                finalResult = step2;
            }                
        }
        return finalResult;
    },    

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "poseAndFace": async function(context:any, params:any){
        let finalResult:any;
        // step 1
        const step1 = await callReplicateAndWaitResultWithRes( context, {
            func:"poseAndFace",                    
            params:params
        });

        if(step1){
            finalResult = step1;
            // step 2
            const step2 = await swapFace(params.image, step1.result.generated, context);
            if (step2.status == enums.resStatus.OK && step2.result?.generated) {
                finalResult = step2;
            }   
        }

        return finalResult;
    },    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////               
    "takePhoto": async function(context:any, params:any){
        let finalResult:any;
        
        let outputWidth = getWidthOfDrawRatio(params.drawRatio);
        let outputHeight = getHeightOfDrawRatio(params.drawRatio);
        let poseImage = params.imageUrl;
        let bgImage = params.bgImage;
        let poseImageMeta;
        let photoInfer = params.inference;

        
        const lora = await prisma.model.findUnique({
            where:{code:params.modelurl}
        });     
        // 增加模型使用次数
        await prisma.model.update({
            where: { code: params.modelurl },
            data: { runtimes: {increment: 1 } },
        });     
        
        if(!lora){
            return await setErrorStatus(context.res, enums.resStatus.expErr, "没有选择套系", context.room, context.user, context.price);
        }        
        const isFluxLora = lora.trainSrv == "fal-ai/flux-lora-general-training";
        
        if(!poseImage && (photoInfer == "beatifulPortrait" || photoInfer == "performancePortrait" || photoInfer == "stylePortrait") ){
            log(context, "STEP_GEN_POS_IMAGE: 没有姿态控制图片，就生成一个");
            const stepPose = await callReplicateAndWaitResultWithRes( context, {
                func: "flux-merged",
                drawRatio: params.drawRatio,
                realText: params.realText,
                inputText: params.inputText,
                seed: params.seed,
            });
            if(stepPose && stepPose.result.generated){ 
                finalResult = stepPose; 
                poseImage = finalResult.result.generated;
            }else{ return; }
        }
            
        // 由于1024的限制，需要调整图片尺寸                
        if(poseImage){
            poseImageMeta = await iu.getImageMeta(poseImage);
            if(poseImageMeta && poseImageMeta.width && poseImageMeta.height){
                outputWidth = poseImageMeta.width;
                outputHeight = poseImageMeta.height;
                params.drawRatio = "";                        
                
                if(photoInfer == "beatifulPortrait" || photoInfer == "performancePortrait" || photoInfer == "stylePortrait"){             
                    log(context, "预处理：由于1024的限制，需要调整图片尺寸");                                    
                    log(context, "poseImageMeta 初始尺寸:", poseImageMeta.width, poseImageMeta.height);                        
                    if( poseImageMeta.width>1024 || poseImageMeta.height>1024 ){
                        poseImage = await iu.resizeImage(poseImage, 1024);
                        // bgImage = await iu.resizeImage(bgImage, 1024);
                        const resizedPoseImageMeta = await iu.getImageMeta(poseImage);
                        if(resizedPoseImageMeta && resizedPoseImageMeta.width && resizedPoseImageMeta.height){                        
                            outputWidth = resizedPoseImageMeta.width;
                            outputHeight = resizedPoseImageMeta.height;
                            log(context, "poseImageMeta resize to:", resizedPoseImageMeta?.width, resizedPoseImageMeta?.height);                                                                                    
                        }
                    }
                }
            }
        }

        if(poseImage && isBase64Image(poseImage)){
            poseImage = await createTempFile(poseImage, context);
        }        
        
        let step0:any;
        if(photoInfer == "beatifulPortrait" || photoInfer == "stylePortrait"){
            log(context, "step 0: 学习风格和脸型");
            step0 = await callReplicateAndWaitResultWithRes(context, {
                func: "stylePortrait", 
                params: {
                    inputText: params.realText,
                    prompt: params.realText,
                    base_image: poseImage, 
                    base_image_strength: 0.2, // poseImage ? 0.2 : 0,                            
                    composition_image: poseImage,
                    composition_image_strength: 0.2,
                    style_image: lora.coverImg,
                    style_image_strength: 1,
                    identity_image: params.faceImage,
                    identity_image_strength: 1,
                    depth_image: poseImage,
                    depth_image_strength: 0.2, // poseImage ? 0.2 : 0,
                }
            });
            if(step0){ finalResult = step0; }else{ return; }
        }
           
        if(photoInfer == "beatifulPortrait" || photoInfer == "performancePortrait" || photoInfer == "normalPortrait"){
            log(context, "step 1 用套系Lora生成人物的套系照片");
            switch(params.inference){
                case "normalPortrait":
                case "performancePortrait":
                case "beatifulPortrait":
                default:
                    params.inference = "fofr / realvisxl-v3-multi-controlnet-lora";
                    break;
            }                            

            params.func = "lora";
            params.imageUrl = step0?.result?.generated || poseImage; // 使用上一步生成的结果来控制画面
            params.width = outputWidth;
            params.height = outputHeight;
            const step1 = await callReplicateAndWaitResultWithRes(context, params);
            if(step1){ finalResult = step1; }else{ return; }
        }

        // 处理异常情况
        if (!(finalResult.status == enums.resStatus.OK && finalResult.result?.generated && isURL(finalResult.result?.generated))) {
            return await setErrorStatus(context.res, finalResult.status, finalResult.result.generated || finalResult.result, context.room, context.user, context.price);
        }

        if(finalResult?.result?.generated && params.bgImage){
            log(context, "如果有背景图就替换");
            // step3 扣出人像
            const cvs = new AliCVService("segmentBody");
            const step3 = await cvs.predict({imageURL: finalResult.result.generated});
            log(context, "step3:" + JSON.stringify(step3));      

            // step4 更换背景                        
            if(!fs.inOSSBucket(bgImage)){
                bgImage = await createTempFile(bgImage, context);
            }
            if(params?.blur > 0){
                log(context, "对图片进行模糊化，力度为：" + params.blur);
                bgImage = await createTempFile(`${bgImage}?x-oss-process=image/blur,r_${params.blur},s_${params.blur}`, context);    
            }
            
            const personImg = await createTempFile(step3.resultURL, context); 
            let pathOfPersonImg = getPathOfURL(personImg);
            if(pathOfPersonImg && pathOfPersonImg.startsWith("/")){
                pathOfPersonImg = pathOfPersonImg.substring(1);
            }                        
            const base64Url = Buffer.from(pathOfPersonImg!).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            const finalImage = await moveToFileServer(`${bgImage}?x-oss-process=image/watermark,image_${base64Url},g_south,y_0`, "U");  
            log(context, "finalImage:" + finalImage);

            // 把最终结果写入换脸图片
            await prisma.room.update({ where:{ id:finalResult.result.genRoomId }, data:{ outputImage: finalImage } });
            
            finalResult.result.generated = finalImage;
        }

        if(photoInfer == "beatifulPortrait" || photoInfer == "performancePortrait" || photoInfer == "normalPortrait"){
            if(finalResult && !isFluxLora){
                log(context, "STEP4: 用FLUX优化画面");
                const step4 = await advanceRefine(context, finalResult.result.generated, params.realText);
                if (step4.status == enums.resStatus.OK && step4.result?.generated) {
                    finalResult = step4;
                }                    
            }

            if(finalResult){
                log(context, "STEP:5 替换客户脸");
                let step5 = await swapFaceHD(params.faceImage, finalResult.result.generated, context);                    
                if (step5.status == enums.resStatus.OK && step5.result?.generated) {
                    finalResult = step5;
                }   
            }
        }

        // 如果曾经被缩小尺寸，就做一次放大
        if(finalResult?.result?.generated){
            const step6 = await refine(context, finalResult.result.generated, 2);
            log(context, `outpaint STEP6 result: ${JSON.stringify(step6)}`);                                            
            if (step6?.status == enums.resStatus.OK && step6?.result?.genRoomId && step6?.result?.generated) {
                finalResult = step6;
            }                
        }       
        
        // 如果使用了小模型，那么需要对模型进行分账
        if(lora && lora.userId != context.user.id){         
            giveUserModelIncome(lora.userId, lora.id, lora.price, Math.floor(lora.price/2));
        }
        
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "draftFree": async function(context:any, params:any){
        params.prompt = ` A real photo. ${params.prompt}`;
        const finalResult = await callReplicateAndWaitResultWithRes(context, {
            func: "flux-canny-pro", inputText:params.prompt,
            params,
        });
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "controlImage": async function(context:any, params:any){
        const finalResult = await callReplicateAndWaitResultWithRes(context, {
            func: params.model, inputText:params.prompt,
            params,
        });
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "simImage": async function(context:any, params:any){
        let finalResult:any;
        log(context, "STEP1: 用Flux重新生成图片");
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func: "simImage",
            params,
        });
        if(step1){ 
            finalResult = step1; 
            log(context, "STEP2: 如果只有一张脸，就替换客户脸");
            const jsonResponse = await AliCVService.detectFaces(params.imageURL); 
            if(jsonResponse?.status != "ERROR" && jsonResponse.faces.length==1){
                let step2 = await swapFace(params.imageURL, step1.result.generated, context); 
                if (step2.status == enums.resStatus.OK && step2.result?.generated) {
                    finalResult = step2;
                }   
            }
        }
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changePerson": async function(context:any, params:any){
        let finalResult:any;
        
        // 从传入参数抠出衣服
        let maskImageURL = params.maskImage; // await createTempFile(params.maskImage, context);
        //let clothImageURL = await AliCVService.segmentCloth(params.image); // , {returnForm:"mask"});
        //let bodyMask = await AliCVService.segmentBody(params.image, {returnForm:"mask"});
        
        // log(context, "clothImageURL:", clothImageURL);       
        // 生成inpaint结果
        if(maskImageURL){
            //bodyMask = await createUSTempFile(bodyMask, context);
            //clothImageURL = await createTempFile(clothImageURL, context);
            //params.image = await createUSTempFile(params.image, context);
            
            switch(params.changeMode){
                case "model":
                    /*
                    params.func = "lora";
                    params.loraCover = params.loraCover;
                    params.imageUrl = params.image;
                    params.controlNet = "depth_midas";
                    params.realText = params.prompt + ", nude, pure white backgournd";
                    params.inputText = params.prompt + ", nude, pure white backgournd";
                    params.modelurl = params.lora;     
                    params.controlStrength = params.controlStrength || 1.1;
                    */
                    params.func = "flux-controlnet-inpaint-lora";
                    params.params = {
                        prompt: params.prompt,
                        image: params.image,
                        mask: maskImageURL,
                        loraCode: params.lora,
                        controlStrengh: 0.45,
                        imageStrength: params.strength,
                        loraScale: params.strength,
                    }
                    break;
                    
                case "prompt":
                default:
                    /*
                    params.func = "flux-canny-pro";
                    params.params = {
                        imageURL : params.image,
                        prompt: params.prompt || " a person, nude, pure white background",
                        guidance: 30,   
                    };
                    */
                    params.func = "ideogram-v3-quality"; // "flux-dev-inpainting-controlnet";
                    params.params = {
                        prompt: params.prompt,
                        image: params.image,
                        mask: maskImageURL,
                        controlStrengh: 0.9,
                    }
                    break;
            }
                    

            const step1 = await callReplicateAndWaitResultWithRes(context, params);
            if (step1) {
                finalResult = step1;      
/*
                if(finalResult.result?.generated){
                    let newPersonImage = finalResult.result.generated;
                    if(fu.isBase64Image(newPersonImage)){
                        newPersonImage = await createTempFile(newPersonImage, context);
                    }
                   
                    // let newBody = await AliCVService.segmentBody(newPersonImage);                                            
                    
                    // 所有图片以body的newSize为准
                    const newSize = await iu.getImageSize(newPersonImage); 
                    
                    //putToTempList(newBody, context);                    
                    if(newSize && newSize.width && newSize.height && newPersonImage){
                        // 扣出结果图的身体部分
                        // 把服装贴到生成的图上
                     /*   let originalImage = params.image;
                        const imageSize = await iu.getImageSize(params.image);
                        if(imageSize?.height != newSize.height || imageSize?.width != newSize.width){
                            const img = await iu.resizeImageToSize(params.image, newSize);
                            if(img){
                                originalImage = img;
                                putToTempList(img, context);                            
                            }
                        }
                    */
/*                
                        const clothSize = await iu.getImageSize(clothImageURL);
                        if(clothSize?.height != newSize.height || clothSize?.width != newSize.width){
                            const resizedCloth = await iu.resizeImageToSize(clothImageURL, newSize);
                            if(resizedCloth){
                                clothImageURL = resizedCloth;
                                putToTempList(resizedCloth, context);                            
                            }
                        }
                        
                        const comboImage = await iu.putImagesOnImage(
                            newPersonImage, 
                            [
                         //       {imageURL:newBody, x:0, y:0, width:newSize.width, height:newSize.height},
                                {imageURL:clothImageURL, x:0, y:0, width:newSize.width, height:newSize.height},                                
                            ]);
                        if(comboImage){
                            finalResult.result.generated = comboImage;
                        }
                    }
                }
*/        
            }
        }else{
            await setErrorStatus(context.res, enums.resStatus.noResultErr, "没有识别出人体的区域，请换一张照片试试！", context.room, context.user, context.price);
        }
        return finalResult;
    },    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "takeIDPhoto": async function(context:any, params:any){
        let finalResult:any;
        // STEP 1 faceswap
        let step1:any;
        if(params.func == "facefusion"){
            step1 = await advanceSwapFace(params.swap_image, params.target_image, context, {strength:90}); 
        }else{
            step1 = await swapFace(params.swap_image, params.target_image, context); 
        }
        if(step1){
            finalResult = step1;
            
            // STEP 2 抠出人像
            log(context, "params:" + JSON.stringify(params));
            if(params.background != "default"){
                // 通过阿里云获得图片的人物抠图
                let imgSize = await iu.getImageSize(finalResult.result.generated);
                if(imgSize && (imgSize.width>2000 || imgSize.height>2000)){
                    finalResult.result.generated = await iu.resizeImage(finalResult.result.generated, 2000);
                    imgSize = await iu.getImageSize(finalResult.result.generated);
                }
                const cvs = new AliCVService("segmentBody");
                const step2 = await cvs.predict({imageURL: finalResult.result.generated});
                log(context, "step2:" + JSON.stringify(step2));                    
                
                if(step2?.status == "OK"){
                    // STEP3 叠加颜色
                    if(imgSize){
                        // const bgImg = `${config.FS}/R/bg/${params.background}.jpg`;
                        let color:any = {r:255, g:255, b:255};
                        switch(params.background){
                            case "blue_bg": color = {r:59, g:159, b:227}; break;
                            case "red_bg": color = {r:191, g:16, b:19}; break;
                            case "white_bg": color = {r:230, g:230, b:230}; break;
                        }                            
                        const bgImg = await iu.generateSolidColorImage(imgSize.width, imgSize.height, color);
                        
                        const maskImg = await createTempFile(step2.resultURL, context); 
                        log(context, "mask image:", maskImg);
                        let pathOfMaskImg = getPathOfURL(maskImg);
                        if(pathOfMaskImg && pathOfMaskImg.startsWith("/")){
                            pathOfMaskImg = pathOfMaskImg.substring(1);
                        }             
                        const base64Url = Buffer.from(pathOfMaskImg!).toString('base64')
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=/g, '');
                        log(context, "prepair final Image:", `${bgImg}?x-oss-process=image/watermark,image_${base64Url},g_nw,x_0,y_0`);
                        const finalImage = await moveToFileServer(`${bgImg}?x-oss-process=image/watermark,image_${base64Url},g_nw,x_0,y_0`);  
                        log(context, "finalImage:" + finalImage);
                        
                        // 把最终结果写入换脸图片
                        await prisma.room.update({ where:{ id:context.room.id }, data:{ outputImage: finalImage } });
                        finalResult.result.generated = finalImage;
                    }
                }
            }
        }
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////  
    "repairImage": async function(context:any, params:any){
        return await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            params
        });
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "zoomIn": async function(context:any, params:any){
        let finalResult:any
        // step 1
        params.func = "zoomIn";

        // 把视频文件传到美国
        // params.params.image = await createUSTempFile(params.params.image, context);
        
        const step1 = await callReplicateAndWaitResultWithRes(context, params);
        // step 2
        if(step1){
            finalResult = step1;

            if(params.keepFace && finalResult.result.generated){
                const step2 = await swapFace(params.params.image, finalResult.result.generated, context); 
                if(step2?.result?.generated){
                    finalResult = step2;
                }
            }
        }
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeHair": async function(context:any, params:any){    
        let finalResult: any;
        params.image = await createUSTempFile(params.image, context);
        // 生成inpaint结果
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            params: {
                image: params.image,
                prompt: params.prompt,
                mask: params.maskImage,
                num_outputs: 1,
                output_format: "jpg"                    
            }
        });
        if (step1) {
            finalResult = step1;
            if(finalResult.result.generated){
                const step2 = await swapFaceHD(params.image, finalResult.result.generated, context); 
                if(step2?.result?.generated){
                    finalResult = step2;
                }
            }          
        }
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "adInHand": async function(context:any, params:any){    
        return await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            drawRatio: params.drawRatio,
            params
        });
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "adCloth": async function(context:any, params:any){    
        return await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            drawRatio: params.drawRatio,
            params
        });
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeCloth": async function(context:any, params:any){   
        let finalResult:any;
        // 从传入参数生成一张MASK IMAGE URL
        let maskImageURL = params.maskImage;
        let originalImageURL = params.image;

        if(params.clothChangeMethod === "vton"){
            params.func = "kolors-virtual-try-on";
            params.params = {
                human_image_url: params.image,
                garment_image_url: params.refImage
            }
            const serviceLines = [process.env.SERVICE_VTON];
            return await callReplicateAndWaitResultWithRes(context, params, undefined, serviceLines);
        }

        // 生成inpaint结果
        if(maskImageURL){
            switch(params.clothChangeMethod){
                case "lora": 
                    log(context, "有lora就用inpaint lora");
                    params.func = "inpaint_lora_cloth";
                    const imageSize = await iu.getImageSize(params.image);
                    if(imageSize){
                        params.params = {
                            image : params.image,
                            controlnet_1: "soft_edge_hed",
                            controlnet_1_image: params.image,
                            controlnet_1_conditioning_scale: 0.75,
                            controlnet_1_start: 0,
                            controlnet_1_end: 1,
                            loraCode : params.lora,
                            lora_scale : params.strength, // 0.6,
                            mask : maskImageURL,
                            height: imageSize.height!,
                            width: imageSize.width!,
                            num_inference_steps : 30,
                            prompt_strength : params.strength,                            
                        }
                    }
                    break;

                case "refModel":
                    log(context, "把RefImage变成和原图一样高");
                    params.image = await iu.concatImage(params.image, params.refImage);
                    putToTempList(params.image, context);
                    
                    log(context, "把maskImage扩展成一样大");
                    maskImageURL = await iu.enlargeMask(maskImageURL, params.image);
                    putToTempList(maskImageURL, context);
                    
                    params.prompt = "Replace with clothes of the exact same color and style as another character.";
                    log(context, "调用inpaint:flux-fill-pro");
                    params.func = "flux-fill-pro";
                    params.params = {
                        image : params.image,                        
                        mask : maskImageURL,
                        prompt: params.prompt,
                        num_outputs: 1,
                        output_format: "jpg",
                        output_quality: 100
                    };
                    break;
                    
                case "free":
                    log(context, "调用inpaint:flux-fill-pro");
                    params.func = "ideogram-v3-quality";
                    params.params = {
                        image : await createUSTempFile(params.image, context),                        
                        mask : await createUSTempFile(maskImageURL, context),
                        prompt: params.prompt,
                        num_outputs: 1,
                        output_format: "jpg",
                        output_quality: 100
                    };
                    break;


            }
            const step1 = await callReplicateAndWaitResultWithRes(context, params);
            if(step1) {
                finalResult = step1;
                
                if(params.clothChangeMethod=="refModel" && isURL(finalResult.result?.generated)){
                    // 先把原图缩放到和结果图一样高度
                    const sameHeightOrg = await iu.resizeToSameHeight(originalImageURL, finalResult.result.generated);
                    if(sameHeightOrg){
                        putToTempList(sameHeightOrg, context);
                        finalResult.result.generated = await iu.cutImage(finalResult.result.generated, sameHeightOrg);
                    }
                }
            }
        }else{
            await setErrorStatus(context.res, enums.resStatus.noResultErr, "衣服的区域没有被正确识别，请重新操作！", context.room, context.user, context.price);
        }

        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "removeObject": async function(context:any, params:any){
        let finalResult:any;
        // 从传入参数生成一张MASK IMAGE URL
        let maskImageURL;
        if(params.maskImage){
            if(isBase64Image(params.maskImage)){
                maskImageURL = await createTempFile(params.maskImage, context);
            }else{
                maskImageURL = params.maskImage;
            }
            
            if(maskImageURL){
                log(context, "直接调用inpaint:" + params.func);
                params.params = {
                    height: params.height,
                    width: params.width,
                    image : params.image,                        
                    mask : maskImageURL,
                    prompt: params.prompt
                };
                const step1 = await callReplicateAndWaitResultWithRes(context, params);
                if (step1) {
                    finalResult = step1;

                    const step2 = await refine(context, finalResult.result.generated, 2);
                    if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                        finalResult = step2;
                    }                
                }
            }else{
                await setErrorStatus(context.res, enums.resStatus.noResultErr, "选中的区域没有被正确识别，请重新操作！", context.room, context.user, context.price);
            }
        }else{
             await setErrorStatus(context.res, enums.resStatus.noResultErr, "没有选中一个区域，或者选中的区域太小，请重新操作！", context.room, context.user, context.price);
        }
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "inpaint": async function(context:any, params:any){    
        let finalResult:any;
     
        const model = mt.inpaintModelMap.get(params.func);

        if(!model){
            await setErrorStatus(context.res, enums.resStatus.unExpErr, "系统发生意外失败，没有选择正确的修图模型！", context.room, context.user, context.price);
        }
        // 从传入参数生成一张MASK IMAGE URL
        let maskImageURL;
        if(params.maskImage){
            if(isBase64Image(params.maskImage)){
                maskImageURL = await createUSTempFile(params.maskImage, context);
            }else{
                maskImageURL = params.maskImage;
            }
        }
        log(context, "inpaint mask:" + maskImageURL);
        if(model.needMask && !maskImageURL){ // 需要遮罩却没有或者空的 
            return await setErrorStatus(context.res, enums.resStatus.inputErr, "您还没有在原图上选择重绘区域！", context.room, context.user, context.price);
        }

        let imageByMask = await createUSTempFile(params.image, context);
        
        log(context, "直接调用inpaint:" + params.func);
        params.params = {
            height: params.height,
            width: params.width,
            img1: imageByMask,
            image : imageByMask,  
            imageURLs : [imageByMask], // 针对GPT
            mask : maskImageURL,
            prompt: params.prompt
        };
        const step1 = await callReplicateAndWaitResultWithRes(context, params);
        if (step1) {
            finalResult = step1;
        }
        return finalResult;
    },    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeLanguage": async function(context:any, params:any){    
        let finalResult:any;
        const fromLangName = lt.languageNames.get(params.fromLang);
        const toLangName = lt.languageNames.get(params.toLang);
        let prompt = `把所有文字从${fromLangName}翻译成${toLangName}，保留现有排版格式，并适当调整格式以适应${toLangName}显示。所有${toLangName}、符号和其它文字都保持内容不变，为了与${toLangName}结果配合可以适当调整字体和颜色。`;

        if(params.maskImage){
            params.maskImage = await createUSTempFile(params.maskImage, context);
        }
      
        // 从传入参数生成一张MASK IMAGE URL
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func: params.func,
            params: {
                imageURL: params.imageURL,
                imageURLs : [params.imageURL],                        
                mask : params.maskImage,
                prompt: prompt,
            }
        });
        if (step1) {
            finalResult = step1;
        }

        return finalResult;
    },  
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "inpaintGPT": async function(context:any, params:any){    
        let finalResult:any;
        // 从传入参数生成一张MASK IMAGE URL
        let maskImageURL;
        // if(params.target_rect && params.target_rect.width>2 && params.target_rect.height>2){
            //maskImageURL = await generateRectMaskImage(params.width, params.height, params.target_rect.x, params.target_rect.y, params.target_rect.width, params.target_rect.height);
        if(params.maskImage){
            maskImageURL = await createUSTempFile(params.maskImage, context);
            if(maskImageURL){
                params.params = {
                    imageURLs : params.imageURLs,                        
                    mask : maskImageURL,
                    prompt: params.prompt
                };
                const step1 = await callReplicateAndWaitResultWithRes(context, params);
                if (step1) {
                    finalResult = step1;
                }
            }else{
                await setErrorStatus(context.res, enums.resStatus.noResultErr, "选中的区域没有被正确识别，请重新操作！", context.room, context.user, context.price);
            }
        }else{
             await setErrorStatus(context.res, enums.resStatus.noResultErr, "没有选中一个区域，或者选中的区域太小，请重新操作！", context.room, context.user, context.price);
        }
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "inpaintGemini": async function(context:any, params:any){  
        let finalResult:any;

        const orgSize = await iu.getImageSize(params.params.image);

        const step1 = await callReplicateAndWaitResultWithRes(context, params);
        if(step1){
            finalResult = step1;
            if(step1.result?.generated){
                const newSize = await iu.getImageSize(step1.result?.generated);
                if(newSize && orgSize && (newSize.width<orgSize.width || newSize.height<orgSize.height)){
                    const step2 = await refine(context, finalResult.result.generated, 2);
                    if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                        finalResult = step2;
                    }                
                }
            }
        }
        
        return finalResult;
    },      
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "putModelInReal": async function(context:any, params:any){    
        let finalResult:any;
        // 从传入参数生成一张MASK IMAGE URL
        let maskImageURL;
        if(params.target_rect && params.target_rect.width>50 && params.target_rect.height>50){
            maskImageURL = await generateRectMaskImage(params.width, params.height, params.target_rect.x, params.target_rect.y, params.target_rect.width, params.target_rect.height);
            if(maskImageURL){
                log(context, "直接调用flux-lora-fill:" + params.func);
                params.func = "flux-lora-fill";
                params.params = {
                    height: params.height,
                    width: params.width,
                    image : params.image,                        
                    mask : maskImageURL,
                    prompt: params.prompt
                };
                const lora = await prisma.model.findUnique({where:{code:params.lora}});
                if(lora){
                    switch(lora.trainSrv){
                        case "ostris / flux-dev-lora-trainer":
                            params.params.loraURL = lora.safetensors;
                            break;
                        case "fal-ai/flux-lora-general-training":
                            params.params.loraURL = lora.url;
                            break;
                    }
                    const step1 = await callReplicateAndWaitResultWithRes(context, params);
                    if (step1) {
                        finalResult = step1;
    
                        const step2 = await refine(context, finalResult.result.generated, 2);
                        if (step2?.status == enums.resStatus.OK && step2?.result?.genRoomId && step2?.result?.generated) {
                            finalResult = step2;
                        }                
                    }
                }
            }else{
                await setErrorStatus(context.res, enums.resStatus.noResultErr, "选中的区域没有被正确识别，请重新操作！", context.room, context.user, context.price);
            }
        }else{
             await setErrorStatus(context.res, enums.resStatus.noResultErr, "没有选中一个区域，或者选中的区域太小，请重新操作！", context.room, context.user, context.price);
        }
        return finalResult;
    },    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "simStyle": async function(context:any, params:any){  
        return await callReplicateAndWaitResultWithRes(context, {
            func:params.func,
            inputText:params.prompt,
            realText:params.prompt,
            drawRatio:params.drawRatio,
            imageUrl:params.styleImage
        });
    },    
      
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeStyle": async function(context:any, params:any){    
        let finalResult:any;
        
        let step1;
        let outputWidth = 576;
        let outputHeight = 1024;
        let poseImage = params.imageURL;
        let poseImageMeta;
        // 由于1024的限制，需要调整图片尺寸
        if(poseImage){
            poseImageMeta = await iu.getImageMeta(poseImage);
            if(poseImageMeta && poseImageMeta.width && poseImageMeta.height){
                log(context, "poseImageMeta 初始尺寸:", poseImageMeta.width, poseImageMeta.height);                        
                if( poseImageMeta.width>1024 || poseImageMeta.height>1024 ){
                    poseImage = await iu.resizeImage(poseImage, 1024);
                    const resizedPoseImageMeta = await iu.getImageMeta(poseImage);
                    if(resizedPoseImageMeta && resizedPoseImageMeta.width && resizedPoseImageMeta.height){                        
                        outputWidth = resizedPoseImageMeta.width;
                        outputHeight = resizedPoseImageMeta.height;
                        log(context, "poseImageMeta resize to:", resizedPoseImageMeta?.width, resizedPoseImageMeta?.height);                                                                                    
                    }
                }else{
                    outputWidth = poseImageMeta.width;
                    outputHeight = poseImageMeta.height;
                }
            }
        }
        switch(params.changeMode){
            case "LORA": {
                log(context, "STEP1: control net lora");
                params.func = "lora";
                params.imageUrl = poseImage; // 使用用户照片
                params.width = outputWidth;
                params.height = outputHeight;
                params.modelurl = params.loraCode;    
                params.inference = "fofr / realvisxl-v3-multi-controlnet-lora";                    
                //params.inference = "fofr / sdxl-multi-controlnet-lora";
                params.realText = params.prompt || "a person";
                step1 = await callReplicateAndWaitResultWithRes(context, params);
                break;
            }
            case "FREE": {
                log(context, "STEP1: style transfer");
                step1 = await callReplicateAndWaitResultWithRes(context, {
                    func: "styleTransfer",
                    params:{
                        structure_image: poseImage,
                        style_image: params.styleImage,
                        prompt: params.prompt || "  an image, masterpiece, best quality, highres ",
                        structure_depth_strength: params.controlStrength * 2,
                        model: "high-quality", // "high-quality", // "realistic"
                        output_format: "jpg",
                        output_quality: 100,
                    }
                });
                break;
            }
            case "FREE2":{
                log(context, "STEP1: style transfer");
                step1 = await callReplicateAndWaitResultWithRes(context, {
                    func: "style-transfer",
                    params:{
                        image: poseImage,
                        image_style: params.styleImage,
                        prompt: params.prompt || " an image, masterpiece, best quality, highres",
                        structure_strength: params.controlStrength * 2,
                        style_strength: params.styleStrength * 2,
                        output_format: "jpg",
                        output_quality: 100,
                    }
                });
                break;
            }
        }
        if(step1){
            finalResult = step1;
        }                
        
        // const step2 = await swapFace(poseImage, finalResult.result.generated, context);
        //if(step2.status == enums.resStatus.OK && step2?.result?.generated){
        //    finalResult = step2;
        //}
        
        return finalResult;        
    },    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeBG": async function(context:any, params:any){    
        let finalResult:any;
        switch(params.changeMode){
            case "hard": {
                // STEP 1 获得人物抠图
                params.func = "removeBG";
                params.imageUrl = params.imageURL;
                
                log(context, "original photo: ", params.imageUrl);
                //处理图片，让它小于等于背景尺寸
                params.imageUrl = await iu.resizeToBound(params.imageUrl, params.bgImage);
                log(context, "original photo resize to bound: ", params.imageUrl);            
                // 让图片尺寸小于2000
                params.imageUrl = await iu.resizeImage(params.imageUrl, 2000);
                log(context, "original photo resize 2000: ", params.imageUrl);

                params.imageUrl = await createUSTempFile(params.imageUrl, context);
                const step1 = await callReplicateAndWaitResultWithRes(context, params);
                if (step1) {
                    finalResult = step1;
                    // STEP 2 硬贴图
                    let bgImage = params.bgImage;
                    if(!fs.inOSSBucket(bgImage) || bgImage.indexOf("x-oss-process=image")>0){
                        log(context, "图片不在桶里，就先上传到桶里");
                        bgImage = await createTempFile(bgImage, context);
                    }
                    if(params?.blur > 0){
                        log(context, "对图片进行模糊化，力度为：" + params.blur);
                        if(bgImage.indexOf("x-oss-process=image")>0){
                            bgImage = await createTempFile(`${bgImage}/blur,r_${params.blur},s_${params.blur}`, context);        
                        }else{
                            bgImage = await createTempFile(`${bgImage}?x-oss-process=image/blur,r_${params.blur},s_${params.blur}`, context);    
                        }
                    }
                    let maskImg = finalResult.result.generated;                 
                    if(!fs.inOSSBucket(maskImg)){
                        maskImg = await createTempFile(maskImg, context);
                    }
                    let pathOfMaskImg = getPathOfURL(maskImg);
                    if(pathOfMaskImg && pathOfMaskImg.startsWith("/")){
                        pathOfMaskImg = pathOfMaskImg.substring(1);
                    }                        
                    const base64Url = Buffer.from(pathOfMaskImg!).toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
                    const finalImage = await moveToFileServer(`${bgImage}?x-oss-process=image/watermark,image_${base64Url},g_south,y_0`, "U");
                    log(context, "finalImage:" + finalImage);
                    
                    finalResult.result.generated = finalImage;
                }
                break;
            }
            case "auto": {
                log(context, "original photo: ", params.params.subject_image);
                //处理图片，让它小于等于背景尺寸
                //params.params.subject_image = await iu.resizeToBound(params.params.subject_image, params.params.background_image);
                //log(context, "original photo resize to bound: ", params.params.subject_image);                        
                let size = await iu.getImageSize(params.params.subject_image);
                if(size && size.width && size.height){
                    // 2. 明确后续代码中 size 的类型为非 undefined
                    const validSizes = [256,320,384,448,512,576,640,704,768,832,896,960,1024];
                    const originalRatio = size.height / size.width;
                    
                    // 3. 等比缩放（确保缩放后的 width/height 不会为负数）
                    let scaledWidth = size.width;
                    let scaledHeight = size.height;
                    if (size.width > 1024 || size.height > 1024) {
                        const scale = Math.min(1024 / size.width, 1024 / size.height);
                        scaledWidth = Math.max(size.width * scale, 256);
                        scaledHeight = Math.max(size.height * scale, 256);
                    }
                    
                    // 4. 候选尺寸计算（避免直接修改原 size 对象）
                    const candidateWidth = validSizes.find(w => w >= scaledWidth) ?? 1024;
                    const minHeightForWidth = candidateWidth * originalRatio;
                    const adjustedHeight = validSizes.find(h => h >= minHeightForWidth) ?? 1024;
                    
                    const candidateHeight = validSizes.find(h => h >= scaledHeight) ?? 1024;
                    const maxWidthForHeight = candidateHeight / originalRatio;
                    const adjustedWidth = validSizes.filter(w => w <= maxWidthForHeight).pop() ?? 256;
                    
                    // 5. 选择最优解
                    const useWidthOption = Math.abs(candidateWidth - scaledWidth) + Math.abs(adjustedHeight - scaledHeight);
                    const useHeightOption = Math.abs(adjustedWidth - scaledWidth) + Math.abs(candidateHeight - scaledHeight);
                    
                    const finalSize = useWidthOption <= useHeightOption 
                        ? { width: candidateWidth, height: adjustedHeight }
                        : { width: adjustedWidth, height: candidateHeight };
                    
                    // 6. 确保最终值合法
                    finalSize.width = Math.min(finalSize.width, 1024);
                    finalSize.height = Math.min(finalSize.height, 1024);
                    
                    // 7. 将结果赋回原变量（如果必须修改原对象）
                    size = finalSize;
                }else{
                    size = {
                        width : 768,
                        height : 1024
                    }
                }
                params.params.width = size.width;
                params.params.height = size.height;
                params.func = "ic-light-background";
                finalResult = await callReplicateAndWaitResultWithRes(context, params);

                break;
            }         

          case "gpt-image-1-edit-medium":{
              finalResult = await callReplicateAndWaitResultWithRes(context, {
                  func : params.func,
                  params : {
                      prompt: "把第一张图的人物放在第二张图的背景里，保持第一张图中人物的面部不变",
                      imageURLs: [params.params.subject_image, params.params.background_image],
                  }
              });
              break;
          }
            
            default: {
                let inputImage = params.params.image;              
                if(params.changeMode.startsWith("flux-kontext-")){
                    params.params.prompt = `change the background to: ${params.params.prompt}`;
                    inputImage = await createUSTempFile(params.params.image, context);
                }
                finalResult = await callReplicateAndWaitResultWithRes(context, {
                    func : params.func,
                    params : {
                        prompt: params.params.prompt,
                        image_url: inputImage,
                        input_image: inputImage,
                    }
                });
            }
        }
        
        return finalResult;
    },

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeExpression": async function(context:any, params:any){    
        let finalResult:any;
        
        let targetImage = params.imageURL;
        
        log(context, "STEP1: 截出面部区域");
        let faceRect = params.targetRect;
        let faceImage = params.imageURL;
        const hasFaceRect:boolean = !!(faceRect && faceRect.width && faceRect.height);
        if(hasFaceRect){
            const imageSize = await iu.getImageSize(faceImage);
            if(imageSize && imageSize.width && imageSize.height){          
                // 调整区域为正方形            
                faceRect = fu.makeSquareRect(faceRect, imageSize.width, imageSize.height);
                log(context, "faceRect:", faceRect);

                if(params.func == "live-portrait-image" || params.func == "flux-kontext-pro"){
                    // 放大区域，但是不要超过范围
                    faceRect = fu.scaleUpRect(faceRect, 1.5, imageSize.width, imageSize.height);
                }
            }
            
            const newFaceImage = await iu.cutRectFromImage(faceImage, {left:faceRect.x, top:faceRect.y, width:faceRect.width, height:faceRect.height});
            if(newFaceImage){
                faceImage = newFaceImage;
                params.imageURL = faceImage;         
                params.image = faceImage;
                const newImageSize = await iu.getImageSize(faceImage);
                faceRect.width = newImageSize?.width || faceRect.width;
                faceRect.height = newImageSize?.height || faceRect.height;
                putToTempList(newFaceImage, context);
            }
        }                    
        
        log(context, "STEP2: 对面部区域进行修饰");
        const imageRatio = faceRect.height / faceRect.width;
      //  params.src_ratio = imageRatio;
       // params.sample_ratio = imageRatio;
        log(context, "faceRect:", faceRect);
        log(context, "params:", params);
        const step2 = await callReplicateAndWaitResultWithRes(context, { func: params.func, params} );
        
        if (step2) {
            finalResult = step2;
            
            log(context, "STEP3: 贴回面部区域");
            if(hasFaceRect){
                const border = 3;                    
                // 把换脸结果按照给定的矩形，贴回原来的目标换图
                let rectGenImage = finalResult.result.generated;

                // 把结果调整到切图原有尺寸
                rectGenImage = await iu.resizeImageToSize(rectGenImage, {width:faceRect.width, height:faceRect.height});
                putToTempList(rectGenImage, context);
                // 因为生成的图片经常有黑边，所以要四周各裁剪3像素
                rectGenImage = await iu.cutRectFromImage(rectGenImage, {left:border, top:border, width:faceRect.width-border*2, height:faceRect.height-border*2});
                putToTempList(rectGenImage, context);
                // 贴回原图
                finalResult.result.generated = await iu.putImagesOnImage(
                  targetImage,
                  [{imageURL:rectGenImage, x: faceRect.x+border, y:faceRect.y+border, width:faceRect.width-border*2, height:faceRect.height-border*2}]
                );
            }

            log(context, "STEP4:让图片更清晰");
            
            if(params.func == "live-portrait-image" && finalResult?.result?.generated){
                const step4 = await refine(context, finalResult.result.generated, 2);
                if(step4?.result?.generated){
                    putToTempList(finalResult.result.generated, context);                  
                    finalResult = step4;
                }
            }
        }
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "simulateColorTone": async function(context:any, params:any){    
        let finalResult:any;
        const step1 = params.changeMode === "RGB" ? 
          params.adjustImageURL
          :
          await iu.simulateColorTone(params.imageURL, params.templateURL, params.strength);
      
        if(step1){
            finalResult = {
                status: enums.resStatus.OK,
                result: {
                    generated: step1,
                    genRoomId: context.room.id
                }
            }
        }else{
            finalResult = {
                status: enums.resStatus.unknownErr,
                result: {
                    generated: "调整色彩色调时发生未知错误！",
                    genRoomId: context.room.id
                }
            }
        }
        return finalResult;
    },        
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "decoratePhoto": async function(context:any, params:any){    
        let finalResult:any;
        
        let targetImage = params.imageURL;
        
        log(context, "STEP1: 截出面部区域并扩大一倍");
        const faceRect = params.targetRect;
        let faceImage = params.imageURL;
        const hasFaceRect:boolean = (params.func != "faceBeauty") &&
            (!!(faceRect && faceRect.width && faceRect.height));
        if(hasFaceRect){
            if(faceImage && !fs.inOSSBucket(faceImage)){ // 非阿里云图片
                faceImage = await createTempFile(faceImage, context);
            }       
            faceImage = `${faceImage}${faceImage.indexOf("x-oss-process=image")<0 ? "?x-oss-process=image" : ""}/crop,x_${faceRect.x},y_${faceRect.y},w_${faceRect.width},h_${faceRect.height}`;
            params.imageURL = faceImage;                    
        }                    
        
        log(context, "STEP2: 对面部区域进行修饰");
        let step2 = await callReplicateAndWaitResultWithRes(context, {
            func : params.func,
            email: context.userEmail,
            roomId: context.room.id,
            params : params
        });
                
        if (step2) {
            finalResult = step2;
            
            log(context, "STEP3: 贴回面部区域");
            if(hasFaceRect){
                const border = 3;                    
                // 把换脸结果按照给定的矩形，贴回原来的目标换图
                let rectGenImage = finalResult.result.generated;

                if(params.func == "enhanceFace"){
                    rectGenImage = await iu.resizeImageToSize(rectGenImage, {width:faceRect.width, height:faceRect.height});
                }
                if(rectGenImage && (!fs.inOSSBucket(rectGenImage) || rectGenImage.indexOf("x-oss-process=image")>=0)){ // 非阿里云图片
                    rectGenImage = await createTempFile(rectGenImage, context);
                }
                // 因为生成的图片经常有黑边，所以要四周各裁剪3像素
                let pathOfGenImage = getPathOfURL(rectGenImage) + 
                    `?x-oss-process=image/crop,x_${border},y_${border},w_${faceRect.width-border*2},h_${faceRect.height-border*2}`;
                if(pathOfGenImage && pathOfGenImage.startsWith("/")){
                    pathOfGenImage = pathOfGenImage.substring(1);
                }
                const base64Url = Buffer.from(pathOfGenImage!).toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
                // 贴回原图
                finalResult.result.generated = `${targetImage}${targetImage.indexOf("x-oss-process=image")<0 ? "?x-oss-process=image" : ""}/watermark,image_${base64Url},g_nw,x_${faceRect.x+border},y_${faceRect.y+border}`;
            }
            
            finalResult.result.generated = await moveToFileServer(finalResult.result.generated, "U");
            await prisma.room.update({ where:{ id:context.room.id}, data:{ outputImage: finalResult.result.generated} });            
        }
        return finalResult;
    },
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "changeBCS": async function(context:any, params:any){    
        let newImage = params.adjustImageURL;
        if(!newImage){
            error(context, "前台调整图片亮度等发生错误，后台进行调整!");
            newImage = await iu.adjustImage(
                params.imageURL, 
                {
                    temperature: params.temperature,
                    bright: params.bright,
                    contrast: params.contrast,
                    sharpen: params.sharpen
                });
        }
        const finalResult = {
            status: enums.resStatus.OK,
            result: {
                generated: newImage,
                genRoomId: context.room.id
            }
        }
        return finalResult;
    },    
    
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// 视频相关
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "video2cartoon": async function(context:any, params:any){
        let finalResult:any;
        return await callReplicateAndWaitResultWithRes(
            context, 
            {
                func:"video-style-transform", 
                params
            }
        );
    },      
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "createSong": async function(context:any, params:any){
        let finalResult:any;
        log(context, "切分歌词");
        const segments:string[] = tu.splitToSentences(params.lyrics, 125);
        if(params.voice_file){
            try{
                const vt = await au.extractVocals(params.voice_file, "T");
                if(vt){
                    params.voice_file = vt;
                    putToTempList(vt, context);
                }
            }catch(e){
                error(context, "createSong extractVocals error:", e);
            }
        }        
        log(context, "每段歌词都创建一首一首音乐");
        const steps:any[] = [];
        //const lenSongFile = params.song_file ? await au.getDuration(params.song_file) : 0;
        //const lenVoiceFile = params.voice_file ? await au.getDuration(params.voice_file) : 0;
        //const lenInstFile = params.instrumental_file ? await au.getDuration(params.instrumental_file) : 0;
        const segCount = segments.length;

        async function getAudioSegment(url:string, len:number, count:number, i:number, context:any){
            let result = url;
            if(url && count>1 && len>60){            
                let segLen = len/count > 60 ? len/count : 60;
                let startPoint = ((len/count)*i + segLen) < len ? (len/count)*i : (len - segLen);
                result = await au.trimAudio(url, startPoint, segLen, "T");
                putToTempList(result, context);                
            }
            return result;
        }

        for(let i=0; i<segCount; i++){
            let songFile = params.song_file; // await getAudioSegment(params.song_file, lenSongFile, segCount, i, context);
            let voiceFile = params.voice_file; // await getAudioSegment(params.voice_file, lenVoiceFile, segCount, i, context);
            let instFile = params.instrumental_file; // await getAudioSegment(params.instrumental_file, lenInstFile, segCount, i, context);        
           
            let segment = segments[i].trim();
            if(!segment.startsWith("##")){
                segment = "##\n" + segment;
            }
            if(!segment.endsWith("##")){
                segment = segment + "\n##";
            }
            
            const step = await callReplicateAndWaitResultWithRes(
                context, 
                {
                    func:"music-01", 
                    inputText: params.lyrics,
                    params:{
                        lyrics: segment,
                        song_file: songFile,
                        voice_file: voiceFile,
                        instrumental_file: instFile
                    }
                },
                ()=>{
                    // 等待超时就先返回前端，但是后台仍然继续执行
                    context.res.status(enums.resStatus.waitForResult).json("生成歌曲需要较长时间，请耐心等候!");
                }
            );
            if(step){
                steps.push(step);
            }else{
                break;
            }
        }

        log(context, "把每一段音乐拼接起来");
        for(const step of steps){
            if(finalResult){
                const song1 = finalResult.result.generated;
                const song1_short = await au.cutOffAudio(song1, 1, "T");
                const song2 = step.result.generated;
                finalResult = step;
                finalResult.result.generated = await au.concatAudioFiles(song1_short, song2);
                fs.deleteFileByURL(song1); 
                fs.deleteFileByURL(song1_short); 
                fs.deleteFileByURL(song2);
            }else{
                finalResult = step;
            }
        }

        if(finalResult?.result?.generated){
            await prisma.room.update({ 
                where:{ id:context.room.id }, 
                data:{ 
                    outputImage: finalResult.result.generated,
                } 
            });         
        }
        return finalResult;
    },     
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "createMusic": async function(context:any, params:any){
        let finalResult:any;
        return await callReplicateAndWaitResultWithRes(
            context, 
            {
                waitResultRetryTimes: 30,                
                func: params.model || "musicgen", 
                inputText: params.prompt,
                params
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("生成乐曲需要较长时间，请耐心等候!");
            }
        );
    },        
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "sadTalker": async function(context:any, params:any){
        let finalResult:any;
        const audioURL = params.driven_audio;
        // 如果是歌曲，就提取出人声
        if(params.singSong){
            const vocals = await au.extractVocals(params.driven_audio, "T");
            log(context, "提取人声：" + vocals);
            if(vocals){
                params.driven_audio = vocals;
                putToTempList(vocals, context);                
            }
        }

        if(params.func != "hallo" && params.func != "emo-v1" && params.func != "liveportrait"){
            // params.driven_audio = await createUSTempFile(params.driven_audio, context);
            params.source_image = await createUSTempFile(params.source_image, context);
        }

        if(["liveportrait","emo-v1"].includes(params.func)){
            log(context, "start " + params.func);
            if(!fs.inOSSBucket(params.source_image)){
                params.source_image = await createTempFile(params.source_image, context);
            }
            if(!fs.inOSSBucket(params.driven_audio)){
                params.driven_audio = await createTempFile(params.driven_audio, context);
            }

            switch(params.func){
                case "emo-v1": {
                    const cv = AIService.createCVInstance("ALI", "emo-detect-v1");
                    if(cv){
                        log(context, "cv:", cv);
                        const detectResult = await cv.predict({
                            image_url: params.source_image,
                            params:{
                                ratio: params.emoRatio || "3:4"
                            }
                        });
                        log(context, "detectResult:" + JSON.stringify(detectResult));
                        if(detectResult?.output?.check_pass){
                                params.face_bbox = detectResult.output.face_bbox;
                                params.ext_bbox = detectResult.output.ext_bbox;
                        }else{
                            return await setErrorStatus(context.res, enums.resStatus.expErr, "上传的图片没有通过检测，无法执行当前AI任务！", context.room, context.user, context.price);
                        }                
                    }else{
                        return await setErrorStatus(context.res, enums.resStatus.expErr, "发起图片检测时发生意外失败，无法执行当前AI任务！", context.room, context.user, context.price);
                    }
                }
                case "liveportrait": {
                    const cv = AIService.createCVInstance("ALI", "liveportrait-detect");
                    if(cv){
                        log(context, "cv:", cv);
                        const detectResult = await cv.predict({
                            image_url: params.source_image
                        });
                        log(context, "detectResult:" + JSON.stringify(detectResult));
                        if(!detectResult?.output?.pass){
                            return await setErrorStatus(context.res, enums.resStatus.expErr, detectResult?.output.message || "上传的图片没有通过检测，无法执行当前AI任务！", context.room, context.user, context.price);
                        }                
                    }else{
                        return await setErrorStatus(context.res, enums.resStatus.expErr, "发起图片检测时发生意外失败，无法执行当前AI任务！", context.room, context.user, context.price);
                    }
                }
            }                    
        }
        
        const step1 = await callReplicateAndWaitResultWithRes(
            context, 
            {
                func : params.func || "sadTalker", 
                params
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
            }
        );

        if(step1){
            finalResult = step1;
            /*
            if(params.func == "emo-v1"){
                // 把区域视频贴回原图，形成新视频
                // 测试："face_bbox":[307,236,558,487],"ext_bbox":[119,10,747,638]}
                finalResult = {
                    result: {
                        generated: "https://aiputi.oss-cn-beijing.aliyuncs.com/U/2025/4/12/CMKq0.mp4",
                    },
                    status: 200
                };
                params.ext_bbox = [119,10,747,638];
                params.source_image = "https://aiputi.oss-cn-beijing.aliyuncs.com/U/2025/4/12/oy3BI.jpg";
                
                const wholeVideo = await vu.pasteBackToImage(finalResult.result.generated, params.source_image, {
                    x:params.ext_bbox[0], 
                    y:params.ext_bbox[1], 
                    width:Math.abs(params.ext_bbox[2] - params.ext_bbox[0]),
                    height:Math.abs(params.ext_bbox[3] - params.ext_bbox[1])
                });
                if(wholeVideo){
                    finalResult.result.generated = wholeVideo;
                }
            }
           */ 
            // 如果是歌曲模式，需要把声音换成原始音频
            if(params.singSong){
                finalResult.result.generated = await vu.mixAudioToVideo(finalResult.result.generated, audioURL, false, "U");
            }        
        }
        return finalResult;
    },       
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoMixAIAudio": async function(context:any, params:any){
        let finalResult:any;
        params.video = await createUSTempFile(params.video, context);
        return await callReplicateAndWaitResultWithRes(
            context, 
            {
                func:"mmaudio", 
                params
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("AI生成视频配音需要较长时间，请耐心等候!");
            }
        );        
    },
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoMixAudio": async function(context:any, params:any){
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated : params.mixVideoURL,
                genRoomId : context.room.id,
            }
        };
        // 处理视频声音拷贝
        const videoWithAudio = params.mixSource == "video" ? 
            await vu.mixAudioFromVideo(params.videoURL, params.mixVideoURL, params.keepOriginal, "U")
            :
            await vu.mixAudioToVideo(params.mixVideoURL, params.audioURL, params.keepOriginal, "U");
        if(videoWithAudio){
            finalResult.result.generated = videoWithAudio;
        }              
        return finalResult;
    },
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoTranslate": async function(context:any, params:any){
        let finalResult:any;
        finalResult = await callReplicateAndWaitResultWithRes(
            context, 
            {
                func:"byte-video_trans", 
                params
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("AI生成视频配音需要较长时间，请耐心等候!");
            }
        );    
        
        /*
        // 从视频中分离出人声和背景音
        const audios = await vu.extractVocalsAndBgFromVideo(params.videoURL, "T");
        
        // 将每一段不同人的发音切分成小段

        // 从每一段提取出文字

        // 把文字翻译成目标语言

        // 模拟每一段视频发音，将文字转换成对应的语音

        // 用每一段目标语言语音对每一段视频做唇形同步

        // 把所有同步完的视频一段一段拼起来

        // 把视频中分离出来的背景音加入刚同步的视频中

        // 输出最终结果
        */
        return finalResult;
    },
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoRetalk": async function(context:any, params:any){
        let finalResult:any;
        log(context, `video duration: ${params.videoDuration}`);
        log(context, `video current: ${params.videoCurrent}`);
        log(context, `audio duration: ${params.audioDuration}`);
        log(context, `audio current: ${params.audioCurrent}`);
        const videoURL = params.face;
        const audioURL = params.input_audio;

        if(params.fromCurrent && params.videoCurrent > 0.1){
            // 截取从当前时间点开始的视频
            const rightVideo = await vu.trimVideo(params.face, params.videoCurrent, params.videoDuration-params.videoCurrent);
            if(rightVideo){
                putToTempList(rightVideo, context);
                params.face = rightVideo;
            }else{
                return await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪视频时发生意外错误", context.room, context.user, context.price);
            }
        }

        // 截取从当前时间点开始的音频
        if(params.fromCurrent && params.audioCurrent > 0.1){
            // 截取从当前时间点开始的视频
            const rightAudio = await au.trimAudio(params.input_audio, params.audioCurrent, params.audioDuration-params.audioCurrent);
            if(rightAudio){
                putToTempList(rightAudio, context);
                params.input_audio = rightAudio;
            }else{
                return await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪音频时发生意外错误", context.room, context.user, context.price);
            }
        }
        const trimedAudioWithMusic = params.input_audio;
        // 如果是歌曲，就提取出人声
        if(params.singSong){
            const vocals = await au.extractVocals(params.input_audio, "T");
            log(context, "提取人声：" + vocals);
            if(vocals){
                params.input_audio = vocals;
                putToTempList(vocals, context);                
            }
        }

        if(params.lipModel != "videoretalk"){
            params.face = await createUSTempFile(params.face, context);
            // params.input_audio = await createUSTempFile(params.input_audio, context);
        }
        
        const step2 = await callReplicateAndWaitResultWithRes(
            context, 
            {
                func:params.lipModel, 
                params
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
            }
        );
        if(step2){
            finalResult = step2

            // 如果是歌曲模式，需要把声音换成原始音频
            if(params.singSong){
                finalResult.result.generated = await vu.mixAudioToVideo(finalResult.result.generated, trimedAudioWithMusic, false, "U");
            }
            
            // 拼接视频
            if(params.fromCurrent && params.videoCurrent > 0.1){
                // 截取从开始到当前时间点的视频
                const leftVideo = await vu.trimVideo(videoURL, 0, params.videoCurrent);
                if(leftVideo){
                    putToTempList(leftVideo, context);                    
                    const mergeVideo = await vu.concatVideos(leftVideo, finalResult.result.generated);
                    log(context, "拼接左侧后的视频为：", mergeVideo);
                    if(mergeVideo){
                        putToTempList(finalResult.result.generated, context);                                            
                        finalResult.result.generated = mergeVideo;                                                
                    }            
                }
            }

            // 如果视频没有原视频长，那么拼接剩余视频
            const len = await vu.getVideoLength(finalResult.result.generated);
            if(len && (params.videoDuration - len) > 0.1){
                const rightVideo = await vu.trimVideo(videoURL, len, params.videoDuration-len);
                if(rightVideo){
                    putToTempList(rightVideo, context);                    
                    const mergeVideo = await vu.concatVideos(finalResult.result.generated, rightVideo);
                    log(context, "拼接右侧后的视频为：", mergeVideo);
                    if(mergeVideo){
                        putToTempList(finalResult.result.generated, context);                                            
                        finalResult.result.generated = mergeVideo;                        
                    }            
                }
            }
        }
        return finalResult;
    },        
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "audioTrim": async function(context:any, params:any){              
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated : params.audioURL,
                genRoomId : context.room.id,
            }
        };
        params.needAuditResult = false;
        try{
            const trimAudio = await au.trimAudio(params.audioURL, params.trimStart, params.trimDuration);
            if(trimAudio){
                finalResult.result.generated = trimAudio;
            }else{
                await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪音频结果为空！", context.room, context.user, context.price);
            }
            log(context, "trim audio:", trimAudio);
        }catch(err){
            error(context, "trim audio, 裁剪音频时出错！", err);
            await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪音频时发生未知错误！", context.room, context.user, context.price);
        }        
        context.room = await prisma.room.update({where:{id:context.room.id}, data:{outputImage:finalResult.result.generated, resultType:"VOICE"}});        
        return finalResult;
    },    

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoTrim": async function(context:any, params:any){              
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated : params.videoURL,
                genRoomId : context.room.id,
            }
        };
        params.needAuditResult = false;
        try{
            const trimVideo = await vu.trimVideo(params.videoURL, params.trimStart, params.trimDuration);
            if(trimVideo){
                finalResult.result.generated = trimVideo;
            }else{
                await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪视频结果为空！", context.room, context.user, context.price);
            }
            log(context, "trim video:", trimVideo);
        }catch(err){
            error(context, "trim Video, 裁剪视频时出错！", err);
            await setErrorStatus(context.res, enums.resStatus.unknownErr, "裁剪视频时发生未知错误！", context.room, context.user, context.price);
        }        
        context.room = await prisma.room.update({where:{id:context.room.id}, data:{outputImage:finalResult.result.generated, resultType:"VIDEO"}});        
        return finalResult;        
    },    
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoConcat": async function(context:any, params:any){              
        let finalResult:any = {
            status: enums.resStatus.OK,
            result: {
                generated : params.video1URL,
                genRoomId : context.room.id,
            }
        };
        let trimVideo1:string|undefined;
        let trimVideo2:string|undefined;
        
        // 裁剪第一段视频
        if(params.video1URL){
            try{
                trimVideo1 = params.video1URL;
                if(Math.abs(params.video1CurrentTime - params.video1TotalTime) > 0.01){ 
                    if(params.video1TrimWay == "BEFORE"){
                        trimVideo1 = await vu.trimVideo(params.video1URL, 0, params.video1CurrentTime);
                    }else{
                        trimVideo1 = await vu.trimVideo(params.video1URL, params.video1CurrentTime, params.video1TotalTime - params.video1CurrentTime);
                    }
                }
                log(context, "concat video1:", trimVideo1);
            }catch(err){
                error(context, "concat Video, 拼接第一段视频时出错！", err);
            }
        }
        // 裁剪第二段视频
        if(params.video2URL){
            try{
                trimVideo2 = params.video2URL;
                if(Math.abs(params.video2CurrentTime - params.video2TotalTime) > 0.01){ 
                    if(params.video2TrimWay == "BEFORE"){
                        trimVideo2 = await vu.trimVideo(params.video2URL, 0, params.video2CurrentTime);
                    }else{
                        trimVideo2 = await vu.trimVideo(params.video2URL, params.video2CurrentTime, params.video2TotalTime - params.video2CurrentTime);
                    }
                }
                log(context, "concat video2:", trimVideo2);            
            }catch(err){
                error(context, "concat Video, 拼接第二段视频时出错！", err);
            }
        }
        // 拼接视频
        if(trimVideo1){
            finalResult.result.generated = trimVideo1;
            if(trimVideo2){
                const mergeVideo = await vu.concatVideos(trimVideo1, trimVideo2);
                log(context, "拼接后的视频为：", mergeVideo);
                if(mergeVideo){
                    finalResult.result.generated = mergeVideo;
                    if(trimVideo1 !== params.video1URL){
                        log(context, "删除裁剪后的临时视频:" + trimVideo1);
                        putToTempList(trimVideo1, context);
                    }
                    if(trimVideo2 !== params.video2URL){
                        log(context, "删除裁剪后的临时视频:" + trimVideo2);
                        putToTempList(trimVideo2, context);
                    }
                }        
            }
        }
        
        return finalResult;
    },        
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "createVideo": async function(context:any, params:any){        
        let finalResult:any;
        let func:string = "text2video";
        let timePoint = params.currentTime; // 秒
        if(timePoint < 0){
            timePoint = 0.01;
        }
        // 如果需要在生成一段
        let needNext = false;
        let totalDuration = params.duration;
        
        if(params.duration == 10){
            needNext = params.model == "DYNAMIC" || params.model == "ANIMATION" || params.model == "PRO_PLUS2";
            if(!needNext){
                const m = mt.videoModelMap.get(params.model);
                needNext = m?.maxLen < 10;
            }
            if(needNext){
                log(context, "[createVideo] needNext and set params.duration to 5 secs");
                params.duration = 5;
            }
        }
        
        // 预处理不同类型输入内容
        switch(params.source){
            case "TEXT":
                break;
                
            case "VIDEO":
                params.imageURL = null;
                if(Math.abs(params.currentTime - params.totalTime) < 0.1){
                    params.imageURL = await vu.captureLastFrame(params.videoURL);
                }else{
                    try{
                        params.imageURL = await vu.captureFrame(params.videoURL, timePoint*1000);
                    }catch(err){
                        error(context, "exception while vu.captureFrame from " + params.videoURL);
                    }
                    if(!params.imageURL){
                        params.imageURL = await vu.captureLastFrame(params.videoURL);
                    }
                    if(await checkURLExists(params.endImageURL)){
                        params.endImageURL = await createTempFile(params.endImageURL, context);
                    }                  
                }
                log(context, "captured Frame from " + params.videoURL, params.imageURL);
            case "PHOTO":
                if(params.imageURL){
                    if(await checkURLExists(params.imageURL)){
                        params.imageURL = await createTempFile(params.imageURL, context);
                    }else{
                        return await setErrorStatus(context.res, enums.resStatus.unExpErr, "参考图片文件不存在，或者无法访问！", context.room, context.user, context.price);
                    }
                    if(await checkURLExists(params.endImageURL)){
                        params.endImageURL = await createTempFile(params.endImageURL, context);
                    }
                }
                break;
        }

        // 预处理不同模型的自定义func
        switch(params.model){
            case "QUICK": func = "luma-ray-flash-2-540p"; break;
            case "SIMPLE": func = "ltx-video-v097"; break;
            case "DYNAMIC": func = "minimax-video-01"; break;
            case "ANIMATION": func = "minimax-video-01-live"; break;
            case "STANDARD": func = "kling-v1.6-standard"; break;
            case "PRO_PLUS": func = "kling-v1.6-pro"; break;
            case "PRO_PLUS2": func = "kling-v2-master"; break;
            default: func = params.model;
        }

        // 预处理使用的线路
        let serviceLine = "REP";
        switch(func){
            case "kling-v2-master":
            case "kling-v1.6-standard": 
            case "kling-v2.1-master":
            case "kling-v2.1-standard":             
                serviceLine = "FAL";        
                break;
            default:
                serviceLine = "REP";
        }

        // 执行生成视频的操作
        for(let i=0; i<20; i++){
            const step1 = await callReplicateAndWaitResult(context, 
                {
                    serviceLine,
                    roomId:context.room.id,
                    freeOfCharge: true,
                    isIntermediateStep: true,
                    doNotUploadToServer: true,
                    email: context.userEmail,
                    access:"PRIVATE",                                    
                    waitResultRetryTimes: 5,                    
                    waitDatabaseRetryTimes:100000,  // 创建视频有可能会等很长时间
                    func, 
                    params
                },
                ()=>{
                    // 等待超时就先返回前端，但是后台仍然继续执行
                    context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
                }
            );
            if(step1?.status != enums.resStatus.OK){ 
                if(func.indexOf("kling-v1.6")>=0){
                    try{
                        if( step1?.result && 
                            ( 
                                String(step1.result).indexOf("1303")>=0 // || JSON.parse(step1?.result).code == 1303
                                || String(step1.result).indexOf("1102")>=0 // || JSON.parse(step1?.result).code == 1102
                            )
                          ){                        
                            // “代码”：1102，“消息”：“资源包已耗尽”                        
                            // 431:{“code”：1303，“message”：“并行任务超过资源包限制”，“request_id”：“Cji3Wmc-3f8AAABABH6LQ”}
                            if(i % 2 == 1){
                                error(context, "发生配额不足错误，等待十分钟后重试：", step1.result, context.room.id);                                      
                                await new Promise((resolve) => setTimeout(resolve, 600000)); // 等待十分钟
                                error(context, "十分钟前发生配额不足错误，现在开始重试：", step1.result, context.room.id);                        
                            }else{
                                if(serviceLine == "REP"){serviceLine = "FAL"}else{serviceLine = "REP"}
                                error(context, `现在，换到线路${serviceLine}上尝试执行`);
                            }
                            continue; // 然后再次尝试
                        }else{
                            break;
                        }
                    }catch(err){
                        error(context, "createVideo error:", err, step1);
                        break;
                    }
                }else{
                    return await setErrorStatus(context.res, step1.status || enums.resStatus.unExpErr, "系统发生未知错误，请稍后重试！", context.room, context.user, context.price);
                }
            }else{
                finalResult = step1;
                break;
            }
        }
        if(finalResult?.status != enums.resStatus.OK){ 
            return await setErrorStatus(context.res, finalResult.status || enums.resStatus.unExpErr, "系统发生未知错误，请稍后重试！", context.room, context.user, context.price);            
        }

        if(needNext && finalResult?.status == enums.resStatus.OK && finalResult.result.generated){
            log(context, "[createVideo] needNext and start to generate next video......");
            const midFrame = await vu.captureLastFrame(finalResult.result.generated);      
            if(midFrame){
                params.imageURL = midFrame;
            }
            
            for(let i=0; i<10; i++){
                const step2 = await callReplicateAndWaitResult(context, 
                    {
                        serviceLine,
                        roomId:context.room.id,
                        freeOfCharge: true,
                        isIntermediateStep: true,
                        doNotUploadToServer: true,
                        email: context.userEmail,
                        access:"PRIVATE",                                    
                        waitResultRetryTimes: 100,                    
                        waitDatabaseRetryTimes:100000,  // 创建视频有可能会等很长时间
                        func, 
                        params
                    },
                    ()=>{
                        // 等待超时就先返回前端，但是后台仍然继续执行
                        context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
                    }
                );
                if(step2?.status != enums.resStatus.OK){ 
                    if(func.indexOf("kling-v1.6")>=0){
                        try{
                            if( step2?.result && 
                               (
                                   String(step2.result).indexOf("1303")>=0 //|| JSON.parse(step2?.result).code == 1303
                                   || String(step2.result).indexOf("1102")>=0 //|| JSON.parse(step2?.result).code == 1102
                                )
                              ){                        
                                // 431:{“code”：1303，“message”：“并行任务超过资源包限制”，“request_id”：“Cji3Wmc-3f8AAABABH6LQ”}
                                if(i % 2 == 1){
                                    error(context, "发生配额不足错误，等待十分钟后重试：", step2.result, context.room.id);                                      
                                    await new Promise((resolve) => setTimeout(resolve, 600000)); // 等待十分钟
                                    error(context, "十分钟前发生配额不足错误，现在开始重试：", step2.result, context.room.id);                        
                                }else{
                                    if(serviceLine == "REP"){serviceLine = "FAL"}else{serviceLine = "REP"}
                                    error(context, `现在，换到线路${serviceLine}上尝试执行`);
                                }
                                continue; // 然后再次尝试
                            }else{
                                break;
                            }
                        }catch(err){
                            error(context, "createVideo error:", step2);
                            break;
                        }
                    }else{
                        return await setErrorStatus(context.res, step2.status || enums.resStatus.unExpErr, "系统发生未知错误，请稍后重试！", context.room, context.user, context.price);
                    }
                }else{
                    // 拼接视频
                    const mergeVideo = await vu.concatVideos(finalResult.result.generated, step2.result.generated);
                    if(mergeVideo){
                        finalResult = step2;
                        finalResult.result.generated = mergeVideo;
                    }
                    break;
                }
            }
        }

        if(finalResult?.status != enums.resStatus.OK){ 
            return await setErrorStatus(context.res, finalResult.status || enums.resStatus.unExpErr, "系统发生未知错误，请稍后重试！", context.room, context.user, context.price);            
        }
        
        // 第三步，给视频配背景音乐
        if(params.aiAudio && finalResult?.status == enums.resStatus.OK && finalResult.result.generated){
            const vm = mt.getVideoModelByCode(func);
            if(!vm?.hasAudio){ // 排除已经自带音频的模型
                const step3 = await callReplicateAndWaitResult(context, {
                    func:"mmaudio", 
                    email: context.user.email,
                    isIntermediateStep: true,
                    freeOfCharge: true,  
                    roomId: context.room.id,                        
                    params:{
                        prompt: params.prompt || ' Background music. Reasonable sound effects. ',
                        negative_prompt: ' Speech, noise, ',
                        video: finalResult.result.generated,
                        duration: await vu.getVideoLength(finalResult.result.generated) || totalDuration,
                    }
                });                
                if(step3.status == enums.resStatus.OK && step3.result.generated){
                    finalResult = step3;
                }
            }
        }

        // 第四步拼接原有视频
        if(finalResult?.status == enums.resStatus.OK && finalResult?.result?.generated){
            if(params.source == "VIDEO" && params.concatVideo){
                log(context, "拼接原有视频...");
                try{
                    let trimVideo = params.videoURL;
                    if(Math.abs(params.currentTime - params.totalTime) > 0.05){ 
                        trimVideo = await vu.trimVideo(params.videoURL, 0, timePoint);
                    }
                    const mergeVideo = await vu.concatVideos(trimVideo, finalResult.result.generated);
                    log(context, "拼接后的视频为：", mergeVideo);
                    if(mergeVideo){
                        finalResult.result.generated = mergeVideo;
                        if(trimVideo != params.videoURL){
                            // 删除裁剪后的临时视频
                            putToTempList(trimVideo, context);
                        }
                    }
                }catch(err){
                    error(context, "create Video, 拼接原有视频时出错！", err);
                }
            }

            // 设置封面
            const coverImage = await vu.captureFrame(finalResult.result.generated, 1, "U");            
            if(coverImage){
                await prisma.room.update({ 
                    where:{ id:context.room.id }, 
                    data:{ 
                        inputImage: coverImage,
                    } 
                }); 
            }
        }

        // 正常返回，或者其它错误就返回
        return finalResult;            
    },
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "faceswapVideo": async function(context:any, params:any){
        let finalResult:any;
        let hasReturnToFrontEnd = false;
        let retryWaitingTimeBetweenLines = 60; // 秒
        let serviceLine = context.room.audit === "P" ? process.env.SERVICE_FACESWAP_VIDEO_BACKUP_2 : process.env.SERVICE_FACESWAP_VIDEO;
        
        let serviceLines:any[] = ["AM", "FAL", "REP"];
        switch(params.func){
            case "faceswapFilter":
                serviceLines = [process.env.SERVICE_FACESWAP_FILTER_VIDEO, process.env.SERVICE_FACESWAP_FILTER_VIDEO_2];
                retryWaitingTimeBetweenLines = 3;
                break;
            case "faceswapVideo":
                if(context.room.audit === "P"){
                    retryWaitingTimeBetweenLines = 120;
                    serviceLines = [process.env.SERVICE_FACESWAP_VIDEO_BACKUP_3, process.env.SERVICE_FACESWAP_VIDEO_BACKUP_4, process.env.SERVICE_FACESWAP_VIDEO_BACKUP_5,
                                    process.env.SERVICE_FACESWAP_VIDEO_BACKUP_3, process.env.SERVICE_FACESWAP_VIDEO_BACKUP_4, process.env.SERVICE_FACESWAP_VIDEO_BACKUP_5];
                }else{
                    retryWaitingTimeBetweenLines = 3;
                    serviceLines = [process.env.SERVICE_FACESWAP_VIDEO, process.env.SERVICE_FACESWAP_VIDEO_BACKUP, process.env.SERVICE_FACESWAP_VIDEO_BACKUP_2];
                }
                break;
            case "faceswapVideoHD":
                serviceLines = ["FAL", "FAL", "FAL"];
                break;
        }
      
        // 过滤视频可能的问题
        //params.target = await vu.normalizeVideo(params.target, "T");
        //error(context, "过滤视频：", params?.target);
        //putToTempList(params.target, context);

        log(context, "faceswapVideo: 创建一个target的拷贝，以防止任务执行到一半，被删除");
      
        params.target = await createTempFile(params.target, context);        

        log(context, "faceswapVideo temp target: ", params.target);
        
        let originalVideo = params.target;        

        if(params.speedUp){
            log(context, "faceswapVideo: 加速视频......");            
            const speedVideo = await vu.changeVideoSpeed(params.target, 2);
            if(speedVideo){
                putToTempList(speedVideo, context);
                params.target = speedVideo;
            }
        }
        
        if(params.gen_length < params.total_length){
            log(context, "faceswapVideo: 因为能量点不够，所以需要截取视频片段，单位秒......");            
            const newVideo = await vu.trimVideo(params.target, 0, params.gen_length);
            if(newVideo){
                putToTempList(newVideo, context);
                params.target = newVideo;
            }else{
                return await setErrorStatus(context.res, enums.resStatus.unExpErr, "截取视频片段时发生意外失败，请稍后重试！", context.room, context.user, context.price);
            }
        }

        log(context, "faceswapVideo: 创建一个source的拷贝，以防止任务执行到一半，被删除");
        params.source = await createUSTempFile(params.source, context);
        
        log(context, "faceswapVideo: 把视频切分成小段, 每段20秒");
        const segLength = 20; // 每段秒数
        let remLen = params.gen_length || params.params.total_length;  // remining length
        const segments:{
            sourceURL: string;
            length: number;
            resultURL?: string;
            resultPath?: string;
        }[] = [];
        if((remLen - segLength) > 5){ // 超过3秒才分段
            while(Math.abs(remLen) > 0.01){
                const cutLen = Math.min(segLength, remLen);
                const segVideo = await vu.trimVideo(params.target, params.gen_length-remLen, cutLen);
                if(segVideo){
                    putToTempList(segVideo, context);
                    segments.push({
                        sourceURL: segVideo,
                        length: cutLen
                    });
                }
                remLen = remLen - cutLen;
            }
        }else{
            segments.push({
                sourceURL: params.target,
                length: remLen
            });
        }
        log(context, `faceswap Video targetVideo gen length ${params.gen_length}, was cutted to ${segments.length} segments`);


        log(context, "faceswapVideo: 开始分段处理视频......");
        for(const seg of segments){
            try{
                log(context, "faceswapVideo: 把分段后的每一段视频文件传到美国...");
                params.target = await createUSTempFile(seg.sourceURL, context);
       
                log(context, "STEP1: 替换视频");
                const stepN =  await callReplicateAndWaitResultWithRes(
                    context,
                    {
                        serviceLine,
                        func: (params.func === "faceswapVideoHD" ? "faceswapVideo" : params.func) || "faceswapVideo",
                        waitResultRetryTimes: 10,
                        retryWaitingTimeBetweenLines: parseInt(process.env.SERVICE_FACESWAP_VIDEO_RETRY_INTERVAL || "60"),
                        waitDatabaseRetryTimes: 10000,
                        params: params,
                    },
                    ()=>{
                        // 等待超时就先返回前端，但是后台仍然继续执行
                        context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
                        hasReturnToFrontEnd = true;
                    },
                    serviceLines,
                    true, // 失败返回错误头
                );
        
                if(stepN?.result?.generated && stepN?.status == enums.resStatus.OK){
                    seg.resultPath = await createLocalTempFile(stepN?.result?.generated, context);
                    log(context, `faceswapVideo: 为本段结果${stepN?.result?.generated}，创建一个本地拷贝${seg.resultPath}`);                    
                }else{
                    break;
                }
            }catch(err){
                error(context, "faceswapVideo raise exception when call callReplicateAndWaitResultWithRes...", err);
            }finally{
          
            }
        }            
      
        log(context, "faceswapVideo: 把小段视频合并成一段");
        let combinedVideo;
        let sucLen = 0; // 成功的长度
        for(const seg of segments){
            if(seg?.resultPath){
                if(combinedVideo){ 
                    combinedVideo = await vu.localConcatVideos(combinedVideo, seg.resultPath);
                }else{
                    combinedVideo = seg.resultPath;
                }
                sucLen += seg.length
            }
        }
        if(combinedVideo){
            finalResult = {
                status: enums.resStatus.OK,
                result: {
                    generated: combinedVideo,
                    id: context.room.id,
                    genRoomId: context.room.id
                }
            }
        }
      
        if(finalResult && finalResult?.status == enums.resStatus.OK && finalResult?.result?.generated){       
            let coverImage:any;
            log(context, "减速视频...");
            if(params.speedUp){
                const speedVideo = await vu.changeLocalVideoSpeed(finalResult.result.generated, 0.5);
                if(speedVideo){
                    putToTempList(finalResult.result.generated, context, "PATH");
                    finalResult.result.generated = speedVideo;
                }
            }

            log(context, '............................任务完成，上传文件服务器，并获得封面.........................');
            finalResult.result.generated = await fs.uploadFileToServer(finalResult.result.generated, "U");
          
            log(context, '处理视频声音拷贝');
            const videoWithAudio = await copyAudioFromVideo(finalResult.result.generated, originalVideo);
            if(videoWithAudio){
                finalResult.result.generated = videoWithAudio;
            }     
            
            try{
                coverImage = await vu.captureFrame(finalResult.result.generated, 0, "U");
                if(context.room.audit && context.room.audit != "N"){
                    putToTempList(coverImage, context);
                    coverImage = await fs.backupToUS(coverImage);
                }
            }catch(err){
                error(context, "exception when capture frame:", err);
            }

            await prisma.room.update({ 
                where:{ id:context.room.id }, 
                data:{ 
                    inputImage: coverImage || params.imageUrl
                } 
            });   
        }else{
            return await setErrorStatus(context.res, enums.resStatus.unExpErr, "没有生成任何结果！您的能量点已经被退回。", context.room, context.user, context.price);
        }

        // 如果部分成功，需要退还剩余点数，所以这里单独处理一下
        if((params.gen_length - sucLen) > 1){
            error(context, "---------------------------------------------------------------------");
            error(context, ` 没有完全生成成功的任务，应该总长度${params.gen_length}秒，实际生成长度${sucLen}秒`);
            const chargeBackCredits = Math.ceil(context.price * ((params.gen_length - sucLen) / params.gen_length));
            returnCredits(context.user, chargeBackCredits, enums.creditOperation.CREATE_ROOM, context.room.id); 
        }        
        return finalResult;
    },
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "zoomInVideo": async function(context:any, params:any){
        let finalResult:any;

        if(params.func !== "byte-video_upscale"){
            params.video = await createUSTempFile(params.video, context);
        }
        
        log(context, "STEP1: 替换视频");
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func:params.func, 
            params
        });
        
        if(step1){
            finalResult = step1;
        }
        return finalResult;
    },
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoMatting": async function(context:any, params:any){
        let finalResult:any;

        let hasReturnToFrontEnd = false;
        params.input_video = await createUSTempFile(params.input_video, context);
        
        log(context, "STEP1: 视频扣绿幕");
        const step1 = await callReplicateAndWaitResultWithRes(
            context,
            {
                func: "videoMatting",
                waitResultRetryTimes: 5,
                params: params,
            },
            ()=>{
                // 等待超时就先返回前端，但是后台仍然继续执行
                context.res.status(enums.resStatus.waitForResult).json("生成视频需要较长时间，请耐心等候!");
                hasReturnToFrontEnd = true;
            }
        );
        log(context, "step1 返回执行状态:", step1.status);                
        log(context, "step1 返回执行结果:", step1.result.generated);                                
        if(step1.result?.generated){
            finalResult = step1;
       
            // 处理视频声音拷贝
            const videoWithMusic = await copyAudioFromVideo(finalResult.result.generated, params.input_video);
            log(context, "copyAudioFromVideo返回结果:", videoWithMusic);
            if(videoWithMusic){
                // 删除原始视频
                // await fs.deleteFileByURL(finalResult.result.generated);                    
                // log(context, finalResult.result.generated, "已经被删除");
                
                // 把合成后的视频写回原来的room                
                finalResult.result.generated = videoWithMusic;
                log(context, `${finalResult.result.genRoomId}的outputImage被更新为：${videoWithMusic}`);
            }

            // 上传文件服务器，并获得封面
            let coverImage:any;
            if(isURL(finalResult.result.generated)){
                if(getFileServerOfURL(finalResult.result.generated) != process.env.FILESERVER){
                    finalResult.result.generated = await moveToFileServer(finalResult.result.generated);
                }
                coverImage = await vu.captureFrame(finalResult.result.generated, 1, "U");
            }                    

            await prisma.room.update({ 
                where:{ id:context.room.id }, 
                data:{ 
                    status: enums.roomStatus.success,
                    outputImage: finalResult.result.generated,
                    inputImage: coverImage || params.imageUrl
                } 
            });   

            if(!hasReturnToFrontEnd){
                context.res.status(enums.resStatus.OK).json(finalResult.result);  
            }
        }else{
            const r = await prisma.room.findUnique({where:{id:context.room.id}, select:{status:true, outputImage:true}});
            if(r){
                if(r.status != enums.roomStatus.failed || !r.outputImage){
                    await prisma.room.update({ 
                        where:{ id:context.room.id }, 
                        data:{ 
                            status: enums.roomStatus.failed,
                            outputImage: "没有生成任何结果！",
                        } 
                    });   
                }
            }
            if(!hasReturnToFrontEnd){
                await setErrorStatus(context.res, enums.resStatus.noResultErr, "没有生成任何结果！", context.room, context.user, context.price);
            }
        }

        return finalResult;
    },    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "portraitVideo": async function(context:any, params:any){
        let finalResult:any;

        params.face_image = await createUSTempFile(params.face_image, context);
        params.driving_video = await createUSTempFile(params.driving_video, context);
        
        log(context, "STEP1: 生成视频");
        const dvOrg = params.driving_video; // 后续操作不能使用replicate上的文件
        
        if(params.service == "fofr/live-portrait"){
            //params.driving_video = await uploadToReplicate(params.driving_video);
            //params.face_image = await uploadToReplicate(params.face_image);  // API要求必须是repliate上的文件
        }else if(params.service ==  "mbukerepo/live-portrait"){
            // 备选线路
            params.input_video_path = params.driving_video;
            params.input_image_path =  params.face_image;
        }
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func: "portraitVideo",
            email: context.userEmail,
            roomId: context.room.id,
            params: params,
        });

        if(step1){
            finalResult = step1;
         
            log(context, "STEP2: 把原视频中的音乐复制到新视频");
            // 默认生成的码率是24，提高到30，会缩短视频长度
            
            const videoRate30 = await vu.convert24RateTo30(finalResult.result.generated);
            const videoWithMusic = await copyAudioFromVideo((videoRate30 || finalResult.result.generated), dvOrg);
            if(videoWithMusic){
                // 已经在copy里删除原始视
                // await fs.deleteFileByURL(finalResult.result.generated);                                    
                // log(context, finalResult.result.generated, "已经被删除");
                
                finalResult.result.generated = videoWithMusic;
                // 把合成后的视频写回原来的room
                await prisma.room.update({ where:{ id:context.room.id }, data:{ outputImage: videoWithMusic } });
            }
        }

        return finalResult;
    },
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    "videoMimic": async function(context:any, params:any){
        let finalResult:any;

        log(context, "STEP1: 生成视频");
        const step1 = await callReplicateAndWaitResultWithRes(context, {
            func: "byte-video_avatar_imitator",
            params,
        });

        if(step1){
            finalResult = step1;
        }

        return finalResult;
    },    
};
// 同样函数的命令
funcs.viralPic = funcs.changeBG;





/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// 工具函数
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function setErrorStatus(res:any, status:number, result:any, room:any, user:any, price:number){
    try{
        log(room?.id, "setStatus:" , status, JSON.stringify(result), JSON.stringify(room), JSON.stringify(user), price);
        res.status(status).json(result);
        
        if( room && status != enums.resStatus.OK ){
            const dbRoom = await prisma.room.findUnique({where:{id:room.id}, select:{id:true, status:true}});
            if(dbRoom && dbRoom.status !== enums.roomStatus.failed){ // 不能重复设置错误内容
                error(room?.id, "setStatus error message write to room: ", status);
                let errMsg = "";
                if(typeof result == "string"){
                    errMsg = result;
                }else{
                    errMsg = result?.generated || JSON.stringify(result);
                }
                await prisma.room.update({ 
                    where:{ id:room.id }, 
                    data:{ 
                        callbacked: "Y", // 此时为最终失败状态不再接受callback                    
                        status: enums.roomStatus.failed,
                        outputImage: `${status}: ${errMsg}`,
                    } 
                });      
                
                returnCredits(user, price, enums.creditOperation.CREATE_ROOM, room.id); 
            }
        }
    }catch(e){
        error(room?.id, "workflowAgent setStatus exception:", e, status, JSON.stringify(result), JSON.stringify(room), JSON.stringify(user), price);
    }
}

// 如果生成成功就返回包含ret.result.generated的结果
// 如果生成失败就返回空
export async function callReplicateAndWaitResultWithRes(context:any, params:any, onLongTimeWait?:()=>void, serviceLines:(string|undefined)[]=["DEFAULT"], setStatus:boolean=true): Promise<any> {
    params.freeOfCharge = params.freeOfCharge || true;
    params.doNotUploadToServer = params.doNotUploadToServer || true;
    params.isIntermediateStep = params.isIntermediateStep || true;
    params.email = context.userEmail;
    params.roomId = context.room.id;
    let hasExecutedLongTimeWaitFunction = false; // 用这个变量确保onLongTimeWait只会执行一次
    let ret:any;
    
    for(let line=0; line<serviceLines.length; line++){
        if(line > 0){
            error(context, `callReplicateAndWaitResultWithRes retrying line ${line}, total lines ${serviceLines.length}....`);                            
            await new Promise((resolve) => setTimeout(resolve, line * (params.retryWaitingTimeBetweenLines || 3) * 1000));
        }

        if(!serviceLines[line]){
            // 有可能这条线路没有在配置文件中定义，就跳过继续
            continue;
        }
        if(serviceLines[line] != "DEFAULT"){
            params.serviceLine = serviceLines[line];
        }
        log(context, `RUNNING IN SERVICE LINE: ${serviceLines[line]}`);
        let ret = await callReplicateAndWaitResult(
            context,
            params, 
            ()=>{
                if(onLongTimeWait && !hasExecutedLongTimeWaitFunction){
                    onLongTimeWait();
                    hasExecutedLongTimeWaitFunction = true;
                }
            }
        );
        if (ret?.status != enums.resStatus.OK) {
            error(context, "callReplicateAndWaitResultWithRes got error RESULT:", JSON.stringify(ret));
            error(context, `callReplicateAndWaitResultWithRes failed line ${line}, total lines ${serviceLines.length}....`);
            if((line+1) == serviceLines.length || !serviceLines[line+1]){ // 已经是最后一条线路，或者后续线路为空
                if(setStatus){
                    error(context, `callReplicateAndWaitResultWithRes set Error Status for Last Line: ${ret.status}, context.room ${JSON.stringify(context.room)}....`);
                    await setErrorStatus(context.res, ret.status, ret.result, context.room, context.user, context.price);
                }
                return null;
            }else{
                if((ret?.result && 
                    ( ret?.result.includes("没有识别出完整的人像")) || (ret?.result.includes("找不到")) )
                    ){
                    if(setStatus){
                        error(context, `callReplicateAndWaitResultWithRes set Error Status for No Human: ${ret.status}, context.room ${JSON.stringify(context.room)}....`);
                        await setErrorStatus(context.res, ret.status, ret.result, context.room, context.user, context.price);
                    }
                    return null;
                }else{
                    continue;
                }
            }
        }else{
            if(ret?.result?.genRoomId && ret?.result?.generated){
                return ret;
            }else{
                error(context, "应该生成结果，ret?.status == enums.resStatus.OK，但是没有生成结果");
                if((line+1) == serviceLines.length || !serviceLines[line+1]){
                    if(setStatus){
                        await setErrorStatus(context.res, enums.resStatus.noResultErr, ret.result || "没有生成结果", context.room, context.user, context.price);
                    }
                    return null;
                }else{
                    continue;
                }
            }
        }   
    }

    if(!ret){
        error(context, "enums.resStatus.serviceLineError:", params, context);
        await setErrorStatus(context.res, enums.resStatus.serviceLineError, "服务器故障，请稍后重试！", context.room, context.user, context.price);
        return null;
    }
}

export async function callReplicateAndWaitResult(context:any, params:any, onLongTimeWait?:()=>void){
    // log(context, "callReplicateAndWaitResult", JSON.stringify(params));
    let ret:any;
    try{
        params.timeStamp = Date.now();
        params.freeOfCharge = params.freeOfCharge || true;

        if(!params.waitResultRetryTimes){
            params.waitResultRetryTimes = 10;
        }
        ret = await callAPIinServer("http://localhost:3000/api/generate", params);
    }catch(e){
        error(context, "callReplicateAndWaitResult.callAPI Exception:", e);
    }

    log(context, `callReplicateAndWaitResult wait ${params.waitResultRetryTimes} times over! start to pooling result in database`);
    // 如果任务创建成功，但是结果还没有被生成出来
    if(ret && (ret.status == enums.resStatus.waitForResult || ret.status == enums.resStatus.unexpRetryErr || ret.status == enums.resStatus.proxyErr) && context.room.id){

        log(context, `callReplicateAndWaitResult enter waiting loop for reason ${ret.status} ......`);
      
        if(onLongTimeWait){
            log(context, `callReplicateAndWaitResult:执行回调onLongTimeWait`);
            onLongTimeWait();
        }

        log(context, `callReplicateAndWaitResult:开始尝试从数据库中读取状态`);  
        const readTimes = params.waitDatabaseRetryTimes || 1000;
        for(let i=0; i<readTimes; i++){
            log(context, `callReplicateAndWaitResult:第${i}次尝试`);            
            const room = await prisma.room.findUnique({
                where: {id: context.room.id }
            });
            if(room){
                if((room.status == enums.roomStatus.success) || (room.status == enums.roomStatus.midsucc)){
                    // 成功生成
                    if(ret.result && (typeof ret.result === "object")){
                        ret.result.generated = room.outputImage;
                    }else{
                        ret.result = {
                            generated: room.outputImage,
                            original: room.inputImage,
                            id: room.id,
                            genRoomId: room.id,
                            replicateId: room.replicateId,
                            seed: room.seed
                        }
                    }
                    ret.status = enums.resStatus.OK;
                    break;
                }else if(room.status == enums.roomStatus.failed || room.status == enums.roomStatus.midfail){
                    // 生成失败
                    ret.result = room.outputImage; // 这里获得的是genrate或者generateHook写入的错误原因
                    ret.status = enums.resStatus.unknownErr; // 需要想办法获得错误类型
                    break;
//                }else if(room.status == enums.roomStatus.delete){
//                    ret.status = enums.resStatus.roomDeleted;
                }else{
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }else{
                break;
            }
        }
    }else{
        log(context, `callReplicateAndWaitResult ret.status ${ret?.status}.   ret.result ${JSON.stringify(ret?.result)}`);    
    }
    
    return ret;
}




export async function advanceSwapFace(faceImage:string, poseImage:string, context:any, 
                                      option?:{ 
                                          freeOfCharge?:boolean, doNotUploadToServer?:boolean, isIntermediateStep?:boolean,
                                          strength?:number // 0-100
                                      }){
    if(!isInUS(faceImage)){
        faceImage = await createUSTempFile(faceImage, context);    
    }
    if(!isInUS(poseImage)){
        poseImage = await createUSTempFile(poseImage, context);    
    }

    let imageAndDepthStrenth = 0.5;
    if(option?.strength){
        if(option.strength <= 0){
            imageAndDepthStrenth = 1;
        }else if(option.strength >= 100){
            imageAndDepthStrenth = 0;
        }else{
            imageAndDepthStrenth = 1 - (option.strength / 100) * 1;
        }
    }
  
    // 标准换脸只换五官，加入这个步骤是为了学习脸型
    const res = await callReplicateAndWaitResult( context, {
        func: "omni-zero-fal", 
        access: "PRIVATE",
        email: context.userEmail,
        waitForUploadGenerated : true,
        doNotUploadToServer: option?.doNotUploadToServer || true,
        isIntermediateStep: option?.isIntermediateStep || true,
        freeOfCharge: option?.freeOfCharge || true,  
        roomId: context.room.id,
        waitResultRetryTimes: 100,
        params: {
            inputText: "a person",
            prompt: "a person",
            number_of_steps: 30,
            
            base_image: poseImage,
            base_image_strength: imageAndDepthStrenth,                            
            composition_image: poseImage,
            composition_image_strength: 1,
            style_image: poseImage,
            style_image_strength: 1,
            identity_image: faceImage,
            identity_image_strength: 1,
            depth_image: poseImage,
            depth_image_strength: imageAndDepthStrenth,
        }
    });

    if(res.status != enums.resStatus.OK) {
        return res;
    }else{
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
        return await swapFace(faceImage, resImage, context, option);
    }
    return res;
}

// 什么都不返回，说明输入错误
// 返回有 res.result.generated 说明返回成功
// 返回没有 res.result.generated 说明返回失败，在res.result里找原因
export async function swapFace(faceImage:string, poseImage:string, context:any, 
                               option?:{ freeOfCharge?:boolean, doNotUploadToServer?:boolean, isIntermediateStep?:boolean} ){
    
    let func = "faceswap";
    
 //   if(faceImage && (faceImage.indexOf("?")>0 || isBase64Image(faceImage))){
 //       faceImage = await createTempFile(faceImage, context);    
 //   }
 //   if(poseImage && (poseImage.indexOf("?")>0 || isBase64Image(poseImage))){
 //       poseImage = await createTempFile(poseImage, context);    
 //   }

    const serviceLines = [
        process.env.SERVICE_FACESWAP,
        process.env.SERVICE_FACESWAP_BACKUP,
        process.env.SERVICE_FACESWAP_BACKUP_2,
        process.env.SERVICE_FACESWAP,
        process.env.SERVICE_FACESWAP_BACKUP_3,
    ];
    let res:any = null;
    
    if(faceImage && poseImage){
        // 执行换脸操作
        for(const line of serviceLines){
            if(line){
                log(context, `face swap using service line ${line}..............`);
                res = await callReplicateAndWaitResult(context, {    
                    serviceLine : line,
                    waitDatabaseRetryTimes : 3,
                    func,
                    timeStamp : Date.now(),
                    access : "PRIVATE",
                    email: context.userEmail,
                    waitForUploadGenerated : true,
                    doNotUploadToServer: option?.doNotUploadToServer || true,
                    isIntermediateStep: option?.isIntermediateStep || true,
                    freeOfCharge: option?.freeOfCharge || true,
                    roomId:context.room.id,
                    params : { 
                        swap_image: faceImage,
                        target_image: poseImage
                    }
                });    
                if(res?.status === enums.resStatus.OK && res?.result?.generated){
                    return res;
                }
            }
        }
    }else{
        error(context, "faceImage:", faceImage);
        error(context, "poseImage:", poseImage);
    }
}

// 什么都不返回，说明输入错误
// 返回有 res.result.generated 说明返回成功
// 返回没有 res.result.generated 说明返回失败，在res.result里找原因
export async function swapFaceHD(faceImage:string, poseImage:string, context:any, 
                               option?:{ freeOfCharge?:boolean, roomId?:string, doNotUploadToServer?:boolean, isIntermediateStep?:boolean} ){
    let func = "byte-faceswap"; // "faceswapHD";
   
    if(faceImage && (faceImage.indexOf("?")>0 || faceImage.indexOf("data:image/")>=0)){
        faceImage = await createTempFile(faceImage, context);    
    }
    if(poseImage && (poseImage.indexOf("?")>0 || poseImage.indexOf("data:image/")>=0)){
        poseImage = await createTempFile(poseImage, context);    
    }

    if(faceImage && poseImage){
        // 执行换脸操作
        log(context, "face swap using swapFaceHD..............");
        let res = await callReplicateAndWaitResult(context, {    
            func,
            timeStamp : Date.now(),
            access : "PRIVATE",
            email: context.userEmail,
            waitForUploadGenerated : true,
            doNotUploadToServer: option?.doNotUploadToServer || true,
            isIntermediateStep: option?.isIntermediateStep || true,
            freeOfCharge: option?.freeOfCharge || true,
            roomId:context.room.id,
            waitResultRetryTimes: 100,
            params : { 
                swap_image: faceImage,
                target_image: poseImage
            }
        });    
        // await new Promise((resolve) => setTimeout(resolve, 10000));       
        log(context, "swapFaceHD：", res?.result?.generated, res?.status);        
        if(res?.status === enums.resStatus.OK){
            if(res?.result?.generated && res.result.generated.indexOf(".theapi.app")>=0){
                res.result.generated = await createUSTempFile(res.result.generated, context, true);
                log(context, "swapFaceHD create a US copy：", res.result.generated);        
            }        
        }        
        return res;
    }else{
        error(context, "faceImage:", faceImage);
        error(context, "poseImage:", poseImage);
    }
}

// 什么都不返回，说明输入错误
// 返回有 res.result.generated 说明返回成功
// 返回没有 res.result.generated 说明返回失败，在res.result里找原因
export async function swapFaceV4(faceImage:string, poseImage:string, params:any, context:any, 
                               option?:{ freeOfCharge?:boolean, roomId?:string, doNotUploadToServer?:boolean, isIntermediateStep?:boolean} ){
    let func = "faceswapV4";
    log(context, "face swap using swapFaceV4..............");
   
    if(faceImage && !isInUS(faceImage)){
        faceImage = await createUSTempFile(faceImage, context);    
    }
    if(poseImage && !isInUS(poseImage)){
        poseImage = await createUSTempFile(poseImage, context);    
    }

    if(faceImage && poseImage){
        // 执行换脸操作
        try{
            await enterUserWaitingList(context, "swapFaceV4", 3, 100);
            let res = await callReplicateAndWaitResult(context, {    
                func,
                timeStamp : Date.now(),
                access : "PRIVATE",
                email: context.userEmail,
                waitForUploadGenerated : true,
                doNotUploadToServer: option?.doNotUploadToServer || true,
                isIntermediateStep: option?.isIntermediateStep || true,
                freeOfCharge: option?.freeOfCharge || true,
                roomId:context.room.id,
                waitResultRetryTimes: 100,            
                params : { 
                    swap_image: faceImage,
                    target_image: poseImage,
                    model_type: params.model_type,
                    swap_type: params.swap_type,
                    style_type: params.style_type,
                    hardware: params.hardware || "cost",
                }
            });    
            // await new Promise((resolve) => setTimeout(resolve, 10000));        
            return res;
        }finally{
            leaveUserWaitingList(context, "swapFaceV4", 60);
        }
    }else{
        error(context, "faceImage:", faceImage);
        error(context, "poseImage:", poseImage);
    }
}

// 什么都不返回，说明输入错误
// 返回有 res.result.generated 说明返回成功
// 返回没有 res.result.generated 说明返回失败，在res.result里找原因
export async function swapFaceGPT(faceImage:string, poseImage:string, context:any, 
                               option?:{ freeOfCharge?:boolean, roomId?:string, doNotUploadToServer?:boolean, isIntermediateStep?:boolean} ){
    let func = "gpt-image-1-edit-medium";
    log(context, "face swap using swapFace GPT..............");

    if(faceImage && poseImage){
        // 执行换脸操作
        let res = await callReplicateAndWaitResult(context, {    
            func,
            timeStamp : Date.now(),
            access : "PRIVATE",
            email: context.userEmail,
            waitForUploadGenerated : true,
            doNotUploadToServer: option?.doNotUploadToServer || true,
            isIntermediateStep: option?.isIntermediateStep || true,
            freeOfCharge: option?.freeOfCharge || true,
            roomId:context.room.id,
            waitResultRetryTimes: 100,            
            params : { 
                prompt: "把第二张照片人物的脸换到第一张照片的人物",
                imageURLs: [poseImage, faceImage],
            }
        });    
        // await new Promise((resolve) => setTimeout(resolve, 10000));        
        return res;
    }else{
        error(context, "faceImage:", faceImage);
        error(context, "poseImage:", poseImage);
    }
}
        
// freeOfCharge
export async function refine(context:any, imageURL:string, upscale:number=1, params?:{face_upsample:boolean, background_enhance:boolean}){
    let res = await callReplicateAndWaitResult(context, {
        serviceLine : process.env.SERVICE_ZOOMIN,        
        func: "zoomIn",
        email: context.userEmail,
        freeOfCharge: true,
        doNotUploadToServer: true,
        isIntermediateStep: true,        
        roomId: context.room.id,
        params: {
            image: imageURL, 
            repair: true,            
            codeformer_fidelity: 1,            
            background_enhance: params?.background_enhance || true, 
            face_upsample: params?.face_upsample || true,
            upscale: upscale,
        }
    });   
    if(!res.result?.generated){
        res = await callReplicateAndWaitResult(context, {
            serviceLine : process.env.SERVICE_ZOOMIN_BACKUP,        
            func: "zoomIn",
            email: context.userEmail,
            freeOfCharge: true,
            doNotUploadToServer: true,
            isIntermediateStep: true,        
            roomId: context.room.id,
            params: {
                image: imageURL, 
                codeformer_fidelity: 0.9,            
                background_enhance: params?.background_enhance || true, 
                face_upsample: params?.face_upsample || true,
                upscale: upscale,
            }    
        });               
    }
    return res;
}

export async function advanceRefine(context:any, imageURL:string, prompt?:string){
    const res = await callReplicateAndWaitResult(context, {
        func: "simImage",
        roomId:context.room.id,
        freeOfCharge: true,
        isIntermediateStep: true,
        doNotUploadToServer: true,
        email: context.userEmail,
        access:"PRIVATE",
        params:{
            imageURL,
            prompt: prompt || "a photo",
            promptStrength: 0.4
        }
    });
    return res;
}


async function createNewRoom(reqBody:any, email:string, price:number, status?:string, auditResult?:string){
    reqBody.email = email; 
    try{
        return await prisma.room.create({
            data: {
                replicateId: String(Date.now()),
                user: {
                    connect: {
                        email: email || reqBody.uid,
                    },
                },
                inputImage: "",
                outputImage: defaultImage.roomCreating,
                status: status || enums.roomStatus.creating,
                zoomInImage: "",
                prompt: reqBody.params?.inputText || reqBody.params?.prompt || "",
                func: reqBody.cmd,
                usedCredits: price ?? Math.round(price),
                model: reqBody.params?.modelurl || "",
                access: "PRIVATE", // 图片缺省都是私有的，除非前端特别要求
                viewTimes: 0, // Math.floor(Math.random() * 10) + 1, // 只有查看数量是可以给一个初始值的
                dealTimes: 0, // 牵涉到结算，所以必须真实
                likes: 0,
                aiservice: "",
                predicturl: "",
                bodystr: JSON.stringify(reqBody), // 完整保留用户请求
                seed: null,
                resultType: reqBody.params?.resultType || "IMAGE",
                createdAt: new Date().toISOString(),
                audit: auditResult,
                preRoom: reqBody.preRoomId ? { connect: { id: reqBody.preRoomId } } : undefined,
            } as Prisma.RoomCreateInput, // ✅ 强制类型转换,
        });
    }catch(e){
        error(null, "createNewRoom:", e);
    }
}


// 处理视频声音拷贝
async function copyAudioFromVideo(videoWithoutAudio:string, videoWithAudio:string){
    if(videoWithoutAudio && videoWithAudio){       
        const result = await vu.mixAudioFromVideo(videoWithAudio, videoWithoutAudio, false, "U");
        // const result = await vu.copyAudioFromVideo(videoWithAudio, videoWithoutAudio); 速度太慢
        log(null, "copyAudioFromVideo返回结果:", result);
        if(result){
            if(result != videoWithoutAudio){
                // 删除原始视频
                await fs.deleteFileByURL(videoWithoutAudio);                    
            }
            log(null, videoWithoutAudio, "已经被删除");
            return result;
        }
    }
}



async function enterUserWaitingList(context:any, funcName:string, queryInterval:number=5, maxLen:number=5){
    let listName = `${funcName}_${context.user.id}_WAITING_LIST`;
    return await enterWaitingList(listName, context.room.id, {
        queryInterval, maxLen});
}
async function leaveUserWaitingList(context:any, funcName:string, BPM:number=1){
    let listName = `${funcName}_${context.user.id}_WAITING_LIST`;
    return await leaveWaitingList(listName, context.room.id, {BPM});
}



const prefixModelUsedTimes = "MODEL_USED_TIMES"
async function getUserModelUsedTimesPerDay(context:any, model:string){
    const today = du.getLocalDateStr(new Date());
    return await getUserModelUsedTimes(context.user.id, `${today}_${model}`, config.websiteName!);
}
async function addUserModelUsedTimesPerDay(context:any, model:string){
    const today = du.getLocalDateStr(new Date());    
    return await addUserModelUsedTimes(context.user.id, `${today}_${model}`, config.websiteName!);
}
async function getUserModelUsedTimes(userId:string, model:string, website:string){
    try{
        const value = await auc.getAppUserConfigValue(website, userId, `${prefixModelUsedTimes}_${model}`);
        if(value){
            return value;
        }else{
            return 0;
        }
    }catch(err){
        error(null, "Exception in getUserModelUsedTimesPerDay", err);
    }
    return 0;
}

async function addUserModelUsedTimes(userId:string, model:string, website:string){
    try{
        let value = await getUserModelUsedTimes(userId, model, website);
        value ++;
        const key = `${prefixModelUsedTimes}_${model}`;        
        await auc.updateAppUserConfig(website, userId, [{key, value}]);
    }catch(err){
        error(null, "Exception in addUserModelUsedTimesPerDay", err);
    }
}


function log(context:any, ...content:any){
    debug.log(content);
    dbLogger.log("Room", context?.room?.id || context, "workflowAgent2", content);    
}
function warn(context:any, ...content:any){
    debug.warn(content);
    dbLogger.warn("Room", context?.room?.id || context, "workflowAgent2", content);    
}
function error(context:any, ...content:any){
    debug.error(content);
    dbLogger.error("Room", context?.room?.id || context, "workflowAgent2", content);    
}
