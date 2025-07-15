import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";
import TextareaAutosize from "react-textarea-autosize";

import { GenerateResponseData } from "./api/generate";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import {ZipData} from "./api/processImage";

import TopFrame from "../components/TopFrame";
import { CompareSlider } from "../components/CompareSlider";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import { showModel} from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import LoadingDots from "../components/LoadingDots";
import PromptArea from "../components/PromptArea";
import Uploader, {mimeTypes} from "../components/Uploader";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import PromptSelector from "../components/PromptSelector";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import InputImage from "../components/InputImage";
import Image from "../components/wrapper/Image";
import ToolBar from "../components/ToolBar";
import ResultView from "../components/ResultView";


import * as ru from "../utils/restUtils";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import {callAPI2} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";



const checkpoints: string[] = [
    "general",
    "general - albedobaseXL_v21",
    "general - dreamshaperXL_alpha2Xl10",
    "realistic - rundiffusionXL_beta",
    "realistic - RealVisXL_V4.0",
    "realistic - sdxlUnstableDiffusers_nihilmania",
    "cinematic - CinematicRedmond",
    "animated - starlightXLAnimated_v3",
    "animated - pixlAnimeCartoonComic_v10",    
];

const checkpointNames = new Map();
checkpointNames.set("general", "通用模型");
checkpointNames.set("general - albedobaseXL_v21","通用模型-AlbedobaseXL_v21");
checkpointNames.set("general - dreamshaperXL_alpha2Xl10","通用模型-DreadShaper");
checkpointNames.set("realistic - rundiffusionXL_beta","仿真模型-rundiffusionXL");
checkpointNames.set("realistic - RealVisXL_V4.0","仿真模型-RealVisXL_V4");
checkpointNames.set("realistic - sdxlUnstableDiffusers_nihilmania","仿真模型-nihilmania");
checkpointNames.set("cinematic - CinematicRedmond","电影画面模型");
checkpointNames.set("animated - starlightXLAnimated_v3","动漫模型-StarlightXLAnimated_v3");
checkpointNames.set("animated - pixlAnimeCartoonComic_v10","动漫模型-PixlAnimeCartoonComic_v10");

const drawRatios: string[] = [
    "916",
    "169",
    "11"
];

const drawRatioNames = new Map([
    ["916", "9:16 适合手机/PAD"],
    ["169", "16:9 适合电脑"],
    ["11", "1:1 适合画框"]
]);

export default function face2Photo({ image,  config }: { image: Room, config:any }) {
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);
    const [faceUrl, setFaceUrl] = useState(image ? image.outputImage : "");
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [sysPrompts, setSysPrompts] = useState<string>("");  
    const [checkpoint, setCheckpoint] = useState<string>("general");
    const [drawRatio, setDrawRatio] = useState<string>("916");
    const router = useRouter();  
    let defaultPrompt = router.query.prompt as string;    
    let title = router.query.title as string || "超能肖像相机";   
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [prompt, setPrompt] = useState(defaultPrompt ? defaultPrompt : "");

    let tizi = 10; // router.query.price ? router.query.price : 2;
    
    async function generate() {
        
        if(!faceUrl){
            alert("请上传一张包含你清晰面孔的照片");
            return;                                                           
        }      

        let func = "face2Photo";
        let params = checkpoint == "general" ? 
            {
                main_face_image: faceUrl,
                prompt: "A photo of a person, " + prompt + sysPrompts,
                num_steps: 6,
                num_outpus: 1,
                generation_mode: "fidelity",
                num_samples: 1,
                output_format: "jpg",
                image_height: drawRatio=="169" ? 576 : 1024,
                image_width: drawRatio=="916" ? 576 : 1024
            }
            :
            {
                face_image: faceUrl,
                prompt: "A photo of a person, " + prompt + sysPrompts,
                width: drawRatio=="916" ? 576 : 1024,
                height: drawRatio=="169" ? 576 : 1024,
                checkpoint_model: checkpoint,
                output_format: "jpg",
                output_qualidy: 95,
            };

        const res = await callAPI2(
            "/api/generate", 
            { 
                func: func, 
                price: tizi, 
                params: params
            },
            "拍摄",
            "IMAGE",
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
                <ToolBar config={config} roomId={preRoomId} imageURL={faceUrl} restoredImage={restoredImage} restoredId={restoredId} />

                <div className="page-container">

                    <div className="page-tab-image-create">

                        <FormLabel number="1" label="人物脸部正面细节照片"/>
                        <InputImage  src={faceUrl}  />
                        <ComboSelector onSelect = {(newFile) => setFaceUrl(newFile)} />

                        <FormLabel number="2" label="选择AI相机"/>
                        <DropDown
                          theme={checkpoint}
                          // @ts-ignore
                          setTheme={(newTheme) => setCheckpoint(newTheme)}
                          themes={checkpoints}
                          names={checkpointNames}
                        />

                        <FormLabel number="3" label="画面的比例"/>
                        <DropDown
                          theme={drawRatio}
                          // @ts-ignore
                          setTheme={(newTheme) => setDrawRatio(newTheme)}
                          themes={drawRatios}
                          names={drawRatioNames}
                        />

                        <FormLabel number="7" label="输入你的提示词"/>
                        <PromptSelector onSelect = {(newFile) => setPrompt(newFile.formular)} />                                    

                        <PromptArea
                            userPrompt={prompt}
                            onSysPromptChange={(sp) => setSysPrompts(sp) }
                            onUserPromptChange={(up) => setPrompt(up) }
                            />                                
                
                        <StartButton config={config} title="开始生成" showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}/>
                    </div>

                     <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"face2Photo"}} />

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
    let image = null;
    
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }

    monitor.logUserRequest(ctx, session);    
    return {
        props: {
            image,
            config
        },
    };
  
}            
