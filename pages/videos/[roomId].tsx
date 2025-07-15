import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { Album, User,Room, Model } from "@prisma/client";

import TopFrame from "../../components/TopFrame";
import TaskPannel from "../../components/TaskPannel";
import AlbumSelector from "../../components/AlbumSelector";
import RoomAdminPanel from "../../components/RoomAdminPanel";
import RulerBox from "../../components/RulerBox";
import ErrorPage from "../../components/ErrorPage";
import LoginPage from "../../components/LoginPage";
import Image from "../../components/wrapper/Image";

import { CameraIcon,
         FaceSmileIcon,
         MicrophoneIcon,
         MusicalNoteIcon,
         SparklesIcon,
         MagnifyingGlassPlusIcon,
         FilmIcon,
         ScissorsIcon,
         PhotoIcon,
         ArrowDownTrayIcon,
         RectangleStackIcon } from "@heroicons/react/24/solid";

import { Rings } from "react-loader-spinner";

import { authOptions } from "../api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";

import * as rmu from "../../utils/roomUtils";
import * as monitor from "../../utils/monitor";
import { callAPI } from "../../utils/apiUtils";
import downloadPhoto from "../../utils/fileUtils";
import * as ru from "../../utils/restUtils";
import { config } from "../../utils/config";





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
        let video = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
            include:{
                user: true
            }
        });
  
        let author = video?.user;
        
        // 更新阅读次数+1
        if(video){
            await prisma.room.update({
                where: {
                    id: video.id,
                },
                data: {
                    viewTimes: {
                        increment: 1,
                    },
                },
            }); 
        }

        const path:any[] = await rmu.getPathNodes(video, user);
       
        return {
            props: {
                path,
                video,
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





export default function showVideo({ video, path, author, user, config, albums }: { video : Room, path:any[], author: User, user: User, config: any, albums:any[] }) {  
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(video?.outputImage || null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    const [videoPoster, setVideoPoster] = useState(video?.inputImage||"");
    const [currentTime, setCurrentTime] = useState(0);    
    const videoRef = useRef<HTMLVideoElement>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
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

    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }

    const handleTimeUpdate = (e:any) => {
        const time = e.target.currentTime;
        setCurrentTime(time);
    };    
    
    async function setCover(newCover:string){
        if(video && newCover){
            const res = await callAPI("/api/updateRoom", { id:video.id, cmd:"SET_INPUTIMAGE", inputImage:newCover });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                setVideoPoster(newCover);
                alert("视频的封面已经被设置为当前帧！");
                window.location.href=ru.getVideoRest(video.id);
              /*  const video = videoRef.current;
                if (video) {
                    video.currentTime = 0; // 设置视频为起始位置
                    video.pause(); // 暂停视频播放
                    alert("视频的封面已经被设置为当前的画面！");
                }
                */                
            }   
        }
    }   

    async function setPoster(){
        if(video){
            const res = await callAPI("/api/updateRoom", { id:video.id, cmd:"SET_POSTER", currentTime });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                setVideoPoster(res.result?.poster);
                alert("视频的封面已经被设置为当前帧！");
            }   
        }
    }   


    
    function showVideoDetail(video:any){
        return (
            
            <TopFrame config={config}>

                <main>
                  
                    <div className="flex justify-between items-center w-full flex-col mt-2">
                        { originalPhoto && video && !restoredImage && (
                      
                        <div className="flex flex-col-reverse sm:flex-row items-start w-full">
                            
                            <div className="w-full sm:w-auto space-y-2 sm:max-w-36 flex flex-col sm:pr-2 items-center">
                                <div className="w-full p-2 rounded-lg">
 
                                    <div className="grid w-full grid-flow-row-dense gap-1 items-center grid-cols-3 sm:grid-cols-1 text-gray-200 text-sm">
                                    
                                      <button onClick={() => window.open(`/createVideo?videoURL=${video.outputImage}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <CameraIcon className="w-5 h-5 text-inherit" /> 视频续拍
                                      </button>
                                    
                                      <button onClick={() => window.open(`/faceswapVideo?videoId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <FaceSmileIcon className="w-5 h-5 text-inherit" /> 视频换脸
                                      </button>
                                    
                                      <button onClick={() => window.open(`/videoRetalk?roomId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <MicrophoneIcon className="w-5 h-5 text-inherit" /> 人物配音
                                      </button>
                                    
                                      <button onClick={() => window.open(`/videoMixAudio?roomId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <MusicalNoteIcon className="w-5 h-5 text-inherit" /> 视频配乐
                                      </button>
                                    
                                      <button onClick={() => window.open(`/videoMixAIAudio?roomId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <SparklesIcon className="w-5 h-5 text-inherit" /> 智能音效
                                      </button>
                                    
                                      <button onClick={() => window.open(`/zoomInVideo?roomId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <MagnifyingGlassPlusIcon className="w-5 h-5 text-inherit" /> 高清放大
                                      </button>
                                    
                                      <button onClick={() => window.open(`/video2cartoon?roomId=${video.id}&fileType=video`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <FilmIcon className="w-5 h-5 text-inherit" /> 转成动画
                                      </button>
                                    
                                      <button onClick={() => window.open(`/videoConcat?roomId=${video.id}&fileType=video`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <ScissorsIcon className="w-5 h-5 text-inherit" /> 裁剪拼接
                                      </button>
                                    
                                      <button onClick={() => window.open(`/videoMatting?roomId=${video.id}`, "_blank")} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <PhotoIcon className="w-5 h-5 text-inherit" /> 视频绿幕
                                      </button>
                                    
                                      {(author?.id === user?.id || isAdmin()) && (
                                        <button onClick={() => setPoster()} className="button-grid flex items-center gap-2 px-4 py-3">
                                          <RectangleStackIcon className="w-5 h-5 text-inherit" /> 设置封面
                                        </button>
                                      )}
                                    
                                      <button onClick={() => downloadPhoto(video.outputImage!)} className="button-grid flex items-center gap-2 px-4 py-3">
                                        <ArrowDownTrayIcon className="w-5 h-5 text-inherit" /> 下载视频
                                      </button>
                                    
                                      {status === "authenticated" && (
                                        <AlbumSelector
                                          title="加入相册"
                                          className="button-grid w-full px-4 py-3 text-sm"
                                          onSelect={(album) => album && addRoomToAlbum(video, album)}
                                        />
                                      )}
                                    </div>
                                    
                                
                                </div>
    
                            </div>

                            <div className="flex flex-col-reverse sm:flex-col w-full sm:flex-1 items-center justify-center">
                                <div className="w-full flex flex-row items-center justify-start text-xs sm:text-sm">
                                    <p className="text-gray-200 tracking-widest ">创作路径</p>
                                    {path.map((node:any) => (
                                        <div className="flex flex-row items-center">
                                            <span className="p-2">{"-"}</span>
                                            <span className="pr-1">[</span>
                                            <Link className="items-center text-gray-400 tracking-wider underline underline-offset-2"  href={node.href} target="_blank">
                                                {`${node.title}`}
                                            </Link>              
                                            <span className="pl-1">]</span>                                            
                                        </div>
                                    ))}
                                </div>
                                <RulerBox className="w-full flex flex-col items-center justify-center">
                                    {video?.userId == user?.id && (
                                    <TaskPannel config={config} user={user} roomId={video?.id} roomDesc={video?.desc} />                                        
                                    )}
                                  
                                  <video 
                                      ref={videoRef}                                                              
                                      controls={true} 
                                      className={`object-cover w-auto max-h-screen`}
                                      src={originalPhoto} 
                                      poster={videoPoster}
                                      onPause={handleTimeUpdate}
                                      onTimeUpdate={handleTimeUpdate}                                  
                                    />                               
                                </RulerBox>    
                            </div>                            
        
                        </div>
                        )}
    
    
                        <RoomAdminPanel user={user} room={video}/>
                    </div>
                </main>
                
            </TopFrame>  
        
        );
    }
    
    if(!video){
        return (
            <ErrorPage config={config} pageName="图片详情" errMsg="没有找到指定的视频，或者指定的视频不存在，无法查看！"></ErrorPage>
        );
    }else{
        if(video.access == "PUBLIC" && video.sysScore > 2){
            return showVideoDetail(video);
        }else{
            if(status == "authenticated"){
                if((author?.id == user?.id) || isAdmin()){ // 如果登录，并且是所有者或者管理员
                    return showVideoDetail(video);
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
