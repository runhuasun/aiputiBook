import { config } from "../utils/config";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react"
import React, { useEffect, useState } from 'react';

import Image from "./wrapper/Image";

import * as fu from "../utils/fileUtils";

export default function UserHeader({config, noMargin }: { config?:any, noMargin?: boolean }) {
  
  const { data: session, status } = useSession();

  const photo = (session?.user?.grade != null) ? `${config.RS}/grade/${session.user.grade}.jpg` : `${config.RS}/default/user.png`;
  
  const email = session?.user?.email || undefined;
  const appName = config?.appName ? config.appName : "AI菩提";
  const websiteName = config?.websiteName ? config.websiteName : "aiputi";
  const creditName = "充值"; // config?.creditName ? config.creditName : "提子";
  const [inWeixin, setInWexin] = useState(false);
  const defaultPage = config?.defaultPage!;
  
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


  if(!inWeixin){
        return (
          <div>
          <header className="fixed top-0 left-0 w-full z-50 flex flex-col opacity-70 bg-black shadow-md text-white xs:flex-row justify-between items-center  py-2 sm:px-4 px-2 gap-2">
            <Link href={defaultPage} className="flex flex-row items-center space-x-2">
                {config.logoPNG && (
                <Image alt={appName} src={config.logoPNG} className="p-1 h-12"  />
                )}
                <h1 className="ml-2 tracking-tight text-logo">
                    {appName}
                </h1>
            </Link>
            
            {email && (
        
              <div className="flex items-center space-x-3 sm:space-x-5 sm:text-lg text-sm">
                <Link
                  href={defaultPage}
                  className="text-title "
                >
                  <div>首页</div>
                </Link>     
        
                <Link
                  href="/profile"
                  className="text-title "
                >
                  <div>设置</div>
                </Link>          
              
                <Link
                  href="/buy-credits"
                  className="text-title pr-2 "
                >
                  <div>{creditName}</div>
                </Link>

                
                {photo ? (
                  (websiteName === "aiputi") ? (
                      <Link href="/dashboard?segment=CHATMODEL&noMenu=true&func=chat" className="flex space-x-2">
                        <Image alt="" src={fu.getImageIcon(photo)} className="w-10 rounded-full" style={{ width: '32px', height: '32px' }}/>
                      </Link>
                  ) : (
                      <Link href="/dashboard" className="flex space-x-2">
                        <Image alt="" src={fu.getImageIcon(photo)} className="w-10 rounded-full" style={{ width: '32px', height: '32px' }}/>
                      </Link>
                  )
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white" />
                )}
              </div>
            ) }
          </header>
     
            <div className="userHeaderMargin">
            </div>
        
        </div>      
        );
  }else{
    return(
      <div>
      </div>
    );
  }
}
