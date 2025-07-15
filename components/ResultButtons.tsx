import React, { useEffect, useState } from 'react';
import Link from "next/link";
import {
  ArrowPathIcon,
  ArrowRightCircleIcon,
  PencilIcon,
  FilmIcon,
  FaceSmileIcon,
  SparklesIcon,
  ScissorsIcon,
  MagnifyingGlassPlusIcon,
  AdjustmentsHorizontalIcon,
  SwatchIcon,
  UserCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid';
import { Icon } from '@iconify/react';

import AlbumSelector from "../components/AlbumSelector";

import downloadPhoto from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as ru from "../utils/restUtils";
import * as enums from "../utils/enums";
import {safeWindowOpen} from "../utils/fileUtils";


interface Props {
    funcName?: string;
    mediaId: string;
    mediaURL: string;
    onDownload?: ()=> void;
    onDetail?: ()=> void;
    onRestart?: ()=> void;    
    onContinue?: ()=> void;    
    className?: string;
    mediaType?: string;
    
    editImageButton?: boolean;
    inpaintButtton?: boolean;
    changeClothButton?: boolean;
    changeHairButton?:boolean;
    zoomInButton?:boolean;
    genVideoButton?:boolean;
    decoratePhotoButton?:boolean, 
    changeExpressionButton?:boolean,
}


export default function ResultButtons(
    {funcName="编辑", mediaId, mediaURL, mediaType="IMAGE", onDownload, onDetail, onRestart, onContinue, className="", 
     editImageButton, decoratePhotoButton=false, changeExpressionButton=false, inpaintButtton=true, changeClothButton=false, changeHairButton=false, 
     zoomInButton=false, genVideoButton=true}:Props){
    
    const [mediaName, setMediaName] = useState<string>("图片");

    useEffect( () => {
        switch(mediaType){
            case "AUDIO": setMediaName("音频"); break;            
            case "IMAGE": setMediaName("图片"); break;
            case "VIDEO": setMediaName("视频"); break;
            default: setMediaName("图片");
        }
    }, [mediaType]);     
 
    async function addRoomToAlbum(mediaId:any, album:any){
        const res = await callAPI("/api/albumManager", { 
            cmd:"ADDROOM", id:album.id, roomId:mediaId
        });
        if (res.status !== 200) {
            alert(res.result);
        } else {
            alert(`图片已经被加到相册《${album.name}》`);
        }
    }  
    const buttonStyle = "button-main text-xs sm:text-sm rounded-full px-3 py-2 flex items-center gap-2"
    return (
        <div className={ `w-full flex flex-row items-center justify-center space-x-3 text-sm ${className}` }>
            {mediaType === "IMAGE" && onRestart && (            
              <button
                onClick={() => typeof onRestart === "function" && onRestart()}
                className={`${buttonStyle}`}
              >
                <ArrowPathIcon className="w-5 h-5 text-inherit" />
                重新开始
              </button>  
            )}
            
            {onContinue && (            
              <button
                onClick={() => typeof onContinue === "function" && onContinue()}
                className={`${buttonStyle} button-gold `}
              >
                <ArrowRightCircleIcon className="w-5 h-5 text-inherit" />
                继续{funcName}
              </button>  
            )}            
            
            {mediaType === "IMAGE" && inpaintButtton && !onContinue && (
              <button
                onClick={() => safeWindowOpen(`/inpaint?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle} `}
              >
                <PencilIcon className="w-5 h-5 text-inherit" />
                局部修改
              </button>  
            )}
            
            {mediaType === "IMAGE" && genVideoButton && (
              <button
                onClick={() => safeWindowOpen(`/createVideo?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <FilmIcon className="w-5 h-5 text-inherit" />
                生成视频
              </button>  
            )}
            
            {mediaType === "IMAGE" && changeExpressionButton && (
              <button
                onClick={() => safeWindowOpen(`/changeExpression?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <FaceSmileIcon className="w-5 h-5 text-inherit" />
                调整表情
              </button>  
            )}            
            
            {mediaType === "IMAGE" && decoratePhotoButton && (
              <button
                onClick={() => safeWindowOpen(`/decoratePhoto?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <SparklesIcon className="w-5 h-5 text-inherit" />
                美颜美型
              </button>  
            )}   
            
            {mediaType === "IMAGE" && editImageButton && (
              <button
                onClick={() => safeWindowOpen(`/editImage?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <ScissorsIcon className="w-5 h-5 text-inherit" />
                裁剪尺寸
              </button>  
            )}
            
            {mediaType === "IMAGE" && zoomInButton && (
              <button
                onClick={() => safeWindowOpen(`/zoomIn?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <MagnifyingGlassPlusIcon className="w-5 h-5 text-inherit" />
                修复放大
              </button>  
            )}
            
            {/*!onContinue && mediaType === "IMAGE" && (
              <button
                onClick={() => {
                  if (typeof onDetail === "function") {
                    onDetail();
                  } else {
                    if (mediaType === "IMAGE") safeWindowOpen(`/editImage?roomId=${mediaId}`, "_blank");
              //      if (mediaType === "VIDEO") safeWindowOpen(`/videoRetalk?roomId=${mediaId}`, "_blank");
                  }
                }}
                className={`${buttonStyle}`}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5 text-inherit" />
                {`编辑${mediaName}`}
              </button>  
            )*/}
            
            {mediaType === "IMAGE" && changeClothButton && (
              <button
                onClick={() => safeWindowOpen(`/changeCloth?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <SwatchIcon className="w-5 h-5 text-inherit" />
                更换服装
              </button>  
            )}
            
            {mediaType === "IMAGE" && changeHairButton && (
              <button
                onClick={() => safeWindowOpen(`/changeHair?roomId=${mediaId}`, "_blank")}
                className={`${buttonStyle}`}
              >
                <UserCircleIcon className="w-5 h-5 text-inherit" />
                更换发型
              </button>  
            )}

            {mediaType === "VIDEO" && (
            <div className={ `flex flex-row items-center justify-center space-x-3 ` }>
                <button
                    onClick={() => {
                        window.open(`/createVideo?videoURL=${mediaURL}`, "_blank");
                    }}
                    className={`${buttonStyle}`}
                    >
                    <Icon icon={"mdi:play-box-multiple"} className="w-5 h-5 text-inherit text-xs"/>                  
                    视频续拍
                </button>  
                <button
                    onClick={() => {
                        window.open(`/videoMixAudio?videoURL=${mediaURL}`, "_blank");
                    }}
                    className={`${buttonStyle}`}
                    >
                    <Icon icon={"mdi:music-note"} className="w-5 h-5 text-inherit text-xs"/>                                    
                    视频配乐
                </button>  
                <button
                    onClick={() => {
                        window.open(`/videoRetalk?videoURL=${mediaURL}`, "_blank");
                    }}
                    className={`${buttonStyle}`}
                    >
                    <Icon icon={"mdi:microphone"} className="w-5 h-5 text-inherit text-xs"/>                                    
                    人物配音
                </button> 
                <button
                    onClick={() => {
                        window.open(`/videoMixAIAudio?videoURL=${mediaURL}`, "_blank");
                    }}
                    className={`${buttonStyle}`}
                    >
                    <Icon icon={"mdi:robot-happy-outline"} className="w-5 h-5 text-inherit text-xs"/>                                    
                    智能音效
                </button> 
                <button
                    onClick={() => {
                        window.open(`/faceswapVideo?videoUrl=${mediaURL}`, "_blank");
                    }}
                    className={`${buttonStyle}`}
                    >
                    <Icon icon={"mdi:face-man-shimmer"} className="w-5 h-5 text-inherit text-xs"/>                                    
                    视频换脸
                </button>                                 
            </div>  
            )}
            
            <AlbumSelector 
              title="加入相册" 
              className={buttonStyle}
              onSelect={(album) => album && addRoomToAlbum(mediaId, album)}
            />   
            
            <button
              onClick={() => {
                if (typeof onDownload === "function") {
                  onDownload();
                } else {
                  downloadPhoto(mediaURL!);
                }
              }}
              className={`${buttonStyle}`}
            >
              <ArrowDownTrayIcon className="w-5 h-5 text-inherit" />
              {`下载${mediaName}`}
            </button>  
            
        </div>        
    );
}
