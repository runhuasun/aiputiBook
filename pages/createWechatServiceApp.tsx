import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";

import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import DropDown from "../components/DropDown";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, Application } from "@prisma/client";
import { getServerSession } from "next-auth";
import { showModel} from "../components/Genhis";
// import { Alert } from 'react-native';
import {hotSigns} from "../utils/parser";
import * as debug from "../utils/debug";
import { rooms, roomNames  } from "../utils/modelTypes";
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import * as monitor from "../utils/monitor";


export default function createWecharServiceApp({ cModels, vModels, model, app, config }: { cModels: Model[], vModels: Model[], model:Model, app:Application, config:any }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [id, setId] = useState(app ? app.id: "");
    const [serviceUrl, setServiceUrl] = useState(app ? (config.website + "/api/wechatService?appId=" + app.id) : "");

    const [settlement, setSettlement] = useState<string>(app ? app.settlement : "B2A");
    const [name, setName] = useState(app ? app.name: "");
    const [modelId, setModelId] = useState(app ? app.modelId : "");
    const [appConfig, setAppConfig] = useState(app ? app.config : "");
    const [desc, setDesc] = useState(app ? app.desc : "");
    
    const {APP_WELCOME_MSG = "", 
           APP_WELCOME_ARTICLE = "",
           WECHAT_APP_ID = "", 
           WECHAT_APP_SECRET = "", 
           WECHAT_SERVICE_TOKEN = "", 
           XUNFEI_T2V_SPEAKER = "", 
           TEXT2IMG_MODEL = "",
           DRAW_PREFIX = "",
           IMAGE_WATERMARK = "",
           CHAT_MEDIA_MODEL_ID = "",
           WECHAT_SERVICE_MENU = "",
           APP_CHAT_WITH_AI = "",
           APP_SEND_INVITE_QR = "",
          } 
        = (app && app.config) ? JSON.parse(app.config) : {};

    const [sendInviteQR, setSendInviteQR] = useState(APP_SEND_INVITE_QR || "TRUE");
    const [appChatWithAI, setAppChatWithAI] = useState(APP_CHAT_WITH_AI || "FALSE");
    const [appWelcomeMsg, setAppWelcomeMsg] = useState(APP_WELCOME_MSG || "欢迎关注我！");
    const [appWelcomeArticle, setAppWelcomeArticle] = useState(APP_WELCOME_ARTICLE);
    const [wechatAppId, setWechatAppId] = useState(WECHAT_APP_ID || "");
    const [wechatAppSecret, setWechatAppSecret] = useState(WECHAT_APP_SECRET || "");
    const [wechatServiceToken, setWechatServiceToken] = useState(WECHAT_SERVICE_TOKEN || "");
    const [wechatServiceMenu, setWechatServiceMenu] = useState(WECHAT_SERVICE_MENU ? JSON.stringify(WECHAT_SERVICE_MENU) : "");
    const [speaker, setSpeaker] = useState(XUNFEI_T2V_SPEAKER || "");
    const [imageWatermark, setImageWatermark] = useState(IMAGE_WATERMARK || "");
    const [drawPrefix, setDrawPrefix] = useState(DRAW_PREFIX || "画"); // ANY代表永远允许 NO代表不允许
    const [chatMediaModelId, setChatMediaModelId] = useState(CHAT_MEDIA_MODEL_ID); // 可以为空
    const [text2imgModel, setText2imgModel] = useState(TEXT2IMG_MODEL || "sdxl");
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    let modelNames = new Map();
    let modelIDs = [];
    if(cModels && cModels.length>0){
        for(const m of cModels){
            modelIDs.push(m.id);
            modelNames.set(m.id, m.name);
        }
        if(!modelId){
            setModelId(modelIDs[0]);
        }
    }

    let vModelNames = new Map();
    let vModelCodes = [];
    if(vModels && vModels.length>0){
        for(const m of vModels){
            vModelCodes.push(m.code);
            vModelNames.set(m.code, m.name);
        }
        if(!speaker && vModels.length>0){
            setSpeaker(vModels[0].code);
        }
    }
    
    function checkFields(){
    
        if(name.length < 3 || name.length > 20){
            alert("请给应用起一个3 - 20个字的名字吧！");
            return false;
        }else if(!modelId){
            alert("请先选择一个模型");
            return false;
        }
        
        if( wechatServiceMenu ){
            try{
                const tmp = JSON.parse(wechatServiceMenu);
             //   setWechatServiceMenu(JSON.stringify(tmp));
            }catch(e){
                alert("配置微信公众号的菜单需要符合JSON规则，请检查并修改");
                return false;
            }
        }

        if(!wechatAppId){
            alert("微信公众号的AppId必须配置。你可以登录到自己的公众号，在左侧菜单[设置与开发]-[基本配置]-[公众号开发信息]-[开发者ID(AppID)]中找到。");
            return false;
        }
        
        if(!wechatAppSecret){
            alert("微信公众号的AppSecret必须配置。你可以登录到自己的公众号，在左侧菜单[设置与开发]-[基本配置]-[公众号开发信息]-[开发者密码(AppSecret)]中找到。");
            return false;
        }
        
        if(!wechatServiceToken){
            alert("微信公众号的令牌(Token)必须配置。你可以登录到自己的公众号，在左侧菜单[设置与开发]-[基本配置]-[服务器配置]-[令牌(Token)]中配置和这里一样的字符串。");
            return false;
        } 
        return true;
    }
  
    const router = useRouter();
  
    async function createApp() {
        try{
            if(checkFields()){
                const newConfig={
                    "APP_SEND_INVITE_QR": sendInviteQR,
                    "APP_CHAT_WITH_AI": appChatWithAI,
                    "APP_WELCOME_MSG" :appWelcomeMsg,
                    "APP_WELCOME_ARTICLE" :appWelcomeArticle,
                    "WECHAT_APP_ID": wechatAppId, 
                    "WECHAT_APP_SECRET": wechatAppSecret, 
                    "WECHAT_SERVICE_TOKEN": wechatServiceToken, 
                    "XUNFEI_T2V_SPEAKER": speaker,
                    "TEXT2IMG_MODEL": text2imgModel,
                    "DRAW_PREFIX": drawPrefix,
                    "IMAGE_WATERMARK": imageWatermark,
                    "CHAT_MEDIA_MODEL_ID": chatMediaModelId,
                    "WECHAT_SERVICE_MENU": wechatServiceMenu ? JSON.parse(wechatServiceMenu) : "",
                };
                setAppConfig(JSON.stringify(newConfig));
               
                const res = await fetch("/api/appManager", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    // 先让code和name取一样的值
                    body: JSON.stringify({ 
                        cmd: "CREATE",
                        name:name, 
                        type:"WechatService",
                        settlement:settlement, 
                        userId: data.currentUserId,
                        modelId: modelId,
                        config: newConfig,
                        desc: desc                        
                    }),
                });
                
                if (res.status !== 200) {
                    setError(await res.json() as any);
                    return false;
                } else {
                    const result = await res.json();
                    setId(result.id);
                    setServiceUrl(config.website + "/api/wechatService?appId=" + result.id);
                    alert("微信公众号服务创建成功！");
                    return true;
                }
            }
        }catch(e){
            debug.error(e);
            return false;
        }
    }
 
      async function updateApp() {
        try{
            if(checkFields()){
                const newConfig={
                    "APP_SEND_INVITE_QR": sendInviteQR,
                    "APP_CHAT_WITH_AI": appChatWithAI,
                    "APP_WELCOME_MSG" :appWelcomeMsg,
                    "APP_WELCOME_ARTICLE" :appWelcomeArticle,
                    "WECHAT_APP_ID": wechatAppId, 
                    "WECHAT_APP_SECRET": wechatAppSecret, 
                    "WECHAT_SERVICE_TOKEN": wechatServiceToken, 
                    "XUNFEI_T2V_SPEAKER": speaker,
                    "TEXT2IMG_MODEL": text2imgModel,
                    "DRAW_PREFIX": drawPrefix,
                    "IMAGE_WATERMARK": imageWatermark,
                    "CHAT_MEDIA_MODEL_ID": chatMediaModelId,
                    "WECHAT_SERVICE_MENU": wechatServiceMenu ? JSON.parse(wechatServiceMenu) : "",
                };
                setAppConfig(JSON.stringify(newConfig));
                
                const res = await fetch("/api/appManager", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    // 先让code和name取一样的值
                    body: JSON.stringify({ 
                        cmd: "UPDATE",
                        id: id,
                        name:name, 
                        type:"WechatService",
                        settlement:settlement, 
                        userId: data.currentUserId,
                        modelId: modelId,
                        config: newConfig,
                        desc: desc                        
                    }),
                });
                debug.log("update fun:" + appConfig);
                if (res.status !== 200) {
                    setError(await res.json() as any);
                    return false;
                } else {
                    const result = await res.json();
                    alert("微信公众号服务更新成功！");
                    return true;
                }
            }
        }catch(e){
            debug.error(e);
            return false;
        }
    }
 
  if(status == "authenticated"){
  
      return (
      <TopFrame config={config}>
          <main>
              <h1 className="title-main">
                  {id ? "更新" : "创建"}<span className="title-light">微信公众号应用</span> 
              </h1>
              
              <div className="flex justify-between items-center w-full flex-col mt-4">
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            应用ID号(只读)
                          </p>
                        </div>
                        <input type="text" value = {id}
                        className="input-main" 
                        readOnly
                        onChange={(e) => setId(e.target.value)} />
                     </div>
                  
                     <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            应用服务地址(只读)
                          </p>
                        </div>
                        <input type="text" value = {serviceUrl}
                        className="input-main" 
                        readOnly
                        onChange={(e) => setServiceUrl(e.target.value)} />
                     </div>
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            微信服务号AppId
                          </p>
                        </div>
                        <input type="text" value = {wechatAppId}
                        className="input-main" 
                        onChange={(e) => setWechatAppId(e.target.value)} />
                     </div>
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            微信服务号AppSecret
                          </p>
                        </div>
                        <input type="text" value = {wechatAppSecret}
                        className="input-main" 
                        onChange={(e) => setWechatAppSecret(e.target.value)} />
                     </div>
                  
                     <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            给应用起个好名字
                          </p>
                        </div>
                        <input type="text" value = {name}
                        className="input-main" 
                        onChange={(e) => setName(e.target.value)} />
                     </div>
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                           使用AI模型和用户沟通
                          </p>
                        </div>
                        <input type="text" value = {appChatWithAI}
                        className="input-main" 
                        onChange={(e) => setAppChatWithAI(e.target.value)} />
                      </div>     
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                           给关注用户发送邀请二维码
                          </p>
                        </div>
                        <input type="text" value = {sendInviteQR}
                        className="input-main" 
                        onChange={(e) => setSendInviteQR(e.target.value)} />
                      </div>  
                  
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                           选择微信公众号使用的小模型
                          </p>
                        </div>
                        <DropDown
                          theme={modelId}
                          // @ts-ignore
                          setTheme={(newTheme) => setModelId(newTheme)}
                          themes={modelIDs}
                          names={modelNames}
                        />
                      </div>     
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                           选择微信公众号使用的媒体模型
                          </p>
                        </div>
                        <DropDown
                          theme={chatMediaModelId}
                          // @ts-ignore
                          setTheme={(newTheme) => setChatMediaModelId(newTheme)}
                          themes={modelIDs}
                          names={modelNames}
                        />
                      </div>     
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            启动绘图功能的前缀词
                          </p>
                        </div>
                        <input type="text" value = {drawPrefix}
                        className="input-main" 
                        onChange={(e) => setDrawPrefix(e.target.value)} />
                     </div>
    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            生成图片上的水印（可选）
                          </p>
                        </div>
                        <input type="text" value = {imageWatermark}
                        className="input-main" 
                        onChange={(e) => setImageWatermark(e.target.value)} />
                     </div>
                  
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                           选择微信公众号使用的绘图模型
                          </p>
                        </div>
                        <DropDown
                          theme={text2imgModel}
                          // @ts-ignore
                          setTheme={(newTheme) => setText2imgModel(newTheme)}
                          themes={rooms}
                          names={roomNames}
                        />
                      </div>   
    
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  语音发声人
                              </p>
                          </div>
                          <DropDown setTheme={(newTheme) => setSpeaker(newTheme)}
                              theme={speaker} themes={vModelCodes} names={vModelNames}                     
                          />                      
                     </div>
                  
    
    
                     <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            微信服务号令牌(Token)
                          </p>
                        </div>
                        <input type="text" value = {wechatServiceToken}
                        className="input-main" 
                        onChange={(e) => setWechatServiceToken(e.target.value)} />
                     </div>
                    
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-4 items-center space-x-3">
                           <p className="text-left font-medium">
                            微信公众号的菜单
                          </p>
                        </div>
                        <TextareaAutosize  
                          style={{ borderRadius: "8px", height: 200, borderColor:'green'}  }        
                          maxRows={40}
                          className="input-main " 
                          value={wechatServiceMenu}
                          onChange={(e) => setWechatServiceMenu(e.target.value)} />
                     </div>
                  
                      <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-4 items-center space-x-3">
                           <p className="text-left font-medium">
                            关注公众号的欢迎信息
                          </p>
                        </div>
                        <TextareaAutosize  
                          style={{ borderRadius: "8px", height: 200, borderColor:'green'}  }        
                          maxRows={40}
                          className="input-main " 
                          value={appWelcomeMsg}
                          onChange={(e) => setAppWelcomeMsg(e.target.value)} />
                     </div>
    
                     <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                            关注公众号的欢迎文章
                          </p>
                        </div>
                        <input type="text" value = {appWelcomeArticle}
                        className="input-main" 
                        onChange={(e) => setAppWelcomeArticle(e.target.value)} />
                     </div>
                  
                  {loading ? (
                    <button
                      disabled
                      className="button-gold rounded-full text-white font-medium px-4 pt-2 pb-3 mt-8 w-40"
                    >
                      <span className="pt-4">
                        <LoadingDots color="white" style="large" />
                      </span>
                    </button>
                  ):(
                      <button
                        onClick={() => {
                          if(id){
                              updateApp();
                          }else{
                              createApp();
                          }
                        }}
                 
                        className="button-gold rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition"
                      >
                          { id ? "更新微信公众号应用" : "创建微信公众号应用" }
                      </button> 
                    )
                  }
                  {error && (
                    <div
                      className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]"
                      role="alert"
                    >
                      <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                          { id ? "更新应用时发生错误" : "创建应用时发生错误" } 
                      </div>
                      <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                        {error}
                      </div>
                    </div>
                  )}
                  
                </div>
    
           </main>
      </TopFrame>
      );
  }else{
    return(
      <LoginPage config={config}/>
        );
  }
    
};

      

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let appId = ctx?.query?.appId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let userId = "";
 
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        let user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(user){
            userId = user.id;
        }
    }
    
    let app = null;
    let model = null;
    if(appId){     
        app = await prisma.application.findUnique({
            where: {
              id: appId,
            },
        });
        if(app){
            model = await prisma.model.findUnique({
                where: {
                    id: appId,
                },
            });
        }
    }  
    
    let cModels = await prisma.model.findMany({
        where: {
            func: "chat",
            userId: userId,
            status: "FINISH"
        },
        orderBy: [ 
            { name: 'asc' },
            { createTime: 'desc' }
        ],
        
    });

    let vModels = await prisma.model.findMany({
        where: {
            func: "voice",
            userId: userId,
            status: "FINISH"
        },
        orderBy: [
            { name: 'asc' },
            { createTime: 'desc'}
        ],
        
    });
    
    return {
        props: {
            app,
            cModels,
            vModels,
            model,
            config
        },
    };
  
}    
