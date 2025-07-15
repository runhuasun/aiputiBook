// React 基础及 Next.js
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";

// 数据请求
import useSWR from "swr";

// 工具函数与服务端支持
import { getServerSession } from "next-auth";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";

// 类型定义
import { Room } from "@prisma/client";
import { Crop } from 'react-image-crop';

// 第三方组件
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// 组件
import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import RulerBox from "../components/RulerBox";
import Image from "../components/wrapper/Image";
import ComboSelector from "../components/ComboSelector";
import ResultButtons from "../components/ResultButtons";
import MessageZone from "../components/MessageZone";
import StartButton from "../components/StartButton";
import LoadingButton from "../components/LoadingButton";

// 工具函数
import * as debug from "../utils/debug";
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import { callAPI2 } from "../utils/apiUtils";
import { getImageSize } from "../utils/fileUtils";




export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    let roomId = ctx?.query?.roomId;
    if(roomId){
        let image = await prisma.room.findUnique({
            where: {
                id: roomId,
            }
        });
  
        // 更新阅读次数+1
        if(image){
            await prisma.room.update({
                where: {
                    id: image.id,
                },
                data: {
                    viewTimes: {
                        increment: 1,
                    },
                },
            }); 
        }

        return {
            props: {
                image,
                config
            },
        };
    }else{
        return{
            props:{
                config
            }
        }
    }
}  



export default function cropImage({ image, config, albums }: { image : Room, config: any, albums:any[] }) {  
    const router = useRouter();

    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || image?.outputImage || "")  as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

   const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    function formatDate(date: Date): string { 
        if(date){
            return date.toLocaleString('zh-CN', 
                                       { year: '2-digit', month: 'long', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'});
        }else{
            return "某年某月某日 08:08";
        }
    }

    const initCrop:Crop = {  unit: 'px', width: 64,  height: 64,  x: 0,  y: 0 };
    const [crop, setCrop] = useState<Crop>(initCrop);
    const [aspect, setAspect] = useState<number | undefined>();
    const [scale, setScale] = useState(1);
    //const [rotate, setRotate] = useState<string>("");
    //const [flip, setFlip] = useState<string>("");
    const [imageSize, setImageSize] = useState<any>({width:0, height:0});
    const [restrict, setRestrict] = useState<any>({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});

    async function onCropClick(rotate?:string, flip?:string) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);              
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "cropImage", 
                preRoomId,
                params: {
                    imageURL: originalPhoto,
                    cropRect: crop,
                    scale,
                    rotate,
                    flip,
                }
            },
            "裁剪图片",
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredImage(res.result?.generated);
                setRestoredId(res.result?.genRoomId);  
                setOriginalPhoto(res.result?.generated);
                setScale(1);
                setCrop(initCrop);               
            }
        );
    }    

    useEffect(() => {
        if(originalPhoto){
            const fetchImageSize = async () => {
                if (originalPhoto) {
                    const size = await getImageSize(originalPhoto);
                    setImageSize(size);
                }
            };        
            fetchImageSize();
        }
    }, [originalPhoto]); 
    
        return (
            
            <TopFrame config={config}>
                               
                <main>
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />                  
                    <div className="flex justify-between items-center w-full flex-col mt-2">

                        <div className="flex flex-col sm:flex-row w-full">
                            
                            <RulerBox className="flex flex-col flex-1 items-center justify-center">
                                { originalPhoto && (
                                <ReactCrop
                                    aspect={aspect}
                                    crop={crop}
                                    onChange={(newCrop) => setCrop(newCrop)}
                                    minWidth={restrict.minWidth} maxWidth={restrict.maxWidth} 
                                    minHeight={restrict.minHeight} maxHeight={restrict.maxHeight}
                                    >     
                                    <Image alt="original photo" src={originalPhoto}                                  
                                        className="w-auto h-auto"
                                        style={{ 
                                            width:Math.ceil(imageSize.width * scale), 
                                            height:Math.ceil(imageSize.height * scale), 
                                        }}
                                        width={ Math.ceil(imageSize.width * scale) }
                                        height={ Math.ceil(imageSize.height * scale) }
                                        /> 
                                </ReactCrop>
                                )}
                                {!loading && (
                                <div className="w-full max-w-2xl">
                                    <ComboSelector
                                        onSelectRoom = {async (newRoom) => {
                                            setPreRoomId(newRoom?.id);
                                        }}                                          
                                       onSelect = {(newFile) => setOriginalPhoto(newFile)} selectorType="GENERAL" showDemo={!originalPhoto}/>                                    
                                </div>
                                )}    
                                { restoredId && restoredImage && (
                                <div>
                                    <ResultButtons mediaId={restoredId} mediaURL={restoredImage}/>
                                </div>              
                                )}
                               
                                {error && (
                                <MessageZone message={error} messageType="ERROR"/>
                                )}  
                               
                            </RulerBox>                        
                            <div className="max-w-xs">
                                <div className="w-full text-left px-2">
                                    <p className="text-base text-gray-400 text-left">{`图片宽：${Math.ceil(imageSize.width*scale)}px，高：${Math.ceil(imageSize.height*scale)}px`}</p>
                                    <p className="text-base text-gray-400 text-left">{`选区宽：${Math.ceil(crop.width)}px，高：${Math.ceil(crop.height)}px`}</p>                                    
                                </div>
                                <div className="w-full mt-4 grid grid-flow-row-dense gap-1 items-center grid-cols-2 text-gray-200 text-sm" >
                                    

                                  <button onClick={()=>{ 
                                        setAspect(undefined);
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                  }}
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      任意比例
                                  </button>
                                   
                                  <button onClick={()=>{ 
                                        setAspect(736/1024);
                                        setCrop({  unit: 'px', width: 736,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:736, maxWidth:4096, minHeight:1024, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      证件大图
                                  </button>

                                  <button onClick={()=>{ 
                                        setAspect(16/9); 
                                        setCrop({  unit: 'px', width: 1024,  height: 576,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      横屏16:9
                                  </button>
                                  <button onClick={()=>{ 
                                        setAspect(16/9); 
                                        setCrop({  unit: 'px', width: 1024,  height: 576,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:1024, maxWidth:1024, minHeight:576, maxHeight:576});
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      标准16:9
                                  </button>

                                  <button onClick={()=>{ 
                                        setAspect(9/16);
                                        setCrop({  unit: 'px', width: 576,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      竖屏9:16
                                  </button>                                    
                                  <button onClick={()=>{ 
                                        setAspect(9/16);
                                        setCrop({  unit: 'px', width: 576,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:576, maxWidth:576, minHeight:1024, maxHeight:1024});
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      标准9:16
                                  </button>   
                                    
                                  <button onClick={()=>{ 
                                        setAspect(4/3);
                                        setCrop({  unit: 'px', width: 1024,  height: 768,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      横屏4:3
                                  </button>
                                  <button onClick={()=>{ 
                                        setAspect(4/3);
                                        setCrop({  unit: 'px', width: 1024,  height: 768,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:1024, maxWidth:1024, minHeight:768, maxHeight:768});
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      标准4:3
                                  </button>
                            
                                  <button onClick={()=>{ 
                                        setAspect(3/4);
                                        setCrop({  unit: 'px', width: 768,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      竖屏3:4
                                  </button>
                                  <button onClick={()=>{ 
                                        setAspect(3/4);
                                        setCrop({  unit: 'px', width: 768,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:768, maxWidth:768, minHeight:1024, maxHeight:1024});                
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      标准3:4
                                  </button>
                
                
                                  <button onClick={()=>{ 
                                        setAspect(1);
                                        setCrop({  unit: 'px', width: 512,  height: 512,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:32, maxWidth:4096, minHeight:32, maxHeight:4096});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      方形1:1
                                  </button>
                                  <button onClick={()=>{ 
                                        setAspect(1);
                                        setCrop({  unit: 'px', width: 1024,  height: 1024,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:1024, maxWidth:1024, minHeight:1024, maxHeight:1024});                
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      1024方形
                                  </button>

                                  <button onClick={()=>{ 
                                        setAspect(295/413);
                                        setCrop({  unit: 'px', width: 295,  height: 413,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:295, maxWidth:295, minHeight:413, maxHeight:413});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      1寸证件照
                                  </button>

                                  <button onClick={()=>{ 
                                        setAspect(413/579);
                                        setCrop({  unit: 'px', width: 413,  height: 579,  x: crop.x,  y: crop.y });
                                        setRestrict({ minWidth:413, maxWidth:413, minHeight:579, maxHeight:579});                            
                                    }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      2寸证件照
                                  </button>
                                    
                                  <button onClick={()=>{ if(scale<10){setScale(scale + 0.05)} }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      放大 5%
                                  </button>
    
                                  <button onClick={()=>{ if(scale>0.1){setScale(scale - 0.05)} }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      缩小 5%
                                  </button>

                                  <button onClick={()=>{ if(scale<10){setScale(scale + 0.01)} }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      放大 1%
                                  </button>
    
                                  <button onClick={()=>{ if(scale>0.1){setScale(scale - 0.01)} }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      缩小 1%
                                  </button>

                                  {status == "authenticated" && (
                                  <button onClick={()=>{ onCropClick("left");}} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      左旋 90度
                                  </button>
                                  )}

                                   {status == "authenticated" && (
                                  <button onClick={()=>{  onCropClick("right"); }} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      右旋 90度
                                  </button>
                                  )}

                                   {status == "authenticated" && (
                                  <button onClick={()=>{  onCropClick("", "horizontal");}} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      水平翻转
                                  </button>
                                  )}
                                   
                                   {status == "authenticated" && (
                                  <button onClick={()=>{ onCropClick("", "vertical");}} 
                                      disabled={loading || !originalPhoto}
                                      className={(loading ? "button-dark" : "button-grid") + " px-10 py-4  "}> 
                                      垂直翻转
                                  </button>
                                  )}
                                    
                                </div>
    
    
                                <div className="w-full mt-8 flex flex-col items-center">
                                  {loading ? (
                                    <LoadingButton/>
                                  ) : (
                                    <StartButton  config={config} title="裁剪照片"  
                                       onStart={()=>{ onCropClick() }} 
                                       disabled={loading || !originalPhoto}
                                       />
                                    )
                                    }
                                 </div>
                            </div>
        
                        </div>
    
                    </div>
                </main>
                
            </TopFrame>  
        );
}
