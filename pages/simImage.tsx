import React, { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import Toggle from "../components/Toggle";
import { CompareSlider } from "../components/CompareSlider";
import LoadingRing from "../components/LoadingRing";
import MessageZone from "../components/MessageZone";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import StartButton from "../components/StartButton";
import InputImage from "../components/InputImage";
import PromptArea from "../components/PromptArea";
import AutoSizeImage from "../components/AutoSizeImage";
import ResultButtons from "../components/ResultButtons";

import { callAPI2 } from "../utils/apiUtils";
import * as ru from "../utils/restUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



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




export default function simImage({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(image?.outputImage || simRoomBody?.params?.imageURL || null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>(simRoomBody?.params?.prompt || "");
    const [promptStrength, setPromptStrength] = useState<number>(Math.round((simRoomBody?.params?.promptStrength || 0.4) * 100));
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const title = "照片美化";
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    async function generatePhoto(fileUrl: string | null) {
        if(!fileUrl){
            alert("请先上传一张图片");
            return;
        }
      
        const res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd: "simImage",
                preRoomId,
                params: {
                    imageURL: fileUrl,
                    prompt, 
                    promptStrength: (promptStrength/100)                   
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
                <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">

                    <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-4 w-full max-w-lg">

                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label="上传照片"/>
                            <InputImage alt="图片素材" src={originalPhoto}/>
                            <ComboSelector 
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setOriginalPhoto(newFile)} />   
                        </div>

                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label={`画面重构力度：${promptStrength}`}/>
                            <input type="range" value={promptStrength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                                onChange={(e) => setPromptStrength(parseInt(e.target.value))}
                                />                                 
                        </div>                            
            
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={`${num++}`} label="描绘画面内容（可选）"/>
                            <PromptArea
                                userPrompt={prompt}                                    
                                onUserPromptChange={(up) => setPrompt(up) }
                                hotWords="PORTRAIT_ALL"
                                hasAdvanceButton={false}
                                />
                        </div>

                       <div className= "flex flex-col space-y-2 items-center">
                            {data && (
                            <PriceTag config={config}  />
                            )} 

                            {loading ? (
                            <LoadingButton/>
                            ):(
                            <StartButton config={config} title="开始美化" loading={loading}
                                onStart={async () => {
                                    await generatePhoto(originalPhoto);
                                }}
                                />
                            ) }
                        </div>   
                        
                    </div>

                    <div className="flex flex-col w-full sm:flex-1 rounded-lg min-h-lvh mr-2 items-center justify-center border border-1 border-gray-300 border-dashed">
                    
                        {error && (
                        <MessageZone message={error} messageType="ERROR"/>
                        )}                  

                        {loading && !error && !restoredImage && (
                        <LoadingRing/>
                        )}

                        <div
                            className={`${
                                restoredLoaded ? "visible mt-6 -ml-8" : "invisible"
                            }`}
                            >
                            <Toggle
                                className={`${restoredLoaded ? "visible mb-6" : "invisible"}`}
                                sideBySide={sideBySide}
                                setSideBySide={(newVal) => setSideBySide(newVal)}
                                />
                        </div>
                        {restoredLoaded && sideBySide && (
                        <CompareSlider
                            original={originalPhoto!}
                            restored={restoredImage!}
                            />
                        )}                            
                        
                        {restoredImage && restoredId && !sideBySide && (
                        <div className="w-full flex flex-col items-center space-y-10 pt-10">
                            <AutoSizeImage
                                alt="照片"
                                src={restoredImage}
                                onLoadingComplete={() => setRestoredLoaded(true)}
                                onClick={() => window.open(ru.getImageRest(restoredId), "_blank")}
                                />
                            <ResultButtons mediaURL={restoredImage} mediaId={restoredId}/>
                        </div>
                        )}
                        
                    </div>    

                </div>
                
           </main>
    
        </TopFrame>
    );
    
};

//export default Home;

