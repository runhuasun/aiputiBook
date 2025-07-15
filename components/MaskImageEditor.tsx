import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowsPointingOutIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid'
import { Tooltip } from 'react-tooltip';

import {callAPI} from "../utils/apiUtils";

interface MaskImageEditorProps {
    imageURL: string;
    className?: string;
    onMaskUpdate?: (maskCanvas: HTMLCanvasElement) => void;
    maskFormat?: string;
    initAreas?: string[];
}

import LoadingDots from "../components/LoadingDots";


export default function MaskImageEditor({
    imageURL,
    className = '',
    onMaskUpdate,
    maskFormat = "WB", // 白黑WB:涂抹部分白色， 黑白BW：涂抹部分黑色、或涂抹部分ALPHA通道
    initAreas = [],
}: MaskImageEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [drawingMode, setDrawingMode] = useState<'draw' | 'erase'>('draw');
    const [undoStack, setUndoStack] = useState<ImageData[]>([]);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const [detecting, setDetecting] = useState<boolean>(false);
    const [segCache, setSegCache] = useState<Map<string, any>>();
  
    const [isAISubMenuOpen, setIsAISubMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });  
    const aiButtonRef = useRef<HTMLButtonElement>(null); // 明确指定为按钮元素

    async function segmentInitAreas(){
        if(initAreas){
          for(const area of initAreas){
              await segment(area);
          }            
        }
    }
  
    useEffect(() => {
        setSegCache(new Map());
        if (imageURL) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    clearCanvas();
                }
            };
            img.src = imageURL;

            segmentInitAreas();
        }
    }, [imageURL]);

    const saveUndo = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setUndoStack((prev) => [...prev, snapshot]);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX = 0;
        let clientY = 0;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const current = getPoint(e);

        if (drawingMode === 'draw') {
            // ctx.globalCompositeOperation = 'destination-over'; // ✅ 关键改动
            ctx.globalCompositeOperation = 'source-over';
            
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
           // ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // ✅ 固定 50% 透明黑色
            ctx.strokeStyle = 'rgba(128, 0, 128, 0.5)';            
            
            ctx.lineWidth = brushSize;

            ctx.beginPath();
            if (lastPoint.current) {
                ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
            } else {
                ctx.moveTo(current.x, current.y);
            }
            ctx.lineTo(current.x, current.y);
            ctx.stroke();
        } else if (drawingMode === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = brushSize;

            ctx.beginPath();
            if (lastPoint.current) {
                ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
            } else {
                ctx.moveTo(current.x, current.y);
            }
            ctx.lineTo(current.x, current.y);
            ctx.stroke();
        }

        // 关键修改3: 强制限制透明度
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 128) data[i] = 128; // 强制所有区域最大透明度为50%
        }
        ctx.putImageData(imageData, 0, 0);
        
        lastPoint.current = current;
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        saveUndo();
        lastPoint.current = getPoint(e);
        draw(e);
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        draw(e);
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        lastPoint.current = null;
        if (onMaskUpdate && canvasRef.current) {
            onMaskUpdate(canvasRef.current);
        }
    };

    const handleMouseButton = (e: React.MouseEvent) => {
        if (e.button === 2) {
            setDrawingMode('erase');
        } else {
            setDrawingMode('draw');
        }
    };

    const handleUndo = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const last = undoStack.pop();
        if (last) {
            ctx.putImageData(last, 0, 0);
            setUndoStack([...undoStack]);
        }
    };

    const handleClear = () => {
        clearCanvas();
        setUndoStack([]);
    };

    const handleDilate = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // 1. 导出当前遮罩为黑白 PNG DataURL
        const maskDataUrl = extractMaskImage(canvas, maskFormat);
        if (!maskDataUrl) return;
        
        try {
            // 2. 调用 expandWhiteRegion 扩张 1 像素
            const expandedMaskUrl = await expandWhiteRegion(maskDataUrl, 1);
            if (expandedMaskUrl) {
                // 3. 叠加新的 mask（applyExternalMask 内部会 saveUndo）
                applyExternalMask(expandedMaskUrl);
            }
        } catch (err) {
            console.error("膨胀失败：", err);
        }
    };
  
    
    const handleSaveMask = () => {
        const canvas = canvasRef.current;
        const maskDataUrl = extractMaskImage(canvas, maskFormat);
        if(maskDataUrl){
            const a = document.createElement('a');
            a.href = maskDataUrl;
            a.download = 'mask.png';
            a.click();
        }
    };

    const applyExternalMask = (maskURL: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // ✅ 先保存当前状态
            saveUndo();  // <--- 加在这里            
            
            // 创建临时画布获取像素数据
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;
    
            tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
    
            // 在当前 canvas 上叠加绘制
            ctx.save();
            ctx.globalCompositeOperation = 'source-over'; // 正常绘制
            ctx.strokeStyle = 'rgba(128, 0, 128, 0.5)';
            ctx.fillStyle = 'rgba(128, 0, 128, 0.5)';
    
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
    
                    const isWhite = r > 200 && g > 200 && b > 200;
                    if (isWhite) {
                        // 画一个像素点
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
    
            ctx.restore();
    
            if (onMaskUpdate) onMaskUpdate(canvas);
        };
    
        img.src = maskURL;
    };


    async function segment(target:string){
        let mask:any;
        if(segCache){
            mask = segCache.get(target);
        }
        if(!mask){
            setDetecting(true);
            try{
                const ret = await callAPI("/api/simpleAgent", {
                    cmd:"segment", 
                    params: {
                        imageURL,
                        target
                    }
                });
                if(ret.status == 200 && ret.result.generated){
                    mask = ret.result.generated;
                }else{
                    alert(ret.result);
                }
            }catch(err){
            }finally{
                setDetecting(false);
            }
        }
        if(mask){
            applyExternalMask(mask);

            let cache = segCache;
            if(!cache){
                cache = new Map();
                setSegCache(cache);
            }
            cache.set(target, mask);
        }
    }

    const segmentOptions = [
      { label: "人物", value: "body", color: "yellow" },
      { label: "衣服", value: "cloth", color: "red" },
      { label: "帽子", value: "hat", color: "red" },
      { label: "鞋靴", value: "shoes", color: "red" },
      { label: "皮肤", value: "skin", color: "green" },
      { label: "头部", value: "head", color: "green" },
      { label: "头发", value: "hair", color: "green" }
    ];

    const handleAIButtonClick = (e:any) => {
      if (aiButtonRef.current) {
        const rect = aiButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          left: rect.left,
          top: rect.bottom + window.scrollY + 4 // 4px间距
        });
      }
      setIsAISubMenuOpen(!isAISubMenuOpen);
    };
  
    return (
        <div className={`flex flex-row items-start  ${className}`}>        
            {/* 工具条 */}
            {detecting ? (
            /* 加载状态 - 保持与原工具条相同高度 */
            <div data-tooltip-id="MIE-tooltip"  data-tooltip-content="AI正在识别区域"
                className="py-10 flex flex-col items-center justify-center"
                >
                <LoadingDots 
                    direction="vertical"
                    color="#FFE900" // 与原有黄色按钮颜色一致
                    style="small"
                    count={10}
                    />
                <button className="invisible px-4 py-1 button-tool rounded hover:bg-yellow-500 flex items-center justify-center">
                    AI
                </button>                
            </div>
            ) : (            
            <div className="relative inline-flex flex-col items-center gap-4 mt-4 text-sm">
                {/* 画笔大小控制 */}
                <div className="flex flex-col items-center gap-2">
                    {/* 上端图标 */}
                    <label data-tooltip-id="MIE-tooltip" data-tooltip-content="左键涂抹选区，右键反选区域">🖌️</label>
                    
                    {/* 竖排滑条，宽度（w-48）决定滑条长度，厚度（h-1）决定横向粗细 */}
                    <div className="relative w-1 h-36">
                        <input type="range" min="1" max="100" value={brushSize}
                            onChange={e => setBrushSize(+e.target.value)}
                            className="absolute inset-0 w-36 h-1 left-1/2 transform rotate-90 origin-top-left"
                            />
                    </div>
                    
                    {/* 下端数值 */}
                    <span className="text-xs">{brushSize}px</span>
                </div>
                
                {/* AI识别 */}
                <div className="relative inline-block">              
                    <button ref={aiButtonRef} onClick={handleAIButtonClick}
                        data-tooltip-id="MIE-tooltip"  data-tooltip-content="AI识别区域"
                        className="px-4 py-1 button-tool rounded hover:bg-yellow-500 flex items-center justify-center"
                        >
                        AI
                    </button>
                    {/* 动态定位的子菜单 */}
                    {isAISubMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-gray-800 text-white rounded-md shadow-lg py-1 w-28">
                        <ul className="flex flex-col py-2 text-left tracking-wider">
                            {segmentOptions.map(option => (
                            <li key={option.value} className="hover:bg-gray-700">
                                <button
                                    className="w-full px-4 py-2 text-left focus:outline-none"
                                    onClick={() => {
                                        setIsAISubMenuOpen(false);
                                        segment(option.value);
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && segment(option.value)}
                                    >
                                    {option.label}
                                </button>
                            </li>
                            ))}
                        </ul>
                    </div>
                    )}
                </div>
                
                {/* 膨胀按钮 */}
                <button
                    onClick={handleDilate}
                    data-tooltip-id="MIE-tooltip"  data-tooltip-content="让选中的遮罩膨胀1个像素"
                    className="px-3 py-1 button-tool rounded hover:bg-yellow-500 flex items-center justify-center"
                    >
                    <ArrowsPointingOutIcon className="w-5 h-5 text-inherit" />
                </button>
            
                {/* 撤销按钮 */}
                <button
                    onClick={handleUndo}
                    data-tooltip-id="MIE-tooltip"  data-tooltip-content="撤销最后一次操作"
                    className="px-3 py-1 button-tool rounded hover:bg-yellow-500 flex items-center justify-center"
                    >
                    <ArrowUturnLeftIcon className="w-5 h-5 text-inherit" />
                </button>
                
                {/* 清除按钮 */}
                <button
                onClick={handleClear}
                data-tooltip-id="MIE-tooltip"  data-tooltip-content="清除所有选择"
                className="px-3 py-1 button-tool rounded hover:bg-red-500 flex items-center justify-center"
                    >
                    <TrashIcon className="w-5 h-5 text-inherit" />
                </button>
                
                {/* 保存遮罩按钮 */}
                <button
                    onClick={handleSaveMask}
                    data-tooltip-id="MIE-tooltip"  data-tooltip-content="下载当前遮罩图片到本地文件"
                    className="px-3 py-1 button-tool rounded hover:bg-green-500 flex items-center justify-center"
                    >
                    <ArrowDownTrayIcon className="w-5 h-5 text-inherit" />
                </button>
            </div>
            )}

            {/* 绘图区 */}
            <div ref={containerRef} className="relative w-full" onContextMenu={(e) => e.preventDefault()}>
                {/* 图片 */}
                <img
                    ref={imageRef}
                    src={imageURL}
                    alt="Editable"
                    className="w-full h-auto block pointer-events-none"
                />
                {/* 遮罩 Canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full"
                    onMouseDown={(e) => {
                        handleMouseButton(e);
                        handleMouseDown(e);
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                />
                {detecting && (
                <div id="overlay" className="absolute button-green-blue top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-90 p-2.5 rounded-lg text-black text-xl">
                    正在识别区域...
                </div>         
                )}                   
            </div>

           {/* 放在组件最外层 */}
            <Tooltip 
              id="MIE-tooltip" 
              place="right" // 提示位置（top/bottom/left/right）
              offset={3} // 与元素的间距
              noArrow={false} // 是否显示小箭头
              delayShow={100} // 延迟显示（毫秒）
              className="text-sm !z-[9999]"
            />            
        </div>
    );
}


export async function extractAlphaMaskImage(
  maskCanvas: HTMLCanvasElement,
  imageURL: string
): Promise<string | undefined> {
  if (!maskCanvas || !imageURL) return;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = maskCanvas.width;
      const height = maskCanvas.height;

      // 创建结果画布
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) return reject("输出 canvas 获取失败");

      // 绘制原图到输出 canvas 上
      outputCtx.drawImage(img, 0, 0, width, height);
      const outputImageData = outputCtx.getImageData(0, 0, width, height);
      const outputData = outputImageData.data;

      // 获取 mask 的 alpha 数据
      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) return reject("mask canvas 获取失败");
      const maskData = maskCtx.getImageData(0, 0, width, height).data;

      // 遍历每个像素
      for (let i = 0; i < outputData.length; i += 4) {
        const maskAlpha = maskData[i + 3]; // mask 的 alpha 值
        if (maskAlpha > 0) {
          // 有 mask：设为透明
          outputData[i + 3] = 0;
        }
        // 否则：保留原图像素
      }

      outputCtx.putImageData(outputImageData, 0, 0);
      resolve(outputCanvas.toDataURL("image/png"));
    };

    img.onerror = () => reject("图片加载失败");
    img.src = imageURL;
  });
}


export function extractMaskImage(canvas:any, maskFormat:string="WB", image?: string){
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(canvas, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        switch(maskFormat){
            case "WB":
                if (alpha > 0) {
                    // 涂抹区域设为白色 (255,255,255)
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                    data[i + 3] = 255; // Alpha
                } else {
                    // 其他区域设为纯黑色 (0,0,0)
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                    data[i + 3] = 255;
                }
                break;
            case "BW":
                if (alpha > 0) {
                    // 涂抹区域设为纯黑色 (0,0,0)
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                    data[i + 3] = 255;
                } else {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                }
                break;
            case "ALPHA":   
                if (alpha > 0) {
                  // 将涂抹区域设为完全透明（alpha=0）
                  data[i] = 0;     // R（任意值，不影响）
                  data[i + 1] = 0; // G（任意值，不影响）
                  data[i + 2] = 0; // B（任意值，不影响）
                  data[i + 3] = 0; // Alpha=0（透明）
                } else {
                  // 其他区域设为完全不透明（alpha=255）
                  data[i] = 255;   // R（任意值，不影响）
                  data[i + 1] = 255; // G（任意值，不影响）
                  data[i + 2] = 255; // B（任意值，不影响）
                  data[i + 3] = 255; // Alpha=255（不透明）
                }    
                break;
            case "ALPHA-R":
                if (alpha === 0) {
                    // 原来透明 -> 改为不透明白色
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                } else {
                    // 原来不透明 -> 改为透明
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                    data[i + 3] = 0;
                }
                break;
        }
    }

    tempCtx.putImageData(imageData, 0, 0);

    const maskDataUrl = tempCanvas.toDataURL('image/png');

    return maskDataUrl;
}


export async function expandWhiteRegion(dataUrl: string, pixel: number): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, w, h);
            const src = new Uint8ClampedArray(imageData.data);
            const dst = new Uint8ClampedArray(imageData.data);

            // 判断是否是“白色”点（可根据需要调整）
            const isWhite = (i: number) =>
                src[i] > 200 && src[i + 1] > 200 && src[i + 2] > 200;

            // 膨胀操作
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;

                    let foundWhite = false;
                    for (let dy = -pixel; dy <= pixel; dy++) {
                        for (let dx = -pixel; dx <= pixel; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                const nidx = (ny * w + nx) * 4;
                                if (isWhite(nidx)) {
                                    foundWhite = true;
                                    break;
                                }
                            }
                        }
                        if (foundWhite) break;
                    }

                    if (foundWhite) {
                        dst[idx] = dst[idx + 1] = dst[idx + 2] = 255;
                        dst[idx + 3] = 255;
                    }
                }
            }

            const newImageData = new ImageData(dst, w, h);
            ctx.putImageData(newImageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
}
