import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import TextareaAutosize from "react-textarea-autosize";

import { User,Room, Model } from "@prisma/client";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { GenerateResponseData } from "./api/generate";
import prisma from "../lib/prismadb";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import {showRoom, publicRoom} from "../components/Genhis";
import PromptArea from "../components/PromptArea";
import SysPrompts from "../components/SysPrompts";
import LoginPage from "../components/LoginPage";
import Uploader, {mimeTypes} from "../components/Uploader";
import ComboSelector from "../components/ComboSelector";
import PromptSelector from "../components/PromptSelector";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import ResultButtons from "../components/ResultButtons";
import LoadingRing from "../components/LoadingRing";
import AutoSizeImage from "../components/AutoSizeImage";
import PromptAssistant from "../components/PromptAssistant";
import DrawRatioSelector from "../components/DrawRatioSelector";
import ModelSelector from "../components/ModelSelector";
import ToolBar from "../components/ToolBar";
import ResultView from "../components/ResultView";
import InputImage from "../components/InputImage";

import {getThumbnail} from "../utils/fileUtils";
import { config, defaultImage } from "../utils/config";
import * as ru from "../utils/restUtils";
import downloadPhoto from "../utils/fileUtils";
import { roomType, rooms, themeType, themes, themeNames, roomNames  } from "../utils/loraTypes";
import {channelType, channels, channelNames  } from "../utils/channels";
import {callAPI, callAPI2} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as lu from "../utils/loginUtils";
import * as rmu from "../utils/roomUtils";
import * as debug from "../utils/debug";


export async function getServerSideProps(ctx: any) {
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    let modelCode = ctx?.query?.model || simRoomBody?.params?.modelurl;
  
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    
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
                actors: true,
            }
        });
    }

    // 从数据库里找到对应的模型
    let defaultModel = modelCode ? await prisma.model.findUnique({
        where: {
            code: modelCode,
        },
        include: {
            user: true,
        },
    }) : undefined;  

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody,
            defaultModel,
            user,
            config
        },
    }
}  


/*
const inferences = [
    "zylim0702 / sdxl-lora-customize-model",
    "lucataco / realvisxl2-lora-inference",
    "fofr / realvisxl-v3-multi-controlnet-lora",
    "alexgenovese / sdxl-lora",
    "batouresearch / sdxl-controlnet-lora",
    "lucataco / ssd-lora-inference",
];

const inferenceNames = new Map([
    ["zylim0702 / sdxl-lora-customize-model", "Stabel Diffusion XL"],
    ["lucataco / realvisxl2-lora-inference", "SDXL 全真世界2.0"],
    ["fofr / realvisxl-v3-multi-controlnet-lora", "SDXL 全真世界3.0"],
    ["alexgenovese / sdxl-lora", "SDXL 全真世界4.0"],
    ["batouresearch / sdxl-controlnet-lora", "SDXL Control Net"],
    ["lucataco / ssd-lora-inference", "SSD-1B"]
]);
*/
const inferences = [
    "omniedgeio / deepfashionsdxl",
    "zylim0702 / sdxl-lora-customize-model",
    "fofr / sdxl-multi-controlnet-lora",    
    "lucataco / realvisxl2-lora-inference",
    "fofr / realvisxl-v3-multi-controlnet-lora",
    "alexgenovese / sdxl-lora",
    "batouresearch / sdxl-controlnet-lora",
    "lucataco / ssd-lora-inference",
];

const inferenceNames = new Map([
    ["omniedgeio / deepfashionsdxl", "高清AI相机（慢）"],
    ["zylim0702 / sdxl-lora-customize-model", "标准AI相机"],
    ["fofr / sdxl-multi-controlnet-lora", "高级AI相机"],  
    ["lucataco / realvisxl2-lora-inference", "全真世界2.0 AI相机"],
    ["fofr / realvisxl-v3-multi-controlnet-lora", "全真世界3.0 AI相机"],
    ["alexgenovese / sdxl-lora", "全真世界4.0 AI相机"],
    ["batouresearch / sdxl-controlnet-lora", "带姿态控制的AI相机"],
    ["lucataco / ssd-lora-inference", "快速AI相机"]
]);




export default function lora({ simRoomBody, defaultModel, user, config }: { simRoomBody:any, defaultModel: any, user: any, config:any}) {
    const router = useRouter();
  
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredSeed, setRestoredSeed] = useState<string | null>(simRoomBody?.seed);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [photoName, setPhotoName] = useState<string | null>(null);
    const [theme, setTheme] = useState<themeType>((defaultModel?.theme || simRoomBody?.params?.theme || "FACE") as themeType);
    const [room, setRoom] = useState<roomType>(simRoomBody?.params?.room || "realistic");
    const [refImage, setRefImage] = useState<string>((router.query.imageURL || router.query.refImage || simRoomBody?.params?.imageUrl || "") as string);
    const [inference, setInference] = useState<string>(simRoomBody?.params?.inference || "lucataco / realvisxl2-lora-inference");    
    const [filter, setFilter] = useState<any>();    
    const chooseInference = !!router.query.chooseInference;
    
    const [seed, setSeed] = useState<string>(router.query.seed as string || simRoomBody?.params?.seed || "");    
    const [prompt, setPrompt] = useState<string>((router.query.prompt || simRoomBody?.params?.inputText || "") as string);
    
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [showMoreWords, setShowMoreWords] = useState<boolean>(false);
    const [sysPrompts, setSysPrompts] = useState<string>("");
    const [loraPrompt, setLoraPrompt] = useState<string>("");
    const [loraCover, setLoraCover] = useState<string>("");
    
    const [lora, setLora] = useState<any>(defaultModel);
    const [channel, setChannel] = useState<string>(router.query.channel as string || "FASHION");

    let hotWords = "NO_HOTWORDS";
    let loraTitle = "数字人";
    switch(lora?.channel || channel){
        case "FASHION": hotWords = "PHOTO_DESC"; break;
        case "DRAW": 
        case "COMIC":
        case "ART":
            loraTitle = "风格";
            hotWords = "NO_HOTWORDS";
            break;
    }
    
    const [demoRooms, setDemoRooms] = useState<any[]>([]);
    async function loadDemoRooms(){
        try{
            const res = await callAPI("/api/updateRoom", 
                                      {
                                          cmd:"GOTOPAGE", 
                                          pageSize:6, 
                                          currentPage:1,
                                          type:"IMAGE", 
                                          func: "lora",
                                          showBest: true,
                                          modelCode: lora?.code
                                      });
            if (res.status != 200) {
                alert(JSON.stringify(res.result as any));
            }else{
                setDemoRooms(res.result.rooms);
            }
        }catch(err:any){
            debug.log("error load demos:", err);
        }
    }
    
    useEffect( () => {
        if(lora){
            switch(lora.baseModel){
                case "alexgenovese / train-sdxl-lora":
//                    setInference("alexgenovese / sdxl-lora");
//                    break;                    
                case "zylim0702 / sdxl-lora-customize-training":
//                    setInference("zylim0702 / sdxl-lora-customize-model");
//                    break;
                case "lucataco / realvisxl2-lora-training":
                    setInference("lucataco / realvisxl2-lora-inference");
                    break;

                case "lucataco / ssd-lora-training":
                    setInference("lucataco / ssd-lora-inference");
                    break;
            }
            if(lora?.labels?.indexOf("女士")>0){
                setFilter({ gender: 0 });
            }else if(lora?.labels?.indexOf("男士")>0){
                setFilter({ gender: 1 });
            }
        }
    }, []);         
//    }, [lora]); 

    function isAdmin(){
        return user?.actors && user.actors?.indexOf("admin")>=0;
    }

    const [drawRatio, setDrawRatio] = useState<string>(router.query.drawRatio as string || simRoomBody?.params?.drawRatio || "916");
   
   
  async function setCoverImg(roomId: string | null){
      if(!roomId){
          alert("程序出错，没有这张图片，请重新指定封面图片");
          return;
      }
      
      if(lora == null || lora.id == null){
          alert("这是一个系统预置的模型，不能修改封面");
          return;
      }
  
      const res = await fetch("/api/updateModel", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
          },
          
          //  body: JSON.stringify({ modelId:lora.id, coverImg:imgUrl, cmd:"COVERIMG"}),  
          // 因为第一次传回的图片可能是原始图片在服务器的地址，不是上传到fileserver的地址，所以这里要传roomId，让后台去取一下图片在fileserver的地址
          body: JSON.stringify({ modelId:lora.id, roomId, cmd:"COVERIMG"}),        
      });

      let response = await res.json();
      if (res.status !== 200) {
          setError(response as any);
      } else {
          alert("封面已经被设置为当前画面！");
      } 
  }

    function useRefImage():boolean{
        return (inference != "lucataco / realvisxl2-lora-inference") && (inference != "zylim0702 / sdxl-lora-customize-model");
    }
  
    function isPositiveInteger(str: string): boolean {
        // 使用正则表达式匹配字符串是否为正整数，^表示开头，\d+表示匹配一个或多个数字，$表示结尾
        const regExp = /^\d+$/;
        return regExp.test(str);
    }

    function isFluxLora(){
        return lora?.trainSrv == "ostris / flux-dev-lora-trainer";
    }

    function isPreTrained(){
        return lora?.trainSrv == "pretrained";
    }

    function isPrompt(){
        return lora?.trainSrv == "prompt";
    }


    
    async function generatePhoto() {
     
      let infer = inference;

      if(!lu.checkLogin(
          status,
          [
              ["prompt", prompt],
              ["drawRatio", drawRatio],
              ["model", lora?.code],
              ["refImage", refImage]
          ]
          )
        ){
          return
      }

      if(!lora){
          if(config.websiteName == "aixiezhen" || config.websiteName == "niukit" || config.websiteName == "framuse"){
              return alert(`需要请您先选择一个${loraTitle}！`);
          }else{
              return alert("这个功能需要指定一个用户的模型，可能是您使用的链接有错误，请不要修改链接地址");
          }
      }

      if(infer == "batouresearch / sdxl-controlnet-lora" && !refImage){
          alert("使用sdxl-controlnet-lora模型要求必须输入一张参考图片");
          return;
      }         

      if(!useRefImage() && refImage){
          infer = "fofr / realvisxl-v3-multi-controlnet-lora";
      }
      
      if(seed && seed.trim()!="" && !isPositiveInteger(seed)){
          alert("图片种子必须是一个正整数，如果不知道用什么种子，可以不输入，系统会随机产生");
          return;
      }
      
      let inputText = `${prompt}, ${sysPrompts}`;
      let realText = ` ${prompt}. ${sysPrompts}`;
      //let realText = ( isPreTrained() ? "" : `${loraPrompt} . ` ) + ` ${prompt}. ${sysPrompts}`;
      if(isPrompt()){
          realText = `${lora.proMsg} . ${realText}`;
      }else{
          realText = `${loraPrompt} . ${realText}`;
      }
        
      setError(null);
      setRestoredId(null);      
      setRestoredImage(null);      
        /*
      let body:any;
      if(isPrompt()){
          body = { 
              cmd: "createPrompt", 
              params: {
                  func: lora.baseModel,                 
                  imageUrl: refImage, 
                  drawRatio, 
                  theme:"", 
                  realText: realText, 
                  inputText: inputText, 
                  seed: seed || String(Math.floor(Math.random() * 100000)), 
                  waitResultRetryTimes:50
              }
          }
      }else if(isPreTrained()){
          body = { 
              cmd: "createPrompt", 
              params: {
                  func: lora.code,                 
                  imageUrl: refImage, 
                  drawRatio, 
                  theme:"", 
                  realText: realText, 
                  inputText: inputText, 
                  seed: seed || String(Math.floor(Math.random() * 100000)), 
                  waitResultRetryTimes:50
              }
          }
      }else{
      */
       let body = { 
              cmd: "lora",
              params: {
                  inference:infer, 
                  loraCover: lora.coverImg,
                  imageUrl: refImage,
                  controlNet: "depth_midas",
                  theme, room, realText:realText, inputText: inputText, func: "lora", 
                  drawRatio, modelurl: lora.code, modelTheme:lora.theme, access: lora.access, seed:seed || String(Math.floor(Math.random() * 100000)),
                  waitResultRetryTimes:50
                },
          }

          
      const res = await callAPI2(
          "/api/workflowAgent2", 
          body,
          "拍摄",
          "IMAGE",
          (status:boolean)=>{setLoading(status)},
          (res:any)=>{
              mutate();
              setRestoredImage(res.result.generated);
              setRestoredId(res.result.genRoomId);        
              setRestoredSeed(res.result.seed);              
          }
      );
  }

    let title = "";

    useEffect( () => {
        debug.log("lora:", lora);
        if(lora){
            if(lora.params){
                setLoraPrompt(`${JSON.parse(lora.params)?.aPrompt || ""}`);
            }
            debug.log(`lora.cover: ${lora.coverImg}`);
            setLoraCover(lora.coverImg);
            
            loadDemoRooms();           
            if(lora.channel=="FASHION"){
                title = `模特商拍`;
            }else{
                title = `图像模特：“${lora.name}”`;
            }
        }
    }, [lora]);     

    let num = 1;
    
    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} imageURL={refImage} prompt={prompt}/>

                <div className="page-container">
                    <div className="page-tab-image-create">

                        {/* router?.query?.modelSelect!=="TRUE" && defaultModel ? (
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label={lora?.name}/>
                            <InputImage src={lora?.coverImg}/>
                            {lora && loraPrompt && (
                            <p className="w-full text-gray-400 text-sm text-wrap">
                               {`“${loraPrompt}”`}
                            </p>  
                            )}                            
                        </div>
                        ) : (
                        ) */}
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label={`挑选${loraTitle}`} onCancel={() => setLora(undefined)}/>
                            <InputImage src={loraCover}/>
                            {lora && loraPrompt && (
                            <p className="w-full text-gray-400 text-sm text-wrap">
                               {`“${loraPrompt}”`}
                            </p>  
                            )}                            
                            <div className="w-full flex flex-col items-center">
                                <ModelSelector onSelect = {(newFile) => {
                                    setLora(newFile);
                                }} title={`挑选${loraTitle}`} modelType="LORA" channel={channel}  />    
                            </div>     
                        </div>
                        

                      {lora && !isPreTrained() && !isFluxLora() && chooseInference  && ( //|| lora?.channel!="FASHION"
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label={"基础大模型"}/>
                            <DropDown
                                theme={inference}
                                // @ts-ignore
                                setTheme={(newRoom) => setInference(newRoom)}
                                themes={inferences}
                                names={inferenceNames}
                                />
                        </div>
                        )}
                    
                        <div className="space-y-4 w-full max-w-lg">
                            <FormLabel number={`${num++}`} label={"画面输出比例"}/>
                            <DrawRatioSelector defaultRatio={drawRatio} onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                        </div>

                        {/*
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <div className="flex mt-3 items-center space-x-3">
                                <Image
                                    src="/number-3-white.svg"
                                    width={30}
                                    height={30}
                                    alt="icon"
                                    />
                                <p className="text-left font-medium">
                                    图片种子（可选，不填写就随机生成）
                                </p>
                            </div>                  

                            <input id="iptSeed" type="text"  value={seed}
                                className="input-main" 
                                onChange={(e) => setSeed(e.target.value)} />  
                        </div>
                        */}
                        <div className="space-y-4 w-full max-w-lg">
                            <FormLabel number={`${num++}`} 
                                label="参考照片（可选）" 
                                hint="提醒：AI系统会优先表达小模型的训练主题内容，在可能的情况下参考该图片的内容和构图，未必会完全按照您提供的参考照片来出图。"
                                onCancel={()=>setRefImage("")}/>
                            <InputImage src={refImage}/>
                            <ComboSelector onSelect = {(newFile) => setRefImage(newFile)} selectorType="MODEL_POSE" selectorCode={lora?.code} showDemo={false} showIcon={true} />    
                        </div>

                        <div className="w-full max-w-lg space-x-3 flex flex-row">
                            <FormLabel number={`${num++}`} label="您的提示词"/>
                            { lora?.channel=="FASHION" && (
                            <PromptSelector 
                                onSelect = {(newFile) => {
                                    setPrompt(newFile.formular);
                                }} />  
                            )}

                            {status == "authenticated" && (                            
                            <PromptAssistant userPrompt={prompt} user={user} 
                                onUserPromptChange={(np)=>{
                                    setPrompt(np);
                                }}
                                onOK={(newPrompt)=>{
                                    setPrompt(newPrompt);
                                }}
                                />   
                                )}
                        </div>
                        
                        <div className="relative inline-block w-full mt-0">
                            <PromptArea
                                userPrompt={prompt}
                                onSysPromptChange={(sp) => setSysPrompts(sp) }
                                onUserPromptChange={(up) => setPrompt(up) }
                                hasAdvanceButton={true}
                                hotWords={hotWords}
                                />
                        </div>

                        <StartButton config={config} title="开始生成" funcCode="lora" model={lora} showPrice={true} loading={loading}
                            onStart={async () => {
                                generatePhoto();  
                            }}
                            />                        

                        <div className="w-full max-w-lg flex flex-row items-center justify-center mt-4">
                            <span>试试创建一个自己的{loraTitle}吧！</span>
                            <Link href={`/createLoRA?title=${loraTitle}&channel=${channel}`} className="underline underline-offset-2">极简创建</Link>
                        </div>
                        
                        {isAdmin() && lora && (
                        <div className="w-full max-w-lg flex flex-row items-center justify-center">
                            <Link href={`/publishModel?model=${lora.code}`} className="text-gray-500 underline underline-offset-2 mt-5">设置模型</Link>
                        </div>
                        )}

                    </div>

                    
                    <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} restoredSeed={restoredSeed} demoRooms={demoRooms}/>

                </div>
            
            </main>
            
        </TopFrame>
    );
};

