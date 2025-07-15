import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { getServerSession } from "next-auth";
import React from 'react';
import {
  GlobeAltIcon,
  LightBulbIcon,
  PencilIcon,
  UserGroupIcon,
  SparklesIcon,
  UsersIcon,
  FilmIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  FaceSmileIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  BookmarkIcon,
  ArrowPathIcon,
  PhotoIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ArrowUpTrayIcon,
  RectangleStackIcon,
  UserPlusIcon,
  BookOpenIcon,
  DocumentIcon,
  CloudArrowUpIcon,
  Squares2X2Icon,
  PaintBrushIcon,
  GiftIcon,
  BanknotesIcon,
  UserCircleIcon
} from '@heroicons/react/24/solid';


import { Room, Prompt, Model, Application, User, Rawdata, VDH } from "@prisma/client";
import prisma from "../lib/prismadb";
import { authOptions } from "./api/auth/[...nextauth]";

import UserHeader from "../components/UserHeader";
import BuddhaHeader from "../components/BuddhaHeader";
import Footer from "../components/Footer";
import { RoomGeneration } from "../components/RoomGenerator";
import { showRoom } from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import Pagination from '../components/Pagination';
import MultiStateImage from '../components/MultiStateImage';
import Image from "../components/wrapper/Image";
import Video from "../components/wrapper/Video";

import { showDate, showDateTime } from "../utils/dateUtils";
import { config, defaultImage } from "../utils/config";
import * as debug from "../utils/debug";
import { getFileIcon } from "../utils/rawdata";
import {isWeixinBrowser} from "../utils/wechatUtils";
import {callAPI} from "../utils/apiUtils";
import {getThumbnail, getFileServerOfURL, isURL} from "../utils/fileUtils";
import * as enums from "../utils/enums";
import * as monitor from "../utils/monitor";
import * as vu from "../utils/videoUtils";
import * as fu from "../utils/fileUtils";

const itemsPerPage = 16;
const colsPerRow = 8;
const thumbSize = 256;


export default function Dashboard({ user, config, segment, myData, totalItems, newData }: { user: User, config:any, segment:string, myData:any[], totalItems:number, newData:any}) {
    const router = useRouter();

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [word, setWord] = useState<string>(router.query.word as string || "");
    
    let app = router.query.app; // 处理buddha模块
    let appId = router.query.appId; // 微信的appid
    
    let menuItems:any[] = [];
    switch(config.websiteName){
        case "haiwan":
            menuItems = [
                {menuId:"0101", segment:"CHATMODEL", name:"我的攻略", inPhone:true, params:"modelChannel=TRAVEL", create:"createChatModel?title=旅行攻略&channel=TRAVEL"},
                {menuId:"0102", segment:"RAWDATA", name:"我的文件", inPhone:true, create:"uploadRawdata"}
            ];
            break;
        case "framuse":
            menuItems = [
                {menuId:"0101", segment:"PHOTO", name:"My Photos", inPhone:true, icon:"/icons/photo.svg", create:""},
                {menuId:"0108", segment:"VIDEO", name:"My Videos", inPhone:true, icon:"/icons/video.svg", create:""},       
                {menuId:"0107", segment:"VOICE", name:"My Audios", inPhone:true, icon:"/icons/audio.svg", create:""},  
                {menuId:"0103", segment:"USERFILE", name:"My Uploads", icon:"/icons/upload.svg", create:""},
                {menuId:"0102", segment:"ALBUM", name:"My Albums", icon:"/icons/album.svg", create:"createAlbum"},  
                {menuId:"0105", segment:"IMGMODEL", name:"My Characters", params:"modelChannel=FASHION", icon:"/icons/fashion.svg", create:"createLoRA?title=Character&channel=FASHION", newData:newData?.newFashions},                
                {segment:"SUBORDINATE", name:"My Invitations", icon:"/icons/invitation.svg", create:""}
            ];
            break;              
        case "niukit":
            menuItems = [
                {menuId:"0101", segment:"PHOTO", name:"我的照片", inPhone:true, icon:"/icons/photo.svg", create:""},
                {menuId:"0108", segment:"VIDEO", name:"我的视频", inPhone:true, icon:"/icons/video.svg", create:""},       
                {menuId:"0107", segment:"VOICE", name:"我的音频", inPhone:true, icon:"/icons/audio.svg", create:""},  
                {menuId:"0103", segment:"USERFILE", name:"我的上传", icon:"/icons/upload.svg", create:""},
                {menuId:"0102", segment:"ALBUM", name:"我的相册", icon:"/icons/album.svg", create:"createAlbum"},  
                {menuId:"0105", segment:"IMGMODEL", name:"数字人物", params:"modelChannel=FACE", icon:"/icons/fashion.svg", create:"createLoRA?title=数字人物&channel=FASHION&theme=FACE&object=人物", newData:newData?.newFashions},                
                {menuId:"0106", segment:"IMGMODEL", name:"艺术风格", params:"modelChannel=STYLE", icon:"/icons/portrait.svg", create:"createLoRA?title=艺术风格&channel=PORTRAIT&theme=STYLE&object=风格", newData:newData?.newPortraits},                
                {menuId:"0111", segment:"SPEAKER", name:"声音模型", icon:"/icons/audio.svg", create:"createSpeaker"},                                
                {segment:"SUBORDINATE", name:"我的邀请", icon:"/icons/invitation.svg", create:""}
            ];
            break;            
        case "aixiezhen":
            menuItems = [
                {menuId:"0101", segment:"PHOTO", name:"我的照片", inPhone:true, icon:"/icons/photo.svg", create:""},
                {menuId:"0108", segment:"VIDEO", name:"我的视频", inPhone:true, icon:"/icons/video.svg", create:""},       
                {menuId:"0107", segment:"VOICE", name:"我的音频", inPhone:true, icon:"/icons/audio.svg", create:""},  
                {menuId:"0103", segment:"USERFILE", name:"我的上传", icon:"/icons/upload.svg", create:""},
                {menuId:"0102", segment:"ALBUM", name:"我的相册", icon:"/icons/album.svg", create:"createAlbum"},  
                {menuId:"0105", segment:"IMGMODEL", name:"数字人物", params:"modelChannel=FASHION", icon:"/icons/fashion.svg", create:"createLoRA?title=数字人物&channel=FASHION", newData:newData?.newFashions},                
                //{menuId:"0109", segment:"SPEAKER", name:"我的发音人", icon:"/icons/speaker.svg", create:"createSpeaker"},                                
                // {menuId:"0104", segment:"IMGMODEL", name:"我的套系", params:"modelChannel=PORTRAIT", icon:"/icons/portrait.svg", create:"createLoRA?title=写真套系&channel=PORTRAIT", newData:newData?.newPortraits},
                // {menuId:"0106", segment:"PROMPT", name:"我的创意", params:"channel=PORTRAIT", create:"createPrompt?title=创意实验室&channel=PORTRAIT"},
                {segment:"SUBORDINATE", name:"我的邀请", icon:"/icons/invitation.svg", create:""}
            ];
            break;
        case "aiputi":
            menuItems = [
                {menuId:"0101", segment:"CHATMODEL", name:"我的书籍", inPhone:true, params:"modelChannel=BOOK", create:"createChatModel?title=上传书籍&channel=BOOK"},
                {menuId:"0102", segment:"RAWDATA", name:"我的文件", inPhone:true, create:"uploadRawdata"}
            ];
            break;
    }    

    function getMenuIcon(segment:string, params:string) {
      if (segment === "IMGMODEL") {
        if (params?.includes("modelChannel=FACE")) {
          return <UserCircleIcon className="w-5 h-5 text-inherit" />; // 数字人物
        }
        if (params?.includes("modelChannel=STYLE")) {
          return <SparklesIcon className="w-5 h-5 text-inherit" />; // 艺术风格
        }
        return <PaintBrushIcon className="w-5 h-5 text-inherit" />; // 默认图标
      }
    
      switch (segment) {
        case "PHOTO": return <PhotoIcon className="w-5 h-5 text-inherit" />;
        case "VIDEO": return <VideoCameraIcon className="w-5 h-5 text-inherit" />;
        case "VOICE": return <SpeakerWaveIcon className="w-5 h-5 text-inherit" />;
        case "USERFILE": return <CloudArrowUpIcon className="w-5 h-5 text-inherit" />;
        case "ALBUM": return <RectangleStackIcon className="w-5 h-5 text-inherit" />;
        case "SPEAKER": return <SpeakerWaveIcon className="w-5 h-5 text-inherit" />;
        case "SUBORDINATE": return <UserPlusIcon className="w-5 h-5 text-inherit" />;
        case "CHATMODEL": return <BookOpenIcon className="w-5 h-5 text-inherit" />;
        case "RAWDATA": return <DocumentIcon className="w-5 h-5 text-inherit" />;
        default: return <Squares2X2Icon className="w-5 h-5 text-inherit" />;
      }
    }
    
    useEffect(() => {
        setCurrentMenuItem(menuItems[0]);
    }, []); // 空数组表示只在组件挂载时执行一次

    let modelChannel = router.query.modelChannel as string;
    let channel = router.query.channel as string;
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
                  (!!channel === !!(menuItem.params && menuItem.params.indexOf(`channel=${channel || ""}`) >= 0)) ){
                setCurrentMenuItem(menuItem);
                break;
            }
        }
    }, [segment,modelChannel,channel]);

    function search(){
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("word", word);
        window.location.href = currentUrl.toString();
    }
    
    let showMenu = !router.query.noMenu;  // 如果参数不显示菜单，就不显示菜单
    let showImgModel = !router.query.func || router.query.func=="lora" ? true : false;
    let showChatModel = !router.query.func || router.query.func=="chat" ? true : false;
    let showSPEAKER = !router.query.func || router.query.func=="voice" ? true : false;
    
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
    if ((segment === "CHATMODEL" || segment === "IMGMODEL") && myData) {
        useEffect(() => {
            // 设置定时器
            const interval = setInterval(() => {
                myData.forEach((m) => {
                    if (m.status === enums.modelStatus.start || m.status === enums.modelStatus.create) {
                        callAPI("/api/updateModel", { cmd: "STATUS", modelId: m.id }).then((res) => {
                            if (res.status === 200 && res.result.status !== enums.modelStatus.start) {
                                window.location.reload();
                            }
                        });
                    }
                });
            }, 10000);
    
            // 清理定时器
            return () => clearInterval(interval);
        }, [myData, segment]); // 添加依赖项
    }


    if (segment === "PHOTO" || segment === "VOICE" || segment === "VIDEO") {
        useEffect(() => {
            const interval = setInterval( async () => {
                for(const m of myData){
                    if (
                        m.status != enums.roomStatus.failed &&
                        m.status != enums.roomStatus.success &&
                        m.status != enums.roomStatus.delete
                    ) {
                        const res = await callAPI("/api/updateRoom", { cmd: "GET_DATA", id: m.id });
                        if (res.status === 200) {
                            if (res.result.status === enums.roomStatus.failed) {
                                alert(res.result.outputImage);
                                window.location.reload();
                            }
                            if (
                                res.result.status === enums.roomStatus.success ||
                                res.result.status === enums.roomStatus.delete
                            ) {
                                window.location.reload();
                            }
                        }
                    }
                }
            }, 10000);
    
            // 清理定时器
            return () => clearInterval(interval);
        }, [myData, segment]); // `myData` 作为依赖
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
                alert('请点击左下角浏览器的"..." 按钮，通过浏览器分享。');
            }
        }else{
            alert('请先登录才能分享主页');
        }
    }  
    
    function pubModel(m:any){
      //if(func=="lora" && (runtimes==null || runtimes<3)){
      //    alert("恭喜您训练成功新模型，为了让其它用户了解您的模型，您至少需要自己先生成三张样例照片，才可以发布！我们已经赠送您30个" + config.creditName + "，快去试试吧！");
      //    return;
      //}
      
        // window.location.href = "/publishModel?model=" + code + "&price=" + price;
        if(m){
            window.open("/publishModel?model=" + m.code + "&price=" + m.price, "_blank");    
        }
    }
  
    async function unpubModel(m:any){
        if(m){
            const res = await callAPI("/api/updateModel", { modelId:m.id, price:m.price, access:"PRIVATE" });
            if (res.status !== 200) {
                setError(res.result as any);
            } else {
                window.location.reload();
            }
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
                <Video className=" rounded-xl" src={m.url} controls={true} width={thumbSize} onClick={()=>(window.open(m.url, "_blank"))}/>               
                ) : m.status == "DELETED" &&  m.url && m.url.endsWith(".mp4") ? (
                <Image alt="用户上传的图片" width={thumbSize} 
                    src={ defaultImage.roomDeleted } 
                    className="sm:mt-0 mt-2 w-full" 
                    onClick={()=>(window.open(m.url, "_blank"))}
                    />
                ) : m.status != "DELETED" && m.url && fu.getFileTypeByURL(m.url)=="VOICE" ? (
                <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                    <audio id="audioPlayer" controls className="w-full pt-2 ">
                        <source src={m.url} type="audio/mpeg" />
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
                  <span className="bg-red-500 text-white px-2 py-2 text-base">{getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE ? "DELETED" : "已删除"}</span>
                </button>
                )}                

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

    function useModel(m:any){
        if(m.status == "FINISH"){
            if(m.func == "chat"){
                modelAction(m, "/chatbot?model="+ m.id);
            }else if(m.func == "lora"){
                let mp:any;
                try{
                    if(m?.params){
                        mp = JSON.parse(m.params);
                    }
                }catch(e){
                }                        
                if(mp?.aPrompt){                        
                    if(m.channel == "PORTRAIT"){
                        modelAction(m, "/showImageModel?model="+m.code+"&price="+m.price);    
                    }else{
                        modelAction(m, "/showImageModel?model="+m.code+"&price="+m.price);
                    }
                }else{
                    alert("您还没有完成模型设置，请先设置一下模型吧！");
                    if(m.userId == user.id){
                        pubModel(m);
                    }
                }
            }else if(m.func == "voice"){
                modelAction(m, "/createVoice?model=" + m.code);                                            
            }            
        }
    }
    
    function showModel(m:any, userId:string){
        return (
            <div className="group masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left flex flex-col items-center justify-between">

                <div className="w-full flex flex-col items-center relative inline-block">
                    <Link href="#" onClick = {()=> { useModel(m)}} >                        
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
                    {m.status == "FINISH" && (
                    <button className="absolute button-green-blue hidden group-hover:flex top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2 px-6 rounded-xl"
                        onClick={() => { useModel(m); }}                       
                        >
                        使用
                    </button>                 
                    )}
                    <button onClick={() => {
                        deleteModel(m.id);
                    }}
                        className="hidden group-hover:flex absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
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
                
                {(["FINISH", "ERROR"].includes(m.status)) && (m.func!="voice") && (
                <button
                    onClick={() => {
                      pubModel(m);
                    }}
                    className="w-full px-2 py-2 mt-8 button-gold hover:bg-yellow-400"
                  >
                      设置&发布
                  </button>                               
                ) }
            </div>      
            
        );
    }

    function showVModel(f:any){
        return(
            <div className="justify-between bg-gray-800 justify-top flex flex-col">
                <Link className="text-white text-left mt-8 mb-10 left-5 text-sm" href="#"
                    onClick={() => modelAction(f, "/createVoice?model=" + f.code) }                                                        
                    >
                    <span> {`【${f.theme == "MALE" ? "男声" : "女声"}】${f.name}`} </span>
                </Link>
                <audio id="audioPlayer" controls className="w-full pt-2 ">
                    <source src={f.desc} type="audio/mpeg"/>
                    <source src={f.desc} type="audio/wav"/>
                    <source src={f.desc} type="audio/ogg"/>
                </audio>                
                <div className="mt-10">
                    &nbsp;
                </div>  
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
                <button onClick={() => { deleteAlbum(m.id) }}
                    className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                    <span className="sr-only">删除</span>
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                    </svg>
                </button>   
                <p className="text-gray-800 sm:px-2 px-1">
                    {m.name}
                </p>
                  <button
                    onClick={() => {
                      window.open("/createAlbum?albumId=" + m.id, "_blank");
                    }}
                    className="px-2 py-2 mt-8 button-gold "
                  >
                    设置
                  </button>  
            </div>
        );
    }


    function showUser(m:any, userId:string){
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
        // window.open("/adv/invitationPlan", "_blank");
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
            case "SPEAKER": return showVModel(data);
            case "PROMPT": return showPrompt(data, userId);
            case "VDH": return showVDH(data, userId);
            case "APPLICATION": return showApp(data, userId);
            case "ALBUM": return showAlbum(data, userId);
            case "USER": 
            case "CLIENT":
            case "SUBORDINATE": return showUser(data, userId);
        }
    }


    if(status == "authenticated"){

//    if(user){
        
        return (
            <div className="flex mx-auto w-full flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>{ currentMenuItem?.name || "我的空间" }</title>
                    {user && user.name && user.image && (
                    <div>
                        <meta property="og:description" content={"来" + config.appName + "看看我创作的作品吧"} />
                        <meta property="og:title" content={user.name+"的作品集"} />
                        <meta property="og:image" content={user.image} />    
                        <meta name="description" content={"来" + config.appName + "看看我创作的作品吧"} />  
                    </div>
                    )}        
                </Head>
                
                { app && (app == "BUDDHA") ? (
                <BuddhaHeader/>
                ) : (
                <UserHeader config={config}/>
                )}

                <main>
                    {showMenu && (
                    <h1 className="hidden title-main">
                        <div className="hidden sm:block flex flex-row items-center justify-center">
                            <p>
                                “{ (user && user.name) ? user.name : "个人"}”的空间
                            </p>
                            {/*
                            <Image
                                alt="分享"
                                src= "https://fileserver.aiputi.cn/icon/share.svg"
                                className="w-7 h-7 rounded-full pl-1 cursor-pointer"
                                width={20}
                                height={20}
                                onClick={() => {
                                    shareUserPage();
                                }}             
                                />     
                                */}
                        </div>            
                    </h1>
                    )}

                    {/* 手机上的菜单 */}

                    {/* PC上的菜单 */}
                    <div className="flex flex-col sm:flex-row overflow-auto w-full">

                        {/* PC上的菜单 */}                        
                        {showMenu && menuItems && menuItems.length>0 && (
                        <div className="flex menu-tab w-full sm:w-auto sm:max-w-40 sm:h-screen pt-5 px-3 space-y-2 sm:px-0 flex-row justify-between sm:justify-start sm:flex-col ">
                            <div className="hidden sm:block w-full">
                                <button className="w-full button-green-blue-rect py-3"
                                    onClick={(e) => {
                                        clockIn();
                                    }}                                    
                                    >每日打卡得奖励</button>
                            </div>
                          {/*
                            <Link className="menu-item group hidden sm:flex flex-row py-1 px-1"
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href=`/chatbot?model=${user.model}`;
                                }}
                                >
                                <div className="flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap flex-1 py-1 px-4 sm:px-1 " >
                                    <GlobeAltIcon  className="w-5 h-5 text-inherit" />
                                    <p>DeepSeek</p>
                                </div>                  
                            </Link>     
                            */}
                            {menuItems.map((m) => ( 
                            <Link className={isCurrentSegment(m) ? `group flex flex-row menu-item-selected py-1 px-1` : `group ${m.inPhone ? "flex" : "hidden sm:flex"} flex-row menu-item py-1 px-1` }
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href = "/dashboard?segment=" + m.segment + "&page=1" + (m.params ? `&${m.params}` : "");
                                }}
                                >
                                <div className={isCurrentSegment(m) ? 
                                    "flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap py-1 px-4 sm:px-1 " : 
                                    "flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap py-1 px-4 sm:px-1 " } >
                                    {getMenuIcon(m.segment, m.params)}
                                    <p className={m.newData > 0 ? "blink" : "" }>{m.name}</p>
                                </div>                  
                            </Link>   
                            ))}
                         
                            <Link className="menu-item group hidden sm:flex flex-row py-1 px-1"
                                href="#"  
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href="/buy-credits";
                                }}
                                >
                                <div className="flex flex-row space-x-2 text-left overflow-hidden whitespace-nowrap py-1 px-4 sm:px-1">
                                  <BanknotesIcon className="w-5 h-5 text-inherit" />
                                  <p>我的{config.creditName}</p>
                                </div>                 
                            </Link>                             
                        </div>
                        )}

                        <div className="flex flex-1 flex-col items-center">
                            <div className="w-full text-left items-top flex-1 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                                <div className="flex flex-col space-y-5 mb-4 mt-4 rounded-xl text-left items-center w-full space-x-2">
                                    {currentMenuItem?.create && (
                                    <div className="hidden sm:flex flex-row space-x-10 px-2 w-full items-left text-1xl">
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
                                    {(user.boughtCredits<=0) && (
                                    <p className="text-base text-gray-400">
                                        提醒：未付费用户的图片、视频、音频、上传文件等数据文件资产在24小时之后有可能会被系统自动删除，请注意保存。
                                    </p>
                                    )}

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
        let whereTerm:any = {
            status: {
                notIn: ['DELETE', 'DELETED']
            },         
        };
        if(segment!= "USER" && segment!="SUBORDINATE" && segment!="CLIENT"){
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
                for(const room of myData){
                    if(room.resultType == "VIDEO" && room.status == "SUCCESS" && isURL(room.outputImage) && !room.inputImage){ // 如果视频没有inputImage
                        try{
                            vu.captureFrame(room.outputImage, 0, "U").then(async (frame:string|null)=>{
                                if(frame){
                                    room.inputImage = frame;
                                    await prisma.room.update({data:{inputImage:frame}, where:{id:room.id}});
                                }
                            });
                        }catch(err){
                            debug.error("exception when captureFrame:", err);
                        }
                    }
                }                
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
                    if(modelChannel == "STYLE"){
                        whereTerm.channel = { in: ["PORTRAIT", "COMIC", "ART", "DRAW"] };
                    }
                    if(modelChannel == "FACE"){                    
                        whereTerm.channel = { in: ["FASHION"] };
                    }
                  //  whereTerm.theme = modelChannel;
                }
                totalItems = await prisma.model.count({where:whereTerm});
                myData = await prisma.model.findMany({
                    where: whereTerm,
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: {
                        createTime: 'desc',
                    }
                });
                break;

            case "SPEAKER":
                whereTerm.func = "voice";
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
                    skip: start,
                    take: itemsPerPage,                    
                    orderBy: [
                        { createTime: 'desc'},
                        { theme: 'asc' },
                        { name: 'asc' },                        
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
                totalItems = 0;
                myData = [];
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


        const newFashions = await prisma.model.count({
            where:{
                func : "lora",
                userId : user.id,
                status : enums.modelStatus.finish,
                runtimes : 0,
                channel : "FASHION"
            }
        });

        const newPortraits = await prisma.model.count({
            where:{
                func : "lora",
                userId : user.id,
                status : enums.modelStatus.finish,
                runtimes : 0,
                channel: {
                  in: ["PORTRAIT", "COMIC", "ART", "DRAW"] // 匹配多个可能的 channel 值
                }            
            }
        });
        
        monitor.logUserRequest(ctx, session, user);
        return {
            props: {
                myData: myData || [],
                totalItems,
                segment,
                user,
                config,
                newData:{
                    newFashions,
                    newPortraits
                }
            },
        };
    }else{
        monitor.logUserRequest(ctx);
        return { props: { myData:[], totalItems:0, segment, user:null, config } };
    }
}


          
