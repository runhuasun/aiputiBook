import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";

import prisma from "../lib/prismadb";
import {ZipData} from "./api/processImage";
import { GenerateResponseData } from "./api/generate";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import LoginPage from "../components/LoginPage";
import Uploader, {mimeTypes} from "../components/Uploader";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import ResultButtons from "../components/ResultButtons";
import ComboSelector from "../components/ComboSelector";
import LoadingRing from "../components/LoadingRing";
import TaskPannel from "../components/TaskPannel";
import ToolBar from "../components/ToolBar";
import DropDown from "../components/DropDown";
import FlexVideo from "../components/FlexVideo";
import InputImage from "../components/InputImage";
import ResultView from "../components/ResultView";

import { config } from "../utils/config";
import * as debug from "../utils/debug";
import * as enums from "../utils/enums";
import downloadPhoto from "../utils/fileUtils";
import {callAPI, callAPI2} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as fc from "../utils/funcConf";
import * as fu from "../utils/fileUtils";
import * as ru from "../utils/restUtils";
import * as rmu from "../utils/roomUtils";

const funcs: string[] = [
    "faceswapVideo",
    "faceswapVideoHD",    
    "faceswapFilter",        
    ];
const funcNames = new Map([
    ["faceswapVideo", "快速模型，适合单一人物简单视频"],
    ["faceswapVideoHD", "超清模型，商业级高清，用时较长"],
    ["faceswapFilter", "高级模型，支持多人复杂视频"],
    ]);

const genders: string[] = [
    "male",
    "female",
];
const genderNames = new Map([
//    ["none", "不过滤性别"],
    ["male", "替换目标画面中男性"],
    ["female", "替换目标画面中的女性"]
]);

const orders: string[] = [
    "large-small",
    "left-right",
    "right-left",    
    "top-bottom",    
    "bottom-top",    
];
const orderNames = new Map([
    ["large-small", "优先替换画面占比最大的人物"],
    ["left-right", "优先替换画面左侧人物"],
    ["right-left", "优先替换画面右侧人物"],    
    ["top-bottom", "优先替换画面上方人物"],    
    ["bottom-top", "优先替换画面下方人物"]
]);

export default function faceswapVideo({ simRoomBody, image, video, config }: { simRoomBody:any, image: Room, video:Room, config:any }) {
    let title="视频换脸";
    let num=1;
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>((router?.query?.videoId || router?.query?.roomId) as string);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    
    const [imageUrl, setImageUrl] = useState((router.query.faceURL || router.query.imageURL || router.query.imageUrl  || simRoomBody?.params?.source || image?.outputImage ||  "") as string);
    const [faceCount, setFaceCount] = useState(0);
    const [videoUrl, setVideoUrl] = useState((router.query.videoURL || router.query.videoUrl || simRoomBody?.params?.target || video?.outputImage || "") as string);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [func, setFunc] = useState<string>(simRoomBody?.params?.func || "faceswapVideo");
    const [targetGender, setTargetGender] = useState<string>("female");
    const [targetOrder, setTargetOrder] = useState<string>("large-small");
    const [promise, setPromise] = useState<boolean>(true);
    const [know, setKnow] = useState<boolean>(true);
    const [confirmation, setConfirmation] = useState<boolean>(true);    
    const [priceUnits, setPriceUnits] = useState<number>(0);
    const [faces, setFaces] = useState<any>();
    const [imageDetecting, setImageDetecting] = useState<boolean>(false);
    const [isMultiFacesVideo, setIsMultiFacesVideo] = useState<boolean>(false);
    const [videoFaceIndex, setVideoFaceIndex] = useState<number>(0);
    const [speed, setSpeed] = useState<number>(1);
    const [duration, setDuration] = useState<number>(0);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    async function generate() {
        if(!window){
            return alert("当前浏览器和系统不兼容，请换一个浏览器试试!");
        }

        if(func=="faceswapFilter" && data.boughtCredits <= 0){
            return alert("高级模型仅供付费用户使用！您可以先试用通用模型。");
        }
        
        if(videoUrl == null || videoUrl.length < 1){
            alert("请上传一段视频来生成视频画面！");
            return;                                                           
        }
        if(imageUrl == null || imageUrl.length < 1){
            alert("请上传一张照片来生成视频画面！");
            return;                                                           
        }

        if(imageDetecting){
            return alert("我们正在对您的脸部照片进行分析检测，请稍等候...");
        }
        if(faceCount < 1){
            return alert("在照片中没有检测到清晰的人脸，请换一张照片试试！");
        }

        if(faceCount > 1){
            return alert("检测到照片中多于一张人脸，这将不能正确执行操作，请重新上传一张只包含一个人物的照片。");
        }

        if(!confirmation){
            if(await confirm("重要提示：请确认没有侵犯我上传照片和视频的人物肖像权和作品版权！")){
                setConfirmation(true);
            }else{
                return;
            }                
        }
        
        if(!promise){
            if(await confirm("重要提示：请承诺只在合法用途下使用本产品的生成结果！")){
                setPromise(true);
            }else{
                return;
            }
        }

        if(!know){
            if(await confirm("重要提示：我知晓非法使用本产品结果可能会触犯法律，并确认由我本人承担一切法律后果！")){
                setKnow(true);
            }else{
                return;
            }
        }

        let genLength = priceUnits;
        if(!genLength || genLength<0.1){
            return alert("当前视频的长度为0，或者视频格式不能被正确识别，请刷新页面或者换一个视频。");
        }
        const unitPrice = fc.getPricePack(config, "faceswapVideo").price;
        const remainUnits = Math.floor(data.remainingGenerations / unitPrice);
        const useCredits = remainUnits * unitPrice;
        if(remainUnits < priceUnits){
            if(remainUnits <= 0){
                const ok = await confirm(`您目前的${config.creditName}不足以处理视频，建议您到充值页面购买更多的${config.creditName}，我们将提供多种优惠套餐供您选择！`);
                if(ok){
                    window.location.href = "/buy-credits?from=faceswapVideo";
                }
                return;
            }else{
                const ok = await confirm(`虽然您目前的${config.creditName}不足以处理当前视频的长度。但是我们可以为您前${remainUnits}秒的视频生成换脸效果！本次任务将会消耗您${useCredits}个${config.creditName}，您是否确认继续？`);
                if(ok){            
                    genLength = remainUnits;
                }else{
                    return;
                }
            }
        }

        setLoading(true);
        try{
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    timeStamp: Date.now(),
                    cmd: "faceswapVideo",
                    preRoomId,
                    priceUnits: genLength, // 能量点不足时只生成截取的前N秒
                    params: {
                        func,
                        targetGender,
                        targetOrder,
                        source: imageUrl, 
                        target: videoUrl,
                        keep_fps: true,
                        keep_frames: true,                      
                        enhance_face: true,
                        total_length: priceUnits, //视频总长，秒
                        gen_length: genLength, //本次生成的时长
                        isMultiFacesVideo,
                        videoFaceIndex,
                        speedUp: speed == 2,
                    }
                },
                title,
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

    async function onRecognizeSwapImage(faces:any){
        if (!faces || faces.length==0) {
            alert("在照面中没有检测到清晰的人物，建议更换照片试试");
            setFaceCount(0);
        }else{
            if(faces.length>1){
                alert("检测到上传的人脸图片多于一张人脸，这将不能正确执行操作，请重新上传一张只包含一个人物的照片。");
            }else{
                let faceWarn = "";
                if(faces[0].pose.yaw > 30 || faces[0].pose.yaw < -30){ 
                    faceWarn = "左右倾斜幅度过大";                        
                }
                if(faces[0].pose.pitch > 30 || faces[0].pose.pitch < -30){
                    faceWarn += (faceWarn ? "，" : "") + "上下摆动幅度过大";                        
                }
                if(faces[0].pose.roll > 30 || faces[0].pose.roll < -30){
                    faceWarn += (faceWarn ? "，" : "") + "左右扭动幅度过大";                        
                }
                if(faceWarn){
                    alert(`新的脸部照片中，人物的${faceWarn}。建议您选择一张正脸照片，这样系统才能更好学习人物相貌特征`);                    
                }
                //alert(imageURL);
                const imageSize = await fu.getImageSize(imageUrl);
                //alert(JSON.stringify(imageSize));
                if(imageSize && imageSize.width && imageSize.height){
                    const imageArea = imageSize.width * imageSize.height;
                    const faceArea = faces[0].rect.width * faces[0].rect.height;
                    //alert("imageArea:" + imageSize.width + "X" + imageSize.height);
                    //alert("faceArea:" + faces[0].rect.width + "X" + faces[0].rect.height);
                    //alert("percent:" + faceArea / imageArea);
                    const percent = Math.round((faceArea / imageArea) * 100);
                    //alert("percent" + String( percent ));
                    if((percent+20) > 50){
                        alert(`新的脸部照片中面部所占的比例太大(${percent+20}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例介于10%-50%的照片。`);
                    }
                    if((percent+5) < 8){
                        alert(`新的脸部照片中面部所占的比例太小(${percent+5}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例介于10%-50%的照片。`);
                    }
                }
            }   
            setFaceCount(faces.length);
        }
    }

    async function recognizeFace(imageURL:string){
        setImageDetecting(true);
        try{
            // alert("recog:" + imageURL);
            const res = await callAPI("/api/simpleAgent", {
                cmd:"recognizeFace", 
                params:{imageURL}
            });
            if (res.status != 200) {
                debug.error(JSON.stringify(res.result as any));
            }else{
                const newFaces = JSON.parse(res.result?.generated);  // 多张人脸的属性              
                setFaces(newFaces);
                if(newFaces && newFaces.length>0){
                    if(newFaces[0].gender === 1){// 男性
                        setTargetGender("male");
                    }else{
                        setTargetGender("female");
                    }
                }
                await onRecognizeSwapImage(newFaces);
            }
        }catch(err){
            debug.error(err);
        }finally{
            setImageDetecting(false);
        }
    }

    useEffect(() => {
        if(imageUrl && (status == "authenticated")){
            recognizeFace(imageUrl);
        }
    }, [imageUrl, status]); 

    useEffect(() => {
        if(!isMultiFacesVideo){
            setVideoFaceIndex(0);
        }
    }, [isMultiFacesVideo]); 
    

    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} videoURL={videoUrl}/>
                
                <div className="page-container">
                    
                    <div className="page-tab-video-edit">
    
                        <FormLabel number={`${num++}`} label="新的脸部照片（清晰正面）"/>
                        <InputImage src={imageUrl}/>
                        <ComboSelector selectorType="USER"
                            onSelect = {(newFile) => setImageUrl(newFile)}                                    
                         //   onRecognizedFaces = {(faces) => { 
                         //       setFaces(faces);
                         //       onRecognizeSwapImage(faces);                                            
                         //   }}
                            />                                    
                 
                        <FormLabel number={`${num++}`} label="被换脸的目标视频" hint="视频画面中的人物要尽量正面清晰，也不要用手或者其它物体遮挡面部！侧脸或遮挡的面部会严重影响换脸效果。如果画面中有多个人物，请使用高级模型，并尽量让所有视频在同一镜头场景下，以免不同场景不同人物造成换脸对象错误。"/>
                        <FlexVideo ref={videoRef} src={videoUrl}  poster={videoUrl}  controls={true} autoPlay={false} loading={loading} speed={speed}
                                onLoading={(status:boolean)=>setLoading(status)}
                                onVideoUpdate={(url:string, duration:number, current:number)=>{                                            
                                    if(url != videoUrl){
                                        setVideoUrl(url);
                                    }
                                    setDuration(duration);                                            
                                    const pus = Math.round(duration / speed);
                                    setPriceUnits(pus);                                            
                                    if(status == "authenticated"){
                                        const unitPrice = fc.getPricePack(config, "faceswapVideo").price;
                                        const remainUnits = Math.floor(data.remainingGenerations / unitPrice);
                                        if(remainUnits < pus && remainUnits > 0){
                                            alert(`虽然您目前的${config.creditName}不足以处理当前视频的长度。但是如果您开始合成视频，我们将为您前${remainUnits}秒的视频生成换脸效果！`);
                                        }
                                    }
                                    
                                }}    
                            />
                        <ComboSelector fileType="VIDEO"
                            onSelectRoom = {async (newRoom) => {
                                setPreRoomId(newRoom?.id);
                            }}                                       
                            onSelect = {(newFile) => setVideoUrl(newFile)}                                    
                            />  

                        <FormLabel number={`${num++}`} label="换脸大模型"/>
                        <DropDown
                            theme={func}
                            // @ts-ignore
                            setTheme={(newRoom) => setFunc(newRoom)}
                            themes={funcs}
                            names={funcNames}
                            />

                        { func == "faceswapFilter" && (
                        <div className="space-y-4 w-full ">
                            <FormLabel number={`${num++}`} label="替换目标性别"/>
                            <DropDown
                                theme={targetGender}
                                // @ts-ignore
                                setTheme={(newRoom) => setTargetGender(newRoom)}
                                themes={genders}
                                names={genderNames}
                                />
                        </div>
                        )}

                        { func == "faceswapFilter" && (
                        <div className="space-y-4 w-full ">
                            <FormLabel number={`${num++}`} label="替换目标优先顺序"/>
                            <DropDown
                                theme={targetOrder}
                                // @ts-ignore
                                setTheme={(newRoom) => setTargetOrder(newRoom)}
                                themes={orders}
                                names={orderNames}
                                />
                        </div>
                        )}                            

                        { func === "faceswapVideoHD" && (
                            <FormLabel label="提示：高清模型要求视频画面的第一帧一定要有清晰的人脸！" blink/>         
                        )}
                        
                        <div className=" space-y-4 pt-5 w-full">
                            <FormLabel label="警告：不得将本产品的结果用于传播色情、恐怖、暴力、宗教等用途"/>         
                            <div className="w-full hidden flex flex-row items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={confirmation}
                                    onChange={() => setConfirmation(!confirmation)}
                                    className="form-checkbox"
                                    />
                                <p className="text-left font-medium">
                                    我确认没有侵犯我上传照片和视频的人物肖像权和作品版权。
                                </p>
                            </div>                                
                            <div className="w-full hidden flex flex-row items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={promise}
                                    onChange={() => setPromise(!promise)}
                                    className="form-checkbox"
                                    />
                                <p className="text-left font-medium">
                                    我承诺只在合法用途下使用本产品的生成结果。
                                </p>
                            </div>
                            <div className="w-full hidden flex flex-row items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={know}
                                    onChange={() => setKnow(!know)}
                                    className="form-checkbox"
                                    />
                                <p className="text-left font-medium">
                                    我知晓非法使用本产品结果可能会触犯法律，并确认由我本人承担一切法律后果！
                                </p>
                            </div>
                        </div>  

                        <StartButton config={config} title="开始合成视频"  units={priceUnits} unitName={"秒内容"} model={func}
                            minTime={5} maxTime={10} timeUnit={"分钟"}
                            showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}
                            />

                        <div className="w-full flex flex-col items-start space-y-2 pt-20">
                            <div className="w-full flex flex-row items-center justify-center text-base tracking-widest">
                                <span>想要对照片换脸？</span>
                                <Link href={imageUrl ? `/faceswap?faceURL=${imageUrl}` : `/faceswap`} className="underline underline-offset-2">照片换脸</Link>
                            </div>                            
                        </div>

                    
                    </div>


                    <ResultView config={config} mediaType={"VIDEO"} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"faceswapVideo", model:func}} />
                
                </div>
            </main>                
        </TopFrame>
    );
};

      


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    let videoId = ctx?.query?.videoId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;

    let image:any;
    let video:any;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            }
        });
    }
    if(videoId){
        video = await prisma.room.findUnique({
            where: {
                id: videoId,
            }
        });
    }

    monitor.logUserRequest(ctx, session);    
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),            
            image,
            video,
            config
        },
    };

}            

                            {/*
                            <FormLabel number={`${num++}`} isChecker={true} label="快进2倍，减少50%费用，画质略有降低" initValue={speed==2}
                                onValueChange={(newVal)=>{
                                    const newSpeed = newVal ? 2 : 1;
                                    setPriceUnits(Math.round(duration / newSpeed));                                        
                                    setSpeed(newSpeed);
                                    if (videoRef.current) {
                                        videoRef.current.playbackRate = newSpeed;
                                    }                                    
                                }}
                                />         
                            */}
                            {/*
                            <FormLabel number={`${num++}`} label="目标视频中有多张人脸" isChecker={true} initValue={isMultiFacesVideo} onValueChange={(value) => {
                                setIsMultiFacesVideo(value);
                            } }/>

                           
                            {isMultiFacesVideo && (
                            <div className={" w-full flex flex-row justify-start items-center space-x-3 mb-5"}>
                                <p className="pl-5">替换目标视频中左起第几个人物？</p>                                
                                <div className="flex flex-row items-center space-x-2 px-1">
                                    <input type="radio" className="radio-dark-green" value={0} checked={videoFaceIndex == 0} onChange={(e) => setVideoFaceIndex(parseInt(e.target.value))}  />
                                    <span className={videoFaceIndex == 0 ? "text-gray-200" : "text-gray-400"}>第1个</span>
                                </div>
                                <div className="flex flex-row items-center space-x-2 px-1">
                                    <input type="radio" className="radio-dark-green" value={1} checked={videoFaceIndex == 1} onChange={(e) => setVideoFaceIndex(parseInt(e.target.value))} />
                                    <span className={videoFaceIndex == 1 ? "text-gray-200" : "text-gray-400"}>第2个</span>
                                </div>
                                <div className="flex flex-row items-center space-x-2 px-1">
                                    <input type="radio" className="radio-dark-green" value={2} checked={videoFaceIndex == 2} onChange={(e) => setVideoFaceIndex(parseInt(e.target.value))} />
                                    <span className={videoFaceIndex == 2 ? "text-gray-200" : "text-gray-400"}>第3个</span>
                                </div>
                            </div> 
                            )}
                            */}
