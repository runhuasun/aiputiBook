import Head from "next/head";
import Link from "next/link";
import Footer from "../../components/Footer";
import prisma from "../../lib/prismadb";
import { Room, Prompt, Model, User } from "@prisma/client";
import { RoomGeneration } from "../../components/RoomGenerator";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import LoginPage from "../../components/LoginPage";
import MultiStateImage from '../../components/MultiStateImage';
import * as gh from "../../components/Genhis";

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";

import Image from "../../components/wrapper/Image";
import Header from "../../components/Header";
import { config, defaultImage } from "../../utils/config";
import * as monitor from "../../utils/monitor";
import * as debug from "../../utils/debug";
import {callAPI} from "../../utils/apiUtils";
import {getThumbnail, getFileServerOfURL} from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import * as ru from "../../utils/restUtils";
import * as fu from "../../utils/fileUtils";
import { getFuncLink, getFuncTitle} from "../../utils/funcConf";



export default function userPage({user, viewer, config }: { user:User, viewer:any, config: any  }) {
//  const fetcher = (url: string) => fetch(url).then((res) => res.json());
//  const { data, mutate } = useSWR("/api/remaining", fetcher);
//    const { data: session, status } = useSession();

    const isAdmin = viewer?.actors?.indexOf("admin")>=0;
    
    const [genFilePageCount, setGenFilePageCount] = useState<number>(0);
    const genFilePageSize = 54;
    const genFileRowSize = 9;    
    const [genFileCurrentPage, setGenFileCurrentPage] = useState<number>(1);
    const [genFiles, setGenFiles] = useState<any[]>([]);
    async function gotoGenFilesPage(page:number){
        const res = await callAPI("/api/updateRoom", 
                                  {cmd:"GOTOPAGE", pageSize:genFilePageSize, currentPage:page, type:"ALL", showUserPage:true, userId:user?.id
                                  });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setGenFileCurrentPage(page);
            setGenFilePageCount(res.result.pageCount);
            setGenFiles(res.result.rooms);
        }
    }

    const [userFilePageCount, setUserFilePageCount] = useState<number>(0);
    const userFilePageSize = 54;
    const userFileRowSize = 9;    
    const [userFileCurrentPage, setUserFileCurrentPage] = useState<number>(1);
    const [userFiles, setUserFiles] = useState<any[]>([]);
    async function gotoUserFilesPage(page:number){
        const res = await callAPI("/api/userFileManager", 
                                  {cmd:"GOTOPAGE", pageSize:userFilePageSize, currentPage:page, type:"ALL", userId:user?.id
                                  });
        if (res.status != 200) {
           // alert(JSON.stringify(res.result as any));
        }else{
            setUserFileCurrentPage(page);
            setUserFilePageCount(res.result.pageCount);
            setUserFiles(res.result.userFiles);
        }
    }

    useEffect(() => {
        gotoGenFilesPage(1);
        gotoUserFilesPage(1);
    }, [user]);    
    
    
    if(user){
        return (
            <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>{ config.appName }</title>
                    {user && user?.name && user?.image && (
                <>
                    <meta property="og:description" content={"来" + config.appName + "看看我创作的作品吧"} />
                    <meta property="og:title" content={user?.name+"的作品集"} />
                    <meta property="og:image" content={user?.image} />    
                    <meta name="description" content={"来" + config.appName + "看看我创作的作品吧"} />  
                </>
                )}
                </Head>
                
                <Header config={config}/>
                <main>
                    <h1 className="title-main">
                        <Link className="text-center items-center justify-center flex " href={isAdmin ? `/profile?userId=${user.id}` : "#"}>
                            <Image
                                alt="作者"
                                src={user.image || `${defaultImage.userCover}/sd_logo.jpg`}
                                className="w-8 h-8 rounded-full pr-1 "
                                width={20}
                                height={20}
                                />  
                            <span className="title-light pr-1 ">{user.name}</span>的作品集
                        </Link>
                    </h1>      
           
                    <div id="myPhotosSeg" className="text-left items-center w-full sm:pt-2 pt-4 mt-5 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                        <div className="flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center w-full space-x-2">
                            <div className="flex flex-row items-left text-2xl">
                                <p className="text-gray-200 text-1xl">
                                    {user?.name}最近制作的照片：
                                </p>
                            </div>
                            
                            <div className="grid grid-flow-row-dense grid-cols-3 gap-3 sm:grid-cols-9">
                                {genFiles && genFiles.map((img) => (
                                    showRoom(img, viewer?.id)  
                                   // <Image src={img.outputImage} alt="pic" className=" object-cover w-full rounded-xl" loading="lazy"/>
                                ))} 
                            </div>
                        </div>
                    </div>        

                    {userFiles && userFiles.length>0 && (
                    <div id="myUserFileSeg" className="text-left items-center w-full sm:pt-2 pt-4 mt-5 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                        <div className="flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center w-full space-x-2">
                            <div className="flex flex-row items-left text-2xl">
                                <p className="text-gray-200 text-1xl">
                                    {user?.name}最近上传的照片：
                                </p>
                            </div>
                            
                            <div className="grid grid-flow-row-dense grid-cols-3 gap-3 sm:grid-cols-9">
                                {userFiles && userFiles.map((img) => (
                                    showUserFile(img, viewer?.id)  
                                   // <Image src={img.outputImage} alt="pic" className=" object-cover w-full rounded-xl" loading="lazy"/>
                                ))} 
                            </div>
                        </div>
                    </div>       
                    )}

                  {/*
                    { myModels && myModels.length > 0 && (
                    <div id="myModelsSeg" className="text-left items-center w-full sm:pt-2 pt-4 mt-5 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                        <div className="flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center w-full space-x-2">
                            <div className="flex flex-row items-left text-2xl">
                                <p className="text-gray-200 text-1xl">
                                    {user?.name}最近训练的小模型：
                                </p>
                            </div>
                
                            <div className="grid grid-flow-row-dense grid-cols-3 gap-3 sm:grid-cols-9">
                                {myModels && myModels.map((m) => (
                                <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left">
                                    <Link href={m.status == "FINISH" ? ("/lora?model="+m.code+"&price="+m.price) : "#" }>
                                        <Image
                                            alt="AI设计图"
                                            width={512}
                                            height={512}
                                            src={ (m.coverImg == null || m.coverImg.trim()=="") ?
                                                ( (m.status=="FINISH") ? defaultImage.modelComplete : 
                                                 ( m.status=="ERROR" ? defaultImage.modelFailed : defaultImage.modelRunning
                                                 ) 
                                                ) : m.coverImg}
                                            className="sm:mt-0 mt-2"
                                            />
                                    </Link>
                                </div>      
                                ))}
                            </div>
                        </div>
                    </div>
                    )}
    
    
                    { myPrompts && myPrompts.length > 0 && (
                    <div id="myPromptsSeg" className="text-left items-center w-full sm:pt-2 pt-4 mt-5 flex sm:flex-row px-3 space-y-3 sm:mb-0 mb-3 border-gray-500">
                        <div className="flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center w-full space-x-2">
                            <div className="flex flex-row items-left text-2xl">
                                <p className="text-gray-200 text-1xl">
                                    {user?.name}最近制作的提示词：
                                </p>
                            </div>
                            
                            <div className="grid grid-flow-row-dense grid-cols-3 gap-3 sm:grid-cols-9">
                                {myPrompts && myPrompts.map((m) => (
                                <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left">
                                    <Link href={m.status == "FINISH" ? ("/runPromptApp?prompt="+m.code+"&price="+m.price) : "#" }>
                                        <Image
                                            alt="AI提示词应用"
                                            width={512}
                                            height={512}
                                            src={ m.coverImg ||  defaultImage.promptCover }
                                            className="sm:mt-0 mt-2"
                                            />
                                    </Link>
                                </div>      
                                ))}
                            </div>
                        </div>
                    </div>        
                    )}
                    */}
                  
                </main>
                <Footer />
            </div>
        );
    }else{
        return (<></>);
    }
}




export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let isAdmin = false;
    let viewer:any;
    let user:any;
    
    if (session && session.user  && session.user.email) {
        viewer = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                name: true,
                email: true,
                actors: true
            }
        }); 
        if(viewer?.actors){
            isAdmin = viewer.actors.indexOf("admin") >= 0;
        }
    }
    
    let userName = "";
    const userId = ctx.query.userId;
    if (userId) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
    }
     
    monitor.logUserRequest(ctx, session, viewer);
    
    return {
        props: {
            user,
            viewer,
            config,
        },
    };
}

const thumbSize = 256;

function showUserFile(m:any, userId:string){
    return (
        <div className="masonry-item border-gray-200 bg-gray-100 text-left relative inline-block">
            { m.status != "DELETED" &&  m.url && m.url.endsWith(".mp4") ? (
            <video className=" rounded-xl" src={m.url} controls={true} width={thumbSize} onClick={()=>(window.open(m.url, "_blank"))}/>               
            ) : m.url && m.url.endsWith(".mp4") && (m.status == "DELETED" || getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE) ? (
            <Image alt="用户上传的图片" width={thumbSize} 
                src={ defaultImage.roomDeleted } 
                className="sm:mt-0 mt-2 w-full" 
                onClick={()=>(window.open(m.url, "_blank"))}
                />
            ) : m.status != "DELETED" && m.url && m.url.endsWith(".mp3") ? (
            <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                <audio id="audioPlayer" controls className="w-full pt-2 ">
                    <source src={m.url} type="audio/mpeg" />
                </audio>                
                <div className="mt-10">
                    &nbsp;
                </div>          
            </div>
            ): (
            <MultiStateImage  
                image={ (m.status=="DELETED" || (m.status!="DELETED" && getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE) ) ? defaultImage.roomDeleted : getThumbnail(m.url, thumbSize) } 
                className="sm:mt-0 mt-2 w-full"
                mouseDownImage={getThumbnail(m.url, thumbSize)}
                onDoubleClick={()=> {window.open(`/showImage?imageURL=${m.url}`, "_blank")}}
                />
            )}
            
            {m.status != "DELETED" && (
            <button onClick={() => {
                deleteUserFile(m);
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

            {m.status != "DELETED" && getFileServerOfURL(m.url) == enums.fileServer.BYTESCALE && (
            <button onClick={() => {
            }}
              className="absolute top-0 right-0 z-10 w-16 h-16 flex items-center justify-center text-red-500">
              <span className="bg-red-500 text-white px-2 py-2 text-base">{ "OOC"}</span>
            </button>
            )}                

            
            <div className="flex flex-row absolute bottom-0 right-0 z-10 items-center justify-center">
                <button onClick={() => {
                    deleteUserFile(m, "PHYSICAL_DELETE");
                }}
                    className="button-main">
                    删除
                </button>  
                {  m.url.indexOf("upcdn.io")<0 && (
                <button onClick={() => {
                    moveUserFile(m);
                }}
                    className="button-main">
                    移走
                </button>  
                )}
            </div>
           
        </div>  
    );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async function moveUserFile(file:any){
        const res = await callAPI("/api/userFileManager", { id:file?.id, cmd:"BACKUP_TO_US"});
        if (res.status !== 200) {
            alert(res.result as any);
        } else {
            file.url = defaultImage.roomDeleted;
        }
    }
    
    async function deleteUserFile(file:any, cmd:string="DELETE"){
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
        const res = await callAPI("/api/userFileManager", { id:file?.id, cmd, backup});
        if (res.status !== 200) {
            alert(res.result as any);
        } else {
            file.url = defaultImage.roomDeleted;
            file.status = "DELETE";
        }
    }



    function showRoom(img:any, userId?:string, option?:string) {        
        return(
            <div className="group masonry-item border-gray-200 text-center flex-col relative inline-block">
                <div className="relative w-full text-xs">
                    {img.status!="FAILED" && img.outputImage && img.resultType=="VIDEO" ? (
                    <>
                        {img.status == "SUCCESS" ? (
                        <Link href={ "/videoDetail?roomId="+img.id } target="_blank">
                            <video className="rounded-xl" src={img.outputImage} controls={true} width={thumbSize}
                                poster={getFileServerOfURL(img.outputImage) == enums.fileServer.BYTESCALE ? defaultImage.roomDeleted : img.inputImage} />
                        </Link>
                        ) : (img.status == "DELETE") ? (
                        <Link href={ "/videoDetail?roomId="+img.id } target="_blank">
                            <Image alt="AI作品" width={thumbSize} src={defaultImage.roomDeleted} className=" object-cover w-full rounded-xl" loading="lazy"/>
                        </Link>
                        ) : (
                        <Link href={ "/videoDetail?roomId="+img.id } target="_blank">
                            <Image alt="AI作品" width={thumbSize} src={defaultImage.roomCreating} className=" object-cover w-full rounded-xl" loading="lazy"/>                  
                        </Link>
                        )}
                    </>
                    ): (img.status!="FAILED" && img.outputImage && (img.resultType=="VOICE")) ? (
                    <div className="justify-between bg-gray-800 justify-top flex flex-col  rounded-xl">
                        {img.status == "SUCCESS" ? (
                        <>
                            <Link className="text-white text-left mt-8 mb-10 left-5 text-sm"
                                href={"/createVoice?roomId=" + img.id} >
                                <span> { img.prompt ? `“${gh.countAndCut(img.prompt,200)}”` : " ... " } </span>
                            </Link>
                            <audio id="audioPlayer" controls className="w-full pt-2 ">
                                <source src={img.outputImage} type="audio/mpeg" />
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
                    <button onClick={() => {deleteRoom(img)}}
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
                                removeRoom(img);
                            }}
                            >
                            移走
                        </button>                               
                        )}
                        <button className="w-12 h-5 button-dark text-xs px-2  rounded-none"
                            onClick={() => {
                                physicalDeleteRoom(img);
                            }}
                            >
                            彻删
                        </button>                                  
                    </div>
                </div>
            </div>     
        );
    }

    async function deleteRoom(room:any){
        const res = await callAPI("/api/updateRoom", {cmd:"DELETE", id:room?.id});
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            room.outputImage = defaultImage.roomDeleted;
            room.status = "DELETE";
        }          
    }

    async function removeRoom(room: any){
        const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"BACKUP_TO_US" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            room.outputImage = defaultImage.roomDeleted;
        }   
    }

    async function physicalDeleteRoom(room: any){
        const confirmed = await confirm("提醒：这是物理删除，一旦执行操作，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
        if(confirmed){
            const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"PHYSICAL_DELETE" });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                room.outputImage = defaultImage.roomDeleted;
                room.status = "DELETE";
            }   
        }
    }    
