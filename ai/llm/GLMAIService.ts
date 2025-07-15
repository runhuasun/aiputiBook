import {log, warn, error} from "../../utils/debug";
import { filterWords } from "../../utils/sensitiveWords";

import type { NextApiRequest, NextApiResponse } from "next";
import * as Fetcher from "node-fetch";
import { EventEmitter } from 'events';
import { Request } from 'express';
import Redis from 'ioredis';
import {BaseAIService} from './BaseAIService';
import axios from 'axios';  
import { Readable  }  from 'stream';  
import https from 'https';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';


export class GLMAIService extends BaseAIService {
    public baseModel = "ChatGLM-Pro";
    public serviceName = "GLM";    
    public maxInputLength = 5000;
    public maxOutputLength = 5000;
    public maxTotalLength = 32000;
    
    private path_of_chat = "/api/paas/v3/model-api/chatglm_turbo/sse-invoke";
    private hostname_of_service = "open.bigmodel.cn";
    
    constructor(baseModel:string){
        super();
        this.baseModel = baseModel;
        
        if(baseModel == "ChatGLM-Std"){
            this.path_of_chat = "/api/paas/v3/model-api/chatglm_std/sse-invoke";
        }else if(baseModel == "ChatGLM-Lite"){
            this.path_of_chat = "/api/paas/v3/model-api/chatglm_lite/sse-invoke";
        }else if(baseModel == "ChatGLM-Pro"){
            this.path_of_chat = "/api/paas/v3/model-api/chatglm_pro/sse-invoke";
        }else if(baseModel == "ChatGLM-Turbo"){
            this.path_of_chat = "/api/paas/v3/model-api/chatglm_turbo/sse-invoke";
        }else if(baseModel == "GLM-3-Turbo"){
            this.path_of_chat = "/api/paas/v4/chat/completions";
            this.maxTotalLength = 128000;
            this.maxInputLength = 10000;
            this.maxOutputLength = 10000;
        }else if(baseModel == "GLM-4"){
            this.path_of_chat = "/api/paas/v4/chat/completions";
            this.maxTotalLength = 128000;
            this.maxInputLength = 50000;
            this.maxOutputLength = 10000;
        }
    }
    
    
    public async chat(inputMsg:any, res:NextApiResponse, isStream:boolean=false): Promise<any>{
        if(isStream){
            if(this.baseModel == "GLM-4" || this.baseModel == "GLM-3-Turbo"){
                const cs = await this.chatStreamV4(inputMsg, res);
                return cs;
            }else{
                const cs = await this.chatStream(inputMsg, res);
                return cs;
            }
        }
    }

    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        if(this.baseModel == "GLM-3-Turbo"){
            switch(msgType){
                case "MODEL":
                    userMsg = super.bindMsgToSystem(userMsg, localMsg, 30000);
                    break;
                case "MEM":
                    userMsg = super.bindMsgToHistory(userMsg, localMsg, 10000);
                    break;
            }
        }else if(this.baseModel == "GLM-4"){
            switch(msgType){
                case "MODEL":
                    userMsg = super.bindMsgToSystem(userMsg, localMsg, 5000);
                    break;
                case "MEM":
                    userMsg = super.bindMsgToHistory(userMsg, localMsg, 5000);
                    break;
            }
        }else{
            switch(msgType){
                case "MODEL":
                    userMsg = super.bindMsgToCurrent(userMsg, localMsg, 5000);
                    break;
                case "MEM":
                    userMsg = super.bindMsgToHistory(userMsg, localMsg, 5000);
                    break;
            }
        }        
        return userMsg;
    }


    private async chatStreamV4(inputMsg:any, res: NextApiResponse){
        // 先把参数预先传到服务器
        const token = await this.getAccessToken();
        let inputs = inputMsg.messages;
        
        const hostname = this.hostname_of_service;
        const path = this.path_of_chat;
        let predicturl = hostname + path;
        const params = JSON.stringify( {
            model: this.baseModel.toLowerCase(),
            messages: inputs,
            stream: true,
        //    max_tokens: this.maxOutputLength,
        });
        
        const headers = {
          'Content-Type': 'application/json',
            "Authorization": token,
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

        let deltaList:string[] = [];
        let linePart = "";
        const startSign = "data:";
        const deltaEndSign = "}}]}";
        const finishEndSign = "}}";
        const doneSign = "data:[DONE]";
        
        const req_ai = https.request(options, (res_ai) => { 
           
            // 在这里处理接收到的数据         
            res_ai.on('data', (event) => {  
                //log("---------------begin-----------------------");
                //log("-----delta------\n" + event);   
                //log("----------------end------------------------");
                
                try{
                    let eventStr = event.toString();
                    if(linePart){
                        eventStr = linePart + eventStr;
                        linePart = "";
                    }
                    const lines = eventStr.split("\n\n");

                    for(const line of lines){
                        //log("LINE:" + line);
                        if(line.startsWith(startSign) && line.endsWith(deltaEndSign)){ // 正常数据行
                            const block = JSON.parse(line.substring(startSign.length));
                            const deltaData = block.choices[0].delta.content;
                            //log(deltaData);
                            outputMsg += deltaData;                      
                            const output = {
                                "role": "assistant",
                                "content": filterWords(deltaData),
                            };
                            
                            res.write("data:" + JSON.stringify(output) + "\n\n"); 
                        }else if(line.startsWith(startSign) && line.endsWith(finishEndSign)){
                            const block = JSON.parse(line.substring(startSign.length));
                            if(block.choices[0].finish_reason){
                                //log("finishData");
                                usedTokens = block.usage.total_tokens;
                                replicateId = block.id;    
                                res.write("data:[DONE]\n\n"); 
                                res.end();
                                eventEmitter.emit('parserFinished');  
                            }
                        }else if(line.startsWith(doneSign)){
                            res.write("data:[DONE]\n\n"); 
                            res.end();
                            eventEmitter.emit('parserFinished');  
                        }else{
                            linePart = line;
                            break;
                        }
                     }
                }catch(e){
                    error("parse chatGLM V4 response:" + e);
                }
            }); 
        });  
        
        req_ai.write(params);  
        req_ai.end();
        
        // 等待传递完所有数据
        await new Promise<void>(resolve => {
            eventEmitter.once('parserFinished', () => {
                log('ChatGLM v4 生成的结果异步传输完毕');
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



    
    private async chatStream(inputMsg:any, res: NextApiResponse){
      // 先把参数预先传到服务器
      const token = await this.getAccessToken();
      let inputs = inputMsg.messages;
      let messages = [];
      let user_id = "";
      
      // GLM老版本不支持系统信息
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
                  messages.push({
                      "role":"user",
                      "content":msg.content,
                  });
                  messages.push({
                      "role":"assistant",
                      "content":"好的，我已经记住您的要求了，后续回答问题会按照您设定来进行",
                  });           
              }
          }
      }
      
      const hostname = this.hostname_of_service;
      const path = this.path_of_chat;
      let predicturl = hostname + path;
      const params = JSON.stringify( {
        "prompt": messages,
    //       "stream": true,
    //       "user_id": user_id,
        "incremental": true,
      });
      const headers = {
          'Content-Type': 'application/json',
    //       "Accept": "text/event-stream",
          "Authorization": token,
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
    
     
      const req_ai = https.request(options, (res_ai) => { 
      let segment = "";
      let waitingMoreMeta = false;
          
          // 在这里处理接收到的数据         
          res_ai.on('data', (delta) => {  
             // log("---------------begin-----------------------");
             // log("-----delta------\n" + delta);   
             // log("----------------end------------------------");
    
              try{
                  segment += delta.toString();
                  
                  const lines:string[] = segment.split("\n");
    
                  const event = lines[0].startsWith("event:") ? lines[0].substring(6) : "";
                  const id = (lines.length>1 && lines[1].startsWith("id:")) ? lines[1].substring(3) : "";
                  
                  if(event == "add"){
                      let data = "";
                      for(let i=2; i<lines.length; i++){
                          if(i > 2 && lines[i].length>0){
                              data += "\n";
                          }
                          data += lines[i].startsWith("data:") ? lines[i].substring(5) : "";
                      }
    
                      outputMsg += data;                      
                      const output = {
                          "role": "assistant",
                          "content": filterWords(data),
                      };
                      res.write("data:" + JSON.stringify(output) + "\n\n"); 
                      segment = "";
                  }else if(event == "finish"){
                      let meta = lines[3].startsWith("meta:") ? lines[3].substring(5) : "";
                      for(let i=4; i<lines.length; i++){
                          meta += lines[i];
                      }
                      let metaData = null;
                      try{
                          metaData = JSON.parse(meta);
                          waitingMoreMeta = false;
                      }catch(e){
                          error("waiting more meta of GLM");
                          waitingMoreMeta = true;
                      }
    
                      if(!waitingMoreMeta){
                          usedTokens += metaData.usage ? metaData.usage.total_tokens : 0;
                          replicateId = metaData.request_id;    
                          segment = "";
                          res.write("data:[DONE]\n\n"); 
                          res.end();
                          eventEmitter.emit('parserFinished');  
                      }
                  }else if(segment.indexOf("event:interrupted")>=0){
                      const error = "[系统检测到输入或生成内容可能包含不安全或敏感内容，请您避免输入易产生敏感 内容的提示语，感谢您的配合。]";
                      const output = {
                          "role": "assistant",
                          "content": error,
                      };      
                      outputMsg += error;                      
                      
                      res.write("data:" + JSON.stringify(output) + "\n\n"); 
                      res.write("data:[DONE]\n\n"); 
                      res.end();
                      eventEmitter.emit('parserFinished');                        
                  }
                }catch(e){
                    error("parse chatGLM response:" + e);
                }
              
          }); 
      
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


  /**
   * 百度语言翻译API调用
   * 使用 AK，SK 生成鉴权签名（Access Token）
   * @return string 鉴权签名信息（Access Token）
   */
    private async getAccessToken() {
        
        try {
            //d172ab550ecbb4ec7564d3bf64b9b5d4.tMq64Op8QPDMNLUb
            const apikey = process.env.GLM_API_KEY;
            const exp = 3600*24*7;
            // const timezoneOff = 28800;
            const timeNow = Math.floor(Date.now()/1000);
            
            if(apikey){
                const [id, secret] = apikey.split(".");
                
                const payload = {
                    api_key: id,
                    exp: timeNow + exp,
                    timestamp: timeNow,
                };

                // @ts-ignore
                const token = jwt.sign(
                    payload,
                    secret,
                    {
                        algorithm: 'HS256',
                        // @ts-ignore
                        header: {'alg': 'HS256', 'sign_type': 'SIGN'}
                    },
                );

                log("JWT Token:" + token);
                return token;
            }else{
                error("没有配置GLM的API key");
                throw new Error("没有配置GLM的API key");
            }
        } catch (e) {
            error("读取GLM apikey时发生意外");
            throw new Error("读取GLM apikey时发生意外");
        }
    }
}
