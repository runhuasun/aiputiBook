import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as Fetcher from "node-fetch";
import fs from 'fs';
import path from 'path';
import { Model, User, Application } from "@prisma/client";
import { Request } from 'express';
// import EventSource from 'eventsource';
import Redis from 'ioredis';
import { GenerateResponseData } from "./generate";
import xml2js from 'xml2js';
import bodyParser from 'body-parser';
import * as crypto from 'crypto';
import { xml2json, json2xml } from 'xml-js';
import { EventEmitter } from 'events';
import  signIn  from 'next-auth/next';
import {globalSet, globalGet} from "../../utils/globalUtils";
import {log, warn, error} from "../../utils/debug";
import https from "https";
// import FormData from "form-data";
import request from "request";
import {XunFeiTTS} from '../../ai/tts/XunFeiTTS';
import { Readable } from "stream";
import { config } from "../../utils/config";
import { Mutex } from 'async-mutex';
import { inviteUser } from "./createuser";
import { filterWords } from "../../utils/sensitiveWords";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{
        const {appid} = req.query;

        const app = appid ? await getApp(appid as string) : null;

        if(!app || app.type!="XiaomiService"){
            log("应用配置错误");
            return res.status(400).send("应用配置错误");
        }

        const body = req.body;
        log(JSON.stringify(body));
        let content = "我是AI小提智能陪伴机器人，现在让我们开始对话吧！";
        
        // 请求的类型，分别进行标识。
        // 0：技能进入请求；
        // 1：技能进行中请求；
        // 2：请求结束请求。
        // 如果是技能中的会话请求
        switch(body.request.type){
          case 0:
            break;
          case 1:
            content = await sendMessage(app, body.query);
            break;
          case 2:
            content = "好的，和你一起聊天的时间真快乐，期待下一次谈话哦！";
            break;
        }

        const result = {
            "version" : "1.0",
            "is_session_end" : false,
            "response":{
                "to_speak" : {
                    "type" : 0,
                    "text" : content
                },
                "open_mic" : true,              
                "not_understand" : false,
            }
        };
        return res.status(200).json(result);
                    
    } catch (e) {
        error("wechat service exception:\n" + e);
        res.status(500).send( "wechat service exception" );
    }
}

// 根据openID找到对应用户，如果用户不存在就注册一个
async function getUserByOpenId(app:Application, openId:string){
    let unionId = await getUnionID(app, openId);
    let user = null;
    
    // 看看用户是否存在
    if(unionId){
        // Get user from DB
        user = await prisma.user.findUnique({
          where: {
              email: unionId,
          },
        });
        log("wechat talking user found:" + JSON.stringify(user));
    }
    
    // 如果不存在就登录创建一个默认的用户
    if(!user){  
        const result = await fetch(process.env.WEBSITE_URL + "/api/signInWechat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ openid:openId, unionid:unionId, signInType: "INSIDE" }),
        });
          
        const userdata = await result.json();
        log("userdata:" + JSON.stringify(userdata));
        if(userdata && userdata.email){
            unionId = userdata.email;
            user = await prisma.user.findUnique({
                where: {
                    email: unionId,
                },
            });
        }
        log("wechat talking user created:" + JSON.stringify(user));
    } 

    return user;
}


async function getApp(appId: string){
  return await prisma.application.findUnique({
    where: {
      id: appId,
    },
    include: {
      user: true,
    },
  });
}

function getAppConfig(app:Application, key:string){
    const config = JSON.parse(app.config);
    return config[key];
}

async function getAppUserConfigValue(app:Application, user:User, key:string){
    const data = await prisma.appUserConfig.findUnique({
                where: {
                    appId_userId:{
                        appId: app.id,
                        userId: user.id
                    },
                }
            });  
    if(data && data.config){
        const configJson = JSON.parse(data.config);
        return configJson[key];
    }
}


async function callAPI(app:Application, user:User, apiStr:string){
    // const api = JSON.parse(apiStr);
    log("apiStr:" + apiStr);
    const url = apiStr + "&appId=" + app.id + "&userId=" + user.id;
    log("url:" + url);
    const result = await fetch(url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    return await result.json();    
    
}


export async function getAccessToken(app:Application){
    const now = new Date();    
    const wechatAppId = getAppConfig(app, "WECHAT_APP_ID");
    const wechatAppSecret = getAppConfig(app, "WECHAT_APP_SECRET");
    let access_token = await globalGet("WECHAT_SERVICE", app.id + "access_token");
    let access_tokenExpTime = await globalGet("WECHAT_SERVICE", app.id + "access_tokenExpTime");
    log("access_token from redis:" + access_token);

    if(!access_token || !access_tokenExpTime  || (now.toISOString()>=access_tokenExpTime)){
        const result1 = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "grant_type": "client_credential",
              "appid": wechatAppId,
              "secret": wechatAppSecret
            })
         });
        // {"access_token":"ACCESS_TOKEN","expires_in":7200}
        const ret1 = await result1.json();
        log("ret1:" + JSON.stringify(ret1));
        access_token = ret1.access_token;
        await globalSet("WECHAT_SERVICE", app.id+"access_token", ret1.access_token);
        const expTime = new Date(now.getTime() + ret1.expires_in * 1000);
        log("expTime:" + expTime);
        await globalSet("WECHAT_SERVICE", app.id+"access_tokenExpTime", expTime.toISOString());   
    }
    log("access_token:" + access_token);
    return access_token;
}

export async function voiceToText(app:Application, voice_id:string, format:string){
    const token = await getAccessToken(app);
    log("voice_id:" + voice_id);

    let result = await fetch(
        "http://api.weixin.qq.com/cgi-bin/media/voice/addvoicetorecofortext?access_token=" + token
        + "&format=" + format + "&voice_id=" + voice_id + "&lang=zh_CN",         
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
         });
    const ret1 = await result.json();
    log("ret1:" + JSON.stringify(ret1));
    if(ret1.errmsg == "ok"){
        log("成功创建语音识别任务");
        result = await fetch(
        "http://api.weixin.qq.com/cgi-bin/media/voice/queryrecoresultfortext?access_token=" + token
         + "&voice_id=" + voice_id + "&lang=zh_CN",         
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
         });
        const ret2 = await result.json();
        log("ret2:" + JSON.stringify(ret2));
        
        return ret2.result;
    }else{
        return "";
    }
}

export async function setTypingStatus(app:Application, touser:string){
    const token = await getAccessToken(app);
    const result = await fetch(
        "https://api.weixin.qq.com/cgi-bin/message/custom/typing?access_token=" + token,                    
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body:JSON.stringify({ "touser":touser, "command":"Typing"}),
                                   
         });
    
    log("setTypingStatus:" + JSON.stringify(await result.json()));
}

export async function createWechatServiceMenu(app:Application){
    const token = await getAccessToken(app);
    const menu = getAppConfig(app, "WECHAT_SERVICE_MENU");

    if(menu){
        const result = await fetch(
          " https://api.weixin.qq.com/cgi-bin/menu/create?access_token=" + token,                    
          {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body:JSON.stringify(menu),
                                     
           });
        log("createWechatServiceMenu:" + JSON.stringify(await result.json()));
    }else{
        const result = await fetch(
          " https://api.weixin.qq.com/cgi-bin/menu/delete?access_token=" + token,                    
          {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
           });
        const resJson = await result.json();
        if(resJson.errmsg == "ok"){
            log("createWechatServiceMenu: DELETED ALL");
        }else{
            error("createWechatServiceMenu: FAILED TO DELETE");
        }
    }
}

function checkSignature(app:Application, req: any): boolean {
    const { signature, timestamp, nonce } = req.query;
    const token = getAppConfig(app, "WECHAT_SERVICE_TOKEN");
    
    const tmpArr = [token, timestamp, nonce].sort((a, b) => a.localeCompare(b));
    const tmpStr = tmpArr.join('');
    const tmpStrHash = crypto.createHash('sha1').update(tmpStr).digest('hex');
    
    if (tmpStrHash === signature) {
        return true;
    } else {
        return false;
    }
}

function transformData(data: { [key: string]: any }) {
    for (const key in data) {
        if (typeof data[key] === 'object' && data[key]._cdata) {
            data[key] = data[key]._cdata;
        }else if (typeof data[key] === 'object' && data[key]._text) {
            data[key] = data[key]._text;
        }else if (typeof data[key] === 'object') {
            data[key] = transformData(data[key]);
        }
    }
    return data;
}

function xmlToJson(xml: string): object {
  const options = { compact: true, nativeType: true, ignoreDoctype:true, ignoreComment: true };
  const json = xml2json(xml, options);
  return transformData(JSON.parse(json));
}

function jsonToXml(json: object): string {
  const options = { compact: true, ignoreComment: true, indentCdata:true, spaces: 4 };
  const xml = json2xml(JSON.stringify(json), options);
  return xml;
}


async function responseToUserByCS(app:Application, toUserId: string, content:string, type:string="text"){
    const token = await getAccessToken(app);
    let body = null;
    log("responseToUserByCS.content:" + content);
    log("responseToUserByCS.type:" + type);
  
    if(content && toUserId){
        if(type == "text"){
            body = {
                    "touser": toUserId,
                    "msgtype":"text",
                    "text": {
                        "content": filterWords(content),
                    },
                };
        }else if(type == "voice"){
        
            const ais = new XunFeiTTS();

            const speaker = getAppConfig(app, "XUNFEI_T2V_SPEAKER");
            const vData = speaker ? (await ais.textToVoice(content, speaker)) : (await ais.textToVoice(content));
            
            if(vData){
               // log("textovoice vData:" + vData.length);
              
                const localPath = path.join("./tmp/download/", "voices", (new Date().getTime()).toString()+".mp3");
                // let audioBuf = Buffer.from(vData, 'base64');

                await fs.writeFileSync(localPath, vData);

                // 把声音上传到公众号
                const wemediaPath = "https://api.weixin.qq.com/cgi-bin/media/upload?access_token=" + token + "&type=" + type;
                const formData = {
                    "media" : fs.createReadStream(localPath)              
                };
                const eventEmitter = new EventEmitter();

                request.post({url:wemediaPath, formData: formData}, 
                             function(err, response, bd){
                                 log("voice....");
                                 if(err) {
                                     console.log('上传音频失败' , err);
                                     return;
                                 }
                                 
                                 const media_id = JSON.parse(response.body).media_id;
                                 log("response.body:" + response.body);
                                 log("media-id:" + media_id);
                               
                                body = {
                                    "touser":toUserId,
                                    "msgtype":"voice",
                                    "voice":{
                                        "media_id": media_id,
                                    }
                                }     
                                log("body:" + JSON.stringify(body));
                                eventEmitter.emit('finished');   

                             });
                              // 等待传递完所有数据
                await new Promise<void>(resolve => {
                  eventEmitter.once('finished', () => {
                      log('声音传输完毕');
                      resolve();
                  });
                });                       
            }else{
                body = {      
                    "touser": toUserId,
                    "msgtype":"text",
                    "text": {
                        "content": filterWords(content),
                    },
                };                
            }
        }else if(type == "image"){
            // 先把图片下载到本地
            log("content:" + content);
            const resDownload = await fetch(content);
            const fileName = (new Date().getTime()).toString() + ".png"; // (content.split("/")).pop();
            log("fileName:" + fileName);
            const localPath = path.join("./tmp/download/", "images", fileName!);

            if(resDownload.ok){
                const imageData = Buffer.from(await resDownload.arrayBuffer());
                await fs.writeFileSync(localPath, imageData);
                
                // 把图片上传到公众号
                const wemediaPath = "https://api.weixin.qq.com/cgi-bin/media/upload?access_token=" + token + "&type=image";
                const formData = {
                    "media" : fs.createReadStream(localPath)                  
                };
                const eventEmitter = new EventEmitter();

                request.post({url:wemediaPath, formData: formData}, 
                             function(err, resUpload, bd){
                                 log("func....\n" + JSON.stringify(resUpload));
                                 if(err) {
                                     console.log('上传图片失败' , err);
                                     return;
                                 }
                                 
                                 const media_id = JSON.parse(resUpload.body).media_id;
                                 log("media-id:" + media_id);
                               
                                body = {
                                    "touser":toUserId,
                                    "msgtype":"image",
                                    "image":{
                                        "media_id": media_id,
                                    }
                                }     
                                log("body:" + JSON.stringify(body));
                                eventEmitter.emit('finished');   

                             });
                              // 等待传递完所有数据
                await new Promise<void>(resolve => {
                  eventEmitter.once('finished', () => {
                      log('图片传输完毕');
                      resolve();
                  });
                });         
            }  
            
                     
        }
        if(body){
            const result = await fetch(
                "https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=" + token, 
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body:  JSON.stringify(body),
                });
            const ret1 = await result.json();
            log("客服返回消息:" + JSON.stringify(ret1));

            return true;
        }
        return false;
    }
}

export async function getUnionID(app:Application, openid: string){
    const token = await getAccessToken(app);
    const url =  "https://api.weixin.qq.com/cgi-bin/user/info?access_token=" + token + "&openid=" + openid + "&lang=zh_CN";
    log("getUnionID url:" + url);

    const result = await fetch(
        url, 
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },            
        });
    const ret = await result.json();
    log("getUnionID ret" + JSON.stringify(ret));
    return ret.unionid;
}


interface TalkRecord {
  talkId:string;
  role:string;
  content:string;
  name:string;
  userCover:string;
  createdAt:Date;
};


async function sendMessage(app:Application & { user: User }, userMsg:string, returnType:string="text", inputType:string="text"){

    const prompt = userMsg;
    if(!prompt || prompt.length<1){
        return "请先输入想问我的内容吧！";
    }
    if(prompt.length>500){
       return "每次输入的内容不能大于500个字符，请简化一下你的问题吧！";
    }    
    
    let loginUser:User|null = null;
  
    // B2A结算模式，所有费用算在APP创建者
    if(app.settlement == "B2A"){
        loginUser = app.user!;
    }else{ 
        return "后台应用配置又错误！";
    }
    let talkUser = loginUser;

    // 所找本次对话的角色模型，校验一下是否存在
    let chatModelId = null; // await getAppUserConfigValue(app, talkUser, "CHAT_MODEL_ID"); 
    if(!chatModelId){
        chatModelId = app.modelId;
    }
    let chatModel = await prisma.model.findUnique({
        where: {
            id: chatModelId,
        },
    });

    
    // 准备输入的数据
    let input:TalkRecord = {
      talkId: "",
      role : "user",
      content : prompt,
      name: talkUser.id, // 这里用对话的用户而不是登录用户
      userCover: "",
      createdAt: new Date(Date.now()),
    };
    
    const messages:{role:string, content:string, name:string}[] = [];
 
    // 压入当前的问题
     messages.push({
      role: input.role,
      content: input.content,
      name: input.name,
    });         
    
    let service = process.env.WEBSITE_URL + "/api/chat?CMD=prepareChat&" + "email=" + loginUser.email;  
    log("service prepare:" + service);
    try{
      const res = await fetch(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages, 
          modelId: chatModelId,
        //  drawModel: drawModel
        }),
    
      });
      // log("res:" + JSON.stringify(res));
      // log("res:" + JSON.stringify(await res.json()));
        
      if (res.status === 200) {
        let response = (await res.json());
        const current:TalkRecord = {
            talkId: response,
            role : "assistant",
            content : "", 
            name: talkUser.id,
            userCover: "",
            createdAt: new Date(Date.now()),
          };
          
        // context.push(current);
        input.talkId = current.talkId;

        // 如果是文字信息
        // 开始陆续接收内容
        const eventEmitter = new EventEmitter();
          
        const streamUrl = process.env.WEBSITE_URL + "/api/chat?key=" + response + "&email=" + loginUser.email; 
        const source = new EventSource(streamUrl);
        let segment = ""; // 当前已经收到服务器返回的段落
        let segs = 0;  // 当前已经返回过的段落，微信一次最多返回5段
        let maxLen = 200; // 微信每次返回的最大长度
        const mutex = new Mutex(); // 互斥锁
        
        source.onmessage = async function(event) {
            // 等待获取互斥锁，保证同一时间只有一个线程进入该函数
            const release = await mutex.acquire();

            try{
               // log("event.data:" + event.data); 
               if(event.data.trim().indexOf('[DONE]') < 0){
                   const retMsg = JSON.parse(event.data);
                   segment += retMsg.content;
                   // log("segment:" + segment);
                   current.content += retMsg.content; 

                   // 一直积攒到还未发送的字符大于阀值再处理
                   if(segment.length > maxLen){
                       let tRet = segment; // 本次返回的段落
                       // 截取出不大于阀值的最长段落
                       while(tRet.length > maxLen){
                           const lastNewlineIndex = tRet.lastIndexOf('\n');
                           // log("lastNewlineIndex:" + lastNewlineIndex);
                           tRet = segment.substring(0, lastNewlineIndex);
                           // log("tRet:" + tRet);
                       }  
                       if(segs++ < 4 && tRet.length>0){
                           segment = segment.substring(tRet.length+1);                             
                           // log("ret:" + tRet);
                           // await responseToUserByCS(app, talkUserOpenId, tRet, returnType);
                           // setTypingStatus(app, talkUserOpenId);
                           if(returnType=="text"){
                               // 对于文本类型可以回复的越来越长
                               // 对于语音消息，受一次60秒的限制，不能增加长度
                               maxLen += 200;
                           }
                       }
                   }                 
  
               }else{
                   // log("[DONE]");
                   source.close();
                   
                   if(segment.length > 0){
                       // 微信最大每次返回1000字符
                       if(segment.length > 1000){
                           segment = segment.substring(0, 950) + "\n\n提示：因为微信的字数限制，更多内容无法输出"; 
                       }
                       log("---------------DONE--------------------");
                       // responseToUserByCS(app, talkUserOpenId, segment, returnType); 
                       segment = "";
                   }
                   
                   eventEmitter.emit('parserFinished');          
               }
            }finally{
                release(); // 释放互斥锁
            }
        };
        // 等待传递完所有数据
        await new Promise<void>(resolve => {
            eventEmitter.once('parserFinished', () => {
                log('AI生成的结果异步传输完毕');
                resolve();
            });
        });         

        log("current.content:" + current.content);
        return current.content;
      }

      return "智能对话发生意外失败，请稍后重试";
      
    }catch(e){
        error("wechat service调用AI服务发生意外失败\n" + e);
        return "对话发生意外失败，请稍后重试";
    }
}



async function genInvitationQRCode(app:Application, userId:string){
    const token = await getAccessToken(app);
    const result = await fetch(
        "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" + token,                    
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body:JSON.stringify({
                "expire_seconds":604800,
                "action_name":"QR_STR_SCENE",
                "action_info": {
                    "scene": {
                        "scene_str": userId,
                    }
                }
            }),
                                   
         });
    if(result.status == 200){
        const ret = await result.json();
        const qrCodeUrl = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + ret.ticket;
        log("QR Code URL:" + qrCodeUrl);    
        return qrCodeUrl;
    }else{
        error("QR Code Gen Failed");
        return "";
    }
}


async function signInByWechat(app:Application, userOpenId:string, inviteBy?:string){
    const unionid = await getUnionID(app, userOpenId);
   
    if(unionid){
        // Get user from DB
        const user = await prisma.user.findUnique({
          where: {
              email: unionid,
          },
        });
   
        if(!user){  
            const result = await fetch(process.env.WEBSITE_URL + "/api/signInWechat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ openid:userOpenId, unionid:unionid, signInType: "INSIDE", inviteBy }),
            });
        }
    }

}

async function recordInvitation(app:Application, userOpenId:string, inviteCode:string){
    const unionid = await getUnionID(app, userOpenId);
    
    if(unionid){
        // Get user from DB
        const user = await prisma.user.findUnique({
          where: {
              email: unionid,
          },
        });
        if(user){
            await inviteUser(user.id, inviteCode);
        }
    }  
}
