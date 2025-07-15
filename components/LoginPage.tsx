import {GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import React from 'react';

import Image from "./wrapper/Image";

// declare var WxLogin: any;


export default function LoginPage({config}: {config:any}){
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    const [loginToken, setLoginToken] = useState(router?.query?.loginToken);
    const [regMethod, setRegMethod] = useState("PHONE");
    const email = (session && session.user) ? session.user.email : null;
    
    const [weixinAppId, setWeixinAppId] = useState(config.weixinAppId);
    const [weixinWebAppId, setWeixinWebAppId] = useState(config.weixinWebAppId);
    
    let inviteBy = router.query.inviteBy;
    const isLoging = router.query.code;
    let originalUrl = router.query.originalUrl as string;
    if(originalUrl){
        originalUrl = decodeURIComponent(originalUrl);
    }
    
    React.useEffect(() => {
        if(status === "authenticated"){
            if(originalUrl){
                window.location.href = originalUrl;
            }else{
                window.location.reload();
            }
        }else{
            // 如果没有微信登录方式就直接跳转到普通登录
            if(!config.wechatLogin){
              //  goPhoneLoginPage();            
            }        
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        inviteBy = urlParams.get('inviteBy') ? urlParams.get('inviteBy') as string : undefined;  
        const signInWechat = urlParams.get('signInWechat');
        
        if((code && state) || signInWechat){
            signinWeixinInside(weixinAppId, weixinWebAppId, email, (inviteBy? inviteBy as string : undefined), config.website);
        }
    }, []);
    

    function goPhoneLoginPage(){
        window.location.href="/login?method=PHONE&originalUrl=" + 
            (originalUrl ? encodeURIComponent(originalUrl as string) : encodeURIComponent(window.location.href)) + 
            (inviteBy ? ("&inviteBy=" + inviteBy) : "") + 
            (loginToken ? `&loginToken=${loginToken}` : "");        
    }

    function goRegisterPage(){
        window.location.href="/registerUser?a=b&method=PHONE&originalUrl=" + 
            (originalUrl ? encodeURIComponent(originalUrl as string) : encodeURIComponent(window.location.href)) + 
            (inviteBy ? ("&inviteBy=" + inviteBy) : "") + 
            (loginToken ? `&loginToken=${loginToken}` : "");        
    }    

    //----------------------------------------------
    // 处理微信登录
    //----------------------------------------------
    async function signinWeixinInside(weixinAppId:string, weixinWebAppId:string, email:string | undefined | null, inviteBy:string | undefined, website:string){
        // 如果当前还没有登录
        if(!email){
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            // const originalUrl = urlParams.get('originalUrl') ? decodeURIComponent(urlParams.get('originalUrl') as string) : undefined;
            
            // 如果没有code说明还未弹出用户确认授权框
            if(!code){
                let url = new URL(window.location.href);
                url.hostname = website;
                let redirect = encodeURIComponent(url.href);
/*
var obj = new WxLogin({
    id: "wxLogin",
    appid: weixinWebAppId, // "你的appid",
    scope: "snsapi_login",
    redirect_uri: redirect, // encodeURIComponent("你的回调地址"),
    state: "STATE#wechat_redirect",
    style: "",
    href: "" // 可选，指定自定义样式 CSS 文件地址
});
*/
                const callWechat = isWeixinBrowser() ? 
                    ( "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" +
                     weixinAppId + "&redirect_uri=" + redirect + 
                     "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect&forcePopup=true"
                    ) : 
                    ( "https://open.weixin.qq.com/connect/qrconnect?appid=" + 
                     weixinWebAppId + "&redirect_uri=" + redirect + 
                     "&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect"
                    );
                window.location.href = callWechat; //  + (originalUrl ? ("&originalUrl=" + originalUrl as string) : "");
            }else{
                // 用户已经授权，接下来获得用户的各种信息
                const signInType = isWeixinBrowser() ? "INSIDE" : "WEB";
                const result = await fetch("/api/signInWechat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ code: code, inviteBy: inviteBy, signInType: signInType, loginToken }),
                });
                
                const userdata = await result.json();
                if(userdata && userdata.email){
                    const result = await signIn("credentials", {
                        redirect: false,
                        email: userdata.email,
                        password: "wechat",
                    });  
                    if(result && result.ok){
                        if(originalUrl){
                            window.location.href = originalUrl;
                        }else{
                            window.location.reload();
                        }
                    }else{
                        alert("微信登录失败，请选择其它登录方式");
                        window.location.href="/loginChoice";
                    }
                }
                
            }
        }
        
    }    
    
    return (
        <div className="flex mx-auto flex-col items-center justify-center min-h-screen">
<Head>
  <script src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js" />
</Head>            
            <Header config={config}/>

            <main>
                { !isLoging && status != "authenticated" && config.freeCredits>0 && (
                <h1 className="text-white text-lg sm:text-xl">
                    现在注册账号，您会得到{ config.freeCredits }个免费的“{ config.creditName }”！
                </h1>
                )}

                <div className="w-full flex flex-col items-center">
                    {status === "authenticated" ? (
                    <div className="w-full flex flex-col items-center mt-20">
                        <p className="text-white text-lg">登录成功！请关闭当前窗口，返回刚才页面继续操作吧！</p>
                        <button className="button-green-blue text-base mt-10 px-8 py-4"
                            onClick={()=>{
                                window.close();
                            }}
                            >
                            关闭窗口
                        </button>
                    </div>
                    ) : isLoging ? (
                    <div className="flex flex-col items-center space-y-6 max-w-[670px] -mt-8">
                        <span className="font-semibold text-gray-400">&nbsp;</span>
                        <div className="max-w-xl text-lg text-gray-400">
                            微信正在授权登录中，请稍等5秒钟！不要刷新页面。
                        </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center space-y-6 max-w-[670px] ">
                        <span className="font-semibold text-gray-400">&nbsp;</span>
                        <div className="w-full max-w-xl text-xl text-white space-y-2">
                            <p className="text-xl text-white">请选择登录方式</p>
                            <p className=" hidden text-lg text-gray-400">“我们严格保护您的隐私，和个人信息安全！”</p>
                        </div>
                        {config.wechatLogin && (
                        <div className="space-y-4 w-full max-w-sm ">
                            <button
                                onClick={() => {
                                    // @ts-ignore
                                    signinWeixinInside(weixinAppId, weixinWebAppId, email, inviteBy, config.website);
                                }}
                                className="button-green-blue h-20 text-xl flex w-full items-center justify-center space-x-2 rounded-lg px-5 py-2  shadow-md "
                                >
                                <span>微信授权登录</span>
                            </button>  
                            {/*     <div id="wxLogin" className="w-96 h-96"></div>  */}
                            
                        </div>
                        )}

                        <div className="space-y-4 w-full max-w-sm hidden">
                            <button
                                onClick={() => {
                                    signIn("WechatWebProvider");
                                }}
                                className="button-green-blue h-20 text-xl flex w-full items-center justify-center space-x-2 rounded-lg px-5 py-2 text-sm "
                                >
                                <span>微信扫码登录</span>
                            </button>    
                        </div>
                        
                        <div className="space-y-4 w-full mt-10 max-w-sm ">
                            <button className="button-green-blue h-20 text-xl flex w-full items-center justify-center space-x-2 rounded-lg px-5 py-2 "
                                onClick={() => {
                                    goPhoneLoginPage();
                                }}                              
                                >
                                <span>手机号码登录</span>
                            </button>  
                        </div>       

                        <div className="w-full pt-20 flex flex-col items-center">
                            <Image src={`${config.RS}/bg/computerPower.jpg`} className="w-full h-auto" alt="computer power"/>
                        </div>                   
                     </div>
                  )}
    
            </div>
    
           
                
          </main>
            <Footer websiteName={config.websiteName}/>
        </div>
      );
};

    


 
export function isWeixinBrowser() {
  var ua = navigator.userAgent.toLowerCase();
  return (/micromessenger/.test(ua)) ? true : false;
}    
    
