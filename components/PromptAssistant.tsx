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

interface PromptAssistantProps {
    user: any;
    title?: string;
    userPrompt: string;
    className?: string;
    isOpened?: boolean;    
    promptType?: string;
    model?: string; // 出图的模型
    
    onUserPromptChange?: (newPrompt:string) => void;
    onOK: (aiPrompt: string) => void;
    onCancel?: () => void;
    onOpen?: () => void;
}

export const languageNames = new Map();
languageNames.set("zh","中文（易于阅读）");
languageNames.set("en","英文（执行准确）");

export default function PromptAssistant({ 
    user, title="AI辅助创意", userPrompt, promptType="CREATE_IMAGE", model="flux-pro-ultra",
    className="hidden sm:flex button-green-blue text-xs px-2 py-1 mt-3", isOpened,
    onOpen, onOK, onCancel, onUserPromptChange,
}: PromptAssistantProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [prompt, setPrompt] = useState<string>("");
    const [AIPrompt, setAIPrompt] = useState<string>("");
    const [loading, setLoading] = useState(false);
    //let AIPrompt:string="";
    const [hideMsg, setHideMsg] = useState("");
    const [language, setLanguage] = useState("zh");
    
    const aiPromptRef = useRef<HTMLTextAreaElement>(null);

    let placeholder:string;
    let buttonTitle:string;
    let hotWords:string;
    let modelId:string;
    switch(promptType){
        case "CREATE_LYRIC":
            title="DeepSeek写歌词";
            placeholder="AI将根据您的创意内容，生成一首歌词";       
            buttonTitle="生成歌词";
            hotWords="LYRIC_ASSISTANT";
            modelId=system.chatModels.lyricsAssistant.id;
            break;
        case "CREATE_IMAGE":
        default:
            title="DeepSeek创意";
            placeholder="AI将根据您的创意内容，生成细节丰富的提示词";       
            buttonTitle="生成创意";
            hotWords="PROMPT_ASSISTANT";
            modelId=system.chatModels.promptAssistant.id;
    }
    
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

    useEffect(() => {
        if(userPrompt){
            setPrompt(userPrompt);
        }else{
            setPrompt("");
        }
    }, [userPrompt]); 
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //发送消息
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function generate(inputText:string){
        
        if(!inputText || inputText.length<1){
            alert("请先输入您的创意吧！");
            return;
        }

        if(!inputText || inputText.length>1000){
            alert("每次输入的内容不能大于1000个字符，请简化一下您的创意吧！");
            return;
        }    
        
        if(!user){
            alert("AI辅助创意操作需要先登录系统再开始！");
            fu.safeWindowOpen("/loginChoice", "_blank");
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);    

        // 准备输入的数据
        const messages:{role:string, content:string, name:string}[] = [];

        let question:string = "";
        switch(promptType){
            case "CREATE_LYRIC":
                question=`创作一首歌词，内容是关于“${inputText}”。`;
                break;
            case "CREATE_IMAGE":
            default:
                // question=`把“${inputText}”扩充成可以用${model}生成照片的提示词，要对画质，摄影角度，摄影师风格，作品的高水平都做出要求。只输出提示词，不要给任何其它解释。`;
                question=`把“${inputText}”扩充成可以用AI生成图片的提示词，要对画质，视角，风格，作品的高水平都做出要求。只输出提示词，不要给任何其它解释。`;                
        }

        switch(language){
            case "en":
                question += "Please output the results in English!"
                break;
                
            case "zh":
            default:
                question += "请用中文输出结果！"
                break;
        }
            
        // 压入当前的问题
        messages.push({
            role: "user",
            // content: "请把以下提示词扩充成一个细节丰富的Stable Diffusion生成照片的提示词，要对画质，摄影角度，摄影师，作品的高水平都做出要求：\n" + inputText,
            content: question,
            name: user?.id || user?.email || Date.now().toString(),
        });         
          
        try{
            const res = await fetch("/api/chat?CMD=prepareChat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: messages, 
                    modelId,
                    historyRound: 0,
                }),
            });        
            
            if (res.status === 200) {                
                let response = await res.json();
                // 开始陆续接收内容
                const streamUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/chat?CMD=chatStream&key=${response}`;
                debug.log(streamUrl);
                
                const source = new EventSource(streamUrl);
                let content = "";
                let realChunk = 0;
                
                source.onmessage = (event) => {
                    if(event.data.trim().indexOf('[DONE]') < 0){
                        const retMsg = JSON.parse(event.data);
                        debug.log("Delta:", retMsg.content);
                        if(retMsg.type == "REASON"){
                            realChunk = 0;
                        }else{
                            realChunk ++;
                        }

                        if(realChunk == 1){
                            content = "";
                        }
                        
                        content = `${content}${retMsg.content}`;
                        setAIPrompt(content);
                        setHideMsg(retMsg.content);                         

                    }else{
                        debug.log("[DONE]");
                        source.close();
                        setLoading(false);
                    }
                };
                
                //source.addEventListener('message', function (e) {
                //  debug.log(e.data)
                //})   
                
                source.onopen = function(){
                    debug.log("event source is opened");
                };
                source.onerror = function(){
                    debug.log("sth is wrong");
                };
                
            }else if(res.status == 201){ 
                // 没有内容返回
                setTimeout(() => {
                    setLoading(false);
                }, 200);   
                return;
            }else if(res.status == 401){
                alert("请先登录，再开始对话");
                fu.safeWindowOpen("/loginChoice", "_blank");
                return;
            }else if(res.status == 402){
                alert("您的余额不足，请先充值，再来尝试哦！");
                fu.safeWindowOpen("/buy-credits", "_blank");
            }else{
                alert("系统发生未知错误，请和管理员联系！");
                return;
            }

        }catch(e){
            alert("系统对话发生未知错误，请和管理员联系");
            debug.error(e);
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
                                                {title}-让AI帮您生成细节更丰富的创意
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
                                                <div className="w-full items-center justify-start">
                                                    <PromptArea
                                                        userPrompt={prompt}
                                                        onUserPromptChange={(up) => {
                                                            setPrompt(up);
                                                            if(onUserPromptChange){
                                                                onUserPromptChange(up);
                                                            }
                                                        }}
                                                        hasAdvanceButton={false}
                                                        readOnly = {loading}
                                                        />                     
                                                </div>
                                                <div className="w-full flex flex-row items-center justify-start">
                                                    <RadioChoice values={languageNames} selectedValue={language} onSelect={
                                                        (value:any)=>{
                                                            setLanguage(value);
                                                        }}
                                                    />
                                                </div>                                                
                                            </div>
            
                                            <div className="flex flex-row justify-between px-10 mt-20 w-full">
                                                <div className="">
                                                    {loading ? (
                                                    <button className="button-gold px-16 py-2">
                                                        <LoadingDots color="white" style="small" />
                                                    </button>
                                                    ) : (
                                                    <button className=" button-gold px-8 py-2"
                                                        onClick={()=>generate(userPrompt)}
                                                        >                                          
                                                        <span>{buttonTitle}</span>
                                                    </button>                                                        
                                                    )}
                                                </div>

                                                <div className="flex flex-row space-x-8 justify-center">
                                                    <button disabled={(!AIPrompt || loading) ? true : undefined}
                                                        className={((AIPrompt && !loading) ? "button-gold " : "button-dark ") + " px-8 py-2"}
                                                        onClick={() => OK(AIPrompt)}
                                                        >
                                                        使用
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
