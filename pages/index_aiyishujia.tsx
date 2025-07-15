import useSWR from "swr";
import Head from "next/head";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import React from 'react';
import { AnimatePresence, motion } from "framer-motion";

import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";

import { RoomGeneration } from "../components/RoomGenerator";
import { authOptions } from "./api/auth/[...nextauth]";
import SquigglyLines from "../components/SquigglyLines";
import {showRoom} from "../components/Genhis";
import { Testimonials } from "../components/Testimonials";
import Header from "../components/Header";
import LoginPage from "../components/LoginPage";
import Footer from "../components/Footer";
import LoadingRing from "../components/LoadingRing";
import ResizablePanel from "../components/ResizablePanel";
import TopFrame from "../components/TopFrame";


import { config } from "../utils/config";
import * as debug from "../utils/debug";
import * as monitor from "../utils/monitor";
import * as g from "../utils/globalUtils";
import {callAPI} from "../utils/apiUtils";
import * as du from "../utils/deviceUtils";


const hotLabels = [ "精选", "美女", "美食", "婚纱", "合影", "汉服", "男士", "旅行", "运动", "旗袍", "肖像", "职业", "眼镜", "跳舞", "海边"];

export default function index_aiyishujia( { config }: {config:any} ) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(true);

    let column = 6;
    const [rooms, setRooms] = useState<any[][]>([]);
    const [word, setWord] = useState<string>(router.query.word as string || "精选");
    const [refresh, setRefresh] = useState<number>(1);
    const [mediaType, setMediaType] = useState<string>("IMAGEVIDEO");
    
    function searchByWord(word:string){
        setCurrentRow(1);
        setRowOfPage(1);
        setRowCount(1);
        setWord(word);
        pageDown();
    }

    const pageRows = 8;
    const roomsOfRow = 6; 
    
    const [currentRow, setCurrentRow] = useState<number>(1);
    const [rowCount, setRowCount] = useState<number>(1);
    const [rowOfPage, setRowOfPage] = useState<number>(1);
    
    async function loadMoreRooms(loadingMedia:string){
        const res = await callAPI("/api/updateRoom", 
                                  {
                                      cmd:"GOTOPAGE", 
                                      pageSize:roomsOfRow, 
                                      currentPage:currentRow,
                                      type:mediaType, 
                                      showBest: true, 
                                      word: word == "精选" ? "" : word
                                  });
        if (res.status != 200) {
            alert(JSON.stringify(res.result as any));
        }else{
            setCurrentRow(currentRow + 1);
            setRowOfPage(rowOfPage+ 1 );            
            setRowCount(res.result.pageCount);
            if(rooms.length == 0){
                for(const room of res.result.rooms){                    
                    rooms.push([room]);
                }
            }else{
                for(let i=0; i<column; i++){
                    if(res.result.rooms[i]){
                        rooms[i].push(res.result.rooms[i]);
                    }
                }
            }
            setRooms(JSON.parse(JSON.stringify(rooms)));
        }
    }

    useEffect(() => {
        if(rowOfPage <= pageRows && currentRow <= rowCount){
            loadMoreRooms(mediaType);
        }else{
            setLoading(false);
        }
    }, [rooms]);

    async function pageDown(){
        setRowOfPage(1);
        setRooms([]);
        setLoading(true);
        //loadMoreRooms();
    }
    
    useEffect(() => {
        setCurrentRow(1);
        setRowOfPage(1);
        setRowCount(1);
        setWord(router.query.word as string || "精选");        
        setRooms([]);
        setLoading(true);
    }, [mediaType]);


    
//    if(status == "authenticated" || status == "unauthenticated" ){    
        
        return (
            <TopFrame config={config}>

                <main className="flex flex-1 w-full flex-col items-center justify-start text-center sm:px-4 px-0" >

                    {/*
                    <div className={(loading ? "invisible" : "visible") + " w-full flex flex-row justify-center items-center space-x-4 "}>
                        <div className="flex flex-row items-center space-x-2 px-3">
                            <input type="radio" className="radio-dark-green" value="IMAGEVIDEO" checked={mediaType === 'IMAGEVIDEO'} onChange={(e) => setMediaType(e.target.value)}  />
                            <span className={mediaType === 'IMAGEVIDEO' ? "text-gray-200" : "text-gray-400"}>所有</span>
                        </div>                        
                        <div className="flex flex-row items-center space-x-2 px-3">
                            <input type="radio" className="radio-dark-green" value="IMAGE" checked={mediaType === 'IMAGE'} onChange={(e) => setMediaType(e.target.value)}  />
                            <span className={mediaType === 'IMAGE' ? "text-gray-200" : "text-gray-400"}>照片</span>
                        </div>
                        <div className="flex flex-row items-center space-x-2 px-3">
                            <input type="radio" className="radio-dark-green" value="VIDEO" checked={mediaType === 'VIDEO'} onChange={(e) => setMediaType(e.target.value)} />
                            <span className={mediaType === 'VIDEO' ? "text-gray-200" : "text-gray-400"}>视频</span>
                        </div>
                    </div> 
                    */}
                    
                    <div className="w-full sm:w-1/2 hidden sm:flex flex-row items-center justify-center mt-2">
                        <div className="relative w-full">
                            <input id="iptWord" type="text" value = {word}
                                placeholder = {"输入你要搜索的内容"}
                                style={{border:'none'}}
                                className="rounded-full opacity-80 bg-gray-800 text-gray-400 mx-1 sm:mx-0 font-medium px-4 py-2 pr-10 flex flex-1 h-10 w-full"
                                onChange={(e) => setWord(e.target.value)} 
                                onKeyDown={(e) => {
                                    if(e.key == "Enter"){
                                        // 阻止默认的提交行为
                                        e.preventDefault();
                                        // 检查是否按下了 Ctrl 键
                                        if (e.ctrlKey || e.shiftKey || e.metaKey){
                                        } else {
                                            // 执行回车键按下后的操作
                                            searchByWord(word);
                                        }    
                                    }
                                }}                             
                                />
                                <button id="searchBtn" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300"                             
                                    onClick={() => {
                                        searchByWord(word);
                                    }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path fill-rule="evenodd" clip-rule="evenodd" 
                                            d="M11 4a7 7 0 1 1-4.95 11.95l-4.1 4.1a1 1 0 0 1-1.42-1.42l4.1-4.1A7 7 0 0 1 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" 
                                            fill="currentColor"/>
                                    </svg>
                                </button>                            
                            </div>
                    </div>        
                    <div className="hidden sm:block  w-full flex flex-row space-x-3 mt-2 items-center justify-center px-2">
                        {hotLabels.map((label) => (
                            <button className={label == word ? "px-2 rounded-lg button-green-blue" : "px-2 rounded-lg button-hotword"} 
                                onClick={() => {
                                    setWord(label);
                                    searchByWord(label);
                                }}                                        
                                >{label}</button>
                        ))} 
                    </div>
                    {/*
                    <ul role="list" className="mx-auto mt-16 grid w-full grid-cols-2 gap-6 sm:gap-8 sm:max-w-screen sm:grid-cols-6" >
                        {testimonials.map((column, columnIndex) => (
                        <li key={columnIndex}>
                            <ul role="list" className="flex flex-col gap-y-6 sm:gap-y-8">
                                {column.map((testimonial, testimonialIndex) => (
                                <li key={testimonialIndex} className="hover:scale-105 transition duration-300 ease-in-out " >
                                    {showRoom(img, "", "SHOW_TITLE", true)}
                                </li>
                                ))}
                            </ul>
                        </li>
                        ))}
                    </ul>
                    
                    <div className="w-full max-w-screen grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-3 py-10" >
                        {rooms.map((img) => (
                            showRoom(img, "", "SHOW_TITLE", true)   
                        ))} 
                    </div>
                    */}

                    <ul role="list" className="mx-auto sm:mt-10 grid w-full grid-cols-2 gap-3 sm:gap-5 sm:max-w-screen sm:grid-cols-6">
                        {rooms.map((column, columnIndex) => (
                        <li key={columnIndex}>
                            <ul role="list" className="w-full flex flex-col gap-2 sm:gap-4">
                                {column.map((img:any, imgIndex) => (
                                <li key={imgIndex} className="group w-full relative flex justify-center items-center sm:hover:scale-105 transition duration-300 ease-in-out">
                                    {showRoom(img, "", "SHOW_TITLE", true)}
                                    {!du.isMobile() && (
                                    <span className="hidden group-hover:block absolute z-10 pointer-events-none	bg-black opacity-70 text-white px-8 py-4 rounded-full text-base">
                                        参考创作路径
                                    </span>                                    
                                    )}
                                </li>
                                ))}
                            </ul>
                        </li>
                        ))}
                    </ul>                    
                    
                    <div className="w-full flex flex-col items-center justify-center mt-20">
                        {loading && (
                        <LoadingRing/>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => {
                            // window.scrollTo(0, 0);
                            pageDown();
                            // setRefresh(refresh+1);  ;               
                        }}
                        className= { currentRow >  rowCount ?  " hidden " : " px-8 py-2 mt-8 button-gold " }
                        >
                        继续查看更多...
                    </button>     


                </main>
                
            </TopFrame>
        );
//    }else{
//        return(<LoginPage config={config}/>);
 //   }   


}



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    monitor.logUserRequest(ctx, session);
    return {
        props: {
            config
        },
    };
}
