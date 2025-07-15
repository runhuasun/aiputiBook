import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import AlbumRoomSelector from "../components/AlbumRoomSelector";
import Toggle from "../components/Toggle";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";


import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { config } from "../utils/config";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import {system} from "../utils/enums";

const funcs: string[] = [
    "faceswapHD",
    "faceswapV4_S",        
    ];
const funcNames = new Map([
    ["faceswapHD", "快速尝试新发型效果（5-10秒）"],
    ["faceswapV4_S", "精准渲染新发型效果（1-2分钟）"],
]);


const genderNames = new Map([
    [system.album.hairWoman.id, system.album.hairWoman.name],
    [system.album.hairMan.id, system.album.hairMan.name],
    [system.album.hairGirl.id, system.album.hairGirl.name],
    [system.album.hairBoy.id, system.album.hairBoy.name],
]);
const genders: string[] = Array.from(genderNames.keys());

export default function hairDesign({simRoomBody, image, user, face, config }: { simRoomBody:any, image: Room, user:any, face:Room, config:any }) {
    
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
    
    const [error, setError] = useState<string | null>(null);
    const [swapUrl, setSwapUrl] = useState((router.query.imageURL || router.query.faceURL || simRoomBody?.params?.swap_image || face?.outputImage || "") as string );
    const [targetUrl, setTargetUrl] = useState(simRoomBody?.params?.target_image || router.query.targetURL as string || image?.outputImage || "");
    const [func, setFunc] = useState(simRoomBody?.params?.func || "faceswapHD");
    const [gender, setGender] = useState(simRoomBody?.params?.gender || system.album.hairWoman.id);
    let title="发型匹配中心";
    let num=1;
    
 
    async function generate() {
        if(!window){
            return;
        }
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(swapUrl){
                params.set("faceURL", swapUrl);
            }
            if(targetUrl){
                params.set("targetURL", targetUrl);
            }
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());            
            return;
        }

        try{
            setLoading(true);
            
            let swapfunc = func;

            if(!targetUrl){
                return alert("请选择一个发型");                                                                       
            }
            if(!swapUrl){
                return alert("请上传一张您的正面近照！");
            }      
            const swapSize = await fu.getImageSize(swapUrl);
            if(swapSize.width < 256 || swapSize.height < 256){
                return alert("为了保证效果，您的照片宽度和长度都不要小于256像素。并且脸部在照片中的占比不要大于50%。");
            }
    
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "hairDesign", 
                    preRoomId,
                    params : {
                        func: swapfunc,
                        swap_image:swapUrl, 
                        target_image:targetUrl,
                        gender,
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
                alert("在您的照片中没有检测到清晰的人物，这有可能是您提供的照片清晰度太差，或者照片中的人物五官不清晰，亦或是头部扭动的幅度过大，AI无法准确识别用户脸部细节。强烈建议您更换新的脸部照片再操作！！");
            }else{
                //alert("2"+faces.length);
                if(faces.length>1){
                    alert("检测到上传的人脸图片多于一张人脸，这很可能导致AI系统不能正确执行换脸操作。建议重新上传一张只包含一个人物的照片。");
                }else{
                    // 判断性别和年龄
                    if(faces[0].gender == 0){ //女性
                        if(faces[0].age < 12){
                            setGender(system.album.hairGirl.id);    
                        }else{
                            setGender(system.album.hairWoman.id);
                        }
                    }else{
                        if(faces[0].age < 12){
                            setGender(system.album.hairBoy.id);    
                        }else{
                            setGender(system.album.hairMan.id);
                        }
                    }
                    
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
                        alert(`您的照片中，人物的${faceWarn}。建议您选择一张正脸照片，这样系统才能更好学习人物相貌特征`);                    
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
                            alert(`您的照片中面部所占的比例太大(${percent}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例不大于50%的照片。`);
                        }
                        if(percent < 2.1){
                            alert(`您的照片中面部所占的比例太小(${percent || 1}%)，容易导致换脸失败或效果不佳。您可以继续操作，但是建议换一张人脸在照片中比例不小于5%的照片。`);
                        }
                    }
                }            
            }
       // }
    }
    
    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={swapUrl} restoredImage={restoredImage} restoredId={restoredId} />

                <div className="page-container">

                    <div className="page-tab-image-create">
                        
                        <div className="space-y-3 w-full justify-center">
                            <FormLabel number={`${num++}`} label="您的照片（包含清晰完整面部）" onCancel={()=>setSwapUrl("")}/>
                            <InputImage src={swapUrl}/>
                            <ComboSelector selectorType="USER" showDemo={false}
                                onSelect = {(newFile) => setSwapUrl(newFile)}                                    
                                onRecognizedFaces = {(faces, imageURL) => { 
                                    onRecognizeSwapImage(faces, imageURL);                                            
                                }}
                                />
                        </div>                            

                        <div className="space-y-4 w-full ">
                            <FormLabel number={`${num++}`} label="选择发型种类"/>
                            <DropDown theme={gender} themes={genders} names={genderNames}
                                // @ts-ignore
                                setTheme={(newTheme) => setGender(newTheme)}
                                />
                        </div>
                        
                        <div className="space-y-3 w-full justify-center">
                            <FormLabel number={`${num++}`} label="选择发型" onCancel={()=>setTargetUrl("")}/>
                            <InputImage src={targetUrl} />
                            <AlbumRoomSelector title="选择您的新发型" albumId={gender}
                                onSelectFile = {(newFile) => setTargetUrl(newFile)}                                    
                                />
                        </div>

                        <Toggle className="flex flex-col items-center mt-4"
                            sideBySide={func==="faceswapV4_S"} leftText="快速预览发型效果" rightText="精确渲染发型效果"
                            setSideBySide={(newVal) => {
                                setFunc(newVal ? "faceswapV4_S" : "faceswap"); 
                            }} />    
                        
                        <StartButton config={config} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredId(null);                                    
                                setRestoredLoaded(false);
                                setError(null);  
                                setSideBySide(false);
                                generate();
                        }}/>

                        <div className="w-full max-w-lg flex flex-col items-start space-y-2 pt-20">
                            <div className="w-full max-w-lg flex flex-row items-center justify-center tracking-widest">
                                <span>需要更改当前照片的发型？</span>
                                <Link href={`/changeHair?imageURL=${swapUrl}`} className="underline underline-offset-2">改变发型</Link>
                            </div>                            
                        </div>                             
                    </div>

                    <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"hairDesign"}}  />
                  
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
