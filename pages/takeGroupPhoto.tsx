import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";
import Link from "next/link";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";
import StartButton from "../components/StartButton";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import LoadingDots from "../components/LoadingDots";
import AutoSizeImage from "../components/AutoSizeImage";
import ResultButtons from "../components/ResultButtons";
import ImageView from "../components/ImageView";
import PriceTag from "../components/PriceTag";
import TaskPannel from "../components/TaskPannel";

import { callAPI, callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import * as ru from "../utils/restUtils";


export async function getServerSideProps(ctx: any) {
    // 缺省脸部照片
    const img1ID = ctx?.query?.roomId || ctx?.query?.img1Id || ctx?.query?.imageId;
    let defImg1 =  img1ID ? 
        await prisma.room.findUnique({
            where: {
                id: img1ID
            },
            select: {
                outputImage: true
            }
        }) : undefined;
    
    let defImg2 = ctx?.query?.img2Id ? 
        await prisma.room.findUnique({
            where: {
                id: ctx.query.img2Id
            },
            select: {
                outputImage: true
            }
        }) : 
        undefined;
    
    let defImg3 = ctx?.query?.img3Id ? 
        await prisma.room.findUnique({
            where: {
                id: ctx.query.img3Id
            },
            select: {
                outputImage: true
            }
        }) : 
        undefined;

    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            defImg1,
            defImg2,
            defImg3,
            config
        },
    }
}  


export default function takeGroupPhoto({ simRoomBody, defImg1, defImg2, defImg3, config }:
                                  { simRoomBody:any, defImg1:any, defImg2:any, defImg3:any, config:any}) {

    
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [preRoomId, setPreRoomId] = useState<string | null>((router?.query?.roomId || defImg1?.id || defImg2?.id || defImg3?.id) as string);

    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const [userRecognizing, setUserRecognizing] = useState<boolean>(false);    
    const [img1, setImg1] = useState<string>("");
    const [img2, setImg2] = useState<string>("");
    const [img3, setImg3] = useState<string>("");
    useEffect(() => {
        const img1URL = (defImg1?.outputImage || router.query.imageURL || router.query.img1URL || simRoomBody?.params?.params?.img1) as string;
        if(img1URL){
            fu.aliyunImageRestrictResize(img1URL).then((result)=>{
                if(result){
                    setImg1(result);
                }
            });
        }
        const img2URL = defImg2?.outputImage || router.query.img2URL as string || simRoomBody?.params?.params?.img2;
        if(img2URL){
            fu.aliyunImageRestrictResize(img2URL).then((result)=>{
                if(result){
                    setImg2(result);
                }
            });
        }
        const img3URL = defImg3?.outputImage || router.query.img3URL as string || simRoomBody?.params?.params?.img3;
        if(img3URL){
            fu.aliyunImageRestrictResize(img3URL).then((result)=>{
                if(result){
                    setImg3(result);
                }
            });
        }        
    }, []); // 空数组表示只在组件挂载时执行一次
    
    const title = router.query?.title as string || "超能合影相机";
    let defaultPrompt = router.query.prompt as string;
    const [prompt, setPrompt] = useState<string>(defaultPrompt || simRoomBody?.params?.inputText || "");
    const [sysPrompts, setSysPrompts] = useState("");
   
    // 画面比例
    let defaultDrawRatio = router.query.drawRatio as string;
    const [drawRatio, setDrawRatio] = useState<string>(defaultDrawRatio || simRoomBody?.params?.drawRatio || "169"); // 合照横屏效果好

    async function generatePhoto() {    
        if(!window){
            return alert("当前浏览器不支持！请使用Chrome, Edge, 360, Safari等主流浏览器");
        }
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(prompt){
                params.set("prompt", prompt);
            }
            if(drawRatio){
                params.set("drawRatio", drawRatio);
            }
            if(img1){
                params.set("img1URL", img1);
            }
            if(img3){
                params.set("img3URL", img3);
            }
            if(img2){
                params.set("img2URL", img2);
            }            
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
            return;
        }
        
        if(!img1 || !img2){
            alert("拍摄合影照片需要上传两张用户形象照片！");
            return;
        }

        let inputText = `${prompt}, ${sysPrompts}`;
        let realText = `A photo of only two people. 
        the person on the left is the person in <img><|image_1|></img>. 
        the person on the right is the person in <img><|image_2|></img>. 
        ${inputText}`;
        if(img3){
            realText = `A photo with three people: the person who is in the middle of <img><|image_1|></img>, the person who is in the middle of <img><|image_2|></img>, the person who is in the middle of <img><|image_3|></img>. ${inputText}`;
        }

        if(prompt.startsWith("[DEBUG:]")){
            realText = prompt.substring(8);
        }
        
        setError(null);
        setRestoredId(null);      
        setRestoredImage(null);      
        let params:any = {
            prompt: realText,
            img1:img1,
            img2:img2,
        }
        if(img3){
            params.img3 = img3;
        }
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "takeGroupPhoto", 
                preRoomId,
                params: {
                    drawRatio,
                    inputText,
                    realText, 
                    max_input_image_size: 2000,
                    params
                }
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredId(res.result.genRoomId); 
                setRestoredImage(res.result.generated);            
            }
        );
    }

    async function recognizeFace(imageURL:string, imageName:string){
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUserRecognizing(true);
        const res = await callAPI("/api/generate", {
            func:"recognizeFace", 
            params:{imageURL}
        });
        if (res.status != 200) {
            alert(imageName + "没有检测到清晰的人物，建议更换照片试试");
        }else{
            const faces = JSON.parse(res.result?.generated);
            if(faces && faces.length>1){
                alert(imageName + "检测到上传的图片多于一张人脸，这将不能正确执行拍照，请重新上传");
            }else{
                 if(faces[0].pose.yaw > 20 || faces[0].pose.yaw < -20 ||
                   faces[0].pose.pitch > 20 || faces[0].pose.pitch < -20 ||
                   faces[0].pose.roll > 20 || faces[0].pose.roll < -20){

                    alert(imageName + "建议您选择一张人物的正脸照片作为参考，这样系统才能更好了解人物相貌特征");
                }
            }            
        }

        setTimeout(() => {
            setUserRecognizing(false);
        }, 1300);        
    }

    useEffect( () => {
        if(img1 && (status == "authenticated")){
            recognizeFace(img1, "第一张照片");
        }        
    }, [img1]); 
    useEffect( () => {
        if(img2 && (status == "authenticated")){
            recognizeFace(img2, "第二张照片");
        }        
    }, [img2]); 
    useEffect( () => {
        if(img3 && (status == "authenticated")){
            recognizeFace(img3, "第三张照片");
        }        
    }, [img3]); 
    
    

    let formOrder = 1;
    
        return (
            <TopFrame config={config}>

                <main>
                    <ToolBar config={config} imageURL={img1}/>
                    
                    <div id="create" className="flex justify-between items-center w-full flex-col mt-4  mb-40">
                        
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:justify-top sm:px-2 sm:mb-5">
                            
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="第一个人物照片" onCancel={() => setImg1("")}/>
                                <InputImage src={img1}/>
                                <ComboSelector selectorType="USER"
                                    onSelect = {(newFile) => { 
                                        setImg1(newFile);
                                    }}                                    
                                    />  
                                <p className="text-gray-200 text-sm">
                                    [ 最好是清晰的正面照片，面部一定没有遮挡 ]
                                </p>                                 
                            </div>
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="第二个人物照片" onCancel={() => setImg2("")}/>
                                <InputImage src={img2}/>
                                <ComboSelector selectorType="USER"
                                    onSelect = {(newFile) => { 
                                        setImg2(newFile);
                                    }}                                    
                                    />  
                                <p className="text-gray-200 text-sm">
                                    [ 最好是清晰的正面照片，面部一定没有遮挡 ]
                                </p>                                 
                            </div>
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="第三个人物照片（可选）" onCancel={() => setImg3("")}/>
                                <InputImage src={img3}/>
                                <ComboSelector selectorType="USER"
                                    onSelect = {(newFile) => { 
                                        setImg3(newFile);
                                    }}                                    
                                    />  
                                <p className="text-gray-200 text-sm">
                                    [ 最好是清晰的正面照片，面部一定没有遮挡 ]
                                </p>                                
                            </div>
                            
                        </div>

                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={(formOrder++).toString()} label="照片比例"/>
                            <DrawRatioSelector onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} defaultRatio={"169"}/>    
                        </div>
                        
                        <div className="space-y-4 w-full max-w-lg mb-5 space-x-3 flex flex-row">
                            <FormLabel number={(formOrder++).toString()} label="描述照片背景（可选）"/>
                        </div>                            

                        <div className="space-y-4 w-full mb-5 mt-0">
                            <div className="relative inline-block w-full sm:w-2/3 mt-0">
                                <PromptArea
                                    hotWords="GROUP"
                                    userPrompt={prompt}
                                    onSysPromptChange={(sp) => setSysPrompts(sp) }
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />
                            </div>
                        </div>
                        
                        {status === "authenticated" && data && (
                        <PriceTag config={config}/>
                        )}

                        {loading ?  (
                        <LoadingButton/>                    
                        ) : (                    
                        <StartButton config={config} title="开始拍摄照片"
                            onStart={() => {
                                generatePhoto();
                            }}
                            />
                        )}
                        
                        {error && (
                        <MessageZone message={error} messageType="ERROR"/>
                        )}
                        
                        {restoredImage && restoredId && (
                        <div className="w-full flex flex-col items-center space-y-10 pt-10 mt-5 sm:mt-0">
                            <AutoSizeImage
                                alt="照片"
                                src={restoredImage}
                                onLoadingComplete={() => setRestoredLoaded(true)}
                                onClick={() => window.open(ru.getImageRest(restoredId), "_blank")}
                                />
                            <p className="text-gray-400 text-base">如果感觉照片某个人物不够像，可以进行
                                <Link className="underline underline-offset-2" href={`/faceswap?targetURL=${restoredImage}`}>
                                    AI面部学习
                                </Link>
                            </p>                            
                            <div className="flex flex-row items-center justify-center space-x-4">
                                <TaskPannel config={config} user={session?.user} roomId={restoredId}/>                                        
                            </div>                            
                            <ResultButtons mediaId={restoredId} mediaURL={restoredImage}/>
                        </div>
                        )}
                    
                    </div>
                </main>
            </TopFrame>
        );
};

// export default Home;
/*        
        if(m){
            switch(m.baseModel){
                case "zylim0702 / sdxl-lora-customize-training":
                    defaultInference = "zylim0702 / sdxl-lora-customize-model";
                    break;
                case "lucataco / realvisxl2-lora-training":
                    defaultInference = "lucataco / realvisxl2-lora-inference";
                    break;
                case "alexgenovese / train-sdxl-lora":
                    defaultInference = "alexgenovese / sdxl-lora";
                    break;
                case "lucataco / ssd-lora-training":
                    defaultInference = "lucataco / ssd-lora-inference";
                    break;
                default:
                    defaultInference = "fofr / realvisxl-v3-multi-controlnet-lora"
            }
       }
*/   
