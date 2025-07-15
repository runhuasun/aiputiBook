import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import Toggle from "../components/Toggle";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";

import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



const changeModedNames = new Map([
    ["RGB", "调节RGB通道"],
    ["Simulate", "模仿样片色彩色调"]
]);
const changeModes = Array.from(changeModedNames.keys());

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx?.query?.roomId;
    let image;
    let user;
    
    if (session && session.user  && session.user.email) {
        if(roomId){
            image = await prisma.room.findUnique({
                where: {
                    id: roomId,
                },
            });
        }
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });
    }
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            image,
            config
        },
    };
}  



export default function simulateColorTone({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [originalPhoto, setOriginalPhoto] = useState<string | null>(router.query.imageURL as string || image?.outputImage || simRoomBody?.params?.imageURL);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [templateURL, setTemplateURL] = useState<string | null>(simRoomBody?.params?.templateURL);
    const [strength, setStrength] = useState<number>(simRoomBody?.params?.strength || 0.9);

    const [channels, setChannels] = useState<{R:number; G:number; B:number}>({R:0, G:0, B:0});
    const [changeMode, setChangeMode] = useState<string>(simRoomBody?.params?.changeMode || "Simulate");
    const [imageCanvas, setImageCanvas] = useState<any>();
    
    const title = (router.query.title as string) || "调整色调色彩";

    useEffect(() => {
        if(changeMode === "Simulate"){
            setChannels({R:0, G:0, B:0});                    
        }
    }, [changeMode]);     
    
    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张照片");
        }
        setLoading(true);
        try{
            let adjustImageURL:string="";
            if(changeMode === "RGB"){
                if(!imageCanvas){
                    return alert("请先调整一下红绿蓝色彩通道的数值，再执行操作！");
                }else{
                    adjustImageURL = await fu.uploadBase64FileServer(imageCanvas.toDataURL('image/png'));
                }
            }            
            if(changeMode === "Simulate"){
                if(!templateURL){
                    return alert("请先选择一个模板照片！");
                }
            }
            
            setSideBySide(false);                        
            
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "simulateColorTone",
                    preRoomId,
                    params:{
                        changeMode,
                        imageURL: originalPhoto,
                        templateURL,
                        adjustImageURL,
                        strength
                    }
                },
                title,
                "IMAGE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                    mutate();          
                    setRestoredImage(res.result.generated);
                    setRestoredId(res.result.genRoomId);  
                    setChannels({R:0, G:0, B:0});                    
                }
            );
        }finally{
            setLoading(false);
        }
    }

    let num = 1;
    
        return (
            <TopFrame config={config}>

                <main>
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />
                  
                    <div className="page-container">
                        
                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                            RGB={true} params={channels}
                            onSelectRoom={(newRoom:any)=>{
                                setPreRoomId(newRoom?.id);
                            }}
                            onSelectImage={(newFile:string)=>{
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                            onContinue={(newFile:string)=>{
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setRestoredId(null);
                                setError(null); 
                                setChannels({R:0, G:0, B:0});
                            }}
                            onCanvasUpdate={(canvas:HTMLCanvasElement)=>{
                                setImageCanvas(canvas);
                            }}
                        />  

                        <div className="page-tab-edit">
                          <Toggle className="flex flex-col items-center mt-4"
                              sideBySide={changeMode==="Simulate"} leftText="调节RGB通道" rightText="模仿样片色彩色调"
                              setSideBySide={(newVal) => {
                                  setChangeMode(newVal ? "Simulate" : "RGB"); 
                              }} />                            
                          {/*
                          <div className="space-y-4 mt-4 w-full">
                                <FormLabel number={`${num++}`} label="选择调整方式"/>
                                <DropDown
                                    theme={changeMode}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setChangeMode(newRoom);
                                    }}
                                    themes={changeModes}
                                    names={changeModedNames}
                                    />
                            </div>
                            */}
                            {changeMode == "Simulate" && (
                            <div className="space-y-5">
                                <div className="space-y-4 w-full max-w-lg">
                                    <FormLabel number={`${num++}`} label="被模仿样片"/>
                                    <InputImage src={templateURL}/>                                   
                                    <ComboSelector onSelect = {(newFile) => setTemplateURL(newFile)} fileType="IMAGE" selectorType="TEMPLATE"/>    
                                </div>    
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`模仿力度：${Math.round(strength*100)}%`} hint="一般情况推荐10%-20%的模仿力度，模仿力度过大容易导致画面颜色失真。"/>                                 
                                     <input type="range" value={strength} min="0" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setStrength(parseFloat(e.target.value)) }
                                         />
                                 </div>                                
                             </div>
                             )}

                            {changeMode == "RGB" && (
                            <div className="space-y-5">
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`红色通道R：${channels.R}`}/>                                 
                                     <input type="range" value={channels.R} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setChannels({
                                             R: parseInt(e.target.value),
                                             G: channels.G,
                                             B: channels.B,
                                         }) }
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`绿色通道G：${channels.G}`}/>                                 
                                     <input type="range" value={channels.G} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setChannels({
                                             G: parseInt(e.target.value),
                                             R: channels.R,
                                             B: channels.B,
                                         }) }
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`蓝色通道B：${channels.B}`}/>                                 
                                     <input type="range" value={channels.B} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setChannels({
                                             B: parseInt(e.target.value),
                                             R: channels.R,
                                             G: channels.G,
                                         }) }
                                         />
                                 </div>
                             </div>
                             )}
                            
                             <StartButton config={config} title="开始调整色彩色调" showPrice={true} loading={loading}
                                 onStart={() => {
                                     setRestoredImage(null);
                                     setRestoredId(null);
                                     setRestoredLoaded(false);
                                     setError(null);
                                     generatePhoto();
                                 }}
                               />
                 
                        </div>
                    
                    </div>
                </main>
            </TopFrame>
        );

};
