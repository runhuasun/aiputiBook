import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import { useSession, signIn } from "next-auth/react";
import { getServerSession } from "next-auth";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User, Room } from "@prisma/client";

import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2, callAPI } from "../utils/apiUtils";
import downloadPhoto from "../utils/fileUtils";
import * as debug from "../utils/debug";
import { config, system } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import FlexVideo from "../components/FlexVideo";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";



export default function videoMixAIAudio({ simRoomBody, video, config }: { simRoomBody:any, video:any, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status="authenticated" } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [prompt, setPrompt] = useState<string>(video?.prompt || simRoomBody?.params.prompt || "");
    const [videoURL, setVideoURL] = useState(router?.query?.videoURL || video?.outputImage || simRoomBody?.params?.video || "");
    const [duration, setDuration] = useState<number>(simRoomBody?.params?.duration || 0);
    const [priceUnits, setPriceUnits] = useState<number>(0);

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (video) {
            setDuration(video.duration);
            setPriceUnits(Math.round(video.duration));
        }
    };    
    
    async function generate() {
        setLoading(true);
        try{
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "videoMixAIAudio", 
                    preRoomId,                    
                    priceUnits,
                    params:{
                        prompt, 
                        video: videoURL,
                        duration, 
                    }
                },
                "视频配音",
                "VIDEO",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                   mutate();
                   setRestoredImage(res.result.generated);
                   setRestoredId(res.result.genRoomId);                                      
                }            
            );
        }catch(err){
            debug.error(err);
        }finally{
            setLoading(false);
        }
    }

    
    let num = 1;
    
        return (
            <TopFrame config={config}>

                <main>  
                    <ToolBar config={config} roomId={preRoomId} videoURL={videoURL}/>
    
                    <div className="page-container">

                        <div className="page-tab-video-edit">

                            <div className="space-y-4 w-full max-w-xl">
                                <FormLabel number={`${num++}`} label="原始视频" onCancel={() => setVideoURL("")} />
                                <div className="w-full flex flex-col items-center">                      
                                    {videoURL && (
                                    <FlexVideo ref={videoRef} src={videoURL}  poster={videoURL}  controls={true} autoPlay={false} loading={loading} 
                                            onLoading={(status:boolean)=>setLoading(status)}
                                            onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                                if(url != videoURL){
                                                    setVideoURL(url);
                                                }
                                                setDuration(duration);
                                                setPriceUnits(Math.round(duration));
                                            }}    
                                        />                
                                    )}
                                </div>
                                <ComboSelector selectorType="GENERAL" 
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}                                       
                                    onSelect={(newFile) => setVideoURL(newFile)} fileType="VIDEO" />    
                            </div>

                            <div className="space-y-4 w-full max-w-xl">
                                <div className="w-full space-x-3 flex flex-row">
                                    <FormLabel number={`${num++}`} label="描绘声音内容（不填系统会根据画面自行判断）"/>
                                </div>   
                                <div className="relative inline-block w-full">
                                    <PromptArea
                                        hotWords="AUDIO"
                                        hasAdvanceButton={false}
                                        userPrompt={prompt}
                                        onUserPromptChange={(up) => setPrompt(up) }
                                        />
                                </div>
                            </div>
                            
                     
                            <StartButton config={config} title="开始生成视频" units={priceUnits} unitName={"秒内容"} 
                                minTime={30} maxTime={60} timeUnit="分钟"
                                showPrice={true}
                                loading={loading}
                                onStart={async () => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                      
                                    generate();
                                }}
                                />
                        
                        </div>

                        <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoMixAIAudio"}} />
                        
                    </div>
                </main>
            </TopFrame>
        );
    
};
      
      
      
export async function getServerSideProps(ctx: any) {
    const video = ctx?.query?.roomId ? await prisma.room.findUnique({ where: {id:ctx?.query?.roomId} }) : undefined;
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                        
            video,
            config
        },
    };
}      
