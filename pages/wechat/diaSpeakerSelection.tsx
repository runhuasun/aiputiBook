import { AnimatePresence, motion } from "framer-motion";
import {GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Image from "../../components/wrapper/Image";

import Toggle from "../../components/Toggle";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import React from 'react';
import { config } from "../../utils/config";
import LoginPage from "../../components/LoginPage";
import { speakerCodes, speakers, speakerNames } from "../../utils/speakers";
import { User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as xmljs from 'xml-js';
import {isWeixinBrowser} from "../../utils/wechatUtils";


const readers = [
    {code:"ALIYUN***zhiyan_emo", name:"轻快知性女声", gender:"woman"},
    {code:"AZURE***zh-CN-XiaoxiaoNeural", name:"温柔感性女声", gender:"woman"},
    {code:"AZURE***zh-CN-XiaorouNeural", name:"港剧配音女声", gender:"woman"},
    {code:"AZURE***wuu-CN-XiaotongNeural", name:"上海方言女声", gender:"woman"},
    {code:"AZURE***zh-CN-shaanxi-XiaoniNeural", name:"陕西方言女声", gender:"woman"},
    {code:"AZURE***zh-CN-YunyeNeural", name:"磁性阳刚男声", gender:"man"},
    {code:"AZURE***zh-TW-YunJheNeural", name:"台湾腔调男声", gender:"man"},
    {code:"AZURE***zh-CN-shandong-YunxiangNeural", name:"山东腔调男声", gender:"man"},
    {code:"AZURE***zh-CN-guangxi-YunqiNeural", name:"广西腔调男声", gender:"man"},
    {code:"AZURE***zh-CN-henan-YundengNeural", name:"河南方言男声", gender:"man"}
    ];

const readerCodes: string[] = [];
for(const s of readers){
    readerCodes.push(s.code);
};
const readerNames = new Map();
for(const s of readers){
    readerNames.set(s.code, s.name);
};


export default function diaSpeakerSelection({ user, config }: { user:User, config?:any}){
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    const openId = user ? user.weixinId : "";
    const appId = router!.query!.appId;

    
    async function selectSpeaker(speakerCode:string){
        if(user && speakerCode && isWeixinBrowser() && appId){
            // 修改用户当前应用的当前默认模型
            let service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                "&userId=" + user.id + "&key=TTS_SPEAKER" + "&value=" + speakerCode;
            const res = await fetch(service, {
                method: "POST",
                headers: {
                    "Content-Type": "application/xml",
                },
            });    
            
            const retJson = await res.json();
            if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
                WeixinJSBridge.invoke('hideToolbar');                    
                WeixinJSBridge.invoke('closeWindow', {}, function(res) {});
            }
        }
    }
    
   
    if(status == "authenticated"){
        return (
            <div className="flex mx-auto flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>请选择声音</title>
                </Head>  
                
                <Header config={config}/>
                <main>
                    {!isWeixinBrowser && (
                    <h1 className="title-main">
                        请选择声音
                    </h1>
                    )}
                
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 gap-2 items-center">
                        
                        { readers.map((m:any) => (
                            <div className="flex space-y-4 w-full max-w-lg justify-center ">
                                <button
                                    onClick={() => {
                                        // @ts-ignore
                                        selectSpeaker(m.code);
                                    }}
                                    className="button-gold h-13 flex flex-row w-2/3 items-center justify-center space-x-2 rounded-lg px-5 py-5  shadow-md "
                                    >
                                    <Image alt={readerNames.get(m.code)} src={"/icons/" + m.gender + ".png"} className="h-8 w-8"/>
                                    <span>{readerNames.get(m.code)}</span>
                                </button>  
                            </div>
                        ))}
                        
                    </div>
                    
                </main>
                <Footer />
            </div>
        );
    
    }else{
        return ( <LoginPage config={config}/> );
    }        
    
};

    
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let gender = ctx?.query?.gender;
        
    if (session && session.user  && session.user.email) {
        // Get user from DB
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            }
        });

        return {
            props: {
                user,
                config
            }
        };
    }    

       
    return {
        props: {
            config
        },
    };
  
}      
