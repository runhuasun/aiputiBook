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

import * as debug from "../utils/debug";
import downloadPhoto from "../utils/fileUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config, system } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import FlexVideo from "../components/FlexVideo";
import FlexAudio from "../components/FlexAudio";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";



const mixSources = [
    "audio",
    "video"
];
const mixSourceNames = new Map([
    ["audio", "音频素材"],
    ["video", "提取视频中的音频"],    
]);


export default function videoMixAudio({ simRoomBody, voice, video, config }: { simRoomBody:any, video: string, voice: string, config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [fromCurrent, setFromCurrent] = useState<boolean>(simRoomBody?.params?.fromCurrent || false);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [mixVideoURL, setMixVideoURL] = useState(video || simRoomBody?.params?.mixVideoURL);
    const [audioURL, setAudioURL] = useState(voice || simRoomBody?.params?.audioURL);
    const [videoURL, setVideoURL] = useState<string>(simRoomBody?.params?.videoURL);
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [mixSource, setMixSource] = useState(simRoomBody?.params?.mixSource || "audio");
    const [keepOriginal, setKeepOriginal] = useState<boolean>(true);

    const mixVideoRef = useRef<HTMLVideoElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    const [mixVideoDuration, setMixVideoDuration] = useState<number>(0);
    const [mixVideoCurrent, setMixVideoCurrent] = useState<number>(0);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [audioDuration, setAudioDuration] = useState<number>(0);
    const [videoCurrent, setVideoCurrent] = useState<number>(0);
    const [audioCurrent, setAudioCurrent] = useState<number>(0);

    function shorter(num1:number, num2:number){
        return num1 < num2 ? num1 : num2;
    }
    
    async function generate() {
        if(mixVideoURL == null || mixVideoURL.length < 1){
            alert("请上传原始视频！");
            return;                                                           
        }      
        if(mixSource == "audio" && !audioURL){
            alert("请上传一段用于配音的音频素材！");
            return;                                                           
        }
        if(mixSource == "video" && !videoURL){
            alert("请上传一段用来提取音频的视频素材！");
            return;                                                           
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoMixAudio", 
                preRoomId,
                timeStamp: Date.now(),
                priceUnits,
                params:{
                    mixSource,
                    mixVideoURL, 
                    audioURL,
                    videoURL,
                    keepOriginal,
                    fromCurrent,
                    videoDuration,
                    audioDuration,
                    videoCurrent,
                    audioCurrent,                    
                }
            },
            "视频生成",
            "VIDEO",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            }
        );
    }

    useEffect(() => {
        if(audioURL){
            const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
    
            if (audioPlayer) {
                audioPlayer.onloadedmetadata = () => {
                    setPriceUnits(Math.ceil(audioPlayer.duration));
                };
            }
        }else{
            setPriceUnits(0);
        }
    }, [audioURL]); // 依赖数组确保每次 audioURL 变化时重载 metadata

    
    let num = 1;

    return (
        <TopFrame config={config}>
            <main>
                
                <ToolBar config={config} roomId={preRoomId} videoURL={mixVideoURL}/>
                
                <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                    
                    <div className="page-tab-video-edit">
                        
                        <div className="space-y-4 w-full max-w-xl">
                            <FormLabel number={`${num++}`} label="原始视频（.mp4）"/>
                            {mixVideoURL && (
                            <FlexVideo ref={mixVideoRef} src={mixVideoURL}  poster={mixVideoURL}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != mixVideoURL){
                                            setMixVideoURL(url);
                                        }
                                        setMixVideoDuration(duration);
                                        setMixVideoCurrent(current);
                                    }}    
                                />            
                            )}
                            <ComboSelector 
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setMixVideoURL(newFile)} fileType="VIDEO" />                        
                        </div>

                        <div className="space-y-4 w-full max-w-xl">
                            <FormLabel number={`${num++}`} label="选择音频来源" />
                            <DropDown
                                theme={mixSource}
                                // @ts-ignore
                                setTheme={(newRoom) => setMixSource(newRoom)}
                                themes={mixSources}
                                names={mixSourceNames}
                                />
                        </div>    
                        
                        {mixSource == "audio" && (
                        <div className="space-y-4 mt-4 w-full max-w-xl">
                            <div className="flex flex-row mt-6 items-center space-x-3">
                                <FormLabel number={`${num++}`} label="音频素材（.mp3/.wav）"/>
                                <Link
                                    href="/createVoice" target="_blank"
                                    className="button-green-blue mt-3 px-2" >
                                    制作音频
                                </Link>                                     
                            </div>
                            {audioURL && (
                            <FlexAudio src={audioURL} ref={audioRef} key={audioURL} controls={true} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onAudioUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != audioURL){
                                            setAudioURL(url);
                                        }
                                        setAudioDuration(duration);
                                        setAudioCurrent(current);
                                    }}    
                                />                            
                            )}
                            <ComboSelector onSelect = {(newFile) => setAudioURL(newFile)} fileType="VOICE" /> 
                        </div>
                        )}

                        {mixSource == "video" && (
                        <div className="space-y-4 mt-4 w-full max-w-xl">
                            <div className="flex flex-row mt-6 items-center space-x-3">
                                <FormLabel number={`${num++}`} label="视频素材（.mp4）"/>
                            </div>
                            {videoURL && (
                            <FlexVideo ref={videoRef} src={videoURL}  poster={videoURL}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != videoURL){
                                            setVideoURL(url);
                                        }
                                        setVideoDuration(duration);
                                        setVideoCurrent(current);
                                    }}    
                                />
                            )}                            
                            <ComboSelector onSelect = {(newFile) => setVideoURL(newFile)} fileType="VIDEO" /> 
                        </div>
                        )}          

                        <FormLabel number={`${num++}`} label="从视频和音频的当前时间点开始配音" isChecker={true} initValue={fromCurrent} onValueChange={(value) => {
                            setFromCurrent(value);
                        } }/>
                        
                        <FormLabel number={`${num++}`} label="保留原视频声音" isChecker={true} initValue={keepOriginal} onValueChange={(value) => {
                            setKeepOriginal(value);
                        } }/>                            

                        <StartButton config={config} title="开始合成视频"  units={priceUnits} unitName={"秒音频"} minTime={5} maxTime={10} timeUnit={"分钟"}
                            showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}
                            />
                        
                    </div>

                    <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                        restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoMixAudio"}} />
                    
                </div>
                
            </main>
            
        </TopFrame>
    );
        
};
      
      
      
export async function getServerSideProps(ctx: any) {
    let imgId = ctx?.query?.roomId;
    let voice = ctx?.query?.voiceURL;;
    let video = ctx?.query?.videoURL;;
   
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    if(imgId){
        const room = await prisma.room.findUnique({ where: {id: imgId} });
        if(room?.outputImage && room?.resultType == "VOICE"){
            voice = room.outputImage;
        }else if(room?.outputImage && room?.resultType == "VIDEO"){
            video = room.outputImage;
        }
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),                        
            voice,
            video,
            config
        },
    };
}            
