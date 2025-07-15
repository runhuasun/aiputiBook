import {log, warn, error} from "../../utils/debug";
import type { NextApiRequest, NextApiResponse } from "next";
import * as Fetcher from "node-fetch";
import { EventEmitter } from 'events';
import { Request } from 'express';
import Redis from 'ioredis';
import {BaseAIService} from './BaseAIService';
import axios from 'axios';  
import { Readable  }  from 'stream';  
import https from 'https';
import { filterWords } from "../../utils/sensitiveWords";
import { translate, containsEnglish } from "../../utils/localTranslate";
import fs from "fs";
import * as global from "../../utils/globalUtils";


export class BaiduAIService extends BaseAIService {
    public baseModel = "ERNIE-Bot";
    public serviceName = "BAIDUAI";    
    private path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
    private hostname_of_service = "aip.baidubce.com";
    public maxInputLength = 4000;
    public maxOutputLength = 3000;
    public maxTotalLength = 7000;
    public maxSystemLength = 5000;
    private serviceLanguage = "zh";

    constructor(baseModel:string){
        super();
        this.baseModel = baseModel;

        switch(baseModel){
            case "ERNIE-Bot-turbo": // ERNIE-Lite-8K-0922
                this.maxInputLength = 5000;
                this.maxSystemLength = 5000;
                this.maxTotalLength = 10000;                   
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
                break;

            case "ERNIE-Bot": // ERNIE-3.5-8K
                this.maxInputLength = 5000;
                this.maxSystemLength = 10000;
                this.maxTotalLength = 20000;      
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions";
                break;

            case "ERNIE-Bot-4": // ERNIE-4.0-8K
                this.maxInputLength = 5000;
                this.maxSystemLength = 10000;
                this.maxTotalLength = 20000;                
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro";
                break;

            case "ERNIE-Speed-128K":
                this.maxInputLength = 50000;
                this.maxSystemLength = 50000;
                this.maxOutputLength = 50000;
                this.maxTotalLength = 500000;                
                this.path_of_chat = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-speed-128k";
                break;
                
            case "ERNIE-Character-8K-0321":
                this.maxInputLength = 5000;
                this.maxSystemLength = 3000;
                this.maxOutputLength = 5000;
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-char-8k";
                break;

            case "Llama-2-70B-Chat":
                this.maxInputLength = 2500;
                this.serviceLanguage = "en";
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/llama_2_70b";
                break;
                
            case "ChatGLM2-6B-32K":
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/chatglm2_6b_32k";
                this.maxInputLength = 4000;
                this.maxOutputLength = 10000;
                this.maxTotalLength = 20000;
                break;
                
            case "Qianfan-Chinese-Llama-2-7B":
                this.maxInputLength = 2500;
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/qianfan_chinese_llama_2_7b";
                break;
        
            case "Mixtral-8x7B":
                this.maxInputLength = 5000;
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/mixtral_8x7b_instruct";
                break;

            case "Meta-Llama-3-70B-Instruct":
                this.maxInputLength = 4000;
                this.serviceLanguage = "en";
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/llama_3_70b";
                break;

            case "Meta-Llama-3-8B-Instruct":
                this.maxInputLength = 4000;
                this.serviceLanguage = "en";
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/llama_3_8b";
                break;

            case "ChatLaw":
                this.maxInputLength = 5000;
                this.path_of_chat = "/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/chatlaw";
                break;
        }
        
    }
  
    
    public async chat(inputMsg:any, res:NextApiResponse, isStream:boolean=false): Promise<any>{
        if(isStream){
            const cs = await this.chatStream(inputMsg, res);
            return cs;
        }
    }
    
    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        switch(msgType){
            case "MODEL":
                userMsg = super.bindMsgToSystem(userMsg, localMsg, 10000);
                break;
            case "MEM":
                userMsg = super.bindMsgToHistory(userMsg, localMsg, 500);
                break;
        }        
        return userMsg;
    }

    private async chatStream(inputMsg:any, res: NextApiResponse){
        // 先把参数预先传到服务器
        const token = await getAIAccessToken();
        let inputs = inputMsg.messages;
        let messages = [];
        let user_id = "";
        let system = "";
        
        // BAIDU不支持系统信息，而是有一个系统参数来代替
        for(let i=0; i<inputs.length; i++){
            const msg = inputs[i];
            if(msg.role != "system"){
                messages.push({
                    "role":msg.role,
                    "content":msg.content,
                });
                if(msg.name){
                    user_id = msg.name;
                }
            }else{
                if(msg.content){
                    if(this.baseModel.indexOf("ERNIE") < 0){
                        messages.push({
                            "role":"user",
                            "content":msg.content,
                        });
                        messages.push({
                            "role":"assistant",
                            "content":"好的，我已经记住您的要求了，后续回答问题会按照您设定来进行",
                        });           
                    }else{
                        system = msg.content.substring(0, this.maxSystemLength);
                    }
                }
            }
        }
        
        const hostname = this.hostname_of_service;
        const path = this.path_of_chat + "?access_token=" + token;
        let predicturl = hostname + path;
        const params = JSON.stringify( {
            "messages": messages,
            "stream": true,
            "user_id": user_id,
            "system": system
        });
        const headers = {
            'Content-Type': 'application/json',
        };
        const options = {  
            hostname: hostname,  
            path: path,  
            port: 443,
            method: 'POST',  
            headers: headers,
        };        
        
        log("params:" + (params));
        let usedTokens = 0;
        let outputMsg = "";
        let replicateId = "";
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        const eventEmitter = new EventEmitter(); 
        
        let delta = "";
        let resText = "";
        const startSign = 'data: {"id":';
        const endSign = '}}';
        let signals:boolean[] = [];
        let seqence = 0;
        
        const req_ai = https.request(options, async (res_ai) => { 
            res_ai.on('close', () => {
                log("res_ai on close");
                res.write("data:[DONE]\n\n"); 
                res.end();
                eventEmitter.emit('parserFinished');                                      
            });
            
            // 在这里处理接收到的数据         
            res_ai.on('data', async (event) => {  
                log(JSON.stringify(event));
                let current = seqence++;
                signals.push(false);       
                let waittimes = 100;
                while(current >0 && !signals[current-1] && waittimes-->0){
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                resText += event.toString();
                if(resText.indexOf("error_code") > 0){
                    log("resText:" + resText);
                    const errObj = JSON.parse(resText);
                    const errMsg = {
                        "role": "assistant",
                        "content": "系统发生错误：" + errObj.error_msg,
                    }; 
                    outputMsg = errMsg.content;
                    res.write("data:" + JSON.stringify(errMsg) + "\n\n");
                    res.write("data:[DONE]\n\n"); 
                    res.end();
                    eventEmitter.emit('parserFinished');                      
                }
                
                while(resText.includes(startSign) && resText.includes(endSign)){
                    const nStart = resText.indexOf(startSign) + 5;
                    const nEnd = resText.indexOf(endSign) + 2;
                    const nNext = nEnd + 2;
                    delta = resText.substring(nStart, nEnd);
                    resText = nNext>(resText.length-1) ? "" : resText.substring(nNext);
                    
                    try{
                        if(delta){
                            //log("--------------------begin delta----------------------");
                            //log(delta);
                            //log("--------------------end delta------------------");
                            const data = JSON.parse(delta);
                            
                            if(data && data.result){
                                let chunk = filterWords(data.result);                              
                                /*
                                if(this.serviceLanguage == "en"){
                                  let segs = chunk.split("\n");
                                  chunk = "";
                                  for(let i=0; i<segs.length; i++){
                                      if(i>0){
                                          chunk += '\n';
                                      }
                                      chunk += containsEnglish(segs[i]) ? await translate(segs[i], "en", "zh") + seg[i];
                                  }
                                }
                                */
                                outputMsg += chunk;
                                usedTokens += data.usage ? data.usage.total_tokens : 0;
                                replicateId = data.created;
                                const output = {
                                    "role": "assistant",
                                    "content": chunk,
                                };
                                res.write("data:" + JSON.stringify(output) + "\n\n"); 
                            }
                            if(data.is_end){
                                res.write("data:[DONE]\n\n"); 
                                res.end();
                                eventEmitter.emit('parserFinished');  
                            }    
                        }
                    }catch(e){
                        error("parse baidu response:" + e);
                        break;
                    }
                }
                log(`thread ${current} process end....`);
                signals[current] = true;              
            }); 
        });  
      
        req_ai.on('error', (err) => {  
            error(err);  
        }); 
        req_ai.write(params);  
        req_ai.end();
        
        // 等待传递完所有数据
        await new Promise<void>(resolve => {
            eventEmitter.once('parserFinished', () => {
                log('AI生成的结果异步传输完毕');
                resolve();
            });
        });  
        
        return {
            aiservice: this.serviceName,
            baseModel: this.baseModel,
            predicturl: predicturl,
            replicateId: replicateId,
            usedTokens: usedTokens,
            outputMsg: outputMsg,
        };
    }


    
    // 用百度embedding-v1向量化字符串
    // 改为bge_large_zh
    public async embedding(sentence:string): Promise< {usedTokens:number, vector:number[]} > {
        let usedTokens = 0;
        let vector:number[] = [];
        const access_token = getAIAccessToken();
        
        let retry = 0; // 每次调用如果失败就重试最多5次
        
        while(retry < 5){
          // log("sentence:" + sentence);
          
          const ret = await fetch( "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/bge_large_zh?access_token=" + access_token
              , {
                  method: "POST",
                  headers: {
                      "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                      input: [sentence],
                  }),
              });    
    
          const result = await ret.json();
          
          if(ret.status == 200){
              log("EMB处理" + sentence.length + "字，使用了" + result.usage.total_tokens + "个token");
              usedTokens = result.usage.total_tokens;
              vector = result.data[0].embedding;
              break;
          }else{
              // 每次失败等待3秒再重新尝试
              await new Promise((resolve) => setTimeout(resolve, 3000));    
              retry++;
          }
        }  
      
        return {usedTokens:usedTokens, vector:vector};
    }    

    
}



/** 
* 百度AI-API调用
* 使用 AK，SK 生成鉴权签名（Access Token）
* @return string 鉴权签名信息（Access Token）
*/
export async function getAIAccessToken() {
    let res = await fetch('https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=' 
                          + process.env.BAIDU_AI_API_KEY + '&client_secret=' + process.env.BAIDU_AI_SECRET_KEY, {
        'method': 'POST',
    });
    
    let token = await res.json();
    
    // @ts-ignore
    return token.access_token;
}

