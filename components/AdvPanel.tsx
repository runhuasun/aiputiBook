import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react';
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";

import Pagination from '../components/Pagination';
import PromptArea from '../components/PromptArea';
import LoadingDots from "../components/LoadingDots";

import { getFileIcon } from "../utils/rawdata";
import * as du from "../utils/deviceUtils";
import * as debug from "../utils/debug";
import {system} from "../utils/config";


interface AdvPanelProps {
    user: any;
    title?: string;
    className?: string;
    isOpened?: boolean;    

    onOK: (aiPrompt: string) => void;
    onCancel?: () => void;
    onOpen?: () => void;
}


export default function advPanel({ 
    user,
    title="AI辅助创意",
    onOpen, onOK, onCancel,
    isOpened 
}: AdvPanelProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [prompt, setPrompt] = useState<string>("");
    const [AIPrompt, setAIPrompt] = useState<string>("");
    const [loading, setLoading] = useState(false);
    //let AIPrompt:string="";
    const [hideMsg, setHideMsg] = useState("");


    
    function open() {
        if(onOpen){
            onOpen();
        }
        setIsOpen(true);
    }

    function OK(np:string) {
        setIsOpen(false);
        if(np){
            onOK(np);
            setAIPrompt("");
        }
    }

    function cancel() {
        setIsOpen(false);
        if(onCancel){
            onCancel();
            setAIPrompt("");
        }
    }

    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //发送消息
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function generate(inputText:string){
      
        try{

        }catch(e){
            alert("系统对话发生未知错误，请和管理员联系");
            debug.error(e);
        }
  }

    if(!user){
        return (<div></div>);
    }
    
    return (
        <div className="w-30 flex flex-ro text-xs">
            <div className="flex w-full">
                
                <div className="w-full h-3/4-screen">
                    <button className="button-main text-sm text-gold-200 px-2 py-1"
                        onClick={() => {
                            open();
                        }} >
                        <p>{title}</p>
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
                                        <Dialog.Panel className="w-full flex flex-col items-center sm:w-4/5 rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                                            <Dialog.Title as="h3" className="text-base/7 font-medium text-white">
                                                {title}-专业的AI写真服务
                                            </Dialog.Title>
                                            
                                            <div className="w-full items-center text-sm/6 text-white/50 px-10 mt-2">
                                                <div className="w-full">
                                                </div>
                                                <div className="w-full items-center justify-start">
                                                </div>
                                            </div>
            
                                            <div className="flex flex-row justify-center px-10 mt-20 w-full">
                                                <div className="flex flex-row space-x-8 justify-center">
                                                    <button
                                                        className=" px-8 py-2 button-main"
                                                        onClick={() => cancel()}
                                                        >
                                                        取消
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
