import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import FlexVideo from "../components/FlexVideo";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config, system } from "../utils/config";


const services: string[] = [
    "fofr/live-portrait",
    "mbukerepo/live-portrait",
];

const serviceNames = new Map([
    ["fofr/live-portrait", "主力高表现服务"],
    ["mbukerepo/live-portrait", "备选高稳定服务"]
]);

export default function portraitVideo({simRoomBody, poseVideo, faceImageURL, config }: {simRoomBody:any, poseVideo:any, faceImageURL: string, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const title = router.query.title as string || "制作表情视频";    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [imageUrl, setImageUrl] = useState((router.query.imageURL || faceImageURL || simRoomBody?.params?.face_image ||  "") as string);
    const [drivingVideoUrl, setDrivingVideoUrl] = useState(poseVideo?.outputImage || simRoomBody?.params?.driving_video || "");
    const [drivingVideoPoster, setDrivingVideoPoster] = useState(poseVideo?.inputImage);
    const [service, setService] = useState<string>("fofr/live-portrait");
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
        let params:any = {
            service, 
            face_image:imageUrl, 
            driving_video:drivingVideoUrl,
            video_frame_load_cap: 0, // The maximum number of frames to load from the driving video. Set to 0 to use all frames.
            video_select_every_n_frames: 1, // Select every nth frame from the driving video. Set to 1 to use all frames.
            live_portrait_dsize: 576,
                //                    live_portrait_lip_zero: true,
                //                    live_portrait_eye_retargeting: true,
                //                    live_portrait_eyes_retargeting_multiplier: 1,
                //                    live_portrait_lip_retargeting: true,
                //                    live_portrait_lip_retargeting_multiplier: 1,
                //                    live_portrait_stitching: true,
                //                    live_portrait_relative: true
            };
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "portraitVideo",
                preRoomId,
                priceUnits,
                params,
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
                                <FormLabel number="1" label="清晰的人物图片"/>
                                <InputImage src={imageUrl}/>
                                <ComboSelector 
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}                                       
                                    onSelect = {(newFile) => setImageUrl(newFile)} fileType="IMAGE" /> 
                            </div>                  
                            <div className="space-y-4  w-full ">
                                <FormLabel number="2" label="表情视频模板"/>                            
                                {drivingVideoUrl && (
                                <FlexVideo src={drivingVideoUrl}  poster={drivingVideoUrl}  controls={true} autoPlay={false} loading={loading} 
                                        onLoading={(status:boolean)=>setLoading(status)}
                                        onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                            if(url != drivingVideoUrl){
                                                setDrivingVideoUrl(url);
                                            }
                                            const pus = Math.round(duration);                                            
                                            setDuration(pus);
                                            setPriceUnits(pus);      
                                        }}    
                                    />                
                                )}
                                <ComboSelector albumId={system.album.motionVideo.id} albumName="模板" selectorType="TEMPLATE" fileType="VIDEO"
                                    onSelect = {(newFile) => {
                                        setDrivingVideoUrl(newFile);
                                        setDrivingVideoPoster(newFile);
                                    }}
                                    /> 
                            </div>
                            <div className="space-y-4  w-full ">
                                <FormLabel number="3" label="服务线路"/>                            
                                <DropDown
                                    theme={service}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setService(newRoom)}
                                    themes={services}
                                    names={serviceNames}
                                    />                            
                            </div>
                           
                            <StartButton config={config} title="开始合成视频"  showPrice={true}
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
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"portraitVideo"}} />

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
