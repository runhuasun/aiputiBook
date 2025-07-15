/////////////////////////////////////////////////////////
//  2025-7-1 15:04  改成竖版的菜单
//////////////////////////////////////////////////////////

import Head from "next/head";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react"
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from "next/router";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Icon } from '@iconify/react';

import LoginDialog from "../components/LoginDialog";
import MediaViewer from "../components/MediaViewer";
import Image from "./wrapper/Image";

import {channelType, channels, channelNames  } from "../utils/channels";
import * as g from "../utils/grade";
import * as fu from "../utils/fileUtils";
import { AIFuncs, defaultTools, imageTools, videoTools, audioTools, aiTools, cameraList } from "../utils/funcConf";

export default function Header({config, noMargin, title, subTitle, icon, desc, help, showMiniHeader=true }: 
                               { config?:any, noMargin?: boolean, title?:string, subTitle?:string, icon?:string, desc?:string, help?:string, showMiniHeader?:boolean }) {
    
    const { data: session, status } = useSession();

    const [showLogin, setShowLogin] = useState<boolean>(false);
    const [showMini, setShowMini] = useState<boolean>(showMiniHeader);
    const headerRef = useRef<HTMLDivElement>(null);
  
    const photo = (session?.user?.grade != null) ? `${config?.RS}/grade/${session.user.grade}.jpg` : `${config?.RS}/default/user.png`;
    const email = session?.user?.email;
    const credits = session?.user?.credits;
    const gradeName = g.getGradeName(config, session?.user?.grade || 0);

    const router = useRouter();
    let inviteBy = router.query.inviteBy;
    const appName = config?.appName || "NIUKIT";
    const appSlogan = config?.appSlogan;  
    const websiteName = config?.websiteName || "niukit";
    const defaultPage = config?.defaultPage!;
    const website = config?.website || "";
 
    const [inWeixin, setInWexin] = useState(false);
    const [currentURL, setCurrentURL] = useState<string>("");
  
    // 判断是否在微信浏览器内
    useEffect(() => {
       // if(typeof window != undefined){
       //     alert(`device innerWidth: ${window.innerWidth}, ${window.devicePixelRatio}, ${navigator.userAgent}`);
       // }
      
        fu.redirectToNewDomain(config?.website);     
      
        const userAgent = navigator.userAgent.toLowerCase();
        const isWechat = userAgent.indexOf('micromessenger') !== -1;
        setInWexin(isWechat);
        setCurrentURL(window.location.href);
    }, []);


    const miniBarWidth = 40;
  
    useEffect(() => {
        if (status === "loading") return;      // 等 session 状态稳定
      
        // If user is not logged in, force showMini to false
        if (status != "authenticated" ) {
            setShowMini(false);
            return;
        }

        // Add click outside listener if in mini mode
        if (showMini) {
            const handleMouseMove = (e: MouseEvent) => {
                // 只在靠近左侧边缘 24px 范围内才展开
                if (e.clientX <= miniBarWidth) {
                    setShowMini(false);
                }
            };
            window.addEventListener("mousemove", handleMouseMove);
            return () => window.removeEventListener("mousemove", handleMouseMove);          
        }{
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    headerRef.current &&
                    !headerRef.current.contains(event.target as Node)
                ) {
                    // 等待本次 click 及导航等行为完成后再折叠
                    setTimeout(() => setShowMini(true), 0);
                }
            };
            document.addEventListener("click", handleClickOutside);
            return () => {
                document.removeEventListener("click", handleClickOutside);
            };
        }
    }, [showMini, status]);


    useEffect(() => {
        if (!showMiniHeader) return;
        
        const handleMouseMove = (e: MouseEvent) => {
            // 只在靠近左侧边缘 24px 范围内才展开
            if (e.clientX <= 24) {
                setShowMini(false);
            }
        };
        
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [showMiniHeader]);
    
  
    function isAITool(url:string){
        if(url.indexOf("/createPrompt") >= 0){
            return false;
        }else if(url.indexOf("/AITools") >= 0){
            return true;
        }else{
            let tools = defaultTools;
            if(config?.websiteName == "aixiezhen"){
              tools = aiTools;        
            };
            const path = (url.split("?"))[0];          
            for(const t of tools){
                if(path.endsWith(t.url)){
                    return true;
                }
            }
        }
    }

    function isImageTool(url:string){
        if(url.indexOf("/imageTools") >= 0 || isCreatePrompt(url)){
            return true;
        }else{
            const tools = imageTools;
            const path = (url.split("?"))[0];          
            for(const t of tools){
                if(path.endsWith(t.url)){
                    return true;
                }
            }
        }
    }
    function isVideoTool(url:string){
        if(url.indexOf("/videoTools") >= 0){
            return true;
        }else{
            const tools = videoTools;
            const path = (url.split("?"))[0];          
            for(const t of tools){
                if(path.endsWith(t.url)){
                    return true;
                }
            }
        }
    }
    function isAudioTool(url:string){
        if(url.indexOf("/audioTools") >= 0){
            return true;
        }else{
            const tools = audioTools;
            const path = (url.split("?"))[0];          
            for(const t of tools){
                if(path.endsWith(t.url)){
                    return true;
                }
            }
        }
    }  

    function isCamera(url:string){
        if(url.indexOf("/cameraList") >= 0){
            return true;
        }else{
            const tools = cameraList;
            const path = (url.split("?"))[0];          
            for(const t of tools){
                if(path.endsWith(t.url)){
                    return true;
                }
            }
        }
    }

    function isStyle(url:string){
        if( (url.indexOf("/styleMarket")>=0) ||
            (url.indexOf("/lora")>=0 && url.indexOf("channel=ART")>=0) ||
            (url.indexOf("/lora")>=0 && url.indexOf("channel=DRAW")>=0) ||
            (url.indexOf("/lora")>=0 && url.indexOf("channel=PORTRAIT")>=0) ||
            (url.indexOf("/lora")>=0 && url.indexOf("channel=ARCH")>=0) ||
           (url.indexOf("/lora")>=0 && url.indexOf("channel=COMIC")>=0) 
          ){
            return true;
        }else{
            return false;
        }
    }
  
    function isFashion(url:string){
        if( (url.indexOf("/VDH")>=0) ||
            (url.indexOf("/createLoRA")>=0 && url.indexOf("channel=FASHION")>=0) ||
            (url.indexOf("/lora")>=0 && url.indexOf("channel=FASHION")>=0) ||
            (url.indexOf("/showImageModel")>=0 && url.indexOf("channel=FASHION")>=0) 
          ){
            return true;
        }else{
            return false;
        }
    }

    function isPortrait(url:string){
        if( (url.indexOf("/modelMarket")>=0 && url.indexOf("channel=PORTRAIT")>=0) ||
            (url.indexOf("/createLoRA")>=0 && url.indexOf("channel=PORTRAIT")>=0) ||
            (url.indexOf("/showImageModel")>=0 && url.indexOf("channel=PORTRAIT")>=0) 
          ){
            return true;
        }else{
            return false;
        }
    }

    function isCreatePrompt(url:string){
        return url.indexOf("/createPrompt")>=0 || url.indexOf("/pModelList")>=0;
    }

  
    const [showText, setShowText] = useState(false);
    useEffect(() => {
        if (!showMini) {
            // 延迟 150ms 显示文字（与 Header 拉伸同步）
            const timer = setTimeout(() => setShowText(true), 150);
            return () => clearTimeout(timer);
        } else {
            setShowText(false); // 收起时立即隐藏
        }
    }, [showMini]);


    const [headerStyle, setHeaderStyle] = useState<any>({});
    const [headerText, setHeaderText] = useState<any>({});
    useEffect(() => {
        switch(websiteName){
            case "framuse":
                setHeaderStyle( {
                    headerWidth: "w-52",
                    subMenuWidth: "w-52",
                    MenuWidth: "w-48",
                });
                setHeaderText({
                    login: "LOGIN",
                    myFiles: "My Files",
                    buyCredits: `Buy ${config?.creditName}`,
                    profile: "My Profile",
                });
                break;
            default:
                setHeaderStyle( {
                    headerWidth: "w-40",
                    subMenuWidth: "w-36",
                    MenuWidth: "w-28",                  
                });
                setHeaderText({
                    login: "登录",
                    myFiles: "我的文件",
                    buyCredits: `购买${config?.creditName}`,
                    profile: "个人设置",
                });
                break;
        }        
    }, [websiteName]);


                    
    function getMainMenu(){
        switch(websiteName){
            case "haiwan":
                return (
                    <div className="flex items-center sm:space-x-5 space-x-3 sm:text-2xl text-sm">
                        <Link href={`${website}${defaultPage}`} className=" text-title ">
                            <div>首页</div>
                        </Link>   
                        <Link href={`${website}/destinationSelect`} className=" text-title ">
                            <div>目的地</div>
                        </Link>   
                    </div>
                    );
                
            case "aiputi":
                return (
                    <div className="flex flex-1">
                        <div className="flex flex-col items-left space-y-10 ">     
                            <Link href={`${website}/index_aiputi`} 
                              className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/index_aiputi")>=0 ? "text-title-h " : "text-title "}`}>
                                <Icon icon={"mdi:home-circle"} className="w-5 h-5 text-inherit text-xs"/>
                                {!showMini && (<div>首页</div>)}
                            </Link>   

                            <Link href={`${website}/modelMarket?func=chat&channel=BOOK`} 
                              className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/modelMarket?func=chat&channel=BOOK")>=0 ? "text-title-h " : "text-title "}`}>
                                <Icon icon={"mdi:library"} className="w-5 h-5 text-inherit text-xs"/>
                                {!showMini && (<div>书库</div>)}
                            </Link>   

                            <Link href={`${website}/modelMarket?func=chat&channel=BOOK&label=课本&showLabel=FALSE`} 
                              className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/modelMarket?func=chat&channel=BOOK&label=课本&showLabel=FALSE")>=0 ? "text-title-h " : "text-title "}`}>
                                <Icon icon={"mdi:book-open-variant"} className="w-5 h-5 text-inherit text-xs"/>
                                {!showMini && (<div>课本</div>)}
                            </Link>   
                          </div>                          
                    </div>
                    );
                
            case "aimoteku":
                return (
                    <div className="flex items-center sm:space-x-5 space-x-3 sm:text-2xl text-sm">
                        <Link href={`${website}${defaultPage}`} className=" text-title  hidden sm:block ">
                            <div>首页</div>
                        </Link>   
                        <Link href={`${website}/modelMarket?func=lora&channel=FASHION`} className=" text-title ">
                            <div>模特</div>
                        </Link>   
                        <Link href={`${website}/AITools`} className=" text-title hidden sm:block">
                            <div>工具</div>
                        </Link>   
                    </div>
                    );                
                
            case "aixiezhen":
                return (
                    <div className="flex flex-row">
                        <div className="sm:hidden flex flex-row items-center sm:space-x-10 space-x-3 ">
                            <Link href={`${website}/index_aiyishujia`} className=" text-title ">
                                <div>精彩</div>
                            </Link>                           
                            <Link href={`${website}/cameraList`} className=" text-title ">
                                <div>拍摄</div>
                            </Link>            
                            <Link href={`${website}/AITools`} className=" text-title ">
                                <div>工具</div>
                            </Link>                           
                        </div>

                        <div className="hidden sm:flex flex-row items-center space-x-2 ">                        
                            <Link href={`${website}/index_aiyishujia`} 
                              className={`w-28 flex flex-col items-center ${currentURL.indexOf("/index_aiyishujia")>=0 ? "text-title-h " : "text-title "}`}>
                                <div>素材样片</div>
                            </Link>                           
                            <Link href={`${website}/cameraList`} 
                              className={`w-28 flex flex-col items-center ${isCamera(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>人像写真</div>
                            </Link>  
                            <Link href={`${website}/VDH`} 
                              className={`w-28 flex flex-col items-center ${isFashion(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>数字人物</div>
                            </Link>
                            <Link href={`${website}/pModelList`} 
                              className={`w-28 flex flex-col items-center ${isCreatePrompt(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>图片创作</div>
                            </Link>     
                            <Link href={`${website}/AITools`} 
                              className={`w-28 flex flex-col items-center ${isAITool(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>智能修图</div>
                            </Link>   
                            <Link href={`${website}/videoTools`} 
                              className={`w-28 flex flex-col items-center ${isVideoTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>影音创作</div>
                            </Link>                           
                        </div>
                    </div>
                    );                

            case "niukit":
                return (
                    <div className="flex flex-1">
                        <div className="sm:hidden flex flex-row items-center sm:space-x-5 space-x-3 ">
                            <Link href={`${website}/imageTools`} className=" text-title ">
                                <div>图片</div>
                            </Link>            
                            <Link href={`${website}/videoTools`} className=" text-title ">
                                <div>影音</div>
                            </Link>                           
                            <Link href={`${website}/index_aiyishujia`} className=" text-title ">
                                <div>样片</div>
                            </Link>            
                        </div>

                        <div className="hidden sm:flex flex-col items-left space-y-10 ">     
                            <Link href={`${website}/index_niukit`} 
                              className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/index_niukit")>=0 ? "text-title-h " : "text-title "}`}>
                                <Icon icon={"mdi:home-circle"} className="w-5 h-5 text-inherit text-xs"/>
                                <span
                                  className={`
                                    whitespace-nowrap transition-all duration-300 ease-in-out
                                    ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                  `}
                                >
                                  首页
                                </span>
                            </Link>   


                            <div className={`w-full relative group w-28 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                <Link href={`#`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isVideoTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:video-high-definition"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    影音工具
                                    </span>
                                    {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>     
                                {/* 子菜单 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth} 
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createVideo?tbCode=createVideoTools`}>- 视频创作</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/videoRetalk?tbCode=editVideoTools`}>- 视频编辑</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createVoice?tbCode=audioTools`}>- 音频创作</Link> </li>
                                  </ul>
                              </div>
                            </div>
                          
                            <div className={`w-full relative group w-28 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                {/* 主菜单 */}
                                <Link href={`#`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isImageTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:image"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                      图片工具
                                    </span>           
                                  {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>     
                                {/* 子菜单，注意没有 mt-2！避免产生空隙 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth} 
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/createPrompt?tbCode=createImageTools`}>- 图片创作</Link></li>
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/inpaint?tbCode=editTools`}>- 图片编辑</Link></li>
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/superCamera?tbCode=portraitTools`}>- 拍摄写真</Link></li>
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/hairDesign?tbCode=personalTools`}>- 职业形象</Link></li>
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/adInHand?tbCode=ecTools`}>- 电商工具</Link></li>
                                        <li className="text-title px-4 py-3 hover:bg-gray-700"><Link href={`${website}/arch/deco?tbCode=archTools`}>- 装修设计</Link></li>
                                    </ul>
                                </div>
                            </div>

                            <div className={`w-full relative group w-28 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                <Link href={`${website}/styleMarket`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isStyle(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:palette-swatch"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    艺术风格
                                    </span>
                                    {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>      
                                {/* 子菜单 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth}  
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=COMIC`}>- 动漫次元</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=DRAW`}>- 西方艺术</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=ART`}>- 东方美学</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=PORTRAIT`}>- 写真套系</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createLoRA?title=艺术风格&channel=PORTRAIT&object=风格&theme=STYLE`}>- 创建风格</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/simStyle`}>- 模仿风格</Link> </li>                                        
                                  </ul>
                              </div>
                            </div>

                            <div className="relative group w-28 flex flex-col items-left">
                                <Link href={`${website}/VDH`} 
                                  className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2  ${isFashion(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:account-circle"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    数字人物
                                    </span>
                                </Link>      
                            </div>

                            <div className="relative group w-28 flex flex-col items-left">
                                <Link href={`${website}/index_aiyishujia`} 
                                  className={`w-28 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center  gap-2 ${currentURL.indexOf("/index_aiyishujia")>=0 ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:collage"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    爆款样片
                                    </span>
                                </Link>    
                            </div>
                        </div>
                    </div>
                    );                
            

            case "framuse":
                return (
                    <div className="flex flex-1">
                        <div className="sm:hidden flex flex-row items-center sm:space-x-5 space-x-3 ">
                            <Link href={`${website}/imageTools`} className=" text-title ">
                                <div>Photo</div>
                            </Link>            
                            <Link href={`${website}/videoTools`} className=" text-title ">
                                <div>Video</div>
                            </Link>                           
                            <Link href={`${website}/index_aiyishujia`} className=" text-title ">
                                <div>Demo</div>
                            </Link>            
                        </div>

                        <div className="hidden sm:flex flex-col items-left space-y-10 ">     
                            <Link href={`${website}/index_framuse`} 
                              className={`w-44 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/index_framuse")>=0 ? "text-title-h " : "text-title "}`}>
                                <Icon icon={"mdi:home-circle"} className="w-5 h-5 text-inherit text-xs"/>
                                <span
                                  className={`
                                    whitespace-nowrap transition-all duration-300 ease-in-out
                                    ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                  `}
                                >
                                  Home Page
                                </span>
                            </Link>   


                            <div className={`w-full relative group w-44 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                <Link href={`#`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isVideoTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:video-high-definition"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    Video Kits
                                    </span>
                                    {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>     
                                {/* 子菜单 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth} 
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createVideo?tbCode=createVideoTools`}>- Video Creation</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/videoRetalk?tbCode=editVideoTools`}>- Video Editing</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createVoice?tbCode=audioTools`}>- Audio Creation</Link> </li>
                                  </ul>
                              </div>
                            </div>
                          
                            <div className={`w-full relative group w-44 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                {/* 主菜单 */}
                                <Link href={`#`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isImageTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:image"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                      Photo Kits
                                    </span>           
                                  {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>     
                                {/* 子菜单，注意没有 mt-2！避免产生空隙 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth}  
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/createPrompt?tbCode=createImageTools`}>- Image Creation</Link></li>
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/inpaint?tbCode=editTools`}>- Image Editing</Link></li>
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/superCamera?tbCode=portraitTools`}>- Take Photo</Link></li>
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/hairDesign?tbCode=personalTools`}>- Professional Image</Link></li>
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/adInHand?tbCode=ecTools`}>- E-commerce tools</Link></li>
                                        <li className="text-title px-2 py-3 hover:bg-gray-700"><Link href={`${website}/arch/deco?tbCode=archTools`}>- Decoration design</Link></li>
                                    </ul>
                                </div>
                            </div>

                            <div className={`w-full relative group w-44 flex flex-col ${showMini ? "items-center":"items-start"}`}>
                                <Link href={`${website}/styleMarket`} 
                                    className={`flex flex-row justify-start items-center gap-2 ${isStyle(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:palette-swatch"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    Pop Styles
                                    </span>
                                    {!showMini && (<ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />)}
                                </Link>      
                                {/* 子菜单 */}
                                <div className={` opacity-90 ${headerStyle.subMenuWidth} 
                                  absolute top-0 left-full -ml-5 bg-gray-700 text-white rounded shadow-lg 
                                  transition-opacity duration-200 z-50
                                  ${showMini ? 'hidden' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto'}
                                `}>
                                    <ul className="flex flex-col py-2 px-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=COMIC`}>- Animation</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=DRAW`}>- Western art</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=ART`}>- Orientalism</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=PORTRAIT`}>- Portrait Series</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/createLoRA?title=ArtStyle&channel=PORTRAIT&object=风格&theme=STYLE`}>- Customize Style</Link> </li>
                                      <li className="text-title px-4 py-3 hover:bg-gray-700"> <Link href={`${website}/simStyle`}>- Simulate</Link> </li>                                        
                                  </ul>
                              </div>
                            </div>

                            <div className="relative group w-44 flex flex-col items-left">
                                <Link href={`${website}/VDH`} 
                                  className={`w-44 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2  ${isFashion(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:account-circle"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    Hot Avatars
                                    </span>
                                </Link>      
                            </div>

                            <div className="relative group w-44 flex flex-col items-left">
                                <Link href={`${website}/index_aiyishujia`} 
                                  className={`w-44 flex flex-row ${showMini ? "justify-center":"justify-start"} items-center  gap-2 ${currentURL.indexOf("/index_aiyishujia")>=0 ? "text-title-h " : "text-title "}`}>
                                    <Icon icon={"mdi:collage"} className="w-5 h-5 text-inherit text-xs"/>                                  
                                    <span
                                      className={`
                                        whitespace-nowrap transition-all duration-300 ease-in-out
                                        ${showText ? "opacity-100 w-auto scale-100 ml-0.5" : "opacity-0 w-0 scale-95 overflow-hidden"}
                                      `}
                                    >
                                    Showcases
                                    </span>
                                </Link>    
                            </div>
                        </div>
                    </div>
                    );  
            
            case "aiyishu":
                return (
                    <div className="flex items-center sm:space-x-5 space-x-3 sm:text-2xl text-sm">
                        <Link href={defaultPage} className=" text-title  hidden sm:block ">
                            <div>首页</div>
                        </Link>   
                        <Link href={"/createPrompt"} className=" text-title ">
                            <div>创作</div>
                        </Link> 
                        <Link href={"/modelMarket?func=lora"} className=" text-title ">
                            <div>模型</div>
                        </Link> 
                        <Link href={"/AITools"} className=" text-title ">
                            <div>工具</div>
                        </Link>   
                    </div>
                    );
                
            default:
                return (
                    <div className="flex items-center sm:space-x-5 space-x-3 sm:text-2xl text-sm">
                        <Link href={defaultPage} className=" text-title  hidden sm:block ">
                            <div>首页</div>
                        </Link>   
                        <Link href={"/index_aiputi"} className="text-title hidden sm:block">
                            <div>AI菩提</div>
                        </Link>   
                        <Link href={"/index_aimoteku"} className=" text-title hidden sm:block">
                            <div>AI模特库</div>
                        </Link>   
                        <Link href={"/index_aiyishujia"} className=" text-title hidden sm:block">
                            <div>AI艺术家</div>
                        </Link>   
                        <Link href={"/index_aixiezhen"} className=" text-title hidden sm:block">
                            <div>超能照相馆</div>
                        </Link>   
                        <Link href={"/index_haiwan"} className=" text-title hidden sm:block">
                            <div>海玩网</div>
                        </Link>                         
                        <Link href={"/AITools"} className=" text-title hidden sm:block">
                            <div>AI工具</div>
                        </Link>   
                    </div>
                );
        }
    }

    let dashboardURL = "/dashboard";
    switch(websiteName){
        case "aiputi":
            dashboardURL = "/dashboard?segment=CHATMODEL&noMenu=true&func=chat";
            break;
    }
  
    function getUserMenu(){
        return (
            <div className="hidden sm:flex flex-col items-left space-y-8 px-3">     
                <Link href={`${website}${dashboardURL}`} 
                  className={`${headerStyle.menuWidth} flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf(dashboardURL)>=0 ? "text-title-h " : "text-title-user "}`}>
                    <Icon icon={"mdi:file-multiple"} className="w-5 h-5 text-inherit text-xs"/>
                    {!showMini && (<div>{headerText.myFiles}</div>)}
                </Link>   
                <Link href={`${website}/buy-credits`} 
                  className={`${headerStyle.menuWidth} flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/buy-credits")>=0 ? "text-title-h " : "text-title-user "}`}>
                    <Icon icon={"mdi:lightning-bolt-circle"} className="w-5 h-5 text-inherit text-xs"/>
                    {!showMini && (<div>{headerText.buyCredits}</div>)}
                </Link>   
                <Link href={`${website}/profile`} 
                  className={`${headerStyle.menuWidth} flex flex-row ${showMini ? "justify-center":"justify-start"} items-center gap-2 ${currentURL.indexOf("/profile")>=0 ? "text-title-h " : "text-title-user "}`}>
                    <Icon icon={"mdi:cog-sync-outline"} className="w-5 h-5 text-inherit text-xs"/>
                    {!showMini && (<div>{headerText.profile}</div>)}
                </Link>   
            </div>
        );                
    }

    function showSearch(){
        /*
        return (
             <div className="relative w-full">
                <input id="iptWord" type="text" value = {word}
                    placeholder = {"站内内容搜索"}
                    style={{border:'none'}}
                    className="rounded-full opacity-80 bg-gray-800 text-gray-400 mx-1 sm:mx-0 font-medium px-4 py-2 pr-10 flex flex-1 h-10 w-full"
                    onChange={(e) => setWord(e.target.value)} 
                    onKeyDown={(e) => {
                        if(e.key == "Enter"){
                            // 阻止默认的提交行为
                            e.preventDefault();
                            // 检查是否按下了 Ctrl 键
                            if (e.ctrlKey || e.shiftKey || e.metaKey){
                            } else {
                                // 执行回车键按下后的操作
                                searchByWord(word);
                            }    
                        }
                    }}                             
                    />
                    <button id="searchBtn" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300"                             
                        onClick={() => {
                            searchByWord(word);
                        }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" clip-rule="evenodd" 
                                d="M11 4a7 7 0 1 1-4.95 11.95l-4.1 4.1a1 1 0 0 1-1.42-1.42l4.1-4.1A7 7 0 0 1 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" 
                                fill="currentColor"/>
                        </svg>
                    </button>                            
                </div>
        );
        */
      }    
  

    if(!inWeixin){
        return (
            <>
                {title && (
                <Head>
                    <title>{ title || appName }</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <meta property="og:description" content={desc || title} /> 
                    <meta property="og:title" content={title || appName} />
                    <meta property="og:image" content={icon || config?.logo32} />    
                    <meta name="description" content={desc || title} />
                </Head>
                )}
                 <header 
                     ref={headerRef}
                     className={`fixed top-0 left-0 h-screen sm:h-screen bg-gray-800 ${showMini ? "w-12" : headerStyle.headerWidth } z-50 flex flex-row sm:flex-col text-white justify-between items-center gap-2 sm:gap-10 sm:py-2 transition-all duration-300 ease-in-out`}
                     onMouseEnter={() => {
                     //    setShowMini(false)
                     }}
                 >

                    {/*LOGO区域*/}
                    <Link href={`${website}${defaultPage}`} className="flex flex-row sm:flex-col items-center space-x-2">
                      {config?.logoPNG && (
                        <Image alt={appName} src={config?.logoPNG} className={`p-1 ${showMini ? 'h-12' : 'h-12'}`} />
                      )}
          
                      {/* always occupy space, fade in/out */}
                      <div className={`transition-opacity duration-300 ease-in-out ml-2
                        ${showMini ? 'invisible' : 'visible'}`}>
                        {appSlogan ? (
                          <div className="flex flex-col items-center justify-center">
                            <h1 className="tracking-tight text-logo leading-none">{showMini ? "AI" : appName}</h1>
                            <p className="sm:hidden text-logo-s leading-none">{appSlogan}</p>
                          </div>
                        ) : (
                          <h1 className="tracking-tight text-logo">{showMini ? "AI" : appName}</h1>
                        )}
                      </div>
                    </Link>

                    { getMainMenu() }
                  
                    {email ? (
                     
                     <div className="flex flex-col space-y-8">
                         { getUserMenu() }                         
                         
                         <div className="flex flex-row sm:flex-row-reverse items-center justify-center gap-3 py-1 text-sm w-full bg-gray-700 rounded-full px-4">
                            <div className="flex flex-1 flex-col items-start justify-center space-y-1 text-xs text-title-s">
                                <Link href={`${website}/dashboard`} className="w-full hidden sm:flex gap-2 leading-none flex-row items-center">   
                                    <span>{gradeName}</span>
                                </Link>
                                <Link href={`${website}/dashboard`} className="w-full hidden sm:flex gap-2 leading-none flex-row items-center">
                                    <span>{credits}</span>
                                </Link>
                            </div>
                            
                            <Link href={`${website}${dashboardURL}`} className="flex space-x-2">
                                <Image src={fu.getImageIcon(photo)} className="w-10 rounded-full" style={{ width: '32px', height: '32px' }}/>
                            </Link>
                        </div>
                    </div>
                    ) : (
                    <Link className="flex max-w-fit items-center justify-center space-x-2 rounded-full button-gold opacity-80 px-3 py-2 sm:px-5 sm:py-2 text-sm shadow-md transition"
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setShowLogin(true);
                        }}
                        >
                        <p>{headerText.login}</p>
                    </Link>
                    )}
                </header>

                {!noMargin && (
                  <div className={`${showMini ? 'ml-12' : 'ml-40'} py-0`} />
                )}

                {showLogin && (
                <LoginDialog config={config} isOpened={showLogin} 
                  onOK={()=>setShowLogin(false)} onCancel={()=>setShowLogin(false)}
                  />
                )}
            </>      
        );
    }else{
        return(
            <div className={noMargin ? "" : "weixinMargin"}>
            </div>
        );
    }
}
