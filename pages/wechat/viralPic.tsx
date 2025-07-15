import { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import Link from "next/link";
import prisma from "../../lib/prismadb";
import { getServerSession } from "next-auth";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { Room , User} from "@prisma/client";

import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import Toggle from "../../components/Toggle";
import downloadPhoto from "../../utils/fileUtils";
import DropDown from "../../components/DropDown";
import { config, system } from "../../utils/config";
import LoginPage from "../../components/LoginPage";
import Uploader, {mimeTypes} from "../../components/Uploader";
import SysPrompts from "../../components/SysPrompts";
import {callAPI} from "../../utils/apiUtils";
import {DrawRatioType} from "../../components/DrawRatioSelector";
import DrawRatioSelector from "../../components/DrawRatioSelector";
import ComboSelector from "../../components/ComboSelector";
import PoseSelector from "../../components/PoseSelector";
import PromptArea from "../../components/PromptArea";
import PriceTag from "../../components/PriceTag";
import LoadingButton from "../../components/LoadingButton";
import MessageZone from "../../components/MessageZone";
import AutoSizeImage from "../../components/AutoSizeImage";
import FormLabel from "../../components/FormLabel";
import StartButton from "../../components/StartButton";
import ResultButtons from "../../components/ResultButtons";
import LoadingRing from "../../components/LoadingRing";
import ToolBar from "../../components/ToolBar";
import ImageView from "../../components/ImageView";
import InputImage from "../../components/InputImage";
import Image from "../../components/wrapper/Image";

import {getImageSize} from "../../utils/fileUtils";
import * as ru from "../../utils/restUtils";
import {callAPI2} from "../../utils/apiUtils";
import * as rmu from "../../utils/roomUtils";
import * as monitor from "../../utils/monitor";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    let image = null;
    
    if (session && session.user  && session.user.email) {
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });

        if(imgId){
            image = await prisma.room.findUnique({
                where: {
                    id: imgId,
                },
            });
        }        

        if(user){
            return {
                props: {
                    simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
                    image,
                    config,
                },
            };
        }
    }
    
    return {
        props: {
            config,
        },
    };
}  

const changeModeNames = new Map();
changeModeNames.set("ideogram-v3-bg-turbo", "提示词描绘背景（Turbo模型）");    
changeModeNames.set("flux-kontext-pro","提示词描绘背景（Flux模型）");    
changeModeNames.set("iclight-v2","提示词描绘背景（IC模型）");    
changeModeNames.set("gpt-image-1-edit-medium","更换到指定照片中的场景");    
changeModeNames.set("auto","更换背景照片并重新渲染光线");
changeModeNames.set("hard","背景照片硬替换（需要和前景尺寸配合）");
const changeModes: string[] = Array.from(changeModeNames.keys());

const lightSourceNames = new Map([
    ["Use Background Image", "采用背景照片的光线"],
    ["Use Flipped Background Image", "采用背景照片的反转光线"],
    ["Left Light", "左侧光线照射"],
    ["Right Light", "右侧光线照射"],
    ["Top Light", "上方光线照射"],
    ["Bottom Light", "下方光线照射"],
    ["Ambient", "周围光线照射"]
]);
const lightSources = Array.from(lightSourceNames.keys());


export default function viralPic({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    let title = "网红打卡照神器";
    let num = 1;
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession(); 
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string|null>((router.query?.imageURL || image?.outputImage || simRoomBody?.params?.imageURL) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(simRoomBody?.params?.bgImage);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);

    const [sysPrompts, setSysPrompts] = useState<string>("");  
    const [changeMode, setChangeMode] = useState<string>(simRoomBody?.params?.changeMode || "ideogram-v3-bg-turbo");
    const [drawRatio, setDrawRatio] = useState<string>("916");
    const [blur, setBlur] = useState(0);
    const [lightSource, setLightSource] = useState<string>("Use Background Image");
    
    let defaultPrompt = router.query.prompt as string;    
    const [prompt, setPrompt] = useState(defaultPrompt || simRoomBody?.params?.params?.prompt || "");

    async function generatePhoto() {
        setLoading(true);
        
        if(!originalPhoto){
            setLoading(false);
            return alert("请先上传一张原始照片");
        }

        const imgSize = await getImageSize(originalPhoto);
        if(imgSize.height>5000 || imgSize.width>5000){
            setLoading(false);
            return alert(`你的照片尺寸是宽${imgSize.width}，高${imgSize.height}，超过了最大尺寸5000 X 5000`);
        }
      
        let params:any = {};
        switch(changeMode){
            case "gpt-image-1-edit-medium":
            case "auto":
                if(!backgroundImage){
                    setLoading(false);                    
                    return alert("请选择或者上传一张背景照片！");
                }                
                params = {
                    subject_image: originalPhoto, 
                    background_image: backgroundImage,
                    light_source: lightSource,
                    output_format: "jpg",
                    output_quality: 100,
                    prompt: ` detailed face, natural light `, 
                    appended_prompt: " best quality "
                };
                break;
            
            case "hard":
                if(!backgroundImage){
                    setLoading(false);                    
                    return alert("请选择或者上传一张背景照片！");
                }                
                break;
            
            default:
                if(!prompt){
                    setLoading(false);                    
                    return alert("请描述一下您期望的背景！");
                }
                params = {
                    max_width: imgSize.width,
                    max_height: imgSize.height,
                    image: originalPhoto, 
                    prompt: prompt, 
                };  
                break;
        }
     
        const res = await callAPI2(
            "/api/workflowAgent2",
            {
                cmd:"viralPic", 
                preRoomId,
                putQRCode: true,
                params:{
                    func: changeMode,
                    model: changeMode, // 为了后台计算价格
                    changeMode, 
                    drawRatio, 
                    bgImage: backgroundImage,
                    imageURL: originalPhoto,
                    blur,
                    params
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
    }

    return (
        <div className="flex mx-auto flex-col items-center justify-center min-h-screen">
            <Head>
                <title>{ title }</title>
                <meta property="og:description" content={title} /> 
                <meta property="og:title" content={title} />
                <meta property="og:image" content={config.logo32}/>    
                <meta name="description" content={title} />           
            </Head>                 
            <Header config={config} />
            <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto}/>

            <main className="flex flex-1 flex-col">

                <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">

                    <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        showResultButton={false}
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
                            <FormLabel number={`${num++}`} label="您期望打卡的场景"/>
                            <PromptArea
                                hotWords={"BG"}
                                userPrompt={prompt}
                                hasAdvanceButton={false}
                                onSysPromptChange={(sp) => setSysPrompts(sp) }
                                onUserPromptChange={(up) => setPrompt(up) }
                                />
                        </div>

                        <StartButton config={config} title="生成打卡照"  model={changeMode} loading={loading} showPrice={true}
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
            <Footer/>
        </div>
    );
};
