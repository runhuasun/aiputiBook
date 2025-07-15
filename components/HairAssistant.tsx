import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect, useRef } from 'react';
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";

import Pagination from '../components/Pagination';
import PromptArea from '../components/PromptArea';
import LoadingDots from "../components/LoadingDots";
import FormLabel from "../components/FormLabel";
import RadioChoice from "../components/wrapper/RadioChoice";

import { getFileIcon } from "../utils/rawdata";
import * as du from "../utils/deviceUtils";
import * as debug from "../utils/debug";
import {system} from "../utils/config";
import * as fu from "../utils/fileUtils";
import {callChatStream} from "../utils/apiUtils";


interface PromptAssistantProps {
    userImage?: string;
    user: any;
    title?: string;
    className?: string;
    isOpened?: boolean;    
    promptType?: string;
    model?: string; // 出图的模型
    
    onOK: (ret: Map<string, string>) => void;
    onCancel?: () => void;
    onOpen?: () => boolean;
}

export const languageNames = new Map();
languageNames.set("zh","中文（易于阅读）");
languageNames.set("en","英文（执行准确）");

export default function PromptAssistant({ 
    userImage,
    user, title="AI发型设计", promptType="CREATE_IMAGE", model="flux-pro-ultra",
    className="hidden sm:flex button-green-blue text-xs px-2 py-1 mt-3", isOpened,
    onOpen, onOK, onCancel, 
}: PromptAssistantProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [prompt, setPrompt] = useState<string>("");
    const [AIPrompt, setAIPrompt] = useState<string>("");
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);
    //let AIPrompt:string="";
    const [hideMsg, setHideMsg] = useState("");
    const [language, setLanguage] = useState("zh");
    
    const aiPromptRef = useRef<HTMLTextAreaElement>(null);

    const placeholder="发型对颜值影响太大了，让AI根据您独一无二的气质形象为您设计几款发型吧！";       
    const buttonTitle="开始设计";
    
    function open() {
        if(onOpen){
            if(onOpen()){
                setIsOpen(true);    
            }else{
                setIsOpen(false);
            }
        }else{
            setIsOpen(true);
        }
        setResult("");
    }

    function OK(np:string) {
        setIsOpen(false);
        if(np){
            const hairMap = parseHairStyleMap(np);
            if(hairMap){
                onOK(hairMap);
            }
        }
        setAIPrompt("");   
        setResult("");
    }

    function cancel() {
        setIsOpen(false);
        if(onCancel){
            onCancel();
        }
        setAIPrompt("");        
        setResult("");
    }

    function parseHairStyleMap(input: string): Map<string, string> {
        const result = new Map<string, string>();
        
        const lines = input
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0); // 去掉空行
        
        const regex = /^\d+\.\s*([^\[]+?)\s*\[([^\]]+?)\]/;
        
        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const chinese = match[1].trim().replace(/[,，。]$/, ''); // 去除中文末尾标点
                const english = match[2].trim().replace(/[,，。]$/, ''); // 去除英文末尾标点
                console.log(`E: ${english}, C: ${chinese}`);
                result.set(english, chinese);
            } else {
                console.warn(`跳过格式错误的行: "${line}"`);
            }
        }
    
        return result;
    }

    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //发送消息
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function generate(){
      
        if(!user){
            alert("AI设计发型功能需要先登录系统再开始！");
            fu.safeWindowOpen("/loginChoice", "_blank");
            return;
        }

        let question:string = 
          `根据人物的性别，年龄，脸型，气质，发量，发质等因素，判断人物最适合什么样的发型和发色。给出五个类似以下格式的中英文答案：
          1. 波波头，棕色 [Bob cut, Brown],
          2. 好莱坞卷，栗色 [Pixie Cut, Light Brown], 
          3... 
          要简洁坚定的给出答案。不要解释，只给出发型+发色的答案。`;

        if(userImage){
            setLoading(true);    
            await callChatStream(
                user, question, userImage, system.chatModels.hairAssistant.id, 
                (content:string, realContent:string, retMsg:string) => {
                    setAIPrompt(content);
                    setResult(realContent);
                    setHideMsg(retMsg);                             
                },
                (content:string, realContent:string) => {
                    setTimeout(() => {
                        setLoading(false);
                    }, 200);                              
                }
            );                       
        }
    }

    if(!user){
        return (<div></div>);
    }

    return (
        <div className="w-30 flex flex-row text-xs">
            <div className="flex w-full">
                
                <div className="w-full h-3/4-screen">
                    <button className={className}
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
                                        <Dialog.Panel className="w-full flex flex-col items-center sm:w-4/5 rounded-xl bg-gray-700 p-6 backdrop-blur-2xl">
                                            <Dialog.Title as="h3" className="text-base/7 font-medium text-white">
                                                {title}
                                            </Dialog.Title>
                                            
                                            <div className="w-full items-center text-sm/6 text-white/50 px-10 mt-2">
                                                <div className="w-full">
                                                    {/* 隐藏属性，只是为了通过更新数值来强制刷新 */}
                                                    <input className="hidden" value={hideMsg}></input>                                                    
                                                    <TextareaAutosize id="iptPrompt" ref={aiPromptRef}   tabIndex={-1}
                                                        minRows={10} maxRows={15}
                                                        className="w-full min-h-[12rem] bg-slate-800 text-gray-100 border border-gray-600 focus:ring-green-800 rounded-lg font-medium px-4 py-2 " 
                                                        value={AIPrompt}
                                                        placeholder={placeholder}                                                        
                                                        readOnly = { true }
                                                        onChange={(e) => {
                                                            // setUserPrompt(e.target.value);
                                                            // setAIPrompt(e.target.value);
                                                        }} />                                            
                                                </div>
                                            </div>
            
                                            <div className="flex flex-row justify-between px-10 mt-20 w-full">
                                                <div className="">
                                                    {loading ? (
                                                    <button className="button-gold px-16 py-2">
                                                        <LoadingDots color="white" style="small" />
                                                    </button>
                                                    ) : (
                                                    <button className={`${AIPrompt ? "button-dark" : "button-gold"} px-8 py-2`} disabled={!!AIPrompt}
                                                        onClick={()=>generate()}
                                                        >                                          
                                                        <span>{buttonTitle}</span>
                                                    </button>                                                        
                                                    )}
                                                </div>

                                                <div className="flex flex-row space-x-8 justify-center">
                                                    <button disabled={(!AIPrompt || loading) ? true : undefined}
                                                        className={((AIPrompt && !loading) ? "button-gold " : "button-dark ") + " px-8 py-2"}
                                                        onClick={() => OK(result)}
                                                        >
                                                        确认
                                                    </button>
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
