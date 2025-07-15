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
import validator from 'validator';
import  isMobilePhone from 'validator';

import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
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


export default function registerUser( { config }: { config: any } ) {
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const [loginToken, setLoginToken] = useState(router?.query?.loginToken);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    let inviteBy = router.query.inviteBy as string;
    const originalUrl = router.query.originalUrl ? decodeURIComponent(router.query.originalUrl as string) : undefined;
    
    const [regMethod, setRegMethod] = useState("PHONE");
    const [veriCode, setVeriCode] = useState("");
    const [email, setEmail] = useState("");
    const [password1, setPassword1] = useState("");
    const [password2, setPassword2] = useState("");
    const [inviteCode, setInviteCode] = useState(inviteBy || "");
    const [username, setUsername] = useState("");
    const [genCode, setGenCode] = useState("");
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
    
    
    function generateRandomNumber(n: number) {
        const digits = Array.from({ length: n }, () => Math.floor(Math.random() * 10));
        return digits.join('');
    }    

    async function sendVeriCode(){
        if(needCaptcha && (captchaAnswer != captchaQuestion?.text)){
            return alert("您还没有通过机器人验证，请再试试！");
        }
        
        if(!validator.isMobilePhone(email, 'zh-CN')){
            alert("您输入的手机号码格式不正确，请检查！");
            return;
        }
        
        const code = generateRandomNumber(4);
        disableSendBtn();
        
        const res = await callAPI("/api/sendMobileMsg", {phone: email, message: code, captchaAnswer, captchaQuestion});
        if (res.status !== 200) { 
            alert(res.result);
            setError(res.result as any);
        } else {
            setGenCode(code);
            alert(`验证码发送成功，请在手机短信里查看发送给您的4位验证吗`);
        }    
    }
    
    const [isEnabled, setIsEnabled] = useState(false);
    const handleMouseEnter = () => {
        setIsEnabled(true);  // 当鼠标进入按钮区域时，立即启用按钮
    };    
    
    function disableSendBtn() {
        var button = document.getElementById("sendVeriCode") as HTMLInputElement;
        if(button){
            button.disabled = true;
            //setIsEnabled(false);
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
                    setGenCode("");
                 }
            }, 1000);
        }
    }


    
    async function registeUser() {
      
        if(regMethod == "EMAIL"){
            if(email.trim() == ""){
                alert("EMail地址不能为空");
                return;
            }else if(password1.trim() == ""){
                alert("密码不能为空");
                return ;
            }else if(!validator.isEmail(email)){
                alert("当前输入的不是合理得email地址，请检查并修改");
                return ;
            }
        }else{
            if(!validator.isMobilePhone(email, 'zh-CN')){
                return alert("请填写一个正确的手机号码，并获得短信验证码，再完成注册！");
            }
            if(!genCode){
                return alert("短信验证码还未发送或者已经过期！请发送一个短信验证码给您的手机。");
            }
            if(!veriCode){
                return alert("短信验证码不能为空！");
            }
            if(veriCode != genCode ){
                return alert("您输入的短信验证码不正确，请检查!");
            }
            if(!password1){
                return alert("密码不能为空");
            }
        }

        // 通过URL的邀请
        if(!inviteBy){
            const urlParams = new URLSearchParams(window.location.search);
            inviteBy = urlParams.get('inviteBy') as string;
        }
        // 如果ＵＲＬ没有邀请，那么使用输入的邀请码
        if(!inviteBy){
            inviteBy = inviteCode;
        }
        
        if((config.inviteReg=="TRUE") && ( !inviteBy || inviteBy.length<4 || inviteBy.length>30 ) ){
            alert("系统要求必须提供一个4-30位的邀请码才能注册");
            return;
        }
      
        // 初始用户名采用随机生成的8位数字
        const name = "U" + generateRandomNumber(8);
        const res = await callAPI("/api/createuser", {name: name, email: email, password:password1, invitecode:inviteBy});
        if (res.status !== 200) {
            alert(res.result);
            setError(res.result as any);
        } else {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const result = await signIn("credentials", {
              redirect: false,
              email,
              password1,
            });   
            if(result && result.ok){
                if(config.freeCredits>0){
                    alert("我们已经往您的注册邮箱中发送了一封验证邮件，您验证后我们将免费赠送您" + 
                  config.freeCredits + "个" + config.creditName + "。您可以继续使用这个账号，但是为了您的账户安全，请您及时验证！");
                }
                window.location.href = originalUrl ? (originalUrl as string) : "/";
            }else{
                alert("您的账号已经注册成功！请登录您刚注册的账号。");
                let currentURL = new URL(window.location.href);
                currentURL.pathname = "/login";
                window.location.href = currentURL.href;                
            }
        }
    }

    let num = 1;
    
    return (
        <TopFrame config={config}>
            
            <main>
                <h1 className="title-main">
                    现在开始免费注册
                </h1>
                
                <div className="w-full flex flex-col items-center max-w-xl">
                    {status === "authenticated" ? (
                    <>
                         <div className="space-y-4 w-full text-base">
                            你已经登录{config.appName}了，请
                            <Link
                                href={originalUrl ? (originalUrl as string) : "/"}
                                className="font-semibold text-blue-200 underline underline-offset-2 hover:text-gray-100 transition"
                                >  返回                  
                            </Link>                      
                            开始使用吧！
                        </div>
                    </>
                    ) : (
                    <div className="w-full">
                        <div className="w-full flex flex-col items-center space-y-3 page-tab rounded-xl py-10 px-2 sm:px-10">
                            {config.emailLogin && (
                            <div>
                                <label className="px-3">
                                    <input type="radio" value="PHONE" checked={regMethod === 'PHONE'} onChange={(e) => setRegMethod(e.target.value)}  />
                                    手机注册
                                </label>
                                <label className="px-3">
                                    <input type="radio"  value="EMAIL" checked={regMethod === 'EMAIL'} onChange={(e) => setRegMethod(e.target.value)} />
                                    邮箱注册
                                </label>
                            </div>                    
                            )}
                            {regMethod == "PHONE" ? (
                            <div className="space-y-4 w-full"> 
                                <FormLabel number={`${num++}`} label="手机号码"/>
                                <input id="iptEmail" type="tel" value = {email}
                                    className="input-main" 
                                    onChange={(e) => setEmail(e.target.value)} />   
                            </div>
                            ) : (
                            <div className="space-y-4 w-full">  
                                <FormLabel number={`${num++}`} label="Email地址"/>
                                <input id="iptEmail" type="email" value = {email}
                                    className="input-main" 
                                    onChange={(e) => setEmail(e.target.value)} />                        
                            </div>
                            )}
            
                      {/*
                  <div className="space-y-2 w-full max-w-sm hidden">
                      <div className="flex mt-3 items-center space-x-3">
                          <Image src="/number-2-white.svg" width={30} height={30} alt="4 icon"/> 
                          <p className="text-left font-medium">
                              用户名字
                          </p>
                      </div>
                 
                        <input id="iptUserName" type="username" value = {username}
                        className="input-main" 
                        onChange={(e) => setUsername(e.target.value)} />
                  </div>      
                    */}

                            {needCaptcha && (
                            <div className="space-y-4 w-full">  
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
                      
                            {regMethod == "PHONE" && (
                            <div id="veriCode" className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label="短信验证码"/>
                                <div className="flow flow-row w-full">
                                    <input id="iptVeriCode" type="input" value = {veriCode}
                                        className="bg-white px-4 sm:mt-0 mt-2 w-2/3 h-12  text-black font-medium border hover:bg-gray-100 transition " 
                                        onChange={(e) => setVeriCode(e.target.value)} />
                                    <button id="sendVeriCode" name="sendVeriCode"
                                        onClick={() => {
                                            sendVeriCode();
                                        }}
                                        onMouseEnter={handleMouseEnter} 
                                        className="button-main-rect w-1/3 h-12 space-x-2 rounded-none px-5 py-2 "
                                        >
                                        <span>发送验证</span>
                                    </button>                           
                                </div>    
                            </div>
                            )}
       
                            <div className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label="设置密码（请牢记）"/>
                                <input id="iptPassword1" type="password" value = {password1}
                                    className="input-main" 
                                    onChange={(e) => setPassword1(e.target.value)} />
                            </div>
                      {/*
                  <div className="space-y-2 w-full max-w-sm hidden ">
                    <div className="flex mt-3 items-center space-x-3">
                      <p className="text-left font-medium">
                        确认密码
                      </p>
                    </div>
                 
                    <input id="iptPassword2" type="password" value = {password2}
                    className="input-main" 
                    onChange={(e) => setPassword2(e.target.value)} />

                  </div>
            */}
                      
                            {config.inviteReg != "FALSE" && (
                            <div className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label={`邀请码${config.inviteReg=="OPTION" ? "（可选）" : ""}`}/>
                                <input id="iptInviteCode" type="text" value = {inviteCode}
                                    className="input-main" 
                                    onChange={(e) => setInviteCode(e.target.value)} />
                            </div>
                            )}
                      
                            <div className="space-y-4 w-full  items-center">
                                <div className="flex flex-col mt-8 items-center justify-between ">
                                    {(regMethod=="EMAIL" && email && password1) || (regMethod=="PHONE" && veriCode && genCode && (veriCode == genCode)) ? (
                                    <button 
                                        onClick={() => {
                                            registeUser();
                                        }}
                                        className="flex w-full items-center justify-center space-x-2 rounded-lg  px-5 py-4 button-gold"
                                        >
                                        <span>完成注册</span>
                                    </button>                 
                                    ) : (
                                    <button 
                                        onClick={() => {
                                            registeUser();
                                        }}                                        
                                        className="flex w-full items-center justify-center space-x-2 rounded-lg  px-5 py-4 button-dark"
                                        >
                                        <span>完成注册</span>
                                    </button>                 
                                    )
                                    }
                                    <div className="group flex flex-row text-gray-400 w-full px-5 py-4 "> 
                                        <span>已经有账号，</span>                                        
                                        <Link href="#" className="group-hover:text-gray-100 underline underline-offset-2"
                                            onClick={() => {
                                                window.location.href = "/login?a=b" + 
                                                    (inviteBy ? ("&inviteBy=" + inviteBy) : "") + 
                                                    (originalUrl ? ("&originalUrl=" + encodeURIComponent(originalUrl as string)) : "") +
                                                    (loginToken ? `&loginToken=${loginToken}` : "");        
                                            }}
                                        >
                                        前往登录
                                        </Link>
                                    </div>
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

// export default Home;
