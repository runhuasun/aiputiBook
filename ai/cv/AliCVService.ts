const http = require('http');
const https = require('https');
import { Readable } from 'stream';

import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import * as $tea from '@alicloud/tea-typescript';

import videoenhan20200320, * as $videoenhan20200320 from '@alicloud/videoenhan20200320';
import facebody20191230, * as $facebody20191230 from '@alicloud/facebody20191230';

// const ImageenhanClient = require('@alicloud/imageenhan20190930');
const ImagesegClient = require('@alicloud/imageseg20191230');
const ViapiClient = require('@alicloud/viapi20230117');
const ImageauditClient = require('@alicloud/imageaudit20191230');

import * as iu from "../../utils/imageUtils";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {BaseCVService} from "./BaseCVService";
import * as vu from "../../utils/videoUtils";
import * as fu from "../../utils/fileUtils";
import * as fs from "../../utils/fileServer";
import * as enums from "../../utils/enums";


export class AliCVService extends BaseCVService{
    public modelName: string = "ali";
    public predicturl: string = "";
    public version: string = "";
    public func: string = "";
    public replicate = null;
    public client:any = null;
    public predictType = "";
    public resultType: string = "MEDIA";
    private async: string = "enable";
    
    constructor(func:string){
        super();

//        if(func === "flux-merged"){
//            this.func = "flux-dev";
//        }else{
            this.func = func;
 //       }
        switch(this.func){
            case "video2cartoon":
                this.predicturl = `videoenhan.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "MEDIA";
                break;
                
            case "faceTidyup":
            case "faceMakeup":
            case "faceFilter":
            case "enhanceFace":
            case "faceBeauty":
            case "liquifyFace":
            case "retouchSkin":
            case "photo2cartoon":
                this.predicturl = `facebody.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "MEDIA";                
                break;
          //  case "cartoonize":
          //      this.predicturl = `imageenhan.cn-shanghai.aliyuncs.com`;
          //      this.predictType = "NODE";
          //      this.resultType = "MEDIA";                
          //      break;
                
            case "recognizeFace":                
            case "detectFace": //图像格式：JPEG、JPG、PNG、BMP。图像大小：不超过30 MB。图像分辨率：大于32×32像素，小于8192×8192像素，人脸占比不低于64×64像素。URL地址中不能包含中文字符。
                this.predicturl = `facebody.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "JSON";                
                break;

            case "segmentHair":
                this.predicturl =  `imageseg.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "JSON";
                break;
            case "segmentBody":
                this.predicturl =  `imageseg.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "MEDIA";
                break;
            case "segmentHead":
                this.predicturl =  `imageseg.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "JSON";
                break;    
            case "segmentSkin":
                this.predicturl =  `imageseg.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "MEDIA";
                break;
            case "segmentCloth":
                this.predicturl =  `imageseg.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "MEDIA";
                break;
                
                
            case "imageAudit": // 大于256*256，小于3M
                this.predicturl = `imageaudit.cn-shanghai.aliyuncs.com`;
                this.predictType = "NODE";
                this.resultType = "JSON";
                break;

                /////////////////////////////////////////////////////////////////////////////////////////////
                // 万象模型
            case "stable-diffusion-3.5-large":
            case "stable-diffusion-3.5-large-turbo":
            case "flux-schnell":
            case "flux-dev":
            case "flux-merged":

            case "wanx-v1":
            case "wanx2.1-t2i-plus":
            case "wanx2.1-t2i-turbo":
            case "wanx2.0-t2i-turbo":

            case "wanx-ast":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;     
                
            case "wanx-poster-generation-v1":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;     

            case "wanx2.1-imageedit":
            case "wanx-x-painting":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;     

            case "image-out-painting":
                this.predicturl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/out-painting";
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;     

            case "video-style-transform":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;
                
            case "videoretalk":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;
            
            case "emo-v1":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;
            case "emo-detect-v1":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect`;
                this.predictType = "HTTP";
                this.resultType = "JSON";                
                this.async = "disable";
                break;
            case "liveportrait":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis`;
                this.predictType = "HTTP";
                this.resultType = "MEDIA";                
                break;
            case "liveportrait-detect":
                this.predicturl = `https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect`;
                this.predictType = "HTTP";
                this.resultType = "JSON";                
                this.async = "disable";
                break;            
            default:
                this.predicturl = func;
        }                    
    }

    private createClient() {
        if(!this.client){
            // 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考。
            // 建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378664.html。
            let config = new $OpenApi.Config({
                accessKeyId: process.env['ALI_ACCESS_KEY_ID'],
                accessKeySecret: process.env['ALI_ACCESS_KEY_SECRET'],
            });
            // Endpoint 请参考 https://api.aliyun.com/product/videoenhan
            config.endpoint = this.predicturl;
            switch(this.func){
                case "video2cartoon":
                    this.client = new videoenhan20200320(config);
                    break;
                
                case "faceTidyup":
                case "faceMakeup":
                case "faceFilter":
                case "enhanceFace":
                case "faceBeauty":
                case "liquifyFace":
                case "retouchSkin":
                case "photo2cartoon":
                case "detectFace":
                case "recognizeFace":
                    this.client = new facebody20191230(config);
                    break;

                case "segmentSkin":
                case "segmentHair":                    
                case "segmentBody":
                case "segmentHead":
                case "segmentCloth":
                    this.client = new ImagesegClient.default(config);
                    break;        

                case "imageAudit":
                    this.client = new ImageauditClient.default(config);
                    break;

            //    case "cartoonize":
            //        this.client = new ImageenhanClient.default(config); 
            }
        }
        
        return this.client;        
    }    

    private async getResponse(url:string) {
        //log("getResponse:", url);
        const urlObj = new URL(url);
        //log("getReponse, urlObj", urlObj.protocol);
        const httpClient = (urlObj.protocol == "https:") ? https : http;
        return new Promise((resolve, reject) => {
            httpClient.get(urlObj, function (response:any) {
                resolve(response);
            })
        })
    }
    
    private async callAliService(input:any){
        let runtime = new $Util.RuntimeOptions({
            readTimeout : 30000,             
            connectTimeout: 10000,
        });    

        let request:any;

        // 阿里云限制图片大小不超过2000*2000
        let tempImageURL:any;
     //   const size = await iu.getImageSize(input.imageURL);
     //   if(size && (size.width>2000 || size.height>2000)){
     //       tempImageURL = await iu.resizeImage(input.imageURL, 2000);
     //       if(tempImageURL){
     //           input.imageURL = tempImageURL;
     //       }
     //   }
        
        switch(this.func){
            case "video2cartoon":
                request = new $videoenhan20200320.GenerateHumanAnimeStyleVideoAdvanceRequest(input);
                request.videoUrlObject = await this.getResponse(input.videoUrl) as Readable | undefined;
                request.cartoonStyle = input.cartoonStyle;
                return await this.client.generateHumanAnimeStyleVideoAdvance(request, runtime);
            
            case "photo2cartoon":
                request = new $facebody20191230.GenerateHumanAnimeStyleAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.generateHumanAnimeStyleAdvance(request, runtime);

         //   case "cartoonize":
         //       request = new ImageenhanClient.GenerateCartoonizedImageAdvanceRequest();
         //       request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
         //       return await this.client.generateCartoonizedImageAdvance(request, runtime);
                
            // 美颜类    
            case "faceTidyup":
                request = new $facebody20191230.FaceTidyupAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.faceTidyupAdvance(request, runtime);               
                
            case "faceMakeup":
                request = new $facebody20191230.FaceMakeupAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.faceMakeupAdvance(request, runtime);               
                
            case "faceFilter":
                request = new $facebody20191230.FaceFilterAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.faceFilterAdvance(request, runtime);               
                
            case "enhanceFace":
                request = new $facebody20191230.EnhanceFaceAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.enhanceFaceAdvance(request, runtime);
                
            case "faceBeauty":
                request = new $facebody20191230.FaceBeautyAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.faceBeautyAdvance(request, runtime);
                
            case "retouchSkin":
                request = new $facebody20191230.RetouchSkinAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.retouchSkinAdvance(request, runtime);

            case "liquifyFace":
                request = new $facebody20191230.LiquifyFaceAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;  
                return await this.client.liquifyFaceAdvance(request, runtime);
            // end 美颜类
                
            case "recognizeFace":
                log("recognizeFace.......");
                request = new $facebody20191230.RecognizeFaceAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                if(request.imageURLObject){
                    return await this.client.recognizeFaceAdvance(request, runtime);
                }else{
                    error("request.imageURLObject undefined");
                }
                break;
                
            case "detectFace":
                log("detect face.......");
                request = new $facebody20191230.DetectFaceAdvanceRequest(input);
                request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                if(request.imageURLObject){
                    return await this.client.detectFaceAdvance(request, runtime);
                }else{
                    error("request.imageURLObject undefined");
                }
                break;

                // 分割类
            case "segmentHair":
                 request = new ImagesegClient.SegmentHairAdvanceRequest(input);
                 request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                return await this.client.segmentHairAdvance(request, runtime);                
                
            case "segmentBody":
                 request = new ImagesegClient.SegmentBodyAdvanceRequest(input);
                 request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                return await this.client.segmentBodyAdvance(request, runtime);  
                
            case "segmentHead":
                 request = new ImagesegClient.SegmentHeadAdvanceRequest(input);
                 request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                return await this.client.segmentHeadAdvance(request, runtime);  
                
            case "segmentSkin":
                 request = new ImagesegClient.SegmentSkinAdvanceRequest(input);
                 request.URLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                return await this.client.segmentSkinAdvance(request, runtime);  
                
            case "segmentCloth":
                 request = new ImagesegClient.SegmentClothAdvanceRequest(input);
                 request.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                return await this.client.segmentClothAdvance(request, runtime);  

                
                // 稽核图片
            case "imageAudit":
                const task1 = new ImageauditClient.ScanImageAdvanceRequestTask();
                task1.imageURLObject = await this.getResponse(input.imageURL) as Readable | undefined;
                request = new ImageauditClient.ScanImageAdvanceRequest({
                    task:[task1], scene:["porn", "terrorism"]
                    // task:[task1], scene:["porn", "terrorism", "ad", "live"]
                   // task:[task1], scene:["porn"]                    
                });                
                return await this.client.scanImageAdvance(request, runtime);  
                
        }

        // 清理临时文件
        if(tempImageURL){
            fs.deleteFileByURL(tempImageURL);
        }
    }

    public async predict(input:any){
        switch(this.predictType){
            case "NODE":
                return await this.nodePredict(input);
            case "HTTP":
                return await this.httpPredict(input);
        }
    }

    public async getPredictResult(id:string): Promise<{id:string; status:number; result?:any} | undefined> {
        switch(this.predictType){
            case "NODE":
                return await this.getNodePredictResult(id);
            case "HTTP":
                return await this.getHttpPredictResult(id);
        }        
    }



    
    ///////////////////////////////////////////////////////////////////////////
    // 阿里云node.js库
    ///////////////////////////////////////////////////////////////////////////
    public async nodePredict(input:any){
        //log(input);
        let retry = 0;
        this.createClient();
        while(retry <= 3){        
            try{
                const result = await this.callAliService(input);
                // log("----node predict result----");
                //log(JSON.stringify(result));
                if(result){
                    if(this.resultType == "MEDIA"){
                        return {
                            status: "OK",
                            id: result.body?.requestId || result.data?.data?.Data?.JobId, 
                            resultURL: result.body?.data?.imageURL || result.data?.data?.Data?.Result?.videoUrl || result.body?.data?.URL || result.body?.data?.elements?.[0]?.imageURL, // 兼容老字段
                            result: result.body?.data?.imageURL || result.data?.data?.Data?.Result?.videoUrl || result.body?.data?.URL || result.body?.data?.elements?.[0]?.imageURL
                        };                   
                    }else{
                        result.status = "OK";
                        return result;
                    }
                }else{
                    return {
                        status: "ERROR",
                        message: "AI服务没有返回任何结果",
                        result: "AI服务没有返回任何结果",
                    }
                }
            } catch (err) {
                const errStr = JSON.stringify(err);
                if(errStr.indexOf('InvalidImage.Resolution') >= 0){
                    return {
                        status: "ERROR",
                        message: "图片分辨率超出限制，请检查图片分辨率和内容 - 输入图像分辨率大于2000x2000",
                        result:  "图片分辨率超出限制，请检查图片分辨率和内容 - 输入图像分辨率大于2000x2000"
                    }
                }else if(errStr.indexOf('InvalidImage.NotFoundFace') >= 0){
                    return {
                        status: "ERROR",
                        message: "图像中没找到人脸，请检查您的图像中是否包含人脸或人脸太小 - 没有检测到人脸，可能是输 入图片没有人脸、人脸太小(人脸占比应超过64*64像素)、图像中人脸质量较低或 图像过度拉伸等导致。请检查是否存在人脸、人脸大小和图像人脸质量后再次尝试。",
                        result: "图像中没找到人脸，请检查您的图像中是否包含人脸或人脸太小 - 没有检测到人脸，可能是输 入图片没有人脸、人脸太小(人脸占比应超过64*64像素)、图像中人脸质量较低或 图像过度拉伸等导致。请检查是否存在人脸、人脸大小和图像人脸质量后再次尝试。",                        
                    }
                }else{
                    error("调用Aliyun发生Exception异常", err, JSON.stringify(this), JSON.stringify(input));                    
                }                
            }  
            
            retry++;
            if(retry <= 3){
                log("调用Aliyun服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }else{
                error("调用Aliyun AI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }

        return{
            status: "ERROR",
            message: "AI服务发生未知错误",
            result: "AI服务发生未知错误"            
        }
    }

    
    public async getNodePredictResult(id:string): Promise<{id:string; status:number; result?:any}> {
        // GET request to get the status of the image restoration process & return the result when its ready
        let tryTimes = 0;
        let generatedImage = null;
        let config = new $OpenApi.Config({
            accessKeyId: process.env['ALI_ACCESS_KEY_ID'],
            accessKeySecret: process.env['ALI_ACCESS_KEY_SECRET'],
        });
        // 访问的域名
        config.endpoint = `viapi.cn-shanghai.aliyuncs.com`;
        const vClient = new ViapiClient.default(config);        
        let getAsyncJobResultRequest = new ViapiClient.GetAsyncJobResultRequest({
            jobId: id,
        });        
        
        while (!generatedImage && tryTimes++ < 1000) {
            // Loop in 1s intervals until the alt text is ready
            log("polling for result...");
            let finalResponse = null;
            let jsonFinalResponse = null;
        
            try{
                let runtime = new $Util.RuntimeOptions({ });
                finalResponse = await vClient.getAsyncJobResultWithOptions(getAsyncJobResultRequest, runtime);
                // 获取整体结果
                 log(finalResponse);
                // 获取单个字段
                if(finalResponse.body.data.status=="PROCESS_SUCCESS" &&  finalResponse?.body?.data?.result){
                    generatedImage = JSON.parse(finalResponse?.body?.data?.result).videoUrl;
                }else{
                    generatedImage = finalResponse?.data?.data?.Data?.ImageURL;
                }
                
                if(generatedImage){
                    return {
                        id,
                        status:enums.resStatus.OK,
                        result:generatedImage
                    }
                }                    
            }catch(err){
                error("调用ALIYUN AI服务器，获取生成结果时发生异常");
                error(err);     
            }
            log("第" + tryTimes + "次尝试重新获取ALIYUN返回结果");
            // 每次查询结果等待5秒
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        return {
            id,
            status: enums.resStatus.unExpErr,
            result: "AI服务器发生错误，没有返回结果"
        }
    }


////////////////////////////////////////////////////////////////////////////////////////////////////
// 通义万象
////////////////////////////////////////////////////////////////////////////////////////////////////

    public async httpPredict(input:any){
        //log(input);
        //log(this.predicturl);
        
        let retry = 0;
        while(retry <= 3){        
            try{
                const result = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
                        "X-DashScope-Async": this.async
                    },
                    body: JSON.stringify({
                        model: this.func,
                        input: input,   
                        parameters: input.params || input.parameters || { size: input.size }
                    })
                });
                if(result){
                    const resObj = await result.json();
                    log("resOBJ:" + JSON.stringify(resObj));                    
                    return {
                        id: resObj?.output?.task_id || resObj.request_id, 
                        output: resObj?.output,
                        result: resObj?.output,
                        staus: resObj?.output?.task_status
                    };                   
                }                
            } catch (err) {
                error("调用AI服务器发生异常");
                // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
                // 错误 message
                error(err);
            }  
            
            retry++;
            if(retry <= 3){
                log("调用AI服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用AI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }

        return {
            status: "ERROR",
            message: "访问AI服务发生未知错误！",
            result: "访问AI服务发生未知错误！"            
        }
            
    }

    
    public async getHttpPredictResult(id:string): Promise<{id:string; status:number; result?:any}> {
        // GET request to get the status of the image restoration process & return the result when its ready
        let tryTimes = 0;
        let generatedImage = null;
        
        while (!generatedImage && tryTimes++ < 1000) {
            // Loop in 1s intervals until the alt text is ready
            log("polling for result...");
            let finalResponse = null;
            let jsonFinalResponse = null;
        
            try{
                finalResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
                        "X-DashScope-Async": "enable"
                    },
                    body: JSON.stringify({
                        task_id: id
                    })
                });
                if(finalResponse){
                    const resObj = await finalResponse.json();
                    // 获取整体结果
                    log("ALi RESOBJ:" + JSON.stringify(resObj));

                    switch(resObj.output.task_status){
                        case "SUCCEEDED":
                            // 获取单个字段
                            if(this.resultType == "MEDIA"){
                                return {
                                    id,
                                    status: enums.resStatus.OK,
                                    result: resObj?.output?.results?.[0]?.url || resObj?.output?.results?.video_url || resObj?.output?.video_url || resObj?.output?.output_video_url || resObj?.output?.render_urls[0],
                                }                                    
                            }else{
                                return {
                                    id,
                                    status: enums.resStatus.OK,
                                    result: resObj.output,
                                }                                    
                            }
                            break;
                        case "FAILED":
                            switch(resObj.output.code){
                                case "DataInspectionFailed":
                                    return {
                                        id,
                                        status: enums.resStatus.NSFW,
                                        result: "您的输入内容敏感，不符合规范要求，请调整。",
                                    };
                                default:
                                    return {
                                        id,
                                        status: enums.resStatus.unknownErr,
                                        result: "AI服务发生未知错误"
                                    }
                            }
                        case "UNKNOWN": // 作业不存在或状态未知
                            return {
                                id,
                                status: enums.resStatus.taskNotStart,
                                result: "AI服务作业不存在或状态未知"
                            }
                        case "PENDING":
                        case "PENDING": // 排队中
                        case "PRE-PROCESSING": // 前置处理中
                        case "RUNNING": // 处理中
                        case "POST-PROCESSING": // 后置处理中
                        default:
                            log(`${this.func} is ${resObj.output.task_status}...`);
                    }
                }
            }catch(err){
                error("调用AI服务器，获取生成结果时发生异常");
                error(err);     
            }
            log("第" + tryTimes + "次尝试重新获取返回图片");
            // 每次查询结果等待5秒
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        return {
            id,
            status: enums.resStatus.unExpErr,
            result: "AI服务发生意外失败，请稍后重试！"
        }
    }


    // ------------方便使用的静态函数集合---------------------

    // 人脸检测
    static async detectFaces(imageURL:string){
        log("人脸检测");
        const ai = new AliCVService("detectFace");
        const detectResult = await ai.predict({imageURL: imageURL});
        //log(detectResult);
        if(detectResult.status == "OK"){
            const faceCount = detectResult.body?.data?.faceCount;
            //log("faceCount:" + faceCount);
            const rects = detectResult.body?.data?.faceRectangles;
            //log("faceRectangels:" + JSON.stringify(rects));
            const probabilities = detectResult.body?.data?.faceProbabilityList;            
            //log("face probs:" + JSON.stringify(probabilities));
            const result:any = {
                id: Date.now().toString(),
                status: "OK",
                faces: [ ]
            };
            for(let i=0; i<faceCount; i++){
                //log("i:" + i);
                if(probabilities[i] > 0.8){ // 太小说明不一定是人脸
                    result.faces.push({
                        rect:{                    
                            left:rects[i*4],
                            top:rects[i*4+1],
                            width:rects[i*4+2],
                            height:rects[i*4+3]
                        }
                    });
                    //log("result:" + JSON.stringify(result));
                }
            }
            return result;
        }else{
            return detectResult;
        }
    }

    
    // 人脸属性识别
    static async recognizeFaces(imageURL:string){
        log("人脸检测");
        const ai = new AliCVService("recognizeFace");
        const detectResult = await ai.predict({
            imageURL: imageURL,
            Age: true,
            Gender: true,
            Hat: true,
            Glass: true,
            MaxFaceNumber: 1 // 只允许返回一个人脸
        });
        //log(detectResult);
        const data = detectResult?.body?.data;
        if(detectResult.status == "OK" && data){
            const faceCount = data.faceCount;
            //log("faceCount:" + faceCount);
            const result:any = {
                id: Date.now().toString(),
                status: "OK",
                faceCount: faceCount,
                faces: [ ]
            };
            for(let i=0; i<faceCount; i++){
                const face = {
                    age: data.ageList[i], 
                    gender: data.genderList[i], // 0 女性，1 男性
                    hat: data.hatList[i], // 0 无 1 有
                    glass: data.glasses[i], // 0不戴，1普通，2墨镜
                    beauty: data.beautyList[i], // 0-100
                    pose: { //格式为[yaw, pitch, roll] yaw为左右角度，取值范围-90~90。pitch为上下角度，取值范围-90~90。roll为平面旋转角度，取值范围-180~180。
                        yaw: data.poseList[i*3], 
                        pitch: data.poseList[i*3+1],
                        roll: data.poseList[i*3+2]
                    },
                    rect: {
                        left: data.faceRectangles[i*4],
                        top: data.faceRectangles[i*4 + 1],
                        width: data.faceRectangles[i*4 + 2],
                        height: data.faceRectangles[i*4 +3]
                    }
                }
                result.faces.push(face);
                //log(`face ${i}:`, JSON.stringify(face));
            }
            return result;
        }else{
            return detectResult;
        }
    }

    // 分割出头发的区域
    // 如果需要放大，那么把放大的区域和头发原来的区域合并输出
    static async segmentHair(imageURL:string, scale?:number){
        log("头发分割");
        const ai = new AliCVService("segmentHair");
        const segResult = await ai.predict({
            imageURL: imageURL,
        });
        log(JSON.stringify(segResult));
        let segs = segResult?.body?.data?.elements;        
        if(segResult.status == "OK" && segs){
            const imageSize = await iu.getImageSize(imageURL);
            const scaledSegs:any[] = JSON.parse(JSON.stringify(segs));  // 头发的放大区域           
            for(let i=0; i<segs.length; i++){
                const seg = segs[i];
                const orgSegImg = seg.imageURL;
                seg.imageURL = await iu.generateMaskImageFromPNG(seg.imageURL);               
                
                if(scale){                            
                    const scaledSeg:any = scaledSegs[i];
                    scaledSeg.imageURL = seg.imageURL;

                    // 获得头发的放大区域           
                    const newWidth = Math.ceil(seg.width * scale);
                    const newHeight = Math.ceil(seg.height * scale);
                    if(imageSize && newWidth < imageSize.width && newHeight < imageSize.height){
                        const zoomedImage = await iu.zoomInImage(orgSegImg, scale)
                        if(zoomedImage){
                            scaledSeg.imageURL = await iu.generateMaskImageFromPNG(zoomedImage);
                            log("segmentHair scaledSeg.imageURL:", scaledSeg.imageURL);
                            scaledSeg.x = seg.x - Math.round(seg.width * (scale - 1)/2);
                            scaledSeg.y = seg.y - Math.round(seg.height * (scale - 1)/2);                    
                            if(scaledSeg.x < 0){ scaledSeg.x = 0 }
                            if(scaledSeg.y < 0){ scaledSeg.y = 0 }
                            scaledSeg.width = newWidth;
                            scaledSeg.height = newHeight;
                        }
                    }
                }
            }
            if(imageSize){
                let headMask:any = await iu.generateSolidColorImage(imageSize.width, imageSize.height, {r:0, g:0, b:0}, 'png');
                log("SegmentHair solid head mask:" , headMask);
                const segHeadMask = await iu.putImagesOnImage(headMask, segs);
                log("SegmentHair head masks added:", segHeadMask);
                if(scale && segHeadMask){
                    const scaledHeadMask = await iu.putImagesOnImage(headMask, scaledSegs);
                    if(scaledHeadMask){
                        headMask = await iu.combineMasks(segHeadMask, scaledHeadMask);
                    }else{
                        headMask = segHeadMask;
                    }
                }else{
                    headMask = segHeadMask;
                }
                return headMask;
            }
        }else{
            return segResult;
        }
    }


    static async segmentBody(imageURL:string, params?:any, scale?:number){
        log("身体分割......");
        let input:any = params || {};
        input.imageURL = imageURL;
        try{
            const body = await (new AliCVService("segmentBody")).predict(input);
            log("segmentBody result:", JSON.stringify(body));
            if(body.status == "OK"){
                return body.resultURL;
            }
        }catch(err){
            error("segmentBody exception:", imageURL, err);
            return null;
        }
    }
    
    static async segmentBodyWithoutHead(imageURL:string, scale?:number){
        log("身体分割不包含头部");
        const segBody = await (new AliCVService("segmentBody")).predict({
            imageURL,
        //    returnForm: "mask"
        });
        log(JSON.stringify(segBody));
        let bodyMask = await iu.generateMaskImageFromPNG(segBody?.resultURL);        
        if(segBody.status == "OK" && bodyMask){
            const segHead = await (new AliCVService("segmentHead")).predict({
                imageURL,
            //    returnForm: "mask"
            });
            log(JSON.stringify(segHead));
            if(segHead.status == "OK"){
                
                const heads = segHead?.body?.data?.elements; // element格式：imageURL, x, y, widht, height
                const imageSize = await iu.getImageSize(imageURL);            

                if(heads && imageSize){
                    for(const head of heads){
                        const scaleHead = 1.05;
                        const newWidth = Math.ceil(head.width * scaleHead);
                        const newHeight = Math.ceil(head.height * scaleHead);
                        if(imageSize && newWidth < imageSize.width && newHeight < imageSize.height){
                            const zoomedImage = await iu.zoomInImage(head.imageURL, scaleHead)
                            if(zoomedImage){
                                head.imageURL = await iu.generateMaskImageFromPNG(zoomedImage);
                                head.x = head.x - Math.round(head.width * (scaleHead - 1)/2);
                                head.y = head.y - Math.round(head.height * (scaleHead - 1)/2);                    
                                if(head.x < 0){ head.x = 0 }
                                if(head.y < 0){ head.y = 0 }
                                head.width = newWidth;
                                head.height = newHeight;
                            }
                        }
                    }
                    let headMask:any = await iu.generateSolidColorImage(imageSize.width, imageSize.height, {r:0, g:0, b:0}, 'png');
                    headMask = await iu.putImagesOnImage(headMask, heads);
                    let resultMask = await iu.maskDeductMask(bodyMask, headMask);
                    if(resultMask){
                        if(scale && scale>1){
                            resultMask = await iu.expandWhiteRegion(resultMask, scale);
                        }
                        return resultMask; // await iu.cleanMask(resultMask);
                    }
                }
            }
        }
        
        return bodyMask;
    }

    static async segmentHead(imageURL:string, scale:number=1){
        log("分割头部，包含头发");
        try{
            const segHead = await (new AliCVService("segmentHead")).predict({
                imageURL,
            });
            log("segmentHead result:", JSON.stringify(segHead));
            const heads = segHead?.body?.data?.elements; // element格式：imageURL, x, y, widht, height
            if(segHead.status == "OK" && heads){
                for(const head of heads){
                    if(scale){
                        const imageSize = await iu.getImageSize(imageURL);                                
                        const newWidth = Math.ceil(head.width * scale);
                        const newHeight = Math.ceil(head.height * scale);
                        if(imageSize && newWidth < imageSize.width && newHeight < imageSize.height){
                            const zoomedImage = await iu.zoomInImage(head.imageURL, scale)
                            if(zoomedImage){
                                head.imageURL = await iu.generateMaskImageFromPNG(zoomedImage);
                                head.x = head.x - Math.round(head.width * (scale - 1)/2);
                                head.y = head.y - Math.round(head.height * (scale - 1)/2);                    
                                if(head.x < 0){ head.x = 0 }
                                if(head.y < 0){ head.y = 0 }
                                head.width = newWidth;
                                head.height = newHeight;
                            }
                        }else{
                            head.imageURL = await iu.generateMaskImageFromPNG(head.imageURL);    
                        }
                    }else{
                        head.imageURL = await iu.generateMaskImageFromPNG(head.imageURL);
                    }
                }
                const imageSize = await iu.getImageSize(imageURL);
                if(imageSize){
                    let headMask:any = await iu.generateSolidColorImage(imageSize.width, imageSize.height, {r:0, g:0, b:0}, 'png');
                    headMask = await iu.putImagesOnImage(headMask, heads);
                    return headMask;
                }
            }
        }catch(err){
            error("segmentHead exception:", imageURL, err);
            return null;
        }
    }

    /*************************************************
        OutMode	Long	否	0或1	
        返回分割结果的类型，影响ImageURL字段的返回内容，用户非必选。        
        0（默认值）：默认的主体服饰分割结果。
        1：用户指定class类别的组合分割结果。
        
        ClothClass.N	String	否	tops	
        服饰类别。可一次传入多个值。取值范围：        
        tops：上衣
        coat：外套
        skirt：裙装
        pants：裤装
        bag：包类
        shoes：鞋子
        hat：帽子
        
        ReturnForm	String	否	whiteBK	
        指定返回的图像格式，取值范围：        
        whiteBK：返回白底图。
        mask：返回单通道mask。
        如果不设置，则返回四通道PNG图。
        ****************************************************/   
    static async segmentCloth(imageURL:string, params?:any){
        log("分割服装");
        let input = params || {};
        input.imageURL = imageURL;        
        if(input.outMode == undefined){
            input.outMode = 0;
        }
        if(!input.clothClass){
            input.clothClass = ["tops","coat","skirt","pants","bag","shoes","hat"];
        }
        try{
            const cloth = await (new AliCVService("segmentCloth")).predict(input);
            log("segmentCloth result:", JSON.stringify(cloth));
            if(cloth.status == "OK"){
                return cloth.resultURL;
            }
        }catch(err){
            error("segmentCloth exception:", imageURL, err);
            return null;
        }
    }    

    static async segmentClothParts(imageURL:string, params?:any){
        log("分割服装鞋帽");
        let input = params || {};
        input.imageURL = imageURL;        
        if(input.outMode == undefined){
            input.outMode = 0;
        }
        if(!input.clothClass){
            input.clothClass = ["tops","coat","skirt","pants","bag","shoes","hat"];
        }
        try{
            const cvs = new AliCVService("segmentCloth");
            cvs.resultType = "JSON";
            const parts = await cvs.predict(input);
            log("segmentClothParts result:", JSON.stringify(parts));
            if(parts.status == "OK"){
                return parts.body?.data?.elements?.[1]?.classUrl;
            }
        }catch(err){
            error("segmentClothParts exception:", imageURL, err);
            return null;
        }
    }  
    
    static async segmentSkin(imageURL:string, params?:any){
        log("分割全身裸露的皮肤");
        try{
            const segSkin = await (new AliCVService("segmentSkin")).predict({
                imageURL,
            });
            log("segmentSkin result:", JSON.stringify(segSkin));
            if(segSkin.status == "OK"){
//                if(params.returnForm == "mask"){
//                    return await iu.generateMaskImageFromPNG(segSkin.resultURL);
//                }else{
                    return segSkin.resultURL;
//                }
            }
        }catch(err){
            error("segmentSkin exception:", imageURL, err);
            return null;
        }
    }
    
    static async segmentHeadAndSkin(imageURL:string){
        log("分割头部，包含头发，以及全身裸露的皮肤");
        const segSkin = await this.segmentSkin(imageURL);
        const segHead = await this.segmentHead(imageURL, 1);

        if(segSkin && segHead){
            return await iu.combineMasks(segSkin, segHead);
        }
    }
    
    static async auditImage(imageURL:string){
        log("audit image.....");
        const imgSize = await iu.getImageSize(imageURL);
        if(imgSize && (imgSize.width > 2047 || imgSize.height > 2047)){
            const newImage = await iu.resizeImage(imageURL, 2000);
            if(newImage){
                imageURL = newImage;
            }
        }
        
        const ai = new AliCVService("imageAudit");
        const result = await ai.predict({
            imageURL: imageURL,
        });
        //log("ali result:", result);
        //log("result?.body", result?.body);        
        //log("result?.body?.data", result?.body?.data);
        //log("result?.body?.data?.results", result?.body?.data?.results);
        
        let auditResult = {
            id: Date.now().toString(),
            status: "OK",            
            scenes: {
                porn : "normal", // normal（正常图片）、sexy（性感图片）、porn（色情图片）
                terrorism : "normal", // normal（正常图片）、bloody（血腥）、explosion（爆炸烟光）、outfit（特殊装束）、logo（特殊标识）、weapon（武器）、politics（敏感内容）、violence（打斗）、crowd（聚众）、parade（游行）、carcrash（车祸现场）、flag（旗帜）、location（地标）、drug（涉毒）、gamble（赌博）、others（其他）
                ad : "normal", // normal（正常图片）、politics（文字含敏感内容）、porn（文字含涉黄内容）、abuse（文字含辱骂内容）、terrorism（文字含涉恐内容）、contraband（文字含违禁内容）、spam（文字含其他垃圾内容）、npx（牛皮癣广告）、qrcode（包含二维码）、programCode（包含小程序码）、ad（其他广告）
                live : "normal"  // normal（正常图片）、meaningless（无意义图片）、PIP（画中画）、smoking（吸烟）、drivelive（车内直播）、drug（涉毒）、gamble（赌博）
                }
        };
        const scenes = result?.body?.data?.results[0]?.subResults;
        log("scenes", scenes);        
        log("scenes string:", JSON.stringify(scenes));
        if(scenes){
            for(const s of scenes){
                if(s.scene == "porn"){
                    auditResult.scenes.porn = s.label;
                }else if(s.scene == "terrorism"){
                    auditResult.scenes.terrorism = s.label;
                }else if(s.scene == "ad"){
                    auditResult.scenes.ad = s.label;
                }else if(s.scene == "live"){
                    auditResult.scenes.live = s.label;
                }
            }
        }
        //log("auditImage result:", JSON.stringify(auditResult));
        return auditResult;
    }

    static async auditVideo(videoURL:string){
        // 取视频长度的10%，30%，50%，70%，90%五个snapshot进行检测
        let videoLength = await vu.getVideoLength(videoURL);
        let percents:number[];
        if(videoLength){
            videoLength = videoLength * 1000;
//            percents = [0, 0.2, 0.4, 0.6, 0.8];
            percents = [0, 0.4, 0.8];            
        }else{
            videoLength = 0;
            percents = [0];
        }
        
        let auditResult:any;
        let stopSign = false;
        
        for(const t of percents){
            const frameURL = await vu.captureFrame(videoURL, Math.floor(videoLength*t));
            if(frameURL){
                try{
                    const frameResult = await this.auditImage(frameURL);
                    if(frameResult?.scenes){
                        if(!auditResult){
                            auditResult = frameResult;
                        }else{
                            if(frameResult.scenes.porn != "normal"){
                                auditResult.scenes.porn = frameResult.scenes.porn
                                stopSign = true;
                            }
                            if(frameResult.scenes.terrorism != "normal"){
                                auditResult.scenes.terrorism = frameResult.scenes.terrorism
                                stopSign = true;                                
                            }
                            if(frameResult.scenes.ad != "normal"){
                                auditResult.scenes.ad = frameResult.scenes.ad
                                stopSign = true;                                
                            }
                            if(frameResult.scenes.live != "normal"){
                                auditResult.scenes.live = frameResult.scenes.live
                                stopSign = true;                                
                            }
                        }
                    }
                }catch(err){
                    error("exception in audit video frame:", frameURL);
                }finally{
                    fs.deleteFileByURL(frameURL);
                }
                if(stopSign){
                    break;
                }
            }
        }
        return auditResult;
    }    
}

