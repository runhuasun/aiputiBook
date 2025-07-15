import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import DropDown from "../components/DropDown";
import Toggle from "../components/Toggle";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import LoadingButton from "../components/LoadingButton";
import PriceTag from "../components/PriceTag";
import ImageView from "../components/ImageView";

import { extractMaskImage, extractAlphaMaskImage } from "../components/MaskImageEditor";

import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as mt from "../utils/modelTypes";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";


const inpaintMethodNames = new Map([
    ["MASK", "涂抹修改修复"],
    ["MAGIC", "指令控制魔改"]
]);
const inpaintMethods = Array.from(inpaintMethodNames.keys());


export default function inpaint({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: any, config:any }) {

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [image, setImage] = useState<string>();
    const [targetRect, setTargetRect] = useState<any>();
    const [prompt, setPrompt] = useState(simRoomBody?.params?.prompt || "");
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [func, setFunc] = useState(router.query.func as string || simRoomBody?.params?.func ||  "flux-kontext-pro");
    const [model, setModel] = useState<any>();
    const [inpaintMethod, setInpaintMethod] = useState<string>(simRoomBody?.params?.inpaintMethod || "MAGIC");

    const [lora, setLora] = useState<any>();
    const [title, setTitle] = useState<string>(router.query.title as string || "AI任意修改图片");
    const [hairColor, setHairColor] = useState<string>("none");
    const [hairStyle, setHairStyle] = useState<string>("none");
    const [strength, setStrength] = useState<number>(Math.round((simRoomBody?.params?.strength || 0.9) * 100));
    const [clothChangeMethod, setClothChangeMethod] = useState<string>("free");
    const [maskCanvas, setMaskCanvas] = useState<any>();

    const [modelCodes, setModelCodes] = useState<any[]>([]);
    const [modelNames, setModelNames] = useState<Map<string,string>>(new Map([]));

    useEffect(() => {
        if(inpaintMethod === "MASK"){
            setModelCodes(mt.maskInpaintModelCodes);
            setModelNames(mt.maskInpaintModelNames);
            setFunc("flux-fill-dev");
        }else{
            setModelCodes(mt.magicInpaintModelCodes);
            setModelNames(mt.magicInpaintModelNames);
            setFunc("flux-kontext-pro");
        }
    }, [inpaintMethod]); 
    
    useEffect(() => {
        const inputImage = (router.query.imageURL || defaultImage?.outputImage || simRoomBody?.params?.image || "") as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setImage(result);
                }
            });
        }else{
            setImage("");
        }
    }, []); // 空数组表示只在组件挂载时执行一次

    useEffect(() => {
        const m = mt.inpaintModelMap.get(func);
        setModel(m);
    }, [func]); 
    
    async function generate() {
        if(!image){
            return alert("请先选择或上传一张照片！");
        }
       // if(!targetRect || targetRect.width<10 || targetRect.height<10){
       //     setLoading(false);
       //     return alert("请先在画面上选择一个宽和高都大于10个像素的重绘区域！");
       // }
        if(!prompt){
            return alert("请先告诉我修复区域的修改内容吧！");
        }

        setLoading(true);

        try{
            const imageMeta = await fu.getImageSize(image);
    
            let maskImage;
            if(maskCanvas){
                maskImage = func.includes("gpt") ? (await extractAlphaMaskImage(maskCanvas, image)) : extractMaskImage(maskCanvas);
            }        
            if(model.needMask){
                if(!maskImage){
                    return alert("请先在原始图片上选择一个修改区域");
                }
                const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
                switch(bwt){
                    case "B":
                        return alert("您还没有在原始图片上选择一个修改区域");
                    case "W":
                        return alert("您不能把所有的区域都涂抹成修改区域！");
                }
            }else{
                if(model.supoortMask && maskImage){
                    const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
                    if(bwt != "N"){
                        maskImage = null;
                    }
                }
            }
            if(maskImage){
                maskImage = await fu.uploadBase64FileServer(maskImage, "image/png");
            }
            
            if(func == "flux-dev-inpaint"){
            /*    if(!(
                    (imageMeta.width==1024 && (imageMeta.height == 576 || imageMeta.height == 768 || imageMeta.height == 1024)) ||
                    (imageMeta.height==1024 && (imageMeta.width == 576 || imageMeta.width == 768))
                )){
                    const ok = await confirm("FLUX局部重绘引擎效果很好，但是只适用于标准尺寸的照片，请到裁剪尺寸页面进行裁剪为标准16:9(1024 X 576), 9:16(576 X 1024), 4:3(1024 X 768), 3:4(768 X 1024)或1:1(1024 X 1024)");
                    if(ok){
                        window.open(`/editImage?imageURL=${image}`, "_blank");
                        return;
                    }else{
                        return;
                    }
                } */
            }else{             
                if(func == "sd-inpaint"){                
                    if(imageMeta && (imageMeta.width!>1024 || imageMeta.height!>1024)){
                        setLoading(false);
                        return alert(`SD标准重绘引擎要求图片尺寸必须小于1024 X 1024像素，当前图片高度${imageMeta.height}，宽度${imageMeta.width}，请裁剪后重试，或者更换一个重绘引擎。`);
                    }
                }else{
                    if(imageMeta && (imageMeta.width! > 2000 || imageMeta.height! > 2000)){
                        setLoading(false);
                        return alert(`图片尺寸必须小于2000 X 2000像素，当前图片高度${imageMeta.height}，宽度${imageMeta.width}，请裁剪后重试。`);
                    }
                }
            }
            let loraCode = lora?.code;
           
            let params:any = {
                func,
                image, 
                maskImage,
                width:imageWidth,
                height:imageHeight,     
                prompt,
                target_rect:targetRect,
                lora: loraCode,
                strength: strength/100,
            };
    
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd:"inpaint", 
                    preRoomId,
                    model: func,
                    params
                },
                title,
                "IMAGE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                   mutate();
                   setRestoredImage(res.result?.generated);
                   setRestoredId(res.result?.genRoomId);                                      
                },
                (res:any)=>{
                    if(res?.result?.indexOf("输入无效")>=0){
                        alert("图片尺寸不符合要求，请用照片裁剪功能，先把照片裁剪成标准16:9，标准9:16，标准4:3，标准3:4，或者标准1:1尺寸，再来尝试");
                        if (typeof window !== "undefined") {
                            window.open(`/editImage?imageURL=${image}`);
                        }
                        return true;
                    }else{
                        return false;
                    }
                }
            );                    
        }finally{
            setLoading(false);
        }
    }


    let num = 1;

    return (
        <TopFrame config={config} >
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={image} restoredImage={restoredImage} restoredId={restoredId} />
        
                <div className="page-container">
                    <ImageView num={num++} originalPhoto={image} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        supportMask={inpaintMethod === "MASK"} needMask={inpaintMethod === "MASK"}
                        onMaskUpdate={(maskCanvas: HTMLCanvasElement)=>{
                            setMaskCanvas(maskCanvas);
                        }}
                        onSelectRoom={(newRoom:any)=>{
                            setPreRoomId(newRoom?.id);
                        }}
                        onSelectImage={(newFile:string)=>{
                            setImage(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                        onContinue={(newFile:string)=>{
                            setImage(newFile);
                            setRestoredImage(null);
                            setRestoredId(null);                            
                            setError(null); 
                        }}
                    />
                    
                    <div className="page-tab-edit">         
                        <Toggle className="flex flex-col items-center mt-4"
                            leftText="涂抹区域修改" rightText="指令控制魔改"                            
                            leftHint="在左侧原始图片上涂抹选择要修改的区域，然后输入修改内容，AI就会精确修改您涂抹区域的内容。涂抹画笔工具栏在原始图片左边。"
                            rightHint="直接描述清除您需要修改原始图片中哪个区域的哪些内容，AI自动判断如何进行修改。操作更简单，但是有一定可能AI理解的选区和您希望的选区有差别。"
                            sideBySide={inpaintMethod==="MAGIC"} 
                            setSideBySide={(newVal) => {
                                setInpaintMethod(newVal ? "MAGIC" : "MASK"); 
                            }} />                        


                        <FormLabel number={`${num++}`} label="选择AI修图模型" hint="每一种模型都有自己的适用范围和出图特点。针对特定需求时，贵的不一定是效果更好的！价格仅仅反映模型对服务器算力的需求。"/>                                
                        <DropDown
                            theme={func}
                            // @ts-ignore
                            setTheme={(newRoom) => setFunc(newRoom)}
                            themes={modelCodes}
                            names={modelNames}
                            />

                        <FormLabel number={`${num++}`} label={model?.supportMask ? "修改涂抹区域的内容" : "修改照片哪个部分的什么内容"}/>                                
                        <div className="relative inline-block w-full">
                            <PromptArea
                                hotWords={model?.hotWords || "REPAIRE"}
                                hasAdvanceButton={false}
                                userPrompt={prompt}
                                readOnly={false}
                                onUserPromptChange={(up) => setPrompt(up) }
                                />  
                        </div>   

                        <StartButton config={config}  model={func} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}/>

                    </div>

                </div>                          
        
            </main>
        </TopFrame>
    );

};

    
      
export async function getServerSideProps(ctx: any) {
    let imgId = ctx?.query?.roomId;
    let defaultImage = null;
    
    if(imgId){
        defaultImage = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                    
            defaultImage,
            config
        },
    };
  
}            
