import {log, warn, error} from "../../utils/debug";
import type { NextApiRequest, NextApiResponse } from "next";
import * as Fetcher from "node-fetch";
import { EventEmitter } from 'events';
import { Request } from 'express';
import EventSource from 'eventsource';
import Redis from 'ioredis';
import {BaseAIService} from './BaseAIService';
import { filterWords } from "../../utils/sensitiveWords";
import {runFunctionCall, functionCallPrefix} from "../../utils/functionCall";
import * as global from "../../utils/globalUtils";


export class OpenAIService extends BaseAIService {
    public baseModel = "gpt-3.5-turbo-16k";
    public serviceName = "OPENAI";    
    public maxInputLength = 2000;
    public maxOutputLength = 2000;
    public maxTotalLength = 4000;
    public predictUrl = process.env.OPENAI_API_PROXY!; 
    public apiKey = process.env.OPENAI_API_KEY;
    public enableSearch = false;
    
    constructor(baseModel:string){
        super();
        if(baseModel){
            this.baseModel = baseModel;
        }

        switch(this.baseModel){
            case "gpt-4o":
                this.maxInputLength = 10000;
                this.maxOutputLength = 5000;
                this.maxTotalLength = 128000;
                break;                
            case "gpt-4o-search-preview":
                this.maxInputLength = 10000;
                this.maxOutputLength = 5000;
                this.maxTotalLength = 128000;
                break;   
                
            case "gpt-3.5-turbo-16k-0613":
            case "gpt-3.5-turbo-16k":
            case "gpt-3.5-turbo-1106":
            case "gpt-4-1106-preview":
            case "gpt-4-0125-preview":
            case "gpt-4-1106-vision-preview":
            default:
                this.maxInputLength = 10000;
                this.maxOutputLength = 4000;
                this.maxTotalLength = 16000;
                break;               
        }
    }
  
  public async chat(inputMsg:any, res:NextApiResponse, isStream:boolean=false): Promise<any>{
      if(isStream){
          // 先把参数预先传到服务器          
          const pcs = await this.prepareChatStream(inputMsg);
          // 调用流式服务
          const cs = await this.chatStream(pcs.chatKey, res);
          return cs;
      }
  }

  private async prepareChatStream(inputMsg:any){
  
      // log("------prepoare chat stream-------\n" + inputMsg);
      if(inputMsg.params){
          inputMsg.params.max_tokens = this.maxOutputLength;
      }else{
          inputMsg.params = {
              "max_tokens" : this.maxOutputLength
          }
      }
      if(this.enableSearch){
          inputMsg.params.tools = [{"type": "web_search_preview"}];
      }

      const ret = await fetch(this.predictUrl  + "?CMD=prepareChat", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + this.apiKey,
          },
          body: JSON.stringify(inputMsg),
      });
  
      return {
        aiservice: this.serviceName,
        baseModel: this.baseModel,
        predicturl: this.predictUrl,
        chatKey: await ret.json()
      };
  
  }
  
  
  private async chatStream(aiKey:string, res: NextApiResponse){

      let usedTokens = 0;
      let outputMsg = "";
      let replicateId = "";
    
      const source = new EventSource(this.predictUrl + "?CMD=chatStream&baseModel=" + this.baseModel + "&key=" + aiKey);
  
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const eventEmitter = new EventEmitter();

      let dataToSend = ""; // 等待发送给客户端的数据
      let isStreamSend = true; // 是否流式返回
      let isFuncCall = false; // 是否是函数调用
      
      source.onmessage = await async function(event) {
          if(event.data.trim().indexOf('[DONE]') < 0){
              const jo = JSON.parse(event.data);
  
              if(jo && jo.choices && jo.choices[0] && jo.choices[0].delta && jo.choices[0].delta.content){
                  
                  const chunk = jo.choices[0].delta.content;
                  // log("chat delta:" + chunk);
                  
                  outputMsg += chunk;
                  dataToSend += chunk;
                  
                  usedTokens += jo.usage ? jo.usage.total_tokens : 0;
                  replicateId = jo.created;

                  // 如果发现是函数调用就停止流式返回
                  if(outputMsg.startsWith(functionCallPrefix)){
                      isStreamSend = false;
                      isFuncCall = true;
                  }

                  // 为了方便做一些判断，至少攒够20个字符才返回
                  if(isStreamSend && outputMsg.length > 20){
                      const output = {
                          "role": "assistant",
                          "content": filterWords(dataToSend),
                      }; 
                      const delta = // "event:message\n" +
                                  "data:" + JSON.stringify(output) + "\n\n";
                      
                      if(isStreamSend){
                          //log("send to web front:\n" + delta);                              
                          res.write(delta); 
                      }
                      dataToSend = "";
                  }
             }
          }else{
              log("received [DONE] from proxy");
              // 通常是返回总长度不足20个字符才会发生这种情况
              if(isStreamSend && dataToSend.length > 0){
                  const output = {
                      "role": "assistant",
                      "content": filterWords(dataToSend),
                  };        
                  const delta = // "event:message\n" + 
                      "data:" + JSON.stringify(output) + "\n\n";
                  log("less 20 delta:\n" + delta);    
                  res.write(delta); 
              }
              if(isFuncCall){
                  const callResult = await runFunctionCall(outputMsg);
                  const output = {
                      "role": "assistant",
                      "content": filterWords(callResult.toString()),
                  };        
                  const delta = // "event:message\n" + 
                      "data:" + JSON.stringify(output) + "\n\n";
                  log("func call delta:" + delta);    
                  res.write(delta); 
              }
             
              res.write( // "event:message\n" + 
                  "data:[DONE]" + "\n\n" ); 
              res.end();
              source.close();
              eventEmitter.emit('parserFinished');          
          }
      };
  
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
          predicturl: this.predictUrl,
          replicateId: replicateId,
          usedTokens: usedTokens,
          outputMsg: outputMsg,
      };
  }

    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        switch(msgType){
            case "MODEL":
                userMsg = super.bindMsgToSystem(userMsg, localMsg, 5000);
                break;
            case "MEM":
                userMsg = super.bindMsgToHistory(userMsg, localMsg, 500);
                break;
        }
        
        return userMsg;
    }

    
    // 用openAI向量化字符串
    public async embedding(sentence:string): Promise< {usedTokens:number, vector:number[]} > {
        let usedTokens = 0;
        let vector:number[] = [];

        let retry = 0; // 每次调用如果失败就重试最多5次
        
        while(retry < 5){
          // log("sentence:" + sentence);
          
          const ret = await fetch(this.predictUrl + "?CMD=embedding", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + this.apiKey,
            },
            body: JSON.stringify({
              input: sentence,
            }),
    
          });
    
          if(ret.status == 200){
              const result = await ret.json();
              log("EMB处理" + sentence.length + "字，使用了" + result.usage.total_tokens + "个token");
              usedTokens = result.usage.total_tokens;
              vector = result.data[0].embedding;
              break;
          }else{
              // 每次失败等待3秒再重新尝试
              error("embedding not return a JSON");
              error(ret);
              await new Promise((resolve) => setTimeout(resolve, 3000));    
              retry++;
          }
        }  
      
        return {usedTokens:usedTokens, vector:vector};
    }

    
}
