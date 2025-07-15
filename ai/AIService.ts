import type { NextApiRequest, NextApiResponse } from "next";
import { EventEmitter } from 'events';
import { Request } from 'express';
import Redis from 'ioredis';
import {log, warn, error} from "../utils/debug";
import {BaseAIService} from './llm/BaseAIService';
import {OpenAIService} from './llm/OpenAIService';
import {BaiduAIService} from './llm/BaiduAIService';
import {GLMAIService} from './llm/GLMAIService';
import {XunFeiAIService} from './llm/XunFeiAIService';
import {QianWenAIService} from './llm/QianWenAIService';

import {BaseTTS} from "./tts/BaseTTS";
import {OpenAITTS} from './tts/OpenAITTS';
import {BaiduTTS} from './tts/BaiduTTS';
import {XunFeiTTS} from './tts/XunFeiTTS';
import {AliyunTTS} from './tts/AliyunTTS';
import {TencentTTS} from './tts/TencentTTS';
import {AzureTTS} from './tts/AzureTTS';

import {BaseCVService} from "./cv/BaseCVService";
import {OpenAICVService} from './cv/OpenAICVService';
import {RepCVService} from './cv/RepCVService';
import {SdapiCVService} from './cv/SdapiCVService';
import {AliCVService} from './cv/AliCVService';
import {FalCVService} from './cv/FalCVService';
import {PiCVService} from './cv/PiCVService';
import {SegmindCVService} from './cv/SegmindCVService';
import {ByteCVService} from "./cv/ByteCVService";
import {WaveCVService} from "./cv/WaveCVService";
import {BaiduCVService} from "./cv/BaiduCVService";
import {AmCVService} from "./cv/AmCVService";


import * as tu from "../utils/textUtils";


export type ChatResponseData = {
  talkId: string | null;
  role: string | null;
  content: string | null;
};

export function createLLMInstance(serviceName:string, baseModel:string) : BaseAIService | undefined {
    if(serviceName == "OPENAI"){
        return new OpenAIService(baseModel);
    }else if(serviceName == "BAIDUAI"){
        return new BaiduAIService(baseModel);
    }else if(serviceName == "GLM"){
        return new GLMAIService(baseModel);
    }else if(serviceName == "XUNFEI"){
        return new XunFeiAIService(baseModel);
    }else if(serviceName == "QIANWEN"){
        return new QianWenAIService(baseModel);      
    }else{
        throw new Error("实例化大模型时，发现传入了不被支持的大模型服务");
    }
}

export function createCVInstance(serviceName:string, baseModel:string) : BaseCVService | undefined {
    switch(serviceName){
        case "WAVE":
            return new WaveCVService(baseModel);          
        case "SEGMIND":
            return new SegmindCVService(baseModel);         
        case "PI":
            return new PiCVService(baseModel);          
        case "FAL":
            return new FalCVService(baseModel);  
        case "OPENAI":
        case "DALLE":
            return new OpenAICVService(baseModel);
        case "REP":
            return new RepCVService(baseModel);
        case "SDAPI":
            return new SdapiCVService(baseModel);   
        case "ALI":
            return new AliCVService(baseModel);
        case "BYTE":
            return new ByteCVService(baseModel);
        case "BAIDU":
            return new BaiduCVService(baseModel);
        case "AM":
            return new AmCVService(baseModel);
      default:
            throw new Error("实例化视觉计算模型时，发现传入了不被支持的模型服务");
    }
}


export function createTTSInstance(serviceName:string) : BaseTTS | undefined {
    try{
        if(serviceName == "OPENAI"){
            return new OpenAITTS();
        }else if(serviceName == "BAIDU"){
            return new BaiduTTS();
        }else if(serviceName == "XUNFEI"){
            return new XunFeiTTS();
        }else if(serviceName == "ALIYUN"){
            return new AliyunTTS();      
        }else if(serviceName == "TENCENT"){
            return new TencentTTS();
        }else if(serviceName == "AZURE"){
            return new AzureTTS();
        }else{
            throw new Error("实例化大模型时，发现传入了不被支持的大模型服务");
        }
    }catch(e){
        error("createInstance");
        error(e);
    }
}


// 调用了新的腾讯\讯飞\百度云语音合成服务
export async function textToVoice(content:string, speakerCode:string, aiservice:string){
    try{
        let ais = createTTSInstance(aiservice);
        if(ais){
            let sentences = tu.splitToSentences(tu.removeSpecials(tu.removeEmojis(content)), ais.maxLength);
            let vData:any[] = [];
            if(sentences){
              log("被分成了：" + sentences?.length + "句");          
              for(const s of sentences){
                  log(s);
                  if(tu.containsReadableCharacters(s)){
                      const delta = await ais.textToVoice(s, speakerCode); // emojis会让转成语音时觉得不正常
                      log("delta.length:", delta?.length);
                      if(delta?.length>0){
                          vData.push(Buffer.from(delta, 'base64'));
                      }
                  }
              }
              const result = Buffer.concat(vData);
              log("总长度：" + result?.length);
              return result?.toString("base64");
            }
        }
    }catch(e){
        error("textToVoice");
        error(e);
    }
}

