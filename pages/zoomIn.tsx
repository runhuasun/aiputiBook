import React, { useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { User,Room, Model } from "@prisma/client";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";
import prisma from "../lib/prismadb";




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



export default function zoomIn({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any, }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router?.query?.imageURL || image?.outputImage || simRoomBody?.params?.params?.image) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [backgroundEnhence, setBackgroundEnhence] = useState<boolean>(true);
    const [faceEnhence, setFaceEnhence] = useState<boolean>(true);
    const [detailEnhence, setDetailEnhence] = useState<boolean>(false);
    const [handEnhence, setHandEnhence] = useState<boolean>(false);
    const [keepFace, setKeepFace] = useState<boolean>(false);
    const [repair, setRepair] = useState<boolean>(false);
    
    const [upscale, setUpscale] = useState<number>(2);
    const [fidelity, setFidelity] = useState<number>(0.7);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    
    // 生成发大图
    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张图片");
        }
        if(handEnhence && upscale != 2){
            return alert("如果希望增加手部细节，那么放大倍数必须设置为2");
        }        

        let params:any = {
            repair,
            image: originalPhoto, 
            codeformer_fidelity: fidelity,            
            background_enhance: backgroundEnhence, 
            face_upsample: faceEnhence,
            upscale: upscale,
        };

        if(detailEnhence){
            params = {
                image: originalPhoto, 
                prompt: " UHD 4k ",
                resolution: 2048,
                creativity: 1-fidelity,
                hdr: 1-fidelity,
                resemblance: 1,
                guess_mode: backgroundEnhence,
            }
        }
        if(handEnhence){
            params = {
                image: originalPhoto,
                prompt: "masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>",
                negative_prompt: "(worst quality, low quality, normal quality:2) JuggernautNegative-neg",
                scale_factor: upscale,
                dynamic: 6,
                handfix: (detailEnhence || backgroundEnhence || faceEnhence) ? "image_and_hands" : "hands_only",
                output_format: "jpg"
            }
        }

        params.keepFace = keepFace && ( handEnhence && (detailEnhence || backgroundEnhence || faceEnhence) );
        const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "zoomIn", 
                    preRoomId,
                    params: {            
                        func: "zoomIn", 
                        // modelurl: image?.model,
                        inputText: image?.prompt,
                        params
                    }
                },
                "放大",
                "IMAGE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                    mutate();
                    setRestoredImage(res.result.generated);
                    setRestoredId(res.result.genRoomId);                                      
                }
            );
        
    }

    const title="智能修复放大";
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
                            <FormLabel number={(num++).toString()} label="画面修复（模糊或有小瑕疵的照片）" 
                                isChecker={true} initValue={repair} 
                                onValueChange={(value) => {
                                    setRepair(!repair) 
                                }} />

                            <div className="w-full space-y-4">
                                <FormLabel number={(num++).toString()} label={`放大倍数：${upscale}`}/>                                                            
                                <input type="range" value={upscale} min="1" max="4" step="1" className="slider-dark-green w-full mt-4"                            
                                    onChange={(e) => setUpscale(parseInt(e.target.value))}
                                    />
                            </div>

                            {!repair && (
                            <div className="mt-4 w-full max-w-lg">
                                <FormLabel number={(num++).toString()} label={`画面真实度：${fidelity} `} hint="越大越真实，越小画面更优化"/>                                                            
                                <input type="range" value={fidelity} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                    onChange={(e) => setFidelity(parseFloat(e.target.value))}
                                    />
                            </div>
                           )}
                            
                            {!repair && (
                            <FormLabel number={(num++).toString()} label="人物面部修复美化" 
                                isChecker={true} initValue={faceEnhence} 
                                onValueChange={(value) => {
                                    setFaceEnhence(!faceEnhence) 
                                }} />                            
                           )}

                            {!repair && (
                            <FormLabel number={(num++).toString()} label="画面背景修复美化" 
                                isChecker={true} initValue={backgroundEnhence} 
                                onValueChange={(value) => {
                                    setBackgroundEnhence(!backgroundEnhence) 
                                }} />                            
                           )}
                            
                            {!repair && (
                            <FormLabel number={(num++).toString()} label="人物手部修复美化" 
                                isChecker={true} initValue={handEnhence} 
                                onValueChange={(value) => {
                                    setHandEnhence(!handEnhence) 
                                }} />                            
                           )}
                
                            {!repair && (
                            <FormLabel number={(num++).toString()} label="智能增加画面细节" 
                                isChecker={true} initValue={detailEnhence} 
                                onValueChange={(value) => {
                                    setDetailEnhence(!detailEnhence);
                                    setUpscale(2);                                    
                                }} />                            
                           )}

                            {!repair && (
                            <FormLabel number={(num++).toString()} label="确保面部不会失真" 
                                isChecker={true} initValue={keepFace} 
                                onValueChange={(value) => {
                                    setKeepFace(!keepFace);
                                }} />                            
                           )}
                        
                            <StartButton config={config} title="开始修复放大"
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






