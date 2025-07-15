import { NextPage } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";

import TopFrame from "../components/TopFrame";
import { Testimonials } from "../components/Testimonials";
import LoginPage from "../components/LoginPage";
import ResizablePanel from "../components/ResizablePanel";
import Image from "../components/wrapper/Image";

import { AIFuncs, defaultTools, imageTools, cameraList } from "../utils/funcConf";
import * as mt from "../utils/modelTypes";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    let title = ctx.query.title || "AI工具集";
    if(config.websiteName == "aixiezhen"){
        title = "智能修图";
    }
    return {
        props:{ 
            title,
            config
        }
    };    
}



export default function imageToolsPage({title, config }: {title:string, config:any }) {
    const router = useRouter();

    const highLight = router.query.highLight;
    
    let tools = imageTools;
    let num=1;
       
    return (
        <TopFrame config={config}>
            <main>
                <div className="hidden sm:flex w-full px-20">
                    <div className="w-full page-tab rounded-full px-28 grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-4 justify-center items-center sm:mt-1 mt-3">
                        {cameraList.map((m) => (
                            <Link id={`cp_${m.code}`} href={m.url}  target="_blank" className="group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 items-center border-2 border-transparent hover:border-slate-400">
                                <span className={(m.price===0 ? "" : "hidden") +  " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                                <span className={(highLight == m.code ? "button-green-blue" : "text-button") + " flex group-hover:hidden max-w-fit items-center text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                    {`${m.name}`}
                                </span>   
                                <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                    {`${m.name}`}
                                </span>                                   
                                <div className="sm:mt-0 mt-1 w-full">
                                    <Image alt="示例" src= { `${config.RS}/demo/${m.demos[0]}` } className="w-full object-cover rounded-lg"/>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
      
                <div id="img2img" className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 justify-center items-center mt-1">
                    {tools.map((tool) => (
                        <Link className={"page-tab group relative rounded-2xl flex flex-col space-y-2 sm:space-y-5 px-1 sm:px-2 pb-1 sm:pb-2 sm:mt-4 items-center border-2  " + (tool.code == highLight ? " border-slate-400 " : " border-transparent hover:border-slate-400 ")} href={tool.url} target="_blank">
                            <span className={(tool.price===0 ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                                
                            <span className={(tool.code == highLight ? "button-green-blue" : "") + " flex group-hover:hidden max-w-fit items-center text-button text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                {tool.name}
                            </span>            
                            <span className={" hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                {tool.name}
                            </span>            
                            
                            <div className="flex space-x-2 flex-row ">
                              <div className="sm:mt-0 mt-1">
                                <Image
                                  alt="Original photo"
                                  src= { `${config.RS}/demo/${tool.demos[0]}` }
                                  className="object-cover rounded-lg"
                                  width={512}
                                  height={512}
                                />
                              </div>
                              <div className="sm:mt-0 mt-1">
                                <Image
                                    loading="lazy"                                        
                                    alt="Generated photo"
                                    width={512}
                                    height={512}
                                    src= { `${config.RS}/demo/${tool.demos[1]}` }
                                    className="object-cover rounded-lg"
                                />
                              </div>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="w-full sm:w-2/3 flex flex-col sm:flex-row items-center space-x-4 ">
                    <Link className="w-full flex flex-row items-center rounded-xl" href="/createPrompt?func=flux-pro-ultra"  target="_blank">
                        <Image alt="图片素材" src="https://aiputifile.oss-cn-beijing.aliyuncs.com/demo/model/flux-pro-ultra-big.jpg"
                            className="w-full h-auto" 
                            />
                    </Link>                            
                </div>  
                <div className="hidden sm:flex w-full">
                    <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">
                        {Array.from(mt.imageModels)
                            .filter(m => m.show === true)  // 先过滤出 show 为 true 的项
                            .map((m) => (  
                            <Link id={`cp_${m.code}`} href={`/createPrompt?sysType=PRO&func=${m.code}`}  target="_blank" className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                                <span className={(m.price===0 ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                                <span className={(highLight == m.code ? "button-green-blue" : "text-button") + " flex group-hover:hidden max-w-fit items-center text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md "}>
                                    {`${m.name}`}
                                </span>   
                                <span className="hidden group-hover:flex max-w-fit items-center button-green-blue text-center text-base justify-center space-x-2 rounded-lg px-5 py-1 shadow-md ">
                                    {`${m.name}`}
                                </span>                                   
                                <div className="sm:mt-0 mt-1 w-full">
                                    <Image alt="示例" src= { `${config.RS}/demo/model/${m.code}.jpg`} className="w-full object-cover rounded-lg"/>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            
            </main>
        </TopFrame>
    );
        
};
