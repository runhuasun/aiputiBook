import { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import Footer from "../components/Footer";
import ImageView from "../components/ImageView";
import ToolBar from "../components/ToolBar";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import { extractMaskImage, extractAlphaMaskImage } from "../components/MaskImageEditor";


import { getImageSize } from "../utils/fileUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import { config, system } from "../utils/config"; 
import { languageNames, languages } from "../utils/dropdownTypes";



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    let imgId = ctx?.query?.roomId;
    let image = null;

    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }        

    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            image,
            config,
        }
    }
}  

const modelNames = new Map([
//    ["gpt-image-1-edit-low","基础翻译引擎"],
    ["gpt-image-1-edit-medium","通用翻译引擎（适合文字较少，内容简单）"],
    ["gpt-image-1-edit-high","高级翻译引擎（适合文字较多，内容复杂）"]      
]);
const models = Array.from(modelNames.keys());


export default function changeBG({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    let title = "图片文字翻译";
    let num = 1;
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession(); 
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string|null>((router.query?.imageURL || image?.outputImage || simRoomBody?.params?.imageURL) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [model, setModel] = useState<string>(simRoomBody?.params?.model || "gpt-image-1-edit-medium");
    const [fromLang, setFromLang] = useState<string>(simRoomBody?.params?.fromLang || "zh");
    const [toLang, setToLang] = useState<string>(simRoomBody?.params?.fromLang || "en");
    const [maskCanvas, setMaskCanvas] = useState<any>();

    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一张原始照片");
        }

        try{
            setLoading(true);

            const imgSize = await getImageSize(originalPhoto);
            if(imgSize.height>5000 || imgSize.width>5000){
                return alert(`你的照片尺寸是宽${imgSize.width}，高${imgSize.height}，超过了最大尺寸5000 X 5000`);
            }
    
            let maskImage;
            if(maskCanvas){
                // maskImage = model.includes("gpt") ? (await extractAlphaMaskImage(maskCanvas, originalPhoto)) : extractMaskImage(maskCanvas);
                maskImage = model.includes("gpt") ? extractMaskImage(maskCanvas, "ALPHA") : extractMaskImage(maskCanvas);
            }      
            if(maskImage){
                const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
                if(bwt != "N"){
                    maskImage = null;
                }
            }
            if(maskImage){
                maskImage = await fu.uploadBase64FileServer(maskImage, "image/png");
            }        
    
            const res = await callAPI2(
                "/api/workflowAgent2",
                {
                    cmd:"changeLanguage", 
                    preRoomId,
                    params:{
                        func: model,
                        imageURL: originalPhoto,
                        maskImage,                        
                        fromLang,
                        toLang,
                    } 
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
            
        }finally{
            setLoading(false);
        }
    }


    return (
        <TopFrame config={config}>
            <main className="flex flex-1 flex-col">
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />

                <div className="page-container">

                    <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        supportMask={false} needMask={false} 
                        selectorType="TEMPLATE" albumId={system.album.demoPoster.id} albumName="样例"
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

                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="选择画面语言翻译引擎"/>
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

                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="原有语言"/>
                            <DropDown
                                theme={fromLang}
                                // @ts-ignore
                                setTheme={(newRoom) => {
                                    setFromLang(newRoom);
                                }}
                                themes={languages}                                    
                                names={languageNames}
                                />
                        </div>

                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="目标语言"/>
                            <DropDown
                                theme={toLang}
                                // @ts-ignore
                                setTheme={(newRoom) => {
                                    setToLang(newRoom);
                                }}
                                themes={languages}                                    
                                names={languageNames}
                                />
                        </div>

                        <StartButton config={config} title="开始翻译"  model={model} loading={loading} showPrice={true}
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
