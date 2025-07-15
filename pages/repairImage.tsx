import React, { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";




export async function getServerSideProps(ctx: any) {
    let roomId = ctx?.query?.roomId;
    let image = null;
    
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
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),            
            image,
            config,
        },
    };
}  



export default function repairImage({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any, }) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router?.query?.imageURL || image?.outputImage || simRoomBody?.params?.image) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [upscale, setUpscale] = useState<number>(simRoomBody?.params?.upscale || 2);
   
    // 生成发大图
    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张图片");
        }
        const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "repairImage", 
                    preRoomId,
                    params: {            
                        func: "gfpgan", 
                        image: originalPhoto,                        
                        upscale,
                    }
                },
                "修复",
                "IMAGE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                    mutate();
                    setRestoredImage(res.result.generated);
                    setRestoredId(res.result.genRoomId);                                      
                }
            );
        
    }

    const title="智能修复";
    let num = 1;
    
        return (
            <TopFrame config={config}>

                <main>
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />
                    
                    <div className="page-container">

                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
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
                                setError(null); 
                            }}
                        />  


                        <div className="page-tab-edit">   
                            <div className="w-full space-y-4">
                                <FormLabel number={(num++).toString()} label={`画面修复后放大倍数：${upscale}`}/>                                                            
                                <input type="range" value={upscale} min="1" max="4" step="1" className="slider-dark-green w-full mt-4"                            
                                    onChange={(e) => setUpscale(parseInt(e.target.value))}
                                    />
                            </div>
                        
                            <StartButton config={config} title="开始修复" loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
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





