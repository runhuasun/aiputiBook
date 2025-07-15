import {BaseCVService} from "./BaseCVService";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import * as enums from "../../utils/enums";
import * as fs from "../../utils/fileServer";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

export class WaveCVService extends BaseCVService{
    public modelName: string = "WaveSpeed";
    public predicturl: string = "";
    public fetchurl: string = "";

    public task_id: string = "";
    public func: string = "";    
    
    
    constructor(func:string){
        super();
        this.func = func;
        this.predicturl = `https://api.wavespeed.ai/api/v2/wavespeed-ai/${func}`;
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private async getResult(response:any){
        switch(this.func){
            case "flux-dev":
            case "flux-dev-ultra-fast":                
            case "hidream-i1-dev":
            case "hidream-i1-full":
            default:
                // log("WaveCVService getResult:", JSON.stringify( response.data ));
                const img = response.data.outputs[0];
                return await fs.backupToUS(img) || await fs.moveToFileServer(img, "T") || img;
        }
    }
    
    public async predict(input:any){
        let retry = 3;
        while(retry > 0){        
            try{
                const startResponse = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": 'application/json',
                        "Authorization": `Bearer ${WAVESPEED_API_KEY}`
                    },
                    body: JSON.stringify(input)
                });
    
                const jsonStartResponse = await startResponse.json();
                if(jsonStartResponse){
                   // log("[WaveCVService server response:]" + JSON.stringify(jsonStartResponse));
                }
                
                switch(jsonStartResponse?.code){
                    case 200:
                        this.task_id = jsonStartResponse.data.id;
                        return this.task_id;
                    case 400: // "invalid request" - The input does not meet the valid image format (url or valid Base64 string).
                    case 401: // Unauthorized - The API Key is invalid.
                    case 500: // Internal Server Error - Service is experiencing an error.
                    default:
                        return undefined;
                }
            } catch (err) {
                error("调用WaveCVService服务器发生异常");
                error(err);               
            }  
            
            if(--retry > 0){
                log("调用WaveCVService服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用WaveCVService服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
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
                finalResponse = await fetch(`https://api.wavespeed.ai/api/v2/predictions/${task_id}/result`, {
                    headers: {
                        "Authorization": `Bearer ${WAVESPEED_API_KEY}`
                    }
                });
                if(finalResponse){  
                    jsonFinalResponse = await finalResponse.json();
                }      
            } catch (err) {
                error("调用WaveCVService服务器，获取生成状态时发生异常");
                error(err);      
            }
            //log("WaveCVService jsonFinalResponse", jsonFinalResponse);
            if (jsonFinalResponse?.code === 200) {
                switch(jsonFinalResponse?.data?.status?.toLowerCase()){
                    case "completed":
                        // 路由到结果格式处理函数
                        generatedImage = await this.getResult(jsonFinalResponse);
                        log("WaveCVService predict result:" + generatedImage);
                        return generatedImage;
                    case "failed":
                        error("WaveCVService fail reason:", JSON.stringify(jsonFinalResponse.data.error));
                        return undefined;
                    case "pending":
                    case "processing":
                    case "staged":
                        // 每次查询结果等待1秒
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        log("WaveCVService result try:" + tryTimes);
                }
            }else{
                break;
            }
        }
        return generatedImage;
    }

}
