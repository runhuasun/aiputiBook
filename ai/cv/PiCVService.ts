import {BaseCVService} from "./BaseCVService";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import * as enums from "../../utils/enums";
import * as fs from "../../utils/fileServer";

export class PiCVService extends BaseCVService{
    public modelName: string = "piapi.ai";
    public predicturl: string = "https://api.piapi.ai/api/v1/task";
    public fetchurl: string = '';
    public version: string = "";
    public func: string = "";
    public replicate = null;
    public model: string = "";
    public task_type: string = "";
    public taskMethod: string = "POST";
    public getMethod: string = "GET";
    private retryInterval: number = 5; // 秒
    
    constructor(func:string){
        super();
        this.func = func;
        switch(func){
            case "kolors-virtual-try-on":
                this.model = "kling";
                this.task_type = "ai_try_on";
                break;

                
            case "faceswap":
                this.model = "Qubico/image-toolkit";
                this.task_type = "face-swap";
                break;

            case "faceswapVideo":
                this.model = "Qubico/video-toolkit";
                this.task_type = "face-swap";
                this.retryInterval = 10;
                break;

            case "midjourney-imagine":
                this.model = "midjourney";
                this.task_type = "imagine";
                break;
           
        }
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private async getResult(response:any){
        log("PI getResult:", JSON.stringify( response.data ));        
        switch(this.func){
            case "kolors-virtual-try-on":
                return await fs.backupToUS(response.data.output.works?.[0]?.image?.resource_without_watermark); 

            case "faceswap":
                //return await fs.backupToUS(response.data.output.image_url || response.data.output.image_base64);
                return await fs.backupToUS(response.data.output.image_url) || await fs.moveToFileServer(response.data.output.image_base64, "T"); 

            case "faceswapVideo":
                return await fs.backupToUS(response.data.output.video_url);

            case "midjourney-imagine":
                return await fs.backupToUS(response.data.output.temporary_image_urls[0]);
                
        }
    }
    
    public async predict(input:any){
        let retry = 0;
        while(retry <= 10){        
            try{
                const startResponse = await fetch(process.env.PI_API_PROXY!, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        predicturl: this.predicturl, 
                        method: this.taskMethod,
                        params: {
                            model: this.model,
                            task_type: this.task_type,
                            input
                        }
                    })
                });
    
                const jsonStartResponse = await startResponse.json();
                if(jsonStartResponse){
                    log("[PiAI server response:]" + JSON.stringify(jsonStartResponse));
                }
                
                switch(jsonStartResponse?.code){
                    case 200:
                        return {
                            task_id: jsonStartResponse.data.task_id,
                            status: enums.resStatus.OK,
                            message: "OK"
                        }                        
                    case 400: // "invalid request" - The input does not meet the valid image format (url or valid Base64 string).
                    case 401: // Unauthorized - The API Key is invalid.
                    case 500: // Internal Server Error - Service is experiencing an error.
                    default:
                        return {
                            result: null,
                            status: enums.resStatus.expErr,
                            message: jsonStartResponse.data.error.raw_message,
                        }
                }
            } catch (err) {
                error("调用PiAI服务器发生异常");
                error(err);               
            }  
            
            retry++;
            if(retry <= 10){
                log("调用PiAI服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用PiAI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }

        return {
            result: null,
            status: enums.resStatus.unExpErr,
            message: "任务启动失败，请稍后重试！",
        }        
}

    public async getPredictResult(task_id:string){
        // GET request to get the status of the image restoration process & return the result when its ready
        let tryTimes = 0;
        let generatedImage = null;
        
        // 最多尝试N次
        while (!generatedImage && tryTimes++ < 3600) {
            // Loop in 1s intervals until the alt text is ready
            log("polling for result...");
            let finalResponse = null;
            let jsonFinalResponse = null;
        
            try{
                finalResponse = await fetch(process.env.PI_API_PROXY!, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        predicturl: `https://api.piapi.ai/api/v1/task/${task_id}`, 
                        method: this.getMethod,
                    })
                });
                if(finalResponse){  
                    jsonFinalResponse = await finalResponse.json();
                }      
            } catch (err) {
                error("调用AI服务器，获取生成状态时发生异常");
                error(err);      
            }
            log("Pi get result:" + tryTimes);
            if (jsonFinalResponse?.code === 200) {
                switch(jsonFinalResponse.data.status.toLowerCase()){
                    case "completed":
                        // 路由到结果格式处理函数
                        generatedImage = await this.getResult(jsonFinalResponse);
                        log("Pi predict result:" + generatedImage);
                        return {
                            result: generatedImage,
                            status: enums.resStatus.OK,
                            message: "OK"
                        }
                    case "failed":
                        log("PI fail reason:", JSON.stringify(jsonFinalResponse.data.error));
                        return {
                            result: null,
                            status: enums.resStatus.expErr,
                            message: jsonFinalResponse.data.error.raw_message || jsonFinalResponse.data.error.message,
                        }
                    case "pending":
                    case "processing":
                    case "staged":
                        // 每次查询结果等待1秒
                        await new Promise((resolve) => setTimeout(resolve, this.retryInterval * 1000));
                        log("Pi result try:" + tryTimes);
                }
            }else{
                break;
            }
        }
        return {
            result: null,
            status: enums.resStatus.unExpErr,
            message: "服务器发生未知错误，请稍后重试！",
        }
    }

}
