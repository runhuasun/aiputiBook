import { NextPage } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";

import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import { Testimonials } from "../components/Testimonials";
import LoginPage from "../components/LoginPage";
import ResizablePanel from "../components/ResizablePanel";

import { AIFuncs, defaultTools, imageTools } from "../utils/funcConf";
import * as mt from "../utils/modelTypes";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    return {
        props:{ 
            config
        }
    };    
}



export default function pModelList({title, config }: {title:string, config:any }) {
    const router = useRouter();

    const highLight = router.query.highLight;
 
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const models = mt.imageModels.filter(model => model.show);

    let num=1;
    
    return (
        <TopFrame config={config}>
            <main>

                <div className="w-full grid grid-flow-row-dense grid-cols-2 sm:grid-cols-5 gap-4 justify-center items-center sm:mt-1 mt-3">
                    {Array.from(models).map((m) => (
                        <Link id={`cp_${m.code}`} href={`/createPrompt?sysType=PRO&func=${m.code}`} className="page-tab group relative rounded-2xl flex flex-col space-y-5 px-4 pb-4 mt-4 items-center border-2 border-transparent hover:border-slate-400">
                            {m.price == 0 ? (
                                <span className={"absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>免费</span>                              
                            ) : (
                                <>
                                    <span className={"group-hover:hidden absolute top-2 right-1 button-main w-20 text-xs px-2 py-1 rotate-45"}>{`$${m.price}点/次`}</span>                                                                  
                                    <span className={"hidden group-hover:flex absolute top-2 right-1 button-green-blue w-20 text-xs px-2 py-1 rotate-45"}>{`$${m.price}点/次`}</span>                                                                  
                                </>                                            
                            )}
                            <div className="sm:mt-0 mt-1 w-full">
                                <Image alt="示例" width={512} height={512} src= { `${config.RS}/demo/model/${m.code}.jpg`} className="w-full object-cover rounded-lg"/>
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

            </main>
        </TopFrame>
    );
      
};

