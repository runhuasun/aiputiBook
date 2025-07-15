import { NextPage } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signIn } from "next-auth/react";

import Video from "../components/wrapper/Video";
import TopFrame from "../components/TopFrame";

import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import * as mt from "../utils/modelTypes";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    return {
        props:{ 
            config
        }
    };    
}


export default function vModelList({ config }: { config:any }) {
    const router = useRouter();

    const highLight = router.query.highLight;
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    return (
        <TopFrame config={config}>
            <main className="flex flex-1 flex-col">
           
                <div className="hidden sm:flex flex-col w-full items-center">
                    <div className="w-full bg-gray-900 flex flex-col items-center pb-10">                    
                        <span className="w-full text-center text-xl sm:text-3xl font-display tracking-wide text-gray-100 mt-10 mb-0">
                            热门视频生成模型
                        </span> 
                        <div className="flex w-full">
                            <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">
                                {mt.videoModels
                                    .filter(m => m.show===true)  // 仅保留 m.show 为 true 的元素                        
                                    .map((m) => (
                                    <Link id={`cp_${m.code}`}  key={m.code} href={`/createVideo?sysType=PRO&model=${m.code}`}  target="_blank" 
                                        className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400"
                                        >
                                        {m.price == 0 ? (
                                            <span className={"absolute z-50 top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                                        ) : (
                                            <span className={"absolute z-50 top-2 right-1 button-green-blue w-20 text-xs px-2 py-1 rotate-45"}>{`$${m.price}点/秒`}</span>                                                                  
                                        )}
                                        <div className="sm:mt-0 mt-1 w-full">
                                            <Video src={`${config.RS}/demo/model/${m.code}.mp4`} poster={`${config.RS}/demo/model/${m.code}.mp4?x-oss-process=video/snapshot,t_100,f_jpg`} loop muted={true} lazyHover={true} className="w-full object-cover rounded-lg"/>
                                        </div>
                                        <div className="w-full flex flex-row items-center justify-between">
                                            <div className="flex flex-row items-center justify-start">
                                                <span className={(highLight == m.code ? "button-green-blue" : "text-button") + " flex group-hover:hidden max-w-fit items-center text-left text-sm justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                                    {`${m.name}`}
                                                </span>   
                                                <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-left text-sm justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                                    {`${m.name}`}
                                                </span>                                        
                                            </div>      
                                            <span className="text-sm text-right text-gray-400">
                                                {`${m.score}分`}
                                            </span>
                                        </div>                              
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>         
                </div>
            </main>
        </TopFrame>
    );
        
};
