import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import nodefetch from "node-fetch";
import fs from 'fs';
import stream from "stream";
import FormData from "form-data";
import request from "request";
import path from 'path';
import { Model, User, Application } from "@prisma/client";
import { Request } from 'express';
import EventSource from 'eventsource';
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
import {BaseTTS} from "../../ai/tts/BaseTTS";
import {XunFeiTTS} from '../../ai/tts/XunFeiTTS';
import {TencentTTS} from '../../ai/tts/TencentTTS';
import * as AIS from "../../ai/AIService";

import { Readable } from "stream";
import { config } from "../../utils/config";
import { Mutex } from 'async-mutex';
import { inviteUser } from "./createuser";
import { filterWords } from "../../utils/sensitiveWords";
import {BaseCVService} from "../../ai/cv/BaseCVService";
import {LLMs} from "../../ai/AIServiceList";
import { getAppUserConfigValue } from "./appUserConfig";
import * as fileServer  from "../../utils/fileServer";
import ffmpeg from 'fluent-ffmpeg';
import * as tencentcloud from "tencentcloud-sdk-nodejs";
import {translate} from "../../utils/localTranslate";
import { v4 as uuidv4 } from "uuid"; // 导入 v4 方法
import {getSpeakerByCode} from "../../utils/speakers";



const drawRatioUrl = process.env.WEBSITE_URL + "/api/appUserConfig?cmd=UPDATE&key=DRAW_RATIO&value=";
const drawRatioMenu = {
    head_content: "请选择生成图片的横纵比：\n",
    list: [
        {id: "1000169", content: "16:9 适合电脑\n"},
        {id: "100011", content: "1:1 适合画框\n"},
        {id: "1000916", content: "9:16 适合手机/PAD\n"}
        ],
    tail_content: "后面将会都按照您选择比例生成图片！"
};

const responseMethodUrl = process.env.WEBSITE_URL + "/api/appUserConfig?cmd=UPDATE&key=RESPONSE_METHOD&value=";
const responseMethodMenu = {
    head_content: "请选择AI和您对答的方式：\n",
    list: [
        {id: "10091", content: "1.用户发文字时，AI用文字回答；用户发语音，AI也用语音\n"},
        {id: "10092", content: "2.用户发文字或语音时，AI都用文字回答\n"},
        {id: "10093", content: "3.用户发文字或语音时，AI都用语音回答\n"}
        ],
    tail_content: "后续的问答都将按照您的设定来互动！"
};

const baseLLM = process.env.WEBSITE_URL + "/api/appUserConfig?cmd=UPDATE&key=BASE_LLM&value=";
const baseLLMMenu = {
    head_content: "请选择基座语言大模型：\n",
    list: [
        {id: "10081", content: "1.chatGPT 3.5，1个提子/千字\n"},
        ],
    tail_content: "后续的问答都将使用您设定的语言模型！"
};
baseLLMMenu.list.length = 0;
for(const m of LLMs){
    baseLLMMenu.list.push(
        {
            id: m.code,
            content: m.name
        }
    );
}

export const modelQuestionMenu = {
    head_content: "这里有一些常见的问题：\n",
    list: [
        {id: "10011", content: "1.这本书主要讲了哪些内容？\n"},
        {id: "10012", content: "2.我能从书中学习到哪些知识？\n"},
        {id: "10013", content: "3.问哪些问题可以更好了解该书？\n"}
        
        ],
    tail_content: "当然，你可以在下面输入更多你关心的问题。"
};

export const modelQuestionMenu2 = {
    head_content: "你可能还会问：\n",
    list: [
        {id: "10021", content: "1.我想深入了解上述的内容，我该问哪些问题？\n"},
        {id: "10022", content: "2.我对这本书非常感兴趣，书里有哪些有趣的故事吗？\n"}
        ],
    tail_content: "或者，你有什么更有趣的问题吗？请在下方输入框中告诉我吧！"
};

export const modelQuestionMenu3 = {
    head_content: "你是否想要：\n",
    list: [
        {id: "10031", content: "1.给出上述内容的更多相关案例。\n"},
        {id: "10032", content: "2.详细深入阐述上述内容的更多细节。\n"},
        {id: "10033", content: "3.简明扼要的总结出上述内容的核心观点列表。\n"},
        {id: "10034", content: "4.针对上述内容，我该问哪些问题来了解更多？\n"}
        ],
    tail_content: "或者，你有什么更有趣的问题吗？请在下方输入框中告诉我吧！"
};


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{
        const {appId} = req.query;

        const app = appId ? await getApp(appId as string) : null;

        if(!app || app.type!="WechatService"){
            log("应用配置错误");
            return res.status(400).send("应用配置错误");
        }else{
            log("进入应用" + app.name);
        }
        
        if(req.method == "GET"){
            if(checkSignature(app, req)){
                log("签名验证成功");
                const {echostr} = req.query;
                createWechatServiceMenu(app);
                return res.status(200).send(echostr);
            }else{
                log("签名验证失败");
                return res.status(400).send("错误的签名");
            }
        }else{
            log("开始微信AI对话");
            const xmlParser = bodyParser.text({ type: 'application/xml' });
            res.setHeader('Content-Type', 'application/xml');

            xmlParser(req, res, async() => {
                
                // 这里的`req.body`就是POST传入的XML数据
                // 你可以根据自己的需求对XML数据进行操作和处理
                log(req.body);
                log(xmlToJson(req.body));
                // ...
                // @ts-ignore                       
                const input = xmlToJson(req.body).xml;
                if(input){
                    log("input corret");
                    const { ToUserName, FromUserName, CreateTime, MsgType, Content, MsgId, MsgDataId, Idx, MediaId, Format, Recognition, Event, EventKey, PicUrl, bizmsgmenuid, Url } = input;

                    if(MsgType=="event"){
                        let msg = "";
                        switch(Event){
                            case "subscribe": {
                                let article = getAppConfig(app, "APP_WELCOME_ARTICLE");
                                if(article){
                                    await responseToUserByCS(app, FromUserName, article, "article");
                                }                                

                                msg = getAppConfig(app, "APP_WELCOME_MSG");
                                if(msg){
                                    await responseToUserByCS(app, FromUserName, msg);  
                                    // responseToUserByCS(app, FromUserName, msg, "voice");
                                }
                                
                                // if(app.settlement == "C2A2B"){ // 不管何种模式都默认登录系统注册用户
                                // 当前用户用微信号登录
                                let user:any;
                                if(EventKey && (typeof EventKey === "string")){
                                    // 说明是扫描带参数二维码关注的                                           
                                    log("EventKey:" + EventKey);
                                    const shareId = EventKey.substring("qrscene_".length);
                                    const share = await prisma.shareQR.findUnique({
                                        where:{
                                            id: shareId
                                        }
                                    });
                                    if(share){
                                        await signInByWechat(app, FromUserName, share.userId);   // 微信注册，并记录邀请关系                                        
                                        const inviteUserChatModelId = JSON.parse(share.message).modelId;
                                        user =  await getUserByOpenId(app, FromUserName);
                                        if(user && inviteUserChatModelId){
                                            // 把当前用户模型设置为邀请用户的模型
                                            let url = config.website + "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&key=CHAT_MODEL_ID&value=" + inviteUserChatModelId;    
                                            const result = await callAPI(app, user, url);
                                        }
                                    }else{
                                        user = await getUserByOpenId(app, FromUserName);     
                                        if(user){
                                            const loginToken = EventKey.substring("qrscene_".length);
                                            await prisma.user.update({
                                                where: {
                                                    id: user.id
                                                },
                                                data:{
                                                    emailVerified: new Date(parseInt(loginToken))
                                                }
                                            });
                                        }
                                    }
                                }else{
                                    user = await signInByWechat(app, FromUserName);                            
                                }                                

                                // 如果显示邀请二维码
                                if(user){
                                    const sendInviteQR = getAppConfig(app, "APP_SEND_INVITE_QR");
                                    if(sendInviteQR === "TRUE"){
                                        let inviteMsg = "奖励计划：您邀请每一位新用户关注公众号，在他首次使用时，您将会额外获得" +config.inviteBonus+ "个" +config.creditName+ "的奖励！";
                                        if(config.ICR >= 0.01){
                                            inviteMsg += `并且会按照您邀请的新用户充值${config.creditName}的${Math.round(config.ICR*100)}%给您返佣奖励。`;
                                        }
                                        inviteMsg += "邀请的方法是把下面的二维码转发给您的朋友，请他关注我们的公众号。"
    
                                        await responseToUserByCS(app, FromUserName, inviteMsg);                                    
                                        
                                        const QRCode = await genInvitationQRCode(app, user.id, {shareType:"SHARE_USER"});
                                        responseToUserByCS(app, FromUserName, QRCode, "image");
                                    }
                                }                                
                                break;
                            }

                            case "SCAN": {
                                log("handling QR scan.....");
                                const share = await prisma.shareQR.findUnique({
                                    where:{
                                        id: EventKey
                                    }
                                }); 
                                log("SCAN: share", share);
                                if(share){
                                    const inviteUserChatModelId = JSON.parse(share.message).modelId;
                                    const user =  await getUserByOpenId(app, FromUserName);                               
                                    if(user && inviteUserChatModelId){
                                        // 把当前用户模型设置为邀请用户的模型
                                        let url = config.website + "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&key=CHAT_MODEL_ID&value=" + inviteUserChatModelId;        
                                        const result = await callAPI(app, user, url);
                                    }
                                }else{
                                    const user = await getUserByOpenId(app, FromUserName);     
                                    log("SCAN: user", user, FromUserName);
                                    if(user){
                                        const loginToken = EventKey;
                                        await prisma.user.update({
                                            where: {
                                                id: user.id
                                            },
                                            data:{
                                                emailVerified: new Date(parseInt(loginToken))
                                            }
                                        });
                                    }
                                }
                                break;
                            }
                                
                            case "CLICK": {
                                // 这里要防止用户点击过快
                                try{
                                    log("-------------------这里要防止用户点击过快------------------------");
                                    const key = FromUserName + "_CLICK_TIMESTAMPT";
                                    log("Key:" + key);
                                    const lastTime = await globalGet("WECHAT_SERVICE", key);
                                    log("lastTime:" + lastTime);
                                    const now = (new Date()).getTime();
                                    log("now:" + now);
                                    await globalSet("WECHAT_SERVICE", key, now.toString()); // 无论什么情况都更新时间戳                                    
                                    if(lastTime && (now - parseInt(lastTime) < 5000) ){
                                        log("trig the prevention");
                                        return;
                                    } // 点击间隔必须小于5秒
                                    log("###################这里要防止用户点击过快########################");
                                    
                                }catch(e){
                                    error("防止用户点击过快的程序发生错误，请尽快修正！");
                                    error(e);
                                }
                                
                                const user =  await getUserByOpenId(app, FromUserName);
                                if(user){
                                    if(EventKey == "DRAW_RATIO_MENU"){
                                        responseToUserByCS(app, FromUserName, JSON.stringify(drawRatioMenu), "msgmenu");

                                    }else if(EventKey == "RESPONSE_METHOD_MENU"){
                                        responseToUserByCS(app, FromUserName, JSON.stringify(responseMethodMenu), "msgmenu");   
                                        
                                    }else if(EventKey == "SHARE_CHAT_MODEL"){
                                        responseToUserByCS(app, FromUserName, "您可以把下面包含二维码的图片转发给您的朋友，请他扫描二维码打开公众号。每邀请一位朋友，在他首次使用时，您会得到" + 
                                                          config.inviteBonus + "个" + config.creditName + "的奖励。");
                                        const currentUserChatModelId = await getAppUserConfig(app, user.id, "CHAT_MODEL_ID");
                                        log("currentUserChatModelId:" + currentUserChatModelId);
                                        const QRCode = await genInvitationQRCode(app, user.id, {modelId:currentUserChatModelId, shareType:"SHARE_MODEL"});
                                        log("QRCode image in weichat:" + QRCode);
                                        
                                        if(QRCode){
                                            if(currentUserChatModelId){
                                                const m = await prisma.model.findUnique({
                                                    where: {
                                                        id : currentUserChatModelId
                                                    }
                                                });
    
                                                if(m && m.coverImg){
                                                    log("model coverImg:" + m.coverImg);
                                                    const qrFile = await fileServer.uploadQRCode(m.coverImg, QRCode);
                                                    log(qrFile);
                                                    if(qrFile){
                                                        const compoImg = fileServer.getImageURL(m.coverImg, true, qrFile.filePath, 200, "bottom-right");
                                                        log("COMPO IMG: " + compoImg);
                                                        responseToUserByCS(app, FromUserName, compoImg, "image").then(() => { 
                                                            fileServer.deleteFiles([qrFile]);
                                                        });
                                                    }
                                                }else{
                                                    responseToUserByCS(app, FromUserName, QRCode, "image");
                                                }
                                            }else{
                                                responseToUserByCS(app, FromUserName, QRCode, "image");
                                            }

                                        }

                                    }else if(EventKey == "USER_SHARE_QR"){
                                        // 显示邀请二维码
                                        let inviteMsg = "奖励计划：您邀请每一位新用户关注公众号，在他首次使用时，您将会额外获得" +config.inviteBonus+ "个" +config.creditName+ "的奖励！";
                                        if(config.ICR >= 0.01){
                                            inviteMsg += `并且会按照您邀请的新用户充值${config.creditName}的${Math.round(config.ICR*100)}%给您返佣奖励。`;
                                        }
                                        inviteMsg += "邀请的方法是把下面的二维码转发给您的朋友，请他关注我们的公众号。"
    
                                        await responseToUserByCS(app, FromUserName, inviteMsg);                                    
                                        
                                        const QRCode = await genInvitationQRCode(app, user.id, {shareType:"SHARE_USER"});
                                        responseToUserByCS(app, FromUserName, QRCode, "image");
                                        
                                    }else if(EventKey == "USER_INFORMATION"){
                                        const shareUsers = await prisma.user.findMany({
                                            where: {
                                                invitedbycode: user.id
                                            },
                                            select: {
                                                id: true
                                            }
                                        });
                                        if(shareUsers && shareUsers.length>0){
                                            responseToUserByCS(app, FromUserName, "您已经邀请了" + shareUsers.length + "个用户，感谢您的支持");
                                        }else{
                                            responseToUserByCS(app, FromUserName, "您还没有邀请任何朋友");                                            
                                        }
                                        
                                    }else{
                                        const result = await callAPI(app, user, EventKey);
                                        if(result){
                                            responseToUserByCS(app, FromUserName, result);  
                                        }   
                                    }
                                }
                                break;
                            }

                            case "VIEW": {
                                // 因为微信内打开的页面无法获得当前用户的openid，所以这里先把openid存储起来
                                if(FromUserName){
                                    const user =  await getUserByOpenId(app, FromUserName);
                                    if(user){
                                        const result = await callAPI(app, user, config.website + "/api/appUserConfig?cmd=UPDATE&key=FROM_USER_OPEN_ID&value=" + FromUserName);
                                    }
                                }
                            }
                                
                        }   
                    }else if(MsgType=="text"){
                        if(Content){
                            if(bizmsgmenuid){
                                const menuid = bizmsgmenuid.toString();
                                
                                if(menuid.startsWith("1001")){
                                    // 模型问题一级菜单
                                    setTypingStatus(app, FromUserName);  
                             
                                    const newContent = Content.substring(2) + "\n 请用1.2.3...开头尽量简洁的列出一些条目，总长度不超过一千字。";                                    
                                    sendMessage(app, FromUserName, newContent).then((result) => {
                                        //if(result.count <= 4){
                                        //    responseToUserByCS(app, FromUserName, JSON.stringify(modelQuestionMenu2), "msgmenu");
                                        //}
                                    });
                                    
                                }else if(menuid.startsWith("1002")){
                                    // 模型问题二级菜单
                                    setTypingStatus(app, FromUserName);                                        
                                    const newContent = Content.substring(2) + "\n 请用1.2.3...开头尽量多列一些条目，总长度不超过一千字。";                                                                        
                                    sendMessage(app, FromUserName, newContent).then((result) => {
                                        //if(result.count <= 4){
                                        //    responseToUserByCS(app, FromUserName, JSON.stringify(modelQuestionMenu3), "msgmenu");
                                        //}
                                    });
                                    
                                }else if(menuid.startsWith("1003")){
                                    // 模型问题三级菜单
                                    setTypingStatus(app, FromUserName);                             
                                    const newContent = Content.substring(2) + "\n 请尽量详细的阐述，总长度不超过一千字。";                                    
                                    sendMessage(app, FromUserName, newContent).then((result) => {
                                        //if(result.count <= 4){
                                        //    responseToUserByCS(app, FromUserName, JSON.stringify(modelQuestionMenu3), "msgmenu");
                                        //}
                                    });
                                    
                                }else if(menuid.startsWith("2000")){
                                    // 模型问题动态菜单
                                    setTypingStatus(app, FromUserName);                                    
                                    let selection = await globalGet("WECHAT_SERVICE", FromUserName + "|" + menuid); // 用户实际的选择                                                        
                                    let userSelectContent = Content;
                                    if(selection){
                                        userSelectContent = selection.split("|").pop();
                                    }
                                    sendMessage(app, FromUserName, "请用一千字以内详细说说：" + userSelectContent).then((result) => {
                                        //if(result.count <= 4){
                                        //    responseToUserByCS(app, FromUserName, JSON.stringify(modelQuestionMenu3), "msgmenu");
                                        //}
                                    });
                                }else if(menuid.startsWith("1000")){
                                    // 设置图片比例
                                    const id = menuid.substring(4);
                                    const user =  await getUserByOpenId(app, FromUserName);
                                    if(user){
                                        const result = await callAPI(app, user, drawRatioUrl + id);
                                        if(result){
                                            responseToUserByCS(app, FromUserName, result);
                                        }else{
                                            responseToUserByCS(app, FromUserName, "设置失败！");
                                        }
                                    }
                                }else if(menuid.startsWith("1009")){
                                    // 设置图片比例
                                    const id = menuid.substring(4);
                                    const user =  await getUserByOpenId(app, FromUserName);
                                    if(user){
                                        const result = await callAPI(app, user, responseMethodUrl + id);
                                        if(result){
                                            responseToUserByCS(app, FromUserName, result);
                                        }else{
                                            responseToUserByCS(app, FromUserName, "设置失败！");
                                        }
                                    }
                                }else{
                                    setTypingStatus(app, FromUserName);                             
                                    sendMessage(app, FromUserName, Content);
                                }
                            }else{
                                const chatWithAI = getAppConfig(app, "APP_CHAT_WITH_AI");
                                if(chatWithAI == "TRUE"){
                                    setTypingStatus(app, FromUserName);
                                    const retMsgType =  await getReturnMsgType(app, FromUserName, MsgType);
                                    chatWithUser(app, FromUserName, Content, retMsgType);
                                }
                            }
                        }
                    }else if(MsgType=="voice"){
                        setTypingStatus(app, FromUserName);
                        const retMsgType =  await getReturnMsgType(app, FromUserName, MsgType);                            
                           
                        if(Recognition && (typeof Recognition === "string") ){
                            chatWithUser(app, FromUserName, Recognition, retMsgType);
                        }else{
                            voiceToText(app, MediaId, Format).then((txt) => {
                                if(txt){
                                    chatWithUser(app, FromUserName, txt, retMsgType);
                                }else{
                                    responseToUserByCS(app, FromUserName, "很抱歉，我暂时还不能识别这个语音消息，请发送文字信息试试吧。我们会一直进步的哦！");                              
                                }
                            });                            
                            
                        }
                    }else if(MsgType=="image"){
                        setTypingStatus(app, FromUserName);
                        sendMessage(app, FromUserName, PicUrl, "image", "image");
                        
                    }else if(MsgType=="video"){
                        responseToUserByCS(app, FromUserName, "我暂时还不能识别视频消息，请给我发送文字、语音和图片试试吧！");                      
                    }else if(MsgType=="shortvideo"){
                        responseToUserByCS(app, FromUserName, "我暂时还不能识别短视频消息，请给我发送文字、语音和图片试试吧！");                      
                    }else if(MsgType=="location"){
                        responseToUserByCS(app, FromUserName, "好啦，我记住你的位置啦！以后的对话都将假设你在这个位置。");                      
                    }else if(MsgType=="link"){
                        //responseToUserByCS(app, FromUserName, "我暂时还不能识别链接消息，请给我发送文字、语音和图片试试吧！");                      
                        responseToUserByCS(app, FromUserName, "链接地址：" + Url);                                              
                    }else{
                        responseToUserByCS(app, FromUserName, "msgType:" + MsgType + "\n Content:" + Content);                      
                    }

                        
                    return res.status(200).send("success");
                    
                }else{
                    return res.status(400).send("错误的请求！");
                }
            });
        }
    } catch (e) {
        error("wechat service exception:\n" + e);
        res.status(500).send( "wechat service exception" );
    }
}

/*
        const mediaTrigers = ["介绍", "详情", "怎么样", "什么样子", "照片", "图片"];
        let searchWord = result.content;
        let findTrigger = false; // 有triger就用提问来搜索，没有就用回答的内容来搜索
        if(userContent){
            for(const t of mediaTrigers){
                if(userContent.indexOf(t) >= 0){
                    findTrigger = true;
                    searchWord = Content;
                    break;
                }
            }
        }
*/
async function chatWithUser(app:Application & { user: User }, FromUserName:string, userContent:string, retMsgType:string){
    sendMessage(app, FromUserName, userContent, retMsgType).then((textRsult)=>{
        let msgCount = textRsult.count;
        let aiResponse = textRsult.content;
            
        if( msgCount < 5 && getAppConfig(app, "CHAT_MEDIA_MODEL_ID") && retMsgType=="text"){
            // 以用户输入信息请求媒体信息反馈
            sendMessage(app, FromUserName, "#MEDIA#CHAT#" + userContent, "image", "text", 5-msgCount).then((mediaResult)=>{
                msgCount += mediaResult.count;
                if( msgCount < 5 && mediaResult.count==0 ){
                    // 以AI返回信息请求媒体信息反馈
                    sendMessage(app, FromUserName, "#MEDIA#CHAT#" + aiResponse, "image", "text", 5-msgCount);
                }
            });
        }
    });
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


export async function getApp(appId: string){
  return await prisma.application.findUnique({
    where: {
      id: appId,
    },
    include: {
      user: true,
    },
  });
}

export function getAppConfig(app:Application, key:string){
    if(app && key){
      const config = JSON.parse(app.config);
      return config[key];
    }
    return "";
}

export async function getAppUserConfig(app:Application, user:User|string, key:string){
    let userId = "";
    if(typeof user == "object"){
        userId = user.id;
    }else{
        userId = user;
    }

    return await getAppUserConfigValue(app.id, userId, key);
}

export async function getReturnMsgType(app:Application, FromUserName:string, inputType:string){
    const user = await getUserByOpenId(app, FromUserName);
    if(user && (inputType=="text" || inputType=="voice")){
        const method = await getAppUserConfig(app, user.id, "RESPONSE_METHOD");
    
        switch(method){
            case "1":
                return inputType;
            case "2":
                return "text";
            case "3":
                return "voice";
            default:
                return inputType;           
        }
    }
    return "text";
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

export async function getDownloadUrl(access_token:string, media_id:string) {
    const url = `https://api.weixin.qq.com/cgi-bin/media/get?access_token=${access_token}&media_id=${media_id}`;

    return url;
/*    
    const response = await nodefetch(url);
    log("response:" + JSON.stringify(response));
    
    if (!response.ok) {
        throw new Error('获取临时素材下载链接失败');
    }
    
    const result = await response.json();
    log("getDownloadUrl.result:" + JSON.stringify(result));
    return result.down_url;
    */
}


export async function uploadMedia(access_token:string, filePath:string, type:string="voice") {
    const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${access_token}&type=${type}`;
    let result = "";
    const formData = {
        media: fs.createReadStream(filePath)
    };

    const eventEmitter = new EventEmitter();
    request.post({url, formData}, async (err, httpResponse, body) => {
        if (err) {
            error('上传文件失败：' + err);
            eventEmitter.emit('uploadFinished');                        
        } else {
            log('上传文件成功：' + body);
            const ret = JSON.parse(body);
            result = ret.media_id;
            eventEmitter.emit('uploadFinished');            
        }
    });    

    // 等待传递完所有数据
    await new Promise<void>(resolve => {
        eventEmitter.once('uploadFinished', () => {
            log('amr2mp3转换完毕');
            resolve();
        });
    });    
    
    return result;
}

function deleteLocalFile(filePath:string) {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.log('删除本地文件失败:', err);
        } else {
            console.log('本地文件删除成功');
        }
    });
}

export async function amr2mp3(app:Application, voice_id:string){
    const token = await getAccessToken(app);
    const now = new Date().getTime().toString();
    
    // 把临时素材下载到本地
    let downloadUrl = await getDownloadUrl(token!, voice_id);
    log("downloadUrl:" + downloadUrl);
    
    const amrData = await nodefetch(downloadUrl);

    if(amrData && token){
        const amrPath = "./tmp/download/voices/amr" + now + ".amr";
        const amr = fs.createWriteStream(amrPath);
        await new Promise((resolve, reject) => {
            amrData.body!.pipe(amr);
            amrData.body!.on("error", reject);
            amr.on("finish", resolve);
        });        
        
        // 把本地amr抓换为本地MP3
        const mp3Path = "./tmp/download/voices/mp3" + now + ".mp3";
        let converted = false;
        
        const eventEmitter = new EventEmitter();
        await ffmpeg(amrPath).output(mp3Path)
            .on('end', ()=> {
                log("amr 2 mp3 completed");
                converted = true;
                eventEmitter.emit('convertFinished');            
            })
            .on('error', (err)=>{
                error("amr 2 mp3 error");
                error(err);
                eventEmitter.emit('convertFinished');            
            })
            .run();
        
        // 等待传递完所有数据
        await new Promise<void>(resolve => {
            eventEmitter.once('convertFinished', () => {
                log('amr2mp3转换完毕');
                resolve();
            });
        });  
        
        // 把mp3上传成临时素材
        // 把voice_id换成新临时素材的id
        if(converted){
            voice_id = await uploadMedia(token, mp3Path, "voice");
            log("上传的voice_id:" + voice_id);
        }
    
        // 删除本地临时文件
        try{
            deleteLocalFile(amrPath);
            deleteLocalFile(mp3Path);
        }catch(e){
            error("delete local file error");
            error(e);
        }
    }

    return voice_id;
}

export async function downloadSpeech(access_token:string, media_id:string) {
    const url = `https://api.weixin.qq.com/cgi-bin/media/get/jssdk?access_token=${access_token}&media_id=${media_id}`;
    const now = new Date().getTime().toString();
    const speechData = await nodefetch(url);

    if(speechData){
        const speechPath = "./tmp/download/voices/speex" + now + ".speex";
        const speech = fs.createWriteStream(speechPath);
        await new Promise((resolve, reject) => {
            speechData.body!.pipe(speech);
            speechData.body!.on("error", reject);
            speech.on("finish", resolve);
        });   
        return speechPath;
    }
    
    return "";
}


// 科大讯飞的语音识别服务。需要多个步骤
// 1. 把语音文件下载
// 2. 把语音文件转成mp3
// 3. 把语音文件上传临时素材
// 4. 再次把语音文件下载成speex格式
// 5. 用讯飞识别结果
export async function xunfeiVoiceToText(app:Application, voice_id:string, format:string){
    const token = await getAccessToken(app);
    log("format:" + format);
    log("voice_id:" + voice_id);

    // amr格式需要转换成mp3格式
    if(format == "amr"){
        log("原始voice_id:" + voice_id);
        voice_id = await amr2mp3(app, voice_id);
        log("MP3 voice_id:" + voice_id);        
        format = "mp3";
    }
    
    const voiceFile = await downloadSpeech(token!, voice_id);
    let text = "";
    const speex_sizes = [60, 10, 15, 20, 25, 32, 42, 52, 70, 86, 106];

    for(const speex_size of speex_sizes){
        const ais = new XunFeiTTS();        
        text = await ais.voiceToText(voiceFile, 'speex-wb', speex_size);    
        log("speex_size:" + speex_size);
        log("result:" + text);
        if(text){
            log("correct speex_size:" + speex_size);
            break;
        }
    }
    // deleteLocalFile(voiceFile);

    return text;
}



// 调用了新的腾讯和讯飞云语音识别服务
export async function voiceToText(app:Application, voice_id:string, format:string){
    const token = await getAccessToken(app);
    const voiceUrl = await getDownloadUrl(token!, voice_id);
    const ais = new TencentTTS();
    const vData = await ais.voiceToText(voiceUrl, format);

    if(vData){
        return vData;
    }else{
        return await xunfeiVoiceToText(app, voice_id, format);    
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


export async function responseToUserByCS(app:Application, toUserId: string, content:string, type:string="text", watermark?:string){
    const token = await getAccessToken(app);
    let body = null;
    log("responseToUserByCS.content:" + content);
    log("responseToUserByCS.type:" + type);
  
    if(content && toUserId){

        if(type == "article"){
            body = {
                "touser":toUserId,
                "msgtype": "mpnews", // "mpnewsarticle",
                "mpnews": {
                    "media_id": content
                }
            };
            
        }else if(type == "video"){
            // type video: { "media_id", "thumb_media_id", "title", "description"};
            body = {
                "touser": toUserId,
                "msgtype":"video",       
                "video" : JSON.parse(content)!
            };

        }else if(type == "msgmenu"){
            
            body = {
                "touser": toUserId,
                "msgtype":"msgmenu",       
                "msgmenu" : JSON.parse(content)
            };
            
        }else if(type == "text"){

            const originalContent = content;

            // 把列表转化成超链
            const lines = content.split("\n");
            content = "";
            
            let menu_count = await globalGet("WECHAT_SERVICE", toUserId + "MENU_COUNT");
            let num = menu_count ? parseInt(menu_count) : 200001;
            const regex = /^(?:[1-9]\d*\.|一、|二、|三、|四、|五、|六、|七、|八、|九、|十、|第一|第二|第三|第四|第五|第六|第七|第八|第九|第十|首先，|同时，|此外，|再次，|其次，|最后，|此外，|总之，|[a-zA-Z]\.|-)/;
            for(const line of lines){
                if(regex.test(line.trim())){
                    await globalSet("WECHAT_SERVICE", toUserId + "|" + num.toString(), line);                                                         
                    content += '<a href="weixin://bizmsgmenu?msgmenucontent=' + encodeURIComponent(line.substring(0,5)+"...") + '&msgmenuid=' + num + '">' 
                    + line + '</a>';
                    num = (num >= 200099) ? 200001 : (num+1);
                }else{
                    content += line;
                }
                content += "\n";
            }
            await globalSet("WECHAT_SERVICE", toUserId + "MENU_COUNT", num.toString());
            
            body = {
                    "touser": toUserId,
                    "msgtype":"text",
                    "text": {
                        "content": filterWords( content.length>=1100 ? originalContent : content ), // 超过微信字数限制就只返回原数据
                    },
                };
            
        }else if(type == "voice"){

            content = filterWords(content);
            const user =  await getUserByOpenId(app, toUserId);
            let speakerCode = (user && user.id) ? await getAppUserConfig(app, user.id, "TTS_SPEAKER") : null;
            if(!speakerCode){
                speakerCode = await getAppConfig(app, "XUNFEI_T2V_SPEAKER");
            }
            
            var vData:any;
            if(speakerCode){
                log("SPEAKER CODE:" + speakerCode);
                const speaker = getSpeakerByCode(speakerCode);
                if(speaker){
                    log("SPEAKER:" + JSON.stringify(speaker));                    
                    if(speaker.language != "zh"){
                        content = await translate(content, "zh", speaker.language);
                    }
                    vData = await AIS.textToVoice(content, speaker.code, speaker.aiservice);
                }
            }
              

            if(vData){
                const localPath = path.join("./tmp/download/", "voices", (new Date().getTime()).toString()+".mp3");
                let audioBuf = Buffer.from(vData, 'base64');

                await fs.writeFileSync(localPath, audioBuf);

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
                                     return 0;
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
                        "content": content,
                    },
                };                
            }
        }else if(type == "image"){
            // 先把图片下载到本地
            log("content:" + content);
            if(watermark){
                content = fileServer.getImageURL(content, true, watermark);
            }
            
            const resDownload = await fetch(content);
            const ext = fileServer.getExt(content);
            log("ext:" + ext);
            const fileName = `${(new Date().getTime()).toString()}.${ext||"png"}`;
            log("fileName:" + fileName);
            const localPath = path.join("./tmp/download/", "images", fileName!);

            if(resDownload.ok){
                log(`${content} has been downloaded to ${localPath}`);
                const imageData = Buffer.from(await resDownload.arrayBuffer());
                await fs.writeFileSync(localPath, imageData);
                
                // 把图片上传到公众号
                const wemediaPath = "https://api.weixin.qq.com/cgi-bin/media/upload?access_token=" + token + "&type=image";
                const formData = {
                    "media" : fs.createReadStream(localPath)                  
                };
                const eventEmitter = new EventEmitter();

                log(`${localPath} is ready to upload through: ${wemediaPath}`);
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
            }else{
                error(`图片传输失败:${localPath}|${content}`);
            }                     
        }
        if(body){
            log("客服发出消息类型：" + "\n" + "type:" + type + "\n" + "body:" + JSON.stringify(body));
            
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

            return 1;
        }else{
            error("发送客服消息失败: 没有任何消息内容");
        }
    }
  
    return 0;
  
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


async function sendMessage(app:Application & { user: User }, openid:string, userMsg:string, returnType:string="text", inputType:string="text", maxOutput:number=5){

    let prompt = userMsg.trim();
    let result = {
        count: 0, // 返回已经发送了多少条消息 -1表示sendMessage执行失败
        content: ""
    }
    
    if(!prompt || prompt.length<1){
        await responseToUserByCS(app, openid, "请先输入想问我的内容吧！");
        return result;
    }
    if(prompt.length>2000){
        await responseToUserByCS(app, openid, "每次输入的内容不能大于2000个字符，请简化一下你的问题吧！");
        return result;
    }    
    
    let loginUser:User|null = null;
    let loginUserUnionId = "";
    let loginUserOpenId = "";

    let talkUserOpenId = openid;
    let talkUser:User|null = await getUserByOpenId(app, openid);
    if(!talkUser){
        await responseToUserByCS(app, talkUserOpenId, "请先在公众号菜单里完成用户授权登录，然后再开始对话。或者点击链接： " + process.env.WEBSITE_URL + "/loginChoice");
        return result;
    }
    let talkUserUnionId = talkUser.email!;

    // B2A结算模式，所有费用算在APP创建者
    if(app.settlement == "B2A"){
        loginUserOpenId = app.user.weixinId!;  
        loginUserUnionId = app.user.email!;
        loginUser = app.user!;
    }else{ 
        loginUser = talkUser;
        loginUserUnionId = talkUserUnionId;
        loginUserOpenId = talkUserOpenId;
    }

    const drawPrefix = await getAppConfig(app, "DRAW_PREFIX"); 
    const isMediaMatch = prompt.startsWith("#MEDIA#CHAT#");
    const isDraw = (await getAppUserConfig(app, talkUser, "INTERACTION_MODE")) === "DRAW" ? 
        !isMediaMatch : 
        (drawPrefix ? 
             (drawPrefix=="ANY" ? 
                  !isMediaMatch : 
                  prompt.startsWith(drawPrefix)
             ) 
             : prompt.startsWith("画"));
        
    // 所找本次对话的角色模型，校验一下是否存在
    let chatModelId = null;
    let chatModel = null;
    
    if(isMediaMatch){
        chatModelId = await getAppUserConfig(app, talkUser, "CHAT_MEDIA_MODEL_ID");
        if(!chatModelId){
            chatModelId = getAppConfig(app, "CHAT_MEDIA_MODEL_ID");
        }
        // 没有媒体模型就不再处理
        if(!chatModelId){
            return result;
        }
    }
    
    if(!chatModelId){
        chatModelId = await getAppUserConfig(app, talkUser, "CHAT_MODEL_ID"); 
        if(!chatModelId){
            chatModelId = app.modelId;
        }
    }

    if(chatModelId){
        chatModel = await prisma.model.findUnique({
            where: {
                id: chatModelId,
            },
        });

        if(!chatModel && inputType=="text"){
            return result;
        }
        
    }else{
        if(inputType=="text"){
            return result;
        }
    }

        
    
    // 配置语言和绘图模型
    let drawMethod = await getAppUserConfig(app, talkUser, "DRAW_METHOD"); 
    if(!drawMethod){
        drawMethod = "LARGE_MODEL";
    }
    let drawModel = await getAppUserConfig(app, talkUser, "TEXT2IMG_MODEL");    
    if(!drawModel){
        drawModel = await getAppConfig(app, "TEXT2IMG_MODEL");
    }
    let drawRatio = await getAppUserConfig(app, talkUser, "DRAW_RATIO");    
    if(!drawRatio){
        drawRatio = "916";
    }
    let imgModel = await getAppUserConfig(app, talkUser, "IMG2IMG_MODEL");    
    if(!imgModel){
        imgModel = "flux-schnell";
    }
    let watermark = undefined;
    if(talkUser.boughtCredits <= 0){ // 付费用户不打水印 
        watermark = await getAppUserConfig(app, talkUser, "IMAGE_WATERMARK"); 
        if(!watermark){
            watermark = getAppConfig(app, "IMAGE_WATERMARK");
        }            
    }
    
    if(inputType == "image" && userMsg && chatModel && chatModel.imgRecogHint){
        try{
            // 识别当前图片的内容
            const cv = AIS.createCVInstance("REP", "recogImgByPrompt");
            const getUrl = await cv!.predict({
                image:userMsg,
                prompt: chatModel.imgRecogHint,
                // max_new_tokens: 300,
                // max_length: 400,
                temperature: 1
            });                            
            
            let imgDesc = await cv!.getPredictResult(getUrl);
            log("recognition:" + imgDesc);                
    
            inputType = "text";
            returnType =  await getReturnMsgType(app, openid, inputType);                                        
            prompt = await translate(imgDesc, "en", "zh");
        }catch(e){
            error("image recognition error:");
            error(e);
        }
    }
    
    // 处理图生图
    if(inputType == "image"){
        result.count += await responseToUserByCS(app, talkUserOpenId, "好的，请您稍等......");   
        setTypingStatus(app, talkUserOpenId);

        let body:any = { cmd:"createPrompt", timeStamp: Date.now(), email:loginUserUnionId, 
                          params: {
                              func: imgModel, 
                              imageUrl:userMsg,
                              drawRatio
                          } 
                       };
        switch(imgModel){
            case "photo2cartoon":
                body.params.theme = "art";
                body.params.imageUrl = userMsg + ".jpg";
                break;
                
            case "dream":
                body.params.theme = "Affordable Luxury";
                body.params.room = "Living Room";
                body.params.inputText = " a room ";
                break;
                
            case "draftFree":
                body.params.inputText = " a comic, simple style, colorful ";
                break;
                
            case "zoomIn":
                body.params.upscale =  2;
                body.params.background_enhance = true;
                body.params.face_upsample = true;
                body.params.codeformer_fidelity = 0.7;
                break;    
                
            case "faceswap":
                body.params = {
                    email:loginUserUnionId,                     
                    source_image : await getAppUserConfig(app, talkUser, "USER_PORTRAIT"),
                    target_image : userMsg
                }
                break;
        }
        // 调用绘画API
        const res = await fetch(process.env.WEBSITE_URL+"/api/workflowAgent2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body) 
        });
        const jsonRet = await res.json();
        if (res.status == 200 && jsonRet.generated) {
            result.count += await responseToUserByCS(app, talkUserOpenId, jsonRet.generated, "image");
            result.content = jsonRet.generated;
            return result;
        } if(res.status == 403) {
            // 循环查找图片生成结果，最多等10分钟。超时或者如果已经被标记生成失败就直接报错
            let retry = 0;
            while(retry++ < 120){
                log("第" + retry + "次查询图片生成记录");
                log("userId:" + loginUser.id);
                log("inputImage:" + userMsg);
              
                const genRoom = await prisma.room.findUnique({
                    where: {
                        //userId : loginUser.id,
                        //func: "draftFree",
                        //inputImage: userMsg
                        id : jsonRet.genRoomId                        
                    },
                   // orderBy: { 
                   //     createdAt: 'desc', 
                    //},   
                });
                if(genRoom){
                    log("genRoom:" + JSON.stringify(genRoom));
                    
                    if(genRoom.outputImage && genRoom.status == "SUCCESS"){
                        result.count += await responseToUserByCS(app, talkUserOpenId, genRoom.outputImage, "image");
                        result.content = genRoom.outputImage;
                        return result;
                    }else if(genRoom.status == "FAILED"){
                        log("FAILED");
                        responseToUserByCS(app, talkUserOpenId, "很抱歉！生成图片失败，可能系统发生了短暂故障，请稍后再尝试一下好吗...");
                        return result;
                    }else{
                        // 每次等待5秒再重新尝试
                        await new Promise((resolve) => setTimeout(resolve, 5000));    
                    }
                }else{
                    log("no rooms");
                    break;
                }
            }
            responseToUserByCS(app, talkUserOpenId, "很抱歉！生成图片失败，可能系统发生了短暂故障，请稍后再尝试一下好吗..."); 
            return result;
        }else if(res.status === 401){
            responseToUserByCS(app, talkUserOpenId, "请先完成用户'授权登录'，然后开始对话。授权链接： " + process.env.WEBSITE_URL + "/loginChoice");
            return result;
        }else if(res.status == 402){
            if(app.settlement == "B2A"){     
                responseToUserByCS(app, talkUserOpenId, "该应用的服务商已经没有费用了，请帮我们通知服务商续费，谢谢！");
                return result;
            }else{
                await responseToUserByCS(app, talkUserOpenId, "您的"+config.creditName+"用完啦！\n" + 
                                              "这里是"+config.creditName+"的购买链接： " + process.env.WEBSITE_URL + "/buy-credits  \n\n"  
                                             // + "您也可以邀请好友关注公众号获得" +config.inviteBonus+ "个" +config.creditName+ "的奖励！" 
                                             // + "邀请的方法是把下面的二维码转发给您的朋友，请他关注我们的公众号后，您就会获得奖励！"
                                             );
                const QRCode = await genInvitationQRCode(app, talkUser.id, {shareType:"SHARE_USER"});
                responseToUserByCS(app, talkUserOpenId, QRCode, "image");
                return result;
            }
        }else{
            responseToUserByCS(app, talkUserOpenId, "很抱歉！生成图片失败，可能系统发生了短暂故障，请稍后再尝试一下好吗..."); 
            return result;
        }

    }
    
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

    if(isDraw){
        result.count += await responseToUserByCS(app, talkUserOpenId, "好的，请您稍等......");
        setTypingStatus(app, talkUserOpenId);   
    }
    let service = process.env.WEBSITE_URL + "/api/chat?email=" + loginUserUnionId; 
    if(isDraw){
        service += "&CMD=draw";
    }else if(isMediaMatch){
        service += "&CMD=mediaMatch";
    }else{
        service += "&CMD=prepareChat";
    }
    
    log("service first:" + service);
    
    try{        
        const res = await fetch(service, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: messages, 
                modelId: chatModelId,
                drawModel: drawModel,
                drawMethod: drawMethod,
                drawRatio: drawRatio,
                maxOutput: maxOutput,
            }),
        });
        
        log("res.status:" + res.status);
      
    
        if (res.status === 200) {
            
            let response = (await res.json());
           
            if(isDraw || isMediaMatch){                
                // 对于返回图片类型已经可以返回了
                const image = JSON.parse(response.content);
                if(Array.isArray(image)){
                    for(const m of image){
                        if(result.count < maxOutput){
                            result.count += await responseToUserByCS(app, talkUserOpenId, m.roomUrl, "image", watermark);                    
                            result.content = m.roomUrl;
                        }else{
                            break;
                        }
                    }
                }else{
                    result.count += await responseToUserByCS(app, talkUserOpenId, image.roomUrl, "image", watermark);     
                    result.content = image.roomUrl;
                }
                
                return result;
            }

            
            // 开始处理文字类型，准备出对象
            let current:TalkRecord = {
                    talkId: response,
                    role : "assistant",
                    content : "", 
                    name: talkUser.id,
                    userCover: "",
                    createdAt: new Date(Date.now())
            }
          
            input.talkId = current.talkId;

            // 开始陆续接收内容
            const eventEmitter = new EventEmitter();
            
            const streamUrl = process.env.WEBSITE_URL + "/api/chat?CMD=chatStream&key=" + response + "&email=" + loginUserUnionId; 
            const source = new EventSource(streamUrl);
            let segment = ""; // 当前已经收到服务器返回的段落
            let segs = 0;  // 当前已经返回过的段落，微信一次最多返回5段
            let maxLen = 150; // 微信每次返回的最大长度，对于语音不能大于这个长度
            const mutex = new Mutex(); // 互斥锁

            source.onmessage = async function(event) {
                // 等待获取互斥锁，保证同一时间只有一个线程进入该函数
                const release = await mutex.acquire();
                
                try{
                    if(event.data && event.data.trim().indexOf('[DONE]') < 0){
                        const retMsg = JSON.parse(event.data)
                        segment += retMsg.content;
                        // log("webservice segment:" + segment);
                        current.content += retMsg.content; 
                        
                        // 一直积攒到还未发送的字符大于阀值再处理
                        if(segment.length > maxLen){
                            let tRet = segment; // 本次返回的段落
                            // 截取出不大于阀值的最长段落
                            while(tRet.length > maxLen){
                                let lastNewlineIndex = tRet.lastIndexOf('\n');
                                if(lastNewlineIndex<0){
                                    lastNewlineIndex = tRet.lastIndexOf('。');
                                }
                                if(lastNewlineIndex<0){
                                    lastNewlineIndex = tRet.lastIndexOf('，');
                                }
                                if(lastNewlineIndex<0){
                                    lastNewlineIndex = tRet.lastIndexOf('！');
                                }
                                if(lastNewlineIndex<0){
                                    lastNewlineIndex = tRet.lastIndexOf('：');
                                }
                                
                                // log("lastNewlineIndex:" + lastNewlineIndex);
                                tRet = segment.substring(0, lastNewlineIndex);
                                // log("tRet:" + tRet);
                            }  
                            if(segs++ < 4 && tRet.length>0){
                                segment = segment.substring(tRet.length+1);                             
                                // log("ret:" + tRet);
                                result.count += await responseToUserByCS(app, talkUserOpenId, tRet, returnType);
                                result.content += tRet;
                                setTypingStatus(app, talkUserOpenId);
                                if(returnType=="text"){
                                    // 对于文本类型可以回复的越来越长，最长微信支持400字
                                    // 对于语音消息，受一次60秒的限制，最长250字
                                    maxLen = 400;
                                }else{
                                    maxLen = 250;
                                }
                            }
                        }                 
                        
                    }else{
                        // log("[DONE]");
                        source.close();
                        
                        if(segment.length > 0){
                            // 微信最大每次返回1000字符
                            if(segment.length > maxLen){
                                segment = segment.substring(0, maxLen) + "\n\n"; //提示：因为微信的字数限制，更多内容无法输出"; 
                            }
                            log("---------------DONE--------------------");
                            result.count += await responseToUserByCS(app, talkUserOpenId, segment, returnType); 
                            result.content += segment;
                            segment = "";
                        }                        
                        eventEmitter.emit('parserFinished');                               
                    }
                }finally{
                    release(); // 释放互斥锁
                }
            };// end of source.onmessage
            
            
            // 等待传递完所有数据
            await new Promise<void>(resolve => {
                eventEmitter.once('parserFinished', () => {
                    log('AI生成的结果异步传输完毕');
                    resolve();
                });
            });         
            
            return result;
            
        
        }else if(res.status === 401){
        
            responseToUserByCS(app, talkUserOpenId, "请先完成用户'授权登录'，然后开始对话。授权链接： " + process.env.WEBSITE_URL + "/loginChoice");
            return result;
        
        }else if(res.status == 402){
            
            if(app.settlement == "B2A"){     
                responseToUserByCS(app, talkUserOpenId, "该应用的服务商已经没有费用了，请帮我们通知服务商续费，谢谢！");
                return result;
            }else{
                responseToUserByCS(app, talkUserOpenId, "您的"+config.creditName+"用完啦！\n" + 
                                              "这里是"+config.creditName+"的购买链接： " + process.env.WEBSITE_URL + "/buy-credits  \n\n"  
                                            //  + "您也可以邀请好友关注公众号获得" +config.inviteBonus+ "个" +config.creditName+ "的奖励！"  
                                            //  + "邀请的方法是把下面的二维码转发给您的朋友，请他关注我们的公众号后，您就会获得奖励！"
                                             );
              //const QRCode = await genInvitationQRCode(app, talkUser.id, {shareType:"SHARE_USER"});
              //responseToUserByCS(app, talkUserOpenId, QRCode, "image");
              return result;
          }
      }else if(isDraw && res.status == 403){

          let chatResponse = await res.json();
          // 循环查找图片生成结果，最多等10分钟。超时或者如果已经被标记生成失败就直接报错
          let retry = 0;

          if(chatResponse && chatResponse.content){
              const rooms = JSON.parse(chatResponse.content);
              const roomId = Array.isArray(rooms) ? rooms[0].roomId : rooms.roomId;
              log("chat Response roomId:" + roomId);
              // log("chat response:" + JSON.stringify(chatResponse));
            
              while(retry++ < 120){
                  log("第" + retry + "次查询图片生成记录");
                  log("userId:" + loginUser.id);
    
                  const genRoom = await prisma.room.findUnique({
                        where: {
                          id: roomId,
                        },
                  });
                  
                  if(genRoom){
                      if(genRoom.outputImage && genRoom.status == "SUCCESS"){
                          result.count += await responseToUserByCS(app, talkUserOpenId, genRoom.outputImage, "image", watermark);
                          result.content = genRoom.outputImage;
                          return result;
                      }else if(genRoom.status == "FAILED"){
                          log("FAILED");
                          const errMsg = genRoom.outputImage ? genRoom.outputImage : "很抱歉！生成图片失败，可能系统发生了短暂故障，请稍后再尝试一下好吗...";
                          responseToUserByCS(app, talkUserOpenId, errMsg);
                          return result;
                      }else{
                          // 每次等待5秒再重新尝试
                          await new Promise((resolve) => setTimeout(resolve, 5000 + retry*100));    
                      }
                  }else{
                      log("no rooms");
                      break;
                  }
              }
          }
          
          log("查询记录失败");
          responseToUserByCS(app, talkUserOpenId, "很抱歉！查询图片结果失败，可能系统发生了短暂故障，请稍后再尝试一下好吗..."); 
          return result;
      }else if(isDraw && res.status == 400){
          log("生成图片失败:" + res.status);
          responseToUserByCS(app, talkUserOpenId, "很抱歉！生成图片失败，可能系统发生了短暂故障，请稍后再尝试一下好吗..."); 
          return result;
      }else if(res.status == 405){
          log("生成的图片NSFW");
          responseToUserByCS(app, talkUserOpenId, JSON.stringify(await res.json()) ); 
      }

      return result;
    }catch(e){
        error("wechat service调用AI服务发生意外失败\n" + e);
        await responseToUserByCS(app, talkUserOpenId, "对话发生意外失败，请稍后重试");
        return result;
    }
}



export async function genInvitationQRCode(app:Application, userId:string, message:any){
    const token = await getAccessToken(app);

    // 检查是否有未过期的
    let shares = await prisma.shareQR.findMany({
        where: {
            userId: userId,
            appId: app?.id
        }
    });

    let existTicket = "";
    for(const s of shares){
        const existMsg = s.message ? JSON.parse(s.message) : null;
        if(existMsg){
            if(message.shareType == "SHARE_MODEL"){ 
                if(existMsg.shareType == "SHARE_MODEL" && existMsg.modelId == message.modelId){
                    existTicket = existMsg.ticket;
                    break;
                }
            }else if(message.shareType == "SHARE_USER"){
                // 此时是单纯分享用户
                if(existMsg.shareType == "SHARE_USER"){
                    existTicket = existMsg.ticket;
                    break;
                }
            }
        }
    }

    if(existTicket){
        // 如果已经存在二维码，就使用原来的
        const qrCodeUrl = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + existTicket;
        log("Exist QR Code URL:" + qrCodeUrl);    
        return qrCodeUrl;
    }else{
        // 生成新的二维码
        const now = new Date();
        const share = await prisma.shareQR.create({
            data:{
                userId: userId,
                appId: app?.id,
                createTime: now,
                expireTime: new Date(now.getTime() + 259200000000), // 100个月
                message: ""
            }
        });

        const result = await fetch(
            "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" + token,                    
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body:JSON.stringify({
                    // "expire_seconds":2592000, // 临时二维码最长30天。永久二维码不需要这个参数
                    "action_name": "QR_LIMIT_STR_SCENE", // 改成永久二维码。之前是临时二维码"QR_STR_SCENE",
                    "action_info": {
                        "scene": {
                            "scene_str": share.id,
                        }
                    }
                }),
                                       
             });
        if(result.status == 200){
            const ret = await result.json();
            const qrCodeUrl = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + ret.ticket;

            // 数据库中保存ticket
            message.ticket = ret.ticket;
            await prisma.shareQR.update({
                where:{
                    id: share.id
                },
                data:{
                    message: JSON.stringify(message)
                }
            });
            
            log("New QR Code URL:" + qrCodeUrl);    
            return qrCodeUrl;
        }else{
            error("QR Code Gen Failed");
            return "";
        }
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
              body: JSON.stringify({ openid:userOpenId, unionid:unionid, signInType: "INSIDE", inviteBy, source:"nokey subscribe" }),
            });
        }

        return user;
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
