import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import {log, warn, error} from "../../utils/debug";
import {roomNames, getImageModelByCode} from "../../utils/modelTypes";
import { Application, User } from "@prisma/client";
import { createDefModel } from "./trainChatModel";
import {getApp, getAppConfig, responseToUserByCS, modelQuestionMenu} from "./wechatService";
import {config} from "../../utils/config";
import {translate} from "../../utils/localTranslate";



export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        
        let { cmd, appId, userId, key, value, drawMethod, msgToWechat } = req.query;

        if(!userId){
            return res.status(401).json("当前用户没有登录，请登陆后再操作应用！");
        }
        
        if(cmd === "UPDATE"){
            let newConfig = null; 
            var returnMsg:any; 

            switch(key){
                case "CHAT_MODEL_ID":
                    let model = null;
                    if( value == "def_model_" ){
                        // 缺省的个人助理处理
                        let model = await prisma.model.findUnique({ where:{ code : "def_model_" + (userId as string) } });
    
                        // 如果还没创建就创建一个
                        if(!model){
                            model = await createDefModel(userId as string);
                        }
                        if(model){
                            value = model.id;
                        }
                    }else{
                        model = await prisma.model.findUnique({
                            where:{
                                id: value as string
                            }
                        }); 
                    }
                    
                    newConfig = await updateAppUserConfig(appId as string, userId as string, [ 
                        {key:key as string, value:value as string} ] );
                    returnMsg = await getConfigMessage(appId as string, key as string, value as string);   
                    if(msgToWechat){ 
                        sendWechatMsg(appId as string, userId as string, returnMsg.image, "image").then(() => {                        
                            if(returnMsg.voice){
                                sendWechatMsg(appId as string, userId as string, returnMsg.voice, "voice").then(() => {
                                    sendWechatMsg(appId as string, userId as string, returnMsg.text);
                                });                        
                            }else{
                                sendWechatMsg(appId as string, userId as string, returnMsg.text);                            
                            }
                        });
                    }

                    // const app = appId ? await getApp(appId as string) : null;
                    // if(app && app.name==="AI菩提" && value != "def_model_" && model && !model.desc){
                    //    await sendWechatMsg(appId as string, userId as string, JSON.stringify(modelQuestionMenu), "msgmenu");
                    //}
                    break;

                case "VDH_ID":
                    const vdh = await prisma.vDH.findUnique({
                        where:{
                            id: value as string
                        },
                        include:{
                            pModel:true,
                            cModel:true,
                            vModel:true
                        }
                    });
                    log(vdh);
                    if(vdh){
                        const params:any[] = [ 
                            {key:"VDH_ID", value:value as string},
                            {key: "DRAW_METHOD", value: "LORA"},
                          //  {key: "RESPONSE_METHOD", value: "3"},
                            {key:"TEXT2IMG_MODEL", value:vdh.pModel.id},
                            {key:"TTS_SPEAKER", value:vdh.vModel.code.split('&&&').pop()}
                        ];
                        if(appId != "aiputi00001"){
                            params.push( {key:"CHAT_MODEL_ID", value:vdh.cModel.id} );
                        }
                        newConfig = await updateAppUserConfig(appId as string, userId as string,  params);
                        log(newConfig);
                        returnMsg = await getConfigMessage(appId as string, key as string, value as string, {vdh});    
                        log(returnMsg);
                        if(msgToWechat){                            
                            let voice = returnMsg.voice;
                            if(vdh.vModel.language != "zh"){
                                voice = await translate(voice, "zh", vdh.vModel.language);
                            }
                            sendWechatMsg(appId as string, userId as string, returnMsg.image, "image").then(() => {
                                sendWechatMsg(appId as string, userId as string, voice, "voice").then(() => {
                                    if(appId != "aiputi00001"){
                                        sendWechatMsg(appId as string, userId as string, returnMsg.text);
                                    }
                                });
                            }); 
                        }  
                    }
                    break;
                    
                case "TEXT2IMG_MODEL":
                    if(!drawMethod){
                        drawMethod = "LARGE_MODEL";
                    }
                    
                    newConfig = await updateAppUserConfig(appId as string, userId as string, [ 
                        {key:key as string, value:value as string},
                        {key: "DRAW_METHOD", value: drawMethod}] );
                    
                    returnMsg = await getConfigMessage(appId as string, key as string, value as string, {drawMethod: drawMethod as string});
                    if(msgToWechat){ 
                        if(drawMethod == "LORA" && returnMsg.image){
                            sendWechatMsg(appId as string, userId as string, returnMsg.image, "image").then(() => {
                                sendWechatMsg(appId as string, userId as string, returnMsg.text);
                            });
                        }else{
                            sendWechatMsg(appId as string, userId as string, returnMsg.text);
                        }
                    }                    
                    break;

                case "IMG2IMG_MODEL":
                    if(value as string === "faceswap"){
                        const image = await getAppUserConfigValue(appId as string, userId as string, "USER_PORTRAIT");
                        if(!image){
                            returnMsg = {
                                text: "请先上传一张您的形象照片：\n" + 
                                    "方法1：打开下方菜单[AI写真]-[设置我的形象照]\n" + 
                                    "方法2: 点击链接 " + process.env.WEBSITE_URL + "/setPortrait?appId=" + appId
                            };
                        }else{
                            returnMsg = null;
                        }
                    }
                    
                    if(!returnMsg){
                        newConfig = await updateAppUserConfig(appId as string, userId as string, [ 
                            {key:key as string, value:value as string} ] );
                        returnMsg = await getConfigMessage(appId as string, key as string, value as string);    
                    }
                    
                    if(msgToWechat){ sendWechatMsg(appId as string, userId as string, returnMsg.text);  }  
                    break;
                    
                case "USER_PORTRAIT":
                    newConfig = await updateAppUserConfig(appId as string, userId as string, [ 
                        {key:key as string, value:value as string} ] );
                    newConfig = await updateAppUserConfig(appId as string, userId as string, [
                        { key:"IMG2IMG_MODEL", value:"faceswap"} ] );
                    returnMsg = await getConfigMessage(appId as string, key as string, value as string);    
                    if(msgToWechat){ sendWechatMsg(appId as string, userId as string, returnMsg.text);  }     
                    break;
                    
                default: 
                    newConfig = await updateAppUserConfig(appId as string, userId as string, [ 
                        {key:key as string, value:value as string} ] );
                    returnMsg = await getConfigMessage(appId as string, key as string, value as string);    
                    if(msgToWechat){ sendWechatMsg(appId as string, userId as string, returnMsg.text);  }                    
            }
            
            if(returnMsg){
                return res.status(200).json(returnMsg.text);
            }else{
                return res.status(400).json("更新对话模型发生意外失败！");
            }
        }
    }catch(e){
        error(e);
        return res.status(500).json("更新应用的用户配置时时发生意外失败！");
    }
}



async function getConfigMessage(appId:string, key:string, value:string, params?:any){
    const app = appId ? await getApp(appId) : null;
    let drawPrefix = app ? getAppConfig(app, "DRAW_PREFIX") : "画";
    let modelName = "";
    let modelChannel = "";
    let modelImage = "";
    let modelPrice = 0;
    
    switch(key){

        case "INTERACTION_MODE":{
            switch(value){
                case "DRAW": return {text:"好吧，您需要什么样的照片呢？"};
                case "CHAT": return {text:"好的，您有什么问题呢？"};
                default: return {text:"好的！"};
            }
            break;
        }
        case "RESPONSE_METHOD":{
            let msg = "好的，接下来的对话中，我将";
            switch(value){
                case "1": msg += "根据您的输入方式来选择一样的回复方式。";
                    break;
                case "2": msg += "只用文字来回答。";
                    break;
                case "3": msg += "只用语音来回答。";
            }
            return {text:msg};
        }
        case "DRAW_RATIO":{
            let msg = "好的，宽高比已经被设置为 ";
            switch(value){
                case "169": msg += "16:9";
                    break;
                case "916": msg += "9:16";
                    break;
                case "11": msg += "1:1";
            }                    
            return {text:msg};
        }
        // 设置语言模型    
        case "CHAT_MODEL_ID": 
            const model = await prisma.model.findUnique({
                where:{
                    id: value
                }
            });            
            if(model){
                if(model.channel === "BOOK"){
                    let ret =  "好的，现在让我们一起聊聊关于《"+model.name+"》的内容吧！\n\n";
                    if(model.desc){
                        ret += model.desc + "\n\n";
                    }else{
                        ret += "你可以让我给您讲解书中的内容。也能让我结合书中的内容来回答您的各种实际问题！\n\n" ;
                    }
                    ret += "点击下方左侧的圆形按钮输入您的问题吧（支持语音）";
                    return {text:ret}; // , image:model.coverImg};
                }else{
                    let ret = "";
                    if(model.desc){
                        ret += model.desc;
                    }else{
                        ret += "对话模型已经设置成“"+model.name+"”啦！" + "现在点击下方左侧的圆形按钮开始和我对话吧。";
                    }
                    return {voice:ret, text:ret};   
                }
            }else{
                error("CHAT_MODEL_ID:" + value);
                return {text:"未知的对话模型"};
            }
            break;

        // 设置绘图大模型    
        case "TEXT2IMG_MODEL": {
            switch(params.drawMethod){
                case "LORA":
                    const lora = await prisma.model.findUnique({
                        where: { 
                            id: value
                        }
                    });
                    if(lora){
                        modelName = lora.name;
                        modelChannel = lora.channel;
                        modelImage = lora.coverImg;
                        modelPrice = lora.price;
                    }
                    break;
                
                case "PROMPT":
                    const prompt = await prisma.prompt.findUnique({
                        where: {
                            id: value
                        }
                    });
                    if(prompt){
                        modelName = prompt.name;
                        modelPrice = prompt.price;
                    }
                    break;

                default: // "LARGE_MODEL" || udnefined
                    log("value:", value);
                    log(JSON.stringify(value));
                    const im = getImageModelByCode(value);
                    log(im);
                    log(JSON.stringify(im));
                    modelName = im?.name;
                    modelPrice = im?.price;
                    break;
                    
            }
            if(modelName){
                if(!drawPrefix){
                    drawPrefix = "画";
                }

                if(modelChannel === "FASHION"){                
                    return {
                        text: "老公，我终于等到你了！我是"+modelName+"啊！现在点击下方左侧的圆形按钮开始和我聊天吧，"  
                            + (drawPrefix == "ANY" ? "" : ("以‘" + drawPrefix + "’开头"))  
                            + "可以要求我拍照片给你看（支持语音哦！）",
                        image: modelImage,
                    }
                }else{
                    return {
                        text: `绘画模型已经设置成“${modelName}”！每次生成需要${modelPrice}点。现在点击下方左侧的圆形按钮，${(drawPrefix == "ANY" ? "" : ("以‘" + drawPrefix + "’开头"))}输入你想画的内容吧！（支持语音哦）`
                    };
                }
            }else{
                return {text: "未知的绘画模型"};
            }

        }

        case "IMG2IMG_MODEL":{
            return {text:"请在下方微信输入框点击右侧+号上传一张照片（JPG/BMP格式，不要大于5M）"};
        }

        case "USER_PORTRAIT":{
            return {text:"已经设置好您的形象照了！现在请在下方微信输入框点击右侧+号，上传一张参考模特照片（JPG/BMP格式，不要大于5M）"};
        }

        case "VDH_ID":{
            const vdh = params.vdh;
            if(vdh){
                return {
                    voice: vdh.desc || vdh.cModel.desc || ("老公，我终于等到你了！我是"+ vdh.name +"啊！"),
                    text: "现在点击下方左侧的圆形按钮开始和我聊天吧，"  
                        + (drawPrefix == "ANY" ? "" : ("以‘" + drawPrefix + "’开头"))  
                        + "可以要求我拍照片给你看（支持语音哦！）",
                    image: vdh.pModel.coverImg,
                }
            }
        }

        case "TTS_SPEAKER": 
            return {text:"声音设置成功！"};
            
        default: 
            return {text:"设置已经成功！"};
    }

}



export async function updateAppUserConfig(appId:string, userId:string, params:any){
    // 查询配置是否存在
    let auc = null;
    log("appId:" + appId);
    log("userId:" + userId);
    
    try{
        auc = await prisma.appUserConfig.findUnique({
            where:{
                appId_userId:{
                    appId: appId,
                    userId: userId
                }
            }
        });
       
        if(auc){
            let config:{ [key: string]: any } = auc.config ? JSON.parse(auc.config) : {};
            for(const p of params){
                config[p.key] = p.value;
            }
            log("new config:" + JSON.stringify(config));
            await prisma.appUserConfig.update({
                data:{
                    config: JSON.stringify(config)
                },
                where:{
                    id: auc.id
                }
            });
        }else{
            // 创建应用
            let config:{ [key: string]: any } = {};
            for(const p of params){
                config[p.key] = p.value;
            }
            log("new config:" + JSON.stringify(config));
            
            auc = await prisma.appUserConfig.create({
                data: {
                    appId: appId, 
                    userId: userId,
                    config: JSON.stringify(config)
                }
            });
        }
    }catch(e){
        error("更新app user config出错！");
        error(e);
        auc = null;
    }
    
    return auc;
}


export async function getAppUserConfigValue(appId:string, userId:string, key:string){
    const data = await prisma.appUserConfig.findUnique({
                where: {
                    appId_userId:{
                        appId: appId,
                        userId: userId,
                    },
                }
            });  
    if(data && data.config){
        const configJson = JSON.parse(data.config);
        return configJson[key];
    }
}

async function sendWechatMsg(appId:string, userId:string, returnMsg:string, msgType:string="text"){

    const app = await getApp(appId);
    const toUserId = await getAppUserConfigValue(appId, userId, "FROM_USER_OPEN_ID");
    if(app && toUserId){
        await responseToUserByCS(app, toUserId, returnMsg, msgType);
    }    
}


