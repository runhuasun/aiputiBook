import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect, useRef } from 'react';
import React from 'react';
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { useSession, signIn } from "next-auth/react";

import Image from "./wrapper/Image";
import Video from "./wrapper/Video";

import Pagination from '../components/Pagination';
import PromptArea from '../components/PromptArea';
import LoadingDots from "../components/LoadingDots";

import { getFileIcon } from "../utils/rawdata";
import * as du from "../utils/deviceUtils";
import * as debug from "../utils/debug";
import {system} from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import * as enums from "../utils/enums";
import * as fu from "../utils/fileUtils";

interface MediaViewerProps {
    title?: string;
    text?: string;
    src?: string;
    mediaType?: string;
    config: any;
    isOpened?: boolean;    
    onOpen?: () => void;
    onOK?: () => void;
    onCancel?: () => void;  
    className?: string;
    children?: React.ReactNode;     
}


export default function MediaViewer({title="查看照片", src, text="照片", mediaType="IMAGE",
                                     config, onOpen, onOK, onCancel, isOpened, children, className="w-30 flex flex-row text-xs"}: MediaViewerProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [loading, setLoading] = useState(false);

    const [buttonText, setButtonText] = useState<string>(text);
    const [dialogTitle, setDialogTitle] = useState<string>(title);
    const [currentMediaType, setCurrentMediaType] = useState<string>(mediaType);
    
    useEffect(() => {
        if(src){
            const type = fu.getFileTypeByURL(src) || mediaType;
            setCurrentMediaType(type);
            switch(type){
                case "VIDEO":
                    setDialogTitle(title || "观看视频");
                    setButtonText(text || "视频");
                    break;
                case "VOICE":
                    setDialogTitle(title || "欣赏音频");
                    setButtonText(text || "音频");
                    break;
                case "IMAGE":
                default:
                    setDialogTitle(title || "查看照片");
                    setButtonText(text || "照片");
                    break;                
            }            
        }
    }, [src]);
    
    function open() {
        if(onOpen){
            onOpen();
        }
        setIsOpen(true);
    }

    function OK() {
        setIsOpen(false);
        if(onOK){
            onOK();
        }
    }
  
    function cancel() {
        setIsOpen(false);
        if(onCancel){
            onCancel();
        }
    }

    return (
        <div>
            <div className="flex w-full">
                <div className="w-full h-3/4-screen">
                    <button className={className}
                        onClick={() => {
                            open();
                        }} >
                        <p>{buttonText}</p>
                    </button>            
                    <Transition appear show={isOpen} as={Fragment}>
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
                                        <Dialog.Panel className="w-4/5 flex flex-col items-center  rounded-xl bg-white/5 py-6 backdrop-blur-2xl">
                                            <Dialog.Title as="h3" className="font-medium px-20 py-1 text-xl">
                                                {dialogTitle}
                                            </Dialog.Title>
                                            
                                            <div className="w-full flex flex-row items-center justify-center text-sm/6 text-white/50 px-0 mt-2">
                                                {src && currentMediaType == "VIDEO" && (
                                                <video controls={true} loop autoPlay 
                                                    className={"h-auto w-auto max-w-full mx-10"}
                                                    src={src} 
                                                    poster={src}                     
                                                    />                                     
                                                 )}
                                                {src && currentMediaType == "IMAGE" && (
                                                <Image alt="照片" src={src} className="w-auto h-auto max-w-full"/>
                                                 )}
                                                {src && currentMediaType == "VOICE" && (
                                                <audio id="audioPlayer" controls className="w-3/4">
                                                    <source src={src} type="audio/mpeg"/>
                                                    <source src={src} type="audio/wav"/>
                                                    <source src={src} type="audio/ogg"/>
                                                </audio>                                     
                                                 )}
                                            </div>
        
                                            <div className="flex flex-row justify-center space-x-10 px-10 mt-10 w-full">
                                                <div>
                                                    <button className="button-main px-8 py-2"
                                                        onClick={()=>OK()}
                                                        >                                          
                                                        <span>关闭</span>
                                                    </button>                                                        
                                                </div>
                                            </div>
        
                                        </Dialog.Panel>
                                    </Transition.Child>
                                </div>
                            </div>
                        </Dialog>
                    </Transition>
                </div>
            </div>
        </div>
    );
}

            
