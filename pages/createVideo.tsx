import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { Room } from "@prisma/client";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";

// Components
import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import Video from "../components/wrapper/Video";
import InputImage from "../components/InputImage";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";
import MediaViewer from "../components/MediaViewer";
import Toggle from "../components/Toggle";
import RadioChoice from "../components/wrapper/RadioChoice";
import AlbumSelector from "../components/AlbumSelector";

// Utils
import { config } from "../utils/config";
import { callAPI2, callAPI } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import downloadPhoto from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as mt from "../utils/modelTypes";
import * as ru from "../utils/restUtils";


const sourceNames = new Map([
    ["TEXT", "文生视频"],
    ["PHOTO", "图生视频"],
    ["VIDEO", "视频续拍"]
]);
const sources = Array.from(sourceNames.keys());

const ratioNames = new Map([
    ["16:9", "16:9 适合在电脑和电视上播放"],
    ["9:16", "9:16 适合在手机和平板上播放"],
 //   ["1:1", "1:1 正方形的画面"]
]);
const ratios = Array.from(ratioNames.keys());

const modelObjects = [
    {code:"QUICK", name:"快速体验版, 速度快价格低，普通画质", startImage:true, endImage:true},    
    {code:"STANDARD", name:"超能专业版，速度价格适中，电影级画面", startImage:true, endImage:false},
    {code:"PRO_PLUS", name:"超清加强版V2，效果更自然，超清稳定画质", startImage:true, endImage:false},
    {code:"PRO_PLUS2", name:"超清加强版V3，效果超自然，超清画质", startImage:true, endImage:false}
];
export const modelNames = new Map<string, string>();
export const modelMap = new Map<string, any>();
export const models: string[] = [];
for(const m of modelObjects){
    models.push(m.code);
    modelNames.set(m.code, m.name);
    modelMap.set(m.code, m);  
}

const allModels:string[] = mt.videoModelCodes;
const allModelNames = new Map<string, string>();
for(const m of mt.videoModels){
    if(m.show){
        allModelNames.set(m.code, `${m.name} — [⚡${m.price} / ⭐${m.score} ]`);
    }
}


export default function createVideo({ simRoomBody, room, config }: { simRoomBody:any, room:any, config:any }) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status="authenticated" } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [prompt, setPrompt] = useState<string>(simRoomBody?.params?.prompt || room?.prompt || router?.query?.prompt || "");
    const [imageURL, setImageURL] = useState(router?.query?.imageURL || simRoomBody?.params?.imageURL || (room?.resultType=="IMAGE" ? room?.outputImage : null) || "");
    const [videoURL, setVideoURL] = useState(router?.query?.videoURL || simRoomBody?.params?.videoURL || (room?.resultType=="VIDEO" ? room?.outputImage : null) || "");
    const [aiAudio, setAiAudio] = useState<boolean>(simRoomBody?.params?.aiAudio || false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [endImageURL, setEndImageURL] = useState((router?.query?.endImageURL || simRoomBody?.params?.endImageURL || "") as string);
    
    const [ratio, setRatio] = useState<string>(simRoomBody?.params?.ratio || "9:16"); // 16:9, 9:16, 1:1
    const [duration, setDuration] = useState<string>(String(simRoomBody?.params?.duration || 5)); // 5, 10
    const [priceUnits, setPriceUnits] = useState<number>(5);

    const [sysType, setSysType] = useState<string>("PRO"); // ((router?.query?.sysType || (!!simRoomBody ? "PRO" : "CAMERIST")) as string);
    const [model, setModel] = useState<string>((simRoomBody?.params?.model || router?.query?.model || (sysType == "PRO" ? "kling-v1.6-standard" : "STANDARD")) as string);
    const [modelConfig, setModelConfig] = useState<any>();
    
    const [source, setSource] = useState<string>(simRoomBody?.params?.source || "TEXT");
    const [currentTime, setCurrentTime] = useState(0);    
    const [totalTime, setTotalTime] = useState(0);
    const [concatVideo, setConcatVideo] = useState<boolean>(true);

    function getModelConfig(m:string){
        let config = null;
        config = modelMap.get(model);
        if(!config){
            config = mt.videoModelMap.get(model);
        }
        return config;
    }

    useEffect(() => {
        const reqModel = (simRoomBody?.params?.model || router?.query?.model) as string;
        if(sysType == "PRO"){
            if(reqModel && mt.videoModelCodes.includes(reqModel)){
                setModel(reqModel);
            }else{
                setModel("doubao-seedance-1-0-lite"); // "luma-ray-flash-2-540p");
            }
        }else{
            if(reqModel && models.includes(reqModel)){
                setModel(reqModel);
            }else{
                setModel("QUICK");
            }
        }
    }, [sysType]);    
    
    useEffect(() => {
        if(models.includes(model)){ 
            setSysType("CAMERIST");            
        }else{
            setSysType("PRO");
        }
    }, []);    

    useEffect(() => {
        const mc = mt.videoModelMap.get(model);
        setModelConfig(mc);
        
        if(sysType == "PRO"){
            if(!mc?.startImage){
                setSource("TEXT");                
            }else{
                if(mc?.mustImage){
                    setSource("PHOTO");
                }
            } 
        }

        if(model.includes("google-veo-3")){
            setDuration("8");
            setRatio("16:9");            
        }else{
            if(duration !== "5" && duration !== "10"){
                setDuration("5");
            }
        }
    }, [model]);

    useEffect(() => {
        if(source === "TEXT"){
            const m = mt.videoModelMap.get(model);
            if(m?.mustImage){
                alert(`视频模型${m.name}不支持文本生成视频，请使用图片生成视频方式！`);
                setSource("PHOTO");
            } 
        }
    }, [source]);
    
    useEffect(() => {
        setPriceUnits(parseInt(duration));
    }, [duration]); 

    useEffect(() => {
        if(imageURL){
            setSource("PHOTO");
        }
        if(videoURL){
            setSource("VIDEO");
        }
    }, []); 
    
    const handleTimeUpdate = (e:any) => {
        const time = e.target.currentTime;
        setCurrentTime(time);
    };   
    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (video) {
            // 设置 currentTime 为视频总时长
            video.currentTime = video.duration;
            setTotalTime(video.duration);
            setCurrentTime(video.duration);
        }
    };    
    
    async function generate() {
        if(!prompt){
            return alert("请先简单描述一下视频画面的内容，这样才能生成更加丰富的视频画面。");
        }
        if(source == "PHOTO" && !imageURL){
            return alert("请先上传或者选择一张照片！");
        }
        
        if(source == "VIDEO" && !videoURL){
            return alert("请先上传或者选择一段视频！");
        }
        setLoading(true);
        try{
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "createVideo", 
                    priceUnits,
                    preRoomId,                    
                    params:{
                        source,
                        prompt, 
                        imageURL: source === "PHOTO" ? imageURL : undefined,
                        endImageURL: (source === "PHOTO" || source === "VIDEO") ? endImageURL : undefined,
                        videoURL: source === "VIDEO" ? videoURL : undefined,
                        aiAudio,
                        concatVideo,
                        currentTime,
                        totalTime,
                        ratio,
                        duration:parseInt(duration), 
                        model,
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
        }finally{
            setLoading(false);
        }
    }

    async function addRoomToAlbum(mediaId:any, album:any){
        const res = await callAPI("/api/albumManager", { 
            cmd:"ADDROOM", id:album.id, roomId:mediaId
        });
        if (res.status !== 200) {
            alert(res.result);
        } else {
            alert(`视频已经被加到相册《${album.name}》`);
        }
    }  
    
    async function auditImage(image:string){
        if(image.indexOf(".jpg") >= 0 || image.indexOf(".jpeg") >= 0 || image.indexOf(".png") >= 0 || image.indexOf(".webp") >= 0){
            try{
                const res = await callAPI("/api/simpleAgent", {
                    cmd: "auditImage",
                    params: {
                        imageURL: image
                    }
                });
                if(res?.result?.generated){
                    //alert(res?.result?.generated);          
                    const scenes = JSON.parse(res.result.generated);
                    //alert(scenes.porn);
                    if(scenes.porn == "porn" || scenes.ad == "porn"){
                        alert("检测到上传的照片当中包含有过于色情的画面，无法用来生成视频。请换一张照片试试！");
                        return false;
                    }
                  //  if(scenes.porn == "sexy" || scenes.ad == "sexy"){
                  //      const OK = confirm("检测到上传的照片画面过于性感暴露，生成视频时很可能由于无法过审而失败。您要继续生成吗？");
                  //      return OK ? true : false;
                  //  }
                    if(scenes.terrorism == "bloody" || scenes.terrorism == "politics" || scenes.ad == "politics" || scenes.ad == "terrorism"){
                        alert("检测到上传的照片当中包含有暴恐或政治敏感信息，无法用来生成视频。请换一张照片试试！");
                        return false;
                    }
                    if(scenes.terrorism == "drug" || scenes.live == "drug"){
                        alert("检测到上传的照片当中包含有和毒品相关的敏感信息，无法用来生成视频。请换一张照片试试！");
                        return false;
                    }
                }
            }catch(err){
                alert("审核照片时发生意外错误：" + String(err));
            }
        }
        return true;
    }  

   
    let num = 1;
    
        return (
            <TopFrame config={config}>

                <main>  
                    <ToolBar config={config} roomId={preRoomId} imageURL={imageURL}/>
                    
                    <div className="page-container">

                        <div className="page-tab-video-create">

                            <Toggle className="hidden flex flex-col items-center mt-5"
                                sideBySide={sysType=="PRO"} leftText="优选模型" rightText="模型超市"
                                setSideBySide={(newVal) => {
                                    setSysType(newVal ? "PRO" : "CAMERIST"); 
                                }} />                            

                            {(sysType=="CAMERIST" || getModelConfig(model)?.startImage) && (
                            <div className="space-y-4 w-full">
                                <RadioChoice values={sourceNames} onSelect={(newRoom) => setSource(newRoom)} selectedValue={source} />
                            </div>     
                            )}
                            
                            {sysType == "PRO" && (
                            <div className="space-y-4 w-full ">
                                <div className="w-full flex flex-row space-x-3 ">
                                    <FormLabel number={`${num++}`} label="选择视频生成模型" />
                                    <button className={"button-main text-xs px-2 py-1 mt-3"}
                                        onClick = {() => {
                                            window.open("/vModelList", "_blank");
                                        }}
                                        >  
                                        大模型集市
                                    </button>
                                </div>
                                <DropDown
                                    theme={model}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setModel(newRoom)}
                                    themes={allModels}
                                    names={allModelNames}
                                    />
                            </div>     
                            )}


                            {sysType == "CAMERIST" && (
                            <div className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label="选择视频生成模型" />
                                <DropDown
                                    theme={model}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setModel(newRoom)}
                                    themes={models}
                                    names={modelNames}
                                    />
                            </div>     
                            )}                            
                            
                            {source == "PHOTO" && (
                            <div className="space-y-3 w-full">
                                <div className="flex flex-row items-center space-x-3">
                                    <FormLabel number={`${num++}`} label="视频首帧画面" hint="AI会把这张照片做为生成视频的第一帧画面" onCancel={() => setImageURL("")} />
                                    <Link
                                        href="/createPrompt" target="_blank"
                                        className="button-green-blue text-xs mt-3 px-2 py-1" >
                                        照片创意
                                    </Link>                                      
                                </div>
                                <InputImage src={imageURL}/>
                                <ComboSelector selectorType="GENERAL" fileType="IMAGE"
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}   
                                    onSelect={(newFile) => setImageURL(newFile)} 
                                    />    
                            </div>
                            )}

                          
                            {source == "VIDEO" && (
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label="用来续拍的视频" onCancel={() => setVideoURL("")} />
                                <div className="w-full flex flex-col items-center">                      
                                    {videoURL && (
                                    <Video ref={videoRef} src={videoURL}  poster={videoURL} className="w-full w-auto max-h-96" controls={true} autoPlay={false} 
                                        onPause={handleTimeUpdate}
                                        onTimeUpdate={handleTimeUpdate}    
                                        onLoadedMetadata={handleLoadedMetadata}                                        
                                        />
                                    )}
                                    {videoURL && (                                    
                                    <p className="text-base text-gray-200">拖动进度条到你希望作为起始帧的位置。帧画面务必清晰！！</p>                                    
                                    )}
                                    {source == "VIDEO" && videoURL && (                                                                        
                                    <FormLabel label="生成结果和续拍视频拼接在一起" isChecker={true} initValue={concatVideo} onValueChange={(value) => {
                                        setConcatVideo(value);
                                    } }/>                             
                                    )}                                          
                                </div>
                                <ComboSelector selectorType="GENERAL" onSelect={(newFile) => setVideoURL(newFile)} fileType="VIDEO" />    
                            </div>
                            )}

                            {((source == "PHOTO" || source == "VIDEO") && getModelConfig(model)?.endImage) && (
                            <div className="space-y-3 w-full">
                                <div className="flex flex-row items-center space-x-3">
                                    <FormLabel number={`${num++}`} label="视频尾帧画面（可选）" hint="AI会把这张照片做为生成视频的最后一帧画面" onCancel={() => setEndImageURL("")} />
                                    <Link
                                        href="/createPrompt" target="_blank"
                                        className="button-green-blue text-xs mt-3 px-2 py-1" >
                                        照片创意
                                    </Link>                                      
                                </div>
                                <InputImage src={endImageURL}/>
                                <ComboSelector selectorType="GENERAL" fileType="IMAGE"
                                    onSelect={(newFile) => setEndImageURL(newFile)} 
                                    />    
                            </div>
                            )}
                            
                            <div className="space-y-4 w-full ">
                                <div className="w-full space-x-3 flex flex-row items-center">
                                    <FormLabel number={`${num++}`} label="描绘生成的视频画面" 
/*                                        hint={
`提示：
1、描绘的画面变化幅度不要太大，人物动作不要太剧烈。这样生成的画面才会比较流畅。
2、不但需要描绘视频的动作和拍摄角度等，还要描绘一下静止的画面，这样生成的画面效果才会更好。比如：
[视频画面] 一位女士正在优雅的介绍背后的房子。一边摊开双手介绍，一边慢慢向泳池边走过去。
[静止画面] 画面中是一个短发的中国美女，穿白衬衣和深灰色西装，站立。背后不远处是一栋美式的别墅，旁边有游泳池。`} */
                                        />
                                    <MediaViewer title="使用帮助" config={config} src={config.RS + "/aixiezhen/help/goodVideo.jpg"}
                                        className="button-green-blue mt-3 px-2 py-1 text-xs" text="高质量画面技巧"/>
                                </div>   
                                <div className="relative inline-block w-full">
                                    <PromptArea
                                        initMinRows = {5}
                                        initMaxRows = {20}                                        
                                        initPlaceHolder = "请尽量详细的描绘您的视频画面..."
                                        hasAdvanceButton={false}
                                        userPrompt={prompt}
                                        onUserPromptChange={(up) => setPrompt(up) }
                                        />
                                </div>
                            </div>

                            {source == "TEXT" && (
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label="画面比例" />
                                <DropDown
                                    disabled={model.includes("google-veo-3")}
                                    theme={ratio}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setRatio(newRoom)}
                                    themes={ratios}
                                    names={ratioNames}
                                    />
                            </div>                
                            )}
                            
                            <FormLabel number={`${num++}`} label="生成环境音效" isChecker={true} initValue={aiAudio} onValueChange={(value) => {
                                setAiAudio(value);
                            } }/>
                            
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label={"生成视频时长"} />
                                <div className="w-full justify-center space-x-5 flex flex-row">
                                    {model.includes("google-veo-3") && (
                                    <label className="px-3">
                                        <input type="radio" value="5" checked={true}/>
                                        8秒钟
                                    </label>
                                    )}
                                    {!model.includes("google-veo-3") && (
                                    <label className="px-3">
                                        <input type="radio" value="5" checked={duration === "5"} onChange={(e) => setDuration(e.target.value)} />
                                        5秒钟
                                    </label>
                                    )}
                                    {!model.includes("google-veo-3") && (                                    
                                    <label className="px-3">
                                        <input type="radio" value="10" checked={duration === "10"} onChange={(e) => setDuration(e.target.value)}/>
                                        10秒钟
                                    </label>
                                    )}
                                </div>
                            </div>     
                            
                            <StartButton config={config} title="开始生成视频" showPrice={true} loading={loading}
                                units={priceUnits} unitName={"秒内容"} model={model} 
                                minTime={5} maxTime={10} timeUnit="分钟"
                                onStart={async () => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                      
                                    generate();
                                }}
                                />
                        </div>

                        <ResultView config={config} loading={loading} error={error} mediaType="VIDEO"
                            restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"createVideo", model:model}} />
  
                    </div>
                </main>
            </TopFrame>
        );
    
};
      
      
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx?.query?.roomId;
    let room:any; 
    
    if(roomId){
        room = await prisma.room.findUnique({ 
            where: {id: roomId},
            select: {
                outputImage: true,
                prompt: true,
                resultType: true
            }
        });
    }

    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            room,
            config
        },
    };
  
}            
