import React, { useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import FlexVideo from "../components/FlexVideo";
import ComboSelector from "../components/ComboSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";


export default function videoMatting({ simRoomBody, video, config }: { simRoomBody:any, video: Room, config:any }) {
    
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [priceUnits, setPriceUnits] = useState<number>(0);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [videoUrl, setVideoUrl] = useState((router.query.videoURL || video?.outputImage || simRoomBody?.params?.input_video || "") as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    async function generate() {
        if(videoUrl == null || videoUrl.length < 1){
            alert("请上传一段视频来生成视频画面！");
            return;                                                           
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoMatting",
                preRoomId,
                priceUnits,                
                params: {
                    input_video: videoUrl,
                    output_type: "green-screen"
                }
            },
            "视频绿幕",
            "VIDEO",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            }     
        );
    }

    

        return (
            <TopFrame config={config}>
          
                <main>
                    <ToolBar config={config} roomId={preRoomId} videoURL={videoUrl}/>
                    
                    <div className="page-container">
                        <div className="page-tab-video-edit">
                            
                            <div className="space-y-4 w-full max-w-lg mb-5">
                                <FormLabel number="1" label="上传包含人物的视频素材(.mp4)"/>
                                {videoUrl && (
                                <FlexVideo src={videoUrl}  poster={videoUrl}  controls={true} autoPlay={false} loading={loading} 
                                        onLoading={(status:boolean)=>setLoading(status)}
                                        onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                            if(url != videoUrl){
                                                setVideoUrl(url);
                                            }
                                            setPriceUnits(Math.round(duration));
                                        }}    
                                    />                
                                )}
                                <ComboSelector fileType="VIDEO" 
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}                                       
                                    onSelect={(newFile) => { setVideoUrl(newFile)}} />                   
                            </div>
                            
                            <StartButton config={config} title="开始抠视频绿幕" units={priceUnits} unitName={"秒内容"}
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
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoMatting"}} />
                                           

                    </div>
                </main>                
            </TopFrame>
        );
};

      


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let videoId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    monitor.logUserRequest(ctx, session);

    if(videoId){
        let video = await prisma.room.findUnique({
            where: {
                id: videoId,
            }
        });
        
        return {
            props: {
                simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                            
                video,
                config
            },
        };
    }else{
        return {
            props:{
                config
            }
        }
    }
}            
