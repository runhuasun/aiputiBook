import {log, warn, error} from "../../utils/debug";
import { EventEmitter } from 'events';
import {BaseTTS} from './BaseTTS';
import axios from 'axios';  
import { Readable  }  from 'stream';  
import https from 'https';
import fs from 'fs';
import * as acs from "microsoft-cognitiveservices-speech-sdk";
import * as global from "../../utils/globalUtils";


export class AzureTTS extends BaseTTS {
    constructor(){
        super();
    }
  
    /////////////////////////////////////////////////
    // 语音合成
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="AZURE***zh-CN-XiaoxiaoNeural"){
        // 如果缓存里有就用缓存内容
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if(cache){
            return cache;
        }

        return new Promise((resolve, reject) => {                    
            try{
                // This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
                const speechConfig = acs.SpeechConfig.fromSubscription(process.env.AZURE_AI_KEY!, process.env.AZURE_AI_REGION!);
                speechConfig.speechSynthesisOutputFormat = acs.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
                
                // The language of the voice that speaks.
                log("speaker:", speaker);
                const vName = speaker.split("***").pop(); 
                speechConfig.speechSynthesisVoiceName = vName ? vName : "zh-CN-XiaoxiaoNeural";
                const speechSynthesizer = new acs.SpeechSynthesizer(speechConfig);

                const handleResultAsync = async (result:any) => {
                    const { audioData, audioDuration } = result;
                    log("result:", JSON.stringify(result));
                    log("privAudioDuration:", result.privAudioDuration);
                    speechSynthesizer.close();

                    if(audioDuration > 0){
                        // convert arrayBuffer to base64 string
                        const bufferStr = Buffer.from(audioData).toString('base64');
                        if (bufferStr) {
                            await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, bufferStr);
                            resolve(bufferStr);
                        }
                    }
                };                
                const handleError = (error:any) => {
                    error("微软语音合成发生错误！");
                    error(error);
                    speechSynthesizer.close();
                    reject(error);
                };                
                
                // 判断是否使用了标记语言
                if(content.trim().startsWith('<speak')){ 
                    speechSynthesizer.speakSsmlAsync(content, handleResultAsync, handleError);
                }else{
                    speechSynthesizer.speakTextAsync(content, handleResultAsync, handleError);
                }
            }catch(e){
                error("微软语音合成发生错误");
                error(e);
                reject(e);
            }
        });
    }


    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public async voiceToText(voiceUrl:string, format:string){
        return "语音识别发生错误"
    }  
    

} // end of class


