import {log, warn, error} from "../../utils/debug";
import { EventEmitter } from 'events';
import { translate, containsEnglish } from "../../utils/localTranslate";
import fs from "fs";
import * as global from "../../utils/globalUtils";
import {BaseTTS} from "./BaseTTS";


//var AipSpeechClient = require("baidu-aip-sdk").speech;

export class BaiduTTS extends BaseTTS {
    public maxLength = 135;
    
    constructor(){
        super();
    }

    /////////////////////////////////////////////////
    // 语音合成 BY NODE.JS
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="BAIDU***5003"){
        // 如果缓存里有就用缓存内容
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if(cache){
            return cache;
        }
        
        try{
            // 语音合成, 附带可选参数
            const result = await this.ttv(content, speaker.split("***").pop());
            if(result){
                await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, result);
                return result;
            }
        }catch(e){
            error("百度语音合成发生未知异常");
            error(e);
        }
    }
    
    private async ttv(content:string, speaker:string="0"){
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': '*/*'
            },
            body: new URLSearchParams({
                'tex': content,
                'tok': await this.getAccessToken(),
                'cuid': 'eLqsYXaR51xDQ6RZRL7SqceJuBq2sImR',
                'ctp': '1',
                'lan': 'zh',
                'per': speaker,
                'aue': '3' // 3为mp3格式(默认)； 4为pcm-16k；5为pcm-8k；6为wav（内容同pcm-16k）
            })
        };
    
        const res = await fetch('https://tsn.baidu.com/text2audio', options);
        const data = await res.arrayBuffer(); // 获取响应体数据的 ArrayBuffer
        return Buffer.from(data).toString('base64'); // 将 ArrayBuffer 转换为 base64 字符串并返回
    }

    
    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public async voiceToText(voiceUrl:string, format:string){

        throw new Error("voiceToText unimplemented");
                
    }  
    

    /** 
    * 百度语言翻译API调用
    * 使用 AK，SK 生成鉴权签名（Access Token）
    * @return string 鉴权签名信息（Access Token）
    */
    public async getAccessToken() {
        let res = await fetch('https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=' 
                              + process.env.BAIDU_API_KEY + '&client_secret=' + process.env.BAIDU_SECRET_KEY, {
            'method': 'POST',
        });
        
        let token = await res.json();
        
        // @ts-ignore
        return token.access_token;
    }


    
}

