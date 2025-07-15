import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import Head from "next/head";

import { User,Room, Model } from "@prisma/client";
import prisma from "../../lib/prismadb";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { GenerateResponseData } from "../api/generate";

import DropDown from "../../components/DropDown";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import Genhis from "../../components/Genhis";
import TextareaAutosize from "react-textarea-autosize";
import PromptArea from "../../components/PromptArea";
import LoginPage from "../../components/LoginPage";
import Uploader, {mimeTypes} from "../../components/Uploader";
import ComboSelector from "../../components/ComboSelector";
import PoseSelector from "../../components/PoseSelector";
import BGSelector from "../../components/BGSelector";
import AlbumSelector from "../../components/AlbumSelector";
import ModelSelector from "../../components/ModelSelector";
import DrawRatioSelector from "../../components/DrawRatioSelector";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import PriceTag from "../../components/PriceTag";
import LoadingButton from "../../components/LoadingButton";
import MessageZone from "../../components/MessageZone";
import PromptSelector from "../../components/PromptSelector";
import FormLabel from "../../components/FormLabel";
import SquigglyLines from "../../components/SquigglyLines";
import AutoSizeImage from "../../components/AutoSizeImage";
import StartButton from "../../components/StartButton";
import ResultButtons from "../../components/ResultButtons";
import PromptAssistant from "../../components/PromptAssistant";
import Image from "../../components/wrapper/Image";

import downloadPhoto from "../../utils/fileUtils";
import { roomType, rooms, themeType, themes, themeNames, roomNames  } from "../../utils/loraTypes";
import {channelType, channels, channelNames  } from "../../utils/channels";
import {getThumbnail} from "../../utils/fileUtils";
import {callAPI, callAPI2} from "../../utils/apiUtils";
import {getImageSize} from "../../utils/fileUtils";
import * as ru from "../../utils/restUtils";
import { config, system } from "../../utils/config";
import * as debug from "../../utils/debug";
import * as enums from "../../utils/enums";
import * as monitor from "../../utils/monitor";


const faceswapLineNames:Map<string,string> = new Map([
    ["fal","fal容易拥挤死机"],
    ["rep:xiankgx/face-swap","rep:xiankgx/face-swap容易缓存错误"],
    ["rep:omniedgeio/face-swap","rep:omniedgeio/face-swap有水印"],    
    ["rep:codeplugtech/face-swap","rep:codeplugtech/face-swap速度慢"],
    ["rep:cdingram/face-swap","rep:cdingram/face-swap需要冷启动"]
]);
const faceswapLines:string[] = Array.from(faceswapLineNames.keys());

export async function getServerSideProps(ctx: any) {
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let user:any;
    // 判断是否是模型的主人
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                actors: true
            }
        });

    }
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            user,
            config
        },
    }
}  



export default function websiteConfig({ user, config }: { user: any, config:any}) {
    const title = "网站配置管理"
    
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [faceswapLine, setFaceswapLine] = useState<string>("");
    
    useEffect( () => {
    }, []); 

    async function saveConfig(){

    }
    
    let num = 1;
    if(status == "authenticated"){
        return (
            <div className="flex  mx-auto flex-col items-center justify-center min-h-screen">
                <Head>
                    <title> {title} </title>
                    <meta property="og:description" content={"史上最强的AI拍照相机"} /> 
                    <meta property="og:title" content={title} />
                    <meta property="og:image" content={config.logo32} />    
                    <meta name="description" content={"史上最强的AI拍照相机"} />
                </Head>
                <Header config={config} title={title}/>
               
                <main>
                    <div id="create" className="flex justify-between items-center w-full flex-col mt-4  mb-40">
                        
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:justify-top sm:px-2 sm:mb-5">
                            
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={`${num++}`} label="换脸服务线路"/>
                                <DropDown
                                    theme={faceswapLine}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setFaceswapLine(newRoom);
                                    }}
                                    themes={faceswapLines}
                                    names={faceswapLineNames}
                                    />
                            </div>
                        </div>

                        <div className="flex flex-row w-full items-center justify-center space-x-5">
                            <StartButton config={config} title="保存设置"
                                onStart={() => {
                                    saveConfig();
                                }}
                                />
                        </div>
                    
                    </div>
                </main>
                <Footer />
            </div>
        );
    }else{
        return(<LoginPage config={config}/>);
    }    
};
