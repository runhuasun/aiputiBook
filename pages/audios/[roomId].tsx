import { useState, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import { useRouter } from "next/router";
import prisma from "../../lib/prismadb";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { Room, User } from "@prisma/client";

import TopFrame from "../../components/TopFrame";
import LoginPage from "../../components/LoginPage";
import ErrorPage from "../../components/ErrorPage";
import AlbumSelector from "../../components/AlbumSelector";
import TaskPannel from "../../components/TaskPannel";
import RoomAdminPanel from "../../components/RoomAdminPanel";
import {
  MusicalNoteIcon,
  MicrophoneIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";

import { config } from "../../utils/config";
import * as monitor from "../../utils/monitor";
import downloadPhoto from "../../utils/fileUtils";



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
        let audio = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
            include:{
                user: true
            }
        });
  
        let author = audio?.user;
        
        // 更新阅读次数+1
        if(audio){
            await prisma.room.update({
                where: {
                    id: audio.id,
                },
                data: {
                    viewTimes: {
                        increment: 1,
                    },
                },
            }); 
        }

        return {
            props: {
                audio,
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




export default function showVideo({ audio, author, user, config, albums }: { audio : Room, author: User, user: User, config: any, albums:any[] }) {  
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(audio?.outputImage || null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    const audioRef = useRef<HTMLVideoElement>(null);
    
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
    
    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }

    const segments:string[] = audio?.prompt ? audio.prompt.split("\n") : [];

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
    
    if(status != "authenticated"){
        return( <LoginPage config={config}/> );
    }

    if( audio && status == "authenticated" && (audio.access == "PUBLIC" || ( (audio.access == "PRIVATE") && (author.id == user.id) ) || isAdmin()) ){
        return (
            
            <TopFrame config={config}>
          
                <main>
                  
                    <div className="flex justify-between items-center w-full flex-col mt-2">
                        { originalPhoto && audio && !restoredImage && (
                      
                        <div className="flex flex-col-reverse sm:flex-row items-start w-full">

                            <div className="w-full space-y-2 sm:w-1/3 sm:max-w-36 flex flex-col sm:pr-2 items-center">

                                <div className="w-full p-2 rounded-lg">
                                    <div className="grid w-full grid-flow-row-dense gap-1 items-center grid-cols-3 sm:grid-cols-1 text-gray-200 text-sm" >
                                        
                                        <button onClick={()=>{ window.open(`/videoMixAudio?roomId=${audio.id}`, "_blank") }} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <MusicalNoteIcon className="w-5 h-5 text-inherit" />
                                          视频配乐
                                        </button>
                                        
                                        <button onClick={()=>{ window.open(`/videoRetalk?roomId=${audio.id}`, "_blank") }} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <MicrophoneIcon className="w-5 h-5 text-inherit" />
                                          人物配音
                                        </button>
                                        
                                        <button onClick={()=>{ window.open(`/sadTalker?roomId=${audio.id}`, "_blank") }} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-inherit" />
                                          照片说话
                                        </button>
                                        
                                        <button onClick={()=>{downloadPhoto(audio.outputImage!)}} className="button-grid flex items-center gap-2 px-2 py-3">
                                          <ArrowDownTrayIcon className="w-5 h-5 text-inherit" />
                                          下载音频
                                        </button>
                                        
                                    </div>

                                    {status == "authenticated" && (                                                                    
                                    <AlbumSelector 
                                        title="加入相册" 
                                        className="button-grid flex items-center gap-2 px-2 py-3 text-sm"
                                        onSelect={(album) => {
                                            if(album){
                                                addRoomToAlbum(audio, album);
                                            }
                                        }} 
                                        />        
                                    )}                                  
                                </div>
    
                            </div>

                            <div className="flex flex-col space-y-5 min-h-96 py-10 flex-1 items-center justify-center border border-1 border-gray-300 border-dashed">
                                {audio?.userId == user.id && (
                                <TaskPannel config={config} user={user} roomId={audio?.id} roomDesc={audio?.desc} />                                        
                                )}
                                <div className={ "w-2/3 grid grid-flow-row-dense gap-1 items-center grid-cols-1"} >
                                    {segments && segments.map((seg) => (
                                    <p className="w-full text-base text-gray-200 text-center">{seg}</p>
                                    ))}
                                </div>                                
                                <audio ref={audioRef} id="audioPlayer" controls className="w-2/3 pt-2"
                                    onLoadedMetadata={(e) => {}}    
                                    >
                                    <source src={audio.outputImage} type="audio/mpeg"/>
                                    <source src={audio.outputImage} type="audio/wav"/>
                                    <source src={audio.outputImage} type="audio/ogg"/>
                                </audio>                              
                            </div>  
                            
                        </div>
                        )}
    

                      
                        <RoomAdminPanel user={user} room={audio}/>
                        
                    </div>
                </main>
          
            </TopFrame>  
        
        
        );
    }else{
        return (
            <ErrorPage config={config} pageName="音频内容" errMsg="因为没有指定的音频，用户没有授权，或者指定的音频不存在，无法查看音频！"></ErrorPage>
        );
    }        
}
