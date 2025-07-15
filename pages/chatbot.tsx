// import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Link from "next/link";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { Component } from 'react';
import { memo, useMemo } from "react";

import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import Image from "../components/wrapper/Image";


import {hasSensitiveWord} from "../utils/sensitiveWords";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { User,Talk,Model } from "@prisma/client";
import { isMobile } from "react-device-detect";
// import EventSource from 'eventsource';
import {createDefModel} from './api/trainChatModel';
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks';
import remarkSmartypants from 'remark-smartypants';
import remarkRehype from 'remark-rehype';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import { speakers, speakerCodes, speakerNames, getSpeakerByCode } from "../utils/speakers";
import * as debug from "../utils/debug";
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";


const RichText = ({ markdownContent }: { markdownContent: string }) => {
    return ( 
        <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, rehypeKatex ]} 
            rehypePlugins={[rehypeRaw]}
            className="px-2 w-full overflow-auto text-truncate" 
            children={markdownContent} />
    );
};


type ImageComponentProps = {
    src: string;
    className?: string;
    width?: string | number;
    height?: string | number;
    alt?: string;
};


const ImageComponent = memo(({ src, className, width, height, alt } : ImageComponentProps) => {
    const imgElement = useMemo(() => (
        <img src={src} className={className} width={width} height={height} alt={alt} />
    ), [src, className, width, height, alt]);
    
    return imgElement;
});


interface TalkRecord {
    talkId:string;
    role:string;
    content:string;
    name:string;
    userCover:string;
    createdAt:Date;
};

function appendTalk(history:TalkRecord[], talk:any, atFirst?:boolean){
    const im = JSON.parse(talk.inputMsg); // 用户输入信息
    const om = JSON.parse(talk.outputMsg); // 系统返回信息
    const ask = {
        talkId: talk.id,
        role : im.messages ? im.messages[im.messages.length-1].role : im.role, // 最后一条记录是刚才输入的记录
        content : im.messages ? im.messages[im.messages.length-1].content : im.content,
        name: talk.userId,  // openai用这个名字区分不同对话
        userCover: talk.user!.image ? talk.user!.image : "",
        createdAt: talk.createdAt,
    };

    const anwser = {
        talkId: talk.id,
        role : om.role,
        content : om.content,
        name: talk.userId,
        userCover: talk.user!.image ? talk.user!.image : "",
        createdAt: talk.createdAt,
    };

    if(atFirst){
        history.unshift(anwser);
        if(!ask.content.startsWith("#MEDIA#CHAT#") ){
            history.unshift(ask);
        }      
    }else{
        if(!ask.content.startsWith("#MEDIA#CHAT#") ){
            history.push(ask);
        }
        history.push(anwser);
    }
}


export async function getServerSideProps(ctx: any) {
    let modelId = ctx?.query?.model;
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let userId = "";
    let user:any;
    
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(user){
            userId = user.id;
            let userModel = user.model;
            
            // 通过这个方法给所有用户添加一个缺省的模型
            if(user.model == null || user.model.trim() == ""){
                const defModel = await createDefModel(user);
                
                if(defModel){
                    userModel = defModel.id;
                    debug.log("用户" + user.name + "创建了个人AI" + defModel.code + "/" + defModel.name);
                }      
            }
            
            if(!modelId && userModel && (userModel.trim() != "")){
                modelId = userModel;
            }
        }
    }
    monitor.logUserRequest(ctx, session, user);

    // 如果用户没有登录，或者用户还没有AI助理就先进chatAI
    if(!modelId || (modelId.trim()=="")){ modelId = "gpt-000000035"; }
    // 找到我训练的模型
    let myModels = await prisma.model.findMany({
        where: {
            func: "chat",
            status: "FINISH",
            userId: userId,  
        },
        orderBy: [
            { sysScore: 'desc', },
            { runtimes: 'desc', },                  
        ],
        take: 20
    });  
    
    // 找到我收藏的模型
    let favModels = await prisma.model.findMany({
        where: {
            func: "chat",
            status: "FINISH",
            access: "PUBLIC",  
            sysScore:  {
                gt: 10,
            },
            userId:{
                not:{
                    equals: userId,
                },
            },
        },
        orderBy: [
            { sysScore: 'desc', },
            { runtimes: 'desc', },                   
        ],
    }); 
    
    // 所找本次对话的角色模型
    let model = null;
    if(modelId){
        model = await prisma.model.findUnique({
            where: {
                id: modelId,
            },
        });
    }
    
    // 所找到自己的所有聊天记录
    const cond = (model && (model.theme == "WALL")) ? 
        {
            status: "SUCCESS",
            model: model ? model.code : "gpt-3.5-turbo",
        } : 
        {
            status: "SUCCESS",
            model: model ? model.code : "gpt-3.5-turbo",
            userId: userId,
        };
        let talks = await prisma.talk.findMany({
            where: cond,
            orderBy: {
                createdAt: 'desc',
            },    
            take: 10,
            include: {
                user: true,
            }
        });
    
    let history:TalkRecord[] = [];
    if(talks){
        talks.forEach((talk) => {
            appendTalk(history, talk, true);
        });
    }

    return {
        props: {
            userId,
            model,
            history,
            myModels,
            favModels,
            lastTime:new Date(Date.now()),
            config,
        },
    }
}  


export default function chatbot({ userId, history, model, myModels, favModels, lastTime, config }: 
                                  { userId:string, 
                                   history: TalkRecord[],
                                   model:Model, myModels:Model[],  favModels:Model[], lastTime:Date, config:any }) {
    
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    const [prompt, setPrompt] = useState("");
    const [hideMsg, setHideMsg] = useState("");
    const [context, setContext] = useState<TalkRecord[]> (history);
    const [allHistoryLoaded, setAllHistoryLoaded] = useState(!(history && history.length>=20));  
    let tizi = ( model && model.price && model.price>=0 ) ? model.price : 0;
    const showModels = false;
    // let audio:any;
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

    
    useEffect(() => {
        if (model) {
            const t = {
                talkId: "hello",
                role: "hello",
                content: (model && model.desc && model.desc.trim().length>0) ? model.desc : ("你好！我是" + model.name + "。请问有什么事情吗？"),
                name: "hello",
                userCover: (model && model.coverImg) ? model.coverImg : config.logo32,
                createdAt: new Date(Date.now()),
            };
            context.push(t);
            scrollMsgToEnd();            
        }
    }, [model]);
    
    // 如果不是显示模型列表，就滚动到最下面
    if(!(router && router.query && router.query.onlyShowModel)){
        // scrollMsgToEnd();
    }

    if(model && model.theme=="WALL"){
        useEffect(() => {
            const interval = setInterval(() => {
                loadNewTalks();
            }, 5000);
            return () => clearInterval(interval);
        }, []);
        // 空数组表示只在组件挂载时执行一次
    }

    function scrollMsgToEnd(){
        const scrollDiv = document.querySelector('#divMessages');
        if(scrollDiv){
            scrollDiv.scrollTop = scrollDiv.scrollHeight;
        }
    }

    function appendMessage(){
        
    }

    async function asyncLog(txt:string){
        debug.log(txt);
    }
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //发送消息
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function sendMessage(inputText:string){
        if(data.remainingGenerations < tizi){
            alert("您的" + config.creditName + "数量不足，请先购买" + config.creditName + "。");
            window.location.href = "/buy-credits";
            return;
        }
        
        if(!inputText || inputText.length<1){
            alert("请先输入想问我的内容吧！");
            return;
        }

        if(!inputText || inputText.length>5000){
            alert("每次输入的内容不能大于5000个字符，请简化一下你的问题吧！");
            return;
        }    
        
        if(status != "authenticated"){
            alert("请先登录，再开始对话");
            window.location.href = "/loginChoice?originalUrl=/loginChoice";
            return;
        }
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);    
        // 准备输入的数据
        let input:TalkRecord = {
            talkId: "",
            role : "user",
            content : inputText,
            name: data.currentUserId,
            userCover: data.image,
            createdAt: new Date(Date.now()),
        };
    
        const messages:{role:string, content:string, name:string}[] = [];
    
        // 压入当前的问题
        messages.push({
            role: input.role,
            content: input.content,
            name: data.currentUserId,
        });         
        // 将输入数据压入历史上下文
        context.push(input);
        
        // 屏幕滚动到最下方
        window.scrollTo(0, document.body.scrollHeight);
    
        setPrompt("");

        const isDraw = input.content.trim().startsWith("画");
        const isMediaMatch = input.content.startsWith("#MEDIA#CHAT#");
        
        let service = "/api/chat"; 
        if(isDraw){
            service += "?CMD=draw";
        }else if(isMediaMatch){
            service += "?CMD=mediaMatch";
        }else{
            service += "?CMD=prepareChat";
        }
        
        try{
            const res = await fetch(service, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: messages, modelId:(model ? model.id : "")
                }),
            });        
            
            if (res.status === 200) {                
                let response = await res.json();
                let current = (!isDraw && !isMediaMatch) ? 
                  {
                      talkId: response,
                      role : "assistant",
                      content : "", 
                      name: data.currentUserId,
                      userCover: data.image,
                      createdAt: new Date(Date.now()),
                  } :
                  {
                      talkId: response.talkId,
                      role : response.role,
                      content : response.content,
                      name: data.currentUserId,
                      userCover: data.image,
                      createdAt: new Date(Date.now()),
                  };
                context.push(current);
                input.talkId = current.talkId;

                // 如果是文字信息
                if(!isDraw && !isMediaMatch){
                    // 开始陆续接收内容
                    const streamUrl = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + 
                                    "/api/chat?CMD=chatStream&key=" + response;
                    debug.log(streamUrl);
                    
                    const source = new EventSource(streamUrl);
                    source.onmessage = (event) => {
                        if(event.data.trim().indexOf('[DONE]') < 0){
                            const retMsg = JSON.parse(event.data);
                            asyncLog(retMsg.content);
                            current.content = current.content + retMsg.content; 
                            setHideMsg(current.content); 
                            // setPrompt(current.content);
                            // document.getElementById("idTmp")!.insertAdjacentHTML("beforeend", "<li>" + retMsg.content + "</li>");
                        }else{
                            debug.log("[DONE]");
                            source.close();
                            setLoading(false);
                            scrollMsgToEnd(); 
                        }
                    };
                    
                    //source.addEventListener('message', function (e) {
                    //  debug.log(e.data)
                    //})   
                    
                    source.onopen = function(){
                        asyncLog("event source is opened");
                    };
                    source.onerror = function(){
                        asyncLog("sth is wrong");
                    };
                }else{
                    setTimeout(() => {
                        setLoading(false);
                    }, 200);   
                }       
                mutate();
                scrollMsgToEnd(); 
                
            }else if(res.status == 201){ 
                // 没有内容返回
                setTimeout(() => {
                    setLoading(false);
                }, 200);   
                mutate();
                scrollMsgToEnd();                 
                return;
            }else if(res.status == 401){
                alert("请先登录，再开始对话");
                window.location.href = "/loginChoice";
                return;
            }else if(res.status == 402){
                alert("您的" + config.creditName + "数量不足，请先购买" + config.creditName);
                window.location.href = "/buy-credits";
            }else{
                alert("系统发生未知错误，请和管理员联系！");
                return;
            }

        }catch(e){
            alert("系统对话发生未知错误，请和管理员联系");
            debug.error(e);
        }
  }

    ///////////////////////////////////////////
    // 定义消息行
    // 用户可以删除自己的聊天。模型创建者可以删除所有的聊天
    const modelIcon = model ? model.coverImg : config.defaultModelImage;
    
    const Message = ({id, talkId, talkUserId, userCover, role, text, isSent } :
                     {id:string, talkId:string, talkUserId:string, userCover:string, role:string, text:string, isSent:boolean}) => {
        
        const messageClass = isSent ? ' text-msg-user ' : ' text-msg-assistant ';
        // 这里是为了兼容老数据。新数据都变成一个JSON
        let room: {roomUrl:string, roomId?:string} =  {roomUrl:text};
        if(role=="image"){
            try{
                room = JSON.parse(text);
            }catch(e){
                room = {roomUrl:text};
            }
        }
        
        return (
            <div className="group w-full flex items-center flex-row">
                <div id={id} className={`relative group inline-block p-2 rounded-xl text-left flex flex-row mb-4 w-4/5 mx-2 my-1 ${messageClass}`}>
                    {isSent ? (
                    <ImageComponent
                        src={userCover || `${config.RS}/icon/human.jpg`}
                        className="items-center w-7 h-7"
                        width={30}
                        height={30}
                        alt="人类"
                        /> 
                    ) : (
                    <ImageComponent
                        src={modelIcon}
                        className="items-center  w-7 h-7"
                        width={30}
                        height={30}
                        alt="AI"
                        />         
                    )}
                    
                    { role=="image" ? (
                    <>
                        { Array.isArray(room) ? (
                        <div className="grid grid-flow-row-dense grid-cols-1 gap-1 sm:grid-cols-2">
                            { room.map((img) => (
                            <Link href= { img.roomId ? ( img.type=="AI" ? ru.getImageRest(img.roomId) : img.roomUrl ) : "#"}>
                                <ImageComponent
                                    src={img.roomUrl}
                                    className="w-512 px-2"
                                    width={512}
                                    height={512}            
                                    alt="用户生成的图片"
                                    />
                            </Link>   
                            ))}
                        </div>
                        ) : (
                        <Link href= { room.roomId ? ru.getImageRest(room.roomId) : "#"}>
                            <ImageComponent src={room.roomUrl}
                                className="w-512 px-2"
                                width={512}
                                height={512}            
                                alt="用户生成的图片"
                                />
                        </Link>
                        )}
                    </>
                    ) : (
                    <RichText markdownContent={text} />
                    )}
                    
                    { (((role != "hello") && (talkUserId == userId)) || (model && (userId == model.userId)) ) && (
                    <button onClick={() => {
                        deleteTalk(talkId);
                    }}
                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-300 hidden group-hover:block hover:text-red-500">
                        <span className="sr-only">删除</span>
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                        </svg>
                    </button>      
                    )}
                </div>
                {config.websiteName == "aiputi" && (
                <div className="flex items-center hidden group-hover:block">                
                    {reading ? (
                    <button className="rounded-xl bg-gray-200 w-6 h-6 mx-1 items-center justify-center"
                        onClick={() => {
                            if(audio){
                                audio.pause();
                                setReading(false);
                            }
                        }}    
                    >
                        <LoadingDots color="white" style="small" />
                    </button>                            
                    ) : (                        
                    <button className="rounded-xl w-6 h-6 mx-1 items-center justify-center"
                        onClick={() => {
                            readText(text, isSent?"MAN":"WOMAN");
                        }}
                    >
                        <img src="/icons/speaker.jpg" className="rounded-xl w-6 h-6 mx-1 items-center justify-center" />
                    </button>                            
                    )}                        
                </div>
                )}
            </div>
        );
    };

    async function readText(content:string, role:string="WOMAN"){
        if(!content){
            return;
        }
      
        await new Promise((resolve) => setTimeout(resolve, 200));
        setReading(true);          
        const code = role == "MAN" ? (process.env.DEFAULT_MAN_VOICE || "AZURE***zh-CN-YunyeNeural") 
            : (process.env.DEFAULT_WOMAN_VOICE || "AZURE***zh-CN-XiaorouNeural");
        
        try{
            let speaker = getSpeakerByCode(code);
            if(!speaker){
                return alert("系统没有配置发音人");
            }
            const body = { 
                func: "text2voice",
                price: 1,
                params: {
                    speaker: code,
                    content: content,
                    aiservice: speaker.aiservice,
                    language: speaker.language,
                    basePrice: speaker.basePrice,
                }
            };

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            
            if (res.status !== 200) {
                setError(await res.json() as any);
                return;
            } else {
                const response = await res.json();
                if(audio){
                    audio.pause();
                }
                const newAudio = new Audio(response.generated);
                newAudio.addEventListener('ended', () => {
                    setReading(false);                    
                });                
                newAudio.play();
                setAudio(newAudio);
                mutate();
            }
            setTimeout(() => {
            }, 1300);
        }catch(e){
            debug.error(e);
        }     
    }
    
    ////////////////////////////////////////
    // 加载更多20条历史聊天记录
    async function loadMoreHistory(){
        if(context && context.length>=20){
            let service = "/api/chatRecords";
            const res = await fetch(service, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: (model && (model.theme == "WALL")) ? undefined : userId,
                    firstTime: context[0].createdAt,
                    model: model ?  model.code : undefined,
                    CMD: "loadMoreHistory",
                }),
            });  
            
            if(res.status == 200 && context){
                const talks = (await res.json()).data as Talk[];
                talks.forEach((talk) => {
                    appendTalk(context, talk, true);
                });
                
                setAllHistoryLoaded(talks && talks.length<10);              
                setHideMsg(context[0].createdAt.toString());
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    
    ////////////////////////////////////////
    // 加载最新聊天记录
    async function loadNewTalks(){
        if(model && userId){
          let service = "/api/chatRecords";
          const res = await fetch(service, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({
                  userId: userId,
                  lastTime: lastTime,
                  model: model.code,
                  CMD: "loadNewTalks",
              }),
          });  
          
          if(res.status == 200 && context){
              const talks = (await res.json()).data as Talk[];
              
              talks.forEach((talk) => {
                  appendTalk(context, talk);
              });
              
              lastTime = new Date(Date.now());
              setHideMsg(lastTime.toString());
          }
        }
    }

    
    ////////////////////////////////////////
    // 删除聊天记录
    async function deleteTalk(talkId:string){
        if(talkId && talkId.trim() != ""){
            let service = "/api/chatRecords";
            const res = await fetch(service, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    talkId: talkId,
                    CMD: "delete",
                }),
            });  
            
            // 删除成功就把这个talk的前台记录也删除
            if(res.status == 200 && context){
                let index = 0;
                let del = null;
                
                while(index < context.length){
                    const talk = context[index];
                    if(talk.talkId == talkId){
                        const del = context.splice(index, 1)[0];
                        const divToRemove = document.getElementById(talk.role + talk.talkId);
                        //            if(divToRemove && divToRemove.parentNode){
                        //              divToRemove.parentNode.removeChild(divToRemove);
                        //            }
                        if(divToRemove && divToRemove.style){
                            divToRemove.style.display = "none"; //将其显示属性设置为“none”
                        }
                    }else{
                        index++;
                    }
                }
            }
        }
    }  





    
    
    
    
    if(status == "authenticated"){
    
    return (
        <TopFrame config={config}>
            
            <div  className={router?.query?.hideHeader ? "w-full flex flex-1 overflow-auto flex-col mt-1" : "w-full flex flex-1 overflow-auto flex-col"}>
                <div className="flex flex-col items-center">
                    {!(router && router.query && router.query.onlyShowModel) && (
                    <h1 className="sm:title-main text-gray-100 justify-center text-base sm:text-xl flex flex-row">
                        <span className="sm:title-light">{model ? ((model.userId == userId && model.theme == "myDefModel" && model.baseModel) ? (model.baseModel.indexOf("deepseek")>=0 ? "我的DeepSeek助理" : "我的AI助理") : model.name) : "ChatGPT"}</span>
                        <Link href="#" className="sm:hidden block"
                            onClick={(e) => {
                                e.preventDefault();                  
                                window.location.href= "/chatbot?onlyShowModel=true";
                            }}   >
                            [<span className="sm:title-light "><u>更多</u></span>]
                        </Link>
                    </h1>
                    )}
                    
                    {status === "authenticated" && data && tizi>0 && (
                    <p className="text-gray-400 text-sm">
                        每次对话需要<span>{tizi}个{config.creditName}/千字。</span>  
                        
                        {data.remainingGenerations < tizi && (
                        <span>
                            购买更多{config.creditName}
                            <Link href="/buy-credits" className="text-green-100 underline underline-offset-2 hover:text-gray-100 transition">
                                在这里
                            </Link>。
                        </span>
                        )}
                    </p>
                    )}
                </div> 

                <div className="flex grow flex-row overflow-auto w-full bg-gray-300" >

                    {showModels && (
                    <div className={ (router && router.query && router.query.onlyShowModel) ? "flex flex-col w-full bg-black":"flex flex-col overflow-auto w-1/6 hidden sm:block bg-black" } >
                        <div className="flex flex-row justify-between px-2 w-full bg-gray-800 text-base text-gray-100 py-2 ">
                            我的AI模型
                            <Image
                                width="25" height="25"
                                src={ `${config.RS}/icon/setup_b_mini.jpg`}
                                className="cursor-pointer"
                                alt="训练私人AI模型"
                                onClick={() => {
                                    window.location.href= myModels.length>0 ? "/dashboard?segment=MODEL" : "/createChatModel";
                                }}  
                                />
                        </div>
                        { myModels && myModels.map((m) => (
                        <Link className="group flex flex-row bg-black hover:bg-gray-800 py-1" href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.location.href= "/chatbot?model="+m.id;
                            }} 
                            >
                            <Image
                                alt={m.name}
                                width={32}
                                height={32}
                                src={m.coverImg}
                                className=" object-cover mx-2 group-hover:bg-gray-800"
                                />
                            <p className="text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 px-2 bg-black group-hover:bg-gray-800 text-gray-100 text-base">
                                {(m.userId == userId && m.theme == "myDefModel" ) ? "我的AI助理" : m.name}
                            </p> 
                            {m && m.theme=="WALL" && (
                                <Image
                                    alt="一起问"
                                    width={20}
                                    height={20}
                                    src={ `${config.RS}/icon/group_b_mini.jpg` }
                                    className=" mx-2 pt-2 pb-2 group-hover:bg-gray-800"
                                    />        
                            )}                
                        </Link>
                        ))}     
                        
                        {(!myModels || myModels.length==0) && (
                        <div className="flex flex-row justify-center w-full text-base text-gray-100 text-center bg-black  py-2 rounded-xl">
                            <button className="button-white py-2 px-4"
                                onClick={() => {
                                    window.location.href= myModels.length>0 ? "/dashboard?segment=CHATMODEL" : "/createChatModel";
                                }} 
                                >
                                训练我的AI小模型
                            </button>
                        </div>
                        )}
                        
                        <div className="flex flex-row justify-between px-2 w-full bg-gray-800 text-base text-gray-100 py-2 ">
                            公开的AI模型
                        </div>
                        
                        { favModels && favModels.map((m) => (
                        <Link className="group flex flex-row bg-black hover:bg-gray-800 py-1"  href="#"          
                            onClick={(e) => {
                                e.preventDefault();                  
                                window.location.href= "/chatbot?model="+m.id;
                            }} >
                            <Image
                                alt={m.name}
                                width={32}
                                height={32}
                                src={m.coverImg}
                                className=" object-cover mx-2 group-hover:bg-gray-800"
                                />
                            <p className="text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 px-2 bg-black group-hover:bg-gray-800 text-gray-100 text-base">
                                {m.name}
                            </p>      
                            {m && m.theme=="WALL" && (
                                <Image
                                    alt="一起问"
                                    width={20}
                                    height={20}
                                    src={`${config.RS}/icon/group_b_mini.jpg` }
                                    className=" mx-2 pt-2 pb-2 group-hover:bg-gray-800"
                                    />        
                            )}
                        </Link>
                    ))}
                    </div>
                    )}

                    
                    {!(router && router.query && router.query.onlyShowModel) && (
                    <div className={"flex flex-col overflow-auto " + (showModels ? " flex-1 " : " w-full ")}>
                        <div id="divMessages" className="mt-5 px-2 relative w-full inline-block overflow-auto flex flex-1 flex-col">
                            {context && context.map((msg) => (
                            <Message id={msg.role+msg.talkId} role={msg.role} talkId={msg.talkId} talkUserId={msg.name} userCover={msg.userCover} text={msg.content} isSent={msg.role=="user"} /> 
                            ))}    
                            
                            {loading && (
                            <div className="w-full flex items-center px-2">
                                <button disabled className="button-main rounded-xl flex flex-col items-center text-white font-medium px-4 pt-2 pb-3 mt-8 w-100">
                                    <span className="pt-1">
                                        <LoadingDots color="white" style="large" />
                                    </span>
                                    <span  className="px-4 py-1 text-white font-medium">
                                        我正在思考你的问题，请耐心等待。
                                    </span>                    
                                </button>
                            </div>
                            ) }  
                            
                            { !allHistoryLoaded && (
                            <button className="absolute top-1 right-1 sm:right-2 z-20 w-12 sm:w-20 h-10 justify-center flex "
                                onClick={() => {
                                    loadMoreHistory();
                                }}>
                                <span className="sr-only">...</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#218C6C">
                                    <path d="M12 2L2 12h4v10h12V12h4L12 2z"/>
                                </svg>
                            </button>  
                            )}                 
                        </div>
                        
                        <div className="sticky z-999 bottom-0 left-0 bg-gray-100 w-full h-20 sm:h-40 shadow-md text-white items-center overflow-auto ">
                            <div className="w-full items-center text-center flex flex-col">
                                <div className="relative w-4/5 mt-2 mx-2 sm:mt-5 sm:mx-5 text-center items-center justify-center ">
                                    {/* 隐藏属性，只是为了通过更新数值来强制刷新 */}
                                    <input className="hidden" value={hideMsg}></input>
                                    
                                    {/* 输入框和发送按钮 */}
                                    <TextareaAutosize id="iptPrompt"  
                                        style={{ borderRadius: "8px" }  }        
                                        minRows={4} maxRows={5}  maxLength={5000}
                                        className="bg-white w-full text-black border border-gray-300 font-medium px-2 py-2 sm:px-4 sm:py-2 " 
                                        value={prompt}
                                        readOnly={loading}
                                        placeholder="输入你的问题。‘画’字开头生成图片" 
                                        onChange={(e) => {
                                            setPrompt(e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if(e.key == "Enter"){
                                                // 阻止默认的提交行为
                                                e.preventDefault();
                                                // 检查是否按下了 Ctrl 键
                                                if (e.ctrlKey || e.shiftKey || e.metaKey){
                                                    // 插入换行符
                                                    setPrompt(prompt + "\n");
                                                } else {
                                                    // 执行回车键按下后的操作
                                                    sendMessage(prompt);
                                                    // .then(() => {
                                                        //  sendMessage("#MEDIA#CHAT#" + prompt);
                                                    //});
                                                }    
                                            }
                                        }}  
                                        />              
                                    
                                    <button className="absolute top-0 right-0 z-10 w-8 h-8 mt-2 flex align-center items-center justify-center text-gray-800 hover:text-red-500"
                                        onClick={async () =>{
                                            sendMessage(prompt);
                                            //.then(() => {
                                                // sendMessage("#MEDIA#CHAT#" + prompt);
                                            //});
                                        }}>
                                        <span className="sr-only">发送</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="#218C6C">
                                            <polygon points="0,0 7,7.5 0,15"/>
                                        </svg>
                                    </button>     
                                </div>      
                                
                                <div id="idTmp" className="hidden relative w-4/5 text-left items-left ">
                                    <Link href="/dealLongText" className="text-sm text-gray-500 underline">
                                        写摘要，写论文，写演讲稿，审阅合同...
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}    
                
                </div>
            </div>
        </TopFrame>
    );
    
    }else{
        return(<LoginPage config={config}/>);
    }
      
};
