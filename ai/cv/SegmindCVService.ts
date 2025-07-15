import {BaseCVService} from "./BaseCVService";
import {default as nodefetch} from 'node-fetch';
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import * as enums from "../../utils/enums";
import * as fs from "../../utils/fileServer";
import * as iu from "../../utils/imageUtils";
import {callAPIinServer} from "../../utils/apiServer";

export class SegmindCVService extends BaseCVService{
    public modelName: string = "Segmind";
    public predicturl: string = "";
    public fetchurl: string = '';
    public version: string = "";
    public func: string = "";
    public replicate = null;
    
    constructor(func:string){
        super();
        this.func = func;
        switch(func){
            case "faceswap":
                this.predicturl = "https://api.segmind.com/v1/faceswap-v2";
                break;
            case "faceswapV3":
                this.predicturl = "https://api.segmind.com/v1/faceswap-v3";
                break;        
            case "faceswapV4":
                this.predicturl = "https://api.segmind.com/v1/faceswap-v4";
                break;                    
            case "faceswapVideo":
                this.predicturl = "https://api.segmind.com/v1/videofaceswap";
                break;
            case "faceswapFilter":
                this.predicturl = "https://api.segmind.com/v1/ai-face-swap";
                break;                
            case "focus-outpaint":                
            case "focus-inpaint":                                
            case "flux-inpaint":
            case "flux-pulid":
            case "codeformer":
            case "hallo":
            case "seg-beyond":
            case "segfit-v1.1":
            case "gpt-image-1":
            case "gpt-image-1-edit":                
            case "face-detailer":
            default:
                this.predicturl = `https://api.segmind.com/v1/${func}`;                
        }
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private async getResult(response:any, isImage: boolean = false) {
        // 如果是图片响应，直接处理二进制数据
        if (isImage) {
            log(`-----segmind ${this.func} got an image data -------`);
            const base64Image = `data:image/jpeg;base64,${this.arrayBufferToBase64(response)}`;
            return {
                status: enums.resStatus.OK,
                result: await fs.moveToFileServer(base64Image, "T") || base64Image
            };
        }        
        
        switch(this.func){
            case "faceswapFilter":                
            case "faceswapVideo":
            case "hallo":
                log(`-----segmind ${this.func} Video use time: ${response?.infer_time} seconds -------`);
                return {status:enums.resStatus.OK , result: response.video };
                
            case "faceswap":
            case "faceswapV3":
            case "faceswapV4":
            case "flux-inpaint":
            case "flux-pulid":
            case "codeformer":
            case "focus-outpaint":
            case "focus-inpaint":                
            case "gpt-image-1":
                log(response, JSON.stringify(response));
            default:
                log(`-----segmind ${this.func} use time: ${response?.infer_time} seconds -------`);
                return {status:enums.resStatus.OK , result: await fs.moveToFileServer(`data:image/jpeg;base64,${response.image}`, "T") || `data:image/jpeg;base64,${response.image}`};
        }
    }

    private async getError(response:any){
        error(`segmind inference error response: `, response);                    
        switch(this.func){
            case "faceswap":
                if(response.error){
                    error(`segmind faceswap error: ${response?.error} `);                    
                    switch(response.error){
                        case "No face found in Target":
                            return { status:enums.resStatus.expErr, result: "在被换脸的原始照片中，或者选择的区域中，没有检测到清晰的人脸！" };
                        case "No face found in Swap":
                            return { status:enums.resStatus.expErr, result: "在新的脸部照片中，没有检测到清晰的人脸！" };
                        default:
                            return { status:enums.resStatus.unExpErr, result: "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因" };
                    }
                }
                break;
            default:
                if(response.error){
                    const err = response.error;
                    error(`segmind inference default error handler: ${err}`);                                        
                    if(err?.code == "moderation_blocked" || err?.error?.code == "moderation_blocked" || err.indexOf("moderation_blocked")>=0){
                        error(`segmind inference NSFW error: ${err}`);                    
                        /*
0|aiputi  |   'segmind inference error: {\n' +
0|aiputi  |     '  "error": {\n' +
0|aiputi  |     '    "message": "Your request was rejected as a result of our safety system. Your request may contain content that is not allowed by our safety system.",\n' +
0|aiputi  |     '    "type": "user_error",\n' +
0|aiputi  |     '    "param": null,\n' +
0|aiputi  |     '    "code": "moderation_blocked"\n' +
0|aiputi  |     '  }\n' +
0|aiputi  |     '} '
0|aiputi  | ]                        */
                        return { status:enums.resStatus.NSFW, result: "您的请求被内容安全系统拦截，请更换请求内容" };    
                    }else{
                        return { status:enums.resStatus.unExpErr, result: err.message };
                    }
                }else{
                    return { status:enums.resStatus.unExpErr, result: "AI服务请求发生未知错误" };
                }
        }
    }

/*
    private async preProcessInput(input:any){
        let result = input;
        if(input){
            result = JSON.parse(JSON.stringify(input));
            switch(this.func){
                case "faceswap":
                case "faceswapV3":
                case "faceswapV4":
                    result = await iu.replaceImageURLsByBase64(result, false);
                    break;                    
            }
        }
        return result;
    }
*/    
    public async predict(input:any){
 //       input = await this.preProcessInput(input);
        
        const retry = 1;
        let runtime = 1;
        while(runtime <= retry){ // 这个服务没有启动接口，所以不要重试
            try{
                const startResponse = await callAPIinServer(
                    process.env.SEGMIND_API_PROXY!,
            //        "http://gpt.aiputi.cn:7777/api/test",
                    {
                        predicturl: this.predicturl,
                        input
                    }
                );

                if (startResponse.status != enums.resStatus.OK) {
                    error("SegmindCVService predict got error Status:", startResponse.status, startResponse);
                    return await this.getError(startResponse.result);                    
                //    return { 
                //        status: enums.resStatus.unExpErr, 
                //        result: startResponse.result
                //    };
                }                    
                
                // 处理图片响应
                if (startResponse.resultType === "IMAGE" || startResponse.resultType === "BINARY") {
                    return await this.getResult(startResponse.result, true);
                }else if(startResponse.resultType === "JSON") {                
                    log("SEGMIND startResponse.result:", startResponse.result);
    
                    if(startResponse.result?.status == "Success"){
                        return await this.getResult(startResponse.result);
                    }else{
                        return await this.getError(startResponse.result);
                    }
                }else{
                    error("call segmind get unkonn result:", startResponse);
                    return { 
                        status: enums.resStatus.unExpErr, 
                        result: "访问AI服务器返回未知结果！" 
                    };
                }
            } catch (err) {
                error("调用Segmind服务器发生异常");
                error(err);          

                // 处理非JSON响应错误（例如二进制数据但未识别为图片）
                if (err instanceof SyntaxError) {
                    return { 
                        status: enums.resStatus.unExpErr, 
                        result: "响应格式错误，请联系管理员" 
                    };
                }                
            }  
            
            if(++runtime <= retry ){
                log("调用Segmind服务器失败，开始第" + runtime + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }else{
                error("调用Segmind服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }
        
        return { status:enums.resStatus.unExpErr, result: "任务执行失败，请稍后重试。如果重复发生同样错误，请联系系统管理员了解原因" };
    }

    public async getPredictResult(task_id:string){
        return null;
    }

    // 新增工具函数：将 ArrayBuffer 转为 Base64
    private arrayBufferToBase64(buffer: ArrayBuffer) {
      return Buffer.from(buffer).toString('base64');
    }
    
}
