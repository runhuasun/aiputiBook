import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import { UploadDropzone } from "react-uploader";
import UploadedFile, { Uploader, UploadWidgetLocale } from "uploader";
import { GenerateResponseData } from "./api/generate";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import { Model } from "@prisma/client";

import prisma from "../lib/prismadb";
import {ZipData} from "./api/processImage";

import { uploader, cnLocale, uploaderOptions} from "../components/uploadOption";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LoadingDots from "../components/LoadingDots";
import LoadingRing from "../components/LoadingRing";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import { showModel} from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import DropDown from "../components/DropDown";
import Title from "../components/Title";
import AlbumSelector from "../components/AlbumSelector";
import MediaViewer from "../components/MediaViewer";
import RawdataSelector from "../components/RawdataSelector";
import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import RulerBox from "../components/RulerBox";


import {callAPI} from "../utils/apiUtils";
import {getFileNameFromURL} from "../utils/fileUtils";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import * as monitor from "../utils/monitor";
import * as ru from "../utils/restUtils";
import * as fu from "../utils/fileUtils";
import * as enums from "../utils/enums";
import { roomType, rooms, themeType, themes, themeNames, roomNames  } from "../utils/loraTypes";


const trainers = [
    "ostris / flux-dev-lora-trainer",
    "zylim0702 / sdxl-lora-customize-training", // zylim0702 / sdxl-lora-customize-model
    "lucataco / realvisxl2-lora-training", // lucataco / realvisxl2-lora-inference
    // "alexgenovese / train-sdxl-lora", // alexgenovese / sdxl-lora  RealVisXL 4.0
    "lucataco / ssd-lora-training" // lucataco / ssd-lora-inference
];

const trainerNames = new Map();
trainerNames.set("ostris / flux-dev-lora-trainer", "Flux 模型训练（推荐）");
trainerNames.set("zylim0702 / sdxl-lora-customize-training", "Stabel Diffusion XL 训练");
trainerNames.set("lucataco / realvisxl2-lora-training", "SDXL 全真世界2.0 训练");
// trainerNames.set("alexgenovese / train-sdxl-lora", "SDXL 全真世界4.0 训练");
trainerNames.set("lucataco / ssd-lora-training", "SSD-1B 训练");


export default function createLoRA({ model, defAlbum, config }: { model:Model, defAlbum:any, config: any }) {

    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [adding, setAdding] = useState<boolean>(false);
    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [theme2, setTheme2] = useState<themeType>((model?.theme || router.query.theme || "FACE")  as themeType);
    const [name, setName] = useState<string>(model?.name || "");
    const [fileMode, setFileMode] = useState<string>(defAlbum ? "ALBUM" : "FILE");
    const [trainer, setTrainer] = useState<string>(model?.baseModel || "ostris / flux-dev-lora-trainer");
    const [album, setAlbum] = useState<any>(defAlbum);
    const [albumRooms, setAlbumRooms] = useState<any[]>([]);
    
    let defFiles = [];
    let defNames = "";
    if(model?.datasets){
        let ds = model.datasets.split(";");
        for(const f of ds){
            const fileName = f;
            defFiles.push({uploadedUrl:f, originalName:fileName});
            defNames += defNames.length>0 ? `;${fileName}` : fileName;
        }
    }
    const [uploadedFiles, setUploadedFiles] = useState<any[]>(defFiles);
    const [uploadedFileNames, setUploadedFileNames] = useState<string>(defNames);

    const title = (router.query.title || "小模型") as string;
    const object = (router.query.object || "人物") as string;
    
    const channel = model?.channel || (router.query.channel ? router.query.channel as string : "PUBLIC");


    useEffect(() => {
        setAlbum(undefined);
        setAlbumRooms([]);
    }, [fileMode]);
    
    useEffect(() => {
        loadAlbumRooms();
    }, [album]);


    async function loadAlbumRooms(){
        if(album){
            const res = await callAPI("/api/albumManager", 
                                      {
                                          cmd:"ALBUM_ROOMS_GOTOPAGE", 
                                          id: album.id,
                                          pageSize:50, 
                                          currentPage:1,
                                          type:"IMAGE", 
                                      });
            if (res.status != 200) {
                alert(JSON.stringify(res.result as any));
            }else{
                setAlbumRooms(res.result.rooms);
            }
        }
    }
    
    let theme:themeType = theme2;
    function setTheme(val:themeType){ 
        theme = val; 
    }
    
    async function startTrain(){
        try{
            if(fileMode=="FILE"){
                if(!album || albumRooms.length<10){
                    return alert("请先在右侧区域至少上传10张以上照片");
                }
            }
            if(fileMode == "ALBUM"){
                if(!album){
                    return alert("请先选择一个您的相册");
                }
                if(albumRooms.length<10){
                    return alert("您的相册中照片少于8张，请再上传几张吧！");
                }
            }
            if( fileMode == "ZIP" && (uploadedFiles == null || uploadedFiles.length < 1)){
                alert("请先上传训练文件，才能开始训练！");
                return; 
            }else if(name == "" || name.length < 2){
                alert(`请给${title}起一个至少2个字的名字吧！`);
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
            setLoading(true);          
            
            let trainData = fileMode == "ZIP" ? uploadedFiles[0].uploadedUrl : undefined;
            setError(null);
            alert(`温馨提示：训练${title}需要进行复杂的AI运算，本次训练预计需要20-30分钟，您可以稍后到我的空间中查看训练结果。`);
            
            if(await generate(trainData)){
                window.location.href = `/dashboard?segment=IMGMODEL&page=1&modelChannel=${channel}`;
            }
        }catch(e){
            setError(JSON.stringify(e));
            alert(JSON.stringify(e));
        }finally{      
            mutate();            
            setTimeout(() => {
                setLoading(false);
            }, 1300);    
        }
    }
  
    
    async function generate(fileUrl: string): Promise<boolean> {
        try{
            const res = await callAPI("/api/workflowAgent", {
                cmd: "TRAIN_LORA_BY_ALBUM",
                params: {
                    id:model?.id, trainer, name, theme: theme, access:"PRIVATE", channel,
                    fileMode,
                    inputFiles: fileUrl, 
                    albumId: album?.id,
                }
            });
            
            if (res.status !== 200) {
                setError(res.result);
                return false;
            } else {
                return true;
            }
        }catch(e){
            debug.error(e);
            setError(JSON.stringify(e));
            return false;
        }
    }

    useEffect(() => {
        if (router.query.success === "true") {
            toast.success(`${title}训练成功！`);
        }
    }, [router.query.success]);

    function showTips(cols:number=4){
        return (
            <div className="w-full p-5">
                <div className="mx-auto max-w-4xl py-10 pt-10 ">
                    <h1 className="mx-auto max-w-4xl font-display text-base font-bold tracking-normal text-black-100 sm:text-2xl mb-2">
                        <span className="text-gray-100">上传照片素材的要求</span> 
                    </h1>
                </div>
                           
                <div className="items-center w-full  flex sm:flex-row px-2 space-y-3 sm:mb-0 mb-3">
                    <div className="flex flex-row flex-col space-y-10  mb-4  rounded-xl items-center w-full space-x-2">
                        
                        <div className={`grid grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-${cols} items-center`}>
                            
                            <div className="relative inline-block w-full">
                              <Image alt="好照片"  width={512}  height={512} src={ `${config.RS}/demo/good1.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-white transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center">正确照片</p>
                              </div>                     
                            </div>
                            <div className="relative inline-block w-full">
                              <Image alt="好照片"  width={512}  height={512} src={ `${config.RS}/demo/good2.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-white transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center">正确照片</p>
                              </div>                     
                            </div>  
                            <div className="relative inline-block w-full">
                              <Image alt="好照片"  width={512}  height={512} src={ `${config.RS}/demo/good3.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-white transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center">正确照片</p>
                              </div>                     
                            </div>  
                            <div className="relative inline-block w-full">
                              <Image alt="好照片"  width={512}  height={512} src={ `${config.RS}/demo/good4.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-white transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center">正确照片</p>
                              </div>                     
                            </div>                  
            
                            <div className="relative inline-block w-full">
                              <Image alt="错误照片"  width={512}  height={512} src={ `${config.RS}/demo/bad1.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-red transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center text-red-600">错：昏暗模糊</p>
                              </div>                     
                            </div>                  
                             <div className="relative inline-block w-full">
                              <Image alt="错误照片"  width={512}  height={512} src={ `${config.RS}/demo/bad2.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-red transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center text-red-600">错：图案遮挡</p>
                              </div>                     
                            </div>     
                            <div className="relative inline-block w-full">
                              <Image alt="错误照片"  width={512}  height={512} src={ `${config.RS}/demo/bad3.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-red transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center text-red-600">错：条纹噪点</p>
                              </div>                     
                            </div>     
                            <div className="relative inline-block w-full">
                              <Image alt="错误照片"  width={512}  height={512} src={ `${config.RS}/demo/bad4.jpg` } className="sm:mt-0 mt-2 object-cover h-100" />
                              <div  className="absolute top-1/2 left-1/2 z-10 w-full h-40 flex justify-center text-xl sm:text-xl text-center items-center text-red transform -translate-x-1/2 -translate-y-1/2 ">
                                <p className="text-center text-red-600">错：多人照片</p>
                              </div>                     
                            </div>                     
                        </div>
                    </div>
                </div>
                
            </div>
        );
    }

    function showRoom(img:any, type:string ) {
        return(
            <div className="group masonry-item border-gray-200 text-center flex-col relative inline-block">
                <div className="relative w-full text-xs">
                    <Link href={ ru.getImageRest(img.id)} target="_blank">   
                        <Image
                          alt="AI作品"
                          width={512}
                          height={512}
                          src={img.outputImage}
                          className=" object-cover w-full"
                          loading="lazy"
                        />
                    </Link>

                    {type == "ALBUM" && (
                    <button onClick={() => {
                        removeRoomFromAlbum(img.id);
                       }}
                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                        <span className="sr-only">移除</span>
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                        </svg>
                    </button> 
                    )}
                </div>
            </div> 
        );
    }

    async function addRoomToAlbum(roomId:string){
        try{
            setAdding(true);
            const res = await callAPI("/api/albumManager", {
                cmd:"ADDROOM", id:album?.id, roomId, useTempAlbum:true 
            });
            if (res.status !== 200) {
                setError(JSON.stringify(res.result));
            }else{
                if(!album && res.result?.tempAlbum){
                    setAlbum(res.result?.tempAlbum);
                }
            }
        }catch(err){
        }finally{
            setAdding(false);
        }
    }

    async function addImageToAlbum(imageURL:string, mediaType:string="IMAGE", fileName?:string){
        try{
            setAdding(true);
            if(mediaType == "IMAGE"){
                const size = await fu.getImageSize(imageURL);
                if(size.width<256 || size.height<256){
                    alert(`上传图片的宽${size.width}像素，高${size.height}。这个尺寸太小，系统无法进行正确的处理。请换一张宽高大于256 X 256像素的图片试试！`);
                    return null;
                }
                const bytes = await fu.getImageBytes(imageURL);
                if(bytes && bytes > 20000000){
                    alert(`照片大小不能超过20M字节，请换一张小一点的照片试试`);
                    return null;
                }
                if(size.width>2000 || size.height>2000){
                    imageURL = await fu.resizeImage(imageURL, 2000) || imageURL;                        
                }
            }
            const res = await callAPI("/api/albumManager", { cmd:"ADDIMAGE", imageURL:imageURL, id:album?.id, mediaType, func:"", useTempAlbum:true,
                                                            prompt:fileName?.split('.')[0] || fileName,
                                                           });
            if(res.status != 200){
                setError(JSON.stringify(res.result));
            }else{
                if(!album && res.result?.tempAlbum){
                    setAlbum(res.result?.tempAlbum);
                }            
                return res.result?.room;
            }
        }catch(err){
        }finally{
            setAdding(false);
        }
    }
    
    async function removeRoomFromAlbum(roomId:string){
        try{
            setAdding(true);
            if(album && roomId && albumRooms){
                const res = await callAPI("/api/albumManager", {
                    cmd:"REMOVEROOM", id:album?.id, roomId 
                });
                if (res.status !== 200) {
                    setError(JSON.stringify(res.result));
                } else {
                    setAlbumRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));               
                }
            }
        }catch(err){
        }finally{
            setAdding(false);
        }
    }   


    function showFileUploader(){
        return (
            <div className="w-full p-5 flex flex-col items-center">
                <div className="grid w-full grid-flow-row-dense grid-cols-1 gap-1 sm:grid-cols-6">                        
                { albumRooms && albumRooms.map((img) => (
                    showRoom(img, "ALBUM")
                ))}
                </div>
                { !adding && albumRooms?.length < 50 && (
                <div className="w-full max-w-2xl">
                    <ComboSelector fileType="IMAGE"
                        onSelect = {async (newFile) => {
                        }}                 
                        onUpload = {async (newFile) => {
                            const newRoom = await addImageToAlbum(newFile);
                            if(newRoom){
                                setAlbumRooms(albumRooms.concat([newRoom]));
                            }
                        }}       
                        onSelectUserFile = {async (newFile) => {
                            const newRoom = await addImageToAlbum(newFile.url);
                            if(newRoom){
                                setAlbumRooms(albumRooms.concat([newRoom]));
                            }
                        }}       
                        onSelectRoom = {async (newRoom) => {
                            addRoomToAlbum(newRoom.id);
                            setAlbumRooms(albumRooms.concat([newRoom]));
                        }}                                          
                        selectorType="GENERAL" showDemo={false} showIcon={true} />                                    
                </div>   
                )}
            </div>
        );
    }
    
    
    let num = 1;
    if(status == "authenticated" || status == "unauthenticated"){
        
        return (
            <TopFrame config={config}>
                                
                <main>
                    
                    <div className="page-container">
                        
                        <div className="page-tab-image-create">

                            <Title config={config} title={`创建我的${title}`} subTitle={`创建和分享您的${title}，您将马上获得分成收入！`}/>   

                            
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label={`给${title}起个好名字（唯一标识）`}/>
                                <input type="text" className="input-main" 
                                    defaultValue={name}
                                    onChange={(e) => setName(e.target.value)}                      
                                    />
                            </div>
                        
                            <div className="w-full">
                                <label className="px-3">
                                    <input type="radio" value="FILE" checked={fileMode === 'FILE'} onChange={(e) => setFileMode(e.target.value)} />
                                    上传文件
                                </label>                            
                                <label className="px-3">
                                    <input type="radio" value="ALBUM" checked={fileMode === 'ALBUM'} onChange={(e) => setFileMode(e.target.value)} />
                                    选择相册
                                </label>
                                <label className="px-3">
                                    <input type="radio" value="ZIP" checked={fileMode === 'ZIP'} onChange={(e) => setFileMode(e.target.value)} />
                                    ZIP压缩包
                                </label>
                            </div>    

                            {fileMode == "FILE" && (
                            <div className="flex flex-row space-x-3 items-center">
                                <FormLabel number={`${num++}`} label="请在右侧区域上传您的训练照片："/>                
                            </div>
                            )}           
                            
                            {fileMode == "ZIP" && (
                            <div className="space-y-4 w-full">
                                <div className="flex flex-row space-x-3 items-center">
                                    <FormLabel number={`${num++}`} label="训练素材（包含10张以上照片的.ZIP包）"/>
                                </div>
                                <input type="text" className="input-main" 
                                    readOnly
                                    value={uploadedFileNames}
                                    onChange={(e) => setUploadedFileNames(e.target.value)}                      
                                    />                      
                                <RawdataSelector fileType="ZIP" 
                                    onSelect = { (files) => {
                                        setUploadedFiles(files);
                                        let names = "";
                                        for(const f of files){
                                            names += (names ? ";" : "") + f.originalName;
                                        }
                                        setUploadedFileNames(names);
                                    }}/>
                            </div>
                            )}
    
                            {fileMode == "ALBUM" && (
                            <div className="space-y-4 w-full ">
                                <div className="flex flex-row space-x-3 items-center">
                                    <FormLabel number={`${num++}`} label="训练相册（包含10张以上照片）"/>
                                    <AlbumSelector 
                                        className = {"mt-3 button-main px-3 py-1 flex flex-row text-base"}
                                        onSelect = { (newAlbum) => {
                                            setAlbum(newAlbum);
                                        }}/>                            
                                </div>
                                <input type="text" className="input-main" 
                                    readOnly
                                    value={album?.name}
                                    />                      
                            </div>
                            )}

                        
                            <div className="w-full max-w-xl items-left text-left">
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {`1. 请选择10-20张主体清晰的照片，正方形照片最佳。`}
                                </p>
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {`2. 所有照片应该只有一个${object}，并且都是同一个${object}。`}
                                </p>       
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {`3. 生成的${title}以及图片是您私有的，除非您主动公开。`}
                                </p> 
                                <p className="px-1 text-left font-medium w-full text-gray-200 sm:hidden ">
                                    {`4. 非苹果手机请在左下角'...'菜单，选择‘浏览器打开’，并使用UC，360或FireFox浏览器。`}
                                </p>                    
                            </div>

                            <div className= "flex flex-col space-y-2 items-center">
                                {status === "authenticated" && data && (
                                <PriceTag config={config}  />
                                )}
                                
                                {loading ? (
                                <LoadingButton minTime={20} maxTime={30} timeUnit="分钟"/>
                                ):(
                                <StartButton config={config} title={`开始训练${title}`}
                                    onStart={() => {
                                        startTrain();
                                    }}
                                />
                                )}
                            </div>

                            { channel=="FASHION" && fileMode != "ZIP" && showTips(2) }                            
                           
                        </div>

                        <RulerBox className="flex flex-1 flex-col w-full rounded-lg min-h-[calc(100vh-10px)] mr-2 items-center justify-center border border-1 border-gray-300 border-dashed">
                            {error && (
                            <MessageZone message={error} messageType="ERROR"/>
                            )}                  

                            {loading && !error && (
                            <LoadingRing/>
                            )}

                            {!loading && !error && fileMode != "ZIP" && showFileUploader()}

                            {channel=="FASHION" && !loading && !error && fileMode == "ZIP" && showTips(4)}
                            
                        </RulerBox>
                    
                    </div>         
                              
                </main>
                
            </TopFrame>
        );    
    
    }else{
        return(<LoginPage config={config}/>);
    }    
};


      
      
export async function getServerSideProps(ctx: any) {
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let user;
    let model;
    let modelId = ctx?.query?.modelId;
    let albumId = ctx?.query?.albumId;
    
    if (session?.user?.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
          where: {
            email: session.user.email!,
          },
        });
    }  
    if(user){
  
        if(modelId){
            model = await prisma.model.findUnique({
                where: { id: modelId }
            });
            if(model?.userId != user.id){ // 必须是当前用户的模型才可以重新训练
                model = null;
            }
        }
        
        const defAlbum = albumId ? await prisma.album.findUnique({
            where: {
                id: albumId
            }
        }) : undefined;

        monitor.logUserRequest(ctx, session, user);
        return {
            props: {
                defAlbum,
                model,
                config
            },
        };
    }else{
        monitor.logUserRequest(ctx);        
        return { props: { config } };
    }
}            
