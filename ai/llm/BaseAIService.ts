import {log, warn, error} from "../../utils/debug";
import type { NextApiRequest, NextApiResponse } from "next";
import * as Fetcher from "node-fetch";
import { EventEmitter } from 'events';
import { Request } from 'express';
import Redis from 'ioredis';
    
export type ChatResponseData = {
  talkId: string | null;
  role: string | null;
  content: string | null;
};

export abstract class BaseAIService{
    public abstract baseModel: string;    // 基座模型名称
    public abstract serviceName: string;    // AI服务商名称
    public abstract maxInputLength: number;    // 输入最大长度
    public abstract maxOutputLength: number;    // 输出最大长度
    public abstract maxTotalLength: number;    // 最大总长度
    public maxConversationTokens = 4096;    // 最大会话Token树
    public bindHistory:boolean = true;
    
    constructor(){}
    
    public abstract chat(inputMsg:any, res:NextApiResponse, isStream:boolean):any;
    public async embedding(sentence:string): Promise< {usedTokens:number, vector:number[]} > {
        return {usedTokens:-1, vector:[-1]};
    }


    // mstType: "MEM", "MODEL"
    public bindLocalMessage(userMsg:any, localMsg:any, msgType:string){
        switch(msgType){
            case "MODEL":
                userMsg = this.bindMsgToCurrent(userMsg, localMsg, 2000);
                break;
            case "MEM":
                userMsg = this.bindMsgToHistory(userMsg, localMsg, 500);
                break;
        }
        return userMsg;
    }


    // 把本地消息添加到系统消息
    public bindMsgToSystem(userMsg:any, localMsg:any, maxLength:number){
        if(localMsg && localMsg.length>0){
        
            // 找到系统消息
            let sysMsg = null;
            for(const msg of userMsg){
                if(msg.role == "system"){
                    sysMsg = msg;
                    break;
                }
            }
    
            // 如果没有系统信息，就在最开始加一条空的系统消息
            if(!sysMsg){
              sysMsg = {role:"system", content:""};
              userMsg.unshift(sysMsg);
            }
               
            //let mContent = "\n\n如果以下{{{}}}中有和用户当前问题相关的内容，请严格根据以下{{{}}}中的内容回答用户的问题。" + 
                // "如果{{{}}}中没有相关内容，请告诉用户你没有学习过相关知识，回答的内容仅供参考！\n" +
                // "{{{";
            let mContent = "\n\n请根据系统信息回答问题。\n\n";
            localMsg.forEach((vector:any) => {
              // log("[bindMsgToSystem] distance:" + vector.distance + " key:" + vector.key + "\n" + vector.content);
              // 最多把5000字作为事实告诉LLM
              if((mContent.length + vector.content.length) < maxLength){
                mContent += vector.content + "\n";
              }else{
                  warn("[out of memory " + maxLength + "]\n");
              }
            });        
            // mContent += "}}}";
            sysMsg.content += mContent;
        }
        
        return userMsg;
    }

    
    // 把本地消息添加到当前消息
    public bindMsgToCurrent(userMsg:any, localMsg:any, maxLength:number){
        if(userMsg && userMsg.length>0){
            let lastMsg = userMsg.pop();

            // 把本地信息组装成用户输入消息的一部分
            if(lastMsg && localMsg.length>0){
                let mContent = "";
                localMsg.forEach((vector:any) => {
                  // log("[bindMsgToCurrent] distance:" + vector.distance + " key:" + vector.key + "\n" + vector.content);
                  // 最多把maxLength作为事实告诉LLM
                  if((mContent.length + vector.content.length) < maxLength){
                    mContent += vector.content + "\n";
                  }else{
                    warn("[out of memory " + maxLength + "]\n");
                  }
                });

                //lastMsg.content = "如果以下{{{}}}中有和用户当前问题相关的内容，请根据以下{{{}}}中的内容回答问题：\n" +
                    // "如果{{{}}}中没有相关内容，请告诉用户你没有学习过相关知识，回答的内容仅供参考！\n" +
//                    "{{{" + mContent + "}}}\n" +
//                    "我的问题是：" + lastMsg.content;
                if(mContent && mContent.trim()){
                    lastMsg.content = mContent + 
                        "\n\n如果上述内容中，有和以下问题有关的内容，请根据上述内容回答问题。如果上述内容中没有和以下问题相关的内容，请忽略掉上述内容。\n\n" + 
                        "我的问题是：" + lastMsg.content;
                }
            }
            
            userMsg.push(lastMsg);
        }

        return userMsg;
    }

    

    // 把本地消息添加到历史消息
    public bindMsgToHistory(userMsg:any, localMsg:any, maxLength:number){
        const systemMsg:any = (userMsg && userMsg.length>1 && userMsg[0].role=="system") ? userMsg.shift() : undefined;
        const lastMsg:any = userMsg && userMsg.length>0 ? userMsg[userMsg.length-1] : undefined;
        
        // 把本地信息组装成一条历史消息
        if(lastMsg && localMsg.length>0){
            let mContent = "";
            let allAIContent = "";
            let allLength = 0;
            
            localMsg.forEach((vector:any) => {
                // log("[bindMsgToHistory] distance:" + vector.distance + " key:" + vector.key + "\n" + vector.content);
                // 最多把maxLength字作为事实告诉LLM
                let vContent = vector.content;
                let strUser = "";
                let strAI = "";

                // 判断是否是历史信息，如果是，需要先解析出格式                
                const nUser = vContent.indexOf(" 用户说:\n");
                const nSplit = vContent.indexOf("\n\n");
                const nAI = vContent.indexOf(" AI返回:\n");
                if(nUser>=0 && nAI>=0){
                    // 此时说明信息是从历史聊天记录里获得
                    strUser = vContent.substring(nUser+6, nSplit);
                    strAI = vContent.substring(nAI+7);
                    allLength += strUser.length + strAI.length;
                }else{
                    // 此时是从本地模型中获得
                    // 或者是兼容聊天记录的老格式
                    allLength = lastMsg.content.length + allAIContent.length + vContent.length;
                }
                
                if(allLength < maxLength){
                    if(strUser && strAI){ // 说明是历史信息
                        const uMsg = {
                            "role": "user",
                            "content": strUser,
                            "name": lastMsg.name
                        }
                        const aMsg = {
                            "role" : "assistant",
                            "content": strAI,
                            "name": lastMsg.name
                        }
                        userMsg.unshift(aMsg);                          
                        userMsg.unshift(uMsg);
                    }else{
                        allAIContent += vContent + "\n";                    
                    }
                }else{
                    warn("[bindMsgToHistory out of memory " + maxLength + "]\n");
                }
            });

            if(allAIContent){ // 说明是本地模型中获得了数据
                const uMsg = {
                    "role": "user",
                    "content": lastMsg.content,
                    "name": lastMsg.name
                }
                const aMsg = {
                    "role" : "assistant",
                    "content": allAIContent,
                    "name": lastMsg.name
                }   
                userMsg.unshift(aMsg);                          
                userMsg.unshift(uMsg);
            }
        }

        // 如果有系统消息，还原第一条系统消息
        if(systemMsg){
            userMsg.unshift(systemMsg);
        }
        
        return userMsg;
    }
    

  
}

