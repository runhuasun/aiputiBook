import {AliCVService} from '../ai/cv/AliCVService';
import * as debug from "./debug";
import * as vu from "./videoUtils";
import * as fu from "./fileUtils";

const tf = require('@tensorflow/tfjs-node');
const nsfw = require('nsfwjs');
import fetch from 'node-fetch';


export async function auditURL(url:string, fileType:string){
    debug.log(`auditing ${url} ......`);
    let auditResult:string = "";
    if(process.env.DEAMON_AUDIT_SERVICE === "LOCAL"){
        auditResult = await auditByLocal(url, fileType);
    }else{
        auditResult = await auditByAli(url, fileType);
    }
    debug.log(`audit result: ${auditResult}`);
    return auditResult;
}

export async function auditByLocal(url:string, fileType:string){
    try{
        let jsonResponse:any;
        if(fileType=="IMAGE"){
            jsonResponse = await localAuditImage(url);
        }else if(fileType=="VIDEO"){
            jsonResponse = await localAuditVideo(url);
        }else{
            return "N";
        }
        
        if(jsonResponse.porn >= 0.15){
            return "P";
        }
    }catch(err){
        debug.error("deamon thread audit exception:", err);
        return "ERROR";
    }
    return "N"; // 只有这种情况是正常的    
}


export async function auditByAli(url:string, fileType:string){
    try{
        let jsonResponse:any;
        if(fileType=="IMAGE"){
            jsonResponse = await AliCVService.auditImage(url);
        }else if(fileType=="VIDEO"){
            jsonResponse = await AliCVService.auditVideo(url);
        }else{
            return "N";
        }
        
        if(jsonResponse?.status == "ERROR"){
            debug.error("deamon thread audit error:", jsonResponse.message);
            return "ERROR";                
        }else{
            const scenes = jsonResponse.scenes;
            if(["politics", "outfit", "logo", "parade", "flag"].includes(scenes.terrorism) || scenes.ad == "politics"){
                return "Z";
            }
            if(scenes.terrorism == "bloody" || scenes.ad == "terrorism"){
                return "T";
            }
            if(scenes.terrorism == "drug" || scenes.live == "drug"){
                return "D";
            }        
            if(scenes.porn == "porn" || scenes.ad == "porn"){
                return "P";
            }
        }  
    }catch(err){
        debug.error("deamon thread audit exception:", err);
        return "ERROR";
    }
    return "N"; // 只有这种情况是正常的    
}



// NSFW模型
// https://github.com/justadudewhohacks/face-api.js/

let auditModel:any;
// 加载NSFW模型
async function getAuditModel(){
    if(!auditModel){
        auditModel = await nsfw.load();
    }
    return auditModel;
}

/* 本地模型检测NSFW
返回数据格式:
[
{"className":"Porn","probability":0.5726202130317688},
{"className":"Sexy","probability":0.40614232420921326},
{"className":"Hentai","probability":0.01827971264719963},
{"className":"Neutral","probability":0.0026976477820426226},
{"className":"Drawing","probability":0.0002601182204671204}
]
*/
export async function localAuditImage(imageURL:string, fileType="URL") {
    const start = new Date();

    const result:any = {
        porn: 0,
        sexy: 0
    }

    let image:any;

    try{
        // 从buffer中解码图像
        if(fileType=="URL" && fu.isURL(imageURL)){
            // 使用fetch API下载图片
            const response = await fetch(imageURL);
            const buffer = await response.buffer(); // 转换响应为buffer        
            image = await tf.node.decodeImage(buffer, 3);
        }else{
            image = await tf.node.decodeImage(require('fs').readFileSync(imageURL), 3);
        }
    
        // 对图像进行分类
        const predictions = await (await getAuditModel()).classify(image);
        image.dispose(); // 释放图像占用的Tensor内存
        const end = new Date();
        debug.log("audit time:", end.getTime() - start.getTime());
        debug.log("audit result:", JSON.stringify(predictions));
    
        for(const p of predictions){
            if(p.className == "Porn" || p.className == "Hentai"){
                if(p.probability > result.porn){
                    result.porn = p.probability;
                }
            }
            if(p.className == "Sexy"){
                if(p.probability > result.sexy){
                    result.sexy = p.probability;
                }
            }
        }
    }catch(err){
        debug.error("audit Image Exception:", imageURL, err);
    }
    return result;
}


export async function localAuditVideo(videoURL:string){
    let auditResult:any =  {
        porn: 0,
        sexy: 0
    }
    try{
        // 取视频长度的10%，30%，50%，70%，90%五个snapshot进行检测
        let videoLength = await vu.getVideoLength(videoURL);
        let percents:number[];
        if(videoLength){
            videoLength = videoLength * 1000;
            percents = [0, 0.4, 0.8];
        }else{
            videoLength = 0;
            percents = [0];
        }
        
    
        for(const t of percents){
            const frameFile = await vu.captureFrameToLocal(videoURL, Math.floor(videoLength*t));
            if(frameFile){
                const frameResult = await localAuditImage(frameFile, "FILE");
                if(frameResult.porn > auditResult.porn){
                    auditResult.porn = frameResult.porn;
                }
                if(auditResult.porn > 0.3){
                    break;
                }
            }
        }
    }catch(err){
        debug.error("audit Video Exception:", videoURL, err);        
    }
    return auditResult;
}


