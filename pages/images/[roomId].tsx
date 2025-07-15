import { useState, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import { useRouter } from "next/router";
import prisma from "../../lib/prismadb";
import { authOptions } from "../api/auth/[...nextauth]";
import Link from "next/link";
import { Tooltip } from 'react-tooltip';

import { User, Room } from "@prisma/client";

import TopFrame from "../../components/TopFrame";
import LoginPage from "../../components/LoginPage";
import ErrorPage from "../../components/ErrorPage";
import ComboSelector from "../../components/ComboSelector";
import AlbumSelector from "../../components/AlbumSelector";
import TaskPannel from "../../components/TaskPannel";
import RoomAdminPanel from "../../components/RoomAdminPanel";
import AutoSizeImage from "../../components/AutoSizeImage";
import ToolBar from "../../components/ToolBar";
import RulerBox from "../../components/RulerBox";
import FormLabel from "../../components/FormLabel";
import LoadingDots from "../../components/LoadingDots";


import * as monitor from "../../utils/monitor";
import * as rmu from "../../utils/roomUtils";
import downloadPhoto from "../../utils/fileUtils";
import { config } from "../../utils/config";
import * as fc from "../../utils/funcConf";


import { Icon } from '@iconify/react';
import {
  LightBulbIcon,
  AdjustmentsHorizontalIcon,
  PencilIcon,
  MagnifyingGlassPlusIcon,
  TvIcon as CartoonIcon,
  ArrowsPointingOutIcon,
  UsersIcon,
  FilmIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  FaceSmileIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  BookmarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';




export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
  
    const session = await getServerSession(ctx.req, ctx.res, authOptions);    
    let user;
  
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            }
        });
    }    
    
    let roomId = ctx?.query?.roomId;
    if(roomId){
        let image = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
            include:{
                user: true
            }
        });
  
        let author = image?.user;
        
        // 更新阅读次数+1
        if(image){
            await prisma.room.update({
                where: {
                    id: image.id,
                },
                data: {
                    viewTimes: {
                        increment: 1,
                    },
                },
            }); 
        }

        const path:any[] = await rmu.getPathNodes(image, user);
        
        return {
            props: {
                image,
                path,
                author,
                user,
                config
            },
        };
    }else{
        return{
            props:{
                config
            }
        }
    }
}  





export default function showImage({ image, path, author, user, config, albums }: { image : Room, path:any[], author: User, user: User, config: any, albums:any[] }) {  
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(image?.outputImage || null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }
  
    function formatDate(date: Date): string { 
        if(date){
            return date.toLocaleString('zh-CN', 
                                       { year: '2-digit', month: 'long', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'});
        }else{
            return "某年某月某日 08:08";
        }
    }

    async function addRoomToAlbum(room:any, album:any){
        const res = await fetch("/api/albumManager", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cmd:"ADDROOM", id:album.id, roomId:room.id }),
        });
        let response = (await res.json());
        if (res.status !== 200) {
            alert(response as any);
        } else {
            alert(`图片已经被加到相册《${album.name}》`);
        }
    }    

    function printPhoto(image:string){
        if (image) {
            // 创建新窗口或使用 iframe
            let printWindow = window.open('', '_blank', 'height=800,width=1400');
            printWindow?.document.write(`
            <html>
                <head>
                <title>Print</title>
                <style>
                    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                    img { display: block; width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <img src="${image}" alt="Print Image">
            </body>
            </html>
        `);            
            printWindow?.document.close();
            printWindow?.focus();

            // 打印内容和关闭新窗口的延时
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 1000);
        } else {
            console.error('Image not found');
        }
    }


    function showFunction(image:any, tool:any){
        return (
            <button
                data-tooltip-id="room-tooltip"  
                data-tooltip-content={`💡 ${tool.hint || tool.name}`}                
                onClick={() => window.open(`${tool.url}?roomId=${image.id}`, "_blank")} className="button-grid flex items-center gap-2 px-2 py-3">
                <Icon icon={tool.icon} className="w-5 h-5 text-inherit" />
                <span>{tool.midName || tool.name}</span>
            </button>
        );
    }
    
    
    function showImageDetail(image:any){
        return (
          <TopFrame config={config}>
              
              <main>
                  
                  <div className="flex justify-between items-center w-full flex-col sm:mt-2">
                      { originalPhoto && image && !restoredImage && (
                      <div className="flex flex-col-reverse sm:flex-row items-start w-full">
                          
                          <div className="w-full sm:w-32 flex-shrink-0 flex flex-col sm:pr-1 items-center space-y-2">
                              
                              <div className="w-full p-2 rounded-lg">
                                  
                                  <div className="grid w-full grid-flow-row-dense gap-1 items-center grid-cols-3 sm:grid-cols-1 text-gray-200 text-sm" >
                                      <button onClick={() => downloadPhoto(image.outputImage)} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <ArrowDownTrayIcon className="w-5 h-5 text-inherit" /> 下载照片
                                      </button>
                                    
                                      <button onClick={() => printPhoto(image.outputImage)} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <PrinterIcon className="w-5 h-5 text-inherit" /> 打印照片
                                      </button>
                                    
                                      {isAdmin() && (
                                        <button onClick={() => window.open(`/createPromptApp?roomId=${image.id}`, "_blank")} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <BookmarkIcon className="w-5 h-5 text-inherit" /> 保存创意
                                        </button>
                                      )}
                                        
                                        {status == "authenticated" && (                                                                    
                                        <AlbumSelector 
                                            title="加入相册" 
                                            className="button-grid w-full px-2 py-3 text-sm"
                                            onSelect={(album) => {
                                                if(album){
                                                    addRoomToAlbum(image, album);
                                                }
                                            }} 
                                            />        
                                        )}

                                      {fc.imageDetailTools.map((tool) => (
                                          showFunction(image, tool)
                                      ))}
                                    
                                    </div>
                                </div>
    
                                {/* 放在组件最外层 */}
                                <Tooltip 
                                  id="room-tooltip" 
                                  place="right" // 提示位置（top/bottom/left/right）
                                  offset={5} // 与元素的间距
                                  noArrow={false} // 是否显示小箭头
                                  delayShow={100} // 延迟显示（毫秒）
                                  className="!text-sm !px-4 !py-2 !z-[9999] !bg-gray-700 !text-gray-100 !rounded-xl !border !border-white !text-left !break-words !tracking-wider	!max-w-sm"
                                  style={
                                    {
                                      // 设置箭头颜色
                                      '--rt-arrow-background': '#4b5563', // same as bg-gray-700
                                      '--rt-arrow-border': '1px solid white',
                                    } as React.CSSProperties     
                                  }     
                                />   
    
                                <div className="w-full">
                                  {loading && !restoredImage && (
                                  <button disabled  className="button-main px-4 pt-2 pb-3 mt-8 w-1/3">
                                      <span className="pt-4">
                                          <LoadingDots color="white" style="large" />
                                      </span>
                                  </button>
                                  )}
                                  
                                  {error && (
                                  <div
                                      className="bg-red-100 border border-red-400 text-red-700 px-2 py-3 rounded-xl mt-8 max-w-[575px]"
                                      role="alert" >
                                      <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                                          操作错误
                                      </div>
                                      <div className="border border-t-0 border-green-400 rounded-b bg-green-100 px-2 py-3 text-green-700">
                                          {error}
                                      </div>
                                  </div>
                                  )}
                                </div>
                            </div>


                            <div className="flex flex-col-reverse sm:flex-col w-full sm:flex-1 items-center justify-center">
                                <div className="w-full flex flex-row items-center justify-start text-xs sm:text-sm">
                                    <p className="text-gray-200">创作路径</p>
                                    {path.map((node:any) => (
                                        <div className="flex flex-row items-center">
                                            <span className="p-2">{"-"}</span>
                                            <Link className="items-center text-gray-400 underline underline-offset-2"  href={node.href} target={node.href==="#" ? "_self" : "_blank"}>
                                                {`[${node.title}]`}
                                            </Link>              
                                        </div>
                                    ))}
                                </div>
                                <RulerBox className="w-full flex flex-col items-center justify-center">
                                    {image?.userId == user?.id && (
                                    <TaskPannel config={config} user={user} roomId={image?.id} roomDesc={image?.desc} />                                        
                                    )}
                                    <AutoSizeImage src={originalPhoto} initShow={"SCREEN"}/>
                                </RulerBox>                        
                            </div>                            
                            
                        </div>
                        )}
    

                      <RoomAdminPanel user={user} room={image}/>
                        
                    </div>
                </main>
                
            </TopFrame>  
        );
    }


    if(!image){
        return (
            <ErrorPage config={config} pageName="图片详情" errMsg="没有找到指定的照片，或者指定的照片不存在，无法查看！"></ErrorPage>
        );
    }else{
        if(image.access == "PUBLIC" && image.sysScore > 2){
            return showImageDetail(image);
        }else{
            if(status == "authenticated"){
                if((author?.id == user?.id) || isAdmin()){ // 如果登录，并且是所有者或者管理员
                    return showImageDetail(image);
                }else{
                    return (
                        <ErrorPage config={config} pageName="图片详情" errMsg="指定的照片不存在，或者您没有权限，无法查看！"></ErrorPage>
                    );
                }                    
            }else{
                return( <LoginPage config={config}/> );
            }
        }
    }
   
}
