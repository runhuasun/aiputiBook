import React, { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import FlexAudio from "../components/FlexAudio";
import InputImage from "../components/InputImage";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";


const modelNames = new Map([
    ["sadTalker", "TALKER模型"],
    ["memo", "MEMO模型"], // 60s
    ["v-express", "EXPRESS模型"],    
    ["liveportrait", "灵动人像模型"], // 180s    
    ["hallo", "Hallo模型（动态效果好，输入照片必须正方形）"],
    ["emo-v1", "悦动人像模型（动作逼真自然，只输出半身区域）"], // 60s
    ["sonic", "Sonic人像说话模型（动作逼真自然，只输出头部区域）"]
]);
const models = Array.from(modelNames.keys());

const styleLevelNames = new Map([
    ["normal", "中性"],
    ["calm", "平静"],
    ["active", "活泼"]
]);
const styleLevels = Array.from(styleLevelNames.keys());

const emoRatioNames = new Map([
    ["1:1", "1:1"],
    ["3:4", "3:4"]
]);
const emoRatios = Array.from(emoRatioNames.keys());


export default function sadTalker({ simRoomBody, voice, image, config }: { simRoomBody:any, image: string, voice: string, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody );
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [priceUnits, setPriceUnits] = useState<number>(0);

    const [model, setModel] = useState<string>(simRoomBody?.params?.func || "emo-v1");
    
    const [imageUrl, setImageUrl] = useState((router.query.imageURL || image || simRoomBody?.params?.source_image || "") as string);
    const [audioUrl, setAudioUrl] = useState(voice || simRoomBody?.params?.driven_audio || "");
    const [still, setStill] = useState(simRoomBody?.params?.still || true);
    const [singSong, setSingSong] = useState<boolean>(simRoomBody?.params?.singSong || false);
    const [styleLevel, setStyleLevel] = useState<string>(simRoomBody?.params?.styleLevel || "normal");
    const [dynamicScale, setDynamicScale] = useState<number>(simRoomBody?.params?.dynamicScale || 1);
    const [emoRatio, setEmoRatio] = useState<string>(simRoomBody?.params?.emoRatio || "3:4");
    

    async function generate() {
        if(audioUrl == null || audioUrl.length < 1){
            alert("请上传一段音频来驱动画面！");
            return;                                                           
        }
        if(imageUrl == null || imageUrl.length < 1){
            alert("请上传一张照片来生成动画！");
            return;                                                           
        }      
        let videoLength = priceUnits;
        switch(model){
            case "memo":
                if(priceUnits > 60){
                    const c = await confirm("您选择的模型只支持最长60秒音频，是否继续使用前60秒音频生成视频？");
                    if(c){
                        videoLength = 60;
                        setPriceUnits(60);
                    }else{
                        return;
                    }
                }
                break;
            case "emo-v1":
                if(priceUnits > 60){
                    return alert("您选择模型最长只支持60秒钟的音频！");
                }
                break;
            case "liveportrait":
                if(priceUnits > 300){
                    return alert("您选择模型最长只支持5分钟的音频！");
                }
                break;
        }

        const size = await fu.getImageSize(imageUrl);
        if(model == "hallo"){
            if(Math.abs(size.width - size.height) > 10){
                return alert("hallo模型要求输入照片必须是正方形，否则画面会扭曲！");
            }
        }
                
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "sadTalker", 
                preRoomId,
                priceUnits:videoLength,
                params:{
                    func: model,
                    singSong,

                    emoRatio,
                    
                    style_level: styleLevel,
                    dynamic_scale: dynamicScale,
                    source_image:imageUrl, 
                    image_height:size?.height || 0,
                    image_width:size?.width || 0,
                    driven_audio:audioUrl,
                    audio_length: videoLength,
                    
                    use_enhancer: true,
                    use_eyeblink: true, 
                    pose_style: 0, // 不知都含义
                    expression_scale: 1, // a larger value will make the expression motion stronger
                    preprocess: "full", // "crop",
                    size_of_image: 512, // Face model resolution
                    facerender: "pirender", //  "facevid2vid",
                    still_mode: still,
                }
            },
            "生成视频",
            "VIDEO",
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
                
                <ToolBar config={config} roomId={preRoomId} imageURL={imageUrl}/>

                <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                    <div className="page-tab-video-create">

                        <div className="space-y-4 w-full max-w-lg">
                            <FormLabel number={`${num++}`} label={`人物的正面照片${model=="hallo" ? "（必须是正方形）" : ""}`}/>
                            <InputImage src={imageUrl}/>
                            <ComboSelector
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setImageUrl(newFile)} fileType="IMAGE" />    
                        </div>
                        
                        <div className="space-y-4 w-full max-w-lg">
                            <div className="w-full flex flex-row mt-2 items-center space-x-3">                                
                                <FormLabel number={`${num++}`} label="用于合成视频的音频素材(.mp3/.wav)"/>
                                <Link
                                    href="/createVoice" target="_blank"
                                    className="button-green-blue mt-3 px-2 py-1 text-xs" >
                                    制作音频
                                </Link>     
                            </div>
                            {audioUrl && (
                            <FlexAudio src={audioUrl} key={audioUrl} controls={true} loading={loading} 
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onAudioUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != audioUrl){
                                            setAudioUrl(url);
                                        }
                                        setPriceUnits(Math.ceil(duration));
                                    }}    
                                />                
                            )}
                            <ComboSelector onSelect = {(newFile) => setAudioUrl(newFile)} fileType="VOICE" /> 
                        </div>

                        <FormLabel number={`${num++}`} label="唱歌模式（过滤音乐和噪音的干扰）" isChecker={true} initValue={singSong} onValueChange={(value) => {
                            setSingSong(value);
                        } }/>                            
                        
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="照片驱动模型" hint="一般用户可以使用默认模型"/>
                            <DropDown
                                theme={model}
                                // @ts-ignore
                                setTheme={(newRoom) => setModel(newRoom)}
                                themes={models}
                                names={modelNames}
                                />
                        </div> 

                        {(model === "emo-v1" || model === "liveportrait") && (
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="动作幅度"/>
                            <DropDown
                                theme={styleLevel}
                                // @ts-ignore
                                setTheme={(newRoom) => setStyleLevel(newRoom)}
                                themes={styleLevels}
                                names={styleLevelNames}
                                />
                        </div> 
                        )}

                        {model === "emo-v1" && (
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="输出画面比例"/>
                            <DropDown
                                theme={emoRatio}
                                // @ts-ignore
                                setTheme={(newRoom) => setEmoRatio(newRoom)}
                                themes={emoRatios}
                                names={emoRatioNames}
                                />
                        </div> 
                        )}
                        
                        {model === "sonic" && (
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="动作幅度"/>
                            <input type="range" value={dynamicScale} min={0.5} max={2} step={0.1} className="slider-dark-green w-full mt-4"                            
                                onChange={(e) => setDynamicScale(parseFloat(e.target.value))}
                                />      
                        </div> 
                        )}
                        
                        {model == "sadTalker" && (
                        <FormLabel number={`${num++}`} label="头部保持静止" isChecker={true} initValue={still} onValueChange={(value) => {
                            setStill(value);
                        } }/>
                        )}
                    
                        <StartButton config={config} title="开始合成视频" model={model} units={priceUnits} unitName={"秒音频"}  showPrice={true}
                            loading={loading}
                            onStart={async () => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}
                            />
                    
                    </div>

                    <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                        restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"sadTalker", model:model}} />
                </div>
            </main>
            
        </TopFrame>
    );

};
      
      
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let room = imgId ? await prisma.room.findUnique({ where: {id: imgId} }) : null;
    let voice;
    let image;
    if(room?.outputImage){
        if(room.outputImage.indexOf("mp3")>0){
            voice = room.outputImage;
        }else{
            image = room.outputImage;
        }
    }

    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                        
            voice,
            image,
            config
        },
    };
  
}            
