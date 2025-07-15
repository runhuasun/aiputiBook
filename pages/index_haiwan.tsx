import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LoadingDots from "../components/LoadingDots";
import Toggle from "../components/Toggle";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { showModel } from "../components/Genhis";
import { config } from "../utils/config";
import { isWeixinBrowser } from "../utils/wechatUtils";
import {bookLabels} from "../utils/labels";

import Image from "../components/wrapper/Image";
import SquigglyLines from "../components/SquigglyLines";
import {Testimonials, TestimonialData} from "../components/Testimonials";
import {getImageIcon} from "../utils/fileUtils";
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";



// haiwan.com的主页
export default function index({user, hotModels, demoTalks, config, inWeixin }: {user: User, hotModels:any[], demoTalks:TestimonialData[][], config:any, inWeixin:boolean }) {

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const appId = router!.query!.appId;     
    const preWord = router.query.word as string;
    const [word, setWord] = useState<string>(preWord ? preWord : "");

    async function action(model:any, url:string){
        if(user && model){
            const res = await fetch(`/api/actionManager?cmd=READBOOK&userId=${user.id}&bookId=${model.id}`, { method: "POST",
                headers: {
                    "Content-Type": "application/xml",
                },
            }); 
            window.location.href = ru.getBookRest(model.id) + (appId ? `?appId=${appId}` : "");
            return;
        }else{
            window.location.href=url;
        }
    }

    function searchBook(){
        if(word && word.length>0){
            window.location.href="/modelMarket?func=chat&word=" + word + "&pointer=0";
        }else{
            alert("请先输入你想搜索的内容");
        }
    }

        
    return (
        <div className="flex flex-col items-center justify-center  min-h-screen ">
            <Head>
              <title>{ config.appName }</title>
                <meta property="og:title" content={  config.appName } />
                <meta property="og:image" content={ config.logo32 } />    
            </Head>
            <Header config={config}/>

            <main>
                <div className={ inWeixin ? "hidden" : "hidden sm:block sm:pb-5"}>
                    <h1 className="mx-auto max-w-4xl font-display text-3xl text-white mb:50 sm:text-4xl background-gradient">
                        <span className="relative whitespace-nowrap text-white ">
                            <SquigglyLines />
                            让聪明的AI陪你旅行
                        </span>
                    </h1>                         
                </div>    

                <div className="w-full sm:w-1/2 flex flex-row items-center justify-center mb-6 px-4">
                    <input id="iptWord" type="text" value = {word}
                        placeholder = {"这里有全世界100多个国家的旅行攻略......"}
                        className="input-search flex flex-1 font-medium px-4 py-2 mt-4 w-full h-10" 
                        onChange={(e) => setWord(e.target.value)} 
                        onKeyDown={(e) => {
                            if(e.key == "Enter"){
                                // 阻止默认的提交行为
                                e.preventDefault();
                                // 检查是否按下了 Ctrl 键
                                if (e.ctrlKey || e.shiftKey || e.metaKey){
                                } else {
                                    // 执行回车键按下后的操作
                                    searchBook();
                                }    
                            }
                        }}                          
                        />           
                   <button  className="button-search mt-4 flex w-30 h-10 px-6 sm:px-8 items-center"
                        onClick={() => {
                            searchBook();
                        }}
                        >
                        搜索旅行攻略
                    </button>                        
                </div>                

                <div className="flex flex-row flex-col space-y-0 sm:space-y-10 mb-4 pt-5 rounded-xl items-left w-full space-x-2">
                      <div className={ "grid grid-flow-row-dense gap-3 items-center" + (inWeixin ? " grid-cols-2 " : " grid-cols-2 sm:grid-cols-8 ") } >
                        {hotModels && hotModels.map((m:any) => (
                            showModel(m, action, " rounded-xl ",  inWeixin ? " text-gray-800" : " text-gray-800 sm:text-gray-100 ")
                        ))}
                      </div>
                </div>
                
                <button 
                    onClick={() => {
                        window.location.href="/destinationSelect";
                    }}
                    className=" px-10 py-2 mt-8 mb-20 button-gold text-base  "
                    >
                    更多旅行目的地...
                </button>    

                <Testimonials data={demoTalks} title="热门旅行话题" subTitle="看看其它旅行者正在和AI交流什么话题" ></Testimonials>
                

            </main>
            <Footer websiteName={config.websiteName} />
        </div>
    );
    
};



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
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

    const whereTerm:any = {
        func: "chat",
        channel: "TRAVEL",
        access: "PUBLIC",
        status: "FINISH",
    };

    let hotModels:any[] = await prisma.model.findMany({
        where: whereTerm,
        orderBy: isLogin ?
            [
                { sysScore: 'desc', },
                { createTime: 'desc', },       
            ] :
            [
                { sysScore: 'desc', },
                { runtimes: 'desc', },       
            ],
            take: 24,
    });
    let hotModelCodes:string[] = [];
    let modelCodeMap:Map<string, any> = new Map();
    for(const m of hotModels){
        hotModelCodes.push(m.code);
        modelCodeMap.set(m.code, m);
    }

    const totalDemoTalks = 60;
    const demoTalksColumnNumber = 3;
    const demoTalksPerColumn = 20;
    
    let talks:any[] = await prisma.talk.findMany({
        where:{
         //   inputMsg: { length: { lte: 100 } },
         //   inputMsg: { length: { lte: 200 } },
            status: 'SUCCESS',
            model: { in: hotModelCodes }
        },
        take: totalDemoTalks,
        orderBy: [
            { createdAt:'desc' }
        ]
    });
    let demoTalks:TestimonialData[][] = [];
    for(let col=0; col<demoTalksColumnNumber; col++){
        let column:TestimonialData[] = [];        
        for(let row=0; row<demoTalksPerColumn; row++){
            const talk = talks.pop();
            if(talk?.model){
                const model = modelCodeMap.get(talk.model);
                if(model){
                    const q = JSON.parse(talk.inputMsg);
                    const a = JSON.parse(talk.outputMsg);
                    column.push({
                        content:a.content,
                        link: ru.getBookRest(model!.id),
                        author: {
                            name: q.content,
                            role: model!.name,
                            image: getImageIcon(model.coverImg)
                        }
                    });
                }
            }
        }
        demoTalks.push(column);         
    }
    
    return {
        props: {
            user,
            hotModels: hotModels||[],
            demoTalks: demoTalks||[],
            config,
            inWeixin
        },
    };
  
}      
