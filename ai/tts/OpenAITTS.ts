import {log, warn, error} from "../../utils/debug";
import * as global from "../../utils/globalUtils";
import {BaseTTS} from "./BaseTTS";

export class OpenAITTS extends BaseTTS {  
    public predictUrl = process.env.OPENAI_API_PROXY!; 
    public apiKey = process.env.OPENAI_API_KEY;
    
    constructor(){
        super();
    }
  
    /////////////////////////////////////////////////
    // 语音合成
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="OPENAI***alloy"){
        // 如果缓存里有就用缓存内容
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if(cache){
            return cache;
        }

        let retry = 0; // 每次调用如果失败就重试最多5次        
        while(retry < 5){
            const ret = await fetch(this.predictUrl + "?CMD=text2voice", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + this.apiKey,
                },
                body: JSON.stringify({
                    text: content,
                    speaker: speaker.split("***").pop()
                })
            });
    
            if(ret.status == 200){
                return await ret.json();
            }else{
                // 每次失败等待3秒再重新尝试
                error("OPENAI 语音合成失败");
                error(ret);
                await new Promise((resolve) => setTimeout(resolve, 3000));    
                retry++;
            }
        }  
    }


    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public async voiceToText(voiceUrl:string, format:string){
        return "语音识别发生错误"
    }  
        

    
}
