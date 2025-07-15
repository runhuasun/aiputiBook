import { useState, useRef } from "react";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User,Room, Model } from "@prisma/client";
import { Rings } from "react-loader-spinner";

import * as monitor from "../utils/monitor";
import { callAPI } from "../utils/apiUtils";
import downloadPhoto from "../utils/fileUtils";
import * as fu from "../utils/fileUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import Video from "../components/wrapper/Video";
import LoginPage from "../components/LoginPage";
import AlbumSelector from "../components/AlbumSelector";
import RoomAdminPanel from "../components/RoomAdminPanel";
import ErrorPage from "../components/ErrorPage";


export async function getServerSideProps(ctx: any) {
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
  
    let image;
    let author;
    
    if(roomId){
        image = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });

        if(image){
            author = await prisma.user.findUnique({
                where: {
                    id: image.userId,
                },
            });

            // 更新阅读次数+1
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
    }

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            image,
            author,
            user,
            config
        }
    };
}  


export default function videoDetail({ image, author, user, config }: { image : Room, author: User, user: User, config:any }) {

    const [originalPhoto, setOriginalPhoto] = useState<string | null>(image?.outputImage);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>("合成视频");
    const [videoPoster, setVideoPoster] = useState(image?.inputImage||"");
    const [currentTime, setCurrentTime] = useState(0);
    
    const videoRef = useRef<HTMLVideoElement>(null);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    let zoomInPrice = 10;
    const router = useRouter();
  
    async function addRoomToAlbum(room:any, album:any){
        const res = await callAPI("/api/albumManager", {cmd:"ADDROOM", id:album.id, roomId:room.id});
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            alert(`视频已经被加到相册《${album.name}》`);
        }
    }    

    async function physicalDelete(room: Room){
        const confirmed = await confirm("提醒：一旦删除，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
        if(confirmed){
            const res = await callAPI("/api/updateRoom", { id:room.id, cmd:"PHYSICAL_DELETE" });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                window.location.href=`/videoDetail?roomId=${image.id}`;
            }   
        }
    }  

    async function setCover(newCover:string){
        if(image && newCover){
            const res = await callAPI("/api/updateRoom", { id:image.id, cmd:"SET_INPUTIMAGE", inputImage:newCover });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                setVideoPoster(newCover);
                alert("视频的封面已经被设置为当前帧！");
                window.location.href=`/videoDetail?roomId=${image.id}`;
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

    
    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }

    const handleTimeUpdate = (e:any) => {
        const time = e.target.currentTime;
        setCurrentTime(time);
    };    

    if(status != "authenticated"){
        return( <LoginPage config={config}/> );
    }

    if( image && status == "authenticated" && (image.access == "PUBLIC" || ( (image.access == "PRIVATE") && (author.id == user.id) ) || isAdmin()) ){
        
        return (
            <TopFrame config={config}>
                <main>
                    <div className="flex justify-between items-center w-full flex-col mt-4">
                        <div className={`${restoredLoaded ? "visible mt-6 -ml-8" : "invisible"}`}> 
                        </div>              
                       {loading ? (
                        <div className="flex justify-center items-center">
                          <Rings
                            height="100"
                            width="100"
                            color="white"
                            radius="6"
                            wrapperStyle={{}}
                            wrapperClass=""
                            visible={true}
                            ariaLabel="rings-loading"
                          />
                        </div>
                        ) : originalPhoto && !restoredImage && image && (
                        <Video
                            ref={videoRef}                            
                            src={image.outputImage}
                            poster={videoPoster}
                            controls={true}
                            onPause={handleTimeUpdate}
                            onTimeUpdate={handleTimeUpdate}                        
                        />
                      )}
                        {/*
                        <div className="w-full max-w-lg space-y-3">
                            <FormLabel label="上传视频封面"/>
                            <ComboSelector onSelect={(newFile) => {
                                setVideoPoster(newFile);
                                setCover(newFile);
                            }} /> 
                        </div>
                        */}
                        
                        <div className="w-full flex flex-row items-center justify-center space-x-2 mt-8">
                            <button onClick={()=>{downloadPhoto(image.outputImage!)}} className="px-2 sm:px-8 py-2 button-main">
                                下载视频
                            </button>     

                            <button onClick={()=>{
                                const newCover = fu.getVideoPoster(image.outputImage, Math.trunc(currentTime*1000));
                                if(newCover){
                                    setVideoPoster(newCover);
                                    setCover(newCover);
                                }
                            }} className="px-2 sm:px-8 py-2 button-main">
                                设置封面
                            </button>                               
                          
                          {/*
                            <a href={image.outputImage} download={Date.now().toString()+".mp4"}>
                              <button className="px-2 sm:px-8 py-2 button-main">                          
                                  下载视频
                              </button>
                            </a>                      
                          */}
                            <button onClick={()=>{window.open(`/video2Cartoon?roomId=${image.id}&fileType=video`, "_blank")}} className="px-2 sm:px-8 py-2 button-main">
                                视频转动画
                            </button>
                            <button onClick={()=>{window.open(`/faceswapVideo?videoId=${image.id}&fileType=video`, "_blank")}} className="px-2 sm:px-8 py-2 button-main">
                                视频换脸
                            </button>    
    
                            {status == "authenticated" && (                            
                            
                            <AlbumSelector 
                                title="加入相册" 
                                className="button-main px-2 sm:px-8 py-2 text-base"
                                onSelect={(album) => {
                                    if(album){
                                        addRoomToAlbum(image, album);
                                    }
                                }} 
                                />        
                            )}
                          
                        </div>  
    
                        <RoomAdminPanel user={user} room={image}/>
                        {isAdmin() && (
                        <p className="w-full">
                            {JSON.stringify(image)}
                        </p>
                        )}
                    </div>              
                </main>
            </TopFrame>
        );
    }else{
        return (
            <ErrorPage config={config} pageName="视频详情" errMsg="因为没有指定视频，没有查看视频权限，或者指定的视频不存在，所以无法查看视频！"></ErrorPage>
        )
    }        
};

//export default Home;

