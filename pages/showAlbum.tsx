import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User,Room } from "@prisma/client";

import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import {countAndCut} from "../components/Genhis";
import Genhis from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import FileSelector from "../components/FileSelector";
import Uploader from "../components/Uploader";
import Pagination from '../components/Pagination';
import Image from "../components/wrapper/Image";
import Title from "../components/Title";

import {mimeTypes, getThumbnail, getFileServerOfURL} from "../utils/fileUtils";
import * as debug from "../utils/debug";
import dynamic from 'next/dynamic';
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";
import { config, defaultImage } from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as du from "../utils/deviceUtils";
import * as enums from "../utils/enums";

const ShareButton = dynamic(() => import('../components/ShareButton'), { ssr: false });

const albumRoomsPageCells = 18;
const myRoomsPageCells = 16;


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let albumId = ctx?.query?.albumId;
    let myRoomsPage = parseInt(ctx?.query?.myRoomsPage || "1");
    let albumRoomsPage = parseInt(ctx?.query?.albumRoomsPage || "1");
          
    let myRoomsStart = (myRoomsPage-1) * myRoomsPageCells;
    let albumRoomsStart = (albumRoomsPage-1) * albumRoomsPageCells;

    let myRoomsCount = 0;
    let albumRoomsCount = 0;
  
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let user;
 
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }

    var album:any;
    var albumRooms:any[]=[];
    var myRooms:any[]=[];
    if(albumId){     
        album = await prisma.album.findUnique({
            where: {
              id: albumId, // 只要有ID，相册谁都能看
            },
            include:{
                user: true
            }
        });
    }
    
    if(album){
    
        // Get the IDs of rooms that belong to the album with id 'XXX'
        const roomsInAlbum = await prisma.albumRoom.findMany({
            where: {
                albumId: albumId,
                status: "CREATED"          
            },
            select: {
                roomId: true
            },
            orderBy: [
                { score: 'desc' },
                { createTime: 'desc' }              
            ]
        });
        
        // Extract room IDs from the result
        const roomIdsInAlbum = roomsInAlbum.map(room => room.roomId);
        
        if(user){ // 对于登录用户，可以添加照片到相册
            // Get all rooms of the user 'ABC' that are not in the list of room IDs
            let whereTerm:any = {
                OR: [
                    { userId: user.id }, // 我的图片
                  //  { access: 'PUBLIC' } // 或者公开的图片
                ],
                status: "SUCCESS",
                id: {
                    notIn: roomIdsInAlbum
                },
            };
            myRoomsCount = await prisma.room.count({where:whereTerm});
            myRooms = await prisma.room.findMany({
                where: whereTerm,
                take: myRoomsPageCells,
                skip: myRoomsStart,
                orderBy: [
                    { createdAt: 'desc' }              
                ]
            });
        }

        const isAdmin = user?.actors && user.actors?.indexOf("admin")>=0;
        let whereTerm:any = {
            status: {
                notIn: ['DELETE', 'FAILED', 'DELETED', 'CREATING']
            },
            id: {
                in: roomIdsInAlbum
            }
        };
        if(!isAdmin){
            // userId: user.id, // 相册的图片有可能不是自己的
            whereTerm.OR = [
                { userId: album.userId }, // 相册拥有者的照片
                { access: 'PUBLIC' } // 或者公开的图片
            ];
        }
            
        albumRoomsCount = await prisma.room.count({where:whereTerm});
        let misorderRooms = await prisma.room.findMany({
            where: whereTerm,
            skip: albumRoomsStart,
            take: albumRoomsPageCells,
            orderBy: [
                { sysScore: 'desc' },
                { createdAt: 'desc' }              
            ]
        });

        // 把相册内的图片按照原有顺序排列
        for(const ar of roomsInAlbum){
            for(const r of misorderRooms){
                if(ar.roomId == r.id){
                    albumRooms.push(r);
                    break;
                }
            }
        }
    }
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            myRoomsCount,
            myRooms,
            albumRoomsCount,
            albumRooms,
            album,
            config,
            user,
            defaultImage
        },
    };
  
}    



export default function showAlbum({ user, myRooms, myRoomsCount, albumRoomsCount, albumRooms, album, config, defaultImage }: { user:User, myRooms:any[], myRoomsCount:number, albumRooms:any[], albumRoomsCount:number, album:any, config:any, defaultImage:any }) {
  
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
   
    const router = useRouter();

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [currentMyRoomsPage, setCurrentMyRoomsPage] = useState(router.query.myRoomsPage ? parseInt(router.query.myRoomsPage as string) : 1);
    const [currentAlbumRoomsPage, setCurrentAlbumRoomsPage] = useState(router.query.albumRoomsPage ? parseInt(router.query.albumRoomsPage as string) : 1);
    const [isMyRoomsOpened, setIsMyRoomsOpened] = useState(router.query.myRoomsOpened ? Boolean(router.query.myRoomsOpened as string) : false);
    
    const totalMyRoomsPages = Math.ceil(myRoomsCount / myRoomsPageCells);
    const totalAlbumRoomsPages = Math.ceil(albumRoomsCount / albumRoomsPageCells);

    
    const title = album?.name;
    const icon = getThumbnail(album?.coverImg, 128) || config.logo32;
    const desc = "超能照相馆用户相册";
    const author = album?.user;
    const authorDetail = author?.desc ? JSON.parse(author.desc) : undefined;

    
    async function addImageToAlbum(imageURL:string, mediaType:string, fileName?:string){
        if(mediaType == "IMAGE"){
            const size = await fu.getImageSize(imageURL);
            if(size.width<256 || size.height<256){
                return alert(`上传图片的宽${size.width}像素，高${size.height}。这个尺寸太小，系统无法进行正确的处理。请换一张宽高大于256 X 256像素的图片试试！`);
            }
            const bytes = await fu.getImageBytes(imageURL);
            if(bytes && bytes > 20000000){
                return alert(`照片大小不能超过20M字节，请换一张小一点的照片试试`);
            }
            if(size.width>2000 || size.height>2000){
                imageURL = await fu.resizeImage(imageURL, 2000) || imageURL;                        
            }
        }
        const res = await callAPI("/api/albumManager", { cmd:"ADDIMAGE", imageURL:imageURL, id:album.id, mediaType, 
                                                        func:mediaType=="VOICE"?"createSong":"",
                                                        prompt:fileName?.split('.')[0] || fileName,
                                                       });
        if(res.status != 200){
            alert(JSON.stringify(res.result));
        }else{
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('myRoomsOpened');
            window.location.href = currentUrl.toString();   
        }
    }
    
    async function addRoomToAlbum(roomId:string){
        const res = await callAPI("/api/albumManager", { cmd:"ADDROOM", id:album.id, roomId } );
        if (res.status !== 200) {
            setError(JSON.stringify(res.result));
        } else {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('myRoomsOpened');
            window.location.href = currentUrl.toString();   
        }
    }

    async function removeRoomFromAlbum(roomId:string){
        const res = await fetch("/api/albumManager", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cmd:"REMOVEROOM", id:album.id, roomId }),
        });
        let response = (await res.json());
        if (res.status !== 200) {
            setError(response as any);
        } else {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('myRoomsOpened');
            window.location.href = currentUrl.toString();      
        }
    }    
    
    function showRoom(img:any, type:string ) {
        const isSafe = (user?.id == author?.id || getFileServerOfURL(img.outputImage) != enums.fileServer.BYTESCALE);
        return(
            <div className="group masonry-item border-gray-200 text-center flex-col relative inline-block">
                <div className="relative w-full text-xs">
                    {isSafe ? (
                    <>
                        {img.resultType == "VIDEO" &&  (
                        <Link href={ru.getVideoRest(img.id)} target="_blank">   
                            <video
                                src={img.outputImage}
                                poster={img.inputImage}
                                controls={true}
                                height={512}
                                width={512}
                                />
                        </Link>                        
                        )}
                        {img.resultType == "VOICE" && (
                        <>
                            <Link className="text-white text-left mt-8 mb-10 left-5 text-sm"
                              href={ ru.getAudioRest(img.id) } target="_blank">
                              <span> { img.prompt ? `“${countAndCut(img.prompt,150)}”` : " ... " } </span>
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
                        )}
                        {img.resultType == "IMAGE" && (
                        <Link href={ ru.getImageRest(img.id) } target="_blank">                   
                            <Image
                              alt="AI作品"
                              width={512}
                              height={512}
                              src={ img.outputImage }
                              className=" object-cover w-full"
                              loading="lazy"
                            />
                        </Link>                
                        )}
                    </>
                    ) : (
                    <Image alt="不安全的作品" width={512} height={512} src={defaultImage.roomDeleted} className=" object-cover w-full" loading="lazy"/>
                    )}

                    {type == "ALBUM" && (
                    <button onClick={() => {
                        removeRoomFromAlbum(img.id);
                       }}
                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                        <span className="sr-only">移除</span>
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                        </svg>
                    </button> 
                    )}
                </div>
            </div> 
        );
    }


    async function createPortraitModel(){
        if(albumRoomsCount < 10 || albumRoomsCount > 30){
            alert("相册照片在10到30张之间才可以用来制作写真套系");
            return;
        }
        window.open("/createLoRA?title=写真套系&channel=PORTRAIT&albumId=" + album.id, "_blank");
    }

    async function createFashionModel(){
        if(albumRoomsCount < 10 || albumRoomsCount > 30){
            alert("相册照片在10到30张之间才可以用来创建自己的虚拟模特");
            return;
        }

        window.open("/createLoRA?title=虚拟模特&channel=FASHION&albumId=" + album.id, "_blank");
    }
    

    const isAdmin = user && user.actors && user.actors?.indexOf("admin")>=0;
    
    if((status == "authenticated" || status == "unauthenticated") && album){
        
        return (
            <TopFrame config={config}>
              
                <main>                    
                    <p className="text-center text-sm text-black-300 mt-1">
                        {album.desc}
                    </p> 

                    <div className="w-full grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-6 px-2">                        
                    { albumRooms && albumRooms.map((img) => (
                        showRoom(img, "ALBUM")
                    ))}
                    </div>
                    <Pagination pageCount={totalAlbumRoomsPages} currentPage={currentAlbumRoomsPage} 
                        onPageChange={(newPage) => {
                            setCurrentAlbumRoomsPage(newPage);        
                            setIsMyRoomsOpened(false);                            
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set("albumRoomsPage", newPage.toString());
                            currentUrl.searchParams.delete("myRoomsOpened");
                            window.location.href = currentUrl.toString();     
                        }} 
                        />
                    {(status == "authenticated" && user?.id == author?.id) ? (
                    <div className="flex flex-row items-center justify-center space-x-5 mt-16">
                        {myRooms && (
                        <div>
                            <FileSelector 
                                title="添加我的照片" 
                                files={myRooms} 
                                fileType="IMAGE,VIDEO"
                                pageCount={totalMyRoomsPages}
                                pageSize={myRoomsPageCells}
                                rowSize={8}
                                currentPage={currentMyRoomsPage}
                                isOpened = {isMyRoomsOpened}
                                className="button-main w-full px-4 py-2 "
                                onSelect={(file) => {
                                    if(file){
                                        addRoomToAlbum(file.id);
                                        setIsMyRoomsOpened(false);
                                    }
                                }}
                                onCancel={() => {
                                    setIsMyRoomsOpened(false);
                                }}                            
                                onPageChange={(newPage) => {
                                    setCurrentMyRoomsPage(newPage);        
                                    const currentUrl = new URL(window.location.href);
                                    currentUrl.searchParams.set("myRoomsPage", newPage.toString());
                                    currentUrl.searchParams.set("myRoomsOpened", "true");
                                    window.location.href = currentUrl.toString();                          
                                }}
                                />  
                        </div>                            
                        )}

                        <Uploader 
                            className="button-main text-base px-4 py-2 flex flex-col items-center justify-center" 
                            title="上传本地照片"            
                            setFiles = { (files) => {
                                if (files.length > 0) {
                                    addImageToAlbum(files[0].uploadedUrl, "IMAGE");
                                }else{
                                    alert("上传文件失败!");
                                }
                            }}
                            mime= { mimeTypes.image }
                        />

                        {isAdmin && (
                          <div>
                            <Uploader 
                                className="button-main text-base px-4 py-2 flex flex-col items-center justify-center" 
                                title="上传本地视频"            
                                setFiles = { (files) => {
                                    if (files.length > 0) {
                                        addImageToAlbum(files[0].uploadedUrl, "VIDEO");
                                    }else{
                                        alert("上传文件失败!");
                                    }
                                }}
                                mime= { mimeTypes.video }
                            />
                          </div>
                        )}

                        {isAdmin && (
                          <div>
                            <Uploader 
                                className="button-main text-base px-4 py-2 flex flex-col items-center justify-center" 
                                title="上传本地音频"            
                                setFiles = { (files) => {
                                    if (files.length > 0) {
                                        addImageToAlbum(files[0].uploadedUrl, "VOICE", files[0].originalName);
                                    }else{
                                        alert("上传文件失败!");
                                    }
                                }}
                                mime= { mimeTypes.audio }
                            />
                          </div>
                        )}
                        
                        {!loading && isAdmin && (                
                        <button
                            onClick={() => {
                                createPortraitModel();
                            }}                        
                            className="button-main rounded-full px-4 py-2 "
                            >
                            创建写真套系
                        </button> 
                        )}                        
                        {!loading && (                
                        <button
                            onClick={() => {
                                createFashionModel();
                            }}                        
                            className="button-gold rounded-full px-4 py-2 "
                            >
                            创建虚拟分身
                        </button> 
                        )}                        
                        
                    </div>
                    ) : (
                    <div className="w-full flex flex-col items-center max-w-2xl mt-16 space-y-10">
                        <button 
                            className="hidden button-green-blue px-16 py-3" 
                            onClick={() => { window.open("/modelMarket?func=lora&channel=PORTRAIT&title=挑选写真套系", "_blank") }}
                        >
                            我要拍写真
                        </button>
                    </div>
                    )}
                    
                    {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]" role="alert">
                        <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                            请等一会再尝试。
                        </div>
                        <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                            {error}
                        </div>
                    </div>
                    )}                        

                    {du.isMobile() && authorDetail && (
                    <>
                        <div className="w-fuul max-w-2xl flex flex-col items-center mt-20 mb-20">
                            <ShareButton name="分享相册" title="超能照相馆用户相册" text={album.name} url={"/showAlbum?albumId=" + album.id}
                                className="w-full max-w-2xl px-8 py-2 mx-5 rounded-full " image="/social.jpg"
                                />
                        </div>                             
                        
                        <div className="page-tab w-full py-10 px-2 sm:px-5 max-w-2xl flex flex-col items-center space-y-4 sm:rounded-xl sm:mb-20">
                            <div className="w-full flex flex-row items-start space-x-4 sm:space-x-8">
                                <div className="w-1/2"> 
                                    <Image src={author.image || defaultImage.userCover}
                                        alt="作者" className="w-full h-auto rounded-xl"/>             
                                </div>
                                <div className="w-1/2 flex flex-col items-start space-y-2 text-sm sm:text-base text-left">
                                    <p className="w-full flex flex-row items-start">
                                        <span className="text-gray-200 w-11 sm:w-12">摄影：</span><span className="text-white flex-1 break-all text-wrap">{ author.name }</span>
                                    </p>  
                                    <p className="w-full flex flex-row items-start">
                                        <span className="text-gray-200 w-11 sm:w-12">电话：</span><span className="text-white flex-1 break-all text-wrap">{ authorDetail.contactPhone }</span>
                                    </p>  
                                    <p className="w-full flex flex-row items-start">
                                        <span className="text-gray-200 w-11 sm:w-12">微信：</span><span className="text-white flex-1 break-all text-wrap">{ authorDetail.contactWechat }</span>
                                    </p>  
                                    <p className="w-full flex flex-row items-start">
                                        <span className="text-gray-200 w-11 sm:w-12">QQ：</span><span className="text-white flex-1 break-all text-wrap">{ authorDetail.contactQQ }</span>
                                    </p>
                                    <p className="w-full flex flex-row items-start">
                                        <span className="text-gray-200 w-11 sm:w-12">邮箱：</span><span className="text-white flex-1 break-all text-wrap">{ authorDetail.contactEmail }</span>
                                    </p>                         
                                </div>
                            </div>
                            <div className="w-full flex flex-row items-center justify-between mb-5"> 
                                <p className="text-white text-left">
                                    { authorDetail.selfIntro }
                                </p>  
                            </div>                            
                        </div>

                        <div className="w-full bg-white flex flex-col items-center pt-10 sm:pt-15 pb-20 px-2">                    
                            <span className="w-full text-center text-2xl sm:text-3xl font-display  tracking-wide text-gray-900 mt-10 mb-5 sm:mb-8">
                                关于{config.appName}
                            </span> 
                            <span className="w-full text-center text-base font-display tracking-wide text-gray-500 mt-4 mb-6 sm:mb-10 ">
                                我们是一家基于AI技术的专业写真摄影机构，只需要您的一张照片，就可以拍摄出各种风格套系的高质量写真集。
                                PC电脑网址是：<Link href={config.website}>{config.website}</Link>
                            </span> 
                            <div className="w-full flex flex-col sm:flex-row items-center justify-center space-y-10 sm:space-y-0 sm:space-x-20">
                                <div className="w-2/3 sm:w-1/5 flex flex-col items-center space-y-5">
                                    <span className="w-full text-center text-lg font-display tracking-wide text-gray-500">
                                        手机应用公众号：超能照相馆
                                    </span>       
                                    <div className="w-full bg-white flex flex-col sm:flex-row items-center justify-center mb-5 pb-4">
                                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/op/qrcode_aixiezhen.jpg`} className="w-full h-auto rounded-2xl"/>
                                    </div>
                                </div>
                                
                                <div className="w-2/3 sm:w-1/5 flex flex-col items-center space-y-5">
                                    <span className="w-full text-center text-lg font-display tracking-wide text-gray-500">
                                        加盟热线客服：一帆
                                    </span>       
                                    <div className="w-full bg-white flex flex-col sm:flex-row items-center justify-center mb-5 pb-4">
                                        <Image alt="照片" src={`${config.RS}/aixiezhen/index/op/cs1_weixin.jpg`} className="w-full h-auto rounded-2xl"/>
                                    </div>
                                </div>
                            </div>                        
                        </div>                        
                    </>
                                   
                    )}

                    
                </main>
            </TopFrame>
        );
    }else{
        return (
            <TopFrame config={config}>
                <Title config={config} title={title}/>
                <main>
                    请指定一个相册
                </main>
            </TopFrame>
        );
    }
    
};
