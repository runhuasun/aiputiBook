import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as Upload from "upload-js-full";
import {moveToFileServer} from "../../utils/fileServer";
import fs from 'fs'
import path from 'path'
import * as Fetcher from "node-fetch";
import {log, warn, error} from "../../utils/debug";
import {useCredits, returnCreditsById, giveFreeCreditsById} from "./creditManager";
import * as enums from "../../utils/enums";




// @ts-ignore
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 首先告诉回调方，我已经收到消息
    res.status(200).json({ message: "OK" });
    
    const result = req.body;
    log("-------------enter train LoRA Hook---------------");
    log(JSON.stringify(req.body));
    try {
        // 找到对应的训练模型
        const models = await prisma.model.findMany({
            where: {
                func: "lora",
                proId: result.id,
            },
            select: {
                id: true,
                userId: true,
                usedCredits: true,
                callbacked: true,
                url: true,
                trainSrv: true,
            },
        });
        
        if(models.length != 0){
            let m = models[0];
            
            if(m.callbacked == "N"){
                
                // 先把状态置为'Y'，防止二次进入
                await prisma.model.update({
                    where: { id: m.id },
                    data: { callbacked: "Y" }
                });
        
                if(result.status == "succeeded"){
                    if(m.trainSrv == "ostris / flux-dev-lora-trainer"){ // flux训练不需要上传模型
                        const modelUrl = result.output.weights;
                        let uploaded:string="";
                        // 更新训练任务
                        await prisma.model.update({
                            where: { id: m.id },
                            data: {
                                url: result.output.version,
                                finishTime: result.completed_at,
                                status: "FINISH"                                
                            }  // 替换到正式URL
                        });                        
                        log("star to upload ostris / flux-dev-lora-trainer MODEL：" + modelUrl);
                        moveToFileServer(modelUrl, "M").then(async (uploaded)=>{
                            if(uploaded){
                                log("SUCCEEDED to upload ostris / flux-dev-lora-trainer MODEL：" + modelUrl + " TO:" + uploaded);
                                await prisma.model.update({
                                    where: { id: m.id },
                                    data: {
                                        proMsg: uploaded,  // 这里保存在OSS备份的.tar文件
                                        weights: modelUrl // 平时使用在replicate保存.tar格式的weights，这样节省流量
                                    }  // 替换到正式URL
                                });
                                
                            }else{
                                error("FAILED to upload ostris / flux-dev-lora-trainer MODEL：" + modelUrl);
                            }
                        });
                    }else{
                        // 把模型上传到文件服务器
                        let modelUrl = result.output;
                        log("lora file generated:" + modelUrl);
    
                        // 更新训练任务
                        await prisma.model.update({
                            where: { id: m.id },
                            data: { 
                                status: "FINISH", 
                                finishTime: new Date(),
                                url: modelUrl 
                            }
                        });
                        
                        moveToFileServer(modelUrl, "M").then(async (uploaded)=>{
                            if(uploaded){
                                log("lora file uploaded to:" + uploaded);                            
                                // 更新训练任务
                                await prisma.model.update({
                                    where: { id: m.id },
                                    data: {
                                        url: uploaded,
                                        proMsg: modelUrl  || "",
                                    }  // 替换到正式URL
                                });
                            }else{
                                error("no file uploaded in trainLoRA_Hook");
                            }
                        });
                    }
                    
                    // 模型训练成功赠送30个提子
                    // await giveFreeCreditsById(m.userId, 30, enums.creditOperation.CREATE_MODEL_BONUS);
                
                }else if(result.status == "failed"){
                    
                    let errorMsg = result.error;
                    
                    if(errorMsg != null && errorMsg  == "No images found in the instance data root."){
                        errorMsg = "在压缩文件的根目录没有发现图片文件，这通常是使用windows自带的压缩工具导致的，请更换一个压缩工具。";
                    }else{
                        errorMsg = "训练模型时发生未知的错误，请和管理员联系反馈！";
                    }
                    
                    // 更新训练任务，记录失败状态和原因
                    await prisma.model.update({
                        where: { id: m.id },
                        data: {
                            status: "ERROR",
                            proMsg: errorMsg,
                        }
                    });
                    
                    // Increment their credit if something went wrong
                    await returnCreditsById(m.userId, m.usedCredits, enums.creditOperation.CREATE_MODEL, m.id);
                    
                    throw new Error();
                }else{
                    console.error("没有正确响应训练模型的结果：", result.status);
                }
            }
        } 
        
    }catch(err){
        error("Train LoRA Hook exception:", err);
    }    
}

