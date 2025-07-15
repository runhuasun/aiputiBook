import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import FlexVideo from "../components/FlexVideo";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import downloadPhoto from "../utils/fileUtils";
import { config } from "../utils/config";
import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";




export async function getServerSideProps(ctx: any) {
    let roomId = ctx?.query?.roomId;
    let video:any;
    
    if(roomId){
        video = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });
    }
    
    monitor.logUserRequest(ctx);

    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                        
            video,
            config,
        },
    };
}  

const modelNames = new Map([
    ["gfpgan-video-v1.3", "gfpgan 1.3版（更高质量）"],    
    ["gfpgan-video-v1.4", "gfpgan 1.4版（更多细节）"],
    ["gfpgan-video-RestoreFormer", "RestoreFormer"],
    ["real-esrgan-video", "real-esrgan （更稳定）"],
    ["byte-video_upscale", "视频超分辨率（固定2倍）"],
]);
const models = Array.from (modelNames.keys());

export default function zoomInVideo({ simRoomBody, video, config }: { simRoomBody:any, video:Room, config:any}) {
    const router = useRouter();    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.videoURL || video?.outputImage || simRoomBody?.params?.video || "") as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [model, setModel] = useState<string>("byte-video_upscale");
    
    const [upscale, setUpscale] = useState<number>(simRoomBody?.params?.scale || 2);
     
    // 放大视频
    async function generate() {
        if(!originalPhoto){
            return alert("请先上传一段需要放大的视频");
        }
        if(priceUnits == 0){
            return alert("当前视频的长度为0，或者视频格式不能被正确识别，请刷新页面或者换一个视频。");
        }
        const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "zoomInVideo", 
                    preRoomId,                    
                    priceUnits, 
                    priceModel: {upscale, func:model}, 
                    params: {            
                        func: model, 
                        video: originalPhoto,
                        scale: upscale
                    }
                },
                "放大",
                "VIDEO",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                    mutate();
                    setRestoredImage(res.result.generated);
                    setRestoredId(res.result.genRoomId);                                      
                }
            );
        
    }

    const title="视频高清放大";
    let num = 1;
    
        return (
            <TopFrame config={config}>
                
                <main>
                    <ToolBar config={config} roomId={preRoomId} videoURL={originalPhoto}/>                    
                    
                    <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">

                        <div className="page-tab-video-edit">
                            <FormLabel number={`${num++}`} label="选择视频放大模型" />
                            <DropDown
                                theme={model}
                                // @ts-ignore
                                setTheme={(newRoom) => setModel(newRoom)}
                                themes={models}
                                names={modelNames}
                                />

                            <FormLabel number={`${num++}`} label="原始视频" />
                            {originalPhoto && (
                            <FlexVideo src={originalPhoto}  poster={originalPhoto}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != originalPhoto){
                                            setOriginalPhoto(url);
                                        }
                                        setPriceUnits(duration);                                            
                                    }}    
                                />                
                            )}                                
                            <ComboSelector fileType="VIDEO" 
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => {
                                    setOriginalPhoto(newFile);
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                                
                                }} />    

                            <FormLabel number={`${num++}`} label={`放大倍数：${upscale}`} />
                            {model !== "byte-video_upscale" && (
                            <input type="range" value={upscale} min="2" max="4" step="1" className="slider-dark-green w-full mt-4"                            
                                onChange={(e) => setUpscale(parseInt(e.target.value))}
                                />
                            )}
                            
                       
                            <StartButton config={config} title="开始放大视频"  minTime={5} maxTime={10} timeUnit={"分钟"} 
                                model={{upscale, func:model}} units={priceUnits} unitName={"秒内容"} 
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
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"zoomInVideo"}} />                        
                   
                    </div>
                </main>
            </TopFrame>
        );
};





