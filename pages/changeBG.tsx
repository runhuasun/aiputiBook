import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";

import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { getImageSize } from "../utils/fileUtils";
import { config, system } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";
import PromptArea from "../components/PromptArea";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";



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

const changeModeNames = new Map();
changeModeNames.set("ideogram-v3-bg-turbo", "提示词描绘背景（Turbo模型）");    
changeModeNames.set("flux-kontext-pro","提示词描绘背景（Flux模型）");    
changeModeNames.set("iclight-v2","提示词描绘背景（IC模型）");    
// changeModeNames.set("byte-bgpaint","提示词描绘背景（Byte模型）");    
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


export default function changeBG({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    let title = "全真智能场景替换";
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
                cmd:"changeBG", 
                preRoomId,
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
            <TopFrame config={config}>

                <main className="flex flex-1 flex-col">
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />

                    <div className="page-container">

                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
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
                                <FormLabel number={`${num++}`} label="选择场景替换模型"/>
                                <DropDown
                                    theme={changeMode}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setChangeMode(newRoom);
                                    }}
                                    themes={changeModes}
                                    names={changeModeNames}
                                    />
                            </div>

                            {(changeMode=="gpt-image-1-edit-medium" || changeMode=="auto" || changeMode=="hard") && (                            
                            <div className="space-y-4 mt-4 w-full">
                                <FormLabel number={`${num++}`} label="选择背景照片" onCancel={() => setBackgroundImage("")}/>
                                <InputImage src={backgroundImage}/> 
                                <ComboSelector selectorType="TEMPLATE" albumId={system.album.bg.id} albumName="背景"
                                    onSelect = {(newFile) => ( setBackgroundImage(newFile) )} />                                  
                            </div>
                            )}

                            {/*(changeMode=="auto") && (
                            <div className="space-y-4 mt-4 w-full">
                                <FormLabel number={`${num++}`} label="渲染照片的光线来源"/>
                                <DropDown
                                    theme={lightSource}
                                    // @ts-ignore
                                    setTheme={(newRoom) => {
                                        setLightSource(newRoom);
                                    }}
                                    themes={lightSources}
                                    names={lightSourceNames}
                                    />
                            </div>
                            )*/}
                            
                            {/*(changeMode=="auto") && (
                            <div className="space-y-4 mt-4 w-full">
                                <FormLabel number={`${num++}`} label="照片的输出比例"/>
                                <DrawRatioSelector onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                            </div>
                            )*/}

                            {(changeMode=="hard") && (
                            <div className="mt-4 w-full">
                                <FormLabel number={`${num++}`} label={`背景虚化程度：${blur}`}/>
                                <input type="range" value={blur} min="0" max="50" step="2" className="slider-dark-green w-full mt-4"                            
                                    onChange={(e) => setBlur(parseInt(e.target.value))}
                                    />
                            </div>                    
                            )}

                            {(changeMode=="flux-kontext-pro" || changeMode=="iclight-v2" || changeMode=="ideogram-v3-bg-turbo" || changeMode==="byte-bgpaint")  && (
                            <div className="space-y-4 mt-4 w-full">
                                <FormLabel number={`${num++}`} label="描述您期望的新背景"/>
                                <PromptArea
                                    hotWords={"BG"}
                                    userPrompt={prompt}
                                    hasAdvanceButton={false}
                                    onSysPromptChange={(sp) => setSysPrompts(sp) }
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />
                            </div>
                            )}

                            <StartButton config={config} title="替换照片背景"  model={changeMode} loading={loading} showPrice={true}
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

