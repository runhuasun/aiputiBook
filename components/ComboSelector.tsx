import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import CameraCapture from "../components/CameraCapture";
import VoiceRecorder from "../components/VoiceRecorder";
import { Icon } from '@iconify/react';

import Image from "./wrapper/Image";

import {mimeTypes} from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as debug from "../utils/debug";
import * as fu from "../utils/fileUtils";
import * as config from "../utils/config";

interface ComboSelectorProps {
    onSelect: (file: any, inRoom?: boolean) => void;
    onRecognizedFaces?: (faces: any, imageURL:string) => void;
    onSelectRoom?: (file: any) => void;    
    onUpload?: (file:any) => void;
    onSelectUserFile?: (file:any) => void;
    onCancel?: () => void;
    
    fileType?: string;
    fileTypeName?: string;   
    maxFileSize?: number;
    mimeType?: any;
    
    selectorType?: string; // GENERAL, MODEL_COVER, PROMPT_COVER
    selectorCode?: string; // model.code, prompt.code
    albumId?: string; // 相册用于存储模板
    albumName?: string; // 模板显示名称，必须两个字
    showDemo?: boolean;
    autoResize?: boolean;
    zoomInSuggestion?: boolean;
    maxRecordTime?: number;
    showBorder?: boolean;
    showIcon?: boolean;
    showTitle?: boolean;
}



export default function ComboSelector({onSelect, onSelectRoom, onCancel, onRecognizedFaces, onUpload, onSelectUserFile,
                                       showBorder=true, showIcon=true, showTitle=true,
                                       fileType="IMAGE", fileTypeName="图片", maxFileSize=50, mimeType=mimeTypes.image, 
                                       selectorType="GENERAL", selectorCode, albumId=config.system.album.template.id, albumName="样片",
                                       showDemo=false, autoResize=true, zoomInSuggestion=true, maxRecordTime=600 }: 
                                      ComboSelectorProps) {

    const [hasUserFile, setHasUserFile] = useState<boolean>(false);
    const [userFilePageCount, setUserFilePageCount] = useState<number>(0);
    const userFilePageSize = 16;
    const userFileRowSize = 8;    
    const [userFileCurrentPage, setUserFileCurrentPage] = useState<number>(1);
    const [userFiles, setUserFiles] = useState<any[]>([]);
    async function gotoUserFilesPage(page:number){
        const res = await callAPI("/api/userFileManager", {
            cmd:"GOTOPAGE", pageSize:userFilePageSize, currentPage:page, type:fileType });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setUserFileCurrentPage(page);
            setUserFilePageCount(res.result.pageCount);
            setUserFiles(res.result.userFiles);
        }
    }
    const [demoUserFiles, setDemoUserFiles] = useState<any[]>([]);
    async function loadDemoUserFiles(){
        const res = await callAPI("/api/userFileManager", {
            cmd:"GOTOPAGE", pageSize:8, currentPage:1, type:fileType, desc:selectorType });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setDemoUserFiles(res.result.userFiles);
        }
    }

    function getThumbnail(url:string, size:number){
        return url;
    }   

    // model或prompt的照片
    const [hasMP, setHasMP] = useState<boolean>(false);
    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const mpPageSize = 16;
    const mpRowSize = 8;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>([]);
    async function gotoMPsPage(page:number){
        const res = await callAPI("/api/updateRoom", {
            cmd:"GOTOPAGE", pageSize:mpPageSize, currentPage:page, type:fileType,  
            promptCode: (selectorType == "PROMPT_COVER" || selectorType == "PROMPT_POSE") ? selectorCode : undefined,
            modelCode: (selectorType == "MODEL_COVER" || selectorType == "MODEL_POSE") ? selectorCode : undefined,
            publicOnly: (selectorType == "PROMPT_POSE" || selectorType == "MODEL_POSE"),
            
        });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setMPCurrentPage(page);
            setMPPageCount(res.result.pageCount);
            setMPs(res.result.rooms);
        }
    }

    const [hasGenFile, setHasGenFile] = useState<boolean>(false);
    const [genFilePageCount, setGenFilePageCount] = useState<number>(0);
    const genFilePageSize = 16;
    const genFileRowSize = 8;    
    const [genFileCurrentPage, setGenFileCurrentPage] = useState<number>(1);
    const [genFiles, setGenFiles] = useState<any[]>([]);
    async function gotoGenFilesPage(page:number){
        const res = await callAPI("/api/updateRoom", 
                                  {cmd:"GOTOPAGE", pageSize:genFilePageSize, currentPage:page, type:fileType, showMyRooms:true
                                  });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setGenFileCurrentPage(page);
            setGenFilePageCount(res.result.pageCount);
            setGenFiles(res.result.rooms);
        }
    }

    const [hasModel, setHasModel] = useState<boolean>(false);
    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 16;
    const modelRowSize = 8;    
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);
    async function gotoModelsPage(page:number){
        const res = await callAPI("/api/updateModel", {cmd:"GOTOPAGE", pageSize:modelPageSize, currentPage:page, 
                                                       func:"lora", channel:"FASHION" });
        if (res.status != 200) {
           // alert(res.result);
        }else{
            setModelCurrentPage(page);
            setModelPageCount(res.result.pageCount);
            setModels(res.result.models);
        }
    }

    const [hasGoodRoom, setHasGoodRoom] = useState<boolean>(false);
    const [goodRoomPageCount, setGoodRoomPageCount] = useState<number>(0);
    const goodRoomPageSize = 16;
    const goodRoomRowSize = 8;    
    const [goodRoomCurrentPage, setGoodRoomCurrentPage] = useState<number>(1);
    const [goodRooms, setGoodRooms] = useState<any[]>([]);
    let func:string;
    switch(selectorType){
        case "SONG": func = "createSong"; break;
        case "MUSIC": func = "createMusic"; break;
    }
    async function gotoGoodRoomsPage(page:number){
        const res = await callAPI("/api/updateRoom", 
                                  {cmd:"GOTOPAGE", pageSize:goodRoomPageSize, currentPage:page, type:fileType, func,
                                   showBest: true, word:(selectorType=="GROUP" ? "合影" : undefined),
                                  });
        if (res.status != 200) {
          //  alert(JSON.stringify(res.result as any));
        }else{
            setGoodRoomCurrentPage(page);
            setGoodRoomPageCount(res.result.pageCount);
            setGoodRooms(res.result.rooms);
        }
    }

    const [hasTemplate, setHasTemplate] = useState<boolean>(false);
    const [templatePageCount, setTemplatePageCount] = useState<number>(0);
    const templatePageSize = 16;
    const templateRowSize = 8;    
    const [templateCurrentPage, setTemplateCurrentPage] = useState<number>(1);
    const [templates, setTemplates] = useState<any[]>([]);
    async function gotoTemplatesPage(page:number){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:templatePageSize, currentPage:page, id:albumId });
        if (res.status != 200) {
            // alert(res.result);
        }else{
            setTemplateCurrentPage(page);
            setTemplatePageCount(res.result.pageCount);
            setTemplates(res.result.rooms);
        }
    }
    
    switch(fileType){
        case "VIDEO":
            mimeType = mimeTypes.video;
            fileTypeName = "视频";   
            maxFileSize = 200;
            break;
        case "VOICE":
            mimeType = mimeTypes.audio;
            fileTypeName = "音频";
            maxFileSize = 50;
            break;
        default:
            mimeType = mimeTypes.image;
            fileTypeName = "图片";
            maxFileSize = 50;
    }  

    async function resizeImage(imageURL:string){
        const size = await fu.getImageSize(imageURL);
        if(zoomInSuggestion && (size.width<128 || size.height<128)){    
            const needZoomIn = await confirm(`您的图片的宽${size.width}像素，高${size.height}。这个尺寸太小，效果不佳。建议您先对照片进行无损放大再做处理。您是否同意？`);
            if(needZoomIn){
                fu.safeWindowOpen(`/zoomIn?imageURL=${imageURL}`, "_self");
            }
        }
        return await fu.aliyunImageRestrictResize(imageURL, autoResize, size);
    }
            
    async function recognizeFace(imageURL:string){
        // alert("recog:" + imageURL);
        if(imageURL){
            const res = await callAPI("/api/simpleAgent", {
                cmd:"recognizeFace", 
                params:{imageURL}
            });
            if (res.status != 200) {
                debug.error(JSON.stringify(res.result as any));
            }else{
                return JSON.parse(res.result?.generated);  // 多张人脸的属性              
            }
        }
    }
    
    useEffect(() => {
        switch(selectorType){
            case "TEMPLATE":
                setHasTemplate(true);
                setHasUserFile(true);
                setHasGenFile(true);        
                break;                
                
            case "GROUP":
                setHasGoodRoom(true);                
                setHasUserFile(true);
                setHasGenFile(true);        
                break;                

            case "SONG":
            case "MUSIC":
            case "GENERAL":
                setHasUserFile(true);
                setHasGoodRoom(true);                
                setHasGenFile(true);        
                break;

            case "AD_CLOTH":
                setHasUserFile(true);
                setHasGenFile(true);    
                
            case "USER":
                setHasUserFile(true);
                setHasModel(true);
                setHasGenFile(true);        
                break;
            case "STYLE":
                setHasGoodRoom(true);                
                setHasUserFile(true);
                setHasGenFile(true);        
                break;
            case "MODEL_COVER":
            case "PROMPT_COVER":
                setHasUserFile(true);
                setHasGenFile(true);        
                break;
            case "MODEL_POSE":
            case "PROMPT_POSE":
                setHasGoodRoom(true);                
                setHasGenFile(true);   
               // setHasUserFile(true);
                break;
        }
    }, []); // 空数组表示只在组件挂载时执行一次    

    useEffect(() => {
        loadDemoUserFiles();
    }, [selectorType]); 
    
    useEffect(() => {
        if(hasGoodRoom && goodRooms.length<=0){
            gotoGoodRoomsPage(goodRoomCurrentPage);
        }        
    }, [hasGoodRoom]); 

    useEffect(() => {
        if(hasTemplate && templates.length<=0){
            gotoTemplatesPage(templateCurrentPage);
        }        
    }, [hasTemplate]); 

    
    useEffect(() => {
        if(hasModel && models.length<=0){
            gotoModelsPage(modelCurrentPage);
        }        
    }, [hasModel]); 
    
    useEffect(() => {
        if(selectorCode){
            setHasMP(true);                
        }        
    }, [selectorCode]); 

    async function selectGoodRoom(file:any){
        if(file){
            if(fileType == "IMAGE" && file?.outputImage){
                file.outputImage = await resizeImage(file.outputImage);
            }
            if(file.outputImage){
                onSelect(file.outputImage, true);
            }
            if(onSelectRoom){
                onSelectRoom(file);
            }
            if(onRecognizedFaces){
                onRecognizedFaces(await recognizeFace(file.outputImage), file.outputImage);
            }                          
        }
    }

    async function selectTemplate(file:any){
        if(file){
            if(fileType == "IMAGE" && file?.outputImage){
                file.outputImage = await resizeImage(file.outputImage);
            }
            if(file.outputImage){
                onSelect(file.outputImage, true);
            }
            if(onSelectRoom){
                onSelectRoom(file);
            }
        }
    }
    
    async function selectModel(file:any){
        if(file?.coverImg){
            if(fileType == "IMAGE" && file?.coverImg){
                file.coverImg = await resizeImage(file.coverImg);
            }
            onSelect(file.coverImg);
            if(onRecognizedFaces){
                onRecognizedFaces(await recognizeFace(file.coverImg), file.coverImg);
            }
        }
    }

    async function selectMP(file:any){
        if(file){
            if(fileType == "IMAGE" && file?.outputImage){
                file.outputImage = await resizeImage(file.outputImage);
            }          
            if(file.outputImage){
                onSelect(file.outputImage, true);
                if(onRecognizedFaces){
                    onRecognizedFaces(await recognizeFace(file.outputImage), file.outputImage);
                }                          
            }
            if(onSelectRoom){
                onSelectRoom(file);
            }
        }
    }

    async function selectGenFile(file:any){
        if(file){
            if(fileType == "IMAGE" && file?.outputImage){
                file.outputImage = await resizeImage(file.outputImage);
            }            
            if(file.outputImage){
                onSelect(file.outputImage, true);
                if(onRecognizedFaces){
                    onRecognizedFaces(await recognizeFace(file.outputImage), file.outputImage);
                }                          
            }
            if(onSelectRoom){
                onSelectRoom(file);
            }
        }
    }

    async function selectUserFile(file:any){
        if(file && file.url){
            if(fileType == "IMAGE" && file?.url){
                file.url = await resizeImage(file.url);
            }               
            onSelect(file.url);
            if(onSelectUserFile){
                onSelectUserFile(file);
            }
            callAPI("/api/userFileManager", {cmd:"RAISE_SCORE", id:file.id});
            if(onRecognizedFaces){
                onRecognizedFaces(await recognizeFace(file.url), file.url);
            }
        }        
    }

    const buttonClass = showBorder ?
        "w-full h-auto border border-gray-600 border-dashed px-2 py-2 text-center flex flex-row space-x-1 items-center justify-center" 
        : 
        "w-full h-auto px-4 py-2 text-center flex flex-row space-x-1 items-center justify-center";
    
    return (
        <div className="flex flex-col items-center">
            <div className="w-full flex flex-row text-xs">

                {fileType=="IMAGE" && hasMP && (
                <div className="flex w-1/5 text-gray-400">
                  <FileSelector 
                      //title={`我上传的${fileTypeName}`}
                      title="套系"
                      showTitle={showTitle}                                            
                      icon={showIcon ? "mdi:package-variant-closed" : ""}
                      className={buttonClass}
                      files={mps} 
                      fileType={fileType}
                      pageCount={mpPageCount}
                      pageSize={mpPageSize}
                      rowSize={mpRowSize}                  
                      currentPage={mpCurrentPage}
                      onOpen={()=> gotoMPsPage(mpCurrentPage)}
                      onSelect={async (file) => {
                          selectMP(file);
                      }} 
                      onPageChange={(page) => {
                          if(page){
                              gotoMPsPage(page);
                          }
                      }}                   
                  />    
                </div>
                )}
                
                { hasTemplate &&  (
                <div className="flex w-1/5 text-gray-400">
                    <FileSelector 
                        title={albumName}
                        showTitle={showTitle}                                              
                        icon={showIcon ? "mdi:image-multiple" : ""}  
                        className={buttonClass}                        
                        files={templates} 
                        fileType={fileType}
                        pageCount={templatePageCount}
                        pageSize={templatePageSize}
                        rowSize={templateRowSize}                  
                        currentPage={templateCurrentPage}
                        onOpen={()=> gotoTemplatesPage(templateCurrentPage)}                        
                        onSelect={async (file) => {
                            selectTemplate(file)
                        }} 
                        onPageChange={(page) => {
                            if(page){
                                gotoTemplatesPage(page);
                            }
                        }}                    
                        />    
                </div>   
                )}                
                
                { hasGoodRoom &&  (
                <div className="flex w-1/5 text-gray-400">
                    <FileSelector 
                        title={"样例"}
                        showTitle={showTitle}                                              
                        icon={showIcon ? "mdi:file-document-multiple-outline" : ""}          
                        className={buttonClass}                        
                        files={goodRooms} 
                        fileType={fileType}
                        pageCount={goodRoomPageCount}
                        pageSize={goodRoomPageSize}
                        rowSize={goodRoomRowSize}                  
                        currentPage={goodRoomCurrentPage}
                        onOpen={()=> gotoGoodRoomsPage(goodRoomCurrentPage)}                        
                        onSelect={async (file) => {
                            selectGoodRoom(file)
                        }} 
                        onPageChange={(page) => {
                            if(page){
                                gotoGoodRoomsPage(page);
                            }
                        }}                    
                        />    
                </div>   
                )}

                { hasModel && (
                <div className="flex w-1/5 text-gray-400">
                  <FileSelector 
                      title="模特"
                      showTitle={showTitle}                                            
                      icon={showIcon ? "mdi:human-male" : ""}   
                      className={buttonClass}                      
                      files={models} 
                      fileType="LORAMODEL"
                      pageCount={modelPageCount}
                      pageSize={modelPageSize}
                      rowSize={modelRowSize}                  
                      currentPage={modelCurrentPage}
                      onOpen={()=> gotoModelsPage(modelCurrentPage)}                                              
                      onSelect={async (file) => {
                          selectModel(file);
                      }} 
                      onPageChange={(page) => {
                          if(page){
                              gotoModelsPage(page);
                          }
                      }}                   
                  />    
                </div>
                )}                
                
                { hasGenFile && (
                <div className="flex w-1/5 text-gray-400">
                    <FileSelector 
                        // title={`我生成的${fileTypeName}`} 
                        title={"历史"}
                        showTitle={showTitle}                                              
                        icon={showIcon ? "mdi:history" : ""}   
                        className={buttonClass}
                        files={genFiles} 
                        fileType={fileType}
                        pageCount={genFilePageCount}
                        pageSize={genFilePageSize}
                        rowSize={genFileRowSize}                  
                        currentPage={genFileCurrentPage}
                        onOpen={()=> gotoGenFilesPage(genFileCurrentPage)}                        
                        onSelect={async (file) => {
                            selectGenFile(file);
                        }} 
                        onPageChange={(page) => {
                            if(page){
                                gotoGenFilesPage(page);
                            }
                        }}                    
                        />    
                </div>   
                )}
    
   
                { hasUserFile && (
                <div className="flex w-1/5 text-gray-400">
                  <FileSelector 
                      //title={`我上传的${fileTypeName}`}
                      title="我的"
                      icon={showIcon ? "mdi:account" : ""}
                      showTitle={showTitle}                      
                      className={buttonClass}
                      files={userFiles} 
                      fileType= {`USER${fileType}`}
                      pageCount={userFilePageCount}
                      pageSize={userFilePageSize}
                      rowSize={userFileRowSize}                  
                      currentPage={userFileCurrentPage}
                      onOpen={()=> gotoUserFilesPage(userFileCurrentPage)}                                              
                      onSelect={async (file) => {
                          selectUserFile(file);
                      }} 
                      onPageChange={(page) => {
                          if(page){
                              gotoUserFilesPage(page);
                          }
                      }}                   
                  />    
                </div>
                )}

                {fileType=="IMAGE" && (
                <div className="hidden sm:flex w-1/5 text-gray-400">
                    <CameraCapture
                        title="拍照"
                        showIcon={showIcon}
                        showTitle={showTitle}                        
                        className={buttonClass}
                        autoCapture={true}
                        onSelect={async (file) => {
                            if(file){
                                selectUserFile(file);
                            }
                        }} 
                        />
                </div>
                )}                

                {fileType=="VOICE" && (
                <div className="flex w-1/5 text-gray-400">
                    <VoiceRecorder
                        title="录音"
                        showIcon={showIcon}
                        showTitle={showTitle}                        
                        className={buttonClass}
                        autoCapture={true}
                        maxTime={maxRecordTime}
                        onSelect={async (file) => {
                            if(file){
                                onSelect(file);
                            }
                        }} 
                        />
                </div>
                )}   
                
                <div className="flex flex-1">
                    <Uploader 
                        setFiles = { async (files) => {
                            if (files.length !== 0) {
                                let uploadedImageURL = files[0].uploadedUrl;
                                if(fu.getFileTypeByURL(uploadedImageURL) == "IMAGE"){
                                    uploadedImageURL = await resizeImage(uploadedImageURL);
                                }
                                onSelect(uploadedImageURL);
                                if(onUpload){
                                    onUpload(uploadedImageURL);
                                }
                                if(onSelectRoom){
                                    onSelectRoom(null);
                                }
                                if(onRecognizedFaces){
                                    onRecognizedFaces(await recognizeFace(uploadedImageURL), uploadedImageURL);
                                }                      
                            }
                        }}
                        mime= { mimeType }
                        maxFileSize = { maxFileSize }
                        desc = { selectorType }
                        showIcon={showIcon}
                        showTitle={showTitle}
                        className={buttonClass}
                    />
                </div>
                
            </div>             
            <div className="hidden sm:flex w-full">
                {fileType=="VIDEO" && showDemo && hasGoodRoom && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {goodRooms && goodRooms.slice(0, 8).map((v) => (
                        <Image alt="样片" src={v.inputImage} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectGoodRoom(v))}                            
                            />                    
                    ))} 
                </div>
                )}

                {fileType=="VIDEO" && showDemo && hasTemplate && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {templates && templates.slice(0, 8).map((v) => (
                        <Image alt="样片" src={v.inputImage} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectGoodRoom(v))}                            
                            />                    
                    ))} 
                </div>
                )}                
                
                {fileType=="IMAGE" && hasTemplate && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {templates && templates.slice(0, 8).map((v) => (
                        <Image alt="样片" src={v.outputImage} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectTemplate(v))}                            
                            />                    
                    ))} 
                </div>
                )}   
                
                {fileType=="IMAGE" && demoUserFiles.length==0 && showDemo && hasGoodRoom && !hasModel && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {goodRooms && goodRooms.slice(0, 8).map((v) => (
                        <Image alt="样片" src={v.outputImage}  width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectGoodRoom(v))}                            
                            />                    
                    ))} 
                </div>
                )}    
                {fileType=="IMAGE" && demoUserFiles.length>0 && showDemo && !hasMP && !hasTemplate && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {demoUserFiles.slice(0, 8).map((v) => (
                        <Image alt="历史上传文件" src={v.url} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectUserFile(v))}                            
                            />                    
                    ))} 
                </div>
                )}    
                {fileType=="IMAGE" && mps.length>0 && showDemo && hasMP && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {mps.slice(0, 8).map((v) => (
                        <Image alt="模型文件" src={v.outputImage} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectGoodRoom(v))}                            
                            />                    
                    ))} 
                </div>
                )}    
                
                {fileType=="IMAGE" && demoUserFiles.length==0 && showDemo && hasModel && !hasGoodRoom && (
                <div className="w-full grid grid-flow-row-dense grid-cols-8 gap-1" >
                    {models && models.slice(0, 8).map((v) => (
                        <Image alt="模特" src={v.coverImg} width={256} className="w-auto h-auto cursor-pointer" 
                            onClick={()=>(selectModel(v))}                            
                            />                    
                    ))} 
                </div>
                )}              
            </div>
        </div>
    );
}
