import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import * as debug from "../utils/debug";
import {callAPI} from "../utils/apiUtils";
import { config } from "../utils/config";
import { useEffect } from 'react';
import { initBaiduAnalytics } from '../utils/baidu';
import Script from 'next/script';
import { alert, confirm, AlertProvider } from '../components/MessageDialog';
import { Tooltip } from "react-tooltip";

import "../styles/globals.css";
import "react-tooltip/dist/react-tooltip.css";


function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // 保存原生方法
            const nativeAlert = window.alert;
            const nativeConfirm = window.confirm;
            
            // 创建自定义 alert 函数
            const customAlert = function(message: string, title?: string): void {
                if (arguments.length === 1) {
                    // 同步调用 - 立即执行不等待
                    alert(message).catch(() => {});
                    return;
                }
                // 异步调用 - 返回 Promise
                return alert(message, title) as unknown as void;
            } as Window['alert'];
            
            // 添加原生方法引用
            Object.defineProperty(customAlert, 'native', {
                value: nativeAlert,
                writable: false,
                enumerable: true
            });
            
            // 创建自定义 confirm 函数
            const customConfirm = function(message: string, title?: string): boolean {
                if (arguments.length === 1) {
                    // 同步调用 - 立即返回 boolean
                    return confirm(message).then(result => result) as unknown as boolean;
                }
                // 异步调用 - 返回 Promise
                return confirm(message, title) as unknown as boolean;
            } as Window['confirm'];
            
            // 添加原生方法引用
            Object.defineProperty(customConfirm, 'native', {
                value: nativeConfirm,
                writable: false,
                enumerable: true
            });
            
            // 覆盖原生方法
            window.alert = customAlert;
            window.confirm = customConfirm;
        }
        
        initDeamonThreads();
        initBaiduAnalytics();
    }, []);

    return (
        <>
            <Tooltip
                id="default-tooltip-id"
                place="bottom"
                offset={30}
                noArrow={false}
                delayShow={100}
                className="!text-sm !px-4 !py-2 !z-[9999] !bg-gray-700 !text-gray-100 !rounded-xl !border !border-white !text-left !break-words !tracking-wider !max-w-sm"
                style={
                    {
                        "--rt-arrow-background": "#4b5563",
                        "--rt-arrow-border": "1px solid white",
                    } as React.CSSProperties
                }
                />
            
            <SessionProvider session={session}>    
                <AlertProvider />
                    
                <Script
                    id="baidu-analytics"
                    strategy="afterInteractive"
                    src="https://hm.baidu.com/hm.js?0b49d2a67a43a4c02acb7a4e06bbd8be"
                />      
                <Component {...pageProps} />
            </SessionProvider>            
        </>
    );
}

export default MyApp;

export function initDeamonThreads(){
    debug.log("-------------_app.tsx invoking deamon thread---------------");
    callAPI(config.website+"/api/deamonThread", {}).then((res) => {
        if(res.status == 200){
            debug.log("从_app.tsx启动守护进程成功");
        }else{
            debug.error("从_app.tsx启动守护进程发生错误：");
            debug.error(res.result);
        }
    });
}
