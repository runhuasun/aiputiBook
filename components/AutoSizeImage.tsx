import React, { useRef, useState, useEffect } from 'react';
import { Component } from 'react';
import Link from "next/link";

import Image from "./wrapper/Image";

import * as debug from "../utils/debug";
import * as fu from "../utils/fileUtils";
import {isMobile} from "../utils/deviceUtils";
import * as ru from "../utils/restUtils";


interface AutoSizeImageProps {
    src: string;
    alt?: string;
    className?: string;
    fullWidthImage?: boolean;
    onLoadingComplete?: (size:any) => void;  
    onClick?: () => void;  
    imageId?: string;
    initShow?: string;
}

export default function AutoSizeImage({ src, alt, className, fullWidthImage, onLoadingComplete, onClick, imageId, initShow}: AutoSizeImageProps) {  
    const [imageSize, setImageSize] = useState<any>({width:0, height:0});
    const [show, setShow] = useState<string>(initShow || "SCREEN");
    
    alt = alt || "图片";
    className = `${className || " w-full flex flex-col items-center justify-center "} group relative `;

    function handleButtonClick(e: React.MouseEvent){
        e.stopPropagation(); // 阻止事件冒泡
        if(show == "SCREEN"){
            setShow("IMAGE");
        }else{
            setShow("SCREEN");
        }
    }
    
    return (
        <Link className={className} href="#" onClick={ () => {
            if(typeof onClick == "function"){
                onClick();
            }else if(imageId){
                fu.safeWindowOpen(ru.getImageRest(imageId), "_blank");
            }
        }} >
            <Image
                alt={alt}
                src={src}
                className="sm:hidden w-full h-auto"
                onLoadingComplete={async () => {
                    const size = await fu.getImageSize(src)
                    if(onLoadingComplete){
                        onLoadingComplete(size);
                    }
                }}
                onContextMenu ={() => {return false}}
            />
            
            <Image
              alt={alt}
              src={src}
              className={`
                hidden sm:block
                ${fullWidthImage ? "w-full h-auto" : ""}
                ${!fullWidthImage && show === "SCREEN" ? "max-w-full h-auto" : ""}
                ${!fullWidthImage && show === "IMAGE" ? "max-w-full h-auto" : ""}
              `}
              style={{
                ...(fullWidthImage
                  ? {} // auto 尺寸 + max-w-full 已经限制好
                  : show === "SCREEN"
                    ? { maxHeight: "calc(100vh - 170px)" }
                    : show === "IMAGE" && imageSize.width
                      ? { width: imageSize.width, height: 'auto' }
                      : {}),
              }}
              onLoadingComplete={async () => {
                const size = await fu.getImageSize(src);
                setImageSize(size);
                if (onLoadingComplete) {
                  onLoadingComplete(size);
                }
              }}
              onContextMenu={() => false}
            />



          {/* 右上角按钮 */}
        {!fullWidthImage && (
          <button
            onClick={handleButtonClick}
            className="absolute top-2 right-2 z-10 
                       hidden group-hover:flex
                       px-4 py-2 items-center justify-center 
                       button-main rounded-full opacity-70"
          >
              {show == "IMAGE" ? "适应屏幕尺寸" : "适应图片尺寸"}
          </button>
        )}
            
        </Link>
    );
};
