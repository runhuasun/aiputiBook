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
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";
import InputImage from "../components/InputImage";
import ModelSelector from "../components/ModelSelector";
import { extractMaskImage } from "../components/MaskImageEditor";

import * as debug from "../utils/debug";


const changeModeNames = new Map([
    ["model", "替换成预训练的模特"],
    ["prompt", "替换成提示词描绘的人物"]
    ]);
const changeModes = Array.from(changeModeNames.keys());
     
const changeTypeNames = new Map([
    ["changeHead", "只更换脸部和头发（更稳定）"],
    ["changeBody", "更换全身可见区域"],
    ["keepCloth", "重新渲染衣服之外的区域"],    
    ]);
const changeTypes: string[] = Array.from(changeTypeNames.keys());


export default function changePerson({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: Room, config:any }) {
    const router = useRouter();

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [changeMode, setChangeMode] = useState<string>(simRoomBody?.params?.changeMode || "model");    
    const [image, setImage] = useState<string>();
    const [targetRect, setTargetRect] = useState<any>();
    const [prompt, setPrompt] = useState(simRoomBody?.params?.prompt || "");
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);

    const inpaintType = router.query.inpaintType as string || "inpaint";
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status="authenticated"} = useSession();
    const [lora, setLora] = useState<any>(simRoomBody?.params?.loraModel);
    const [title, setTitle] = useState<string>(router.query.title as string || "替换模特");
    const [strength, setStrength] = useState<number>((simRoomBody?.params?.strength || 0.8)*100);
    const [changeType, setChangeType] = useState<string>(simRoomBody?.params?.changeType || "keepCloth");
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

        if(changeMode == "model" && !lora?.code){
            return alert("请线选择一位模特！");
        }
        if(!prompt){
            return alert("请描绘一下模特形象");
        }   

        let maskImage;
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
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd:"changePerson", 
                preRoomId,
                params:{
                    changeMode,
                    changeType,
                    image, 
                    maskImage,
                    width:imageWidth,
                    height:imageHeight,     
                    prompt,
                    lora: lora?.code,
                    strength: (strength * 0.01),
                    loraCover: lora?.coverImg
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

    
    let num = 1;

       
    return (
        <TopFrame config={config}>

            <main>

                <ToolBar config={config} roomId={preRoomId} imageURL={image} restoredImage={restoredImage} restoredId={restoredId} />
                
                <div className="page-container">

                    <ImageView num={num++} originalPhoto={image} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        supportMask={true} needMask={true} params={{initMaskAreas:["head", "skin"]}}
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
                        <div className="space-y-4 w-full max-w-lg mb-5">

                            <FormLabel number={`${num++}`} label="选择替换方式"/>                                
                            <DropDown
                                theme={changeMode}
                                // @ts-ignore
                                setTheme={(newRoom) => setChangeMode(newRoom)}
                                themes={changeModes}
                                names={changeModeNames}
                                />

                            {changeMode == "model" && (
                            <>
                                <FormLabel number={`${num++}`} label="选择人物模特"/>                                
                                <InputImage src={lora?.coverImg}/>

                                <div className="w-full flex flex-col items-center">
                                    <ModelSelector onSelect = {(newFile) => {
                                        setLora(newFile);
                                        try{
                                            const po = JSON.parse(newFile?.params);
                                            setPrompt(po.aPrompt);
                                        }catch(err:any){
                                            debug.error(err);
                                        }
                                    }} title="选择模特" modelType="LORA" channel="FASHION"  />    
                                    <input type="text" value = {lora?.name || ""} className="w-full text-black text-sm bg-gray-400 border-1 border-black border"  readOnly />                                
                                </div>                                    
                                
                                <FormLabel number={`${num++}`} label={`模特还原度：${strength}%`} hint="还原度越大越像模特，但是会导致画面容易出错"/>
                                <input type="range" value={strength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                                    onChange={(e) => setStrength(parseInt(e.target.value))}
                                    />
                            </>
                            )}

                            {/*
                            <FormLabel number={`${num++}`} label="选择替换区域"/>                                
                            <DropDown
                                theme={changeType}
                                // @ts-ignore
                                setTheme={(newRoom) => setChangeType(newRoom)}
                                themes={changeTypes}
                                names={changeTypeNames}
                                />   
                            */}
                            
                            <FormLabel number={`${num++}`} label="细致描述人物形象"/>                                                                    
                            <PromptArea
                                hotWords="USER_DESC"
                                hasAdvanceButton={false}
                                userPrompt={prompt}
                                onUserPromptChange={(up) => setPrompt(up) }
                                />                                      
                            
                        </div>
    
                         <StartButton config={config} model={changeMode} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);   
                                setSideBySide(false);
                                generate();
                            }}/>
                        
                        <div className="w-full flex flex-row items-center justify-center mt-10">
                            <span>需要训练自己的模特？</span>
                            <Link href="/createLoRA?title=虚拟模特&channel=FASHION" className="underline underline-offset-2">训练模特</Link>
                        </div>   
                        <div className="w-full flex flex-row items-center justify-center mt-5">
                            <span>要仔细挑选心仪的模特？</span>
                            <Link href="/VDH" className="underline underline-offset-2">模特市场</Link>
                        </div>   
                        
                    </div>

                </div>                          
        
            </main>
        </TopFrame>
    );
};

    
      
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    if(simRoomBody?.params?.lora){
        simRoomBody.params.loraModel = await prisma.model.findUnique({
            where: { code: simRoomBody.params.lora }
        });
    }
    
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
            simRoomBody,                            
            defaultImage,
            config
        },
    };
  
}            
