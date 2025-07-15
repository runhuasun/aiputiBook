import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";

import TopFrame from "../components/TopFrame";
import { Testimonials } from "../components/Testimonials";
import LoginPage from "../components/LoginPage";
import ResizablePanel from "../components/ResizablePanel";
import Image from "../components/wrapper/Image";

import { AIFuncs, defaultTools, aiTools, imageTools } from "../utils/funcConf";
import * as mt from "../utils/modelTypes";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    let title = ctx.query.title || "AI工具集";
    switch(config.websiteName){
        case "aixiezhen":
            title = "智能修图";
            break;
        case "niukit":
            title = "智能影音工具箱";
            break;
    }
    return {
        props:{ 
            title,
            config
        }
    };    
}

export default function AITools({title, config }: {title:string, config:any }) {
    const router = useRouter();

    const highLight = router.query.highLight;
    
    let tools = defaultTools;
    switch(config.websiteName){
        case "aixiezhen":
            tools = aiTools;        
            break;
        case "niukit":
            tools = imageTools;
            break;
    };
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    return (
        <TopFrame config={config}>
            <main className="flex flex-1 flex-col space-y-5">
                <div id="img2img" className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-5 gap-4 justify-center items-center sm:mt-1 mt-3">
                    {tools.map((tool) => (
                        <Link className={"page-tab group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 mt-4 items-center border-2  " + (tool.code == highLight ? " border-slate-400 " : " border-transparent hover:border-slate-400 ")} href={tool.url}>
                            <span className={(tool.isNew ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>New!</span>                                
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

                <div className="w-2/3 flex flex-col sm:flex-row items-center space-x-4 ">
                    <Link className="w-full flex flex-row items-center rounded-xl" href="/createPrompt?func=flux-pro-ultra">
                        <Image alt="图片素材" src="https://aiputifile.oss-cn-beijing.aliyuncs.com/demo/model/flux-pro-ultra-big.jpg"
                            className="w-full h-auto" 
                            />
                    </Link>                            
                </div>  
            </main>
        </TopFrame>
    );
};
