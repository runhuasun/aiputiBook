import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect, useRef } from 'react';
import React from 'react';
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { useSession, signIn } from "next-auth/react";

import Image from "./wrapper/Image";
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


interface loginDialogProps {
    config: any;
    isOpened?: boolean;    
    onOpen?: () => void;
    onOK?: () => void;
    onCancel?: () => void;  
    className?: string;
    children?: React.ReactNode;     
}


export default function loginDialog({config, onOpen, onOK, onCancel, isOpened, children, className=""}: loginDialogProps) {
    
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [loading, setLoading] = useState(false);

    const [QRCode, setQRCode] = useState<string>();
    const [loginStatus, setLoginStatus] = useState<string>("WAIT");
    const [loginToken, setLoginToken] = useState<string>();

    const timerRef = useRef(0);
    
    useEffect( () => {
        if(du.isWeixinBrowser()){
            fu.safeWindowOpen("/loginChoice?signInWechat=true", "_blank");
            cancel();
        }else if(du.isMobile()){
            fu.safeWindowOpen("/loginChoice", "_blank");
            cancel();
        }else{
            getQRCode();
        }
    }, []); 
    
    const title = `扫码关注公众号即可完成登录`;
    
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

    async function getQRCode(){
        const token = Date.now().toString();
        setLoginToken(token);
        const res = await callAPI("/api/signInWechat", {
            cmd:"GET_QRCODE", loginToken: token });
        if (res.status != 200) {
            alert(JSON.stringify(res.result as any));
        }else{
            setQRCode(res.result);
        }
    }

    const isApiCallingRef = useRef(false); // 新增：用于跟踪API调用状态的ref

    useEffect(() => {
        // 若满足条件，则启动定时器
        if(loginToken && loginStatus === "WAIT"){
            const interval = setInterval(() => {
                // 如果计时器计数小于60且没有正在进行的API调用，则进行API调用
                if(timerRef.current < 60 && !isApiCallingRef.current){
                    isApiCallingRef.current = true; // 标记API调用开始
                    callAPI("/api/signInWechat", { cmd: "GET_LOGIN_STATUS", loginToken })
                        .then((res) => {
                            if (res.status === 200) {
                                setLoginStatus("SUCCESS");
                                // setIsOpen(false);
                                signIn("credentials", {redirect: false, email: res.result.unionid, password: "wechat"})
                                    .then((signInResult) => {
                                        // 处理登录结果
                                        // OK();
                                    });
                            }
                        })
                        .finally(() => {
                            isApiCallingRef.current = false; // 无论成功或失败，标记API调用结束
                            timerRef.current += 1; // 更新计时器计数
                        });
                } else if (timerRef.current >= 60) {
                    clearInterval(interval); // 停止定时器
                    OK(); // 这里假设OK()是您要执行的某些操作
                }
            }, 2000);

            // 清理：清理定时器
            return () => clearInterval(interval);
        }
        
        // 清理操作可以放到这里，但若在此函数（useEffect回调）的上方定义停止定时器和重置计数器，可能更紧凑和清晰
        return () => {
            timerRef.current = 0;
            isApiCallingRef.current = false; // 确保重置API调用状态
        };
    }, [loginToken, loginStatus]); // 添加依赖项


    return (
        <div className={className}>
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
                                <Dialog.Panel className="w-4/5 sm:w-[700px] flex flex-col items-center  rounded-xl bg-white/5 py-6 backdrop-blur-2xl">
                                    <Dialog.Title as="h3" className="font-medium py-1 text-base sm:text-xl">
                                        {title}
                                    </Dialog.Title>
                                    
                                    <div className="w-full flex flex-row items-center justify-center text-sm/6 text-white/50 px-0 mt-2 ">
                                        <div className="relative w-1/2 flex flex-col items-center justify-center">
                                            <Image alt="注册" src={`${config.registerBG}`} className="w-full h-auto"/>                                            
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-2 w-full flex flex-col space-y-5 items-center text-sm sm:text-2xl text-white tracking-wider">
                                                <p>现在注册账号，您将获得</p>
                                                <p>{ config.freeCredits }个免费的“{ config.creditName }”</p>                                            
                                            </div>
                                        </div>
                                        <div className="flex flex-1 h-full flex-col items-center justify-center space-y-3">
                                            {loginStatus === "WAIT" && QRCode && (
                                            <Image alt="照片" src={QRCode} className="w-full h-auto"/>
                                            )}
                                            {loginStatus === "WAIT" && !QRCode && (
                                            <LoadingDots color="white" style="large"/>
                                            )}
                                            {loginStatus === "SUCCESS" && (
                                            <div className="w-full h-full flex flex-col items-center justify-center space-y-5  bg-black opacity-70">
                                                <p className="text-2xl sm:text-3xl text-gray-100 font-bold tracking-widest">登录成功</p>
                                                <p className="text-lg sm:text-xl text-gray-300 font-bold tracking-tracking-wide">请关闭登录窗口，继续您的操作吧！</p>                                  
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {loginStatus !== "SUCCESS" && (                                    
                                    <Link className="mt-2 text-gray-200 text-sm sm:text-base" href={`/loginChoice?loginToken=${loginToken}`} target="_blank"
                                        onClick={()=>{
                                            //e.preventDefault(); // 阻止默认跳转
                                            cancel();
                                        }}>
                                        使用手机号码或微信扫码登录请点击<span className="underline underline-offset-2">其它登录方式</span>
                                    </Link>
                                    )}

                                    <div className="flex flex-row justify-center space-x-10 px-10 mt-10 w-full">
                                        <div>
                                            <button className={ (loginStatus == "SUCCESS" ? "button-gold" : "button-main") + " px-8 py-2"}
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
    );
}

            
