import React, { useRef, useState, useEffect } from 'react';
import { Component } from 'react';

import Image from "./wrapper/Image";

import {callAPI} from "../utils/apiUtils";
import {AliCVService} from '../ai/cv/AliCVService';
import * as debug from "../utils/debug";
//import * as fd from "../utils/faceUtils";
import * as du from "../utils/deviceUtils";


interface ImageCanvasProps {
    imageURL: string;
    className?: string;
    detectFace?: boolean;
    onSelectRect?: (rect:{isDetectedFace: boolean, x:number, y:number, width:number, height:number}|undefined) => void;
    onDetectedFaces?: (faces:any) => void;    
    onResizeCanvas? : (width:number, height:number) => void;
    enableFreeSelect? : boolean;
    temperature? : number;
    bright? : number;
    contrast? : number;
    sharpen? : number;
    channels? : {R:number, G:number, B:number};
    onCanvasUpdate? : (maskCanvas: HTMLCanvasElement) => void;
}

function isPointInRectangle(pointX: number, pointY: number, x:number, y:number, width:number, height:number): boolean {
    return pointX >= x && pointX <= x + width &&
           pointY >= y && pointY <= y + height;
}


export default function ImageCanvas({ imageURL, className, detectFace, 
                                     onSelectRect, onDetectedFaces, onResizeCanvas, onCanvasUpdate,
                                     enableFreeSelect=true,
                                     temperature=0, bright=0, contrast=0, sharpen=50, channels={R:0, G:0, B:0}
                                    }: ImageCanvasProps) {  
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    
    const [isDrawing, setIsDrawing] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [faces, setFaces] = useState<any[]>([]);
    const [selectedFace, setSelectedFace] = useState<any>();
    const [detecting, setDetecting] = useState<boolean>(false);
    
    const handleMouseDown = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // 计算缩放比例
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const currentX = ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX;
        const currentY = ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY;         
        
        setStartX(currentX);
        setStartY(currentY);
        setWidth(0);
        setHeight(0);
        setIsDrawing(true);
        
        setSelectedFace(undefined);        
        for(const f of faces){
            if(isPointInRectangle(currentX, currentY, f.rect.left, f.rect.top, f.rect.width, f.rect.height)){
                f.selected = true;
                // alert(`f.selected:${JSON.stringify(f)}`);
                setSelectedFace(f);
            }else{
                // 在手机上不取消选择，因为选完框后下滑页面时会触发这个取消，不合理
                if(!du.isMobile()){
                    f.selected = false;
                }
            }
        }        
        redrawImage();
        redrawRect(faces);
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
    
        const currentX = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * scaleX;
        const currentY = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * scaleY;
    
        // 计算真实的起点（左上角）和宽高（正值）
        const drawX = Math.min(startX, currentX);
        const drawY = Math.min(startY, currentY);
        const drawWidth = Math.abs(currentX - startX);
        const drawHeight = Math.abs(currentY - startY);
    
        setWidth(currentX - startX);  // 注意：原始值保留，后面 MouseUp 会用
        setHeight(currentY - startY);
    
        redrawImage();
    
        if (onSelectRect && enableFreeSelect) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        }
    
        redrawRect(faces);
    
        selectedFace.selected = false;
        setSelectedFace(undefined);
    };


    const handleMouseUp = () => {
        setIsDrawing(false);
        if(onSelectRect){
            if(detectFace && selectedFace){
                onSelectRect({
                    isDetectedFace: true,
                    x: Math.ceil(selectedFace.rect.left),
                    y: Math.ceil(selectedFace.rect.top),
                    width: Math.ceil(selectedFace.rect.width),
                    height: Math.ceil(selectedFace.rect.height)
                });
            }else{
                if (enableFreeSelect) {
                    const x = Math.min(startX, startX + width);
                    const y = Math.min(startY, startY + height);
                    const w = Math.abs(width);
                    const h = Math.abs(height);
                
                    if (w > 20 && h > 20) {
                        onSelectRect({ isDetectedFace: false, x: Math.ceil(x), y: Math.ceil(y), width: Math.ceil(w), height: Math.ceil(h) });
                    } else {
                        onSelectRect(undefined);
                    }
                }
            }
        }
    };

    const handleMouseClicked = (e: React.MouseEvent) => {

    }
    
    const handleImageLoad = () => {
        redrawImage();
        if(detectFace){
            setDetecting(true);
            const canvas = canvasRef.current;
            if(!canvas) return;
            let newFaces:any[] = [];                                                

            try{
                if(imageURL){
                    callAPI("/api/simpleAgent", {
                        cmd:"recognizeFace", 
                        params: {
                            imageURL
                        }
                    }).then((ret) => {
                        try{
                            if(ret.status == 200 && ret.result.generated){
                                const rawdata = JSON.parse(ret.result.generated);
                                for(const f of rawdata){
                                    const xMargin = Math.ceil(f.rect.width * 0.3);
                                    const yMargin = Math.ceil(f.rect.height * 0.3);
                                    let fTop = f.rect.top - yMargin;
                                    let fLeft = f.rect.left - xMargin;
                                    let fWidth = f.rect.width + xMargin*2;
                                    let fHeight = f.rect.height + yMargin*2;
                                    
                                    // 计算溢出的情况
                                    if(fTop<0){ // 上侧溢出
                                        fHeight+=fTop; 
                                        fTop = 0; 
                                    } 
                                    if(fLeft<0){ // 左侧溢出
                                        fWidth+=fLeft; 
                                        fLeft = 0
                                    }  
                                    if(fLeft+fWidth>canvas.width){ // 右侧溢出
                                        fWidth = canvas.width-fLeft-1
                                    }
                                    if(fTop+fHeight>canvas.height){ // 下侧溢出
                                        fHeight = canvas.height-fTop-1
                                    }
            
                                    const rect:any = {
                                        top: Math.ceil(fTop), 
                                        left:Math.ceil(fLeft), 
                                        width:Math.ceil(fWidth), 
                                        height:Math.ceil(fHeight),
                                        minRect: f.rect,
                                    };
                                    f.rect = rect;
                                    f.selected = false;
                                    newFaces.push(f);
                                }
                            }
                            setFaces(newFaces);
                            if(typeof onDetectedFaces == "function"){
                                onDetectedFaces(newFaces);
                            }
                            if(newFaces?.length > 0 && newFaces[0]?.rect){
                                setSelectedFace(newFaces[0]);
                                newFaces[0].selected = true;
                                const rect = newFaces[0].rect;
                                if(typeof onSelectRect === "function"){
                                    onSelectRect({ isDetectedFace: false, x:rect.left, y:rect.top, width:rect.width, height:rect.height});                                
                                }
                            }
                            
                        }catch(e){
                            debug.error(e);
                        }finally{
                            setDetecting(false);                           
                            redrawRect(newFaces);                                             
                        }
                    });
                }
            }catch(e){
                debug.error(e);
                redrawRect(newFaces);                                             
                setDetecting(false);   
            }
        }            
    };
        
    const redrawImage = () => {
        // alert("redraw image.....");        
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx || !imageURL) return;

        if (typeof window !== 'undefined') {
            const img = new window.Image();
            img.crossOrigin = "anonymous"; // 启用跨域        
            img.onload = () => {
                // 设置 Canvas 尺寸与图片尺寸一致
                canvas.width = img.width;
                canvas.height = img.height; 
                if(onResizeCanvas){
                    onResizeCanvas(img.width, img.height);
                }
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                if(temperature!=0 || bright!=0 || contrast!=0 || sharpen>50){
                    adjustImage(canvas, ctx, temperature, bright, contrast, sharpen);
                    if (onCanvasUpdate && canvas) {
                        onCanvasUpdate(canvas);
                    }                    
                }
                if(channels && (channels.R || channels.G || channels.B)){
                    adjustRGBChannels(canvas, ctx, channels.R||0, channels.G||0, channels.B||0, true);
                    if (onCanvasUpdate && canvas) {
                        onCanvasUpdate(canvas);
                    }                         
                }
            };
            img.src = imageURL;
        }
    };

    const redrawRect = (faces:any) => {
        //alert("faces:" + JSON.stringify(faces));
        if(onSelectRect){
            const canvas = canvasRef.current;
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (enableFreeSelect) {
                const drawX = Math.min(startX, startX + width);
                const drawY = Math.min(startY, startY + height);
                const drawWidth = Math.abs(width);
                const drawHeight = Math.abs(height);
            
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
            }
            
            if(detectFace){
                for(const f of faces){
                    if(f.selected){
                        ctx.strokeStyle = 'red';
                    }else{
                        ctx.strokeStyle = 'green';
                    }
                    ctx.strokeRect(f.rect.left, f.rect.top, f.rect.width, f.rect.height);
                }
            }
        }
    }

    useEffect(() => {
        setFaces([]);
        setSelectedFace(undefined);        
        handleImageLoad();
    }, [imageURL]);

    useEffect(() => {
        if(temperature!=0 || bright!=0 || contrast!=0 || sharpen>50){
            redrawImage();
        }
    }, [temperature, bright, contrast, sharpen]);

    useEffect(() => {
        if(channels && (channels.R!=0 || channels.G!=0 || channels.B!=0)){
            redrawImage();
        }
    }, [channels]);    
    
    redrawRect(faces);
    
    return (
        <div className="flex flex-col items-center mt-4">
            <div className="relative">
                {imageURL && (
                    <Image
                        ref={imageRef}                        
                        src={imageURL}
                        alt="Uploaded"
                        className="hidden absolute inset-0 w-full h-full object-contain"
                    />
                )}
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={handleMouseClicked}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}                    
                    className="max-w-full border border-black"
                />
                {detecting && (
                <div id="overlay" className="absolute button-green-blue top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-90 p-2.5 rounded-lg text-black text-lg">
                    正在识别照片中的人物...
                </div>         
                )}                
            </div>
        </div>
    );
};

function adjustImage(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, temperature: number, bright: number, contrast: number, sharpen: number): void {
    // 参数校验
    if (bright < -100 || bright > 100) {
        throw new Error('bright must be in the range of -100 to 100');
    }
    if (contrast < -100 || contrast > 100) {
        throw new Error('Contrast must be in the range of -100 to 100');
    }
    if (sharpen < 50 || sharpen > 100) {
        throw new Error('sharpen must be in the range of 50 to 100');
    }

    // 获取图片像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 色温调整因子
    const redAdjust = temperature > 0 ? 1 + temperature / 100 : 1;
    const blueAdjust = temperature < 0 ? 1 + Math.abs(temperature) / 100 : 1;

    // 对比度和亮度参数计算
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightOffset = (bright / 100) * 255;

    // 遍历像素数据进行调整
    for (let i = 0; i < data.length; i += 4) {
        // 获取原始通道值
        let r = data[i];     // Red
        let g = data[i + 1]; // Green
        let b = data[i + 2]; // Blue

        // 调整色温
        r = Math.min(255, r * redAdjust);
        b = Math.min(255, b * blueAdjust);

        // 调整对比度和亮度
        r = contrastFactor * (r - 128) + 128 + brightOffset;
        g = contrastFactor * (g - 128) + 128 + brightOffset;
        b = contrastFactor * (b - 128) + 128 + brightOffset;

        // 写回调整后的值
        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
    }

    // 将调整后的像素数据写回画布
    ctx.putImageData(imageData, 0, 0);

    // 如果需要锐度调整
    if (sharpen > 50) {
        const normalizedsharpen = (sharpen - 50) / 50; // 将锐度范围归一化到 0-1
        applySharpen(canvas, ctx, normalizedsharpen);
    }
}

// 锐度调整函数
function applySharpen(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, sharpenFactor: number): void {
    const weights = [
        0, -sharpenFactor, 0,
        -sharpenFactor, 1 + 4 * sharpenFactor, -sharpenFactor,
        0, -sharpenFactor, 0,
    ];
    const side = Math.sqrt(weights.length);
    const halfSide = Math.floor(side / 2);

    const width = canvas.width;
    const height = canvas.height;

    const srcData = ctx.getImageData(0, 0, width, height);
    const dstData = ctx.createImageData(width, height);

    const src = srcData.data;
    const dst = dstData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstOff = (y * width + x) * 4;

            let r = 0, g = 0, b = 0;

            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
                    const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
                    const srcOff = (scy * width + scx) * 4;

                    const wt = weights[cy * side + cx];
                    r += src[srcOff] * wt;
                    g += src[srcOff + 1] * wt;
                    b += src[srcOff + 2] * wt;
                }
            }

            dst[dstOff] = Math.min(255, Math.max(0, r));
            dst[dstOff + 1] = Math.min(255, Math.max(0, g));
            dst[dstOff + 2] = Math.min(255, Math.max(0, b));
            dst[dstOff + 3] = src[dstOff + 3]; // Alpha channel remains unchanged
        }
    }

    // 将锐化后的数据写回画布
    ctx.putImageData(dstData, 0, 0);
}

function adjustRGBChannels(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    redDelta: number,   // 红通道调整值（-255到255）
    greenDelta: number, // 绿通道调整值（-255到255）
    blueDelta: number,  // 蓝通道调整值（-255到255）
    normalize: boolean = true // 是否归一化参数（默认true，将-100~100映射到-255~255）
): void {
    // 参数校验
    if (normalize) {
        if (redDelta < -100 || redDelta > 100) throw new Error('redDelta must be in [-100, 100]');
        if (greenDelta < -100 || greenDelta > 100) throw new Error('greenDelta must be in [-100, 100]');
        if (blueDelta < -100 || blueDelta > 100) throw new Error('blueDelta must be in [-100, 100]');
        // 归一化到-255~255范围
        redDelta = (redDelta / 100) * 255;
        greenDelta = (greenDelta / 100) * 255;
        blueDelta = (blueDelta / 100) * 255;
    } else {
        if (redDelta < -255 || redDelta > 255) throw new Error('redDelta must be in [-255, 255]');
        if (greenDelta < -255 || greenDelta > 255) throw new Error('greenDelta must be in [-255, 255]');
        if (blueDelta < -255 || blueDelta > 255) throw new Error('blueDelta must be in [-255, 255]');
    }

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 遍历像素调整RGB通道
    for (let i = 0; i < data.length; i += 4) {
        // 直接叠加增量值（示例采用加法，可替换为乘法或其他算法[2,3](@ref)）
        data[i] = Math.max(0, Math.min(255, data[i] + redDelta));    // Red
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + greenDelta)); // Green
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + blueDelta));  // Blue
    }

    // 回写结果
    ctx.putImageData(imageData, 0, 0);
}

