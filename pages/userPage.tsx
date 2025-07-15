import Head from "next/head";
import Link from "next/link";
import Footer from "../components/Footer";
import prisma from "../lib/prismadb";
import { Room, Prompt, Model, User } from "@prisma/client";
import { RoomGeneration } from "../components/RoomGenerator";
import { showRoom } from "../components/Genhis";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import LoginPage from "../components/LoginPage";
import Image from "../components/wrapper/Image";

import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import Header from "../components/Header";
import { config, defaultImage } from "../utils/config";
import * as monitor from "../utils/monitor";
import * as debug from "../utils/debug";
import {callAPI} from "../utils/apiUtils";

export default function userPage({user, viewer, config }: { user:User, viewer:any, config: any  }) {
//  const fetcher = (url: string) => fetch(url).then((res) => res.json());
//  const { data, mutate } = useSWR("/api/remaining", fetcher);
//    const { data: session, status } = useSession();
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
    useEffect(() => {
        gotoGenFilesPage(1);
    }, [user]); 

    const isAdmin = viewer?.actors?.indexOf("admin")>=0;

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
