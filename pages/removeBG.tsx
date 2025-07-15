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
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import {extractMaskImage} from "../components/MaskImageEditor";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
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
                simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),                
                image,
                config
            },
        };
    
    }else{
        monitor.logUserRequest(ctx);        
        return {
            props: {
                config
            },
        };
    }
}  

const modelNames = new Map([
    ["birefnet", "发丝级高精度抠图模型"],
    ["rembg", "通用抠图模型"],
    ["rembg-enhance", "增强版抠图模型"],
    ["remove-bg", "备选抠图模型1"],
    ["background-remover", "备选抠图模型2（精确扣羽毛）"],
]);
const models = Array.from(modelNames.keys());


export default function removeBG({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL|| image?.outputImage || simRoomBody?.params?.imageUrl || simRoomBody?.params?.imageURL)  as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);  
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [maskCanvas, setMaskCanvas] = useState<any>();

    const [method, setMethod] = useState<string>((router.query.method || "AUTO") as string);
    const [model, setModel] = useState<string>("birefnet");
    
    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一张照片！");
        }

        if(!window){
            return;
        }

        let maskImage;
        if(method === "MASK"){
            if(maskCanvas){
                maskImage = extractMaskImage(maskCanvas);
            }        
            if(!maskImage){
                return alert("请先在原始图片上选择一个抠图区域");
            }
            const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
            switch(bwt){
                case "B":
                    return alert("您还没有在原始图片上选择一个修改区域");
                case "W":
                    return alert("您不能把所有的区域都涂抹成修改区域！");
            }            
        }        
        const res = await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "removeBG",
                preRoomId,
                model,
                params: {
                    method,
                    imageUrl: originalPhoto, 
                    maskImage,
                    inputText:"删除背景效果", 
                    func: model,
                }
            },
            "删除背景",
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);                                      
            }
        );
    }

    const title = "删除照片背景";
    let num = 1;
    
        return (
            
            <TopFrame config={config}>

                <main>
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />
                    
                    <div className="page-container">
                        
                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                            supportMask={method=="MASK"} needMask={method=="MASK"} params={router?.query?.initMaskArea ? {initMaskAreas:[router?.query?.initMaskArea as string]} : {} }
                            onMaskUpdate={(maskCanvas: HTMLCanvasElement)=>{
                                setMaskCanvas(maskCanvas);
                            }}                            
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
                            <Toggle className="flex flex-col items-center mt-5"
                                sideBySide={method=="AUTO"} leftText="精确选择" rightText="自动识别"
                                setSideBySide={(newVal) => {
                                    setMethod(newVal ? "AUTO" : "MASK"); 
                            }} />

                            {method == "AUTO" ? (
                            <div className="w-full flex flex-col space-y-4">
                                <FormLabel number={`${num++}`} label="选择抠图AI模型" hint="默认模型适合大多数情况。每种模型对不同场景的识别能力不同，如果一种模型抠图效果不佳，可以换一种试试。"/>
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
                            ):(
                                <FormLabel number={`${num++}`} label="请先在左侧图片上选择前景保留区域"/>
                            )}
                                
                            <StartButton config={config} title="删除照片背景" showPrice={true} loading={loading}
                                onStart={async () => {
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
