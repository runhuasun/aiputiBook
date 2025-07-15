import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

import Image from "./wrapper/Image";
import { CompareSlider } from "../components/CompareSlider";
import Toggle from "../components/Toggle";
import ResultButtons from "../components/ResultButtons";
import AutoSizeImage from "../components/AutoSizeImage";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import LoadingRing from "../components/LoadingRing";
import FormLabel from "../components/FormLabel";
import MaskImageEditor, {extractMaskImage} from "../components/MaskImageEditor";
import ComboSelector from "../components/ComboSelector";
import ImageCanvas from "../components/ImageCanvas";
import RulerBox from "../components/RulerBox";

import {callAPI} from "../utils/apiUtils";
import * as ru from "../utils/restUtils";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import {callAPI2} from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as mt from "../utils/modelTypes";

interface ImageViewProps {
    num: number;
    
    originalPhoto?: string | undefined | null;
    originalTitle?: string;
    selectorType?: string; //="TEMPLATE" 
    albumId?: string; //={system.album.bg.id} 
    albumName?: string; // ="背景"

    restoredImage?: string | undefined | null;
    restoredId?: string | undefined | null;
    loading: boolean;
    error?: string | undefined | null;
    params?: any;

    restoredTitle?: string;
    
    supportMask?: boolean;
    needMask?: boolean;
    selectFace?: boolean;
    BCS?: boolean;
    RGB?: boolean;
    showResultButton?: boolean;
    resultButtonParams?: any;
    showDemo?:boolean;
    
    onFacesDetected?: (faces: any) => void;
    onSelectRect?:  (rect: any) => void;
    onMaskUpdate?: (maskCanvas: HTMLCanvasElement) => void;
    onCanvasUpdate?: (canvas: HTMLCanvasElement) => void;       
    onSelectRoom?: (room: any) => void;    
    onSelectImage?: (image: string) => void; 
    onContinue?: (image: string) => void; 
}

export default function ImageView({ originalTitle="原始照片", restoredTitle="重绘的照片", selectorType, albumId, albumName,
    num, originalPhoto, restoredImage, restoredId, loading, error, supportMask=false, needMask=false, selectFace=false, BCS=false, RGB=false, params, showResultButton=true, showDemo=true,
    onFacesDetected, onSelectRect, onMaskUpdate, onCanvasUpdate, onSelectRoom, onSelectImage, onContinue, resultButtonParams={continueButton:true}
}: ImageViewProps) {
    
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);

    useEffect(() => {
        if(loading || error){
            setSideBySide(false);
        }
    }, [loading, error]); 
    
    async function onRecognizeTargetImage(faces:any){
        if(!faces || faces.length==0) {
            alert("在原始照片中没有检测到清晰的人物，这有可能是您提供的照片清晰度太差，或者照片中的人物五官不清晰，亦或是头部扭动的幅度过大，AI无法准确识别用户脸部细节。强烈建议您更换原始照片再操作！！");
        }else{
            for(const f of faces){
                f.rect.x = f.rect.left;
                f.rect.y = f.rect.top;
            }
            if(faces.length>1){
                // alert("AI识别出被换脸的原始照片中多于一张人脸，请点击照片上标记的绿色或者红色方框（触屏长按方框），选择一个目标人脸进行替换");
            }
           
            const imageSize = await fu.getImageSize(originalPhoto!);
            // alert(JSON.stringify(imageSize));
            if(imageSize && imageSize.width && imageSize.height){
                const imageArea = imageSize.width * imageSize.height;
                for(const face of faces){
                    // 检测单脸占比
                    const faceArea = face.rect.width * face.rect.height;
                    const percent = Math.round((faceArea / imageArea) * 100);                    
                    if(percent > 60){
                        alert(`原始照片中脸部所占的比例太大(${percent}%)，容易导致操作失败或效果不佳。您可以继续操作，但是建议您换一张人脸在图片中比例不大于50%的照片。同时，为了优化换脸结果，强烈建议您使用高清换脸功能。`);
                    }
                }
            }
        }
        if(faces && (typeof onFacesDetected == "function")){
            onFacesDetected(faces);
        }
    }    
    return (    
        <RulerBox className={`w-full flex flex-1 flex-col rounded-lg min-h-[50vh] sm:min-h-[calc(100vh-50px)] items-center ${originalPhoto ? "justify-start" : "justify-center"}`}>
     
            <div className={`${(restoredImage && restoredLoaded) ? "mt-2" : "hidden"}`}>
                <Toggle className={`${(restoredImage && restoredLoaded) ? "mb-2" : "hidden"}`}  sideBySide={sideBySide}
                    setSideBySide={(newVal) => setSideBySide(newVal)}
                    />
            </div>    
            
            {restoredLoaded && sideBySide && (
            <CompareSlider
                original={originalPhoto!}
                restored={restoredImage!}
                />
            )}                              
        
            {!sideBySide && (
            <div className={"w-full flex flex-col sm:flex-row space-y-5 sm:space-y-0 sm:space-x-2 justify-center " + (loading ? "items-center" : "items-start") }>
               
                <div className={`w-full ${(!restoredImage && !loading && !error) ? "sm:w-auto" : "sm:w-1/2"} max-w-full min-w-sm space-y-2 flex flex-col items-center justify-center`}>
                    { supportMask ? (
                    <div className="w-full flex flex-col items-center justify-start space-y-2">
                        <FormLabel number={`${num}`} label={needMask ? "鼠标左键涂抹选择区域，右键反选" : "鼠标左键涂抹选择区域，右键反选（可以不选）"} hint="所有您想修改的地方都要尽可能涂抹，未涂抹的部分不会改变。注意边缘可以超出一些，但是不要少涂，以免造成留边"/>                            
                        {originalPhoto && (
                        <MaskImageEditor initAreas={params?.initMaskAreas}
                            imageURL={originalPhoto}
                            className="rounded-2xl sm:mt-0 mt-2 w-full h-auto"
                            onMaskUpdate={(maskCanvas)=>{
                                if(typeof onMaskUpdate === "function"){
                                    onMaskUpdate(maskCanvas);
                                }
                            }}
                            />
                        )}
                    </div>
                    ) : (selectFace || BCS || RGB) ? (
                    <div className="w-full flex flex-col items-center justify-start space-y-2">                            
                        <FormLabel number={`${num}`} label={originalTitle} hint={selectFace ? "AI会自动识别出画面中的人脸区域，并标注矩形框，点击框内区域可以选择不同人物进行操作。红框代表当前被选中的人脸区域。" : ""}/>
                        {originalPhoto && (
                        <ImageCanvas
                            imageURL={originalPhoto}
                            detectFace={selectFace ? true : false}     
                            temperature={params?.temperature}
                            bright={params?.bright}
                            contrast={params?.contrast}
                            sharpen={params?.sharpen}         
                            channels={params}
                            className="rounded-2xl sm:mt-0 mt-2 w-full h-auto"
                            onSelectRect = {(rect) => {
                                if(typeof onSelectRect === "function"){
                                    onSelectRect(rect);
                                }
                            } }    
                            onResizeCanvas = {(width, height) => {
                               // setImageWidth(width);
                               //  setImageHeight(height);
                            }}
                             onDetectedFaces = {(faces:any) => {
                                 if(typeof onRecognizeTargetImage === "function"){
                                     onRecognizeTargetImage(faces);
                                 }                                 
                             }} 
                            onCanvasUpdate={(canvas)=>{
                                if(typeof onCanvasUpdate === "function"){
                                    onCanvasUpdate(canvas);
                                }
                            }}                            
                            />                
                        )}
                    </div>
                    ) : (
                    <div className="w-full flex flex-col items-center justify-start space-y-2">                            
                        <FormLabel number={`${num}`} label={originalTitle} />                            
                        {originalPhoto && (
                        <AutoSizeImage src={originalPhoto} fullWidthImage={!!restoredImage} initShow="SCREEN" /> 
                        )}
                    </div>
                    )}
                    {!loading && (
                    <div className="w-full max-w-2xl">
                        <ComboSelector showIcon={true} showDemo={showDemo}
                            selectorType={selectorType} albumId={albumId} albumName={albumName}
                            onSelectRoom = {async (newRoom) => {
                                if(typeof onSelectRoom === "function"){
                                    onSelectRoom(newRoom);
                                }
                            }}                                               
                            onSelect = {async (newFile) => {
                                const size = await fu.getImageSize(newFile);
                                if(size.width>2000 || size.height>2000){
                                    // alert(`上传图片的宽${size.width}像素，高${size.height}。这个尺寸太大了，系统无法进行正确的处理，将自动帮您把图片做缩小处理`);
                                    newFile = await fu.resizeImage(newFile, 2000);                        
                                }
                                setRestoredLoaded(false);                                
                                if(typeof onSelectImage === "function"){
                                    onSelectImage(newFile);
                                }
                            }}
                            />
                    </div>
                    )}
                </div>                                     
        
                {(loading || error || restoredImage) && (
                <div className={ "w-full sm:w-1/2 space-y-2 flex flex-col justify-start " + (loading ? "items-center" : "items-start") }>                                                
                    {loading && !error && !restoredImage && (
                    <LoadingRing/>
                    )}
                    
                    {restoredImage && restoredId && !loading && !error && (
                    <div className="w-full flex flex-col items-center space-y-2 ">
                        <FormLabel number={`R`} label={restoredTitle}/>
                        <AutoSizeImage
                            src={restoredImage}
                            fullWidthImage={true}
                            imageId={restoredId}
                            onLoadingComplete={() => setRestoredLoaded(true)}
                            />                                        
                        {showResultButton && restoredImage && restoredId && (
                        <ResultButtons {...resultButtonParams} inpaintButtton={resultButtonParams?.inpaintButton || false} mediaURL={restoredImage} mediaId={restoredId} 
                              {...(!resultButtonParams.continueButton ? {} : {
                                onContinue: async () => {
                                  const size = await fu.getImageSize(restoredImage);
                                  let newFile = restoredImage;
                            
                                  if (size.width > 2000 || size.height > 2000) {
                                    const resizedFile = await fu.resizeImage(newFile, 2000);
                                    if (resizedFile) {
                                      newFile = resizedFile;
                                    }
                                  }
                            
                                  setRestoredLoaded(false);
                                  if (typeof onContinue === "function") {
                                    onContinue(newFile);
                                  }
                                }
                              })}                            
                            />
                        )}
                    </div>                                                                
                    )}
                </div>
                )}
            </div>
            )}
            
            {error && (
            <MessageZone message={error} messageType="ERROR"/>
            )}     
        
        </RulerBox>       
    );
}

