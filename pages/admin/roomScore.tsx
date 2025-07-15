import Head from "next/head";
import { useSession, signIn } from "next-auth/react";
import React from 'react';
import useSWR from "swr";
import Link from "next/link";
import prisma from "../../lib/prismadb";
import { Room, User } from "@prisma/client";
import { RoomGeneration } from "../../components/RoomGenerator";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";

import Image from "../../components/wrapper/Image";
import SquigglyLines from "../../components/SquigglyLines";
import { useEffect, useState } from "react";
import {showRoom} from "../../components/Genhis";
import Footer from "../../components/Footer";
import Header from "../../components/Header";

import {config} from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import LoginPage from "../../components/LoginPage";
import * as ru from "../../utils/restUtils";





export default function roomScore({ room, pRoomScore, config }: { room: Room & { user: User; }, pRoomScore:number, config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    async function setScore(room: Room, score: number){
        const res = await callAPI("/api/updateRoom", { id:room.id, sysScore:score, cmd:"SET_SCORE" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            window.location.href = "/admin/roomScore?pRoomScore=0";
        }   
    }
    
    async function physicalDelete(room: Room){
        const confirmed = await confirm("提醒：一旦删除，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
        if(confirmed){
            const res = await callAPI("/api/updateRoom", { id:room.id, cmd:"PHYSICAL_DELETE" });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                window.location.href = "/admin/roomScore?pRoomScore=0";
            }   
        }
    }
    
    if(status == "authenticated" && room){
        
        return (
            <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>图片人工打分</title>
                </Head>
                
                <Header config={config}/>
           
                <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">
                    <h1 className="mx-auto max-w-4xl font-display text-3xl font-bold tracking-normal py-2 text-white mb:50 sm:text-4xl">
                        图片人工打分
                    </h1>     
                    
                    <div className="py-10" >
                        <Link href="#" onClick={()=>{window.open(ru.getImageRest(room.id), "_blank")}} >
                            <Image
                                alt="图片素材"
                                src={room.outputImage}
                                className="rounded-2xl relative sm:mt-0 mt-2 w-full sm:w-auto h-auto"
                                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" }}
                                />
                        </Link>
                    </div>
                    
                    <div className="flex flex row">
                        <button onClick={() => {setScore(room, 1); }}
                            className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            1分建议销毁
                        </button>    
                        
                        <button onClick={() => {setScore(room, 2); }}
                            className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            2分很差不能展示
                        </button>   
                        
                        <button onClick={() => {setScore(room, 3); }}
                            className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            3分一般但不想展示
                        </button>   
                        
                        <button onClick={() => {setScore(room, 4); }}
                            className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            4分不错可以展示
                        </button>   
                        <button onClick={() => {setScore(room, 5); }}
                            className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            5分很棒推荐展示
                        </button>              
                    </div> 

                    <div className="w-full mt-20">
                        <button onClick={() => { physicalDelete(room) }} className="button-dark px-5 py-2">
                        彻底的物理删除该图片
                        </button>
                    </div>
                </main>
    
                <Footer />
            </div>
        );
    }else{
        return(
            <LoginPage config={config}/>
        );        
    }
}

export async function getServerSideProps(ctx: any) {
    let score = ctx?.query?.score;
    const minScore = score ? parseInt(score) : 0;  
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    
    let userId = "";
    // 判断是否是模型的主人
    if (session && session.user  && session.user.email) {
        // Get user from DB
        let user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(user && user.actors.indexOf("admin")>0){
            userId = user.id;
        }
    }
    // 从 Cookie 中获取 pointer 值
    const pRoomScore = parseInt((ctx.query?.pRoomScore as string) || '0', 10);
    let rooms = await prisma.room.findMany({
        where: {
            status: "SUCCESS",
            sysScore: minScore,
     //       access: "PUBLIC",
        },
        orderBy: {
            createdAt: 'desc',
        },        
   //     skip: pRoomScore,
        take: 1,
        include: {
            user:true,
        },
    });
   

    if(rooms.length > 0 && userId != ""){
        const room = rooms[0];
        return {
            props: {
                config,
                room,
                pRoomScore
            },
        };
    }else{
        return {
            props: {
                config
            },
        };      
   }

}
