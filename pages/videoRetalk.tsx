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
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import FlexVideo from "../components/FlexVideo";
import FlexAudio from "../components/FlexAudio";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";


const modelNames = new Map([
    ["latentsync", "LTS专业唇形同步模型"],    
    ["musetalk", "MT智能唇形同步模型"],    
    ["lip-sync", "LS高级唇形同步模型"],    
    ["retalk", "RT基础唇形同步模型"],    
    ["videoretalk", "ALI唇形同步模型"],    
    ["kling-lip-sync", "Kling唇形同步模型"],        
]);
const models = Array.from(modelNames.keys());


export default function videoRetalk({ simRoomBody, voice, video, config }: { simRoomBody:any, video: string, voice: string, config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [priceUnits, setPriceUnits] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    const [videoUrl, setVideoUrl] = useState(video || simRoomBody?.params?.face);
    const [audioUrl, setAudioUrl] = useState(voice || simRoomBody?.params?.input_audio);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [audioDuration, setAudioDuration] = useState<number>(0);
    const [videoCurrent, setVideoCurrent] = useState<number>(0);
    const [audioCurrent, setAudioCurrent] = useState<number>(0);
    const [lipModel, setLipModel] = useState<string>(simRoomBody?.params?.lipModel || "videoretalk");
    const [singSong, setSingSong] = useState<boolean>(simRoomBody?.singSong || false);
    
    const [fromCurrent, setFromCurrent] = useState<boolean>(simRoomBody?.params?.fromCurrent || false);
    
    function shorter(num1:number, num2:number){
        return num1 < num2 ? num1 : num2;
    }
    
    function updatePriceUnits(){
        if(fromCurrent){
            if(lipModel != "retalk"){
                setPriceUnits(Math.ceil(audioDuration-audioCurrent));
            }else{
                setPriceUnits(Math.ceil(shorter(audioDuration-audioCurrent, videoDuration-videoCurrent)));                
            }
        }else{
            if(lipModel != "retalk"){
                setPriceUnits(Math.ceil(audioDuration));
            }else{
                setPriceUnits(Math.ceil(shorter(audioDuration, videoDuration)));
            }
        }  
    }
    
    useEffect(() => {
        updatePriceUnits();
    }, [fromCurrent, lipModel, audioDuration, videoDuration, audioCurrent, videoCurrent]); 

    
    async function generate() {
        if(priceUnits <= 0){
            return alert("请先上传视频和驱动音频");
        }
        if(audioUrl == null || audioUrl.length < 1){
            return alert("请上传一段音频来驱动画面！");
        }
        if(fromCurrent && (audioDuration - audioCurrent < 0.1)){
            return alert("当前时间点之后的音频内容太少，请调整选择！");
        }
        if(videoUrl == null || videoUrl.length < 1){
            return alert("请上传原始视频！");
        }      
        if(lipModel === "kling-lip-sync"){
            if(videoDuration < 2 || videoDuration > 10){
                return alert("当前模型要求视频长度在2-10秒之间。如果视频太长，您可以用裁剪按钮裁剪一段连续稳定的画面");
            }
        }
        if(fromCurrent && (videoDuration - videoCurrent < 0.1)){
            return alert("当前时间点之后的视频内容太少，请调整选择！");
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoRetalk", 
                preRoomId,
                timeStamp: Date.now(),
                priceUnits,
                params:{
                    singSong,
                    face:videoUrl, 
                    input_audio:audioUrl,
                    lipModel,
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

   let num = 1;

       
    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={videoUrl}/>
                
                <div className="page-container">
                    
                    <div className="page-tab-video-edit">
                        
                        <div className="space-y-4 w-full ">
                            <FormLabel number={`${num++}`} label="原始视频（必须只有一个人物）" />                                    
                            {videoUrl && (
                            <FlexVideo ref={videoRef} src={videoUrl}  poster={videoUrl}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != videoUrl){
                                            setVideoUrl(url);
                                        }
                                        setVideoDuration(duration);
                                        setVideoCurrent(current);
                                    }}    
                                />
                            )}
                            <ComboSelector
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setVideoUrl(newFile)} fileType="VIDEO" />                        
                        </div>
              
                        <div className="space-y-4 w-full">
                            <div className="flex flex-row items-center space-x-3">
                                <FormLabel number={`${num++}`} label="人声音频" />                                    
                                <Link
                                    href="/createVoice" target="_blank"
                                    className="button-green-blue mt-3 px-2" >
                                    文字转人声
                                </Link> 
                            </div>
                            {audioUrl && (
                            <FlexAudio src={audioUrl} ref={audioRef} key={audioUrl} controls={true} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onAudioUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != audioUrl){
                                            setAudioUrl(url);
                                        }
                                        setAudioDuration(duration);
                                        setAudioCurrent(current);
                                    }}    
                                />
                            )}
                            <ComboSelector onSelect = {(newFile) => setAudioUrl(newFile)} fileType="VOICE" /> 
                        </div>

                        <FormLabel number={`${num++}`} label="从背景音乐和声音中分离出人声" isChecker={true} initValue={singSong} onValueChange={(value) => {
                            setSingSong(value);
                        } }/>
                        
                        <FormLabel number={`${num++}`} label="从视频和音频的当前时间点开始配音" isChecker={true} initValue={fromCurrent} onValueChange={(value) => {
                            setFromCurrent(value);
                        } }/>

                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="唇形同步模型" hint="专业模型选择，一般用户可以使用默认模型"/>
                            <DropDown
                                theme={lipModel}
                                // @ts-ignore
                                setTheme={(newRoom) => setLipModel(newRoom)}
                                themes={models}
                                names={modelNames}
                                />
                        </div> 
                        
                        <StartButton config={config} title="开始合成视频"  units={priceUnits} unitName={"秒音频"} model={lipModel} minTime={5} maxTime={10} timeUnit={"分钟"}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}
                            />
                        
                    </div>

                    <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                        restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoRetalk"}} />
                    
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
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                        
            voice,
            video,
            config
        },
    };
  
}            
