import Head from "next/head";
import React from 'react';
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { getServerSession } from "next-auth";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { VDH, User, Room, Model, Prompt } from "@prisma/client";

import { RoomGeneration } from "../components/RoomGenerator";
import Image from "./wrapper/Image";
import Video from "./wrapper/Video";

import { getFuncLink, getFuncTitle} from "../utils/funcConf";
import { getSpeakerByCode } from "../utils/speakers";
import {getThumbnail, getFileServerOfURL} from "../utils/fileUtils";
import * as config from "../utils/config";
import * as ru from "../utils/restUtils";
import * as du from "../utils/deviceUtils";
import * as enums from "../utils/enums";
import downloadPhoto from "../utils/fileUtils";

export const thumbSize = 256;

export default function Genhis({ imghis, userId, option, title}: { imghis: any[], userId?: string, option?:string, title?:string}) {
  const { data: session, status } = useSession();

  return (
    
    <div className="text-left w-full sm:pt-2 pt-4 mt-5 flex flex-col px-3 space-y-3 sm:mb-0 mb-3 border-gray-200 items-center">
        
        {title && (
            <p className="text-gray-100">
              {title}  
            </p>
        )}
      
        {/*  !title && imghis && imghis.length === 0 && (
            <p className="text-gray-100">
              这里还没有生成任何作品。 你来试试吧！
            </p>
        ) */}
            
       { !title && imghis && imghis.length > 0 && (
            <p className="text-gray-100">
              这里已经生成过{imghis.length}幅作品
             </p>
        )}

         <div className="w-full flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center space-x-2">
          <div className="grid w-full grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-8">

            { imghis && imghis.map((img) => (
              showRoom(img, userId? userId : "", option? option : "")
            ))}
          </div>
        </div>
      
      
        
  </div>

    
  );
}


export async function publicRoom(roomId: string ){
   
    const res = await fetch("/api/updateRoom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:roomId, cmd:"PUBLIC" }),
    });

    let response = await res.json();
    if (res.status !== 200) {
      alert(response as any);
    } else {
      window.location.reload();
    }   
}

export async function privateRoom(roomId: string){
   
    const res = await fetch("/api/updateRoom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:roomId, cmd:"PRIVATE" }),
    });

    let response = await res.json();
    if (res.status !== 200) {
      alert(response as any);
    } else {
      window.location.reload();
    }   
}

export async function deleteRoom(roomId: string){
    const res = await fetch("/api/updateRoom", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
            id:roomId, 
            cmd:"DELETE" 
        }),
    });
    let response = await res.json();
    if (res.status !== 200) {
      alert(response as any);
    } else {
      window.location.reload();
    }   
}

export async function recoverRoom(roomId: string){
   
    const res = await fetch("/api/updateRoom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:roomId, cmd:"RECOVER" }),
    });

    let response = await res.json();
    if (res.status !== 200) {
      alert(response as any);
    } else {
      window.location.reload();
    }   
}


// @ts-ignore
const IconContainer = ({ icon, number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 1 }}>
    {icon}
    <span style={{ marginTop: 5 }}>{number}</span>
  </div>
);

const ViewIcon = (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 4C9.4 4 4.71699 7.5 2.5 12.5C4.71699 17.5 9.4 21 15 21C20.6 21 25.283 17.5 27.5 12.5C25.283 7.5 20.6 4 15 4ZM15 18C10.6 18 6.90566 15.0932 5.18707 11.5C6.90566 7.90678 10.6 5 15 5C19.4 5 23.0943 7.90678 24.8129 11.5C23.0943 15.0932 19.4 18 15 18Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 8.5C13.6193 8.5 12.5 9.61929 12.5 11C12.5 12.3807 13.6193 13.5 15 13.5C16.3807 13.5 17.5 12.3807 17.5 11C17.5 9.61929 16.3807 8.5 15 8.5Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 17C16.3807 17 17.5 15.8807 17.5 14.5C17.5 13.1193 16.3807 12 15 12C13.6193 12 12.5 13.1193 12.5 14.5C12.5 15.8807 13.6193 17 15 17Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DownloadIcon = (
  <svg width="24" height="24" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.625 23.75H19.375C20.2642 23.75 21.0625 23.3818 21.6401 22.8042C22.2177 22.2266 22.586 21.4283 22.586 20.5391V12.5C22.586 11.6108 22.2177 10.8125 21.6401 10.2349C21.0625 9.6573 20.2642 9.28906 19.375 9.28906H10.625C9.73581 9.28906 8.9375 9.6573 8.35993 10.2349C7.78236 10.8125 7.41406 11.6108 7.41406 12.5V20.5391C7.41406 21.4283 7.78236 22.2266 8.35993 22.8042C8.9375 23.3818 9.73581 23.75 10.625 23.75Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 19.375V10.625" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.5 17.1875L15 19.6875L17.5 17.1875" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HeartIcon = (
  <svg width="24" height="24" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 27.5L13.875 26.375C6.875 19.375 2.5 15.425 2.5 10C2.5 6.35025 4.85025 4 8.5 4C10.6129 4 12.4839 5.18437 14.125 6.625C15.7661 5.18437 17.6371 4 19.75 4C23.3997 4 25.75 6.35025 25.75 10C25.75 15.425 21.375 19.375 14.375 26.375L13.25 27.5H15Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);





export function showRoom(img:any, userId?:string, option?:string, useThumb:boolean=true) {
    const isOwner = userId && (img.userId === userId);
    if(img.status == enums.roomStatus.delete){
        return(<></>);
    }
    return(
        <div className="w-full group masonry-item border-gray-200 text-center flex-col relative inline-block">
            <div className="relative w-full text-xs">
                {img.status!="FAILED" && img.outputImage && img.resultType=="VIDEO" ? (
                <>
                    {img.status == "SUCCESS" ? (
                        <Link href={ ru.getVideoRest(img.id) } target="_blank">
                            <Video className="w-full rounded-xl" src={img.outputImage} controls={!du.isMobile()}  preload="none"
                                poster={img.inputImage || img.outputImage} />
                        </Link>
                    ) : (
                        <Image alt="AI作品" width={thumbSize} height={thumbSize} src={config.defaultImage.roomCreating} className=" object-cover w-full rounded-xl" loading="lazy"/>                  
                    )}
                </>
                )
                    : 
                (img.status!="FAILED" && img.outputImage && (img.resultType=="VOICE")) ? (
                <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                   {img.status == "SUCCESS" ? (
                    <>
                      <Link className="text-white text-left mt-8 mb-10 left-5 text-sm"
                          href={ ru.getAudioRest(img.id) } target="_blank">
                          <span className="break-all"> { img.prompt ? `“${countAndCut(img.prompt,200)}”` : " ... " } </span>
                      </Link>
                      <audio id="audioPlayer" controls className="w-full pt-2 ">
                          <source src={img.outputImage} type="audio/mpeg"/>
                          <source src={img.outputImage} type="audio/wav"/>
                          <source src={img.outputImage} type="audio/ogg"/>                        
                      </audio>                
                      <div className="mt-10">
                          &nbsp;
                      </div>          
                    </>
                    ) : (
                    <Image alt="AI作品" width={thumbSize} src={config.defaultImage.roomCreating} className=" object-cover w-full rounded-xl" loading="lazy"/>                  
                    )}
                </div>
                )
                    : 
                (img.status!="FAILED" && img.outputImage && (img.resultType=="IMAGE")) ? (
                <Link href={ (img.status=="SUCCESS") ? ru.getImageRest(img.id) : "#" } target="_blank">   
                    <Image alt="AI作品" className=" object-cover w-full rounded-xl" loading="lazy" width={useThumb ? thumbSize : 2048}
                        src={
                            (img.status==enums.roomStatus.midstep || img.status==enums.roomStatus.midsucc || img.status==enums.roomStatus.midfail || img.status==enums.roomStatus.creating) ? 
                            config.defaultImage.roomCreating : img.outputImage
                        }
                        />
                </Link>
                )
                    :
                (
                <div className="justify-between bg-gray-800 flex flex-col p-2 rounded-xl">
                    <div className="text-white text-left mt-8 mb-10 left-5 text-sm">
                        <span> {img.status == "FAILED" ? "任务失败" : "返回结果"}：{(img.outputImage? ("“"+countAndCut(img.outputImage,200)+"”") : " ... ") } </span>
                    </div>    
                    <div className="mt-10 text-left">
                        <span> {((img.prompt && img.prompt.trim() != "")? ("“"+countAndCut(img.prompt,200)+"”") : " ... ") } </span>
                    </div>          
                </div>    
                )}

                {img.status == "SUCCESS" && img.audit != "N" && (
                <span className="absolute z-10 pointer-events-none bg-black/70 text-red-500 w-full px-2 py-4 text-base flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2">
                    <p>内容不合规范</p>
                    <p>请您尽快删除</p>
                </span>                                    
                )}  
              
                { isOwner && (img.status=="SUCCESS" || img.status=="FAILED") && (
                // 红色删除图标
                <button onClick={() => {
                    deleteRoom(img.id);
                }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>
                )}

              {/*
                <div className=" hidden group-hover:block absolute bottom-5 right-0 flex flex-col items-center ">
                    <IconContainer icon={ViewIcon} number={img.viewTimes}  />
                    <IconContainer icon={DownloadIcon} number={img.dealTimes} />
                    {//           <IconContainer icon={HeartIcon} number={ Math.floor(Math.random() * 100) + 1} /> //}
                </div>     

                <div className="absolute bottom-1 left-1 w-4/5 flex flex-col hidden group-hover:block ">
                    { option && option=="SHOW_TITLE" && ( 
                    <div className=" w-full flex text-left items-left text-white ">
                        <p className="text-white text-center text-xs">“{countAndCut(getFuncTitle(img.func, img.model), 30)}”</p>
                    </div>        
                    )}    
                </div>
              */}
              
                { ( !option || option!="SHOW_TITLE") && ( 
                <div className="hidden group-hover:flex flex-row absolute bottom-0 right-0 space-x-2 items-right">
                   {(img.resultType == "VIDEO" || img.resultType == "IMAGE" || img.resultType == "VOICE") && img.outputImage && (
                    <button onClick={()=>{downloadPhoto(img.outputImage!)}} className="w-12 h-5 button-main text-white text-xs px-2  rounded-xl"> 
                        下载
                    </button>
                   )}                    
                  
                  {( isOwner  && img.audit === "N" && (img.access == "PRIVATE") && (img.status=="SUCCESS")) && (
                    <button className=" w-12 h-5 button-main text-white text-xs px-2  rounded-xl"
                        onClick={() => {
                            publicRoom(img.id);
                        }}
                        >
                        公开
                    </button>                               
                    )}
                  
                  {isOwner &&  (img.access == "PUBLIC") && (img.status=="SUCCESS") && (
                    <button className="w-12 h-5 button-dark text-xs px-2  rounded-xl"
                        onClick={() => {
                            privateRoom(img.id);
                        }}
                        >
                        隐藏
                    </button>                                  
                    ) } 
                </div>
                )}        
        </div>

        { option!="NO_INFO" && ( !option || option!="SHOW_TITLE") && ( 
        <div className="w-full mb-1">
            <div className=" text-left left-4 items-left text-xs flex flex-row justify-between ">
                { (!option || option!="SHOW_TITLE") && (img.func!="img2video") &&  ( 
                <p className="text-white text-left left-5 text-sm">
                    <span className="text-gray-400">{formatDate(new Date(img.createdAt)) + "："} </span>
                    { img.outputImage && img.resultType=="VOICE" ? (
                    <span> {getSpeakerByCode(JSON.parse(img.bodystr ?? '{}')?.speaker)?.name ?? ''} </span>
                    ) : (
                    <span> {((img.prompt && img.prompt.trim() != "")? ("“"+countAndCut(img.prompt,200)+"”") : " ... ") } </span>
                    )}
                </p>
                )}
            </div>
        </div>
        )}

    </div>     
  );
}

export function formatDate(date: Date): string { 
  if(date){
    return date.toLocaleString('zh-CN', 
               { month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'});
  }else{
    return "某月某日 08:08";
  }
}

export function showVDH(vdh: any, action?:any, imgClass:string="", txtClass:string=" text-gray-400 ") {
    if(vdh){
        let loraUrl = "/lora?price="+ vdh.pModel.price + "&model="+ vdh.pModel.code;
        let chatUrl = "/chatbot?model="+ vdh.cModel.id;
        
        return(
            <div className="flex flex-col">
                <div className= "group masonry-item border-gray-200 text-center flex-col relative inline-block "  >
                    <Link  className="items-center"  href={action ? "#" : loraUrl}
                        onClick={() => {
                            if(typeof action === "function"){
                                action(vdh, loraUrl);
                            }
                        }}        
                        >
                        <Image
                            alt="Generated photo"
                            width={thumbSize}
                            src={getThumbnail(vdh.pModel.coverImg, thumbSize)}
                            className= { "object-cover w-full sm:mt-0 mt-2 " +  imgClass }
                            />
                    </Link> 
                    <div className="block absolute text-xs text-gray-400 bottom-1 left-2 w-full flex flex-row items-left">
                        <Image src="/price.svg"  width={10} height={10}  alt="需要提子数" />
                        <span className="flex  text-center  px-1 text-gray-100 "  >
                            {vdh.price}
                        </span>                  
                        <Image src="/runtimes.svg"  width={10} height={10}  alt="运行次数" />
                        <span className="flex text-center px-1 text-gray-100 "  >
                            {vdh.likes}
                        </span>    
                    </div>
                </div>
                
                <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                    <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" + txtClass } >
                        {countAndCut(vdh.name, 24)}
                    </span>                  
                </div>        
            </div>    
        );
    }else{
        return( <div className="flex felx-col"></div> );
    }
}


export function showModel(model: Model, action?:any, imgClass:string="", txtClass:string=" text-gray-400 ", doubleClicked?:any) {
    if(model){
        let url = "";
        if(model.func == "lora"){
            if(model.channel == "PORTRAIT" || model.channel == "FASHION"){
                url = `/showImageModel?model=${model.code}`;
            }else{
                url = "/lora?channel="+ model.channel + "&model="+ model.code;
            }
        }
            
        if(model.func == "chat"){
            if(model.channel=="TRAVEL" || model.channel=="BOOK"){
                url = `/books/${model.id}`;
            }else{
                url = "/chatbot?model="+ model.id;
            }
        }
        
        return(
            <div className="flex flex-col">
                <div className= "group masonry-item border-gray-200 text-center flex-col relative inline-block "  >
                    <Link  className="items-center"  href={action ? "#" : url}
                        onClick={() => {
                            if(typeof action === "function"){
                                action(model, url);
                            }
                        }}   
                      
                        onDoubleClick={() => {
                            if(typeof doubleClicked === "function"){
                                doubleClicked(model, url);
                            }
                        }}   
                        >
                        <Image
                            alt="Generated photo"
                            width={thumbSize}
                            src={model.coverImg}
                            className= { "object-cover w-full rounded-xl sm:mt-0 mt-2 " +  imgClass }
                            />
                    </Link>
                  
                    <span className={(model.price==0 ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>限免</span>

                    <div className="block absolute text-xs text-gray-400 bottom-1 left-2 w-full flex flex-row items-left">
                        <Image src="/price.svg"  className="w-4"  alt="需要提子数" />
                        <span className={"flex  text-center  px-1 " + (model.price>0 ? "text-gray-100 " : "text-yellow-400") } >
                            {model.price}
                        </span>                  
                        <Image src="/runtimes.svg"  className="w-4" alt="运行次数" />
                        <span className="flex text-center px-1 text-gray-100 "  >
                            {model.runtimes}
                        </span>    
                    </div>
                </div>
                
                <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                    <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" + txtClass } >
                        {countAndCut(model.name, 24)}
                    </span>                  
                </div>        
            </div>    
        );
    }else{
        return( <div className="flex felx-col"></div> );
    }
}

export function showPrompt( prompt: Prompt,  action?:any, doubleClicked?:any ) {
    return(
        <div className="flex flex-col">
            <div className="group masonry-item border-gray-200 text-center flex-col relative inline-block">
                <Link  className="items-center"  href={action ? "#" : ("/runPromptApp?prompt="+prompt.code)}
                    onClick={() => {
                        if(typeof action === "function"){
                            action(prompt);
                        }
                    }}   
                  
                    onDoubleClick={() => {
                        if(typeof doubleClicked === "function"){
                            doubleClicked(prompt);
                        }
                    }}                      
                    >
                  <Image
                      alt="Generated photo"
                      width={thumbSize}
                      src={prompt.coverImg}
                      className="object-cover w-full sm:mt-0 mt-2  rounded-xl"
                      />
              </Link>     
              {prompt.price==0 && (
                <div className="block absolute top-2 left-2">
                    <span className="blink">限免</span>                     
                </div>
              )}              
              <div className="block absolute text-xs bottom-1 left-2 w-full flex flex-row items-left">
                  <Image src="/price.svg"   className="w-4"  alt="需要提子数" />
                  <span className={"flex  text-center  px-1 " + (prompt.price>0 ? "text-gray-100 " : "text-red-500") } >
                      {prompt.price}
                  </span>                  
                  <Image src="/runtimes.svg"    className="w-4"  alt="运行次数" />
                  <span className="flex text-center px-1 text-gray-100 "  >
                      {prompt.runtimes}
                  </span>  
              </div>
            </div>                 
            <div className="flex flex-row items-left text-xs text-gray-400 space-x-0 sm:mt-3 mt-2 py-1 w-full">
                <span className="flex text-center  text-gray-400 space-x-2 sm:rounded-lg px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition"  >
                    {countAndCut(prompt.name,24)}
                </span>                  
            </div>
        </div>       
    );
}

export function countAndCut(str:string , len:number) {
  var count = 0;
  for (var i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127 || str.charCodeAt(i) == 94) {
      count += 2;
    } else {
      count += 1;
    }
    if (count > len) {
      return str.substring(0, i) + "...";
    }
  }
  return str;
}



export function randomUser(){
  const no = Math.floor(Math.random() * 41); // 生成一个0-50的随机数
  
  const fakeUsers: string[] = [
    "寂寞花火", "碎了一丝阳光",
    "古琵琶’暮墨染雨", "白鸥",
    "万人迷", "安妮和小莫",
    "心奴@", "碧海青天夜夜",
    "韶光巷陌", "逃跑",
    "死在自己的梦里", "满目山河空念远",
    "大河向东流", "我心飞扬",
    "陌带离愁", "轻酌浅醉",
    "冰蓝水蜜桃", "放飞蓝天",
    "雪花拥抱阳光", "淳风清雨",
    "续写过去曾", "未满",
    "森屿友人", "纤纤公子",
    "那段情", "何必自欺欺人°",
    "拥有一身仙女", "气告别旧世界",
    "有病且不轻", "柔情少女.",
    "心酸比檸檬还酸", "等风吹等你归",
    "爷们不狠江山", "痛了┈谁心疼?",
    "我欠青春个爱情", "負紅顔欺青春、",
    "竭尽力气の爱你", "阳光失去温暖...",
    "ヅ幽愁暗恨‵生", "不值信任的感情",
  
  
  
  ];

  return fakeUsers[no];
    
}




















