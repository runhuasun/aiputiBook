import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {BaseCVService} from "./BaseCVService";

export class RepCVService extends BaseCVService{
    public modelName: string = "replicate";
    public predicturl: string = process.env.REPLICATE_API_PROXY!;
    
    public version: string = "";
    public func: string = "";
    
    constructor(func:string){
        super();
        this.func = func;
        switch(func){
            case "recogImg":
                this.version = "2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746";
                break;

            case "recogImgByPrompt":
                // yorickvp / llava-13b
                this.version = "2facb4a474a0462c15041b78b1ad70952ea46b5ec6ad29583c0b29dbd4249591";
        }                    
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private getResult(response:any){
        switch(this.func){
            case "recogImgByPrompt":
                if(Array.isArray(response.output)){
                    return response.output.join('');
                }
                break;
            default:
                return Array.isArray(response.output) ? 
                    (response.output[response.output.length-1] as string) : 
                    (response.output?.image || response.output?.media_path || response.output?.audio_output || response.output as string);
        }
    }
    
    public async predict(input:any){
        let retry = 0;
        
        while(retry <= 10){        
            try{
                const startResponse = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "version": this.version,
                        "input": input
                    })
                });
    
                const jsonStartResponse = await startResponse.json();
                if(jsonStartResponse){
                    log("[AI server response:]" + JSON.stringify(jsonStartResponse));
                }
                
                if(startResponse && jsonStartResponse && jsonStartResponse.id && jsonStartResponse.status != "failed" ) {
                    return jsonStartResponse.urls.get;
                }
            } catch (err) {
                error("调用AI服务器发生异常");
                error(err);               
            }  
            
            retry++;
            if(retry <= 10){
                log("调用AI服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用AI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }
    }

    public async getPredictResult(getUrl:string){
        // GET request to get the status of the image restoration process & return the result when its ready
        let tryTimes = 0;
        let generatedImage = null;
        
        // 最多尝试30次
        while (!generatedImage && tryTimes++ < 30) {
            // Loop in 1s intervals until the alt text is ready
            log("polling for result...");
            let finalResponse = null;
            let jsonFinalResponse = null;
        
            try{
                finalResponse = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "endpointUrl": getUrl
                    })
                });
                if(finalResponse){  
                    jsonFinalResponse = await finalResponse.json();
                }      
            } catch (err) {
                error("调用AI服务器，获取生成状态时发生异常");
                error(err);      
            }
            
            if (finalResponse && jsonFinalResponse && (jsonFinalResponse.status === "succeeded" || jsonFinalResponse.status === "success") ) {
                // 路由到结果格式处理函数
                generatedImage = this.getResult(jsonFinalResponse);
                log("predict result:" + generatedImage);
            } else if (finalResponse && jsonFinalResponse && jsonFinalResponse.status === "failed") {
                let errorMsg = jsonFinalResponse.error as string;
                if(errorMsg.indexOf("NSFW content") >= 0){
                    throw new Error("生成的图片包含有不适合的内容，请避免使用过于敏感的提示词！");
                }else{
                    throw new Error(errorMsg);
                }
                error("failed");
                break;
            } else {
                // 每次查询结果等待5秒
                await new Promise((resolve) => setTimeout(resolve, 5000));
                log("第" + tryTimes + "次尝试重新获取返回图片");
            }
        }

        return generatedImage;
    }

}
