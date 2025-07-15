import React, { useState } from "react";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import FlexVideo from "../components/FlexVideo";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config, system } from "../utils/config";


export default function mimicVideo({simRoomBody, poseVideo, faceImageURL, config }: {simRoomBody:any, poseVideo:any, faceImageURL: string, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const title = router.query.title as string || "动作视频模仿";    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [imageUrl, setImageUrl] = useState((router.query.imageURL || faceImageURL || simRoomBody?.params?.faceImage ||  "") as string);
    const [drivingVideoUrl, setDrivingVideoUrl] = useState(poseVideo?.outputImage || simRoomBody?.params?.drivingVideo || "");
    const [drivingVideoPoster, setDrivingVideoPoster] = useState(poseVideo?.inputImage);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    
    async function generate() {
        if(imageUrl == null || imageUrl.length < 1){
            return alert("请上传一张照片来生成视频！");
        }      
        if(!drivingVideoUrl){
            return alert("请先选择一个表情视频的模板");
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);   
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoMimic",                
                preRoomId,
                priceUnits,
                params: {
                    faceImage:imageUrl, 
                    drivingVideo:drivingVideoUrl,
                }
            },
            title,
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
                    <ToolBar config={config} roomId={preRoomId} imageURL={imageUrl}/>
                    
                    <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                        
                        <div className="page-tab-video-create">
                            <div className="space-y-4 w-full ">
                                <FormLabel number="1" label="清晰的单人照片（至少半身或全身）"/>
                                <InputImage src={imageUrl}/>
                                <ComboSelector 
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}                                       
                                    onSelect = {(newFile) => setImageUrl(newFile)} fileType="IMAGE" /> 
                            </div>                  
                            <div className="space-y-4  w-full ">
                                <FormLabel number="2" label="动作视频模板"/>                            
                                {drivingVideoUrl && (
                                <FlexVideo src={drivingVideoUrl}  poster={drivingVideoUrl}  controls={true} autoPlay={false} loading={loading} 
                                        onLoading={(status:boolean)=>setLoading(status)}
                                        onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                            if(url != drivingVideoUrl){
                                                setDrivingVideoUrl(url);
                                                setDrivingVideoPoster(url);                                                                                                                            
                                            }
                                            const pus = Math.round(duration);
                                            setPriceUnits(pus);      
                                            setDuration(pus);
                                        }}    
                                    />                
                                )}
                                <ComboSelector albumId={system.album.danceVideo.id} albumName="模板" selectorType="TEMPLATE" fileType="VIDEO"
                                  onSelect = {(newFile) => {
                                      setDrivingVideoUrl(newFile);
                                      setDrivingVideoPoster(newFile);                                                                            
                                  }
                                }/> 
                            </div>

                            <StartButton config={config} title="开始合成视频"  showPrice={true} loading={loading}
                                units={priceUnits} unitName={"秒内容"}
                                minTime={5} maxTime={10} timeUnit="分钟"                                    
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                      
                                    generate();
                                }}
                                />
                        </div>


                        <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"videoMimic"}} />

                    </div>
                
                </main>
            </TopFrame>
        );
        
};

      
      
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let room = imgId ? await prisma.room.findUnique({ where: {id: imgId} }) : null;
    let poseVideo;
    let faceImageURL;
    if(room?.outputImage){
        if(room.outputImage.indexOf("mp4")>0){
            poseVideo = room;
        }else{
            faceImageURL = room.outputImage;
        }
    }

    monitor.logUserRequest(ctx, session);    
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            poseVideo,
            faceImageURL,
            config
        },
    };
  
}            
