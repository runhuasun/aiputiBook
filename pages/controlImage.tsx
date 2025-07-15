import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import type { NextPage } from "next";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";
import { callAPI2 } from "../utils/apiUtils";

import TopFrame from "../components/TopFrame";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import StartButton from "../components/StartButton";
import InputImage from "../components/InputImage";
import ResultView from "../components/ResultView";
import ToolBar from "../components/ToolBar";

const modelNames = new Map([
    ["flux-canny-pro", "模仿原图的线条"],
    ["flux-depth-pro", "模仿原图的构图"],    
]);
const models = Array.from(modelNames.keys());
    
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    let roomId = ctx?.query?.roomId;
    let image = null;
    
    if(roomId){
        image = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });
    }
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                
            image,
            config,
        },
    }
}

export default function controlImage({ simRoomBody, image, config }: { simRoomBody:any, image:any, config:any }) {
    const router = useRouter();

    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || image?.outputImage || simRoomBody?.params?.imageURL || "") as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredSeed, setRestoredSeed] = useState<string | null>(simRoomBody?.seed);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>((router.query.prompt || simRoomBody?.prompt || "") as string);
    const [promptStrength, setPromptStrength] = useState<number>(simRoomBody?.params?.guidance || 25);
    const [model, setModel] = useState<string>(simRoomBody?.params?.model || "flux-canny-pro");
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const title = "模仿线条";
    
    async function generatePhoto(fileUrl: string | null) {
        if(!prompt){
            return alert("请描绘画面内容！");
        }
        if(!fileUrl){
            alert("请先上传一张图片");
            return;
        }

        setLoading(true);
        const res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd: "controlImage",
                preRoomId,
                params: {
                    model,
                    imageURL: fileUrl,
                    prompt, 
                    guidance: promptStrength 
                },
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);           
                setRestoredSeed(res.result.seed);
            }
        );
    }
    
    let num = 1;

    return (
        <TopFrame config={config}>
            <main>                    
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto}  prompt={prompt}/>
                <div className="page-container">
                    <div className="page-tab-image-create">
                       
                        <FormLabel number={`${num++}`} label="模仿方式"/>
                        <DropDown
                            theme={model}
                            // @ts-ignore
                            setTheme={(newRoom) => setModel(newRoom)}
                            themes={models}
                            names={modelNames}
                            />

                        <div className="flex flex-row items-center space-x-3">
                            <FormLabel number={`${num++}`} label="模板图片"/>
                            <Link className="button-green-blue text-xs mt-3 px-2 py-1" href="/editImage">手绘草图</Link>
                        </div>
                        <InputImage src={originalPhoto}/>
                        <ComboSelector onSelect = {(newFile) => setOriginalPhoto(newFile)} showDemo={false} showIcon={true} />    
                        
                        <FormLabel number={`${num++}`} label={`原作忠实度：${promptStrength}`} hint="数值越大，生成结果越忠实于原作，但是会更缺乏创造力，并牺牲画面质量"/>
                        <input type="range" value={promptStrength} min="1" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                            onChange={(e) => setPromptStrength(parseInt(e.target.value))}
                            />                                 
            
                        <FormLabel number={`${num++}`} label="描绘画面内容"/>
                        <PromptArea
                            userPrompt={prompt}                                    
                            onUserPromptChange={(up) => setPrompt(up) }
                            hotWords="NO_HOTWORDS"
                            hasAdvanceButton={false}
                            />
                        
                        <StartButton config={config} title="开始生成" showPrice={true} loading={loading}
                            onStart={async () => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                                generatePhoto(originalPhoto);  
                            }}
                            />
                    </div>

                    <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} restoredSeed={restoredSeed} />
                </div>
            </main>
        </TopFrame>
    );
};
