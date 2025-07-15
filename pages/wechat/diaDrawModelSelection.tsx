import { AnimatePresence, motion } from "framer-motion";
import {GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
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
import { rooms, roomNames, imageModels } from "../../utils/modelTypes";
import { User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as xmljs from 'xml-js';
import {isWeixinBrowser} from "../../utils/wechatUtils";
import Image from "../../components/wrapper/Image";

export default function diaDrawModelSelection({ user, config }: { user:User, config?:any}){
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    const openId = user ? user.weixinId : "";
    const appId = router!.query!.appId;

    
    async function selectDrawModel(modelCode:string){
        if(user && modelCode && isWeixinBrowser() && appId){
            // 修改用户当前应用的当前默认模型
            let service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                "&userId=" + user.id + "&key=TEXT2IMG_MODEL" + "&value=" + modelCode;
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
                    <title>请选择绘图模型</title>
                </Head>  
                
                <Header config={config}/>
                <main>
                    {!isWeixinBrowser && (
                    <h1 className="title-main">
                        请选择绘图模型
                    </h1>
                    )}
                
                    <div className="grid grid-flow-row-dense grid-cols-1 gap-2 items-center">
                        
                        {Array.from(imageModels).map((m) => (
                        <div className="space-y-4 w-full max-w-lg ">
                            <button
                                onClick={() => {
                                    // @ts-ignore
                                    selectDrawModel(m.code);
                                }}
                                className="button-dark h-20 flex w-full items-center justify-center space-x-2 rounded-lg px-5 py-1  shadow-md flex flex-col  space-y-3 items-center"
                                >
                                <span className="text-gray-200">{m.name}</span>
                                <div className="w-full px-2 flex flex-row justify-between items-center">
                                    <span className="text-gray-300 text-xs">{`${m.price} 点/次`}</span>
                                    <span className="text-gray-300 text-xs">{`${m.score} 分`}</span>                                    
                                </div>
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
