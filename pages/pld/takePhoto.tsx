import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import TextareaAutosize from "react-textarea-autosize";
import Head from "next/head";

import prisma from "../../lib/prismadb";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { User,Room, Model } from "@prisma/client";
import { GenerateResponseData } from "../api/generate";

import DropDown from "../../components/DropDown";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import Genhis from "../../components/Genhis";

import PromptArea from "../../components/PromptArea";
import LoginPage from "../../components/LoginPage";
import Uploader, {mimeTypes} from "../../components/Uploader";
import ComboSelector from "../../components/ComboSelector";
import PoseSelector from "../../components/PoseSelector";
import BGSelector from "../../components/BGSelector";
import AlbumSelector from "../../components/AlbumSelector";
import ModelSelector from "../../components/ModelSelector";
import DrawRatioSelector from "../../components/DrawRatioSelector";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import PriceTag from "../../components/PriceTag";
import LoadingButton from "../../components/LoadingButton";
import MessageZone from "../../components/MessageZone";
import PromptSelector from "../../components/PromptSelector";
import FormLabel from "../../components/FormLabel";
import SquigglyLines from "../../components/SquigglyLines";
import AutoSizeImage from "../../components/AutoSizeImage";
import StartButton from "../../components/StartButton";
import CameraCapture from "../../components/CameraCapture";
import Image from "../../components/wrapper/Image";

import downloadPhoto from "../../utils/fileUtils";
import { roomType, rooms, themeType, themes, themeNames, roomNames  } from "../../utils/loraTypes";
import {channelType, channels, channelNames  } from "../../utils/channels";
import {getThumbnail} from "../../utils/fileUtils";
import {callAPI} from "../../utils/apiUtils";
import {getImageSize} from "../../utils/fileUtils";
import * as ru from "../../utils/restUtils";
import { config, system } from "../../utils/config";
import * as debug from "../../utils/debug";
import * as enums from "../../utils/enums";


export default function takePhoto() {
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [userRecognizing, setUserRecognizing] = useState<boolean>(false);    
    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [filter, setFilter] = useState<any>();

    const [faceImage, setFaceImage] = useState<string>();
    const [refImage, setRefImage] = useState<string>(router.query?.refImage as string);
    

    const [prompt, setPrompt] = useState<string>("");
    const [sysPrompts, setSysPrompts] = useState("");
    const [userDesc, setUserDesc] = useState<string>("");
    const [loraPrompt, setLoraPrompt] = useState<string>("");
    
    const cameraType = (router.query.cameraType as string) || "QUICK"; // QUICK, MODEL
    const [drawRatio, setDrawRatio] = useState<string>("916");
    const modelId = router.query.modelId as string;
  
    function isPositiveInteger(str: string): boolean {
        // 使用正则表达式匹配字符串是否为正整数，^表示开头，\d+表示匹配一个或多个数字，$表示结尾
        const regExp = /^\d+$/;
        return regExp.test(str);
    }
   
    async function generatePhoto() {    

        let realText = `${userDesc}, ${loraPrompt}, ${prompt}, ${sysPrompts}`;
        let inputText = realText;        
        if(sysPrompts && sysPrompts.trim() == ""){
            realText += ", detailed faces,  highres, RAW photo 8k uhd, modelshot, elegant, realistic, movie, intricate details,";
        }
        
        setError(null);
        setRestoredId(null);      
        setRestoredImage(null);      
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);

        try{
            const res = await callAPI("/api/pld", {
                cmd: "TAKE_PHOTO_" + cameraType, 
                timeStamp: Date.now(),
                uid: "cm04q8syx000tkxkvqyb68kt1",
                ukey: "$2b$10$jo0z0ISZq04ZWmJfnjge1e6IXO0hCF1HH1N7dKLO4mnhjC6CEsc/C",
                params: {
                    modelId,
                    faceImage,
                    refImage, 
                    drawRatio:"916", 
                }
            });
            if (res.status !== 200) {
                if(res.status == enums.resStatus.waitForResult){
                    alert("后台服务器需要较长时间运行，请稍后到[我的空间]-[我的照片]里查看结果。");    
                    window.open("/dashboard", "_blank");
                }else{
                    alert(JSON.stringify(res.result));
                    setError(JSON.stringify(res.result));
                }
            } else {
                setRestoredId(res.result.genRoomId); 
                setRestoredImage(res.result.generated);            
            }
        }catch(e){
            const errMsg = JSON.stringify(e);
            if(errMsg && errMsg!="{}"){
                alert(errMsg);
                setError(errMsg);
            }else{
                alert("后台服务器需要较长时间运行，请稍后到[我的空间]-[我的照片]里查看结果。");    
                window.open("/dashboard?segment=PHOTO&page=1");                
            }
        }finally{
            setTimeout(() => {
                setLoading(false);
            }, 1300);
        }
    }

    async function recognizeFace(imageURL:string){
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUserRecognizing(true);
        const res = await callAPI("/api/generate", {
            func:"recognizeFace", 
            params:{imageURL}
        });
        if (res.status != 200) {
            alert("没有检测到清晰的人物，建议更换照片试试");
        }else{
            const faces = JSON.parse(res.result?.generated);
            if(faces && faces.length>1){
                alert("检测到上传的图片多于一张人脸，这将不能正确执行拍照，请重新上传");
            }else{
                setFilter(faces[0]);

                // 根据识别的人脸修改用户描述
                let desc = "一位";
                switch(faces[0].gender){
                    case 0: 
                        if(faces[0].age <= 3){
                            desc += "女婴";                                
                        }else if(faces[0].age >= 4 && faces[0].age <= 8){
                            desc += "小女孩";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "女孩";
                        }else if(faces[0].age >= 13 && faces[0].age <= 16){
                            desc += "少女";
                        }else if(faces[0].age >= 17 && faces[0].age <= 40){
                            desc += "年轻女性";
                        }else if(faces[0].age >= 41 && faces[0].age <= 60){
                            desc += "中年女士";
                        }else if(faces[0].age >= 61 && faces[0].age <= 80){
                            desc += "老年女士";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "老奶奶";
                        }

                        if(faces[0].beauty > 80){
                            desc += ", 女模特";
                        }else if(faces[0].beauty > 70){
                            desc += ", 非常漂亮";
                        }else if(faces[0].beauty > 50){
                            desc += "，美女";
                        }
                        break;
                    case 1:
                        if(faces[0].age <= 3){
                            desc += "男婴";                                
                        }else if(faces[0].age >= 4 && faces[0].age <= 8){
                            desc += "小男孩";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "男孩";
                        }else if(faces[0].age >= 13 && faces[0].age <= 16){
                            desc += "大男生";
                        }else if(faces[0].age >= 17 && faces[0].age <= 40){
                            desc += "青年男性";
                        }else if(faces[0].age >= 41 && faces[0].age <= 60){
                            desc += "中年男士";
                        }else if(faces[0].age >= 61 && faces[0].age <= 80){
                            desc += "老年男士";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "老奶奶";
                        }

                        if(faces[0].beauty > 80){
                            desc += "，男模特";
                        }else if(faces[0].beauty > 70){
                            desc += "，大帅哥";
                        }else if(faces[0].beauty > 50){
                            desc += "，帅哥";
                        }
                }

                desc += `，${faces[0].age}岁的外貌`;
                
                if(faces[0].hat == 1){
                    desc += "，戴帽子";
                }

                if(faces[0].glass == 1){
                    desc += "，戴眼镜";
                }
                if(faces[0].glass == 2){
                    desc += "，戴墨镜";
                }

                if(faces[0].pose.yaw > 20 || faces[0].pose.yaw < -20 ||
                   faces[0].pose.pitch > 20 || faces[0].pose.pitch < -20 ||
                   faces[0].pose.roll > 20 || faces[0].pose.roll < -20){

                    alert("建议您选择一张人物的正脸照片作为参考，这样系统才能更好了解人物相貌特征");
                }

                setUserDesc(desc);                
            }            
        }

        setTimeout(() => {
            setUserRecognizing(false);
        }, 1300);        
    }

    
    useEffect( () => {
        if(faceImage){
            setUserDesc("");                    
            recognizeFace(faceImage);
        }        
    }, [faceImage]); 
    
   // useEffect( () => {
   // }, []);   


    function printPhoto(image:string){
        if (image) {
            // 创建新窗口或使用 iframe
            let printWindow = window.open('', '_blank', 'height=800,width=1400');
            printWindow?.document.write(`
            <html>
                <head>
                <title>Print</title>
                <style>
                    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                    img { display: block; width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <img src="${image}" alt="Print Image">
            </body>
            </html>
        `);            
            printWindow?.document.close();
            printWindow?.focus();

            // 打印内容和关闭新窗口的延时
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 1000);
        } else {
            console.error('Image not found');
        }
    }    

 
    return (
        <div className="flex  mx-auto flex-col items-center justify-center min-h-screen">
          
            <main>   
                <div id="create" className="flex justify-between items-center w-full flex-col mt-4  mb-40">

                    {!restoredImage && (
                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:justify-top sm:px-2 sm:mb-5">
                        <div className="page-tab space-y-4 w-full pb-4 sm:pb-10 px-4 rounded-xl">
                            <FormLabel label="上传用户形象照片" onCancel={() => setFaceImage("")}/>
                            <div className="w-full flex flex-col items-center">
                                {faceImage && (
                                <Image alt="图片素材" src={faceImage} className="rounded-2xl relative sm:mt-0 mt-2 w-full"/>
                                )}
                            </div>
                            <CameraCapture title="拍照" onSelect = {(newFile) => setFaceImage(newFile?.url)} isOpened={true} autoCapture={true} />  
                            <FormLabel label={userRecognizing ? "用户形象识别中......" : "描述用户形象（可选）"}/>
                            <PromptArea
                                hotWords="USER_DESC"
                                hasAdvanceButton={false}
                                userPrompt={userDesc}
                                readOnly={userRecognizing}
                                onUserPromptChange={(up) => setUserDesc(up) }
                                />
                        </div>
                    </div>
                    )}

                    {loading && (
                    <LoadingButton/>                    
                    )}
                    {!restoredImage && !loading && (                    
                    <div className= "flex flex-col">
                        <div className={`w-full flex flex-row items-center justify-center space-x-10 text-base`}>
                            {faceImage && refImage && (
                            <button  className="button-gold rounded-full px-4 sm:px-8 py-3"
                                onClick={() => {
                                    generatePhoto();
                                }}
                                >
                                开始拍摄照片
                            </button>                  
                            )}
                            <button
                                onClick={() => {
                                    window.location.href="/pld/modelSamples?modelId=" + modelId;
                                }}
                                className="button-main rounded-full px-4 sm:px-8 py-3"
                                >
                                重新选择套系
                            </button>                                  
                        </div>
                    </div>
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

                        <div className={`w-full flex flex-row items-center justify-center space-x-5 text-base`}>
                            <button
                                onClick={() => {
                                    setRestoredImage(null);
                                    setRestoredId(null);                                    
                                    setRestoredLoaded(false);
                                    setError(null);                               
                                    window.location.href="/pld/modelSamples?modelId=" + modelId;
                                }}
                                className="button-gold rounded-full px-4 sm:px-8 py-3"
                                >
                                重新选择套系
                            </button>  
                            
                            <button
                                onClick={() => {
                                    printPhoto(restoredImage);
                                }}
                                className="button-gold rounded-full px-4 sm:px-8 py-3"
                                >
                                打印照片
                            </button>  
                        </div>                                
                        
                    </div>
                    )}
                
                </div>
            </main>
        </div>
    );
 
};

// export default Home;
