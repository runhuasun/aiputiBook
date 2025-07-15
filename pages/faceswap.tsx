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
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import LoadingButton from "../components/LoadingButton";
import PriceTag from "../components/PriceTag";
import ImageView from "../components/ImageView";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import RadioChoice from "../components/wrapper/RadioChoice";

import { config } from "../utils/config";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { callAPI2 } from "../utils/apiUtils";


const funcNames = new Map([
    ["faceswap", "快速换脸"],
    ["faceswapHD", "高清美颜换脸"],
//     ["faceswapGPT", "GPT换脸（高清美化）"],
//       ["faceswapV4_S", "深度换脸（超逼真！只支持单人）"],
    ["faceswapV4_S", "深度换脸（超逼真！用时2-3分钟）"],        
   // ["faceswapV4_Q", "深度换脸深度版（超逼真，仅支持单人）"],        
   // ["facefusion", "人物深度学习（也换脸型发型，画面整体有改动）"]
    ]);
const funcs = Array.from(funcNames.keys());

const deepSwapTypes = new Map([
    ["face", "替换脸部（推荐）"],
    ["head", "替换头部（长发慎用）"],
]);


export default function faceswap({simRoomBody, image, user, face, config }: { simRoomBody:any, image: any, user:any, face:any, config:any }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [func, setFunc] = useState(simRoomBody?.params?.func || "faceswap");    
    const [error, setError] = useState<string | null>(null);
    const [swapUrl, setSwapUrl] = useState((router.query.faceURL || face?.outputImage || simRoomBody?.params?.swap_image || "") as string);
    const [swapFaceCount, setSwapFaceCount] = useState(-1);
    
    const [targetUrl, setTargetUrl] = useState((router.query.imageURL || router.query.targetURL || simRoomBody?.params?.target_image || "") as string);
    const [targetRect, setTargetRect] = useState<any>();
    const [targetFaceCount, setTargetFaceCount] = useState(-1);
    const [targetFaces, setTargetFaces] = useState<any[]>();

    const [modelCode, setModelCode] = useState<string>(image?.model || "");
    const [strength, setStrength] = useState<number>(simRoomBody?.params?.strength || 50);
    const [swapType, setSwapType] = useState<string>(simRoomBody?.params?.swap_type || "face");
    const [styleType, setStyleType] = useState<string>(simRoomBody?.params?.style_type || "style");
    const [refineResult, setRefineResult] = useState<boolean>((simRoomBody?.params?.refineResult !== undefined) ? simRoomBody?.params?.refineResult : false);

    const [alertedHeadSwap, setAlertedHeadSwap] = useState<boolean>(false);
    
    let title="照片换脸";
    let num=1;

    useEffect(() => {
        const paramImage = (router.query.imageURL || router.query.targetURL || image?.outputImage) as string;
        if(paramImage){
            fu.aliyunImageRestrictResize(paramImage).then((result)=>{
                if(result){
                    setTargetUrl(result);
                }
            });
        }else{
            setTargetUrl(simRoomBody?.params?.target_image || "");
        }
    }, []); // 空数组表示只在组件挂载时执行一次    
    

    function checkProximity(swapRect:any, targetFaces:any, faceUpScale:number) {
       // alert(JSON.stringify(swapRect));
       // alert(JSON.stringify(targetFaces));
        if(swapRect && targetFaces?.length>0){
            // 容差式矩形比对（各维度允许±2像素误差）
            const isSimilarRect = (a:any, b:any) => 
                Math.abs(a.x - b.x) <= 2 &&
                Math.abs(a.y - b.y) <= 2 &&
                Math.abs(a.width - b.width) <= 2 &&
                Math.abs(a.height - b.height) <= 2;
        
            // 生成扩大后的矩形
            const expandRect = (rect:any, scale:any) => {
                const centerX = rect.x + rect.width / 2;
                const centerY = rect.y + rect.height / 2;
                const newWidth = rect.width * scale;
                const newHeight = rect.height * scale;
                return {
                    x: centerX - newWidth / 2,
                    y: centerY - newHeight / 2,
                    width: newWidth,
                    height: newHeight
                };
            };
        
            // 判断矩形是否重叠
            const rectsOverlap = (a:any, b:any) => 
                a.x < b.x + b.width && 
                a.x + a.width > b.x && 
                a.y < b.y + b.height && 
                a.y + a.height > b.y;
        
            // 过滤掉自身矩形项
            const otherFaces = targetFaces.filter(
                (target:any) => !isSimilarRect(target.rect, swapRect)
            );
            //alert("otherFaces:" + JSON.stringify(otherFaces));
            
            // 生成扩大的swapRect
            const expandedSwapRect = expandRect(swapRect, faceUpScale);
        
            // 检测是否存在重叠项
            return otherFaces.some(
                (target:any) => rectsOverlap(expandedSwapRect, target.rect)
            );
        }
        return false;
    }
    
    async function generate() {
        if(!window){
            return;
        }

        try{
            setLoading(true);
            
            let swapfunc = func;
    
            //alert("targetFaceCount" + targetFaceCount);
            //alert("targetRect" + JSON.stringify(targetRect));
            
            if(!targetUrl){
                return alert("请上传一张被换脸的原始照片！");                                                                       
            }
            const targetSize = await fu.getImageSize(targetUrl);
            if(targetSize.width < 256 || targetSize.height < 256){
                return alert("为了保证换脸效果，被换脸的原始照片宽度和长度都不要小于256像素。并且脸部在照片中的占比不要大于60%。");
            }
            
            if(!swapUrl){
                return alert("请上传一张包含清晰人物面孔的新脸部照片！");
            }      
            const swapSize = await fu.getImageSize(swapUrl);
            if(swapSize.width < 256 || swapSize.height < 256){
                return alert("为了保证换脸效果，新的脸部照片宽度和长度都不要小于256像素。并且脸部在照片中的占比不要大于50%。");
            }
    
            if(targetFaceCount < 0){
                return alert("超能AI正在努力识别照片中的人脸，请等待识别完成后再进行操作...");
            }

            if(targetFaceCount == 0){
                const OK = await confirm("在将被换脸的原始照片中没有检测到清晰的人物，这有可能是您提供的照片清晰度太差，或者照片中的人物五官不清晰，亦或是头部扭动的幅度过大，AI无法准确识别用户脸部细节。您还要继续执行本次换脸操作吗？");
                if(!OK){
                    return;
                }
            }
            
            // 多于一张人脸只能使用普通换脸
            //if(targetFaceCount > 1 && (func == "facefusion" || func.startsWith("faceswapV4"))){
            //    setFunc("faceswap");
            //    return alert("目标照片多于一张人脸时，不能使用深度换脸！我们已经为您切换，请您重试！");
            //}
    
            // 以下对换脸区域做处理
            let swapRect:any;
    
            //if(func == "faceswap" || func == "faceswapHD"){            
            if(targetRect && targetRect.width && targetRect.height){
                swapRect = targetRect;
            }else{
                return alert("必须选择一张人脸，或者划定一个人脸区域，才能开始换脸！");
            }
        
            if(targetFaceCount > 1 && !swapRect){
                return alert("被换脸的原始照片中检测到多张人脸，请点击绿色或红色的方框，来指定一张人脸来替换！");
            }
            if(swapRect && ((swapRect.width && swapRect.width<20) || (swapRect.height && swapRect.height<20)) ){
                return alert(`您选择的目标区域太小(${targetRect.width} X ${targetRect.height})，请选择一个人物的完整面部区域。`);
            }
            //}

            let faceUpScale = targetFaceCount == 1 ? 2.5 : 1.6;
            
            if(swapfunc.indexOf("faceswapV4")>=0 && checkProximity(swapRect, targetFaces, 1) && swapRect.isDetectedFace){
                return alert("选择的目标脸部区域和周围的人脸距离太近，无法使用深度换脸");
            }
            
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "faceswap", 
                    preRoomId,
                    params : {
                        func: swapfunc,
                        inputText: (targetUrl == image?.outputImage) ? image?.prompt : "",
                        swap_image:swapUrl, 
                        target_image:targetUrl,
                        target_rect:swapRect,
                        refineResult,
                        faceUpScale,
                        targetFaces,
                        strength,
                        model_type: "speed", // "quality", // 
                        swap_type: swapType,
                        style_type: styleType,
                        hardware: "cost", // "fast", // 
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

  
    async function onRecognizeSwapImage(faces:any, imageURL:string){
        //alert("Faces:" + JSON.stringify(faces));
       // alert("status:" + status);
       // if(status == "authenticated"){
            //alert("1");
            if (!faces || faces.length==0) {
                alert("在新的脸部照片中没有检测到清晰的人物，这有可能是您提供的照片清晰度太差，或者照片中的人物五官不清晰，亦或是头部扭动的幅度过大，AI无法准确识别用户脸部细节。强烈建议您更换新的脸部照片再操作！！");
            }else{
                setSwapFaceCount(faces.length);
                //alert("2"+faces.length);
                if(faces.length>1){
                    alert("检测到上传的人脸图片多于一张人脸，这很可能导致AI系统不能正确执行换脸操作。请重新上传一张只包含一个人物的照片。");
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
                    const imageSize = await fu.getImageSize(imageURL);
                    //alert(JSON.stringify(imageSize));
                    if(imageSize && imageSize.width && imageSize.height){
                        const imageArea = imageSize.width * imageSize.height;
                        const faceArea = faces[0].rect.width * faces[0].rect.height;
                        //alert("imageArea:" + imageArea);
                        //alert("faceArea:" + faceArea);
                        //alert("percent:" + faceArea / imageArea);
                        const percent = Math.round((faceArea / imageArea) * 100);
                        if(percent > 60){
                            alert(`新的脸部照片中面部所占的比例太大(${percent}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例不大于50%的照片。`);
                        }
                        if(percent < 2.1){
                            alert(`新的脸部照片中面部所占的比例太小(${percent || 1}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例不小于5%的照片。`);
                        }
                    }
                }            
            }
       // }
    }
  

        return (
            <TopFrame config={config}>
    
                <main>
                    <ToolBar config={config} roomId={preRoomId} imageURL={targetUrl} restoredImage={restoredImage} restoredId={restoredId} />
    
                    <div className="page-container">
                        
                        <ImageView num={num++} originalPhoto={targetUrl} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                            selectFace={true} originalTitle={"原始照片（支持多人中选择）"}
                            onSelectRect = {(rect) => {
                                setTargetRect(rect);
                            }}
                            onFacesDetected = {(faces:any) => {
                                setTargetFaceCount(faces.length);
                                setTargetFaces(faces);
                            }}                              
                            onSelectRoom={(newRoom:any)=>{
                                setPreRoomId(newRoom?.id);
                            }}
                            onSelectImage={(newFile:string)=>{
                                setTargetUrl(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                            onContinue={(newFile:string)=>{
                                setTargetUrl(newFile);
                                setRestoredImage(null);
                                setRestoredId(null);                                
                                setError(null); 
                            }}
                        />

                        <div className="page-tab-edit">   
                            
                            <div className="space-y-4 w-full max-w-lg justify-center">
                                <FormLabel number={`${num++}`} label="新的脸部照片" onCancel={()=>setSwapUrl("")} hint="必须单人、面部完整"/>
                                <InputImage src={swapUrl}/>
                                <ComboSelector selectorType="USER"
                                    onSelect = {(newFile) => setSwapUrl(newFile)}                                    
                                    onRecognizedFaces = {(faces, imageURL) => { 
                                        onRecognizeSwapImage(faces, imageURL);                                            
                                    }}
                                    />
                            </div>
                            
                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label="换脸引擎" hint="提醒：使用深度换脸引擎时，如果是多人的原始照片，多个人物相互间隔距离要远，否则容易出错"/>
                                <DropDown
                                    theme={func}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setFunc(newRoom)}
                                    themes={funcs}
                                    names={funcNames}
                                    />
                            </div>

                           {(func == "faceswapV4_S" || func == "faceswapV4_Q") && (
                            <div className="space-y-4 w-full">
                                <RadioChoice values={deepSwapTypes} selectedValue={swapType} 
                                    onSelect={(val) => {
                                        setSwapType(val)                                        
                                        if(val === "head"){
                                            alert("提醒：选择“替换头部”时，需要注意头部选区包含所有头发，否则结果会错乱！");
                                        }
                                    }}
                                    />

                                <FormLabel number={(num++).toString()} label="模仿目标照片的风格" 
                                    isChecker={true} initValue={styleType=="style"} 
                                    onValueChange={(value) => {
                                        if(styleType == "style"){
                                            setStyleType("normal");
                                        }else{
                                            setStyleType("style");
                                        }
                                    }} />                                   
                            </div>  
                            )}
                            
                            {func == "facefusion" && (
                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label={`脸型模仿力度：${strength}`} hint="力度越大脸型模仿的越像，但是也会引起整个画面与原图差异更大。"/>                                                              
                                <input type="range" value={strength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"
                                    onChange={(e) => setStrength(parseInt(e.target.value))}
                                    />                                      
                            </div>  
                            )}

                            { (func === "faceswap" || func == "faceswapV4_S" || func == "faceswapV4_Q") && (
                            <FormLabel number={`${num++}`} isChecker={true} label="美化面部输出结果" initValue={refineResult} hint="勾选后会改善换脸结果的清晰度和瑕疵。但是对于色彩模糊和清晰度很低的照片，优化面部输出结果可能导致面部区域与周围色彩、色调不一致，看起来无法完全融合"
                                onValueChange={(newVal)=>{
                                    setRefineResult(!refineResult);
                                }}
                                />   
                            )}
                            
                            <div className="w-full max-w-lg text-gray-400 text-sm mt-1">
                                <p>将本产品生成结果用于非法目的，您将承担法律责任！</p>
                            </div>
                            
                            <StartButton config={config} 
                                funcCode={"faceswap"} model={func}
                                loading={loading} showPrice={true}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredId(null);                                    
                                    setRestoredLoaded(false);
                                    setError(null);  
                                    setSideBySide(false);
                                    generate();
                                }}/>

                            <div className="w-full max-w-lg flex flex-col items-start space-y-2 pt-20">
                                {/*
                                <div className="w-full max-w-lg flex flex-row items-center justify-center">
                                    <span>想随时随地拍美照？给她/他</span>
                                    <Link href={"/modelContest"} className="underline underline-offset-2">创建一个虚拟分身</Link>
                                </div>   
                                <div className="w-full max-w-lg flex flex-row items-center justify-center">
                                    <span>不满足于只是换脸？更逼真的</span>
                                    <Link href={swapUrl ? `/superCamera?faceImage=${swapUrl}` : `/superCamera`} className="underline underline-offset-2">创意人像</Link>
                                </div>   
                                */}
                                <div className="w-full max-w-lg flex flex-row items-center justify-center text-base tracking-widest">
                                    <span>想要对视频换脸？</span>
                                    <Link href={swapUrl ? `/faceswapVideo?faceURL=${swapUrl}` : "/faceswapVideo"} className="underline underline-offset-2">视频换脸</Link>
                                </div>                            
                            </div>
                        </div>

                        
                    </div> 
                    
                </main>
            </TopFrame>
        );

};

    
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    let faceId = ctx?.query?.faceId;
    let user:any;

    console.log("session?.user?.email", session?.user?.email);
    if(session?.user?.email){
        user = await prisma.user.findUnique({ 
            where: {email: session.user.email}
        });
    }
    console.log("user:", JSON.stringify(user));
    
    let image = null;
    let face = null;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    
    if(faceId){
        face = await prisma.room.findUnique({
            where: {
                id: faceId,
            },
        });
    }

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),            
            face,
            image,
            user,
            config
        },
    };
  
}            
