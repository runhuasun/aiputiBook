import {log, warn, error} from "../../utils/debug";
import type { NextApiRequest, NextApiResponse } from "next";
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
import fs from 'fs';
import * as global from "../../utils/globalUtils";

export class XunFeiAIService extends BaseAIService {
    public baseModel = "Spark";
    public serviceName = "XunFei";    
    private path_of_chat = "/v2.1/chat"; // "/v1.1/chat";
    private hostname_of_service = "spark-api.xf-yun.com";
    private domain = "general";
    public maxInputLength = 4096;
    public maxOutputLength = 2048;
    public maxTotalLength = 6144;
    
    constructor(baseModel:string){
        super();
        this.baseModel = baseModel;
        if(baseModel == "Spark"){
            this.baseModel = "Spark V3.0";
        }
        switch(this.baseModel){
            case "Spark V1.5":
                this.path_of_chat = "/v1.1/chat";
                this.domain = "general";
                break;
            case "Spark V2.0":
                this.path_of_chat = "/v2.1/chat";
                this.domain = "generalv2";
                break;
            case "Spark V3.0":
                this.path_of_chat = "/v3.1/chat";
                this.domain = "generalv3";
                break;
        }
    }
  
  public async chat(inputMsg:any, res:NextApiResponse, isStream:boolean=false): Promise<any>{
      if(isStream){
          const cs = await this.chatStream(inputMsg, res);
          return cs;
      }
  }

   
  private async chatStream(inputMsg:any, res: NextApiResponse){
      // 先把参数预先传到服务器
      const cur_time = new Date();
      const dateStr = cur_time.toUTCString();      

      const token = await getAccessToken(dateStr, this.hostname_of_service, this.path_of_chat);
      
      let inputs = inputMsg.messages;
      let messages = [];
      let user_id = "";
      
      // 不支持系统信息
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
    
      const  v = {
          "authorization": token, // 上方鉴权生成的authorization
          "date": dateStr,  // 步骤1生成的date
          "host": hostname, // 请求的主机名，根据具体接口替换
              };
      const p = new URLSearchParams(v);
      const path = `${this.path_of_chat}?${p.toString()}`;
      const predicturl = "wss://" + hostname + path;
      
      const params = JSON.stringify( {
          "header":{
              "app_id": process.env.XUNFEI_APP_ID,
              "uid": user_id,
          },
          "parameter":{
              "chat":{
                  "domain":this.domain,
                  "temperature":0.5,
                  "max_tokens": 4096,
              }
          },
          "payload":{
              "message":{
                  "text": messages,
              }
          }
      });
      log("params:" + (params));
      
      const headers = {
          'Content-Type': 'application/json',
   //       "Accept": "text/event-stream",
   //       "Authorization": token,
      };
      log("predicturl:" + predicturl);
      const socket = new WebSocket(predicturl);

      socket.onopen = function() {
          socket.send(params);
      };      
  
      let usedTokens = 0;
      let outputMsg = "";
      let replicateId = "";

      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const eventEmitter = new EventEmitter(); 

      socket.onmessage = function(event) {
          //log("xunfei event:\n" + JSON.stringify(event));   
      
          const delta = JSON.parse(event.data.toString());
          if(delta.header.code == 0){
              const content = delta.payload.choices.text[0].content;
              outputMsg += content;
              const output = {
                          "role": "assistant",
                          "content": filterWords(content),
                      };
              res.write("data:" + JSON.stringify(output) + "\n\n"); 

              if(delta.header.status == 2){
                  usedTokens += delta.payload.usage.text.total_tokens;
                  replicateId = delta.header.sid;                  
                  res.write("data:[DONE]\n\n"); 
                  res.end();
                  eventEmitter.emit('parserFinished');  
              }
          }else{
              error("xunfei error:" + delta.header.message);
              const output = {
                          "role": "assistant",
                          "content": "AI服务发生意外失败，请换个问题试试！",
                      };              
              res.write("data:" + JSON.stringify(output) + "\n\n"); 
              res.write("data:[DONE]\n\n"); 
              res.end();
              eventEmitter.emit('parserFinished');        
          }
      }

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

    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        switch(msgType){
            case "MODEL":
                userMsg = super.bindMsgToCurrent(userMsg, localMsg, 5000);
                break;
            case "MEM":
                userMsg = super.bindMsgToHistory(userMsg, localMsg, 5000);
                break;
        }
        
        return userMsg;
    }


} // end of class

function utf8 (str: string) {
    return Buffer.from(str, 'utf8') as any as string;
}

function base64 (str: string) {
    return Buffer.from(str).toString('base64');
}

function hmac (key: string, content: string)  {
    return crypto.createHmac('sha256', key)
        .update(content)
        .digest('base64');
}

/**
* 语言翻译API调用
* 使用 AK，SK 生成鉴权签名（Access Token）
* @return string 鉴权签名信息（Access Token）
export async function getAccessToken(cur_time: string, hostname: string=this.hostname_of_service, path: string=this.path_of_chat) {
*/
export async function getAccessToken(cur_time: string, hostname: string, path: string) {
    try {
        const date = cur_time;
        const APISecret = process.env.XUNFEI_API_SECRET;
        const APIKey = process.env.XUNFEI_API_KEY;            

        if (APISecret && APIKey) {
            const tmp = `host: ${hostname}\ndate: ${date}\nGET ${path} HTTP/1.1`;
            const sign = hmac(utf8(APISecret), utf8(tmp));
            // log(sign);
            const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${sign}"`;
            // log(authorizationOrigin);
            return base64(utf8(authorizationOrigin));
        } else {
            throw new Error("没有配置正确的 XUNFEI APIKEY");
        }
    } catch (e) {
        error("读取 XUNFEI apikey 时发生意外");
        throw new Error("读取 XUNFEI apikey 时发生意外");
    }
}
