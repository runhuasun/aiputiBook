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
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import  encode  from 'base64url';
import { URLSearchParams } from 'url';
import WebSocket from 'ws';
import { filterWords } from "../../utils/sensitiveWords";
import OpenAI from "openai";

const PATH_OF_QW = "/api/v1/services/aigc/text-generation/generation";
const PATH_OF_COMPATIBLE = "/compatible-mode/v1";
const PATH_OF_COMPATIBLE_API = "/compatible-mode/v1/chat/completions";


export class QianWenAIService extends BaseAIService {
        
    public baseModel = "qwen-turbo"; //qwen-plus-v1, chatglm3-6b
    public serviceName = "QianWen";    
    private path_of_chat = PATH_OF_QW;
    private path_of_emb = "/api/v1/services/embeddings/text-embedding/text-embedding";
    private hostname_of_service = "dashscope.aliyuncs.com";
    public maxInputLength = 5000;
    public maxOutputLength = 2000;
    public maxTotalLength = 8000;
    public enable_search = false;
    public enable_image = false;


    
    constructor(baseModel:string){
        super();
        this.baseModel = baseModel;
        switch(baseModel){
            case "qvq-plus":
            case "qvq-max":
                this.maxInputLength = 100000;
                this.maxOutputLength = 8000;
                this.maxTotalLength = 130000;
                this.enable_search = false;
                this.enable_image = true;
                this.path_of_chat = PATH_OF_COMPATIBLE;
                break;
                
            case "deepseek-r1":
                this.maxInputLength = 20000;
                this.maxOutputLength = 8000;
                this.maxTotalLength = 60000;
                this.enable_search = true;
                this.path_of_chat = PATH_OF_COMPATIBLE;
                break;
            case "deepseek-v3":
                this.maxInputLength = 20000;
                this.maxOutputLength = 8000;
                this.maxTotalLength = 60000;
                this.enable_search = true;
                this.path_of_chat = PATH_OF_COMPATIBLE;
                break;                        
            case "chatglm3-6b":
                this.maxInputLength = 6000;
                this.maxOutputLength = 1500;
                this.maxTotalLength = 7500;
                this.enable_search = false;
                this.path_of_chat = PATH_OF_QW;
                break;
            case "qwen-72b-chat":
                this.maxInputLength = 30000;
                this.maxOutputLength = 2000;
                this.maxTotalLength = 32000;
                this.enable_search = false;
                this.path_of_chat = PATH_OF_QW;
                break;
            case "qwen-long":
                this.maxInputLength = 100000;
                this.maxOutputLength = 2000;
                this.maxTotalLength = 1000000;
                this.enable_search = true;  
                this.path_of_chat = PATH_OF_QW;
                break;
            case "qwen-turbo":
            default:
                this.maxInputLength = 5000;
                this.maxOutputLength = 2000;
                this.maxTotalLength = 8000;
                this.enable_search = true;
                this.path_of_chat = PATH_OF_QW;
        }
    }
  
    public async chat(inputMsg:any, res:NextApiResponse, isStream:boolean=false): Promise<any>{
        if(isStream){
            switch(this.path_of_chat){
                case PATH_OF_COMPATIBLE: return await this.chatCompatible(inputMsg, res);
                case PATH_OF_QW:
                default:
                    return await this.chatStream(inputMsg, res);
            }
        }
    }
    
    
    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        switch(msgType){
            case "MODEL":
                userMsg = super.bindMsgToSystem(userMsg, localMsg, 3000);
                break;
            case "MEM":
                userMsg = super.bindMsgToHistory(userMsg, localMsg, 500);
                break;
        }
        
        return userMsg;
    }

    private async chatCompatible(inputMsg:any, res: NextApiResponse){
        let inputs = inputMsg.messages;
        let history = [];
        let user_id = "";
        let reasoningContent = ""; // 定义完整思考过程
        let answerContent = ""; // 定义完整回复
        let isAnswering = false; // 判断是否结束思考过程并开始回复
        let usedTokens = 0;
        let replicateId = "";

        const predicturl = "https://" + this.hostname_of_service + this.path_of_chat;
        const openai = new OpenAI({
            // 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx",
            apiKey: process.env.ALI_QIANWEN_API_KEY,
            baseURL: predicturl,
        });            
        const completion = await openai.chat.completions.create({
            model: this.baseModel, // 此处以 deepseek-r1 为例，可按需更换模型名称
            messages: inputs,
            stream: true,
            // 解除以下注释会在最后一个chunk返回Token使用量
            stream_options: {
                include_usage: true
            }
        });

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        
        for await (const chunk of completion) {
            //log("CHUNK:", JSON.stringify(chunk));            
            
            // 处理usage信息
            if (!chunk.choices?.length) {
                //log("\n" + "=".repeat(20) + "Token 使用情况" + "=".repeat(20) + "\n");
                //log(chunk.usage);   
                usedTokens = chunk.usage?.total_tokens || 0;
                continue;
            }
    
            const delta:any = chunk.choices[0].delta;
            
            // 检查是否有reasoning_content属性
            //if (!('reasoning_content' in delta)) {
            //    continue;
            //}
    
            // 处理空内容情况
            if (!delta.reasoning_content && !delta.content) {
                continue;
            }
    
            // 处理开始回答的情况
            if (!delta.reasoning_content && !isAnswering) {
                console.log("\n" + "=".repeat(20) + "完整回复" + "=".repeat(20) + "\n");
                isAnswering = true;
            }
    
            // 处理思考过程
            if (delta.reasoning_content) {
                const output = {
                    "role": "assistant",
                    "type": "REASON", // 是否是逻辑推理    
                    "content": filterWords(String(delta.reasoning_content)),
                };
                res.write("data:" + JSON.stringify(output) + "\n\n");                 
                reasoningContent += delta.reasoning_content;
            }
            // 处理回复内容
            else if (delta.content) {
                let deltaContent = filterWords(String(delta.content));
                if( reasoningContent && !answerContent ){
                    deltaContent = "\n" + deltaContent; // 在reasoningContent 和 answerContent中间加入一个换行，将来应该考虑两部分分别显示
                }
                const output = {
                    "role": "assistant",
                    "type": "CONTENT",
                    "content": deltaContent,
                };
                res.write("data:" + JSON.stringify(output) + "\n\n");                 
                answerContent += deltaContent;
            }
        }
        res.write("data:[DONE]\n\n"); 
        res.end();        
        
        return {            
            aiservice: this.serviceName,
            baseModel: this.baseModel,
            predicturl: PATH_OF_COMPATIBLE,
            replicateId: replicateId,
            usedTokens: usedTokens,
            outputMsg: answerContent,
        };        
        
    }

    
    
    private async chatStream(inputMsg:any, res: NextApiResponse){
      
        let inputs = inputMsg.messages;
        let history = [];
        let user_id = "";
        
        const predicturl = "https://" + this.hostname_of_service + this.path_of_chat;
        const params = JSON.stringify( {
            "model": this.baseModel,
            "input": {              
                messages: inputs,
            },
            "parameters": {
                enable_search: this.enable_search,
                result_format: "message"
            }
        });
        
        const headers = {
            'Content-Type': 'application/json',
            "Accept":"text/event-stream",
            "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
            "X-DashScope-SSE": "enable",
        };
        
        log("params:" + (params));
      
        const options = {  
            hostname: this.hostname_of_service,  
            path: this.path_of_chat,  
            port: 443,
            method: 'POST',  
            headers: headers,
        };   
    
  
        let usedTokens = 0;
        let outputMsg = "";
        let replicateId = "";

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        const eventEmitter = new EventEmitter(); 

        let delta = "";
        const startSign = 'data:{"output":';
        // const endSign = '}}';
        
        const req_ai = https.request(options, (res_ai) => { 
          // 在这里处理接收到的数据         
          res_ai.on('data', (event) => {  
                const eStr = event.toString();
                const nStart = eStr.indexOf(startSign) + 5;
                delta = eStr.substring(nStart);

                try{
                    if(delta){
                        const data = JSON.parse(delta);
                        
                        if(data){
                              const chunk = data.output.choices[0].message.content.substring(outputMsg.length);
                              outputMsg = data.output.choices[0].message.content;
                              const output = {
                                  "role": "assistant",
                                  "content": filterWords(chunk),
                              };
                              res.write("data:" + JSON.stringify(output) + "\n\n"); 
                        }
                         if(data.output.choices[0].finish_reason == "stop"){
                            usedTokens += data.usage.output_tokens + data.usage.input_tokens;
                            replicateId = data.request_id;                              
                             res.write("data:[DONE]\n\n"); 
                             res.end();
                             eventEmitter.emit('parserFinished');  
                         }    
                    }
                }catch(e){
                    error("parse tongyi response:" + e);
                    error(delta);
                }


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

      log("本次调用千问使用token：" + usedTokens);
      return {
          aiservice: this.serviceName,
          baseModel: this.baseModel,
          predicturl: predicturl,
          replicateId: replicateId,
          usedTokens: usedTokens,
          outputMsg: outputMsg,
      };
  }


    
    // 用openAI向量化字符串
    public async embedding(sentence:string): Promise< {usedTokens:number, vector:number[]} > {
        let usedTokens = 0;
        let vector:number[] = [];

        let retry = 0; // 每次调用如果失败就重试最多5次
        
        while(retry < 5){
            // log("sentence:" + sentence);
            const predicturl = "https://" + this.hostname_of_service + this.path_of_emb;            
            
            const ret = await fetch(predicturl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
                },
                body: JSON.stringify({
                    model: "text-embedding-v1",
                    input: {
                        texts: [sentence],
                    },
                }),
            });
            
            const result = await ret.json();
          
            if(ret.status == 200){
                log("EMB处理" + sentence.length + "字，使用了" + result.usage.total_tokens + "个token");
                usedTokens = result.usage.total_tokens;
                vector = result.output.embeddings[0].embedding;
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
