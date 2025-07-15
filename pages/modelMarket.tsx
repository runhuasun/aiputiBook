import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";

import { Toaster, toast } from "react-hot-toast";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { uploader, cnLocale, uploaderOptions} from "../components/uploadOption";
import { showModel} from "../components/Genhis";
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import ResizablePanel from "../components/ResizablePanel";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import Toggle from "../components/Toggle";
import Image from "../components/wrapper/Image";

import {channelType, channels, loraChannels, channelNames} from "../utils/channels";
import {isWeixinBrowser} from "../utils/wechatUtils";
import {bookLabels, portraitLabels} from "../utils/labels";
import * as am from "./api/actionManager";
import {callAPI} from "../utils/apiUtils";
import Pagination from '../components/Pagination';
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";



export default function modelMarket({ user, config, inWeixin }: {user: User, config:any, inWeixin:boolean }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [showMoreLabels, setShowMoreLabels] = useState<boolean>(false);
     
    const router = useRouter();
    const func = router.query.func ? router.query.func.toString() : "";
    const channel = router.query.channel ? router.query.channel.toString() : "";    
    const appId = router.query.appId;     
    const showHistory = router.query.showHistory;
    const showFavorites = router.query.showFavorites;
    const showLabel = (!router.query.showLabel || router.query.showLabel=="TRUE") 
        && (channel=="BOOK" || channel=="PORTRAIT")
        && !showHistory && !showFavorites ;
    
    const [word, setWord] = useState<string>(router.query.word ? router.query.word.toString() : "");
    //const [func, setFunc] = useState<string>(router.query.func ? router.query.func.toString() : "");
    //const [channel, setChannel] = useState<string>(router.query.channel ? router.query.channel.toString() : "");
   
    const [label, setLabel] = useState<string>(router.query.label ? router.query.label.toString() : "全部");
    
    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 20;
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);

    let labels:any[] = [];
    let subTitle = ""
    switch(channel){
        case "BOOK":
            labels = bookLabels;
            break;
        case "PORTRAIT":
            labels = portraitLabels;
            subTitle = "挑选一个您喜欢的套系，拍一套AI写真吧！";
            break;
    }
            
    const hotLabels = inWeixin ? labels.slice(0, 5) : labels.slice(0,10);
    const moreLabels = inWeixin ? labels.slice(5) : labels.slice(12);
    const windowTitle = router.query.title ? router.query.title as string : ((channel ? channelNames.get(channel) : "小模型集市") + (label ? (" - " + label) : ""));

    async function gotoModelPage(page:number, newLabel:string=label, newWord:string=word){
        const res = await callAPI("/api/updateModel", {cmd:"GOTOPAGE", pageSize:modelPageSize, currentPage:page, func, channel, 
                                                       label:newLabel, word:newWord, showFavorites, showHistory});
        if (res.status != 200) {
            alert(res.result);
        }else{
            setModelCurrentPage(page);
            setModelPageCount(res.result.pageCount);
            setModels(res.result.models);
        }
    }
    
    async function showModelsByLabel(newLabel:string){
        setLabel(newLabel);
        setWord("");
        gotoModelPage( 1, newLabel, "" );
    }

    function searchBook(){
        if(word && word.length>0){
            gotoModelPage( 1 , "", word);
        }else{
            alert("请先输入你想搜索的内容");
        }
    }
    
    useEffect(() => {
        gotoModelPage(1);
    }, [func, channel]); // 空数组表示只在组件挂载时执行一次  


    async function modelAction(model:any, url:string){
        if(user && model){
            // 记录用户行为
            if(model.channel === "BOOK" || model.channel === "TRAVEL"){
                const res = await fetch(`/api/actionManager?cmd=READ${model.channel}&userId=${user.id}&bookId=${model.id}`, { method: "POST",
                    headers: {
                        "Content-Type": "application/xml",
                    },
                }); 
                window.location.href = ru.getBookRest(model.id ) + (appId ? `?appId=${appId}` : "");
                return;
            }
            
            if(isWeixinBrowser() && appId && (model.channel != "PORTRAIT") ){
                // 修改用户当前应用的当前默认模型
                let service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                    "&userId=" + user.id;
                if(func=="lora"){
                  service += "&drawMethod=LORA&key=TEXT2IMG_MODEL" + "&value=" + model.id;
                }else if(func == "chat"){
                  service += "&key=CHAT_MODEL_ID" + "&value=" + model.id;
                }
              
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
                if(model.channel == "PORTRAIT"){
                    if(config.websiteName == "aiputi"){
                        window.location.href=`/pld/takePhoto?model=${model.code}`;
                    }else{
                        window.open("/showImageModel?channel=PORTRAIT&modelId=" + model.id, "_blank");
                    }
                }else{
                    window.location.href=url;
                }
            }
        }else{
            window.location.href=url;
        }
    } 

    
    
    if(status == "authenticated" || status == "unauthenticated"){
        
        return (
            <TopFrame config={config}>
                { showLabel && (
                <div className="w-full">
                    <div className="w-full mb-5 grid grid-flow-row-dense gap-0 items-center grid-cols-6 sm:grid-cols-12  divide-x divide-slate-600 text-gray-200 " >
                        <div className="w-full flex flex-row items-center justify-center">
                            <button className={(label=="全部") ? "button-green-blue px-6 mx-4" : "button-hotword rounded-xl px-6 mx-4"}
                                onClick={() => {
                                    showModelsByLabel("全部");
                                }} >
                                全部
                            </button>  
                        </div>                            
                        {hotLabels.map((m) => (
                        <div className="w-full flex flex-row items-center justify-center">
                            <button className={(label==m) ? "button-green-blue px-6 mx-4" : "button-hotword rounded-xl px-6 mx-4"}
                                onClick={() => {
                                    showModelsByLabel(m);
                                }}>
                                {m}
                            </button>
                        </div>
                        ))}
                        <div className="w-full flex flex-row items-center justify-center">
                            <button className="button-hotword rounded-xl px-6 mx-4"
                                onClick={() => {
                                    showMoreLabels ? setShowMoreLabels(false) : setShowMoreLabels(true);
                                }} >
                                更多...
                            </button>                    
                        </div>
                    </div>

                    {showMoreLabels && (
                    <div className="w-full grid grid-flow-row-dense gap-y-2 items-center grid-cols-6 sm:grid-cols-12 divide-x divide-slate-600 text-gray-200" >
                        {moreLabels.map((m) => (
                        <div className="w-full flex flex-row items-center justify-center">                        
                            <button className={(label==m) ? "button-green-blue px-6 mx-4" : "button-hotword rounded-xl px-6 mx-4"}
                                onClick={() => {
                                    showModelsByLabel(m);
                                }}>
                                {m}
                            </button>
                        </div>
                        ))}
                
                    </div>                        
                    )}
                    
                </div>                
                )}

                {/* config.websiteName != "aiputi" && (
                <div className="w-full sm:pt-5 sm:w-1/2 flex flex-row items-center justify-center sm:mb-6 px-4">
                    <input id="iptWord" type="text" value = {word}
                        className="input-search flex flex-1 font-medium px-4 h-10" 
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
                    <button className="button-search flex w-30 h-10 px-6 sm:px-8 items-center"
                        onClick={() => {
                            searchBook();
                        }}
                        >
                        搜索
                    </button>
                </div>   
                )
               
                */}
                
                <main >
                    <ResizablePanel>
                      <AnimatePresence mode="wait">
                        <motion.div className="flex justify-between items-center w-full flex-col">                     
                            <div className="items-center w-full sm:pt-2 pt-0 flex flex-col px-3 space-y-0 sm:space-y-3 sm:mb-0 mb-3">
                                <div className="w-full flex flex-col space-y-0 sm:space-y-10 mt-4 mb-4 pt-1 rounded-xl items-center space-x-2">
                                    <div className={ "grid grid-flow-row-dense gap-3 items-center w-full " + (inWeixin ? (func=="lora" ? " grid-cols-2 " : " grid-cols-2 ") : " grid-cols-2 sm:grid-cols-10 ") } >
                                        {models && models.map((m) => (
                                            showModel(m, modelAction, " rounded-xl ",  " text-gray-100 ")
                                        ))}
                                    </div>
                                    <Pagination pageCount={modelPageCount} currentPage={modelCurrentPage}  
                                        onPageChange={(page) => {
                                            gotoModelPage(page);
                                        }}  /> 
                                </div>
                            </div>   
                        </motion.div>
                      </AnimatePresence>
                    </ResizablePanel>

                    {func=="lora" && channel=="PORTRAIT" && (
                    <div>
                        <p className={ "text-gray-200 text-center"} >
                            “8张照片就能创建一个新套系”
                            <Link
                                href="/createLoRA?title=写真套系&channel=PORTRAIT"
                                className="font-semibold text-gray-200 underline underline-offset-2 hover:text-green transition" >
                                创建我的套系
                            </Link>                           
                        </p>
                    </div> 
                    )}
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
