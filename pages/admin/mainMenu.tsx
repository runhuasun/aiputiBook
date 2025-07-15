import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { getServerSession } from "next-auth";
import React from 'react';

import { Room, Prompt, Model, Application, User, Rawdata, VDH } from "@prisma/client";
import prisma from "../../lib/prismadb";
import { authOptions } from "../api/auth/[...nextauth]";

import UserHeader from "../../components/UserHeader";
import BuddhaHeader from "../../components/BuddhaHeader";
import Footer from "../../components/Footer";
import { RoomGeneration } from "../../components/RoomGenerator";
import LoginPage from "../../components/LoginPage";
import Pagination from '../../components/Pagination';
import MultiStateImage from '../../components/MultiStateImage';
import * as gh from "../../components/Genhis";
import Image from "../../components/wrapper/Image";


import { rooms, roomNames  } from "../../utils/modelTypes";
import { showDate, showDateTime } from "../../utils/dateUtils";
import { config, defaultImage } from "../../utils/config";
import * as debug from "../../utils/debug";
import { getFileIcon } from "../../utils/rawdata";
import {isWeixinBrowser} from "../../utils/wechatUtils";
import {callAPI} from "../../utils/apiUtils";
import {getThumbnail, getFileServerOfURL} from "../../utils/fileUtils";
import * as fu from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import * as monitor from "../../utils/monitor";
import * as ru from "../../utils/restUtils";
import { getFuncLink, getFuncTitle} from "../../utils/funcConf";



const itemsPerPage = 16;
const colsPerRow = 8;
const thumbSize = 256;


export default function mainMenu({ user, config, segment, myData, totalItems }: { user: User, config:any, segment:string, myData:any[], totalItems:number}) {
    const router = useRouter();

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [word, setWord] = useState<string>(router.query.word as string || "");
    
    let app = router.query.app; // 处理buddha模块
    let appId = router.query.appId; // 微信的appid
    
    function isAdmin(){
        return user && user.actors && user.actors.indexOf("admin")>=0;
    }

    async function buildSource(){
        try{
            const res = await callAPI("/api/adminSysTrace", {
                cmd: "BUILD_SOURCE"
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                alert("用户来源计算完毕!");
            }
        }catch(e){
            console.error(e);
        }
    }    

    function userManagerPannel(){
        return (
            <div className="mt-2">
                <button className="button-main px-4 py-2" onClick={()=>{
                buildSource();
            }} >
                    更新用户来源数据
                </button>
            </div>                
        );
    }


    let menuItems:any[] = [
            {menuId:"0913", segment:"USER", name:"全部用户", params:"onsky=aiputi", create:"", pannel:()=>{return userManagerPannel()} },   
            {menuId:"0901", segment:"PHOTO", name:"全部图片", params:"onsky=aiputi", create:"createPrompt"},
            {menuId:"0904", segment:"VIDEO", name:"全部视频", params:"onsky=aiputi", create:"createVideo"},
            {menuId:"0907", segment:"USERFILE", name:"全部上传", params:"onsky=aiputi", create:""}, 
            {menuId:"0902", segment:"ALBUM", name:"全部相册", params:"onsky=aiputi", create:"createAlbum"},     
            {menuId:"0903", segment:"VOICE", name:"全部音频", params:"onsky=aiputi", create:"createVoice"},
            {menuId:"0905", segment:"PROMPT", name:"全部提示词", params:"onsky=aiputi", create:"createPromptApp"},
            {menuId:"0906", segment:"RAWDATA", name:"全部训练集", params:"onsky=aiputi", create:"uploadRawdata"},
            {menuId:"0908", segment:"CHATMODEL", name:"全部语言模型", params:"onsky=aiputi", create:"createChatModel"},
            {menuId:"0909", segment:"IMGMODEL", name:"全部图像模型", params:"onsky=aiputi", create:"createLoRA"},
            
            {menuId:"0915", segment:"IMGMODEL", name:"全部分身", params:"onsky=aiputi&modelChannel=FASHION", icon:"/icons/fashion.svg", create:"createLoRA?title=虚拟分身&channel=FASHION"},                
            {menuId:"0914", segment:"IMGMODEL", name:"全部套系", params:"onsky=aiputi&modelChannel=PORTRAIT", icon:"/icons/portrait.svg", create:"createLoRA?title=写真套系&channel=PORTRAIT"},

            {menuId:"0910", segment:"VOICEMODEL", name:"全部语音模型", params:"onsky=aiputi", create:""},
            {menuId:"0911", segment:"VDH", name:"全部数字人", params:"onsky=aiputi", create:"createVDH"},
            {menuId:"0912", segment:"APPLICATION", name:"全部应用", params:"onsky=aiputi", create:"createWechatServiceApp"},
        ];
    
    useEffect(() => {
        setCurrentMenuItem(menuItems[0]);
    }, []); // 空数组表示只在组件挂载时执行一次

    let modelChannel = router.query.modelChannel as string;
    let channel = router.query.channel as string;
    let onsky = router.query.onsky as string;    
    const [currentMenuItem, setCurrentMenuItem] = useState<any>();

    function isCurrentSegment(menuItem:any){
        return menuItem?.menuId == currentMenuItem?.menuId;
    }
   
    useEffect( () => {
        setWord("");
        setCurrentMenuItem(menuItems[0]);
        for(const menuItem of menuItems){
            if( (segment == menuItem.segment) && 
                (!!modelChannel === !!(menuItem.params && menuItem.params.indexOf(`modelChannel=${modelChannel || ""}`) >= 0)) &&
                  (!!channel === !!(menuItem.params && menuItem.params.indexOf(`channel=${channel || ""}`) >= 0)) && 
                  (!!onsky === !!(menuItem.params && menuItem.params.indexOf(`onsky=${onsky || ""}`) >= 0)) ){
                setCurrentMenuItem(menuItem);
                break;
            }
        }
    }, [segment,modelChannel,channel,onsky]);

    function search(){
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("word", word);
        window.location.href = currentUrl.toString();
    }
    
    let showMenu = (user?.actors && typeof user.actors=="string" && user.actors.indexOf("admin")>=0 ) || !router.query.noMenu;  // 如果参数不显示菜单，并且用户不是admin，就不显示菜单
    let showImgModel = !router.query.func || router.query.func=="lora" ? true : false;
    let showChatModel = !router.query.func || router.query.func=="chat" ? true : false;
    let showVoiceModel = !router.query.func || router.query.func=="voice" ? true : false;
    
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(router.query.page ? parseInt(router.query.page as string) : 1);
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const onPageChange = (newPage: number) => {
        setCurrentPage(newPage);        
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("page", newPage.toString());
        window.location.href = currentUrl.toString();
    };


    // 设置监控模型训练结果的钩子
    if((segment=="CHATMODEL" || segment=="IMGMODEL") && myData){
        for(const m of myData){
            if(m.status == enums.modelStatus.start || m.status == enums.modelStatus.create){
                useEffect( () => {
                    const interval = setInterval(() => {
                        callAPI("/api/updateModel", {cmd:"STATUS", modelId:m.id}).then((res) => {
                            if(res.status == 200 && res.result.status != enums.modelStatus.start){
                                window.location.reload();
                            }
                        });
                    }, 10000);
                    return () => clearInterval(interval);
                }, []); // 空数组表示只在组件挂载时执行一次
                break;
            }
        }
    }

    if(segment == "PHOTO" || segment=="VOICE" || segment == "VIDEO"){
        for(const m of myData){
            if(m.status != enums.roomStatus.failed && m.status != enums.roomStatus.success && m.status != enums.roomStatus.delete){
                useEffect( () => {
                    const interval = setInterval(() => {
                        callAPI("/api/updateRoom", {cmd:"GET_DATA", id:m.id}).then((res) => {
                            if(res.status == 200){
                                if(res.result.status == enums.roomStatus.failed){
                                    alert(res.result.outputImage);
                                    window.location.reload();
                                }
                                if(res.result.status == enums.roomStatus.success || res.result.status == enums.roomStatus.delete){
                                    window.location.reload();
                                }
                            }
                        });
                    }, 5000);
                    return () => clearInterval(interval);
                }, []); // 空数组表示只在组件挂载时执行一次
                break;
            }
        }
    }

    async function shareUserPage(){
        if(user && user.name && user.id){
            // 检查浏览器是否支持Web Share API
            if (navigator.share) {
                try {
                    // 调用navigator.share()方法并传入要分享的数据
                    await navigator.share({
                        title: user.name + "的作品集",
                        text: "来看看我的作品展览吧",
                        url: "/userPage?userId=" + user.id,
                    });
                } catch (e) {
                    // 如果分享失败，打印一个错误
                    debug.error("分享失败：" + e);
                }
            } else {
                // 如果浏览器不支持Web Share API，打印一个警告
                alert('请点击右上角浏览器的"..." 按钮，通过浏览器分享。');
            }
        }else{
            alert('请先登录才能分享主页');
        }
    }  
    
    function pubModel(code:string, func:string, price:string, runtimes:number){
      //if(func=="lora" && (runtimes==null || runtimes<3)){
      //    alert("恭喜您训练成功新模型，为了让其它用户了解您的模型，您至少需要自己先生成三张样例照片，才可以发布！我们已经赠送您30个" + config.creditName + "，快去试试吧！");
      //    return;
      //}
      
        // window.location.href = "/publishModel?model=" + code + "&price=" + price;
        window.open("/publishModel?model=" + code + "&price=" + price, "_blank");    
    }
  
    async function unpubModel(id:string, func:string, price:string){
        const res = await callAPI("/api/updateModel", { modelId:id, price, access:"PRIVATE" });
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            window.location.reload();
        }
    }

  
    async function deleteVDH(id:string){
        const res = await callAPI("/api/vdhManager", { id:id, cmd:"DELETE"});
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            window.location.reload();
        }
    }
    

    async function deleteModel(id:string){
        const res = await fetch("/api/updateModel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ modelId:id, cmd:"DELETE"}),
        });
        
        let response = await res.json();
        if (res.status !== 200) {
            setError(response as any);
        } else {
            window.location.reload();
        }    
    }
  
    async function modelAction(model:any, url:string){
        if(user && model){
            if(isWeixinBrowser() && appId){
                // 修改用户当前应用的当前默认模型
                let service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                    "&userId=" + user.id;
                if(model.func=="lora"){
                  service += "&drawMethod=LORA&key=TEXT2IMG_MODEL" + "&value=" + model.id;
                }else if(model.func == "chat"){
                  service += "&key=CHAT_MODEL_ID" + "&value=" + model.id;
                }
              
                const res = await fetch(service, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/xml",
                    },
                });    

                const retJson = await res.json();
                // alert(retJson as string);
                if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
                    WeixinJSBridge.invoke('hideToolbar');                    
                    WeixinJSBridge.invoke('closeWindow', {}, function(res) {});
                }
            }else{
                window.location.href=url;
            }
        }else{
            window.location.href=url;
        }
  }  

  

  //////////////////////////////////////////////////////////////////////////////////////
  
  async function cancelPrompt(id:string){
    const res = await fetch("/api/createPrompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:id, cmd:"CANCEL"}),
    });

    let response = await res.json();
    if (res.status !== 200) {
      setError(response as any);
    } else {
      window.location.reload();
    }
       
  }
  
  async function publishPrompt(id:string, runtimes:number){
    //if(runtimes < 3){
    //  alert("新提示词至少需要生成三张样例图片后才可以发布！点击提示词封面可以开始生成");
    //  return;
    //}
    
    const res = await fetch("/api/createPrompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:id, cmd:"PUBLISH"}),
    });

    let response = await res.json();
    if (res.status !== 200) {
      setError(response as any);
    } else {
      window.location.reload();
    }    
  }
  
    async function deletePrompt(id:string){
    const res = await fetch("/api/createPrompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id:id, cmd:"DELETE"}),
    });

    let response = await res.json();
    if (res.status !== 200) {
      setError(response as any);
    } else {
      window.location.reload();
    }    
  }

    async function updatePrompt(code:string, runtimes:number){
        window.open("/publishPrompt?prompt=" + code, "_blank");  
    }

    
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function deleteApp(id:string){
      const res = await fetch("/api/appManager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id:id, cmd:"DELETE"}),
      });
  
      let response = await res.json();
      if (res.status !== 200) {
        setError(response as any);
      } else {
        window.location.reload();
      }    
  }


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function moveUserFile(id:string){
        const res = await callAPI("/api/userFileManager", { id:id, cmd:"BACKUP_TO_US"});
        if (res.status !== 200) {
            alert(res.result as any);
        } else {
            window.location.reload();
        }
    }
    
    async function deleteUserFile(id:string, cmd:string="DELETE"){
        let backup = false;
        if(cmd == "PHYSICAL_DELETE"){
            backup = await confirm("提示：是否将数据备份到合法目的地，并保留数据记录吗？");
            if(backup){
                cmd = "DELETE";
            }else{
                const confirmed  = await confirm("提醒：这是物理删除，一旦执行操作，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
                if(!confirmed ){
                    return;
                }
            }
        }
        const res = await callAPI("/api/userFileManager", { id:id, cmd, backup});
        if (res.status !== 200) {
            alert(res.result as any);
        } else {
            window.location.reload();
        }
    }

    function showUserFile(m:any, userId:string){
        return (
            <div className="masonry-item border-gray-200 bg-gray-100 text-left relative inline-block">
                { m.status != "DELETED" &&  m.url && m.url.endsWith(".mp4") ? (
                <video className=" rounded-xl" src={m.url} controls={true} width={thumbSize} preload="none" onClick={()=>(window.open(m.url, "_blank"))}/>               
                ) : m.url && m.url.endsWith(".mp4") && fu.getFileTypeByURL(m.url)=="VOICE" ? (
                <Image alt="用户上传的图片" width={thumbSize} 
                    src={ defaultImage.roomDeleted } 
                    className="sm:mt-0 mt-2 w-full" 
                    onClick={()=>(window.open(m.url, "_blank"))}
                    />
                ) : m.status != "DELETED" && m.url && (m.url.toLowerCase().endsWith(".mp3")||m.url.toLowerCase().endsWith(".wav") ) ? (
                <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                    <audio id="audioPlayer" controls className="w-full pt-2 ">
                        <source src={m.url} type="audio/mpeg"/>
                        <source src={m.url} type="audio/wav"/>
                        <source src={m.url} type="audio/ogg"/>
                    </audio>                
                    <div className="mt-10">
                        &nbsp;
                    </div>          
                </div>
                ): (
                <MultiStateImage  
                    image={ (m.status=="DELETED" || (m.status!="DELETED" && user.id != m.userId && getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE) ) ? defaultImage.roomDeleted : getThumbnail(m.url, thumbSize) } 
                    className="sm:mt-0 mt-2 w-full"
                    mouseDownImage={getThumbnail(m.url, thumbSize)}
                    onDoubleClick={()=> {window.open(`/showImage?imageURL=${m.url}`, "_blank")}}
                    />
                )}
                
                {m.userId == user.id && m.status != "DELETED" && (
                <button onClick={() => {
                    deleteUserFile(m.id);
                }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>  
                )}

                { m.status == "DELETED" && (
                <button onClick={() => {
                }}
                  className="absolute top-0 right-0 z-10 w-16 h-16 flex items-center justify-center text-red-500">
                  <span className="bg-red-500 text-white px-2 py-2 text-base">{getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE ? "RM&DEL" : "已删除"}</span>
                </button>
                )}                

                {m.status != "DELETED" && user.id != m.UserId && getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE && (
                <button onClick={() => {
                }}
                  className="absolute top-0 right-0 z-10 w-16 h-16 flex items-center justify-center text-red-500">
                  <span className="bg-red-500 text-white px-2 py-2 text-base">{ "OOC"}</span>
                </button>
                )}                

                
                <div className="flex flex-row absolute bottom-0 right-0 z-10 items-center justify-center">
                    <button onClick={() => {
                        deleteUserFile(m.id, "PHYSICAL_DELETE");
                    }}
                        className="button-main">
                        删除
                    </button>  
                    {  m.url.indexOf("upcdn.io")<0 && (
                    <button onClick={() => {
                        moveUserFile(m.id);
                    }}
                        className="button-main">
                        移走
                    </button>  
                    )}
                </div>
               
                 <Link className="text-left items-left text-xs flex flex-row " href={m.user ? ("/profile?userId="+m.user.id) : "#"}>
                    <Image
                      alt="作者"
                      src={m.user?.image || defaultImage.userCover}
                      className="w-6 rounded-full"
                      width={12}
                      height={12}
                    />             
                   <p className="text-white text-left px-1 py-1">
                    { m.user.name }
                   </p>   
                </Link>
            </div>  
        );
    }

    
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function deleteRawdata(id:string){
      const res = await fetch("/api/rawdataManager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id:id, cmd:"DELETE"}),
      });
  
      let response = await res.json();
      if (res.status !== 200) {
        setError(response as any);
      } else {
        window.location.reload();
      }    
  }

    function showRawdata(m:any, userId:string){
        return (
           <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
             <Link href={ m.url } target="_blank">
                <Image
                  alt="AI训练语料"
                  width={thumbSize}
                  src={ getThumbnail(getFileIcon(m.url), thumbSize) }
                  className="sm:mt-0 mt-2 w-full"
                  />
               </Link>
             {m.userId == user.id && (
              <button onClick={() => {
                deleteRawdata(m.id);
               }}
                className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                <span className="sr-only">删除</span>
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                  <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                </svg>
             </button>  
             )}
              <p className="text-gray-600  sm:px-2 px-1">
              {m.name}
              </p>
              <p className="text-gray-400  sm:px-2 px-1">
              "{m.desc}"
              </p>                             
           </div>          
        );
    }

    function showModel(m:any, userId:string){
        return (
            <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left flex flex-col items-center justify-between">

                <div className="w-full flex flex-col items-center relative inline-block">
                    <Link href="#" 
                        onClick = {()=> {
                            if(m.status == "FINISH"){
                                if(m.func == "chat"){
                                    modelAction(m, "/chatbot?model="+ m.id);
                                }else if(m.func == "lora"){
                                    if(m.channel == "PORTRAIT"){
                                        modelAction(m, "/showImageModel?model="+m.code+"&price="+m.price);    
                                    }else{
                                        modelAction(m, "/showImageModel?model="+m.code+"&price="+m.price);
                                    }
                                }else if(m.func == "voice"){
                                    modelAction(m, "/createVoice?model=" + m.code);                                            
                                }
                            }
                        }}
                        >
                        
                        <Image alt="AI设计图" width={thumbSize} 
                            src={ 
                                getThumbnail( 
                                    (m.status=="FINISH") ?  
                                    (m.coverImg || defaultImage.modelComplete) :
                                    ( m.status=="ERROR" ? defaultImage.modelFailed : defaultImage.modelRunning),                       
                                    thumbSize)
                            }
                            className="sm:mt-0 mt-2 w-full" />
                    </Link>
            
                    <button onClick={() => {
                        deleteModel(m.id);
                    }}
                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                        <span className="sr-only ">删除</span>
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                        </svg>
                    </button>  

                    <div className="w-full text-left">
                        <p className="text-gray-800 font-bold sm:px-2 px-1">
                            {' "'+ m.name + '"'}
                        </p>
                        <p className="text-gray-800  sm:px-2 px-1">
                            {m.status=="START"? " 正在训练..." : (m.status=="FINISH"? (/* " 训练完成:"+showDateTime(m.finishTime) */ "") : (m.status=="ERROR"? " 训练发生错误！" : ""))}
                        </p>
                    </div>
                </div>

                <div className="w-full flex flex-row items-center justify-between mt-3">
                    <Link className="text-left items-left text-xs flex flex-row " href={m.user ? ("/profile?userId="+m.user.id) : "#"}>
                        <Image
                          alt="作者"
                          src={m.user?.image || defaultImage.userCover}
                          className="w-6 rounded-full"
                          width={12}
                          height={12}
                        />             
                       <p className="text-gray-600 text-left px-1 py-1">
                        { m.user.name }
                       </p>   
                    </Link>
                    {(["FINISH", "ERROR"].includes(m.status)) && (m.func!="voice") && (
                    <button
                        onClick={() => {
                          pubModel(m.code, m.func, m.price.toString(), m.runtimes);
                        }}
                        className="px-1 py-2 button-gold "
                      >
                          设置               
                      </button>                               
                    ) }
                </div>
            </div>      
            
        );
    }

    function getSpeakerGenderName(gender:string){
        switch(gender){
            case "MALE": return "男声";
            case "FEMALE": return "女声";                
            case "BOY": return "男孩";
            case "GIRL": return "女孩";
            case "CUSTOM": 
            default: return "自定义";
        }
    }
    function showVModel(f:any){
        return(
            <div className="relative justify-between bg-gray-800 justify-top flex flex-col">
                <Link className="text-white text-left mt-8 mb-10 left-5 text-sm" href="#"
                    onClick={() =>  modelAction(f, "/createVoice?model=" + f.code) }                                                        
                    >
                    <span> {`【${getSpeakerGenderName(f.theme)}】${f.name}`} </span>
                </Link>
                <audio id="audioPlayer" controls className="w-full pt-2 ">
                    <source src={f.desc} type="audio/mpeg"/>
                    <source src={f.desc} type="audio/wav"/>
                    <source src={f.desc} type="audio/ogg"/>
                </audio>                
                <div className="mt-5">
                    &nbsp;
                </div>    
                 <Link className="text-left items-left text-xs flex flex-row " href={f.user ? ("/profile?userId="+f.user.id) : "#"}>
                    <Image
                      alt="作者"
                      src={f.user?.image || defaultImage.userCover}
                      className="w-6 rounded-full"
                      width={12}
                      height={12}
                    />             
                   <p className="text-white text-left px-1 py-1">
                    { f.user.name }
                   </p>   
                </Link>
                
                { f.theme == "CUSTOM" && (
                <button onClick={() => {
                    deleteModel(f.id);
                }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only ">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>                 
                )}
            </div>
            );

    }
    
    function showPrompt(m:any, userId:string){
        return(
            <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
              <Link href={m.status == "FINISH" ? ("/runPromptApp?prompt="+m.code+"&price="+m.price) : "#" }>
                <Image
                  alt="AI提示词应用"
                  width={512}
                  height={512}
                  src={ getThumbnail(m.coverImg, thumbSize) || defaultImage.promptCover }
                  className="sm:mt-0 mt-2 w-full"
                  />
              </Link>
              <button onClick={() => {
                deletePrompt(m.id);
               }}
                className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                <span className="sr-only">删除</span>
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                  <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                </svg>
             </button>                              
                <p className="text-gray-800  sm:px-2 px-1">
                   {' "'+ m.name + '"'}
                </p>
                <p className="text-gray-600  sm:px-2 px-1">
                   {" 发布价格:" + m.price + "个" + config.creditName + "每次"}
                </p>
                <p className="text-gray-600 sm:px-2 px-1">
                   {" 已经为我赚了" + m.ownerIncome + "个" + config.creditName}
                </p>
            
                <p className="text-gray-600  sm:px-2 px-1">
                   {" 创建时间:" + m.createTime.toString().slice(0,19)}
                </p>
            
                <p className="text-gray-600 sm:px-2 px-1">
                   {" 提示词内容:" + m.formular.substring(0,24)}
                </p>
            
                <button
                  onClick={() => {
                    updatePrompt(m.code, m.runtimes);
                  }}
                  className=" px-4 py-2 mt-8 mb-2 button-main"
                >
                  设置
                </button>                               
             </div>

        );
    }

    function showVDH(m:any, userId:string){
        return (
            <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
                <Link href={ "/createVDH?vdhId="+m.id }>
                    <Image                                        
                        alt="虚拟数字人"
                        width={thumbSize}
                        src={getThumbnail(m.pModel.coverImg, thumbSize)}
                        className="sm:mt-0 mt-2 w-full"
                        />
                </Link>
                <button onClick={() => { deleteVDH(m.id) }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>                              
                <p className="text-gray-800   sm:px-2 px-1">
                    {m.code + ' "'+ m.name + '"'}
                </p>
            </div>

        );
    }
    

    function showApp(m:any, userId:string){
        return(
            <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
              <Link href={ "/createWechatServiceApp?appId="+m.id }>
                <Image
                  alt="AI应用"
                  width={thumbSize}
                  src={ defaultImage.appCover }
                  className="sm:mt-0 mt-2 w-full"
                  />
              </Link>
              <button onClick={() => {
                deleteApp(m.id);
               }}
                className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                <span className="sr-only">删除</span>
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                  <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                </svg>
             </button>                              
              <p className="text-gray-800   sm:px-2 px-1">
               {' "'+ m.name + '"'}
              </p>
             </div>
        );
    }


    function showAlbum(m:any, userId:string){
        return (
            <div className="masonry-item border-gray-200 bg-gray-100 text-left relative inline-block">
                <Link href={ "/showAlbum?albumId="+m.id } target="_blank">
                    <Image                                        
                        alt="相册"
                        width={thumbSize}
                        src={getThumbnail(m.coverImg, thumbSize)}
                        className="sm:mt-0 mt-2 w-full"
                        />
                </Link>
                {m.status != "DELETED" && (
                <button onClick={() => { deleteAlbum(m.id) }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>   
                )}
                <p className="text-gray-800 sm:px-2 px-1">
                    {m.name}
                </p>
                {m.status != "DELETED" && (                
                <button
                    onClick={() => {
                        window.open("/createAlbum?albumId=" + m.id, "_blank");
                    }}
                    className="px-2 py-2 mt-8 button-gold "
                    >
                    设置
                </button>  
                )}
            </div>
        );
    }


    function showUser(m:any, userId:string){
        if(isAdmin()){
            return (
                <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
                    <Link href={ "/profile?userId="+m.id } target="_blank">
                        <Image                                        
                            alt="用户"
                            width={thumbSize}
                            src={getThumbnail(m.image, thumbSize)}
                            className="sm:mt-0 mt-2 w-full"
                            />
                    </Link>
                    <div className="flex flex-row justify-between">
                        <p className="text-gray-800 sm:px-2 px-1">
                            {' "'+ m.name + '"'}
                        </p>
                        <button
                          onClick={() => {
                            window.open(`/admin/userContent?userId=${m.id}`, "_blank");
                          }}
                          className=" px-4 py-2 mt-8 mb-2 button-main"
                        >
                          作品
                        </button>                  
                    </div>
                </div>
            );
        }else{
            return (
                <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
                    <Image                                        
                        alt="用户"
                        width={thumbSize}
                        src={getThumbnail(m.image, thumbSize)}
                        className="sm:mt-0 mt-2 w-full"
                        />
                    <div className="flex flex-row justify-between">
                        <p className="text-gray-800 sm:px-2 px-1">
                            {' "'+ m.name + '"'}
                        </p>
                    </div>
                </div>
            );
        }            
    }



    function showRoom(img:any, userId?:string, option?:string) {        
        return(
            <div className="group masonry-item border-gray-200 text-center flex-col relative inline-block">
                <div className="relative w-full text-xs">
                    {img.status!="FAILED" && img.outputImage && img.resultType=="VIDEO" ? (
                    <>
                        {img.status == "SUCCESS" ? (
                        <Link href={ ru.getVideoRest(img.id) } target="_blank">
                            <video className="rounded-xl" src={img.outputImage} controls={true} width={thumbSize} preload="none"
                                poster={getFileServerOfURL(img.outputImage) == enums.fileServer.BYTESCALE ? defaultImage.roomDeleted : img.inputImage} />
                        </Link>
                        ) : (img.status == "DELETE") ? (
                        <Link href={ ru.getVideoRest(img.id) } target="_blank">
                            <Image alt="AI作品" width={thumbSize} src={defaultImage.roomDeleted} className=" object-cover w-full rounded-xl" loading="lazy"/>
                        </Link>
                        ) : (
                        <Link href={ ru.getVideoRest(img.id) } target="_blank">
                            <Image alt="AI作品" width={thumbSize} src={defaultImage.roomCreating} className=" object-cover w-full rounded-xl" loading="lazy"/>                  
                        </Link>
                        )}
                    </>
                    ): (img.status!="FAILED" && img.outputImage && (img.resultType=="VOICE")) ? (
                    <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                        {img.status == "SUCCESS" ? (
                        <>
                            <Link className="text-white text-left mt-8 mb-10 left-5 text-sm"
                                href={ ru.getAudioRest(img.id) } target="_blank">
                                <span> { img.prompt ? `“${gh.countAndCut(img.prompt,200)}”` : " ... " } </span>
                            </Link>
                            <audio id="audioPlayer" controls className="w-full pt-2 ">
                                <source src={img.outputImage} type="audio/mpeg"/>
                                <source src={img.outputImage} type="audio/wav"/>
                                <source src={img.outputImage} type="audio/ogg"/>
                            </audio>                
                            <div className="mt-10">
                                &nbsp;
                            </div>          
                        </>
                        ) : img.status == "DELETE" ? (
                        <Image alt="AI作品" width={thumbSize} src={defaultImage.roomDeleted} className=" object-cover w-full rounded-xl" loading="lazy"/>
                        ) : (
                        <Image alt="AI作品" width={thumbSize} src={defaultImage.roomCreating} className=" object-cover w-full rounded-xl" loading="lazy"/>                  
                        )}
                    </div>
                    ) :  (img.status!="FAILED" && img.outputImage && (img.resultType=="IMAGE")) ? (
                    <Link href={ ru.getImageRest(img.id) } target="_blank">   
                        <Image alt="AI作品" className=" object-cover w-full rounded-xl" loading="lazy"
                            src={ 
                                (
                                    (img.status=="DELETE" || getFileServerOfURL(img.outputImage)==enums.fileServer.BYTESCALE) ? 
                                    defaultImage.roomDeleted :
                                    ( 
                                        (img.status==enums.roomStatus.midstep || img.status==enums.roomStatus.midsucc || img.status==enums.roomStatus.creating) ? 
                                        defaultImage.roomCreating : 
                                        (img.outputImageThumbnail || getThumbnail(img.outputImage, thumbSize))
                                    )
                                )
                            }
                        />
                    </Link>
                    ) : (
                    <div className="justify-between bg-gray-800 flex flex-col p-2 rounded-xl">
                        <Link className="text-white text-left mt-8 mb-10 left-5 text-sm" href={ru.getImageRest(img.id)} target="_blank">
                            <span> {img.status == "FAILED" ? "任务失败" : "返回结果"}：{(img.outputImage? ("“"+gh.countAndCut(img.outputImage,200)+"”") : " ... ") } </span>
                        </Link>    
                        <div className="mt-10 text-left">
                            <span> {((img.prompt && img.prompt.trim() != "")? ("“"+gh.countAndCut(img.prompt,200)+"”") : " ... ") } </span>
                        </div>          
                    </div>    
                    )}

                    { img.status!="DELETE" && (
                    // 红色X图标
                    <button onClick={() => {deleteRoom(img.id)}}
                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                        <span className="sr-only">删除</span>
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                        </svg>
                    </button>
                    )}
                    { img.status == "DELETE" && (
                    // 删除印章
                    <button className="absolute top-0 right-0 z-10 w-16 h-16 flex items-center justify-center text-red-500">
                        <span className="bg-red-500 text-white px-2 py-2 text-base">
                            {fu.isURL(img.outputImage) ? (getFileServerOfURL(img.outputImage) == enums.fileServer.BYTESCALE ? "DEL&RM" : "删除保留") : "NOMEDIA" }
                        </span>
                    </button>
                    )}

                    { img.status != "DELETE" && getFileServerOfURL(img.outputImage) == enums.fileServer.BYTESCALE && (
                    // 移除印章
                    <button className="absolute top-0 right-0 z-10 w-16 h-16 flex items-center justify-center text-red-500">
                        <span className="bg-red-500 text-white px-2 py-2 text-base">
                            {"REMOVED"}
                        </span>
                    </button>
                    )}              
                    
                    <div className="absolute bottom-1 left-1 w-4/5 flex flex-col hidden group-hover:block ">
                        { option && option=="SHOW_TITLE" && ( 
                        <div className=" w-full flex text-left items-left text-white ">
                            <p className="text-white text-center text-xs">“{gh.countAndCut(getFuncTitle(img.func, img.model), 30)}”</p>
                        </div>        
                        )}    
    
                        <Link className={"text-left items-left text-xs flex flex-row"} href={"/profile?userId="+img.user.id}>
                            <Image alt="作者" src={img.user?.image || defaultImage.userCover} className="w-6 rounded-full" width={12} height={12}/>             
                            <p className="text-white text-left px-1 py-1">
                                { gh.countAndCut(img.user.name,16) }
                            </p>   
                        </Link>
                    </div>

                    <div className="absolute bottom-0 right-0 flex flex-col items-right">
                        {fu.isURL(img.outputImage) && (getFileServerOfURL(img.outputImage) != enums.fileServer.BYTESCALE) && (
                        <button className=" w-12 h-5 button-main text-xs px-2  rounded-none"
                            onClick={() => {
                                removeRoom(img.id);
                            }}
                            >
                            移走
                        </button>                               
                        )}
                        <button className="w-12 h-5 button-dark text-xs px-2  rounded-none"
                            onClick={() => {
                                physicalDeleteRoom(img.id);
                            }}
                            >
                            彻删
                        </button>                                  
                    </div>
                </div>
            </div>     
        );
    }

    async function deleteRoom(roomId:string){
        const res = await callAPI("/api/updateRoom", {cmd:"DELETE", id:roomId});
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            window.location.reload();
        }          
    }

    async function removeRoom(roomId: string){
        const res = await callAPI("/api/updateRoom", { id:roomId, cmd:"BACKUP_TO_US" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            window.location.reload();
        }   
    }

    async function physicalDeleteRoom(roomId: string){
        const confirmed = await confirm("提醒：这是物理删除，一旦执行操作，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
        if(confirmed){
            const res = await callAPI("/api/updateRoom", { id:roomId, cmd:"PHYSICAL_DELETE" });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                window.location.reload();
            }   
        }
    }    
    
    async function deleteAlbum(id:string){
        const res = await fetch("/api/albumManager", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ id:id, cmd:"DELETE"})
        });
        let response = await res.json();
        if (res.status !== 200) {
            setError(response as any);
        } else {
            window.location.reload();
        }    
    }

    async function clockIn(){
        const res = await fetch("/api/creditManager", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({cmd:"CLOCK_IN"})
        });
        let response = await res.json();
        alert(response as any);
    }


    
    
    const classSegment = "text-left items-top flex-1 sm:pt-2 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500";

    function showData(data:any, userId:string){
        switch(segment){
            case "VOICE":
            case "VIDEO":
            case "PHOTO": return showRoom(data, userId, "NO_INFO");
            case "RAWDATA": return showRawdata(data, userId);
            case "USERFILE": return showUserFile(data, userId);
            case "CHATMODEL":
            case "IMGMODEL": return showModel(data, userId);
            case "VOICEMODEL": return showVModel(data);
            case "PROMPT": return showPrompt(data, userId);
            case "VDH": return showVDH(data, userId);
            case "APPLICATION": return showApp(data, userId);
            case "ALBUM": return showAlbum(data, userId);
            case "USER": 
            case "CLIENT":
            case "SUBORDINATE": return showUser(data, userId);
        }
    }


    if(status == "authenticated" && isAdmin()){

//    if(user){
        
        return (
            <div className="flex mx-auto w-full flex-col items-center justify-center min-h-screen">
                <main>
                    <div className="flex flex-col sm:flex-row overflow-auto w-full">
                        {showMenu && menuItems && menuItems.length>0 && (
                        <div className="flex w-[200] px-3 sm:px-0 flex-row justify-between sm:justify-start sm:flex-col ">
                            <div className="flex flex-row text-left px-2 w-full bg-gray-800 text-lg text-gray-100 py-2 ">
                                系统管理
                            </div>                            

                            {menuItems.map((m) => (                
                            <Link className={isCurrentSegment(m) ? "group flex flex-row bg-gray-800 py-1" : "group flex flex-row hover:bg-gray-800 py-1" }
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href = "/admin/mainMenu?segment=" + m.segment + "&page=1" + (m.params ? `&${m.params}` : "");
                                }}
                                >
                                <div className={isCurrentSegment(m) ? 
                                    "flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 pl-1 sm:px-3 bg-gray-800 text-gray-100 text-lg" : 
                                    "flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 pl-1 sm:px-3 group-hover:bg-gray-800 text-gray-300 text-lg" } >
                                    <p>{m.name}</p>
                                </div>                  
                            </Link>   
                            ))}


                            <Link className="group flex flex-row hover:bg-gray-800 py-1"
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href="/admin/cashier";
                                }}
                                >
                                <div className="text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 pl-1 sm:px-5 group-hover:bg-gray-800 text-gray-300 text-lg" >
                                    <p>收银台</p>
                                </div>                  
                            </Link>    

                            <Link className="group flex flex-row hover:bg-gray-800 py-1"
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href="/admin/visitorTrace";
                                }}
                                >
                                <div className="text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 pl-1 sm:px-5 group-hover:bg-gray-800 text-gray-300 text-lg" >
                                    <p>访问分析</p>
                                </div>                  
                            </Link>    

                            <Link className="group flex flex-row hover:bg-gray-800 py-1"
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href="/admin/userManager";
                                }}
                                >
                                <div className="text-left overflow-hidden whitespace-nowrap flex flex-1 py-1 pl-1 sm:px-5 group-hover:bg-gray-800 text-gray-300 text-lg" >
                                    <p>用户分析</p>
                                </div>                  
                            </Link>      
                            
                        </div>
                        )}

                        <div className="flex flex-1 flex-col items-center">
                            <div className="w-full text-left items-top flex-1 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                                <div className="flex flex-col space-y-5 mb-4 rounded-xl text-left items-center w-full space-x-2">
                                    {currentMenuItem?.create && (
                                    <div className="flex flex-row space-x-10 px-2 w-full items-left text-1xl">
                                        <p className="text-gray-200 ">
                                            <Link href={"/" + currentMenuItem?.create} className="text-main underline underline-offset-2">
                                                创建{currentMenuItem?.name}
                                            </Link>
                                        </p>
                                        <p className="hidden text-gray-400 ">
                                            提示：{currentMenuItem?.hint}
                                        </p>                                        
                                    </div>
                                    )}
                                    { currentMenuItem?.pannel ? currentMenuItem?.pannel() : <></> }
                                    <div className="w-full grid grid-flow-row-dense grid-cols-3 gap-3 sm:grid-cols-8">
                                        {myData && myData.length>0 && myData.map((m:any) => {
                                            return showData(m, user.id);
                                        })}  
                                    </div>    

                                    <div className="w-full flex flex-col items-center">
                                        <Pagination pageCount={totalPages} currentPage={currentPage} onPageChange={onPageChange} />    
                                    </div>                                      
                                    
                                </div>
                            </div>        

                              

                            {isAdmin() && (
                            <div className="w-full sm:pt-5 sm:w-1/2 flex flex-row items-center justify-center sm:mb-6 px-4">
                                <input id="iptWord" type="text" value = {word}
                                    className="input-search flex flex-1 font-medium px-4 h-10" 
                                    onChange={(e) => setWord(e.target.value)} 
                                    onKeyDown={(e) => {
                                        if(e.key == "Enter"){
                                            // 阻止默认的提交行为
                                            e.preventDefault();
                                            // 检查是否按下了 Ctrl 键
                                            if (e.ctrlKey || e.shiftKey || e.metaKey){
                                            } else {
                                                // 执行回车键按下后的操作
                                                search();
                                            }    
                                        }
                                    }}                          
                                    />     
                                <button className="button-search flex w-30 h-10 px-6 sm:px-8 items-center"
                                    onClick={() => {
                                        search();
                                    }}
                                    >
                                    搜索
                                </button>
                            </div>   
                            )}                            
                        </div>
                        
                    </div>    
                    
                </main>                    
                <Footer />  
            </div>
        );
    }else{
        return(
            <LoginPage config={config}/>
        );
    }
    
}



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let userId = "";
    let user = null;
    
    let segment = ctx?.query?.segment;
    let func = ctx?.query?.func;
    const onsky = ctx?.query?.onsky;
    const word = ctx?.query?.word;
                
    let page = parseInt(ctx?.query?.page || "1");
    let totalItems = 0;
    let rawDataModelId = ctx.query?.rawDataModelId;  
    const modelChannel = ctx.query?.modelChannel;
    
    if(!segment){
        if(config.websiteName == "haiwan"){
            segment = "CHATMODEL";
        }else{
            segment = "PHOTO";
        }
    }
    
    if (!session || !session.user || !session.user.email) {
        return { props: { myData:[], totalItems:0, user:null, config } };
    }else{
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(user){
            userId = user.id;
        }
        
    }  

    if(user){
        let myData:any[] = [];
        let start = (page-1) * itemsPerPage;
        // 这些条件都满足就是系统管理员界面
        const isAdmin = onsky && onsky=="aiputi" && user.actors && user.actors.indexOf("admin")>=0;

        let whereTerm:any = isAdmin ? {} : {
            status: {
                notIn: ['DELETE', 'DELETED']
            },         
        };
        if(!isAdmin && segment!= "USER" && segment!="SUBORDINATE" && segment!="CLIENT"){
            whereTerm.userId = userId;
        }

        switch(segment){
            case "PHOTO": 
                // whereTerm.outputImage = { contains: "https://" };  
                const startTime = Date.now();
                whereTerm.resultType = "IMAGE";
                if(word){
                    whereTerm.OR = [
                        { prompt: { contains: word } }, 
                        { model: { contains: word } },
                        { func: { contains: word } },
                        { bodystr: { contains: word } },   
                        { id: { contains: word } },
                        { userId: { contains: word } },    
                        { outputImage: { contains: word } },                        
                    ];
                }
                totalItems = await prisma.room.count({where:whereTerm});
                const countTime = Date.now();
                debug.log(countTime - startTime);
                myData = await prisma.room.findMany({
                    where: whereTerm,
                    orderBy: {
                        createdAt: 'desc',
                    },      
                    skip: start,
                    take: itemsPerPage,
                    select: {
                        id:true,
                        inputImage:true,
                        outputImage:true,
                        prompt:true,
                        createdAt:true,
                        updatedAt:true,
                        func:true,
                        model:true,
                        usedCredits:true,
                        status:true,
                        price:true,
                        viewTimes:true,
                        dealTimes:true,
                        sysScore:true,
                        likes:true,
                        access:true,
                        seed:true,
                        resultType:true,
                        desc:true,
                        audit:true,
                        userId:true,
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                actors: true,
                                grade: true
                            }
                        }
                    }    
                });
                const findTime = Date.now();
                debug.log(findTime - countTime);
                break;
                
            case "VOICE":
                whereTerm.resultType = "VOICE";
                if(word){
                    whereTerm.OR = [
                        { prompt: { contains: word } }, 
                        { model: { contains: word } },
                        { id: { contains: word } },
                        { userId: { contains: word } },                        
                    ];
                }                
                totalItems = await prisma.room.count({where:whereTerm});
                myData = await prisma.room.findMany({
                    where: whereTerm,
                    orderBy: {
                        createdAt: 'desc',
                    },      
                    skip: start,
                    take: itemsPerPage,
                    include: {
                        user: true,
                    },
                });
                break;

            case "VIDEO":
                whereTerm.resultType = "VIDEO";
                if(word){
                    whereTerm.OR = [
                        { prompt: { contains: word } }, 
                        { func: { contains: word } },
                        { bodystr: { contains: word } },  
                        { id: { contains: word } },
                        { userId: { contains: word } },                        
                    ];
                }                
                totalItems = await prisma.room.count({where:whereTerm});
                myData = await prisma.room.findMany({
                    where: whereTerm,
                    orderBy: {
                        createdAt: 'desc',
                    },      
                    skip: start,
                    take: itemsPerPage,
                    include: {
                        user: true,
                    },
                });
                break;

            case "VDH":
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { gender: { contains: word } },
                        { label: { contains: word } },
                        { info: { contains: word } },                    
                        { desc: { contains: word } },
                        { userId: { contains: word } },                    
                        { channel: { contains: word } },                                            
                    ];
                }                  
                totalItems = await prisma.vDH.count({where:whereTerm});
                myData = await prisma.vDH.findMany({
                    where: whereTerm,
                    orderBy:[
                        {score: 'desc'},
                        { createTime: 'desc'}
                    ],
                    skip: start,
                    take: itemsPerPage,                    
                    include:{
                        pModel: true
                    }
                });
                break;

            case "PROMPT":
                const channel = ctx.query?.channel;
                if(channel){
                    whereTerm.channel = channel;
                }
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { func: { contains: word } },
                        { formular: { contains: word } },                    
                        { id: { contains: word } },
                        { userId: { contains: word } },                    
                        { channel: { contains: word } },                                            
                    ];
                }                
               // whereTerm.func = {in:rooms};
                totalItems = await prisma.prompt.count({where:whereTerm});
                myData = await prisma.prompt.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: {
                        createTime: 'desc',
                    }
                });
                break;

            case "CHATMODEL":
                whereTerm.func = "chat";
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { func: { contains: word } },
                        { labels: { contains: word } },                    
                        { id: { contains: word } },
                        { userId: { contains: word } },                    
                        { channel: { contains: word } },                                            
                    ];
                } 
                if(modelChannel){
                    whereTerm.channel = modelChannel;
                }                
                totalItems = await prisma.model.count({where:whereTerm});
                myData = await prisma.model.findMany({
                    where: whereTerm,
                    include: {
                        user: true,
                    },                    
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: {
                        createTime: 'desc',
                    }
                });
                break;

            case "IMGMODEL":
                whereTerm.func = "lora";
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { func: { contains: word } },
                        { labels: { contains: word } },                    
                        { id: { contains: word } },
                        { userId: { contains: word } },                    
                        { channel: { contains: word } },                                            
                    ];
                }                 
                if(modelChannel){
                    whereTerm.channel = modelChannel;
                }
                totalItems = await prisma.model.count({where:whereTerm});
                myData = await prisma.model.findMany({
                    where: whereTerm,
                    include: {
                        user: true,
                    },                    
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: {
                        createTime: 'desc',
                    }
                });
                break;

            case "VOICEMODEL":
                whereTerm.func = "voice";
                whereTerm.status = "FINISH";
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { func: { contains: word } },
                        { labels: { contains: word } },                    
                        { id: { contains: word } },
                        { userId: { contains: word } },                    
                        { channel: { contains: word } },                                            
                    ];
                }                 
                totalItems = await prisma.model.count({where:whereTerm});
                myData = await prisma.model.findMany({
                    where: whereTerm,
                    include: {
                        user: true,
                    },                    
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: [
                        { createTime: 'desc'},
                        { sysScore: 'desc'},
                    ],
                });
                break;

            case "APPLICATION":
                if(word){
                    whereTerm.OR = [
                        { name: { contains: word } },
                        { desc: { contains: word } },
                    ];
                }                 
                totalItems = await prisma.application.count({where:whereTerm});
                myData = await prisma.application.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: {
                        createTime: 'desc',
                    },
                });
                break;
            case "ALBUM":
                if(word){
                    whereTerm.OR = [
                        { code: { contains: word } }, 
                        { name: { contains: word } },
                        { userId: { contains: word } },                    
                        { desc: { contains: word } },                                            
                    ];
                }                 
                totalItems = await prisma.album.count({where:whereTerm});
                myData = await prisma.album.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: [ 
                        { createTime: 'desc' },
                        { score: 'desc' }, 
                    ],
                });
                break;

            case "USERFILE":
                if(word){
                    whereTerm.OR = [
                        { id: { contains: word } },
                        { userId: { contains: word } },                    
                        { desc: { contains: word } },                                            
                        { url: { contains: word } },                                                                    
                    ];
                }                 
                totalItems = await prisma.userFile.count({where:whereTerm});
                myData = await prisma.userFile.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: [ 
                        { createTime: 'desc' },
                        { score: 'desc' }, 
                    ],
                    include: {
                        user: true,
                    },                    
                });
                break;
                
            case "RAWDATA":
                if(word){
                    whereTerm.OR = [
                        { name: { contains: word } },
                        { userId: { contains: word } },                    
                        { desc: { contains: word } },                                            
                    ];
                }                 
                if(rawDataModelId){
                    whereTerm = (rawDataModelId == "def_model_") ? {code: "def_model_"+userId} : {id: rawDataModelId};
                    const tm = await prisma.model.findUnique({
                        where: whereTerm,
                        include: {
                            modelRawdatas: {
                                include: {
                                    rawdata: true
                                },
                                orderBy: {
                                    createTime: 'desc',
                                }                  
                            }
                        }
                    });
                    myData = (tm?.modelRawdatas && tm.modelRawdatas.length>0) ? tm.modelRawdatas.map(modelRawdata  => modelRawdata .rawdata) : [];
                    totalItems = myData.length;
                }else{
                    totalItems = await prisma.rawdata.count({where:whereTerm});                    
                    myData = await prisma.rawdata.findMany({
                        where:whereTerm,
                        skip: start,
                        take: itemsPerPage,                        
                        orderBy: {
                            createTime: 'desc',
                        },
                    });
                }
                break;

            case "USER":
                if(word){
                    if(word == "付费用户"){
                        whereTerm.boughtCredits = { gt: 0 };
                    }else{
                        whereTerm.OR = [
                            { email: { contains: word } }, 
                            { name: { contains: word } },
                            { desc: { contains: word } },
                            { id: { contains: word } },
                        ];
                    }
                }                 
                if(isAdmin){
                    totalItems = await prisma.user.count({ where:whereTerm });
                    myData = await prisma.user.findMany({
                        where: whereTerm,
                        skip: start,
                        take: itemsPerPage,                    
                        orderBy: [ 
                            { createdAt: 'desc' },
                        ],
                    });
                }else{
                    totalItems = 0;
                    myData = [];
                }
                break;

            case "SUBORDINATE":
                whereTerm = {
                    invitedbycode: user.id
                };
                totalItems = await prisma.user.count({ where:whereTerm });
                myData = await prisma.user.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: [ 
                        { createdAt: 'desc' },
                    ],
                });
                break;
        }

        monitor.logUserRequest(ctx, session, user);
        return {
            props: {
                myData: myData || [],
                totalItems,
                segment,
                user,
                config
            },
        };
    }else{
        monitor.logUserRequest(ctx);
        return { props: { myData:[], totalItems:0, segment, user:null, config } };
    }
}


          
