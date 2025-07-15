import React, { useState, useRef } from "react";
import { NextPage } from "next";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";
import FlexVideo from "../components/FlexVideo";
import ResultView from "../components/ResultView";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import prisma from "../lib/prismadb";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";



const languageNames = new Map([
    ["cn", "中文"],        
    ["en", "英文"],
    ["ja", "日文"],      
    ["es", "西班牙语"],    
    ["pt", "葡萄牙语"],    
    ["id", "印尼语"], 
]);
const languages = Array.from(languageNames.keys());

export default function videoTranslate({ simRoomBody, video, config }: { simRoomBody:any, video: string, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [videoURL, setVideoURL] = useState<string>(video || simRoomBody?.params?.videoURL);
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [sourceLang, setSourceLang] = useState(simRoomBody?.params?.sourceLang || "cn");
    const [targetLang, setTargetLang] = useState(simRoomBody?.params?.targetLang || "en");

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();


    async function generate() {
        if(!videoURL){
            alert("请上传一段视频素材！");
            return;                                                           
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoTranslate", 
                preRoomId,
                priceUnits,
                params:{
                    videoURL,
                    sourceLang,
                    targetLang,
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
                <ToolBar config={config} roomId={preRoomId} videoURL={videoURL}/>
                
                <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                    
                    <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-4 w-full max-w-xl">
                        
                        <div className="space-y-4 w-full max-w-xl">
                            <FormLabel number={`${num++}`} label="原始视频（.mp4）"/>
                            {videoURL && (
                            <FlexVideo ref={videoRef} src={videoURL}  poster={videoURL}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != videoURL){
                                            setVideoURL(url);
                                        }
                                        setPriceUnits(Math.ceil(duration));
                                    }}    
                                />            
                            )}
                            <ComboSelector 
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setVideoURL(newFile)} fileType="VIDEO" />                        
                        </div>

                        <div className="space-y-4 w-full max-w-xl">
                            <FormLabel number={`${num++}`} label="选择原片语言" />
                            <DropDown
                                theme={sourceLang}
                                // @ts-ignore
                                setTheme={(newRoom) => setSourceLang(newRoom)}
                                themes={languages}
                                names={languageNames}
                                />
                        </div>    
                        
                        <div className="space-y-4 w-full max-w-xl">
                            <FormLabel number={`${num++}`} label="选择目标语言" />
                            <DropDown
                                theme={targetLang}
                                // @ts-ignore
                                setTheme={(newRoom) => setTargetLang(newRoom)}
                                themes={languages}
                                names={languageNames}
                                />
                        </div>    
                        
                        <StartButton config={config} title="开始合成视频"  units={priceUnits} unitName={"秒音频"}
                            minTime={5} maxTime={10} timeUnit={"分钟"}
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
                        restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoTranslate"}} />
                    
                   
                </div>
                
            </main>
        </TopFrame>
    );
        
};
      
      
      
export async function getServerSideProps(ctx: any) {
    let imgId = ctx?.query?.roomId;
    let video = ctx?.query?.videoURL;;
   
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    if(imgId){
        const room = await prisma.room.findUnique({ where: {id: imgId} });
        if(room?.outputImage && room?.resultType == "VIDEO"){
            video = room.outputImage;
        }
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),                        
            video,
            config
        },
    };
}            
