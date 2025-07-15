import fs from 'fs'
import path from 'path'
import * as Fetcher from "node-fetch";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import * as Upload from "upload-js-full";

import prisma from "../../lib/prismadb";
import {useCredits, returnCredits} from "./creditManager";
import {getPricePack} from "../../utils/funcConf";
import {config} from "../../utils/config";
import {log, warn, error} from "../../utils/debug";
import * as enums from "../../utils/enums";
import * as monitor from "../../utils/monitor";

export type GenerateResponseData = {
  original: string | null;
  generated: string | null;
  id: string;
};

const proxyURL = process.env.REPLICATE_API_PROXY || "http://gpt.aiputi.cn:7777/api/replicate";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponseData | string>
) {
    
    log("----start train lora model----");
    const { email, id, trainer, name, inputFiles, theme, access, channel } = req.body;
  
    // Check if user is logged in
    let userEmail = email;
    let session:any;
    if(!userEmail){
        session = await getServerSession(req, res, authOptions);
        if (!session || !session.user) {
            return res.status(400).json("请先登录！");
        }else{
            userEmail = session.user.email;
        }
    }
    
    // Get user from DB
    const user = await prisma.user.findUnique({
        where: {
            email: userEmail,
        }
    });

    monitor.logApiRequest(req, res, session, user, req.body);  
  
    const price = getPricePack(config, "createLoRA").price || "99";

    // Check if user has any credits left
    if(user?.credits == undefined){
        return res.status(500).json("请先登录！");
    }else if (user?.credits <= 0) {
        return res.status(400).json("你已经没有"+config.creditName+"了，请先去买一些");
    }else if(user?.credits < price ){
        return res.status(400).json("很抱歉您的"+config.creditName+"不够了，请先去买一些");
    }

    let newmodel:any;    
    try {
        if(!id){ // 如果不是重新训练模型    
            // 判断模型名称是否已经存在
            const models = await prisma.model.findMany({
                where: {
                    func: "lora",              
                    name: name,
                },
                select: {
                    id: true,            
                }, 
            });
            if(models.length > 0){
                return res.status(400).json("已经存在同样名字的模型，请换一个！");
            }  
        }
        
        let version = "";
        let trainFlux = trainer == "ostris / flux-dev-lora-trainer";
        switch(trainer){
            case "ostris / flux-dev-lora-trainer":
                version = "4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa";
                break;
            case "zylim0702 / sdxl-lora-customize-training":
                // "zylim0702/sdxl-lora-customize-training:2ea90da29b19984472a0bbad4ecb39abe4b91fa0d6a5e8dc59988022149dee55",
                version = "2ea90da29b19984472a0bbad4ecb39abe4b91fa0d6a5e8dc59988022149dee55";
                break;
            case "lucataco / ssd-lora-training":
                // lucataco/ssd-lora-training:28d7173225f9a3320ad19bbf78e37bd23eb0681362aba460a191bcf25f5a7afc
                version = "28d7173225f9a3320ad19bbf78e37bd23eb0681362aba460a191bcf25f5a7afc";
                break;
            case "alexgenovese / train-sdxl-lora":
                // alexgenovese/train-sdxl-lora:1483a3e5690fb21164a1a96d2e290961a4fadf130a556370688b56a60f1a7f64
                version = "1483a3e5690fb21164a1a96d2e290961a4fadf130a556370688b56a60f1a7f64";
                break;
            case "lucataco / realvisxl2-lora-training":
            default:
                // version: "lucataco/realvisxl2-lora-training：ac286d7cdfa4ae75bc78e5ee998f55c4318dfaa0efe651eb3c0342417d59a690"
                version = "ac286d7cdfa4ae75bc78e5ee998f55c4318dfaa0efe651eb3c0342417d59a690";
        }     

        let code:string;

        if(id){
            newmodel = await prisma.model.findUnique({
                where: {
                    id
                },
                select: {
                    code: true
                }
            });
            code = newmodel?.code;
        }

        if(newmodel){
            // 这里是重新训练现有的模型
            newmodel = await prisma.model.update({
                where: {
                    id
                },
                data: {
                    datasets: inputFiles,
                    userId: user.id,
                    name: name,
                    usedCredits: {
                        increment: price,
                    },
                    access: access,
                    trainSrv: trainFlux ? trainer : version,
                    aiservice: "replicate",
                    baseModel: trainer,
                    proId: "",
                    url: trainFlux ? `${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}` : "",
                    proMsg: trainFlux ? `${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}` : "",
                    theme: theme? theme : "FACE",
                    callbacked: "N",
                },
            });
        }else{  
            code = generateModelCode();            
            // 创建一个训练任务
            newmodel = await prisma.model.create({
              data: {
                datasets: inputFiles,
                code: code,
                userId: user.id,
                name: name,
                func: "lora",
                status: "CREATE",
                usedCredits: price,
                access: access,
                // trainSrv: "b2a308762e36ac48d16bfadc03a65493fe6e799f429f7941639a6acec5b276cc",
                trainSrv: trainFlux ? trainer : version,
                aiservice: "replicate",
                baseModel: trainer,
                proId: "",
                url: trainFlux ? `${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}` : "",
                proMsg: trainFlux ? `${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}` : "",
                coverImg: "",
                createTime: new Date().toISOString(),
                totalIncome: 0,
                ownerIncome: 0,
                desc: "",
                theme: theme? theme : "FACE",
                channel: channel || "PUBLIC"
               },
            });
        }
        
        // 先把credit减少
        await useCredits(user, price, enums.creditOperation.CREATE_MODEL, newmodel.id);
        
        log("---- lora training task created----");

        // 调用AI服务
        // let predicturl = "https://api.replicate.com/v1/predictions";
        let authstr = "Token " + process.env.REPLICATE_API_KEY;
        log("lora training dattaset: " + inputFiles);
        
        let body:any;
        switch(trainer){
            case "ostris / flux-dev-lora-trainer":
                // 创建模型
                const newmodelOfRep = await createNewModel(code!.toLowerCase());
                body = {
                    cmd: "TRAIN_FLUX_LORA",
                    // predictUrl: "https://api.replicate.com/v1/trainings",                  
                    // predictUrl: `https://api.replicate.com/v1/models/${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}/versions/4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa/trainings`,
                    // https://api.replicate.com/v1/models/runhuasun/m24031701/versions/4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa/trainings                
                    model_owner: "ostris",
                    model_name: "flux-dev-lora-trainer",
                    version: "e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497",
                    params : {
                        // version: "ostris/flux-dev-lora-trainer:4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa",
                        destination: `${process.env.REPLICATE_API_ACCOUNT}/${code!.toLowerCase()}`,
                        input: {
                            input_images: inputFiles,
                            steps: 1000,
                            lora_rank: 16,
                            optimizer: "adamw8bit",
                            batch_size: 1,
                            resolution: "512,576,768,1024",
                            autocaption: true,
                            trigger_word: "TOK",
                            learning_rate: 0.0004,
                            wandb_project: "flux_train_replicate",
                            wandb_save_interval: 100,
                            caption_dropout_rate: 0.05,
                            cache_latents_to_disk: false,
                            wandb_sample_interval: 100                          
                        },        
                        webhook: process.env.WEBSITE_URL + "/api/trainLoRA_Hook",
                        webhook_events_filter: ["completed"]        
                    }                        
                };
                break;
            
            default:
                body = {
                    version: version,
                    input: {
                        input_images: inputFiles,
                        resolution: 1024,
                        is_lora: true,
                        use_face_detection_instead: theme=="FACE",
                        token_string: "TOK",
                        caption_prefix: "a photo of TOK,"
                    },        
                    webhook: process.env.WEBSITE_URL + "/api/trainLoRA_Hook",
                    webhook_events_filter: ["completed"]        
                };
                // 这段只适用于特定训练服务，现在被屏蔽了
                switch(theme){
                    case "FACE":
                        body.input.class_token = "human";
                        break;
                    case "OBJECT":
                        body.input.class_token = "object";
                        break;
                    case "STYLE":
                        body.input.class_token = "style";
                        break;
                }
        }
        

        // POST request to Replicate to start the image restoration generation process
        // 服务器不稳定，每隔五秒重试一次，一共3次
        let retry = 0;
        let startResponse = null;
        let jsonStartResponse = null;
        while(retry++ < 3){
            try{
                startResponse = await fetch(proxyURL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                });
                jsonStartResponse = await startResponse.json();
            } catch (e) {
                error("提交AI服务器训练模型时，发生异常失败");
                error(e);
            }                       
          
            if(startResponse && jsonStartResponse && jsonStartResponse.status == "starting"){
                break;
            } else {
                error("调用AI服务器失败：");
                error(JSON.stringify(jsonStartResponse));
                error("第" + retry + "次重新尝试中.......");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }

        // 如果生成任务成功就在数据库中更新状态到START
        if(jsonStartResponse && jsonStartResponse.status == "starting"){
            await prisma.model.update({
                where: {
                    id: newmodel.id,
                },
                data: {
                    status: "START",
                    proId: jsonStartResponse.id,
                },
            });
        }else{
            await prisma.model.update({
                where: {
                    id: newmodel.id,
                },
                data: {
                    status: "ERROR",
                },
            });
            throw new Error("启动训练任务失败");
        }
      
        res.status(200).json("小模型训练任务已经成功启动！请耐心等待训练完成。");
    
    } catch (e) {
        // Increment their credit if something went wrong
        if(newmodel?.id){
          await returnCredits(user, price, enums.creditOperation.CREATE_MODEL, newmodel?.id);
        }
        error(e);
        res.status(500).json("启动训练任务时发生意外失败！将退回您的"+config.creditName);
    }
}


async function createNewModel(modelName:string){
    log("createNewModel");
    try{
        const res = await fetch(proxyURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                predictUrl: "https://api.replicate.com/v1/models",
                params: {
                    hardware: "gpu-a100-large",
                    owner: process.env.REPLICATE_API_ACCOUNT,
                    name: modelName,
                    visibility: 'private'
                }
            }),
        });
        const json = await res.json();
        log(JSON.stringify(json));
        if(json.status == 200){
            return true;
        }else{
            return false;
        }
    }catch(err){
        error("createNewModel error:", err);
    }
}

function generateModelCode(){
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0');

    return year + month + day + hours + minutes + seconds + milliseconds;
}
