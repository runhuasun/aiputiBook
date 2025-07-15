import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { UploadDropzone } from "react-uploader";
import { Uploader, UploadWidgetLocale } from "uploader";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import { PrismaClient } from '@prisma/client'

import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User, Room, Prompt } from "@prisma/client";
import prisma from "../lib/prismadb";
import { GenerateResponseData } from "./api/generate";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import ErrorPage from "../components/ErrorPage";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import Genhis from "../components/Genhis";
import DropDown from "../components/DropDown";
import LoginPage from "../components/LoginPage";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import ResultButtons from "../components/ResultButtons";
import AutoSizeImage from "../components/AutoSizeImage";
import DrawRatioSelector from "../components/DrawRatioSelector";
import Image from "../components/wrapper/Image";

import {replaceParam, parseParams} from "../utils/formularTools";
import {channelType, channels, channelNames  } from "../utils/channels";
import { rooms, roomNames  } from "../utils/modelTypes";
import * as ru from "../utils/restUtils";
import downloadPhoto from "../utils/fileUtils";
import { config } from "../utils/config";
import { callAPI, callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";



export async function getServerSideProps(ctx: any) {
    let l = ctx?.query?.prompt;
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let userId = "";
    let user:any;
    
    // 判断是否是模型的主人
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                credits: true,
            },
        });
        if(user){
            userId = user.id;
        }
    }

    // 从数据库里找到对应的提示词
    let promptApp:any;
    let imghis:any[] = [];    
    
    if(l){
        promptApp =  await prisma.prompt.findUnique({
            where: {
                code: l,
            },
            include: {
                user: true,
            },
        });  
        imghis = await prisma.room.findMany({
            where: {
                //        func: promptApp==null? "text2img_sd2.1" : promptApp.func,
                model: l,
                status: "SUCCESS",
                OR:[
                    {access: "PUBLIC",   sysScore:  { gt: 3 },},         
                    {userId: userId,},
                ],
            },
            orderBy: {
                createdAt: 'desc',
            },    
            include: {
                user: true,
            },
        });
    }
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            imghis,
            promptApp,
            userId,
            config
        },
    };
}  



export default function runPromptApp({ imghis, promptApp , userId, config}: 
                                     { imghis: (Room & { user: User; })[], promptApp: (Prompt & {user:User}), userId: string, config:any}) {
    const router = useRouter();
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    let defaultDrawRatio = router.query.drawRatio as string;
    const [drawRatio, setDrawRatio] = useState<string>(defaultDrawRatio ? defaultDrawRatio : "916");
    
    const [param1, setParam1] = useState("");
    const [param2, setParam2] = useState("");
    const [param3, setParam3] = useState("");
    const [restoredId, setRestoredId] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
  
    const params = (promptApp?.formular) ? parseParams(promptApp.formular) : [];
    const [room, setRoom] = useState<string>(promptApp?.func || "sdxl-lighting");

    
    async function setCoverImg(imgUrl: string | null){
        if(imgUrl==null || imgUrl.trim()==""){
            alert("程序出错，没有这张图片，请重新指定封面图片");
            return;
        }
        const res = await callAPI("/api/createPrompt", 
                                  { id:promptApp?.id, coverImg:imgUrl, cmd:"COVERIMG"}
                                 );
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            window.location.reload();
        } 
    }
  
    
    async function generatePhoto(fileUrl: string) {
        setError(null);
    
        let realText = (promptApp?.formular) ? promptApp.formular : "";
        
        // 所有的输入框变成可选
        let inputText = " ";
        if(params.length >0){
            if(param1==null || param1.trim()==""){
                realText = replaceParam(realText, params[0][0], "");
                inputText = "";
            }else{
                realText = replaceParam(realText, params[0][0], param1);
                inputText = param1;
            }
        }
    
        if(params.length >1){
            if(param2==null || param2.trim()==""){
                realText = replaceParam(realText, params[1][0], "");
            }else{
                realText = replaceParam(realText, params[1][0], param2);
                inputText += ','+param2;
            }
        }
    
        if(params.length >2){
            if(param3==null || param3.trim()==""){
                realText = replaceParam(realText, params[2][0], "");
            }else{
                realText = replaceParam(realText, params[2][0], param3);
                inputText += ','+param3
            }
        }
    
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "createPrompt", 
                params: {
                    func: room,                     
                    drawRatio, 
                    imageUrl: fileUrl, 
                    inputText:inputText, 
                    realText:realText, 
                    modelurl: promptApp?.code
                }
            },
            "生成图片",
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            }                
        );

    }


    if(status == "authenticated" && promptApp?.user){
        return (
            <TopFrame config={config}>
               <main>
                    <div className="w-full items-center text-center">
                        <h1 className="title-main">
                            <span className="title-light">“{promptApp.name}”</span> 
                        </h1>
                        
                        <div className="hidden sm:block"> 
                            <Link className="w-full justify-center text-lg flex" href={"/userPage?userId="+promptApp.userId}>
                                <Image
                                    alt="作者"
                                    src={promptApp.user.image? promptApp.user.image : "https://fileserver.aiputi.cn/sd_logo.jpg"}
                                    className="w-6 h-6 rounded-full"
                                    width={20}
                                    height={20}
                                    />
                                <p className="text-white text-left px-2">
                                    { promptApp.user.name }
                                </p>  
                            </Link>
                        </div>
                    </div>
              

                    <div className="w-full max-w-lg px-2 sm:px-8 flex items-center flex-col justify-top mt-4">
                        
                        <div className="space-y-3 w-full mb-5">
                            <FormLabel number="1" label="AI绘画引擎"/>
                            <DropDown
                                theme={room}
                                // @ts-ignore
                                setTheme={(newRoom) => setRoom(newRoom)}
                                themes={rooms}
                                names={roomNames}
                                />
                        </div>

                        <div className="space-y-4 w-full mb-5">
                            <FormLabel number="2" label="绘图输出比例"/>
                            <DrawRatioSelector onSelect={(newRoom) => setDrawRatio(newRoom)} />
                        </div>
                
                        {params.length > 0 && (
                         
                          <div className="space-y-4 w-full ">
                            <FormLabel number="3" label={params[0][0]}/>
                            <input id="iptParam1" type="text" value={param1}
                              placeholder = {"比如：" + params[0][1]}
                            className="input-main" 
                            onChange={(e) => setParam1(e.target.value)} />      
                           </div>
                          
                        )}
                
                        {params.length > 1 && (
                         
                          <div className="space-y-4 w-full ">
                            <FormLabel number="4" label={params[1][0]}/>
                            <input id="iptParam1" type="text" value={param2}
                              placeholder = {"比如：" + params[1][1]}
                            className="input-main" 
                            onChange={(e) => setParam2(e.target.value)} />
      
                           </div>
                          
                        )}                  
         
                        {params.length > 2 && (
                         
                          <div className="space-y-4 w-full ">
                            <FormLabel number="5" label={params[2][0]}/>
                            <input id="iptParam1" type="text" value={param3}
                              placeholder = {"比如：" + params[2][1]}
                            className="input-main" 
                            onChange={(e) => setParam3(e.target.value)} />
                           </div>
                        )}  
                    </div>

                    <div className="w-full px-2 flex flex-col items-center mt-4">
                      
                        <div className="w-full sm:w-1/2 border border-gray-300 border-dashed px-2 rounded-xl">
                            <p className="w-full text-left text-lg text-black-300 mt-4">
                                提示词：
                            </p>
                            <p className="w-full text-left text-lg text-black-300 mt-4 mb-4">
                                “{promptApp.formular}”
                            </p> 
                        </div>   
                      
                         {status === "authenticated" && data &&  ( 
                          <PriceTag config={config}  />
                          )}   
          
                          {loading ?  (
                          <LoadingButton/>
                          ) : (                  
                            <StartButton config={config} title="生成新的作品"
                              onStart={() => {
                                generatePhoto("");
                              }}
                            />
                         )}                                
                    
                    </div>
                  
                    
                    <div id="create" className="flex justify-between items-center sm:w-1/2 w-full flex-col mt-4 ">
                        {error && (
                        <MessageZone message={error} messageType="ERROR"/>
                        )}       
                        {restoredImage && (
                        <div className="flex  mt-3 sm:space-x-4 sm:flex-row flex-col">
                            <div className="sm:mt-0 mt-8">
                                <Link href={ru.getImageRest(restoredId)} target="_blank">
                                    <Image  alt="restored photo"  src={restoredImage}  className="h-auto w-auto rounded-2xl relative sm:mt-0 mt-2"
                                        onLoadingComplete={() => setRestoredLoaded(true)}
                                        />
                                </Link>
                            </div>
                        </div>
                        )}  
                        { restoredLoaded && ( 
                        <div className="flex space-x-2 justify-center items-center flex-col">
                            <div  className="items-center flex flex-row space-x-3 justify-center">
                                <button className="button-main rounded-full text-black border font-medium px-4 py-2 mt-8 hover:bg-gray-100 transition"
                                    onClick={() => {
                                        downloadPhoto(restoredImage!);
                                    }}
                                    >
                                    下载照片
                                </button>
                                { promptApp.userId == data.currentUserId && (
                                <button className="button-main rounded-full text-black border font-medium px-4 py-2 mt-8 hover:bg-gray-100 transition"
                                    onClick={() => {
                                        setCoverImg( restoredImage );
                                        alert("封面设置成功");
                                    }}
                                    >
                                    设为封面
                                </button>
                                )}    
                            </div>
                        </div>
                        )}
                        
                    </div>
                </main>
                <Genhis imghis={imghis} userId={userId}/>
            </TopFrame>
        );
    }else{
        return( <LoginPage config={config}/>  );
    }

};

