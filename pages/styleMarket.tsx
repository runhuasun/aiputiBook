import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, User } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import Pagination from "../components/Pagination";
import { showModel } from "../components/Genhis";

import { callAPI } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



export default function styleMarket({ user, config, inWeixin }: {user: User, config:any, inWeixin:boolean }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
     
    const router = useRouter();
    const [channel, setChannel] = useState<string>((router.query.channel || "COMIC") as string);    
    const [label, setLabel] = useState<string>(router.query.label ? router.query.label.toString() : "全部");
    const [word, setWord] = useState<string>(router.query.word ? router.query.word.toString() : "");
    const showHistory = router.query.showHistory;
    const showFavorites = router.query.showFavorites;    
    const windowTitle = "艺术风格";
  
    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 24;
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);

    async function gotoModelPage(page:number, newChannel:string=channel, newLabel:string=label, newWord:string=word){
        const res = await callAPI("/api/updateModel", {cmd:"GOTOPAGE", pageSize:modelPageSize, currentPage:page, channel:newChannel, 
                                                       label:newLabel, word:newWord, showFavorites, showHistory});
        if (res.status != 200) {
            alert(res.result);
        }else{
            setModelCurrentPage(page);
            setModelPageCount(res.result.pageCount);
            setModels(res.result.models);
        }
    }

    function showMenuItem(code:string , name:string){
        return (
            <button className={`${channel==code ? "menu-item-selected" : "menu-item"} w-full py-3`} onClick={()=>{setChannel(code); gotoModelPage(1, code);}}>
                {name}
            </button>
        )
    }

    async function modelAction(model:any, url:string){
        if(model.channel == "PORTRAIT"){
            fu.safeWindowOpen("/showImageModel?channel=PORTRAIT&modelId=" + model.id, "_blank");
        }else{
            fu.safeWindowOpen(url, "_blank");
        }
    } 

    useEffect(() => {
        if(router.query.channel){
            setChannel(router.query.channel as string);
        }
    }, [router.query.channel]); 
    
    useEffect(() => {
        gotoModelPage(1, channel);
    }, [channel]); 

    if(status == "authenticated" || status == "unauthenticated"){
        
        return (
            <TopFrame config={config}>

                <main className="w-full flex flex-row items-start">
                    <div className="w-full h-screen menu-tab max-w-40 flex flex-col items-center pt-4 space-y-4">
                        {showMenuItem("PORTRAIT", "写真套系")}
                        {showMenuItem("COMIC", "动漫次元")}
                        {showMenuItem("ART", "东方美学")}                        
                        {showMenuItem("DRAW", "西方艺术")}
                        <button className={`menu-item w-full py-3 relative group`} onClick={()=>{fu.safeWindowOpen("/createLoRA?title=艺术风格&channel=PORTRAIT&object=风格&theme=STYLE", "_blank")}}>
                            <span className="font-bold ">创建风格</span>
                            
                            {/* 悬停提示框 */}
                            <div className="absolute hidden group-hover:block left-full ml-2 top-0 w-[50vw] bg-black opacity-80 text-white p-10 rounded-lg z-50">
                                <h3 className="font-bold mb-2 text-xl">现在创建和公开分享您的风格模型，您将马上获得其他人使用付费的分成！</h3>
                            </div>                                                    
                        </button>   
                        <button className={`menu-item w-full py-3 relative group`} onClick={()=>{fu.safeWindowOpen("/simStyle", "_blank")}}>
                            <span className=" ">模仿风格</span>
                            
                            {/* 悬停提示框 */}
                            <div className="absolute hidden group-hover:block left-full ml-2 top-0 w-[50vw] bg-black opacity-80 text-white p-10 rounded-lg z-50">
                                <h3 className="font-bold mb-2 text-xl">只需要一张照片，就可以快速模仿任意绘画和照片风格！</h3>
                            </div>                                                    
                        </button>    
                        
                    </div>
                    <div className="flex flex-1 flex-col items-center w-full sm:pt-2 pt-0 px-5 space-y-0 sm:space-y-3 sm:mb-0 mb-3">
                        <div className="w-full flex flex-col space-y-0 sm:space-y-10 mt-4 mb-4 pt-1 rounded-xl items-center space-x-2">
                            <div className={ "grid grid-flow-row-dense gap-5 items-center w-full grid-cols-2 sm:grid-cols-6" } >
                                {models && models.map((m) => (
                                    showModel(m, modelAction)
                                ))}
                            </div>
                            <Pagination pageCount={modelPageCount} currentPage={modelCurrentPage}  
                                onPageChange={(page) => {
                                    gotoModelPage(page);
                                }}  /> 
                        </div>
                    </div>   
                </main>
            </TopFrame>
        );

    }else{
        return ( <LoginPage config={config}/> );
   }     
  
};

//export default Home;



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);

    const userAgent = ctx.req.headers['user-agent'] || '';
    const inWeixin = /MicroMessenger/.test(userAgent);
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;

    // Get user from DB
    const user = isLogin ? 
        await prisma.user.findUnique({
            where: {
                email: session!.user!.email!,
            }
        })  :   undefined;
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            user,
            config,
            inWeixin
        },
    };
  
}      
