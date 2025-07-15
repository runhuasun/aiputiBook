import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import * as monitor from "../utils/monitor";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import FlexVideo from "../components/FlexVideo";
import ComboSelector from "../components/ComboSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";



export default function videoConcat({ video1, video2, config }: { video1: string, video2: string, config:any }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);

    const video1Ref = useRef<HTMLVideoElement | null>(null);
    const [video1URL, setVideo1URL] = useState<string>((router.query.videoURL || video1||"") as string);
    const [video1CurrentTime, setVideo1CurrentTime] = useState(0);    
    const [video1TotalTime, setVideo1TotalTime] = useState(0);
    const [video1TrimWay, setVideo1TrimWay] = useState("AFTER");

    const video2Ref = useRef<HTMLVideoElement | null>(null);    
    const [video2URL, setVideo2URL] = useState<string>(video2||"");
    const [video2CurrentTime, setVideo2CurrentTime] = useState(0);    
    const [video2TotalTime, setVideo2TotalTime] = useState(0);
    const [video2TrimWay, setVideo2TrimWay] = useState("AFTER");
    
    
    async function generate() {
        if(!video1URL){
            alert("请上传一段视频！");
            return;                                                           
        }      

        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "videoConcat", 
                preRoomId,
                params:{
                    video1URL,
                    video1CurrentTime, 
                    video1TotalTime,
                    video1TrimWay,
                    
                    video2URL,
                    video2CurrentTime,
                    video2TotalTime,
                    video2TrimWay,
                }
            },
            "视频拼接",
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
                    <ToolBar config={config} roomId={preRoomId} videoURL={video1URL}/>
                    
                    <div className="page-container">
                        
                        <div className="page-tab-video-edit">
                            
                            <FormLabel number={`${num++}`} label="原始视频-1（.mp4）" onCancel={() => setVideo1URL("")}/>
                            {video1URL && (
                            <FlexVideo ref={video1Ref} src={video1URL}  poster={video1URL}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != video1URL){
                                            setVideo1URL(url);
                                        }
                                        setVideo1TotalTime(duration);
                                        setVideo1CurrentTime(current);
                                    }}    
                                />
                            )}
                            <ComboSelector 
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                   
                                onSelect = {(newFile) => setVideo1URL(newFile)} fileType="VIDEO" />                        

                            <div className="w-full flex flex-row justify-center items-center space-x-4 pb-5">
                                <label className="px-3">
                                    <input type="radio" value="BEFORE" checked={video1TrimWay === 'BEFORE'} onChange={(e) => setVideo1TrimWay(e.target.value)}  />
                                    保留当前时间之前
                                </label>
                                <label className="px-3">
                                    <input type="radio"  value="AFTER" checked={video1TrimWay === 'AFTER'} onChange={(e) => setVideo1TrimWay(e.target.value)} />
                                    保留当前时间之后
                                </label>
                            </div>    
                            
                            <FormLabel number={`${num++}`} label="原始视频-2（.mp4）" onCancel={() => setVideo2URL("")}/>
                            {video2URL && (
                            <FlexVideo ref={video2Ref} src={video2URL}  poster={video2URL}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != video2URL){
                                            setVideo2URL(url);
                                        }
                                        setVideo2TotalTime(duration);
                                        setVideo2CurrentTime(current);
                                    }}    
                                />
                            )}
                            <ComboSelector onSelect = {(newFile) => setVideo2URL(newFile)} fileType="VIDEO" />                        

                            <div className="w-full flex flex-row justify-center items-center space-x-4 pb-5">
                                <label className="px-3">
                                    <input type="radio" value="BEFORE" checked={video2TrimWay === 'BEFORE'} onChange={(e) => setVideo2TrimWay(e.target.value)}  />
                                    保留当前时间之前
                                </label>
                                <label className="px-3">
                                    <input type="radio"  value="AFTER" checked={video2TrimWay === 'AFTER'} onChange={(e) => setVideo2TrimWay(e.target.value)} />
                                    保留当前时间之后
                                </label>
                            </div>    
                           

                            <StartButton config={config} title="开始拼接视频" minTime={5} maxTime={10} timeUnit={"秒"}
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
                            restoredImage={restoredImage} restoredId={restoredId} />
                        
                    </div>
                    
                </main>
                
            </TopFrame>
        );

};
      
      
      
export async function getServerSideProps(ctx: any) {
    let roomId1 = ctx?.query?.roomId || ctx?.query?.roomId1;
    let video1 = ctx?.query?.videoURL || ctx?.query?.videoURL1;
    let roomId2 = ctx?.query?.roomId2;
    let video2 = ctx?.query?.videoURL2;
   
    if(roomId1){
        const room = await prisma.room.findUnique({ where: {id: roomId1} });
        if(room?.outputImage && room?.resultType == "VIDEO"){
            video1 = room.outputImage;
        }
    }
    if(roomId2){
        const room = await prisma.room.findUnique({ where: {id: roomId2} });
        if(room?.outputImage && room?.resultType == "VIDEO"){
            video2 = room.outputImage;
        }
    }
    
    monitor.logUserRequest(ctx);
    return {
        props: {
            video1,
            video2,
            config
        },
    };
}            
