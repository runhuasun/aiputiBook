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

import SquigglyLines from "../../components/SquigglyLines";
import { useEffect, useState } from "react";
import {showRoom} from "../../components/Genhis";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingButton from "../../components/LoadingButton";
import Image from "../../components/wrapper/Image";

import {config} from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import LoginPage from "../../components/LoginPage";
import * as ru from "../../utils/restUtils";





export default function roomScore({ config }: { config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    async function genDesc(){
        const confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(confirmed){
            const res = await callAPI("/api/updateRoom", { cmd:"BUILD_ALL_DESC" });
            alert(JSON.stringify(res));          
        }
    }

    
    if(status == "authenticated"){
        
        return (
            <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>图片AI描述</title>
                </Head>
                
                <Header config={config}/>
           
                <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">
                    <h1 className="mx-auto max-w-4xl font-display text-3xl font-bold tracking-normal py-2 text-white mb:50 sm:text-4xl">
                        图片AI描述
                    </h1>     
                    
                   <div className="w-full mt-20">
                        <button onClick={() => { genDesc() }} className="button-dark px-5 py-2">
                        开始描述图片
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
    return {
        props: {
            config
        },
    };      
}
