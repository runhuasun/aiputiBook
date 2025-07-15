import Head from "next/head";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react"
import React, { useEffect, useState } from 'react';
import { useRouter } from "next/router";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

import LoginDialog from "../components/LoginDialog";
import MediaViewer from "../components/MediaViewer";
import Image from "./wrapper/Image";

import {channelType, channels, channelNames  } from "../utils/channels";
import * as g from "../utils/grade";
import * as fu from "../utils/fileUtils";
import { AIFuncs, defaultTools, imageTools, videoTools, audioTools, aiTools, cameraList } from "../utils/funcConf";

export default function Header({config, noMargin, title, subTitle, icon, desc, help }: 
                               { config?:any, noMargin?: boolean, title?:string, subTitle?:string, icon?:string, desc?:string, help?:string }) {
    
    const { data: session, status } = useSession();

    const [showLogin, setShowLogin] = useState<boolean>(false);
  
    const photo = (session?.user?.grade != null) ? `${config.RS}/grade/${session.user.grade}.jpg` : `${config.RS}/default/user.png`;
    const email = session?.user?.email;
    const credits = session?.user?.credits;
    const gradeName = g.getGradeName(config, session?.user?.grade || 0);

    const router = useRouter();
    let inviteBy = router.query.inviteBy;
    const appName = config?.appName || "AI菩提";
    const appSlogan = config?.appSlogan;  
    const websiteName = config?.websiteName || "aiputi";
    const defaultPage = config?.defaultPage!;
    const website = config?.website || "";
 
    const [inWeixin, setInWexin] = useState(false);
    const [currentURL, setCurrentURL] = useState<string>("");
    
  
    // 判断是否在微信浏览器内
    useEffect(() => {
        fu.redirectToNewDomain(config.website);     
      
        const userAgent = navigator.userAgent.toLowerCase();
        const isWechat = userAgent.indexOf('micromessenger') !== -1;
        setInWexin(isWechat);
        setCurrentURL(window.location.href);
    }, []);

    function isAITool(url:string){
        if(url.indexOf("/createPrompt") >= 0){
            return false;
        }else if(url.indexOf("/AITools") >= 0){
            return true;
        }else{
            let tools = defaultTools;
            if(config.websiteName == "aixiezhen"){
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
                    <div className="flex items-center sm:space-x-5 space-x-3 sm:text-2xl text-sm">
                        <Link href={`${website}${defaultPage}`} className=" text-title  sm:block ">
                            <div>首页</div>
                        </Link>   
                        <Link href="#" className=" text-title"
                          onClick={() => {fu.safeWindowOpen(`${website}/modelMarket?func=chat&channel=BOOK`, "_self") }}
                          >
                            <div>书库</div>
                        </Link>   
                        <Link href="#" className=" text-title"
                          onClick={() => {fu.safeWindowOpen(`${website}/modelMarket?func=chat&channel=BOOK&label=课本&showLabel=FALSE`, "_self") }}
                          >
                            <div>课本</div>
                        </Link>   
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
                          {/*
                            <Link href={`${website}/modelMarket?func=lora&channel=PORTRAIT&title=挑选写真套系`} 
                              className={`w-28 flex flex-col items-center ${isPortrait(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>写真套系</div>
                            </Link> 
                          */}
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
                    <div className="flex flex-row">
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

                        <div className="hidden sm:flex flex-row items-center space-x-2 ">     
                            <Link href={`${website}/index_niukit`} 
                              className={`w-28 flex flex-col items-center ${currentURL.indexOf("/index_niukit")>=0 ? "text-title-h " : "text-title "}`}>
                                <div>首页</div>
                            </Link>   
                          
                            <div className="relative group w-28 flex flex-col items-center">
                                {/* 主菜单 */}
                                <Link href={`#`} 
                                    className={`flex flex-row items-center justify-center gap-1 ${isImageTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <div>图片工具</div>
                                    <ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />
                                </Link>     
                                {/* 子菜单，注意没有 mt-2！避免产生空隙 */}
                                <div className="absolute top-full left-0 w-36 bg-gray-800 text-white rounded shadow-lg 
                                              opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                                              transition-opacity duration-200 z-50 
                                              pointer-events-none group-hover:pointer-events-auto">
                                    <ul className="flex flex-col py-2 text-left tracking-wider">
                                        <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/createPrompt?tbCode=createImageTools`}>图片创作</Link>  </li>
                                        <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/inpaint?tbCode=editTools`}>图片编辑</Link> </li>
                                        <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/superCamera?tbCode=portraitTools`}>拍摄写真</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/hairDesign?tbCode=personalTools`}>职业形象</Link> </li>                                      
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/adInHand?tbCode=ecTools`}>电商工具</Link> </li>
                                        <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/arch/deco?tbCode=archTools`}>装修设计</Link> </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="relative group w-28 flex flex-col items-center">
                                <Link href={`#`} 
                                    className={`flex flex-row items-center justify-center gap-1 ${isVideoTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <div>影音工具</div>
                                    <ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />
                                </Link>     
                                {/* 子菜单 */}
                                <div className="absolute top-full left-0 w-36 bg-gray-800 text-white rounded shadow-lg 
                                    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                                    transition-opacity duration-200 z-50 
                                    pointer-events-none group-hover:pointer-events-auto">
                                    <ul className="flex flex-col py-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/createVideo?tbCode=createVideoTools`}>视频创作</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/videoRetalk?tbCode=editVideoTools`}>视频编辑</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/createVoice?tbCode=audioTools`}>音频创作</Link> </li>
                                  </ul>
                              </div>
                            </div>

                            <div className="relative group w-28 flex flex-col items-center">
                                <Link href={`${website}/styleMarket`} 
                                    className={`flex flex-row items-center justify-center gap-1 ${isStyle(currentURL) ? "text-title-h " : "text-title "}`}>
                                    <div>艺术风格</div>
                                    <ChevronDownIcon className="w-4 h-4 transform transition-transform duration-200 group-hover:rotate-180 text-inherit" />
                                </Link>      
                                {/* 子菜单 */}
                                <div className="absolute top-full left-0 w-36 bg-gray-800 text-white rounded shadow-lg 
                                    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                                    transition-opacity duration-200 z-50 
                                    pointer-events-none group-hover:pointer-events-auto">
                                    <ul className="flex flex-col py-2 text-left tracking-wider">
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=COMIC`}>动漫次元</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=DRAW`}>西方艺术</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=ART`}>东方美学</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/styleMarket?channel=PORTRAIT`}>写真套系</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/createLoRA?title=艺术风格&channel=PORTRAIT&object=风格&theme=STYLE`}>创建风格</Link> </li>
                                      <li className="text-title px-4 py-2 hover:bg-gray-700"> <Link href={`${website}/simStyle`}>模仿风格</Link> </li>                                        
                                  </ul>
                              </div>
                            </div>
                                
                            <Link href={`${website}/VDH`} 
                              className={`w-28 flex flex-col items-center ${isFashion(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>数字人物</div>
                            </Link>                        
                            <Link href={`${website}/index_aiyishujia`} 
                              className={`w-28 flex flex-col items-center ${currentURL.indexOf("/index_aiyishujia")>=0 ? "text-title-h " : "text-title "}`}>
                                <div>爆款样片</div>
                            </Link>    
                        </div>
                    </div>
                    );                
            

            case "framuse":
                return (
                    <div className="flex flex-row">
                        <div className="sm:hidden flex flex-row items-center sm:space-x-10 space-x-3 ">
                            <Link href={`${website}/imageTools`} className=" text-title ">
                                <div>Photo</div>
                            </Link>            
                            <Link href={`${website}/audioTools`} className=" text-title ">
                                <div>Audio</div>
                            </Link>            
                            <Link href={`${website}/videoTools`} className=" text-title ">
                                <div>Video</div>
                            </Link>                           
                        </div>

                        <div className="hidden sm:flex flex-row items-center space-x-2 ">                        
                            <Link href={`${website}/index_aiyishujia`} 
                              className={`w-28 flex flex-col items-center ${currentURL.indexOf("/index_aiyishujia")>=0 ? "text-title-h " : "text-title "}`}>
                                <div>Demos</div>
                            </Link>    
                            <Link href={`${website}/imageTools`} 
                              className={`w-28 flex flex-col items-center ${isImageTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>Images</div>
                            </Link>     
                            <Link href={`${website}/audioTools`} 
                              className={`w-28 flex flex-col items-center ${isAudioTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>Audios</div>
                            </Link>                           
                            <Link href={`${website}/videoTools`} 
                              className={`w-28 flex flex-col items-center ${isVideoTool(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>Videos</div>
                            </Link>                           
                            <Link href={`${website}/VDH`} 
                              className={`w-28 flex flex-col items-center ${isFashion(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>Characters</div>
                            </Link>
                            <Link href={`${website}/styleMarket`} 
                              className={`w-28 flex flex-col items-center ${isStyle(currentURL) ? "text-title-h " : "text-title "}`}>
                                <div>Styles</div>
                            </Link>                          
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
                    <meta property="og:description" content={desc || title} /> 
                    <meta property="og:title" content={title || appName} />
                    <meta property="og:image" content={icon || config.logo32} />    
                    <meta name="description" content={desc || title} />
                </Head>
                )}

                <div className="fixed top-0 left-0 w-full z-50 flex flex-col opacity-20 hover:opacity-90 bg-black shadow-md text-white xs:flex-row justify-between items-center  py-1 sm:px-4 px-2 gap-2">
                    <Link href={`${website}${defaultPage}`} className="flex flex-row items-center space-x-2 invisible">
                        {config.logoPNG && (
                        <Image alt={appName} src={config.logoPNG} className="p-1 h-12" />
                        )}
                    </Link>
                </div>
                  
                <header className="fixed top-0 left-0 w-full z-50 flex flex-col text-white xs:flex-row justify-between items-center  py-1 sm:px-4 px-2 gap-2">
                    <Link href={`${website}${defaultPage}`} className="flex flex-row items-center space-x-2">
                        {config.logoPNG && (
                        <Image alt={appName} src={config.logoPNG} className="p-1 h-12" />
                        )}
                        { appSlogan ? (
                        <div className="flex flex-col items-center justify-center ml-2">
                            <h1 className="tracking-tight text-logo leading-none">
                                {appName}
                            </h1>
                            <p className="text-logo-s leading-none">
                                {appSlogan}
                            </p>
                         </div> 
                        ):(
                        <h1 className="ml-2 tracking-tight text-logo">
                            {appName}
                        </h1>
                        )}
                    </Link>

                    { getMainMenu() }

                  
                    {email ? (

                    <div className="flex items-center space-x-4 sm:text-2xl text-sm bg-gray-800 pl-3 pr-2 py-1 rounded-full">
                        { (websiteName == "aixiezhen" || websiteName == "niukit") && (
                        <div className="flex flex-col items-start justify-center space-y-1 text-xs text-title-s">
                            <Link href={`${website}/dashboard`} className="hidden sm:block leading-none">会员：{gradeName}</Link>
                            <Link href={`${website}/dashboard`} className="hidden sm:block leading-none">能量：{credits}</Link>
                        </div>
                        )}
                        
                        {(websiteName === "aiputi") ? (
                            <Link href={`${website}/dashboard?segment=CHATMODEL&noMenu=true&func=chat`} className="flex space-x-2">
                                <Image alt="" src={fu.getImageIcon(photo)} className="w-10 rounded-full" style={{ width: '32px', height: '32px' }}/>
                            </Link>
                        ) : (
                            <Link href={`${website}/dashboard`} className="flex space-x-2">
                                <Image alt="" src={fu.getImageIcon(photo)} className="w-10 rounded-full" style={{ width: '32px', height: '32px' }}/>
                            </Link>
                        )}
                    </div>
                
                    ) : (
                
                    <Link className="flex max-w-fit items-center justify-center space-x-2 rounded-full button-gold opacity-80 px-3 py-2 sm:px-5 sm:py-2 text-sm shadow-md transition"
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setShowLogin(true);
                            // window.location.href = `${website}/loginChoice?originalUrl=` + encodeURIComponent(window.location.href) + (inviteBy ? ("&inviteBy=" + inviteBy) : "");
                        }}
                        >
                        <p>登录</p>
                    </Link>
                    ) }
                </header>

              
                {!noMargin && (
                <div className="phoneMargin sm:mainMargin">
                </div>
                )}

                {/*title && (
                <h1 className="title-main hidden sm:flex flex-col items-center text-center tracking-widest">
                    <div className="flex flex-row items-center space-x-2">
                      <p className="text-gray-300 text-xl tracking-widest">{title}</p>
                      {help && (
                      <MediaViewer title="帮助内容" config={config} src={help} className="w-7 button-main rounded-full text-xl " text="?"/>
                      )}
                    </div>
                    {subTitle && (
                    <p className="text-base text-gray-500">{subTitle}</p>
                    )}
                </h1>
                )*/}

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
