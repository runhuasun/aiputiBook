import React, { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";
import { useSession, signIn } from "next-auth/react";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";
import InputImage from "../components/InputImage";

import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";



export async function getServerSideProps(ctx: any) {
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    if(simRoomBody?.lora){
        simRoomBody.params.loraModel = await prisma.model.findUnique({
            where: { code: simRoomBody.lora }
        });
    }
    
    let imgId = ctx?.query?.roomId;
    let image = null;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }        
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody,          
            image,
            config,
        },
    };
}  



const changeModeNames = new Map([
    ["ideogram-v3-balanced", "IDEOGRAM V3"],
//    ["LORA","模仿套系风格"],
//    ["FREE","模仿照片风格"],
//    ["FREE2","模仿照片风格2"]
]);
const changeModes = Array.from(changeModeNames.keys());

export default function changeStyle({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    const title = "更换照片风格";
    let num = 1;
    const router = useRouter();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output || null);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [restoredSeed, setRestoredSeed] = useState<string | null>(simRoomBody?.seed);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession(); 
   
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [changeMode, setChangeMode] = useState<string>("ideogram-v3-balanced");

    const [styleImage, setStyleImage] = useState<string>((router.query.imageURL || simRoomBody?.params?.styleImage || image?.outputImage) as string);
    const [drawRatio, setDrawRatio] = useState<string>(router.query.drawRatio as string || simRoomBody?.params?.drawRatio || "916");
    const [prompt, setPrompt] = useState<string>((router.query.prompt || simRoomBody?.params?.prompt || "") as string);
   
    
    async function generatePhoto() {
        if(!prompt){
            return alert("请先描绘一下照片");
        }
        if(!styleImage){
            return alert("请先选择一个希望模仿的风格照片");
        }

        let res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd:"simStyle", 
                preRoomId,
                params:{
                    func: changeMode,                
                    styleImage,
                    drawRatio,
                    prompt,
                }
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

    
    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={styleImage} prompt={prompt}/>
                
                <div className="page-container">

                    <div className="page-tab-image-create">

                        <FormLabel number={`${num++}`} label="选择风格模板照片" onCancel={() => setStyleImage("")}/>
                        <InputImage src={styleImage}/> 
                        <ComboSelector onSelect = { (newFile) => ( setStyleImage(newFile) )} showDemo={false} showIcon={true} />                            

                        <div className="space-y-3 w-full">
                            <FormLabel number={`${num++}`} label="照片输出比例"/>
                            <DrawRatioSelector defaultRatio = {drawRatio} onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                        </div>
                        
                        <div className="space-y-4 w-full flex flex-col">
                            <FormLabel number={`${num++}`} label="描绘画面" />                                
                            <div className="relative inline-block w-full">
                                <PromptArea
                                    hotWords="NO_HOTWORDS"
                                    hasAdvanceButton={false}
                                    userPrompt={prompt}
                                    readOnly={false}
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />  
                            </div>                                      
                        </div>
                            
                        <StartButton config={config} title="开始生成" showPrice={true} loading={loading}
                            onStart={async () => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                                generatePhoto();  
                            }}
                            />                         
                        </div> 

                        <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} restoredSeed={restoredSeed} />
                    
                    </div>
                </main>
           
            </TopFrame>
        );
  
};
