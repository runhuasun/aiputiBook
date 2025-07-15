import Head from "next/head";
import { useRouter } from "next/router";
import React from 'react';
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Room, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Prisma } from '@prisma/client'; // 确保导入Prisma类型
import prisma from "../../lib/prismadb";
import { authOptions } from "../api/auth/[...nextauth]";
import Video from "../../components/wrapper/Video";
import Image from "../../components/wrapper/Image";

import { config } from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import * as monitor from "../../utils/monitor";



export default function showContents( { config }: {config: any} ) {
    const router = useRouter();
    
    const { data: session } = useSession();
    const [visionSource, setVisionSource] = useState<string>("IMAGE"); // VIDEO
    const [audioSource, setAudioSource] = useState<string>("AUDIO"); // VIDEO

    const [channel, setChannel] = useState<string>(router.query.channel as string);

    const[albumId, setAlbumId] = useState<string>(router.query.albumId as string);
    
    const [imageURL, setImageURL] = useState<string>("");
    const [videoURL, setVideoURL] = useState<string>("");
    const [audioURL, setAudioURL] = useState<string>("");    

    const [article, setArticle] = useState<any>();


    const [albumRoomPageCount, setAlbumRoomPageCount] = useState<number>(0);
    const albumRoomPageSize = 1;
    const albumRoomRowSize = 1;    
    const [albumRoomCurrentPage, setAlbumRoomCurrentPage] = useState<number>(1);
    const [albumRooms, setAlbumRooms] = useState<any[]>([]);
    const [currentRoom, setCurrentRoom] = useState<any>();
    
    async function loadNextMedia(){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:albumRoomPageSize, currentPage:albumRoomCurrentPage, id:albumId });
        if (res.status != 200) {
           // alert(res.result);
        }else{
            if(albumRoomPageCount == albumRoomCurrentPage){
                setAlbumRoomCurrentPage(1);
            }else{
                setAlbumRoomCurrentPage(albumRoomCurrentPage + 1);
            }
            setAlbumRoomPageCount(res.result.pageCount);
            setAlbumRooms(res.result.rooms);
            if(res.result.rooms && res.result.rooms.length>0){
                setCurrentRoom(res.result.rooms[0]);
            }
        }
    }
    
    async function loadNextArticle(){
        const res = await callAPI("/api/articleManager", {
            cmd:"GET_NEXT", type:"NEWS", channel, currentId:article?.id });
        if (res.status == 200) {
            setArticle(res.result);
            setImageURL(res.result.imageURL);
            setVideoURL(res.result.videoURL);
            setAudioURL(res.result.audioURL);
        }
    }
    
    useEffect(() => {
//        loadNextArticle();
        loadNextMedia();
    }, [ ]);


    
    return (
        <div className="w-full flex flex-col items-center justify-center h-screen w-screen">

            {(currentRoom?.outputImage && currentRoom.resultType === "VIDEO") && (
            <Video controls={false} autoPlay muted={true} preload="auto" className={`w-full`} src={currentRoom?.outputImage} 
                onEnded = {()=>{
                    loadNextMedia();
                }}
                />  
            )}
            
            {(currentRoom?.outputImage && currentRoom.resultType === "IMAGE") && (        
            <Image alt="AI作品" src={currentRoom?.outputImage}  className="w-full"
                onLoadingComplete={()=>{
                    // 图片加载完成后，3秒后触发 loadNextMedia
                    const timer = setTimeout(() => {
                      loadNextMedia();
                    }, 3000);
                
                    // 可选：存储 timer，以便在组件卸载时清除（防止内存泄漏）
                    return () => clearTimeout(timer);
                }}                 
                />           
            )}
           
            {/*
            {(visionSource === "VIDEO" && videoURL) ? (
            <video controls={false} autoPlay preload="auto" className={`w-full`} src={videoURL} 
                onEnded = {()=>{
                    loadNextArticle();
                }}
                />  
            ):(
            <Image alt="AI作品" src={imageURL}  className="w-full"/>           
            )}

            {audioSource === "AUDIO" && (
            <audio key={audioURL} id="audioPlayer" controls={false} autoPlay className="w-full pt-2"
                onEnded = {()=>{
                    loadNextArticle();
                }}                
                >
                <source src={audioURL} type="audio/mpeg"/>
                <source src={audioURL} type="audio/wav"/>
                <source src={audioURL} type="audio/ogg"/>
            </audio>
            )}
            */}
        </div>
    );
}



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    return {
        props: {
            config,
        },
    };
}
