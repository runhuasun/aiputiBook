import Head from "next/head";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { Room } from "@prisma/client";

import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config, system } from "../utils/config";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import {extractMaskImage} from "../components/MaskImageEditor";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import ModelSelector from "../components/ModelSelector";


const clothChangeMethodNames = new Map([
    ["free", "自由更换服装"],
    ["vton", "虚拟试衣"],    
    ["lora", "服装套系替换"],
//    ["refModel", "参考模特的服装"],    
    ]);
const clothChangeMethods : string[] = Array.from(clothChangeMethodNames.keys());


export default function changeCloth({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: Room, config:any }) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [image, setImage] = useState<string>("");
    const [refImage, setRefImage] = useState<string>(simRoomBody?.params?.refImage || "");
    const [prompt, setPrompt] = useState(simRoomBody?.params?.prompt || "");
    const [imageWidth, setImageWidth] = useState<number>(simRoomBody?.params?.width || 0);
    const [imageHeight, setImageHeight] = useState<number>(simRoomBody?.params?.height || 0);

    const [func, setFunc] = useState(router.query.func as string || simRoomBody?.params?.func || "flux-dev-inpaint");
    const [lora, setLora] = useState<any>();
    const [title, setTitle] = useState<string>("改变服装");
    const [clothChangeMethod, setClothChangeMethod] = useState<string>(simRoomBody?.params?.clothChangeMethod || "free");
    const [strength, setStrength] = useState<number>(Math.round((simRoomBody?.params?.strength || 0.9) * 100));
    const [maskCanvas, setMaskCanvas] = useState<any>();

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
    
    async function generate() {
        if(!image){
            return alert("请先选择或上传一张照片！");
        }

        let loraCode = lora?.code;
        if(clothChangeMethod == "lora" && !lora){
            return alert("请选择一个服装套系");
        }
        if(clothChangeMethod == "free"){
            if(!prompt){
                return alert("请描绘您希望让照片中人物更换成什么服装");
            }
            loraCode = undefined;
        }

        if(clothChangeMethod=="refModel" && !refImage){
            return alert("请先选择或上传一张参考服装模特照片！");                
        }
        if(clothChangeMethod=="vton" && !refImage){
            return alert("请先选择或上传一张衣服的照片！");
        }

        try{
            setLoading(true);
            
            let maskImage:any = null;
            if(clothChangeMethod != "vton"){
                if(maskCanvas){
                    maskImage = extractMaskImage(maskCanvas);
                }        
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
            }
            
            let inputText = prompt;
            if(func=="refModel"){
                inputText = "Replace with clothes of the exact same color and style as another character."
            }
            let params:any = {
                func,
                clothChangeMethod,
                image, 
                refImage,
                maskImage,
                width:imageWidth,
                height:imageHeight,     
                prompt: inputText,
                lora: loraCode,
                strength: strength/100,
            };
    
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd:"changeCloth", 
                    preRoomId,
                    params
                },
                title,
                "IMAGE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                   mutate();
                   setRestoredImage(res.result.generated);
                   setRestoredId(res.result.genRoomId);                                      
                },
                (res:any)=>{
                    if(res.result.indexOf("输入无效")>=0){
                        alert("图片尺寸不符合要求，请用照片裁剪功能，先把照片裁剪成标准16:9，标准9:16，标准4:3，标准3:4，或者标准1:1尺寸，再来尝试");
                        window.open(`/editImage?imageURL=${image}`);
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
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={image} restoredImage={restoredImage} restoredId={restoredId} />
                
                <div className="page-container">

                    <ImageView num={num++} originalPhoto={image} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        supportMask={true} needMask={true} params={{initMaskAreas:["cloth"]}}
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
                            setError(null); 
                        }}
                    />                        
                    
                    <div className="page-tab-edit">                        

                        <div className="space-y-4 w-full  flex flex-col">
                            <FormLabel number={`${num++}`} label="服装更换方式"/>                                
                            <DropDown
                                theme={clothChangeMethod}
                                // @ts-ignore
                                setTheme={(newRoom) => setClothChangeMethod(newRoom)}
                                themes={clothChangeMethods}
                                names={clothChangeMethodNames}
                                />
                            
                            {clothChangeMethod == "free" && (
                            <div className="space-y-4 w-full flex flex-col">
                                <FormLabel number={`${num++}`} label="描绘更换服装后的画面" hint="要求更换的衣服一定要和左侧选区范围合理配合。比如不能在左侧选择上衣，但是这里要求穿牛仔裤。也不能左侧选择紧贴身体的区域，这里要求换宽松的裙子。"/>                                
                                <div className="relative inline-block w-full">
                                    <PromptArea
                                        hotWords="CLOTH"
                                        hasAdvanceButton={false}
                                        userPrompt={prompt}
                                        readOnly={false}
                                        onUserPromptChange={(up) => setPrompt(up) }
                                        />  
                                </div>                                      
                            </div>
                            )}

                            {clothChangeMethod == "lora" && (
                            <div className="w-full flex flex-col">
                                <FormLabel number={`${num++}`} label="选择服装套系"/>                                
                                <InputImage src={lora?.coverImg}/>
                                <ModelSelector onSelect = {(newFile) => {
                                    setLora(newFile);
                                }} title="选择服装套系" modelType="LORA" channel="PORTRAIT"  />    
                                <input type="text" value = {lora?.name || ""} className="w-full text-black text-sm bg-gray-400 border-1 border-black border"  readOnly />                                

                                <FormLabel label={`套系模仿度：${strength}%`}/>
                                <input type="range" value={strength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                                    onChange={(e) => setStrength(parseInt(e.target.value))}
                                    />                                     
                            </div>   
                            )} 
                            
                            {clothChangeMethod == "refModel" && (
                            <div className="w-full flex flex-col space-y-4">
                                <FormLabel number={`${num++}`} label="参考服装模特照（必须有人，不能只衣服）"/>                                
                                <InputImage src={refImage}/>
                                <ComboSelector onSelect = {(newFile) => setRefImage(newFile)} />                                        
                            </div>   
                            )}   

                            {clothChangeMethod == "vton" && (
                            <div className="w-full flex flex-col space-y-4">
                                <FormLabel number={`${num++}`} label="衣服或参考模特的照片" hint="最好是一件平铺的衣服，背景为纯色或透明。如果是带有人物和背景的照片，因为干扰和遮挡因素太多，有可能无法精确识别。"/>                                
                                <InputImage src={refImage}/>
                                <ComboSelector 
                                    selectorType="TEMPLATE" albumId={system.album.demoCloth.id} albumName="样例"                                                            
                                    onSelect = {(newFile) => setRefImage(newFile)} />                                        
                            </div>   
                            )}   
                            
                        </div>
 

                        <StartButton config={config} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}/>

                        <div className="w-full max-w-lg flex flex-col items-start space-y-2 pt-20">
                            <div className="w-full max-w-lg flex flex-row items-center justify-center tracking-widest">
                                <span>专业制作服装展示图？</span>
                                <Link href="/adCloth" className="underline underline-offset-2">服装试穿</Link>
                            </div>                            
                        </div>                            
                    </div>

                </div>                          
        
            </main>
        </TopFrame>
    );
};

    
      
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    let imgId = ctx?.query?.roomId;
    let defaultImage = null;
    
    if(imgId){
        defaultImage = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            defaultImage,
            config
        },
    };
  
}            
