import React from "react";
import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Model } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import Image from "../components/wrapper/Image";
import Video from "../components/wrapper/Video";

import { videoTools, audioTools } from "../utils/funcConf";
import * as mt from "../utils/modelTypes";
import * as fu from "../utils/fileUtils";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    return {
        props:{ 
            config
        }
    };    
}

export function showVideoTool(tool:any, config:any, highLight?:boolean){
    return (
        <Link className={"page-tab group relative rounded-2xl flex flex-col space-y-5 px-1 sm:px-2 pb-1 sm:pb-2 sm:mt-4 items-center border-2  " + (highLight ? " border-slate-400 " : " border-transparent hover:border-slate-400 ")} href={tool.url}  target="_blank">
            <span className={(tool.isNew ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>New!</span>                                                        
            <span className={(highLight ? "button-green-blue" : "") + " flex group-hover:hidden max-w-fit items-center text-button text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                {tool.name}
            </span>
            <span className={" hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                {tool.name}
            </span>
            <div className="flex space-x-2 flex-row ">
                <div className="sm:mt-0 mt-1">
                    { tool.demos[0].indexOf("mp4")>0 ? (
                    <Video className="rounded-xl" src={`${config.RS}/demo/${tool.demos[0]}`} controls={true} width={512} height={512} preload="none"
                    poster={fu.getVideoPoster(`${config.RS}/demo/${tool.demos[0]}`, 1)} />
                    ):(
                    <Image alt="Generated" width={512} height={512}
                      src= { `${config.RS}/demo/${tool.demos[0]}` }
                      className="object-cover rounded-xl"
                    />
                    )}
                </div>
                <div className="sm:mt-0 mt-1">
                    { tool.demos[1].indexOf("mp4")>0 ? (
                    <Video className="rounded-xl" src={`${config.RS}/demo/${tool.demos[1]}`} controls={true} width={512} height={512} preload="none"
                    poster={fu.getVideoPoster(`${config.RS}/demo/${tool.demos[1]}`, 1)} />
                    ):(
                    <Image alt="Generated" width={512} height={512}
                      src= { `${config.RS}/demo/${tool.demos[1]}` }
                      className="object-cover rounded-xl"
                    />
                    )}
                </div>
            </div>
        </Link>
    );
}

function showVideoModels(videoModels:any[]){
    return (
        <div className="w-full bg-gray-900 flex flex-col items-center pb-10">                    
            <span className="w-full text-center text-xl sm:text-3xl font-display tracking-wide text-gray-100 mt-10 mb-0">
                热门视频生成模型
            </span> 
            <div className="flex w-full">
                <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">
                    {videoModels
                        .filter(m => m.show===true)  // 仅保留 m.show 为 true 的元素                        
                        .map((m) => (
                        <Link id={`cp_${m.code}`}  key={m.code} href={`/createVideo?sysType=PRO&model=${m.code}`}  target="_blank" className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                            <span className={"hidden absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              

                            <span className={"text-button flex group-hover:hidden max-w-fit items-center text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                {`${m.name}`}
                            </span>   
                            <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                {`${m.name}`}
                            </span>                                   
                            <div className="sm:mt-0 mt-1 w-full">
                                <video src={`${config.RS}/demo/model/${m.code}.mp4`} loop autoPlay muted preload="auto" className="w-full object-cover rounded-lg"/>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>    
    );
}
export default function videoToolsPage({ config }: { config:any }) {
    const router = useRouter();

    const highLight = router.query.highLight;
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    return (
        <TopFrame config={config}>

            <main className="flex flex-1 flex-col">
                <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 justify-center items-center mt-1 mb-10">
                    {videoTools.map((tool) => (
                        showVideoTool(tool, config, (tool.code == highLight))
                    ))}
                    {audioTools.map((tool) => (
                        showVideoTool(tool, config, (tool.code == highLight))
                    ))}                    
                </div>
                <div className="hidden sm:flex flex-col w-full items-center">
                    {showVideoModels(mt.videoModels)}
                </div>
            </main>
            
        </TopFrame>
    );
        
};
