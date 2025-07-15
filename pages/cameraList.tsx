import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { Testimonials } from "../components/Testimonials";
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import { cameraList } from "../utils/funcConf";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import ResizablePanel from "../components/ResizablePanel";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

import TopFrame from "../components/TopFrame";
import Image from "../components/wrapper/Image";

import {isMobile} from "../utils/deviceUtils";
import * as monitor from "../utils/monitor";
import * as fc from "../utils/funcConf";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    return {
        props:{ 
            config
        }
    };    
}



export default function cameraListPage({ config }: { config:any }) {
    const router = useRouter();
    const [tools, setTools] = useState<any[]>(cameraList);
 /*
    useEffect(() => {
        const hl = router?.query?.highLight as string;
        if(hl){
            const camera = document.getElementById(hl);
            if(camera){
                camera.scrollIntoView({ behavior: 'smooth'});    
            }
        }
    }, []);
 */   
  
    useEffect(() => {
        const hl = router?.query?.highLight as string;
        switch(hl){
            case "takeIDPhoto":
                setTools([
                    fc.getAIFuncByCode("takeIDPhoto"),                                        
                    fc.getAIFuncByCode("superCamera"), 
                    fc.getAIFuncByCode("takePhoto"),    
                    fc.getAIFuncByCode("stylePortrait"),
                    fc.getAIFuncByCode("takeGroupPhoto"),
                ]);
                break;
            case "takeGroupPhoto":
                setTools([
                    fc.getAIFuncByCode("takeGroupPhoto"),                                        
                    fc.getAIFuncByCode("superCamera"), 
                    fc.getAIFuncByCode("takePhoto"),    
                    fc.getAIFuncByCode("stylePortrait"),
                    fc.getAIFuncByCode("takeIDPhoto"),                                        
                ]);
                break;
        }
    }, []);
  
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    let num = 1;

    function showCamera(tool:any, order:number){
        return (
            <Link className=" relative w-full rounded-2xl flex flex-col space-y-5 p-4 mb-8 items-center " href={tool.url}>
                <span className={(tool.price<=2 ? "" : "hidden") + " absolute top-2 right-1 button-gold w-20 text-xs px-2 py-1 rotate-45"}>特惠</span>
                <span className="flex group-hover:hidden flex-row space-x-1 max-w-fit items-center text-button text-center text-lg justify-center rounded-lg px-5 py-2 shadow-md ">
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlnsXlink="http://www.w3.org/1999/xlink" width="32" height="32" x="0" y="0" viewBox="0 0 512 512" xmlSpace="preserve">
                        <circle cx="256" cy="256" r="240" fill="#3C9E5D"></circle>
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="300" fontFamily="Arial" fontWeight="normal" fill="#FFFFFF">{order}</text>
                    </svg>                      
                    <p>{tool.name}</p>
                </span>            
                <span className="hidden group-hover:flex flex-row space-x-1 max-w-fit items-center button-green-blue text-center text-lg justify-center rounded-lg px-5 py-2 shadow-md ">
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlnsXlink="http://www.w3.org/1999/xlink" width="32" height="32" x="0" y="0" viewBox="0 0 512 512" xmlSpace="preserve">
                        <circle cx="256" cy="256" r="240" fill="#3C9E5D"></circle>
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="300" fontFamily="Arial" fontWeight="normal" fill="#FFFFFF">{order}</text>
                    </svg>                      
                    <p>{tool.name}</p>
                </span>            
                
                <div className="w-full flex space-x-5 flex-row ">
                  <div className="w-1/2 sm:mt-0 mt-1">
                    <Image
                      alt="Original photo"
                      src= { `${config.RS}/demo/${tool.demos[0]}` }
                      className="w-full h-auto object-cover rounded-xl"
                      width={512}
                      height={512}
                    />
                  </div>
                  <div className="w-1/2 sm:mt-0 mt-1">
                    <Image
                      alt="Generated photo"
                      width={512}
                      height={512}
                      src= { `${config.RS}/demo/${tool.demos[1]}` }
                      className="w-full h-auto object-cover rounded-xl"
                    />
                  </div>
                </div>
            </Link>
        );
    }

    const cameraDemo = new Map([
        ["takePhoto", 
         `超能写真相机是超能照相馆的主力AI相机，可以按照用户指定的写真套系，生成用户的个人写真。
         AI系统仅凭一张照片就学习到用户的面部特征和脸型特点，结合用户的体型描述，就可以生成逼真的照片。
         用户还可以选择自己喜欢的人物姿势来精准控制照片人物的动作。并且可以给照片指定系统预制的各种背景`],
        ["superCamera", ""],
        ["takeIDPhoto", ""],
        ["stylePortrait", ""],
        ["poseAndFace", ""]
    ]);
    
    function showCameraAndDemo(tool:any, order:number){
        return (
            <Link id={tool.code} className="group relative w-full flex flex-row items-center space-x-10" href={tool.url}>
                <Image alt="take photo" src={`${config.RS}/aixiezhen/cameras/${tool.code}.jpg`} className="flex flex-1"/>
                <div className={`absolute w-1/3 bg-black opacity-90 rounded-2xl px-2 ${(order % 2) == 1 ? "left-40" : "right-40"} flex flex-row items-center border-2 border-transparent hover:border-white `}>
                {showCamera(tool, order)}
                </div>                                
            </Link>
        );
    }

    function showCameraMenuItem(tool:any){
        return (
            <button className="button-grid px-4 py-2 text-left"
                onClick={()=>{
                    document.getElementById(tool.code)!.scrollIntoView({
                        behavior: 'smooth' // 这将启用平滑滚动效果
                        });
                }}
                >
                {tool.name}
            </button>
        );
    }
    
    return (
        <TopFrame config={config}>
            <main className="flex flex-row">
                <div className="hidden sm:block fixed z-50 top-1/2 left-0 transform -translate-y-1/2 -translate-y-24 bg-black opacity-80 hover:opacity-100 shadow-lg w-[200] rounded-xl">
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 justify-center items-center">
                        {tools.map((tool) => (
                            showCameraMenuItem(tool)
                        ))}
                    </div>
                </div>                
                
                {isMobile() ? (
                <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-2 gap-4 justify-center items-center sm:mt-1 mt-3">
                    {tools.map((tool) => (
                        showCamera(tool, num++)
                    ))}
                </div>
                )
                    :
                (
                <ResizablePanel>
                    <AnimatePresence mode="wait">
                        <motion.div className="flex justify-between items-center w-full flex-col">                       
                            <div className="w-full flex flex-1 grid grid-flow-row-dense grid-cols-1 justify-center items-center sm:mt-1 mt-3 max-w-screen-2xl	">
                                {tools.map((tool) => (
                                    showCameraAndDemo(tool, num++)
                                ))}
                            </div>
                        </motion.div> 
                    </AnimatePresence>
                </ResizablePanel>                            
                )}
            </main>
        </TopFrame>
    );


        
};
