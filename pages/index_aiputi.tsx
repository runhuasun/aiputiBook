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
import * as debug from "../utils/debug";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, User, Talk } from "@prisma/client";
import { getServerSession } from "next-auth";
import { showModel } from "../components/Genhis";
import { config } from "../utils/config";
import { isWeixinBrowser } from "../utils/wechatUtils";
import SquigglyLines from "../components/SquigglyLines";
import {Testimonials, TestimonialData} from "../components/Testimonials";
import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";

import {getImageIcon} from "../utils/fileUtils";
import { Prisma } from '@prisma/client'
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";

// import {bookLabels} from "../utils/labels";
const bookLabels = ["畅销"];


// AI书库的主页
export default function index({user, hotModels, demoTalks, config, inWeixin }: {user: User, hotModels:any, demoTalks:TestimonialData[][], config:any, inWeixin:boolean }) {

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
            /*
            if(isWeixinBrowser() && appId){
                // 修改用户当前应用的当前默认模型
                let service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                    "&userId=" + user.id + "&key=CHAT_MODEL_ID" + "&value=" + model.id;

                const res = await fetch(service, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/xml",
                    },
                });    

                const retJson = await res.json();
                // alert(retJson as string);
                if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
                    WeixinJSBridge.invoke('hideToolbar');                    
                    WeixinJSBridge.invoke('closeWindow', {}, function(res) {});
                }
            }else{
                window.location.href=url;
            }
            */
        }else{
            window.location.href=url;
        }
    }

    async function showModelsByLabel(newLabel:string){
        if(window.location.href.indexOf("?") >= 0){
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.set('label', newLabel);
            window.location.href = "/modelMarket?" + searchParams.toString();
        }else{
            window.location.href = "/modelMarket?func=chat&label=" + newLabel;            
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
        <TopFrame config={config}>
            <main className="w-full">
				
                <div className={ inWeixin ? "hidden" : "hidden sm:block sm:pb-5 pt-3"}>
                    <h1 className="mx-auto max-w-4xl font-display text-3xl text-white mb:50 sm:text-4xl background-gradient">
                        <span className="relative whitespace-nowrap text-white ">
                            <SquigglyLines />
                            让聪明的AI伴你读书
                        </span>
                    </h1>                         
                </div>    

                <div className="w-full sm:w-1/2 flex flex-row items-center justify-center mb-0 px-4">
                    <input id="iptWord" type="text" value = {word}
                        placeholder = {"这里有10326本AI书！输入你要搜索的内容"}
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
                        搜索书籍
                    </button>                        
                </div>                

               { hotModels && bookLabels.map((label) => (
                    hotModels[label] && (           
                        <div className="items-left w-full flex flex-col px-3 sm:mb-0 mb-3">
                            <div className="px-3 cursor-pointer items-left text-left text-gray-400 hover:text-white"
                                onClick={() => {
                                    showModelsByLabel(label);
                                }}>
                                {label + '>'}
                            </div>                            
                            <div className="flex flex-row flex-col space-y-0 sm:space-y-10 mb-4 pt-1 rounded-xl items-left w-full space-x-2">
                                  <div className={ "grid grid-flow-row-dense gap-3 items-center" + (inWeixin ? " grid-cols-2 " : " grid-cols-2 sm:grid-cols-8 ") } >
                                    {hotModels[label].map((m:any) => (
                                        showModel(m, action, " rounded-xl ",  inWeixin ? " text-gray-800" : " text-gray-800 sm:text-gray-100 ")
                                    ))}
                                  </div>
                            </div>
                        </div>                            
                    )            
                ))}
                
                <Testimonials data={demoTalks} title="读者热门话题" titleColor="text-gray-300" subTitle="看看其它读者正在关心什么话题" ></Testimonials>
				
            </main>
		
        </TopFrame>
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
        channel: "BOOK",
        access: "PUBLIC",
        status: "FINISH",
    };

    let hotModels:any = {};
    
    // for(const label of bookLabels){
    for(const label of bookLabels){
        whereTerm.labels = {
            contains: label
        };
        
        let modelsByLabel = await prisma.model.findMany({
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
            select: {
                id: true,
                func: true,
                code: true,
                name: true,
                createTime: true,
                finishTime: true,
                url: true,
                status: true,
                price: true,
                coverImg: true,
                runtimes: true,
            },
            take: label == "畅销" ? 16 : 8,
        });
        if(modelsByLabel && modelsByLabel.length>0){
            hotModels[label] = modelsByLabel;
        }
    }

    let demoTalks:TestimonialData[][] = [];
    const totalDemoTalks = 150;
	const demoTalksColumnNumber = 3;
	const demoTalksPerColumn = 30;
	
	let talks:any[] = []; 
	talks = await prisma.$queryRaw<Talk[]>`select distinct on (T."model") 
	T."model", M."id" as modelid, M."name" as modelname, M."coverImg" as modelcoverimg, 
 	T."inputMsg" , T."outputMsg", T."createdAt" from "Talk" as T, "Model" as M where
	T."model" = M."code"  
	and CHAR_LENGTH(T."inputMsg")>50 and CHAR_LENGTH(T."inputMsg")<100 
	and CHAR_LENGTH(T."outputMsg")>100 and CHAR_LENGTH(T."outputMsg")<300 
	and T."status"='SUCCESS'  
	and M.func='chat' 
	and M.channel='BOOK' 
 	and T."inputMsg" not like '%"messages":%' and T."outputMsg" not like '%"messages":%'	
  	and T."outputMsg" not like '%抱歉%'     
  	and T."outputMsg" not like '%对不起%'    
	order by T."model", T."createdAt" desc 
	limit ${totalDemoTalks} `;
	// debug.log(JSON.stringify(talks));

	talks.sort(function(x:any, y:any){
		return (x.createdAt < y.createdAt) ? 1 : -1;
	});	
	
	for(let col=0; col<demoTalksColumnNumber&&talks.length>0; col++){
		let column:TestimonialData[] = [];        
		for(let row=0; row<demoTalksPerColumn&&talks.length>0; row++){
			const talk = talks.pop();
			const q = JSON.parse(talk.inputMsg);
			const a = JSON.parse(talk.outputMsg);
			column.push({
				content:a.content,
				link: ru.getBookRest(talk.modelid),
				author: {
					name: q.content,
					role: talk.modelname,
					image: getImageIcon(talk.modelcoverimg)
				}
			});
		}
		demoTalks.push(column);         
	}
	
    return {
        props: {
            user,
            hotModels,
            demoTalks,
            config,
            inWeixin
        },
    };
  
}      
 /*   
    let talks:any[] = await prisma.talk.findMany({
        where:{
            inputMsg: { length: { lte: 100, gt: 50 } },
            outputMsg: { length: { lte: 300, gt: 100 } },
            status: 'SUCCESS',
            model: { in: hotModelCodes }
        },
        take: totalDemoTalks,
        orderBy: [
            { createdAt:'desc' }
        ]
    });
*/
