import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react"
import { useRouter } from "next/router";
import React, { useEffect, useState } from 'react';



export default function Footer({websiteName}: {websiteName?:string} ) {
    const { data: session, status } = useSession();
    const router = useRouter();
    
    const [inWeixin, setInWexin] = useState(false);
    
    useEffect(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isWechat = userAgent.indexOf('micromessenger') !== -1;
        setInWexin(isWechat);
        
      if (isWechat) {
          console.log('当前页面在微信浏览器内');
      } else {
          console.log('当前页面不在微信浏览器内');
      }
    }, []);

    let icpCode = "京ICP备2023008470号";
    let companyName = "北京明快信息科技有限公司";
    switch(websiteName){
        case "niukit":
        case "aimoteku":
        case "aixiezhen":
        case "aiputi":
            icpCode = "京ICP备2023008470号";
            companyName = "北京明快信息科技有限公司";
            break;
        case "haiwan":
            icpCode = "京ICP备14002764号";
            companyName = "北京洋景科技有限公司";
            break;
    }
    if(!inWeixin && ((websiteName == "niukit") || (websiteName == "aiyishu") || (websiteName == "aiputi") || (websiteName == "haiwan")) ){
        
        return (
            <footer className="hidden sm:flex flex-col h-16 sm:h-20 w-full text-center items-center  sm:pt-2 pt-4 border-t mt-5 justify-between px-3 space-y-3 sm:mb-0 mb-3 mt-10 border-gray-500">
                <div className="text-gray-500 text-center items-center justify-center">
                    <p className=" hover:underline transition hover:text-gray-100 underline-offset-2">
                        Copyright ©2025 {companyName}保留所有权利
                    </p>
                    {websiteName != "haiwan" && (
                    <>
                    <Link  href="/site/aboutus"  target="_blank"  rel="noreferrer" className=" hover:underline transition hover:text-gray-100 underline-offset-2 pr-5" >
                        关于我们
                    </Link>
                    <Link href="/site/aboutus" target="_blank" rel="noreferrer" className=" hover:underline hover:text-gray-100 transition underline-offset-2 pr-5">
                        联系方式
                    </Link>
                    <Link href="/site/terms" target="_blank" rel="noreferrer" className=" hover:underline hover:text-gray-100 transition underline-offset-2 pr-5">
                        服务条款
                    </Link>
                    </>
                    )}
                    <Link href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noreferrer" className=" hover:underline transition hover:text-gray-100 underline-offset-2">
                        {icpCode}
                    </Link>
                </div>
            </footer>
        );
    }else{
        if(inWeixin){
            return(
                <div className="w-full flex flex-col items-center">
                    <p className="text-gray-400 text-sm">更多神奇的爆款创意工具，请访问我们的官方网站：</p>
                    <p className="text-gray-200 text-base">www.niukit.com</p>                    
                </div>
            );
        }else{
            return(
                <div>
                </div>
            );
        }
    }
}
