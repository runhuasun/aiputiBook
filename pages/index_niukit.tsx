import Head from "next/head";
import { useRouter } from "next/router";
import React from 'react';
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Room, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { Icon } from '@iconify/react';
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Prisma } from '@prisma/client'; // 确保导入Prisma类型
import prisma from "../lib/prismadb";
import { authOptions } from "./api/auth/[...nextauth]";

import Video from "../components/wrapper/Video";
import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import { RoomGeneration } from "../components/RoomGenerator";
import SquigglyLines from "../components/SquigglyLines";
import {showRoom} from "../components/Genhis";
import { Testimonials } from "../components/Testimonials";
import {photographers} from "../components/SysPrompts";
import ResizablePanel from "../components/ResizablePanel";

import { config } from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import {getThumbnail} from "../utils/fileUtils";
import {portraitLabels} from "../utils/labels";
import {hotCities} from "../utils/destinations";
import {isWeixinBrowser} from "../utils/deviceUtils";
import * as monitor from "../utils/monitor";
import {aixiezhenTools, cameraList, indexTools, highTools} from "../utils/funcConf";
import * as mt from "../utils/modelTypes";


export default function index( { config, models, vdhs, styleModels }: {config: any, models:any[],  vdhs:any[], styleModels:any[]} ) {
    
    const { data: session } = useSession();
    const router = useRouter();
    const preWord = router.query.word as string;
    const highLight = router.query.highLight as string;
    
    const [word, setWord] = useState<string>(preWord ? preWord : "");
    const [highLightTrain, setHighLightTrain] = useState<boolean>(false);
    
    const website = config.website || "";
    const mainTools = [
        {code:"imageTools", name:"精美的图片模型", demo:"imageTools.jpg", url:"/pModelList"},
        {code:"videoTools", name:"逼真的视频模型", demo:"videoTools.jpg", url:"/vModelList"},        
        {code:"audioTools", name:"好听的声音模型", demo:"audioTools.jpg", url:"/createVoice"},
    ];
    const trainTools = [
        {code:"createStyle", name:"特色风格模型", demo:"imageTools.jpg", url:"/styleMarket"},
        {code:"createVDH", name:"热门数字人物", demo:"videoTools.jpg", url:"/VDH"},
        {code:"createSpeaker", name:"定制声音模型", demo:"audioTools.jpg", url:"/createVoice"}        
    ];
    
    let hotTools = mt.imageModels.slice(0, 12);
    let videoModels = mt.videoModels.slice(0, 8);
    let hightLightTools = highTools.slice(0, 8);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [animate, setAnimate] = useState(false);

    const imageUrls:any[] = [
        {cover:`${config.RS}/niukit/index/demo_park.jpg`, video:`${config.RS}/niukit/index/demo_google-veo-3.mp4`, href:`${website}/createVideo?sysType=PRO&model=google-veo-3`},        
 //       {cover:`${config.RS}/niukit/index/demo_park.jpg`, video:`${config.RS}/demo/model/google-veo-3.mp4`, href:`${website}/createPrompt?func=flux-pro-ultra`},
        {cover:`${config.RS}/niukit/index/animation.jpg`, video:`${config.RS}/niukit/index/demo_animation.mp4`, href:`${website}/lora?model=pretrained000010003&channel=DRAW`},                
        {cover:`${config.RS}/niukit/index/painting.jpg`,  video:`${config.RS}/niukit/index/demo_painting.mp4`, href:`${website}/lora?model=pretrained000010006&channel=DRAW`},
    ]; // 图片数组    

    useEffect(() => {
        const nextIndex = (currentIndex + 1) % imageUrls.length;
        const intervalId = setInterval(() => {
            setCurrentIndex(nextIndex);
        }, 10000);
        return () => clearInterval(intervalId);
    }, [currentIndex, imageUrls.length]);

    const [videoMuted, setVideoMuted] = useState<boolean>(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    return (
        <TopFrame config={config} showMiniHeader={false}>
            <Head>
                <title>{config.appName}</title>
                <meta property="og:description" content={config.appName} />
                <meta property="og:title" content={config.appName} />
                <meta property="og:image" content={config.logo32} />    
                <meta name="description" content={config.appName} />   
            </Head>            
            <main className="bg-gray-900">
                <div className="w-full hidden sm:flex flex-row items-start justify-center pt-5 sm:pl-5 ">
                    <Link className={`relative flex flex-1 text-left items-left text-white text-3xl`} href={imageUrls[currentIndex].href}>
                        {imageUrls[currentIndex].video ? (
                        <div className="w-full"
                            onMouseEnter={(e) => {
                            }}
                            onMouseLeave={(e) => {
                            }}                  
                            >
                            <Video controls={false} preload="auto" autoPlay loop muted={videoMuted}   ref={videoRef}
                                className={` hidden sm:flex object-cover w-full rounded-xl ${animate ? 'animate-fadeInFromBlack' : ''}`}
                                src={imageUrls[currentIndex].video} 
                                poster={imageUrls[currentIndex].cover}                     
                                />  
                        </div>                    
                        ):(
                        <Image  
                            alt="AI作品"
                            src={imageUrls[currentIndex].cover}
                            className={` hidden sm:flex object-cover w-full  rounded-xl shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                            />           
                        )}
                        
                        <Image  
                            alt="AI作品"
                            src={imageUrls[currentIndex].cover}
                            className={` sm:hidden object-cover w-full rounded-xl shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                            />           
                        
                        <div className="spotlight"></div>
        
                        {videoMuted && (
                        <div className="hidden sm:flex absolute top-0 left-0 w-full flex-col items-center mt-40 space-y-2 sm:space-y-5 z-40" >
                            <button className="opacity-60"
                                onClick={(e) => {
                                    e.stopPropagation(); // 阻止事件冒泡
                                    e.preventDefault(); // 阻止默认行为（可选）                             
                                    setVideoMuted(false);  
                                    setCurrentIndex(0);    
                                    
                                    const video = videoRef.current;
                                    if (video) {
                                        video.currentTime = 0;
                                        video.muted = false;
                                        video.play().catch((err) => {
                                            console.warn("播放失败:", err);
                                        });
                                    }                            
                                }}                        
                                >
                                <Icon icon={"mdi:volume-off"} className="w-25 h-25 text-inherit text-9xl"/>
                            </button>
                        </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 w-full flex flex-col items-center mb-4 sm:mb-10 space-y-2 sm:space-y-5" >
                            <div className="bg-contain sm:bg-cover bg-center bg-no-repeat flex flex-col items-center mb-2 sm:mb-12 py-2 sm:py-10 px-8 sm:px-28"
                                style={{
                                    backgroundImage: `url("${config.RS}/niukit/index/leaf.svg")`,
                                }}
                                onClick={(e)=>{
                                    e.stopPropagation(); // 阻止事件冒泡
                                    e.preventDefault(); // 阻止默认行为（可选）                            
                                    setHighLightTrain(true);
                                }}
                                >
                                <p className="text-lg sm:text-2xl text-gray-200 font-display tracking-widest text-center">
                                    <span className="sm:text-4xl text-white">逛</span>模型集市<span className="sm:text-4xl text-white">做</span>爆款创意
                                </p>
                                <div className="flex flex-row items-center justify-center space-x-2">
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                            
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                            
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                                </div>
                            </div>
                            <div className="sm:w-2/3 2xl:w-1/2 hidden sm:grid grid-flow-row-dense grid-cols-3 gap-5 justify-center items-center">
                                {mainTools.map((tool) => (
                                    <Link className={`relative group flex flex-col items-center rounded-xl ${(highLightTrain || highLight == tool.code) ? "blink-border" : "border-2 border-transparent hover:border-slate-400"} `} href={tool.url}>
                                        <Image alt={tool.name} src= { `${config.RS}/niukit/index/${tool.demo}` } width={256} height={256}
                                            className={ `rounded-xl ${highLight == tool.code ? "opacity-100" : "opacity-80 hover:opacity-100"} object-cover w-full` } />
                                        <div className={`absolute flex flex-col items-center bottom-5 left-1/2 transform -translate-x-1/2 w-2/3 py-3 bg-black ${highLight == tool.code ? "opacity-90" : "opacity-60 group-hover:opacity-90"} rounded-full text-center tracking-widest text-xs text-white`}>
                                            <p>{tool.name}</p>
                                        </div>                                
                                    </Link>
                                ))}
                            </div>
                        </div>
                        
                    </Link>

                    <div className="hidden sm:flex w-1/4 flex flex-col items-center sm:px-6 2xl:px-10">
                      <div className="w-full grid grid-flow-row-dense grid-cols-2 gap-2 2xl:gap-5 justify-center items-center">
                        {hightLightTools.map((tool) => (
                          <Link 
                            key={tool.code} // 确保添加key
                            className={`relative group flex flex-col items-center rounded-xl ${highLight == tool.code ? "blink-border" : "border-2 border-transparent hover:border-white"}`} 
                            href={tool.url}
                          >
                            {(tool.demos[2] || tool.demos[1] || tool.demos[0])?.toLowerCase().includes(".mp4") ? (
                              <div className="relative w-full h-full">
                                <Video 
                                  controls={false}
                                  loop 
                                  muted={true} 
                                  lazyHover={true}
                                  className={`rounded-xl ${highLight == tool.code ? "opacity-100" : "opacity-80 hover:opacity-100"} object-cover w-full h-full`}
                                  src={`${config.RS}/demo/${tool.demos[2] || tool.demos[1] || tool.demos[0]}`} 
                                  poster={`${config.RS}/demo/${tool.poster}`}
                                />
                              </div>
                            ) : (
                              <Image 
                                alt={tool.name} 
                                src={`${config.RS}/demo/${tool.demos[2] || tool.demos[1] || tool.demos[0]}`} 
                                width={256} 
                                className={`rounded-xl ${highLight == tool.code ? "opacity-100" : "opacity-80 hover:opacity-100"} object-cover w-full`} 
                              />
                            )}
                            <div className={`absolute flex flex-col items-center py-1 bottom-1 left-1/2 transform -translate-x-1/2 w-4/5 bg-black ${highLight == tool.code ? "opacity-90" : "opacity-60 group-hover:opacity-90"} rounded-full text-center tracking-widest text-xs text-white`}>
                              <p>{tool.name}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                    
                </div>

                <div className="w-full flex flex flex-col items-center px-4 sm:px-0 pb-2 sm:pb-0">
                    <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-3 2xl:gap-7 justify-center items-center mt-5">
                        {indexTools.map((tool) => (
                            <Link className={`flex flex-row items-center gap-3 px-0 2xl:px-5 py-1 ${highLight==tool.code ? "blink-border bg-gray-900 opacity-80" : "border-2 border-transparent hover:border-slate-400 hover:bg-gray-900 hover:opacity-80"} `} href={tool.url}>
                                <Icon icon={tool.icon} className="w-5 h-5 text-inherit text-xs"/>                                  
                                <p className={`text-left text-sm 2xl:text-base ${highLight==tool.code ? "text-white" : "text-gray-400 hover:text-white"} tracking-widest`}>{tool.name + (tool.price===0 ? "[免费]" : "")}</p>
                            </Link>
                        ))}
                    </div>
                </div>                        
                

                
                <div className="hidden relative sm:block bg-gray-900 w-full flex flex-col overflow-hidden sm:flex-row items-center justify-center pt-2">
                    <Image   alt="all" src= { `${config.RS}/niukit/index/brands.jpg` } 
                        className="object-cover w-full h-full overflow-hidden"
                        />
                </div>

                <div className="bg-white w-full flex flex-col sm:flex-row items-center justify-center py-5 sm:py-10">
                    <span className="w-full text-center text-xl sm:text-6xl font-semibold tracking-widest text-gray-700 ">
                        “一站使用全球千种创意模型和智能体”
                    </span>
                    <span className="sm:hidden w-full text-center text-lg sm:text-6xl font-semibold tracking-widest text-gray-700 ">
                        敬请使用PC电脑访问我们的智能创意设计网站
                    </span>
                </div>
                
                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <Link className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0"  href={`${website}/styleMarket`}>
                        个性艺术风格模型
                    </Link> 
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        动漫次元到绘画雕塑，汇聚东西方艺术精华
                    </span>                        
                    <div className="flex w-full">
                        <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4 justify-center items-center sm:mt-1 mt-3">
                            {styleModels.map((m) => (
                                <Link id={`cp_${m.code}`} href={`/lora?channel=${m.channel}&model=${m.code}`}  target="_blank" className="page-tab group relative rounded-none sm:rounded-2xl flex flex-col space-y-5 px-0 2xl:px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                                    <span className={"hidden absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                                    
                                    <span className={"text-button flex group-hover:hidden max-w-fit items-center text-center text-xs 2xl:text-base justify-center space-x-2 rounded-none sm:rounded-lg px-5 py-1 shadow-md "}>
                                        {`${m.name}`}
                                    </span>   
                                    <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-xs 2xl:text-base justify-center space-x-2 rounded-none sm:rounded-lg px-5 py-1 shadow-md ">
                                        {`${m.name}`}
                                    </span>                                   
                                    <div className="relative sm:mt-0 mt-1 w-full">
                                        <Image width={576} alt="示例" src= { m.coverImg } className="w-full object-cover rounded-lg"/>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <Link className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0" href={`${website}/VDH`}>
                        TOP STAR！数字人明星
                    </Link> 
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        明眸善睐、气质高雅、可盐可甜、软萌霸总、广受青睐
                    </span>                        
                    <div className="flex w-full">
                        <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4 justify-center items-center sm:mt-1 mt-3">
                            {vdhs.map((m) => (
                                <Link id={`cp_${m.code}`} href={`/lora?channel=${m.channel}&model=${m.code}`}  target="_blank" className="page-tab group relative rounded-none sm:rounded-2xl flex flex-col space-y-5 px-0 2xl:px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                                    <span className={"hidden absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                                    
                                    <span className={"text-button flex group-hover:hidden max-w-fit items-center text-center text-xs 2xl:text-base justify-center space-x-2 rounded-none sm:rounded-lg px-5 py-1 shadow-md "}>
                                        {`${m.name}`}
                                    </span>   
                                    <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-xs 2xl:text-base justify-center space-x-2 rounded-none sm:rounded-lg px-5 py-1 shadow-md ">
                                        {`${m.name}`}
                                    </span>                                   
                                    <div className="relative sm:mt-0 mt-1 w-full">
                                        <Image width={576} alt="示例" src= { m.coverImg } className="w-full object-cover rounded-lg"/>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="w-full bg-gray-900 hidden sm:flex flex-col items-center">                    
                    <Link className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0" href={`${website}/styleMarket?channel=PORTRAIT`}>
                        时尚人物写真套系
                    </Link>     
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        专业AI摄影师的品质之选
                    </span>                      
                    <div className="relative w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-8 gap-2 pt-6 mb-5 pb-4">
                        {models && models.map((m) => (
                        <Link href={`${website}/showImageModel?model=${m.code}`} className="relative ">
                            <Image  width={576} alt={ m.name } src={ m.coverImg }  className="w-full" />
                        </Link>                            
                        ))}                        
                    </div>
                    {/*
                    <button 
                        onClick={() => {
                            window.location.href=`${website}/modelMarket?func=lora&channel=PORTRAIT&title=%E5%86%99%E7%9C%9F%E5%A5%97%E7%B3%BB`;
                        }}
                        className=" px-10 py-4 mt-8 mb-15 button-gold text-xl  "
                        >
                        更多写真套系选择...
                    </button>  */}                      
                </div>



               <div className="w-full flex flex-col items-center bg-gray-800 pt-6 sm:pt-10 pb-10">
                   <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 gap-32">
                       <Link className="w-full flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href={`${website}/VDH`}>
                           <span className="button-gold text-gray-700 text-xl px-16 py-4 mb-10">
                               创建我的数字人
                           </span>            
                           <Video controls={false} loop autoPlay={true} muted={true} preload="auto"
                               className={` flex object-cover w-full rounded-none sm:rounded-xl `}
                               src={`${config.RS}/niukit/index/vdh.mp4`}
                               />                            
                       </Link>
                       <Link className="w-full flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href={`${website}/createSpeaker`}>
                           <span className="button-gold text-gray-700 text-xl px-16 py-4 mb-10">
                               克隆我的声音
                           </span>            
                           <Video controls={false} loop autoPlay={true} muted={true} preload="auto"
                               className={` flex object-cover w-full rounded-none sm:rounded-xl `}
                               src={`${config.RS}/niukit/index/createSpeaker.mp4`}
                               />                           
                       </Link>
                   </div>
                </div>      

                
                <div className="w-full bg-gray-900 hidden sm:flex flex-col items-center">                    
                    <Link className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0"  href={`${website}/pModelList`}>
                        精选图片生成基础大模型
                    </Link> 
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        每个模型都有自己的拿手绝活
                    </span>                        
                    <div className="flex w-full">
                        <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-4 justify-center items-center sm:mt-1 mt-3">
                            {hotTools.map((m) => (
                                <Link id={`cp_${m.code}`} href={`/createPrompt?sysType=PRO&func=${m.code}`}  target="_blank" className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-0 2xl:px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                                    <span className={"hidden absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
        
                                    <span className={"text-button flex group-hover:hidden max-w-fit items-center text-center text-xs 2xl:text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                        {`${m.name}`}
                                    </span>   
                                    <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-xs 2xl:text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                        {`${m.name}`}
                                    </span>                                   
                                    <div className="relative sm:mt-0 mt-1 w-full">
                                        <Image  width={576} alt="示例" src= { `${config.RS}/demo/model/${m.code}.jpg`} className="w-full object-cover rounded-lg"/>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="w-full bg-gray-900 hidden sm:flex flex-col items-center pb-10">                    
                    <Link className="w-full text-center text-xl sm:text-3xl font-display tracking-wide text-gray-100 mt-10 mb-0" href={`${website}/videoTools`}>
                        热门视频生成模型
                    </Link> 
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        越来越接近现实，逼真程度难以想象
                    </span>                        
                    <div className="flex w-full">
                        <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">
                            {videoModels.map((m) => (
                                <Link id={`cp_${m.code}`} href={`/createVideo?sysType=PRO&model=${m.code}`}  target="_blank" className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-0 2xl:px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                                    <span className={"hidden absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
        
                                    <span className={"text-button flex group-hover:hidden max-w-fit items-center text-center text-xs 2xl:text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                        {`${m.name}`}
                                    </span>   
                                    <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-xs 2xl:text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                        {`${m.name}`}
                                    </span>                                   
                                    <div className="sm:mt-0 mt-1 w-full">
                                        <Video src={`${config.RS}/demo/model/${m.code}.mp4`} loop autoPlay muted preload="auto" className="w-full object-cover rounded-lg"/>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
         
               
                 <div className="relative w-full bg-gray-900 flex flex-col items-center pt-10 pb-20">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        完美适合各种主流社交媒体
                    </span>     
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4 mb-6 ">
                        生成的所有照片您都拥有完整版权
                    </span>         
                    <Image   alt="照片" src="/social.jpg" className="w-full sm:w-1/2 bg-gray-900 opacity-90 hover:opacity-100 p-5 border text-center rounded-full shadow-lg"/>
                </div>

                
                <Testimonials websiteName={config.websiteName} title="超百万AI艺术家的选择" subTitle="看看全国各地的用户如何评价我们的产品" />

                
                <div className="w-full bg-gray-900 hidden sm:flex flex-col items-center pt-20 pb-20">                    
                    <span className="w-full text-center text-2xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-10">
                        客户服务
                    </span> 
                    <div className="w-full flex flex-row items-center justify-center space-x-20">
                        <div className="w-1/3 sm:w-1/5 flex flex-col items-center space-y-5">
                            <span className="w-full text-center text-lg font-display tracking-wide text-gray-400">
                                业务联系
                            </span>       
                            <div className="relative w-full bg-gray-900 flex flex-col sm:flex-row items-center justify-center space-2 mb-5 pb-4">
                                <Image  width={576}  alt="照片" src={`${config.RS}/aixiezhen/index/op/cs1_weixin.jpg`} className="w-full h-auto rounded-2xl"/>
                            </div>
                        </div>
                        <div className="w-1/3 sm:w-1/5 flex flex-col items-center space-y-5">
                            <span className="w-full text-center text-lg font-display tracking-wide text-gray-400">
                                服务公号
                            </span>       
                            <div className="relative w-full bg-gray-900 flex flex-col sm:flex-row items-center justify-center space-2 mb-5 pb-4">
                                <Image  width={576}  alt="照片" src={`${config.RS}/niukit/wechat/gw_qrcode_344.jpg`} className="w-full h-auto rounded-2xl"/>
                            </div>
                        </div>
                        
                    </div>                        
                </div>

                

                <div className="w-full hidden sm:flex flex-col items-center">                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        NIUKIT的摄影门类
                    </span>                       
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {portraitLabels.map((m) => (
                        <Link href={`${website}/modelMarket?func=lora&channel=PORTRAIT&title=写真套系&label=${m}`}> {m+"写真"} </Link>
                        ))}
                    </div>
                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        NIUKIT模仿以下摄影师风格
                    </span>         
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {photographers.map((m) => (
                        <Link href={`${website}/superCamera?prompt=, by ${m[1]}`}> {m[0] + (/[\u4e00-\u9fa5]/.test(m[0]) ? `，${m[1]}` : '') } </Link>
                        ))}
                    </div>

                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        NIUKIT的功能大全
                    </span>         
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                       {aixiezhenTools.map((m) => (     
                        <Link href={`${website}${m.url}`}> {m.name} </Link>                                
                        ))}
                    </div> 

                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        您附近的NIUKIT
                    </span>         
                    <div className="w-full text-gray-400 text-sm grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {hotCities.map((m) => (
                        <Link href={`${website}/site/aboutus`}> {`超能${m}照相馆`} </Link>
                        ))}
                    </div>
                    
                </div>                
            </main>
        </TopFrame>
    );
}



export async function getServerSideProps(ctx: any) {
    let whereTerm: any = {
        func: "lora",
        channel: "PORTRAIT",
        access: "PUBLIC",
        status: "FINISH",
    };
    
    // 显式声明类型并使用as const固定排序方向
    const orderByTerm: Prisma.ModelOrderByWithRelationInput[] = [
        { sysScore: 'desc' },
        { runtimes: 'desc' },
        { createTime: 'desc' }
    ];
    
    const selectTerm = {
        code: true,
        name: true,
        coverImg: true,
        channel: true,
    };
    
    const models = await prisma.model.findMany({
        where: whereTerm,
        take: 24,
        orderBy: orderByTerm,
        select: selectTerm
    });

    whereTerm.channel = "FASHION"; 
    const vdhs = await prisma.model.findMany({
        where: whereTerm,
        take: 6,
        orderBy: orderByTerm,
        select: selectTerm
    });
    
    const styles = ["COMIC", "ART", "DRAW"];
    let styleModels: any[] = [];
    for (const style of styles) {
        whereTerm.channel = style; // 修复语法错误，移除多余的let
        const ms = await prisma.model.findMany({
            where: whereTerm,
            take: 6,
            orderBy: orderByTerm,
            select: selectTerm
        });
        if (ms && ms.length > 0) {
            styleModels = styleModels.concat(ms); // 正确使用concat
        }
    }
    
    monitor.logUserRequest(ctx);
    return {
        props: {
            config,
            models,
            styleModels,
            vdhs,
        },
    };
}
