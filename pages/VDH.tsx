import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Model, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { AnimatePresence, motion } from "framer-motion";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import Video from "../components/wrapper/Video";
import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import Pagination from '../components/Pagination';
import LoginPage from "../components/LoginPage";
import {countAndCut} from "../components/Genhis";

import {channelType, channels, loraChannels, channelNames} from "../utils/channels";
import {isWeixinBrowser} from "../utils/wechatUtils";
import {bookLabels, portraitLabels} from "../utils/labels";
import * as am from "./api/actionManager";
import {callAPI} from "../utils/apiUtils";
import * as ru from "../utils/restUtils";
import { config } from "../utils/config";
import {getThumbnail} from "../utils/fileUtils";
import * as monitor from "../utils/monitor";
import * as fc from "../utils/funcConf";

import {showVideoTool} from "./videoTools";

export default function VDH({ user, config, inWeixin }: {user: User, config:any, inWeixin:boolean }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [showMoreLabels, setShowMoreLabels] = useState<boolean>(false);
     
    const router = useRouter();
    const appId = router.query.appId;     
    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 48;
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);
    const windowTitle = "虚拟数字人物";

    const [videoTools, setVideoTools] = useState<any[]>([
        JSON.parse(JSON.stringify(fc.getAIFuncByCode("createSpeaker"))),    
        JSON.parse(JSON.stringify(fc.getAIFuncByCode("sadTalker"))),            
        JSON.parse(JSON.stringify(fc.getAIFuncByCode("createVideo"))),
        JSON.parse(JSON.stringify(fc.getAIFuncByCode("videoRetalk"))),
    ]);
    
    async function gotoModelPage(page:number){
        const res = await callAPI("/api/updateModel", {cmd:"GOTOPAGE", pageSize:modelPageSize, currentPage:page, func:"lora", channel:"FASHION"});
        if (res.status != 200) {
            alert(res.result);
        }else{
            setModelCurrentPage(page);
            setModelPageCount(res.result.pageCount);
            setModels(res.result.models);
        }
    }
    
    useEffect(() => {
        let step = 1;
        for(let step=1; step<=videoTools.length; step++){
            videoTools[step-1].name = `${step}. ${videoTools[step-1].name}`;
        }
        
        gotoModelPage(1);
    }, []); // 空数组表示只在组件挂载时执行一次  

    function showModel(model: Model, title?:string) {
        let url = `/showImageModel?channel=FASHION&model=${model.code}`;
        if(model){
            return(
                <div className="flex flex-col">
                    <div className= "group masonry-item border-gray-200 text-center flex-col relative inline-block "  >
                        <Link  className="items-center"  href={"#"}
                            onClick={() => {
                                window.open(`/showImageModel?channel=FASHION&modelId=${model.id}&title=给“${model.name}”拍照&desc=${model.name}的写真集&action=给${model.name}加分`, "_blank");               
                            }}   
                            >
                            <Image
                                alt="Generated photo"
                                width={576}
                                src={model.coverImg}
                                className= {"object-cover w-full sm:mt-0 mt-2 rounded-xl"}
                                />
                        </Link>
                        {title && (
                        <span className="absolute top-2 right-1  button-gold w-20 text-base px-2 py-1 rotate-45">{title}</span>
                        )}
    
                        <div className="block absolute text-xs text-gray-400 bottom-1 left-2 w-full flex flex-row items-left">
                            <Image src="/price.svg"  className="w-4" alt={`需要${config.creditName}数`} />
                            <span className={"flex  text-center  px-1 " + (model.price>0 ? "text-gray-100 " : "text-yellow-400") } >
                                {model.price}
                            </span>                  
                            <Image src="/runtimes.svg" className="w-4" alt="运行次数" />
                            <span className="flex text-center px-1 text-gray-100 "  >
                                {model.runtimes}
                            </span>    
                        </div>
                    </div>
                    
                    <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                        <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" } >
                            {countAndCut(model.name,24)}
                        </span>                  
                    </div>        
                </div>    
                );
        }else{
            return( <div className="flex felx-col"></div> );
        }
    }    

    if(status == "authenticated" || status == "unauthenticated"){
        return (
            <TopFrame config={config}>
                <main>
                    <div className="w-full flex flex-col items-center sm:flex-row sm:items-start px-3 space-y-5 sm:space-x-5">
                        <div className="w-full max-w-sm flex flex-col items-center space-y-5">
                            <div className="page-tab px-5 pt-5 pb-10 rounded-xl w-full flex flex-col items-center justify-start space-y-5">
                                <Video controls={true} loop autoPlay={false} 
                                    className={"h-auto w-full mx-5 rounded-lg"}
                                    src={config.RS + "/aixiezhen/help/vdh.mp4"} 
                                    poster={config.RS + "/aixiezhen/help/vdh.jpg"}                     
                                    />             
                                <div className="w-full flex flex-col items-center space-y-2">
                                    <p className="font-thin text-gray-300 text-base text-left">
                                        “现在制作并公开分享您的数字人物，您将马上获得其它人使用的付费分成！”
                                    </p>
                                </div>                            
                                <button className="button-gold px-16 py-2 mb-2 rounded-xl"
                                    onClick={() => {
                                        window.open(`/createLoRA?title=数字人物&channel=FASHION&theme=FACE`, "_blank");
                                    }}
                                    >
                                    创建我的数字人物
                                </button>    
                                <Link className="text-lg underline underline-offset-4 pt-5" href="/dashboard?segment=IMGMODEL&page=1&modelChannel=FASHION">
                                    我的数字人物...
                                </Link>
                            </div>
                            <div className="w-full flex flex-col items-center">
                                <p className="text-center text-lg mt-4">
                                    数字人使用步骤：
                                </p>
                            </div>
                            <div className="w-full grid grid-flow-row-dense grid-cols-1 gap-4 justify-center items-center">
                                {videoTools.map((tool) => (
                                    showVideoTool(tool, config, true)
                                ))}
                            </div>
                        </div>
                        <div className="w-full flex sm:flex-1 flex-col items-center justify-start">
                            <ResizablePanel>
                              <AnimatePresence mode="wait">
                                <motion.div className="flex justify-between items-center w-full flex-col">                          
                                    <div className="w-full flex flex-col space-y-0 sm:space-y-10 mb-4 rounded-xl items-center space-x-2">
                                        <div className={ "grid grid-flow-row-dense gap-5 items-center w-full grid-cols-2 sm:grid-cols-5"} >
                                            {models && models.length>0 && models.map((m) => (
                                                showModel(m)
                                            ))}
                                        </div>
                                        <Pagination pageCount={modelPageCount} currentPage={modelCurrentPage}  
                                            onPageChange={(page) => {
                                                gotoModelPage(page);
                                            }}  /> 
                                    </div>
                                </motion.div>
                              </AnimatePresence>
                            </ResizablePanel>
                        </div>
                    </div>   
                </main>
            </TopFrame>
        );
    }else{
        return ( <LoginPage config={config}/> );
    }     
};

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
