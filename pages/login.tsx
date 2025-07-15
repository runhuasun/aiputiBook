import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import  isMobilePhone from 'validator';
import validator from 'validator';

import { UserData } from "./api/checkuser";

import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import LoginPage from "../components/LoginPage";
import FormLabel from "../components/FormLabel";
import Image from "../components/wrapper/Image";

import {config} from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";




export async function getServerSideProps(ctx: any) {    
    monitor.logUserRequest(ctx);
    return {
        props: {
            config,
        }
    };
}        




export default function login( { config }: { config: any } ) {
    const router = useRouter();
    const [loginToken, setLoginToken] = useState(router?.query?.loginToken);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [regMethod, setRegMethod] = useState("PHONE");
    const [phoneMethod, setPhoneMethod] =useState("PASSWORD");
    const [veriCode, setVeriCode] = useState("");
    const [genCode, setGenCode] = useState("");
    
    const originalUrl = router.query.originalUrl ? decodeURIComponent(router.query.originalUrl as string) : undefined;

    let inviteBy = router.query.inviteBy;


    const [captchaAnswer, setCaptchaAnswer] = useState<string>("");
    const [captchaQuestion, setCaptchaQuestion] = useState<any>();
    const [captchaTimes, setCaptchaTimes] = useState<number>(0);
    
    const needCaptcha = config.registerCaptcha;    
    // 定义每分钟执行的函数
    const generateCaptcha = useCallback(() => {
        if(captchaTimes > 20){
            return alert("您请求机器人验证码过于频繁，请稍后再尝试！");
        }else{
            callAPI("/api/captcha", {height:48, background:"#ADADAD"}).then((res)=>{
                if (res.status !== 200) { 
                    alert("机器人验证码生成失败，请刷新页面重试！");
                } else {
                    setCaptchaQuestion(res.result);
                }          
            });
            setCaptchaTimes(captchaTimes+1);
        }
    }, []);
    useEffect(() => {
        if(needCaptcha){
            // 初次执行一次
            generateCaptcha();
    
            // 设置每分钟执行一次的定时器
            const interval = setInterval(() => {
                generateCaptcha();
            }, 120000); // 120000 毫秒 = 2 分钟
    
            // 清除定时器，防止内存泄漏
            return () => clearInterval(interval);
        }
    }, [generateCaptcha]);
    
    async function login() {
        
        if(email.trim() == ""){ 
            return alert("手机号/EMail地址不能为空");
        }
        
        if(password == ""){
            if(regMethod == "EMAIL" || phoneMethod == "PASSWORD"){
                return alert("密码不能为空");
            }
        }

        let result:any;
        if(regMethod == "PHONE" && phoneMethod == "VERICODE"){
            if(veriCode == genCode ){            
                result = await signIn("credentials", {
                    redirect: false,
                    email,
                    password:"密码错误！!！请重新输入!！!",
                });
            }else{
               // alert(genCode);
               // alert(veriCode);
                return alert("验证码输入错误！");
            }
        }else{
            result = await signIn("credentials", {
                redirect: false,
                email,
                password,
            });
        }        
        
        if(result){
            if(result.ok){
                const res = await callAPI("/api/remaining", {});
                let resData = await res.result;   
                if(res.status == 200 && !resData.emailVerified && config.freeCredits>0){
                    alert("我们已经往您的注册邮箱中发送了一封验证邮件，您验证后我们将免费赠送您" + config.freeCredits + "个" + config.creditName + 
                          "。您可以继续使用这个账号，但是为了您的账户安全，请您及时验证！");
                }
                window.location.href = originalUrl ? (originalUrl as string) : "/";
            }else{
                alert(result.error);
            }
        }else{
            alert("登录发生未知错误，请重新尝试或和管理员联系！");
        }
    }


    function generateRandomNumber(n: number) {
        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        return randomNumber.toString().substring(0, n);
    }    

    async function sendVeriCode(){
        if(needCaptcha && (captchaAnswer != captchaQuestion?.text)){
            return alert("您还没有通过机器人验证，请再试试！");
        }
        
        if(!validator.isMobilePhone(email, 'zh-CN')){
            alert("您输入的手机号码格式不正确，请检查！");
            return;
        }
        
        const gc = generateRandomNumber(4);
        setGenCode(gc);
        disableSendBtn();
        
        const res = await callAPI("/api/sendMobileMsg", {phone: email, message: gc, captchaAnswer, captchaQuestion});
        if (res.status !== 200) { 
            alert(res.result);
            setError(res.result as any);
        } else {
            alert(`验证码发送成功，请在手机短信里查看发送给您的4位验证吗`);
        }    
    }

    function disableSendBtn() {
        var button = document.getElementById("sendVeriCode") as HTMLInputElement;
        if(button){
            button.disabled = true;
            button.style.backgroundColor = "gray";
            var count = 60;
            var countdown = setInterval(function(){
                count--;
                button.innerHTML = count + "秒";
                if (count == 0) {
                    clearInterval(countdown);
                    button.disabled = false;
                    button.style.backgroundColor = "";
                    button.innerHTML = "发送验证";
                 }
            }, 1000);
        }
    }

    let num = 1;
    
    return (
        <TopFrame config={config}>

            <main>
                { (status != "authenticated") && (
                <h1 className="title-main">
                    登录{config.appName}
                </h1>
                )}
                
                <div className="w-full flex flex-col items-center max-w-xl">
                    {status === "authenticated" ? (
                    <>
                        <div className="space-y-4 w-full text-base ">
                            { "你已经登录" + config.appName + "了，请返回" }
                            <Link  href="/" className="font-semibold text-blue-200 underline underline-offset-2 hover:text-gray-100 transition" >                    
                                主页
                            </Link>  
                            开始使用吧！
                        </div>
                    </>
                    ) : (
                    <div className="w-full flex flex-col items-center space-y-6 page-tab rounded-xl py-10 px-2 sm:px-10">
                        <div>
                            <label className="px-3">
                                <input type="radio" value="PHONE" checked={regMethod === 'PHONE'} onChange={(e) => setRegMethod(e.target.value)} />
                                手机登录
                            </label>
                            <label className="px-3">
                                <input type="radio" value="EMAIL" checked={regMethod === 'EMAIL'} onChange={(e) => setRegMethod(e.target.value)}/>
                                邮箱登录
                            </label>
                        </div>                    
                  
                        <div className="space-y-2 w-full ">
                            <FormLabel number={`${num++}`} label={regMethod == "PHONE" ? "手机号" : "Email地址"}/>
                            <input id="iptEmail" type="text" value = {email}  className="input-main" onChange={(e) => setEmail(e.target.value)} />
                        </div>

                        {(regMethod == "EMAIL" || (regMethod == "PHONE" && phoneMethod == "PASSWORD")) && (
                        <div className="space-y-2 w-full">
                            <div className="flex flex-row items-center">
                                <FormLabel number={`${num++}`} label="密码"/>
                                { regMethod == "PHONE" && (
                                <button className="mt-3 text-left font-medium" onClick={()=>{setPhoneMethod("VERICODE")}}>
                                    （验证码登录）
                                </button>
                                )}            
                            </div>
                            <input id="iptPassword" type="password" value = {password} className="input-main" onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        )}

                        {regMethod == "PHONE" && phoneMethod == "VERICODE" && needCaptcha && (
                        <div className="space-y-2 w-full">  
                            <FormLabel number={`${num++}`} label="验证机器人"/>
                            <div className="w-full flex flex-row items-center">
                                <Image src={captchaQuestion?.base64}  className="cursor-pointer" 
                                    width={200} height={48} alt="captcha icon" 
                                    onClick={()=>{generateCaptcha()}}/>
                                <input id="iptCaptcha" type="input" value = {captchaAnswer}
                                    className="flex flex-1 bg-white px-1 sm:px-4 h-12 border text-black font-medium" 
                                    onChange={(e) => setCaptchaAnswer(e.target.value)} />                        
                            </div>
                        </div>                            
                        )}
                        
                        {regMethod == "PHONE" && phoneMethod == "VERICODE" && (
                        <div id="veriCode" className="space-y-2 w-full ">
                            <div className="flex flex-row items-center space-x-3">
                                <FormLabel number={`${num++}`} label="验证码"/>
                                { regMethod == "PHONE" && (
                                <button className="mt-3 text-left font-medium" onClick={()=>{setPhoneMethod("PASSWORD")}}>
                                    （密码登录）
                                </button>
                                )}            
                            </div>
                            <div className="flow flow-row w-full">
                                <input id="iptVeriCode" type="input" value = {veriCode}
                                    className="bg-white ounded-full px-4 sm:mt-0 mt-2 w-2/3 h-12  text-black border font-medium  hover:bg-gray-100 transition " 
                                    onChange={(e) => setVeriCode(e.target.value)} />
                                <button id="sendVeriCode" name="sendVeriCode"
                                    onClick={() => {
                                        sendVeriCode();
                                    }}
                                    className=" page-main w-1/3 h-12 space-x-2 rounded-none px-5 py-2 "
                                    >
                                    <span>发送验证</span>
                                </button>                           
                            </div>    
                        </div>
                        )}                        
                   
                        <div className="space-y-4 w-full items-center">
                            <div className="flex flex-col mt-5 items-center justify-between">
                                <button  onClick={() => { login();  }}  className=" button-gold flex w-full items-center justify-center rounded-lg  px-5 py-4">
                                    <span>登录账号</span>
                                </button>     
                                <div className="group flex flex-row text-gray-400 w-full px-5 py-4 "> 
                                    <span>还没有账号，</span>   
                                    <Link href="#" className="group-hover:text-gray-100 underline underline-offset-2"
                                        onClick={() => {
                                            window.location.href = "/registerUser?a=b" + 
                                                (inviteBy ? ("&inviteBy=" + inviteBy) : "") + 
                                                (originalUrl ? ("&originalUrl=" + encodeURIComponent(originalUrl as string)) : "") +
                                                (loginToken ? `&loginToken=${loginToken}` : "");        
                                        }}
                                    >
                                    前往注册
                                    </Link>
                                </div>  
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </main>
        </TopFrame>
    );
    
};

