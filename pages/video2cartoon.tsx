import { useState } from "react";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User, Room, Model } from "@prisma/client";

import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import FlexVideo from "../components/FlexVideo";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";


export async function getServerSideProps(ctx: any) {
    let image = null;
   
    let roomId = ctx?.query?.roomId;
    if(roomId){
        image = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });
    }

    monitor.logUserRequest(ctx);    
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            image,
            config
        },
    };
}  


const themeNames = new Map();
themeNames.set("0","日式漫画");
themeNames.set("1","美式漫画");
themeNames.set("2","清新漫画");
themeNames.set("3","3D卡通");
themeNames.set("4","国风卡通");
themeNames.set("5","纸艺风格");
themeNames.set("6","简易插画");
themeNames.set("7","国风水墨");

const videoThemes: string[] = Array.from(themeNames.keys());

export default function video2Cartoon({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {
    const title="视频风格转换";
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((image?.outputImage || router.query.imageURL || router.query.videoURL || simRoomBody?.params?.videoUrl || "") as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    const [theme, setTheme] = useState<string>(simRoomBody?.params?.cartoonStyle || "0");

    const [themes, setThemes] = useState<string[]>(videoThemes);
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一个视频");
        }
        if(duration > 30){
            return alert("上传的视频最长不超过30秒!");
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd:"video2cartoon", 
                preRoomId,
                priceUnits,
                params: {
                    videoUrl: originalPhoto,
                    cartoonStyle: theme
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
                    <ToolBar config={config} roomId={preRoomId} videoURL={originalPhoto}/>
                    
                    <div className="page-container">
                    
                        <div className="page-tab-video-edit">

                            <FormLabel number="1" label="上传您的视频(.mp4)"/>
                            <FlexVideo src={originalPhoto}  poster={originalPhoto}  controls={true} autoPlay={false} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != originalPhoto){
                                            setOriginalPhoto(url);
                                        }
                                        const pus = Math.round(duration);                                            
                                        setPriceUnits(pus);      
                                        setDuration(pus);
                                    }}    
                                />                
                            <ComboSelector fileType="VIDEO"
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setOriginalPhoto(newFile)}                                    
                                /> 
                        
                            <FormLabel number="2" label="转换的风格"/>
                            <DropDown theme={theme} themes={themes} names={themeNames}
                                // @ts-ignore
                                setTheme={(newTheme) => setTheme(newTheme)}
                                />
              

                            <StartButton config={config} title="开始合成视频" units={priceUnits} unitName={"秒内容"} 
                                minTime={2} maxTime={3} timeUnit={"分钟"}                                    
                                showPrice={true} loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                      
                                    generatePhoto();
                                }}
                                />
                        </div>

                        <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"video2cartoon"}} />
                        
                    </div>  
                
                </main>
            </TopFrame>
        );
    
  
};
