import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import Link from "next/link";
import Pagination from '../components/Pagination';
import { showModel, showPrompt } from "../components/Genhis";
import { Icon } from '@iconify/react';

import Image from "./wrapper/Image";
import Video from "./wrapper/Video";

import { getFileIcon } from "../utils/rawdata";
import {getThumbnail, getVideoPoster} from "../utils/fileUtils";
import * as du from "../utils/deviceUtils";




interface FileSelectorProps {
    title: string;
    icon?: string;
    showTitle?: boolean;
    files: any[];
    fileType: string;
    pageCount: number;
    pageSize?: number;
    rowSize?: number;
    currentPage: number;
    onSelect: (file: any) => void;
    onCancel?: () => void;
    onPageChange?: (currentPage: number) => void;
    isOpened?: boolean;
    className?: string;
    onOpen?: () => void;
    createLink?: string;
    createLabel?: string;
}

const thumbSize = 256;

export default function FileSelector({ title, icon, showTitle=true, files, fileType, createLink, createLabel,
                                      className="w-full h-auto border border-gray-600 border-dashed px-2 py-4 text-center",
                                      pageCount, pageSize=16, rowSize=8, currentPage, onSelect, onCancel, onPageChange, onOpen, isOpened }: FileSelectorProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [selectedFile, setSelectedFile] = useState<any>();
    
    function open() {
        if(onOpen){
            onOpen();
        }
        setIsOpen(true);
    }

    function select(file:any) {
        setIsOpen(false);
        onSelect(file);
    }

    function cancel() {
        setIsOpen(false);
        if(onCancel){
            onCancel();
        }
    }
    
    return (
        <div className="w-full h-3/4-screen">
            <button className={className}
                onClick={() => {
                    open();
                }} >
                {icon && (
                    <Icon icon={icon} className="w-5 h-5 text-inherit text-xs"/>
                )}
                {showTitle && (
                <span>{title}</span>
                )}
            </button>
            <Transition appear show={isOpen} as={Fragment} unmount>
                <Dialog as="div" className="relative z-10 focus:outline-none" onClose={cancel}>
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child 
                                className="w-full flex justify-center"
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 transform-[scale(95%)]"
                                enterTo="opacity-100 transform-[scale(100%)]"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 transform-[scale(100%)]"
                                leaveTo="opacity-0 transform-[scale(95%)]"
                              >
                                <Dialog.Panel className="w-full sm:w-4/5 rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                                    <Dialog.Title as="h3" className="text-base/7 font-medium text-white">
                                        <div className="flex flex-row space-x-6 items-center">
                                            <p>{title}</p>
                                            {createLink && createLabel && (
                                            <Link href={createLink} target="_blank" className="underline underline-offset-2">
                                                {createLabel}
                                            </Link>
                                            )}
                                        </div>                                    
                                    </Dialog.Title>
                                    <div className="mt-2 text-sm/6 text-white/50">
                                        <div className={`grid w-full grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-${rowSize}`}>
                                            { files && files.map((f) => (
                                            <div className={selectedFile==f ? "border-2 border-red-500 " : ""}>
                                                { fileType.indexOf("USER")<0 && fileType.indexOf("VIDEO")>=0 && f.outputImage && f.outputImage.endsWith(".mp4") && (
                                                <Video preload="none"
                                                    className="w-auto"
                                                    src={f.outputImage}
                                                    poster={f.inputImage ? getThumbnail(f.inputImage, thumbSize) : getVideoPoster(f.outputImage)}
                                                    controls={!du.isMobile()}
                                                    // autoPlay
                                                    height={512}
                                                    width={512}
                                                    onClick={ ()=> setSelectedFile(f) }     
                                                    onDoubleClick={ ()=> { setSelectedFile(f); select(f) } } 
                                                />
                                                )}
                                                {fileType.indexOf("USERVIDEO")>=0 && f.url && f.url.endsWith(".mp4") && (
                                                <Video preload="none"
                                                    className="w-auto"
                                                    src={f.url}
                                                    poster={getVideoPoster(f.url)}
                                                    controls={!du.isMobile()}
                                                    // autoPlay
                                                    height={512}
                                                    width={512}
                                                    onClick={()=> setSelectedFile(f) }       
                                                    onTouchStart={() => setSelectedFile(f)}                                                                                                        
                                                    onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }   
                                                />
                                                )} 
                                                
                                                {fileType.indexOf("USER")<0 && fileType.indexOf("VOICE")>=0 && f.outputImage && 
                                                    (f.outputImage.toLowerCase().endsWith(".mp3") || f.outputImage.toLowerCase().endsWith(".wav") || f.outputImage.toLowerCase().endsWith(".ogg")) && (
                                                <Link className="min-h-64 justify-between bg-gray-800 justify-top flex flex-col" href="#"
                                                        onClick={()=> setSelectedFile(f) } 
                                                        onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }                                                       
                                                    >
                                                    <div className="text-white text-left mt-8 mb-10 left-5 text-sm" >
                                                        <span> {`“${f.prompt ? (f.prompt.length>60 ? (f.prompt.substring(0,60)+"...") : f.prompt) : "......"}”`} </span>
                                                    </div>
                                                    <audio id="audioPlayer" key={f.outputImage} controls className="w-full pt-2 mb-5">
                                                        <source src={f.outputImage} type="audio/mpeg"/>
                                                        <source src={f.outputImage} type="audio/wav"/>
                                                        <source src={f.outputImage} type="audio/ogg"/>                                                        
                                                    </audio>                
                                                </Link>
                                                )}
                                                {fileType.indexOf("USERVOICE")>=0 && (
                                                <div className="justify-between bg-gray-800 justify-top flex flex-col">
                                                    <Link className="text-white text-left mt-8 mb-10 left-5 text-sm" href="#" 
                                                        onClick={()=> setSelectedFile(f) } 
                                                        // onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }       
                                                        >
                                                        <span> {f?.createTime?.toString()} </span>
                                                        <audio id="audioPlayer" key={f.url} controls className="w-full pt-2 ">
                                                            <source src={f.url} type="audio/mpeg"/>
                                                            <source src={f.url} type="audio/wav"/>
                                                            <source src={f.url} type="audio/ogg"/>                                                               
                                                        </audio>                
                                                        <div className="mt-10">
                                                            &nbsp;
                                                        </div>                                                                            
                                                    </Link>
                                                </div>
                                                )} 
                                                
                                                {fileType.indexOf("USER")<0 && fileType.indexOf("IMAGE")>=0 && (
                                                <Image
                                                    alt="AI作品"
                                                    width={thumbSize}
                                                    src={f.outputImage}
                                                    className=" object-cover h-auto w-1/8"
                                                    loading="lazy"
                                                    onClick={() => setSelectedFile(f)}
                                                    onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }                                                      
                                                />
                                                )}  
                                                {fileType.indexOf("USERIMAGE")>=0 && (
                                                <Image
                                                    alt="用户文件"
                                                    width={thumbSize}
                                                    src={f.url}
                                                    className=" object-cover h-auto w-1/8"
                                                    loading="lazy"
                                                    onClick={() => setSelectedFile(f)}
                                                    onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }                                                       
                                                />
                                                )}  
                                                
                                                {fileType.indexOf("RAWDATA")>=0 && (
                                                <div className="w-full flex flex-col">                                               
                                                    <Image
                                                        alt="数据文件"
                                                        width={thumbSize}
                                                        src={getFileIcon(f.url)}
                                                        className=" object-cover h-auto w-1/8"
                                                        onClick={() => setSelectedFile(f)}
                                                        onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }                                                           
                                                    />
                                                    <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                                                        <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" } >
                                                            {f.name}
                                                        </span> 
                                                    </div>  
                                                </div>                                                   
                                                )}  

                                                {fileType.indexOf("ALBUM")>=0 && (
                                                <div className="w-full flex flex-col">                                               
                                                    <Image
                                                        alt="图片模型"
                                                        width={thumbSize}
                                                        src={f.coverImg}
                                                        className=" object-cover h-auto w-1/8"
                                                        onClick={() => setSelectedFile(f)}
                                                        onDoubleClick={ ()=> { setSelectedFile(f); select(f) } } 
                                                    />
                                                    <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                                                        <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" } >
                                                            {f.name.substring(0, 24)}
                                                        </span> 
                                                    </div>  
                                                </div>                                                    
                                                )}                                                
                                                {fileType.indexOf("LORAMODEL")>=0 && (
                                                showModel(f, (m:any,url:string) => {setSelectedFile(m)}, " rounded-xl ",  " text-gray-100 ", 
                                                          (m:any,url:string) => {setSelectedFile(f); select(f)} )                                                
                                                )}
                                                {fileType.indexOf("PROMPT")>=0 && (
                                                showPrompt(f, (m:any) => {setSelectedFile(m)}, 
                                                          (m:any) => {setSelectedFile(f); select(f)} )                                                
                                                )}                                                
                                                {fileType.indexOf("CHATMODEL")>=0 && (
                                                <div className="w-full flex flex-col">                                               
                                                    <Image
                                                        alt="对话模型"
                                                        width={thumbSize}
                                                        src={f.coverImg}
                                                        className=" object-cover h-auto w-1/8"
                                                        onClick={() => setSelectedFile(f)}
                                                        onDoubleClick={ ()=> { setSelectedFile(f); select(f) } }   
                                                    />
                                                    <div className="flex flex-row items-left text-xs space-x-0 sm:mt-3 mt-2 py-1 w-full">
                                                        <span className= { "flex text-center  space-x-2 px-2 hover:bg-blue-400 hover:text-white bg-white-600 transition" } >
                                                            {f.name.substring(0, 24)}
                                                        </span> 
                                                    </div>  
                                                </div>
                                                )}
                                                {fileType.indexOf("VOICEMODEL")>=0 && (
                                                <div className="justify-between bg-gray-800 justify-top flex flex-col">
                                                    <Link className="text-white text-left mt-8 mb-10 left-5 text-sm" href="#"
                                                        onClick={() => setSelectedFile(f)}    
                                                        onDoubleClick={ ()=> { setSelectedFile(f); select(f) } } 
                                                        >
                                                        <span> {`【${f.theme == "MALE" ? "男声" : "女声"}】${f.name}`} </span>
                                                    </Link>
                                                    <audio id="audioPlayer" controls className="w-full pt-2 ">
                                                        <source src={f.desc} type="audio/mpeg" />
                                                    </audio>                
                                                    <div className="mt-10">
                                                        &nbsp;
                                                    </div>          
                                                </div>
                                                )}                                                
                                            </div>
                                            ))}
                                        </div>
                                        <Pagination pageCount={pageCount} currentPage={currentPage} 
                                            onPageChange={(page) => {
                                                if(onPageChange){
                                                    onPageChange(page);
                                                }
                                            }} 
                                            />                   
                                        
                                    </div>
    
                                    <div className="mt-4 space-x-8 flex flex-row justify-center w-full">
                                        <button
                                            className=" px-8 py-2 mt-8 button-gold"
                                            onClick={() => select(selectedFile)}
                                            >
                                            选择
                                        </button>
                                        <button
                                            className=" px-8 py-2 mt-8 button-main"
                                            onClick={() => cancel()}
                                            >
                                            取消
                                        </button>   
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>            
    );
}
