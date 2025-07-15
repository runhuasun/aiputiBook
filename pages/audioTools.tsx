import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";

import TopFrame from "../components/TopFrame";
import { Testimonials } from "../components/Testimonials";
import LoginPage from "../components/LoginPage";
import Image from "../components/wrapper/Image";

import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import { audioTools } from "../utils/funcConf";
import * as fu from "../utils/fileUtils";

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
        <Link className={"page-tab group relative rounded-2xl flex flex-col space-y-5 px-1 sm:px-2 pb-1 sm:pb-2 mt-4 items-center border-2  " + (highLight ? " border-slate-400 " : " border-transparent hover:border-slate-400 ")} href={tool.url} target="_blank">
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
                    <video className="rounded-xl" src={`${config.RS}/demo/${tool.demos[0]}`} controls={true} width={512} height={512} preload="none"
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
                    <video className="rounded-xl" src={`${config.RS}/demo/${tool.demos[1]}`} controls={true} width={512} height={512} preload="none"
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

export default function audioToolsPage({ config }: { config:any }) {
    const router = useRouter();

    let tools = audioTools;
    const highLight = router.query.highLight;
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    return (
        <TopFrame config={config}>
            <main>
                <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">
                    {tools.map((tool) => (
                        showVideoTool(tool, config, (tool.code == highLight))
                    ))}
                </div>
            </main>
        </TopFrame>
    );
        
};
