// components/TopFrame.tsx
import React from "react";
import { useRouter } from "next/router";

import Header from "./Header";
import HeaderH from "./HeaderH";

import Footer from "./Footer";

interface TopFrameProps {
  children: React.ReactNode;
  config: any; // 可选参数，类型任意
  showMiniHeader?: boolean;
}

export default function TopFrame({ children, config, showMiniHeader }: TopFrameProps) {
    const router = useRouter();
  
  // 你可以在这里使用 config，例如调试输出：
  // console.log("TopFrame config:", config);

//      func: takeIDPhoto , help={"https://aiputifile.oss-cn-beijing.aliyuncs.com/aixiezhen/help/takeIDPhoto.jpg"}
    return (
        <div className="w-full sm:w-auto flex 
            flex-col lg:flex-row 
            items-center lg:items-start 
            justify-start lg:justify-center 
            min-h-screen"> 
            
            {!router?.query?.hideHeader && (
            <>
                {/* 竖版菜单布局*/}
                <div className="hidden lg:block">
                    <Header config={config} title={config?.appName} showMiniHeader={showMiniHeader}/>
                </div>
                
                {/* 横版菜单布局*/}
                <div className="lg:hidden">
                    <HeaderH config={config} title={config?.appName}/>
                </div>
            </>       
            )}
            
            <div className="w-full lg:w-auto flex flex-col lg:flex-1 items-center">
                {children}
                <Footer websiteName={config?.websiteName} />
            </div>
            
        </div>
    );
}
