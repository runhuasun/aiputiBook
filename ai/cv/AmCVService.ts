import {BaseCVService} from "./BaseCVService";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import * as enums from "../../utils/enums";
import * as fs from "../../utils/fileServer";
import * as fu from "../../utils/fileUtils";

export class AmCVService extends BaseCVService{
    public modelName: string = "api.market";
    public predicturl: string = "";
    public fetchurl: string = '';
    public version: string = "";
    public func: string = "";
    public replicate = null;
    public model: string = "";
    public taskMethod: string = "POST";
    public resultMethod: string = "GET";
    private retryInterval: number = 5; // 秒
    
    constructor(func:string){
        super();
        this.func = func;
        switch(func){
            case "faceswapVideo-Capix":
                this.predicturl = "https://prod.api.market/api/v1/magicapi/faceswap-capix/video/run";
                this.fetchurl = "https://prod.api.market/api/v1/magicapi/faceswap-capix/video/result";
                this.resultMethod = "POST";
                this.retryInterval = 10;
                break;
                
            case "faceswapVideo-V2":
                this.predicturl = "https://api.magicapi.dev/api/v1/magicapi/faceswap-v2/faceswap/video/run";
                this.fetchurl = "https://api.magicapi.dev/api/v1/magicapi/faceswap-v2/faceswap/video/status";
                this.retryInterval = 10;
                break;

            case "faceswap-V2":
                this.predicturl = "https://api.magicapi.dev/api/v1/magicapi/faceswap-v2/faceswap/image/run";
                this.fetchurl = "https://api.magicapi.dev/api/v1/magicapi/faceswap-v2/faceswap/image/status";
                this.retryInterval = 5;
                break;                
        }
    }

    private getRequestBody(input:any){
        switch(this.func){
            case "faceswapVideo-Capix":
                const encodedParams = new URLSearchParams();
                encodedParams.set('target_url', input.target_url);
                encodedParams.set('swap_url', input.swap_url);
                encodedParams.set('target_face_index', '0');                
                return {
                    method: "POST",
                    headers: {
                        "x-api-market-key": "cmcdftfu20001le04ktmb8idt",
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    body: encodedParams
                };
    
            default:
                return {
                    method: "POST",
                    headers: {
                        "x-magicapi-key": "cmcdftfu20001le04ktmb8idt",
                        "Content-Type": "application/json",
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ input: input })
                };
        }
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private async getResult(response:any){
        log("AmCV getResult:", response);        
        switch(this.func){
            case "faceswapVideo-V2":
                return response.output.video_url;
                
            case "faceswap-V2":
                if(fu.isBase64Image(response.output)){
                    const imageURL = await fs.moveToFileServer(response.output, "T"); 
                    if(imageURL){
                        return imageURL;
                    }else{
                        return response.output;
                    }
                }else{
                    return response.output.image_url;
                }
                
            case "faceswapVideo-Capix":
                return response?.image_process_response?.result_url;

        }
    }
    
    public async predict(input:any){
        log("AmCV predict input", input);
        let retry = 0;
        while(retry <= 10){        
            try{
                const requestBody:any = this.getRequestBody(input);
                //log("this.getRequestBody(input):", requestBody);
                const startResponse = await fetch(this.predicturl, requestBody);

                //log(startResponse?.status, startResponse);
                const jsonStartResponse = await startResponse.json();
                if(jsonStartResponse){
                    log("[AmCV server response:]", jsonStartResponse);
                }
                
                switch(startResponse.status){
                    case 200:
                        return {
                            task_id: jsonStartResponse.id || jsonStartResponse.image_process_response?.request_id,
                            status: enums.resStatus.OK,
                            message: jsonStartResponse.status || jsonStartResponse.image_process_response?.description,
                        }                        
                    case 400: // Bad request, typically due to missing or invalid input data.
                        return {
                            task_id: jsonStartResponse.id || jsonStartResponse.image_process_response?.request_id,
                            status: enums.resStatus.inputErr,
                            message: jsonStartResponse.status
                        }                        
                    case 401: // Unauthorized, API key is invalid or missing.
                    default:
                        return {
                            task_id: null,
                            status: enums.resStatus.expErr,
                            message: jsonStartResponse.status || "调用AI服务器返回未知错误",
                        }
                }
            } catch (err) {
                error("调用AmCV服务器发生异常");
                error(err);               
            }  
            
            retry++;
            if(retry <= 10){
                log("调用AmCV服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用AmCV服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
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
                let request:any = {};
                if(this.resultMethod === "GET"){
                    request = {
                        method: "GET",
                        headers: {
                            "x-magicapi-key": "cmcdftfu20001le04ktmb8idt",
                            "Content-Type": "application/json",
                        }
                    };
                    finalResponse = await fetch(`${this.fetchurl}/${task_id}`, request);
                }else if(this.resultMethod === "POST"){
                    const encodedParams = new URLSearchParams();
                    encodedParams.set('request_id', task_id);
                    request = {
                        method: "POST",
                        headers: {
                            'x-api-market-key': 'cmcdftfu20001le04ktmb8idt',
                            'content-type': 'application/x-www-form-urlencoded'                            
                        },
                        body: encodedParams
                    };
                    finalResponse = await fetch(`${this.fetchurl}`, request);
                }
                
                if(finalResponse){  
                    jsonFinalResponse = await finalResponse.json();
                }      
            } catch (err) {
                error("调用AmCV服务器，获取生成状态时发生异常");
                error(err);      
            }
            log("AmCV finalResponse.status:", finalResponse?.status);
            log("AmCV get result:", jsonFinalResponse);
            switch(finalResponse?.status) {
                case 200: {
                    switch(jsonFinalResponse.status || jsonFinalResponse.image_process_response?.status ){
                        case "OK":
                        case "COMPLETED":
                            // 路由到结果格式处理函数
                            generatedImage = await this.getResult(jsonFinalResponse);
                            log("AmCV predict result:" + generatedImage);
                            return {
                                result: generatedImage,
                                status: enums.resStatus.OK,
                                message: "OK"
                            }
                        case "ERROR":
                        case "FAILED":
                            log("AmCV fail reason:", JSON.stringify(jsonFinalResponse));
                            return {
                                result: null,
                                status: enums.resStatus.expErr,
                                message: jsonFinalResponse.data?.error?.raw_message || jsonFinalResponse.data?.error?.message || jsonFinalResponse.image_process_response?.error_message,
                            }
                        case "PROCESSING":
                        case "IN_PROGRESS":
                        case "IN_QUEUE":
                        default:
                            // 每次查询结果等待1秒
                            await new Promise((resolve) => setTimeout(resolve, this.retryInterval * 1000));
                            log("AmCV result try:" + tryTimes);
                    }
                    break;
                }
                case 400:
                    return {
                        status: enums.resStatus.inputErr,
                        message: "输入内容错误"
                    }                      
                case 401:                    
                default:
                    return {
                        status: enums.resStatus.expErr,
                        message: "调用AI服务器返回未知错误",
                    }
            }
        }
        return {
            status: enums.resStatus.unExpErr,
            message: "服务器发生未知错误，请稍后重试！",
        }
    }

}
