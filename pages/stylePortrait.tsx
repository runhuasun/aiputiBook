import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { useSession, signIn } from "next-auth/react";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import Toggle from "../components/Toggle";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptSelector from "../components/PromptSelector";
import PromptArea from "../components/PromptArea";
import MessageZone from "../components/MessageZone";
import AutoSizeImage from "../components/AutoSizeImage";
import ResultButtons from "../components/ResultButtons";

import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



export async function getServerSideProps(ctx: any) {
    const styleId = ctx.query.styleId || ctx.query.roomId;
    let styleImageURL;
    if(styleId){
        const room = await prisma.room.findUnique({
            where: { id: styleId },
            select: {outputImage: true}
        });
        styleImageURL = room?.outputImage;
    }

    monitor.logUserRequest(ctx);    
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            styleImageURL,
            config
        },
    }
}  


const cameraTypeNames = new Map( [
//    ["luma-photon", "全新Luma/photon模型"],
    ["stylePortrait", "分别控制风格和姿态"],
//    ["ipAdapter_pose_style", "同时风格和姿态"],
//    ["ipAdapter_style", "只控制风格"],
    ] );
const cameraTypes = Array.from(cameraTypeNames.keys());


export default function styleCamera({ simRoomBody, styleImageURL, config }: { simRoomBody:any, styleImageURL:string, config:any}) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router.query.styleId as string || router?.query?.roomId as string);
    
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output );
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);

    const [cameraType, setCameraType] = useState<string>(simRoomBody?.params?.func || "stylePortrait");
    const [poseImage, setPoseImage] = useState<string>(simRoomBody?.params?.params?.base_image || simRoomBody?.params?.params?.image || "");
    const [userImage, setUserImage] = useState<string>((router.query.imageURL || simRoomBody?.params?.params?.identity_image || simRoomBody?.params?.face_image || "") as string);
    const [styleImage, setStyleImage] = useState<string>(simRoomBody?.params?.params?.styleImage || simRoomBody?.params?.params?.image || styleImageURL);
    
    const title = router.query?.title as string || "超能模拟相机";
    let defSeed = router.query.seed as string;  
    const [seed, setSeed] = useState<number>(simRoomBody?.params?.params?.seed || (defSeed ? parseInt(defSeed) : 0));    
    const [prompt, setPrompt] = useState<string>((router.query.prompt || simRoomBody?.params?.inputText || "") as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [sysPrompts, setSysPrompts] = useState<string>("");
    const [drawRatio, setDrawRatio] = useState(simRoomBody?.params?.drawRatio || "916");
    
    const [filter, setFilter] = useState<any>();


    function isPositiveInteger(str: string): boolean {
        // 使用正则表达式匹配字符串是否为正整数，^表示开头，\d+表示匹配一个或多个数字，$表示结尾
        const regExp = /^\d+$/;
        return regExp.test(str);
    }
   
    async function generatePhoto() {    
        if(!userImage && cameraType=="stylePortrait"){
            alert("拍摄AI照片需要上传一张用户形象照片！");
            return;
        }
//        if(!poseImage){
//            alert("拍摄AI照片需要指定一个模仿的姿态照片！");
//            return;
//        }
        if(!styleImage){
            alert("拍摄AI照片需要指定一个画面风格照片！");
            return;
        }        

        let inputText = (prompt+sysPrompts); 
        let realText = inputText;
        if(sysPrompts && sysPrompts.trim() == ""){
            realText += ", detailed faces,  highres, RAW photo 8k uhd, modelshot, elegant, realistic, movie, intricate details,";
        }
        
        setError(null);
        setRestoredId(null);      
        setRestoredImage(null);      
            
        let body:any = {};
        switch(cameraType){
            case "luma-photon":
            case "stylePortrait":
                body = {
                    cmd: "stylePortrait",
                    preRoomId,                    
                    params: {
                        func: cameraType, 
                        drawRatio,
                        inputText: inputText,                    
                        params: {
                            prompt: realText,
                            base_image: poseImage || styleImage,
                            base_image_strength: poseImage ? 0.2 : 0,                            
                            composition_image: poseImage || styleImage,
                            composition_image_strength: 1,
                            style_image: styleImage,
                            style_image_strength: 1,
                            identity_image: userImage,
                            identity_image_strength: 1,
                            depth_image: poseImage || styleImage,
                            depth_image_strength: poseImage ? 0.2 : 0,
                            seed:seed,
                        }
                    }
                };
                break;
            case "ipAdapter_pose_style":
            case "ipAdapter_style":
                body = {
                    cmd: "stylePortrait",
                    preRoomId,                    
                    params: {
                        func: "ipAdapter", 
                        drawRatio,                
                        face_image: userImage,
                        inputText: inputText,                        
                        params: {
                            prompt: realText,
                            image: styleImage || poseImage,
                            ip_adapter_weight_type: (cameraType == "ipAdapter_pose_style") ? "style and composition" : "style transfer",
                            output_format: "jpg",
                            seed,
                        }
                    }
                };
                break;
        }
        const res = callAPI2(
            "/api/workflowAgent2",
            body,
            "拍摄",
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

                <main>                
                    <ToolBar config={config} imageURL={userImage}/>
                    
                    <div id="create" className="flex justify-between items-center w-full flex-col space-y-4 mt-4 ">
                        
                        <div className="space-y-4 sm:space-y-0 sm:space-x-4 w-full flex flex-col sm:flex-row sm:justify-top px-1 pb-5 sm:pb-10 sm:px-2 mb-5">
                            
                            <div className="page-tab space-y-4 w-full sm:w-1/3  pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number="1" label="用户形象照片" onCancel={() => setUserImage("")}/>                                                              
                                <InputImage alt="图片素材" src={userImage}/>
                                <ComboSelector  selectorType="USER"
                                    onSelect = {(newFile) => setUserImage(newFile)}
                                    onRecognizedFaces = {(faces) => {
                                        if(faces && faces.length>1){
                                            alert("检测到上传的图片多于一张人脸，这将不能正确执行拍照，请重新上传");
                                        }else{
                                            setFilter(faces[0]);
                                        }
                                    }}                                   
                                    />    
                            </div>

                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number="2" label="写真风格样例照片" onCancel={() => setStyleImage("")}/>                                                                 
                                <InputImage alt="图片素材" src={styleImage}/>
                                <ComboSelector selectorType="STYLE"
                                    onSelectRoom = {async (newRoom) => {
                                        setPreRoomId(newRoom?.id);
                                    }}                                       
                                    onSelect = {(newFile) => setStyleImage(newFile)} />    
                            </div>
                            
                            <div className="page-tab space-y-4 w-full sm:w-1/3  pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number="3" label="选择拍照姿势（可选）" onCancel={() => setPoseImage("")}/>                                                              
                                <InputImage src={poseImage}/>
                                <ComboSelector selectorType="MODEL_POSE" 
                                    onSelect = {(newFile) => {
                                        setPoseImage(newFile);
                                    }}
                                />                                 
                            </div>
                            
                        </div>

                        {/*
                        <div className="space-y-4 w-full max-w-lg">
                            <FormLabel number="4" label="选择AI模仿相机"/>
                            <DropDown
                                theme={cameraType}
                                // @ts-ignore
                                setTheme={(newRoom) => {
                                    setCameraType(newRoom);
                                }}
                                themes={cameraTypes}
                                names={cameraTypeNames}
                                />
                        </div>
                        */}

                        {cameraType.startsWith("ipAdapter") && (
                        <div className="space-y-4 w-full max-w-lg">
                            <FormLabel number="5" label="照片比例"/>
                            <DrawRatioSelector onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                        </div>
                        )}
                        
                        <div className="flex flex-col items-center space-y-4 w-full">
                            <div className="space-y-4 space-x-3 w-full max-w-lg flex flex-row items-center">
                                <FormLabel number={cameraType == "ipAdapter" ? "6" : "5"} label="照片构图要求"/>
                                <PromptSelector onSelect = {(newFile) => setPrompt(newFile.formular)} />
                            </div>                            
    
                            <div className="space-y-4 w-full mb-5 mt-0">
                                <div className="relative inline-block w-full sm:w-2/3 mt-0">
                                    <PromptArea
                                        hotWords="PORTRAIT_ALL"
                                        userPrompt={prompt}
                                        onSysPromptChange={(sp) => setSysPrompts(sp) }
                                        onUserPromptChange={(up) => setPrompt(up) }
                                        />
                                </div>
                            </div>                       
                        </div>
    
                       <StartButton config={config} onStart={()=> generatePhoto()} title="开始拍摄照片" showPrice={true} loading={loading}/>
                    
                        {error && (
                        <MessageZone message={error} messageType="ERROR"/>
                        )}
                            
                       {restoredImage && restoredId && (
                        <div className="w-full flex flex-col space-y-10 items-center pt-10 mt-5 sm:mt-0">
                            <AutoSizeImage src={restoredImage} onLoadingComplete={() => setRestoredLoaded(true) } imageId={restoredId} />
                            <ResultButtons mediaId={restoredId} mediaURL={restoredImage!}/>
                        </div>
                       )}
                    </div>
                
                </main>
            </TopFrame>
        );
   
};

// export default Home;
