import Head from "next/head";
import { useRouter } from "next/router";
import React from 'react';
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Room, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import prisma from "../lib/prismadb";
import { authOptions } from "./api/auth/[...nextauth]";

import Header from "../components/Header";
import Footer from "../components/Footer";
import { RoomGeneration } from "../components/RoomGenerator";
import SquigglyLines from "../components/SquigglyLines";
import {showRoom} from "../components/Genhis";
import { Testimonials } from "../components/Testimonials";
import {photographers} from "../components/SysPrompts";
import ResizablePanel from "../components/ResizablePanel";
import Image from "../components/wrapper/Image";

import { config } from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import {getThumbnail} from "../utils/fileUtils";
import {portraitLabels} from "../utils/labels";
import {aixiezhenTools} from "../utils/funcConf";
import {hotCities} from "../utils/destinations";
import {isWeixinBrowser} from "../utils/deviceUtils";
import * as monitor from "../utils/monitor";
import {cameraList, indexTools} from "../utils/funcConf";

// 2025年2月6日开始改版到niukit

export default function index( { config, models }: {config: any, models:any[]} ) {
    
    const { data: session } = useSession();
    const router = useRouter();
    const preWord = router.query.word as string;
    const [word, setWord] = useState<string>(preWord ? preWord : "");
    const website = config.website || "";
    let tools = cameraList;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [animate, setAnimate] = useState(false);

    const imageUrls:any[] = [
    //    {cover:`${config.RS}/aixiezhen/index/xMas.jpg`, info:'Merry Christmas', model:'圣诞快乐，2024', href:`${website}/createPrompt?func=flux-pro-ultra`},        
        {cover:`${config.RS}/aixiezhen/index/model1.jpg`, video:`${config.RS}/aixiezhen/index/video/model1.mp4`, info:'用AI拍摄人像我们是专业的', model:'赫本风纯红风，2024', href:`${website}/takePhoto?model=赫本风纯红背景`},
    //    {cover:`${config.RS}/aixiezhen/index/model4.jpg`, info:'帮您创造难以想象的精彩', model:'粉红芭比风，2024', href:`${website}/takePhoto?model=小女孩生日粉红色写真`},
        {cover:`${config.RS}/aixiezhen/index/model3.jpg`, video:`${config.RS}/aixiezhen/index/video/model3.mp4`, info:'给您把梦境带到现实的能力', model:'过生日的白雪公主，2024', href:`${website}/takePhoto?model=圣诞节的白雪公主`},
    //    {cover:`${config.RS}/aixiezhen/index/model6.jpg`, info:'每个套系都匠心独具', model:'苗族传统服装，2024', href:`${website}/takePhoto?model=苗族男孩`},      
    //    {cover:`${config.RS}/aixiezhen/index/model5.jpg`, info:'每张照片都独一无二', model:'古装桃花源，2024', href:`${website}/takePhoto?model=男孩古装桃花林`},
    //    {cover:`${config.RS}/aixiezhen/index/model7.jpg`, info:'让全家人一起体验的欢乐时刻', model:'三口之家全家福，2024', href:'#'},      
        {cover:`${config.RS}/aixiezhen/index/model8.jpg`,  video:`${config.RS}/aixiezhen/index/video/model8.mp4`, info:'提供丰富多姿的场景选择', model:'水晶蝴蝶之梦，2024', href:`${website}/takePhoto?model=水晶蝴蝶花仙子女孩`},                
        
        {cover:`${config.RS}/aixiezhen/index/model2.jpg`, video:`${config.RS}/aixiezhen/index/video/model2.mp4`, info:'真的不只是玩玩而已', model:'成熟男士西服正装，2024', href:`${website}/takePhoto?model=黑条纹西装男士`},
        
    ]; // 图片数组    

    async function preloadImage(url:string) {
        const img = document.createElement('img'); // 使用 createElement 避免错误
        img.src = url;
    }   
    
    async function preloadVideo(url:string) {
        const video = document.createElement('video'); // 创建一个video元素
        video.src = url; // 指定视频的源URL
        video.preload = 'auto'; // 告诉浏览器预先加载视频
        // 可选择添加，让视频静音，以避免在预加载时播放声音
        video.muted = true; 
        // 可选择隐藏video元素，因为这里我们只是想预加载
        video.style.display = 'none';
        document.body.appendChild(video); // 将video元素添加到文档中使其生效
    }
    
    useEffect(() => {
        const nextIndex = (currentIndex + 1) % imageUrls.length;
        const intervalId = setInterval(() => {
            setCurrentIndex(nextIndex);
        }, 5000);

        if(imageUrls[nextIndex]?.video){
            preloadVideo(imageUrls[nextIndex].video as string);
        }
        if(imageUrls[nextIndex]?.cover){        
            preloadImage(imageUrls[nextIndex].cover as string);
        }
        
        return () => clearInterval(intervalId);

    }, [currentIndex, imageUrls.length]);

    useEffect(() => {
       // setAnimate(true);
       // if(!imageUrls[currentIndex]?.video){
       //     const timeoutId = setTimeout(() => setAnimate(false), 2000); // Duration of the fade-in animation
       //     return () => clearTimeout(timeoutId);
       // }
    }, [currentIndex]);

    useEffect(() => {
        if(window.location.href.indexOf(config.website)<0){
            window.location.href = config.website;
        }
    }, []);

    /*
                <video controls={false} loop
                    autoPlay={!!imageUrls[currentIndex]?.video} // 如果 video 存在则启用 autoPlay
                    preload={imageUrls[currentIndex]?.video ? "auto" : "none"} // 如果 video 存在则 preload，否则不预加载                    
                    className={` object-cover w-full shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                    src={config.RS + imageUrls[currentIndex].video} 
                    poster={config.RS + imageUrls[currentIndex].cover}                     
                    />      
                {imageUrls[currentIndex].video ? (
                <video controls={false} autoPlay 
                    className={`object-cover w-full shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                    src={config.RS + imageUrls[currentIndex].video} 
                    poster={config.RS + imageUrls[currentIndex].cover} 
                    />  
                ):(
                <Image
                    alt="AI作品"
                    src={config.RS + imageUrls[currentIndex].cover}
                    className={`object-cover w-full shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                    />
                )}
                                    poster={config.RS + imageUrls[currentIndex].cover} 

*/

    
    return (
        <div className="flex mx-auto w-full flex-col items-center justify-center min-h-screen">
            <Head>
                <title>{config.appName}</title>
                <meta property="og:description" content={config.appName} />
                <meta property="og:title" content={config.appName} />
                <meta property="og:image" content={config.logo32} />    
                <meta name="description" content={config.appName} />   
            </Head>            
            <Header config={config} noMargin={true} />      

    <ResizablePanel>
      <AnimatePresence mode="wait">
        <motion.div className="flex justify-between items-center w-full flex-col">              
            <Link className={`${isWeixinBrowser() ? " pt-0 mp-0 " : "pt-10 mt-6 "} relative sm:pt-0 sm:mt-0 w-full text-left items-left text-white text-3xl`} href={imageUrls[currentIndex].href}>
                <video controls={false} loop autoPlay preload="auto"
                    className={` hidden sm:flex object-cover w-full shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                    src={imageUrls[currentIndex].video} 
                    poster={imageUrls[currentIndex].cover}                     
                    />  
                <Image
                    alt="AI作品"
                    src={imageUrls[currentIndex].cover}
                    className={` sm:hidden object-cover w-full shadow-dark-corners ${animate ? 'animate-fadeInFromBlack' : ''}`}
                    />           
                
                <div className="absolute inset-0 sm:bg-gradient-to-tr from-black to-transparent mix-blend-multiply dark-corners"></div>
                <div className="spotlight"></div>

                <div className="absolute bottom-0 left-0 w-full flex flex-col items-center mb-4 sm:mb-40 space-y-2 sm:space-y-5" >
                    <div className="bg-[url('/leaf.svg')] bg-contain sm:bg-cover bg-center bg-no-repeat flex flex-col items-center mb-2 sm:mb-12 py-2 sm:py-4 px-8 sm:px-16" >
                        <p className="text-lg sm:text-3xl font-display tracking-wide text-center">
                            爆款AI写真工具
                        </p>
                        <div className="flex flex-row items-center justify-center">
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                            
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                            
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" className="svg-inline--fa fa-star text-primary-contrast w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="#E6B775" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" ></path></svg>                       
                        </div>
                    </div>                    
                    <p className="px-10 text-xl sm:text-5xl font-display tracking-wide text-center">
                        “{imageUrls[currentIndex].info}”
                    </p>
                    <p className="px-10 sm:mt-2 text-lg sm:text-2xl font-display tracking-wide text-center">
                        —— {imageUrls[currentIndex].model}
                    </p>    
                </div>

                <div className="hidden sm:flex absolute z-100 top-0 left-10 w-1/12 flex flex-col items-center ">
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 gap-5 justify-center items-center mt-24">
                        {tools.map((tool) => (
                            <Link className={"relative group flex flex-col items-center rounded-xl border-2 border-transparent hover:border-slate-400 "} href={tool.url}>
                                <Image loading="lazy" alt={tool.name} src= { `${config.RS}/demo/${tool.demos[2]}` } 
                                    className="rounded-xl opacity-70 hover:opacity-100 object-cover w-full" />
                                <div className="absolute flex flex-col items-center bottom-1 left-0 w-full bg-black opacity-60 text-center tracking-widest text-sm text-white">
                                    <p>{tool.name}</p>
                                </div>                                
                            </Link>
                        ))}
                    </div>
                </div>                

                <div className="hidden sm:flex absolute z-100 top-0 right-10 w-1/6 flex flex-col items-center ">
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 gap-8 justify-center items-center mt-24 ">
                        {indexTools.map((tool) => (
                            <Link className={"border-2 border-transparent hover:border-slate-400 hover:bg-gray-800 hover:opacity-80 "} href={tool.url}>
                                <p className="text-right text-lg text-gray-400 hover:text-gray-100 tracking-widest">{tool.name}</p>
                            </Link>
                        ))}
                    </div>
                </div>   
                
            </Link>
                        
            <main className="bg-gray-100">
                <div className="hidden sm:block bg-gray-900 w-full flex flex-col overflow-hidden sm:flex-row items-center justify-center pt-2">
                    <Image alt="all" src={`/brands.jpg`}
                        className="object-cover w-full h-full overflow-hidden"
                        />
                </div>
                {/*
                
                <Link className="bg-white w-full flex flex-col sm:flex-row items-center justify-center py-10" href={`${website}/cameraList`}>
                    <div className="w-full sm:w-1/4 flex flex-row items-center justify-center sm:justify-end pr-20">
                        <Image alt="相机" src={config.RS + "/aixiezhen/index/camera.png"} className="w-auto h-40 sm:h-60"/>
                    </div>
                    <span className="w-full sm:w-1/2 text-center text-xl sm:text-6xl font-semibold tracking-widest text-gray-700 ">
                        “职业摄影师的专业AI相机”
                    </span>
                    <div className="w-1/4 hidden sm:block">
                        <p></p>
                    </div>
                </Link>
               <div className="hidden w-full bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-6 sm:pt-20 pb-10">
                 
                  <Link className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href={`${website}/superCamera`}>
                    <span className="button-gold text-gray-700 text-xl px-16 py-4 mb-10">
                        AI极简肖像相机
                    </span>            
                    
                    <div className="flex space-x-2 flex-row ">
                      <div className="sm:mt-0 mt-1">
                        <Image
                            alt="Original photo"
                            src={`${config.RS}/demo/superCamera_in.jpg`}
                            className="object-cover rounded-full"
                            width={512}
                            height={512}
                        />
                      </div>
                      <div className="sm:mt-0 mt-1">
                        <Image
                            alt="Generated photo"
                            width={512}
                            height={512}
                            src={`${config.RS}/demo/superCamera_out.jpg`}
                            className="object-cover rounded-full"
                        />
                      </div>
                    </div>
                   </Link>
                   
                   <Link className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href={`${website}/takePhoto`}>
                    <span className="button-gold text-gray-700 text-xl px-16 py-4 mb-10">
                        AI套系写真相机
                    </span>            
                    
                    <div className="flex space-x-2 flex-row ">
                      <div className="sm:mt-0 mt-1">
                        <Image
                            alt="Original photo"
                            src={`${config.RS}/demo/takePhoto_in.jpg`}
                            className="object-cover rounded-full"
                            width={512}
                            height={512}
                        />
                      </div>
                      <div className="sm:mt-0 mt-1">
                        <Image
                            alt="Generated photo"
                            width={512}
                            height={512}
                            src={`${config.RS}/demo/takePhoto_out.jpg`}
                            className="object-cover rounded-full"
                        />
                      </div>
                    </div>
                  </Link>

                </div>
                */}

                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        在这里设计精致的个人形象
                    </span> 
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        神态逼真，细节丰富
                    </span>                        
                    <Link className="w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" href={`${website}/superCamera`}>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id1.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id2.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id3.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id4.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id5.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/id/id6.jpg`} className="w-full h-auto rounded-2xl"/>                        
                    </Link>
                </div>

                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        在这里拍摄与众不同的写真
                    </span>    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        姿态万千，神情各异
                    </span>                             
                    <Link className="w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" href={`${website}/takePhoto`}>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p1.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p2.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p3.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p4.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p5.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/portrait/p6.jpg`} className="w-full h-auto rounded-2xl"/>                        
                    </Link>
                </div>

                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        在这里策划一场惊艳的环球旅行
                    </span>   
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        室内室外，场景众多
                    </span>                             
                    <Link className="w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" href={`${website}/changeBG`}>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t1.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t2.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t3.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t4.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t5.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/travel/t6.jpg`} className="w-full h-auto rounded-2xl"/>                        
                    </Link>
                </div>                

                
                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        在这里勾勒出不一样的百变人生
                    </span>     
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        潮流服饰，时尚套系
                    </span>         
                    <Link className="w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" href={`${website}/changeCloth`}>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c1.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c2.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c3.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c4.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c5.jpg`} className="w-full h-auto rounded-2xl"/>
                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/cloth/c6.jpg`} className="w-full h-auto rounded-2xl"/>                        
                    </Link>
                </div>

                
                <div className="w-full bg-gray-900 flex flex-col items-center">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        “现在选择热门套系，开始创造精彩吧！”
                    </span>     
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4">
                        专业AI摄影师的品质之选
                    </span>                      
                    <div className="w-full bg-gray-900 grid grid-cols-2 sm:grid-cols-8 gap-2 pt-6 mb-5 pb-4">
                        {models && models.map((m) => (
                        <Link href={`${website}/showImageModel?model=${m.code}`} >
                            <Image alt={ m.name } src={ getThumbnail(m.coverImg, 256) }  className="w-full" />
                        </Link>                            
                        ))}                        
                    </div>
                    <button 
                        onClick={() => {
                            window.location.href=`${website}/modelMarket?func=lora&channel=PORTRAIT&title=%E5%86%99%E7%9C%9F%E5%A5%97%E7%B3%BB`;
                        }}
                        className=" px-10 py-4 mt-8 mb-15 button-gold text-xl  "
                        >
                        更多写真套系选择...
                    </button>                        
                </div>

                
                <div className="w-full bg-gray-900 flex flex-col items-center pt-10 pb-20">                    
                    <span className="w-full text-center text-xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-0">
                        完美适合各种主流社交媒体
                    </span>     
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-400 mt-4 mb-6 ">
                        生成的所有照片您都拥有完整版权
                    </span>         
                    <Image alt="照片" src="/social.jpg" className="w-full sm:w-1/2 bg-gray-900 opacity-90 hover:opacity-100 p-5 border text-center rounded-full shadow-lg"/>
                </div>

                
                <Testimonials websiteName={config.websiteName} title="10,000+摄影师的选择" subTitle="看看全国各地的用户如何评价我们的产品" />

                
                <div className="w-full bg-gray-900 flex flex-col items-center pt-20 pb-20">                    
                    <span className="w-full text-center text-2xl sm:text-3xl font-display  tracking-wide text-gray-100 mt-10 mb-10">
                        客户服务
                    </span> 
                    <div className="w-full flex flex-row items-center justify-center space-x-20">
                        <div className="w-1/3 sm:w-1/5 flex flex-col items-center space-y-5">
                            <span className="w-full text-center text-lg font-display tracking-wide text-gray-400">
                                业务联系
                            </span>       
                            <div className="w-full bg-gray-900 flex flex-col sm:flex-row items-center justify-center space-2 mb-5 pb-4">
                                <Image alt="照片" src={`${config.RS}/aixiezhen/index/op/cs1_weixin.jpg`} className="w-full h-auto rounded-2xl"/>
                            </div>
                        </div>
                        <div className="w-1/3 sm:w-1/5 flex flex-col items-center space-y-5">
                            <span className="w-full text-center text-lg font-display tracking-wide text-gray-400">
                                服务公号
                            </span>       
                            <div className="w-full bg-gray-900 flex flex-col sm:flex-row items-center justify-center space-2 mb-5 pb-4">
                                <Image alt="照片" src={`${config.RS}/aixiezhen/index/op/qrcode_aixiezhen.jpg`} className="w-full h-auto rounded-2xl"/>
                            </div>
                        </div>
                        
                    </div>                        
                </div>

                

                <div className="w-full flex flex-col items-center">                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        超能照相馆的摄影门类
                    </span>                       
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {portraitLabels.map((m) => (
                        <Link href={`${website}/modelMarket?func=lora&channel=PORTRAIT&title=写真套系&label=${m}`}> {m+"写真"} </Link>
                        ))}
                    </div>
                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        超能照相馆模仿以下摄影师风格
                    </span>         
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {photographers.map((m) => (
                        <Link href={`${website}/superCamera?prompt=, by ${m[1]}`}> {m[0] + (/[\u4e00-\u9fa5]/.test(m[0]) ? `，${m[1]}` : '') } </Link>
                        ))}
                    </div>

                    
                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        超能照相馆的功能大全
                    </span>         
                    <div className="w-full text-sm text-gray-400 grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                       {aixiezhenTools.map((m) => (     
                        <Link href={`${website}${m.url}`}> {m.name} </Link>                                
                        ))}
                    </div> 

                    <span className="w-full text-center text-base font-display tracking-wide text-gray-600 mt-4">
                        您附近的超能照相馆
                    </span>         
                    <div className="w-full text-gray-400 text-sm grid grid-cols-2 sm:grid-cols-6 gap-2 pt-6 mb-5 pb-4" >
                        {hotCities.map((m) => (
                        <Link href={`${website}/site/aboutus`}> {`超能${m}照相馆`} </Link>
                        ))}
                    </div>
                    
                </div>                
            </main>
        </motion.div>
      </AnimatePresence>
    </ResizablePanel>
            
            <Footer websiteName={config.websiteName} />
        </div>
    );
}




export async function getServerSideProps(ctx: any) {
    const whereTerm:any = {
       func: "lora",
       channel: "PORTRAIT",
       access: "PUBLIC",
       status: "FINISH",
    };
    const models = await prisma.model.findMany({
        where: whereTerm,
        take: 80,
        orderBy: [
          { sysScore: 'desc' },
          { runtimes: 'desc' },                      
          { createTime: 'desc' }
        ],
        select:{
            code: true,
            name: true,
            coverImg: true,
        }
    });

    monitor.logUserRequest(ctx);
    return {
        props: {
            config,
            models
        },
    };
}
