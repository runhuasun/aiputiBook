import * as debug from "../../utils/debug";
import * as enums from "../../utils/enums";
import {config} from "../../utils/config";
import * as fs from "../../utils/fileServer";
import {BaseCVService} from "./BaseCVService";
import * as iu from "../../utils/imageUtils";

export class FalCVService extends BaseCVService{
    public predicturl: string = process.env.FAL_API_PROXY!;
    public version: string = "";
    public func: string = "";
    public result: any;
    public modelName: any;
    public cmd: string = "SUBSCRIBE";
    
    constructor(func:string){
        super();
        this.func = func;
        this.version = func;
        switch(func){
            case "fal-ai/face-swap/video-to-video":
            case "fal-ai/kling-video/v1/standard/text-to-video":
            case "fal-ai/kling-video/v1/pro/text-to-video":
            case "fal-ai/kling-video/v1/standard/image-to-video":
            case "fal-ai/kling-video/v1/pro/image-to-video":
            case "fal-ai/kling-video/v1.5/pro/image-to-video":
            case "fal-ai/kling-video/v1.5/pro/text-to-video":
            case "fal-ai/kling-video/v1.5/standard/image-to-video":
            case "fal-ai/kling-video/v1.5/standard/text-to-video":
            case "fal-ai/kling-video/v1.6/pro/image-to-video":
            case "fal-ai/kling-video/v1.6/pro/text-to-video":
            case "fal-ai/kling-video/v1.6/standard/image-to-video":
            case "fal-ai/kling-video/v1.6/standard/text-to-video":
            case "fal-ai/kling-video/v2/master/image-to-video":
            case "fal-ai/kling-video/v2/master/text-to-video":
            case "fal-ai/kling-video/v2.1/master/image-to-video":
            case "fal-ai/kling-video/v2.1/master/text-to-video":
            case "fal-ai/kling-video/v2.1/standard/image-to-video":

            case "fal-ai/minimax/hailuo-02/standard/image-to-video":
            case "fal-ai/minimax/hailuo-02/standard/text-to-video":
            case "fal-ai/minimax/hailuo-02/pro/image-to-video":
            case "fal-ai/minimax/hailuo-02/pro/text-to-video":
                
            case "fal-ai/vidu/q1/image-to-video":
            case "fal-ai/vidu/q1/text-to-video":
            case "fal-ai/vidu/q1/start-end-to-video":
                
            case "fal-ai/magi-distilled/image-to-video":
            case "fal-ai/magi-distilled":
            case "fal-ai/magi":
            case "fal-ai/magi/image-to-video":

            case "fal-ai/framepack":
            case "fal-ai/framepack/flf2v":

            case "fal-ai/skyreels-i2v":
            case "fal-ai/ltx-video-v097":
            case "fal-ai/ltx-video-v097/image-to-video":
                
            case "fal-ai/musetalk":
            case "fal-ai/sync-lipsync":
            case "fal-ai/latentsync":
            case "fal-ai/haiper-video-v2/image-to-video":                
            case "fal-ai/luma-dream-machine/image-to-video":
            case "fal-ai/minimax-video/image-to-video":
            case "fal-ai/pixverse/v3.5/image-to-video":
            case "fal-ai/pixverse/v3.5/image-to-video/fast":
            case "fal-ai/pixverse/v3.5/text-to-video":
            case "fal-ai/pixverse/v3.5/text-to-video/fast":
            case "fal-ai/hunyuan-video-image-to-video":
            case "fal-ai/hunyuan-video":
            case "fal-ai/pika/v2.2/text-to-video":
            case "fal-ai/pika/v2.2/image-to-video":
            case "fal-ai/veo2/image-to-video":
            case "fal-ai/veo2":

            case "fal-ai/ghiblify":
            case "fal-ai/flux-control-lora-canny":
            case "fal-ai/flux-control-lora-canny/image-to-image":
                this.cmd = "SUBMIT";
                break;

            case "fal-ai/recraft-v3":
            case "fal-ai/omnigen-v1":
            case "fal-ai/face-swap":
            case "fal-ai/iclight-v2":
            case "fal-ai/flux-pro/v1.1-ultra":
            case "fal-ai/gemini-flash-edit":
            case "fal-ai/hidream-e1-full":
            case "fal-ai/kling/v1-5/kolors-virtual-try-on":
                
            case "fal-ai/ideogram/v3/replace-background":
            case "fal-ai/ideogram/v3/remix":
            case "fal-ai/ideogram/v3/reframe":
            case "fal-ai/ideogram/v3/edit":
            case "fal-ai/ideogram/v3":
                
            default:
                this.cmd = "SUBSCRIBE";
        }
    }


    public getErrorResult(res:any){
        switch(this.func){
            case "fal-ai/face-swap":
            case "fal-ai/face-swap/video-to-video":
                this.result = {
                    status: enums.resStatus.expErr,
                    message: res?.detail?.msg
                }
                if(res?.detail?.msg == "No face found in the image"){
                    if(res?.detail?.loc?.[1] == "base_image_url"){
                        this.result = {
                            status: enums.resStatus.expErr,
                            message: "被换脸的原始照片中没有检测到合适的面部，请调整。"
                        }
                    }else if(res?.detail?.loc?.[1] == "swap_image_url"){
                        this.result = {
                            status: enums.resStatus.expErr,
                            message: "新的脸部照片中没有检测到合适的面部，请调整。"
                        }
                    }else{
                        this.result = {
                            status: enums.resStatus.expErr,
                            message: "在输入图片或者视频中没有识别出完整的人像，请更换文件再尝试! 不要使用只包含头部的照片。如果在原图中选择了区域，请试着扩大您选择的区域。"
                        }
                    }
                }
                break;
            
            default: 
                this.result = {
                    status: enums.resStatus.unknownErr,
                    message: res?.detail
                }     
                
        }

        return this.result;
    }
/*
    private async preProcessInput(input:any){
        let result = input;
        if(input){
            result = JSON.parse(JSON.stringify(input));
            switch(this.func){
            case "fal-ai/face-swap":
            case "fal-ai/iclight-v2":
                    result = await iu.replaceImageURLsByBase64(result);
                    break;                    
            }
        }
        return result;        
    }
*/    
    public async predict(input:any){
   //     input = await this.preProcessInput(input);
        
        let retry = 0;
        const tryTimes = 0;
        while(retry <= tryTimes){        
            try{        
                const startResponse = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        cmd: this.cmd,
                        version: this.version,
                        input: this.getParams(this.version, input),
                        webhook: process.env.WEBSITE_URL + "/api/generateHook",
                    })
                });   
                const jsonStartResponse = await startResponse.json();

                debug.log("FAL predict response:", JSON.stringify(jsonStartResponse));
                if(this.cmd == "SUBMIT"){
                    if(jsonStartResponse.request_id){
                        this.result = {
                            status: enums.resStatus.OK,
                            request_id: jsonStartResponse.request_id
                        }
                    }else{
                        this.result = {
                            status: enums.resStatus.taskNotStart,
                        }
                        debug.error(JSON.stringify(jsonStartResponse));
                    }
                    return this.result;
                }else{
                    if(startResponse && jsonStartResponse && jsonStartResponse.video) {
                        // 单图输出情况                    
                        this.result = {
                            status: enums.resStatus.OK,
                            url: jsonStartResponse.video.url
                        }
                    }else if(startResponse && jsonStartResponse && jsonStartResponse.image) {
                        // 单图输出情况                    
                        this.result = {
                            status: enums.resStatus.OK,
                            url: jsonStartResponse.image.url
                        }
                    }else if(startResponse && jsonStartResponse && jsonStartResponse.images && jsonStartResponse.images[0]){
                        // 多图输出情况     
                        this.result = {
                            status: enums.resStatus.OK,
                            url: jsonStartResponse.images[0].url
                        }                        
                    }else{
                        debug.error("调用FAL AI服务器，没有返回任何结果");
                        debug.error(JSON.stringify(jsonStartResponse));
                  
                        return this.getErrorResult(jsonStartResponse);
                    }

                    if(this.result.status == enums.resStatus.OK){
                        try{
                            const inFS = await fs.moveToFileServer(this.result.url, "U");
                            if(inFS){
                                this.result.url = inFS;
                            }
                        }catch(e:any){
                            debug.error("FAL predict moveToFileServer exception:", e);
                        }
                    }
                    return this.result;                
                }
            } catch (err) {
                debug.error("调用AI服务器发生异常");
                debug.error(err);               
            }  
            
            retry++;
            if(retry <= tryTimes){
                debug.log("调用AI服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                debug.error("调用FAL AI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }
    }

    public async getPredictResult(id:string){
        return this.result;
    }

    private getParams(version:string, input:any){
        let result:any = {};
        switch(version){
         //   case "fal-ai/face-swap":
         //       result = {
         //           base_image_url: input.target_image,
         //           swap_image_url: input.swap_image,
         //       }
         //       break;
            default: result = input;
        }

        return result;
    }
}


