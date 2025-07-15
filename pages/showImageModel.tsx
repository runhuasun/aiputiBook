import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { Room, User, Model } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import Pagination from "../components/Pagination";
import Image from "../components/wrapper/Image";
import { showRoom } from "../components/Genhis";

import { callAPI } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import * as debug from "../utils/debug";



export async function getServerSideProps(ctx: any) {
    const modelId = ctx?.query?.modelId;
    const modelCode = ctx?.query?.model || ctx?.query?.modelCode;
    
    let user:User|null = null;
    let model:Model|null = null;
   
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
  
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }
    
    // 从数据库里找到对应的模型
    if(modelId){
        model = await prisma.model.findUnique({
            where: {
                id: modelId
            },
        });  
    }else if(modelCode){
        model = await prisma.model.findUnique({
            where: {
                code: modelCode
            },
        });  
    }

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            model,
            config,
            user
        },
    };
}  


export default function showImageModel({ model, config, user }: { model: any, config: any, user:any }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const router = useRouter();
    const appId = router.query.appId;     
    const channel = router.query.channel;
   
    let actionName = "数字人拍照";
    let shareName = "分享影集";
    if(model){
        switch(model.channel){
            case "PORTRAIT":
                actionName = "拍摄同款照片";
                shareName = "分享写真套系";
                break;
            case "FASHION":
                actionName = "数字人拍照";
                shareName = "分享影集";
                break;
        }
    }

    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const mpPageSize = 8;
    const mpRowSize = 4;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>();
    async function gotoMPsPage(page:number){
        const res = await callAPI("/api/updateRoom", {
            cmd:"GOTOPAGE", pageSize:mpPageSize, currentPage:page, type:"IMAGE",  
            modelCode: model?.code,
            publicOnly: true
        });
        if (res.status != 200) {
            alert(JSON.stringify(res.result as any));
        }else{
            if(res.result.rooms.length == 0){
                useModel(model);
            }            
            setMPCurrentPage(page);
            setMPPageCount(res.result.pageCount);
            setMPs(res.result.rooms);
            // 更新URL参数
            const query = {...router.query, page};
            router.push({
                pathname: router.pathname,
                query,
            }, undefined, { shallow: true });            
        }
    }

    
    async function useModel(model:any){
        if(model){
            if(model.channel == "PORTRAIT"){
                window.location.href = `/takePhoto?model=${model.code}`;
            }else{
                window.location.href = `/lora?channel=${model.channel}&model=${model.code}`;
            }
        }
    }

    async function shareModel(model:any){
        if(model){
            // 检查浏览器是否支持Web Share API
            if (navigator.share) {
                try {
                    // 调用navigator.share()方法并传入要分享的数据
                    await navigator.share({
                        title: "超能照相馆写真套系",
                        text:  model.name,
                        url: "/showImageModel?modelId=" + model?.id,
                    });
                } catch (e) {
                    // 如果分享失败，打印一个错误
                    debug.error("分享失败：" + e);
                }
            } else {
                // 如果浏览器不支持Web Share API，打印一个警告
                alert('请点击左下角浏览器的"..." 按钮，通过浏览器分享。');
            }
        }else{
            alert('发生未知错误，请重试。如果持续发生这个错误，请联系系统管理员');
        }
    }      

    useEffect(() => {
        const initialPage = Number(router.query.page) || 1;
        setMPCurrentPage(initialPage);
        
        if(model?.code){
            gotoMPsPage(initialPage);                
        }        
    }, [model?.code]); 

    const isAdmin = user?.actors.indexOf("admin") >= 0;

    if( status == "authenticated" || status == "unauthenticated"){
        
        return (
            <TopFrame config={config}>

                <div className="text-lg text-gray-400 tracking-wider flex flex-row items-center space-x-5 py-5">
                    <button className="underline underline-offset-2"                       
                        onClick={() => {
                            useModel(model);
                        }}>{actionName}</button>
                    {isAdmin && (
                    <button className="underline underline-offset-2 text-red-500"                       
                        onClick={() => {
                            window.open(`/publishModel?model=${model.code}`, "_blank");
                        }}>设置</button>                    
                    )}
                </div>                
             
                <main>
    
                    <div className="hidden w-full max-w-lg space-x-8 flex flex-row justify-center py-10 sm:py-1">
                        <button
                            onClick={() => {
                                useModel(model);
                            }}
                            className=" px-4 py-2 sm:px-10 sm:py3 mt-8 button-gold"
                            >
                            {actionName}
                        </button> 
    
                        <button
                            onClick={() => {
                                shareModel(model);
                            }}
                            className="sm:hidden px-4 py-2 mt-8 button-main"
                            >
                            {shareName}
                        </button> 
                    </div>
                    
                    { status == "authenticated" && (
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-3 px-3 py-5 ">            
                        {mps && mps.map((img) => (
                            showRoom(img, user?.id, "NO_INFO", false)
                        ))}
                    </div>
                    )}
    
                    
                    { status != "authenticated" && (
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-3 px-3 py-5 ">            
                        {mps && mps.map((img) => ( 
                            <Image alt="图片素材" src={img.outputImage} 
                                onContextMenu ={() => {return false}}                            
                                className="rounded-xl relative sm:mt-0 mt-2 w-full" />
                        ))}
                    </div>                     
                    )}
    
                    <Pagination pageCount={mpPageCount} currentPage={mpCurrentPage} 
                        onPageChange={(page) => {
                            gotoMPsPage(page);
                        }} 
                        />                     
                    
                    <div className="w-full max-w-lg space-x-8 flex flex-row justify-center py-10">
                        <button
                            onClick={() => {
                                useModel(model);
                            }}
                            className=" px-6 py-2 sm:px-20 sm:py-3 mt-8 button-green-blue"
                            >
                            {actionName}
                        </button> 
    
                        <button
                            onClick={() => {
                                shareModel(model);
                            }}
                            className="sm:hidden px-4 py-2 mt-8 button-main"
                            >
                            {shareName}
                        </button> 
                    </div>
                    
                </main>
            </TopFrame>
        );
    }else{
        return( <LoginPage config={config}/> );
    }
};
