import {log, warn, error} from "../../utils/debug";
import {BaseTTS} from "./BaseTTS";
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as tencentcloud from "tencentcloud-sdk-nodejs";
import * as global from "../../utils/globalUtils";


export class TencentTTS extends BaseTTS {
    public maxLength = 150;
    public maxEnglish = 500;
   
    constructor(){
        super();
    }
  
    /////////////////////////////////////////////////
    // 语音合成
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="TENCENT***1001"){

        // 如果缓存里有就用缓存内容
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if(cache){
            return cache;
        }
        
        const TTSClient = tencentcloud.tts.v20190823.Client;

        try{
            // 微信的语音识别服务
            const clientConfig = {
                credential: {
                    secretId: process.env.TENCENT_SECRET_ID,
                    secretKey: process.env.TENCENT_SECRET_KEY,
                },
                region: "ap-shanghai",
                profile: {
                    httpProfile: {
                        endpoint: "tts.tencentcloudapi.com",
                    },
                },
            };  
        
            const client = new TTSClient(clientConfig);
            const sid = uuidv4();
            const params = {
                // "Region": "ap-shanghai",
                "SessionId": sid,
                "Text": content,
                "VoiceType": speaker ? parseInt(speaker.split("***").pop()!) : 1001,
                "Codec": "mp3",
            };
            
            const result = await client.TextToVoice(params);
            if(result.Audio){
                await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, result.Audio);
                return result.Audio;
            }
        }catch(e){
            error("微信语音合成发生错误");
            error(e);
        }

    }


    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public async voiceToText(voiceUrl:string, format:string="amr"){
        const AsrClient = tencentcloud.asr.v20190614.Client;
    
        try{
            // 微信的语音识别服务
            const clientConfig = {
                credential: {
                    secretId: process.env.TENCENT_SECRET_ID,
                    secretKey: process.env.TENCENT_SECRET_KEY,
                },
                region: "",
                profile: {
                    httpProfile: {
                        endpoint: "asr.tencentcloudapi.com",
                    },
                },
            };  
        
            const client = new AsrClient(clientConfig);
            const params = {
                "EngSerViceType": "16k_zh",
                "SourceType": 0,
                "VoiceFormat": format,
                "Url": voiceUrl
            };
            
            const result = await client.SentenceRecognition(params);
            if(result.Result){
                return result.Result;
            }
        }catch(e){
            error("微信语音识别发生错误");
            error(e);
        }
                
    }  
    

} // end of class



