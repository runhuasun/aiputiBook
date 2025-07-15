import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { getServerSession } from "next-auth";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Room, User } from "@prisma/client";

import { GenerateResponseData } from "./api/generate";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import Toggle from "../components/Toggle";
import { RoomGeneration } from "../components/RoomGenerator";
import Genhis from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import LoadingRing from "../components/LoadingRing";
import MessageZone from "../components/MessageZone";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import ResultButtons from "../components/ResultButtons";
import AutoSizeImage from "../components/AutoSizeImage";
import PromptAssistant from "../components/PromptAssistant";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import DropDown from "../components/DropDown";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import Image from "../components/wrapper/Image";

import * as ru from "../utils/restUtils";
import downloadPhoto from "../utils/fileUtils";
import { config } from "../utils/config";
import {callAPI2} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);  
    if (session && session.user  && session.user.email) {
        let roomId = ctx?.query?.roomId;
        let image = null;
        
        if(roomId){
            image = await prisma.room.findUnique({
                where: {
                    id: roomId,
                },
            });
        }
        
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });

        monitor.logUserRequest(ctx, session, user);
        return {
            props: {
                simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                
                image,
                config,
            },
        }
        
    }else{
        monitor.logUserRequest(ctx);        
        return {
            props: {
                config
            },
        };
    }
}

const funcNames = new Map([
    ["flux-kontext-pro", "Flux Pro照片修复引擎"],    
    ["flux-kontext-max", "Flux Max照片修复引擎"],
    ["ddcolor", "ddcolor照片上色引擎"],
    ["bigcolor", "bigcolor照片上色引擎"],
    ["deoldify_image", "deoldify照片上色引擎"],
    ["byte-recolor", "字节照片上色引擎"],
    ["baidu-colourize", "百度照片上色引擎"]
]);
const funcs = Array.from(funcNames.keys());

const modelNames = new Map([
    ["Artistic", "尽量让颜色更加丰富"],
    ["Stable", "尽量让照片被完整上色"]
]);
const models = Array.from(modelNames.keys());


export default function recolorImage({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {
    const router = useRouter();
    const title = "黑白老照片上色";
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || image?.outputImage || simRoomBody?.params?.params?.input_image) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [func, setFunc] = useState<string>(simRoomBody?.params?.func || "flux-kontext-pro");
    const [model, setModel] = useState<string>(simRoomBody?.params?.params?.model_name || "Artistic");
    const [prompt, setPrompt] = useState<string>(simRoomBody?.params?.params?.prompt || "把照片改成彩色的，保持人物和画面不变");
    
    async function generatePhoto(fileUrl: string | null) {
        if(!fileUrl){
            alert("请先上传一张图片");
            return;
        }
      
        const res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd: "recolorImage",
                preRoomId,                
                params: {
                    func,
                    params: {
                        input_image: fileUrl,
                        model_name: model, 
                        prompt,
                    }
                },
            },
            title,
            "IMAGE",
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
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label="着色引擎模型" hint="黑白照片上色是一个很复杂的问题。每一种着色引擎只适合一定范围的照片，如果一种着色引擎效果不佳，建议换一种引擎尝试。"/>
                                <DropDown
                                    theme={func}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setFunc(newRoom);
                                    }}
                                    themes={funcs}
                                    names={funcNames}
                                    />                               
                            </div>                             

                            {func=="deoldify_image" && (
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label="着色方式"/>
                                <DropDown
                                    theme={model}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setModel(newRoom);
                                    }}
                                    themes={models}
                                    names={modelNames}
                                    />                               
                            </div>           
                            )}

                            {func.startsWith("flux-kontext") && (
                            <div className="space-y-4 w-full max-w-lg justify-center">
                                <FormLabel number={`${num++}`} label="修图要求"/>                                
                                <div className="relative inline-block w-full">
                                    <PromptArea
                                        hotWords="RECOLOR"
                                        hasAdvanceButton={false}
                                        userPrompt={prompt}
                                        readOnly={false}
                                        onUserPromptChange={(up) => setPrompt(up) }
                                        />  
                                </div>   
                            </div>
                            )}                                             
                            
                            <StartButton config={config} title="开始上色"  model={func} loading={loading} showPrice={true}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredId(null);                                    
                                    setRestoredLoaded(false);
                                    setError(null);  
                                    setSideBySide(false);                                        
                                    generatePhoto(originalPhoto);
                                }}
                                />                            
                        </div>

                    </div>
                    
               </main>
        
            </TopFrame>
        );
    
};

//export default Home;
