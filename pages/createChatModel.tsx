import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { CompareSlider } from "../components/CompareSlider";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Image from "../components/wrapper/Image";

import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, Rawdata, ModelRawdatas } from "@prisma/client";
import { getServerSession } from "next-auth";
import {ZipData} from "./api/processImage";
import { showModel} from "../components/Genhis";
import {hotSigns} from "../utils/parser";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import { getFileIcon, getFileTypeByMime } from "../utils/rawdata";
import LoginPage from "../components/LoginPage";
import RawdataSelector from "../components/RawdataSelector";
import * as monitor from "../utils/monitor";

export default function createChatModel({ modelRawdatas, model, config }: { modelRawdatas: any[], model:Model, config:any }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState<string>("");
    const [levelSigns, setLevelSigns] = useState<string>("");
    const [name, setName] = useState(model? model.name: "");
    const [fileName, setFileName] = useState<string>("");
    const [fileUrl, setFileUrl] = useState<string>("");
    const [fileType, setFileType] = useState<string>("");

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const router = useRouter();
    const moduleTitle = router.query.moduleTitle;
    const moduleName = router.query.moduleName;
    const channel = router.query.channel as string || "PUBLIC";
    
    let volumn = 0;
    
    function updateFiles(files:any[]){
        if(files){
            let urls = fileUrl;
            let names = fileName;
            let types = fileType;
            for(const file of files){
                for(const existFile of modelRawdatas){
                    if(existFile.rawdata.name == file.originalName){
                        alert(existFile.rawdata.name + "已经被训练过，请确定是否还要再次训练");
                        break;
                    }
                }
                urls = (urls ? (urls + "|") : "") + file.uploadedUrl;
                names = (names ? (names + "|") : "") + file.originalName;
                types = (types ? (types + "|") : "") + getFileTypeByMime(file.fileType); // 获得文件的分类类型，不是mime
            }
            setFileUrl(urls);
            setFileName(names);
            setFileType(types);   
        }      
    }
 
    async function startTrain(){
    
        if(name.length < 2 || name.length > 50){
            alert("请给模型起一个2 - 50个字的名字吧！");
            return;
        }else if(title && title.length>1000){
            alert("训练内容的简介不能超过1000个字符");
            return;
        }else if( fileUrl == null || fileUrl.length < 1 ){
            alert("请先上传训练文件，才能开始训练！");
            return; 
        }
        
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);          
        setError(null);
        
        if(await generate(fileUrl, fileName, fileType)){
            window.location.href = "/dashboard?segment=CHATMODEL&func=chat";          
        }
    
        setTimeout(() => {
            setLoading(false);
        }, 1300);
        
    }
  

    async function trainRawdata(row: any){
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);          
        
        setError(null);
        if(await generate(row.rawdata.url, row.rawdata.name, row.rawdata.type, row.rawdata.id)){
            window.location.href = "/dashboard?segment=CHATMODEL&func=chat";          
        }
        
        setTimeout(() => {
            setLoading(false);
        }, 1300);            
    }

    // 多个url,name,type用|分隔
    async function generate(urls: string, names:string, types:string, rawdataIds?:string) {
        try{
            const res = await fetch("/api/trainChatModel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                // 先让code和name取一样的值
                body: JSON.stringify({ 
                    datasetUrls:urls, 
                    datasetNames:names,
                    datasetTypes:types,
                    datasetRawdataIds:rawdataIds ? rawdataIds : "",
                    modelName:name, title:title, types: types,  modelId:(model? model.id : ""), levelSigns, channel }),
            });

            if (res.status !== 200) {
                setError(await res.json() as any);
                alert(await res.json() as any);
                return false;
            } else {
                const result = await res.json();
                alert("本次训练消耗" + result.usedCredits + "个" + config.creditName + "，并预计需要" + result.estimateTime + "秒完成训练");
                
                return true;
            }
        }catch(e){
            debug.error(e);
            return false;
        }
    }
    
    useEffect(() => {
        if (router.query.success === "true") {
            toast.success("模型训练成功！");
        }
    }, [router.query.success]);

    async function deleteRawdata(id:string){
        const res = await fetch("/api/rawdataManager", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ id:id, modelId:model.id, cmd:"DELETE_FROM_MODEL"}),
        });
    
        let response = await res.json();
        if (res.status !== 200) {
            setError(response as any);
        } else {
            window.location.reload();
        }    
    }
  
    if(status == "authenticated"){
        return (
            <TopFrame config={config}>
                <main>
                    <h1 className="title-main">
                        {moduleTitle ? (
                            <div>
                            {moduleTitle}
                            </div>  
                        ) : (
                            <div>
                            训练我的 <span className="title-light">{moduleName ? moduleName : "语言"}模型 </span> 
                            </div>
                        )}
                    </h1>
                    
                    <div className="flex justify-between items-center w-full flex-col mt-4">
                        
                        <div className="space-y-4 w-full max-w-lg">
                            <div className="flex mt-3 items-center space-x-3">
                                <Image
                                src="/number-1-white.svg"
                                width={30}
                                height={30}
                                alt="1 icon"
                                />
                                <p className="text-left font-medium">
                                    给{moduleName ? moduleName : '模型'}起个好名字（唯一标识）
                                </p>
                            </div>
                
                            <input id="iptCode" type="text" value = {name}
                                className="input-main" 
                                readOnly={model ? true : false}
                                onChange={(e) => setName(e.target.value)} />
                        </div>
                        
                        <div className="space-y-4 w-full max-w-lg">
                            <div className="flex mt-4 items-center space-x-3">
                                <Image
                                src="/number-2-white.svg"
                                width={30}
                                height={30}
                                alt="2 icon"
                                />
                                <p className="text-left font-medium">
                                    本次训练的内容简介
                                </p>
                            </div>
                            <TextareaAutosize id="iptTitle"  
                                style={{ borderRadius: "8px", borderColor:'green'}  }        
                                maxRows={10}
                                className="input-main " 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)} />
                            
                        </div>

                        <div className="space-y-4 w-full max-w-lg">
                            <div className="flex mt-3 items-center space-x-3">
                                <Image
                                    src="/number-3-white.svg"
                                    width={30}
                                    height={30}
                                    alt="3 icon"
                                />
                                <p className="text-left font-medium">
                                    内容结构标识（只对txt/word/pdf有效）
                                </p>
                            </div>
                
                            <input id="iptLevelSigns" type="text" value = {levelSigns}
                            className="input-main" 
                            placeholder="内容的分级结构比如：章|节|条"
                            onChange={(e) => setLevelSigns(e.target.value)} />
        
                            <span className="text-white font-medium"></span>
                            { hotSigns && hotSigns.map((word) => (
                                <button className="button-gray px-1 mb-1"   
                                        onClick={() => {
                                        setLevelSigns( (levelSigns.trim() == "") ? word : (levelSigns + "|" + word) );
                                        }} 
                                >
                                    {word}
                                </button>
                            ))} 
                        </div>

            
                        <div className="w-full max-w-lg">
                            <div className="flex mt-3 w-96 items-center space-x-3">
                                <Image
                                src="/number-4-white.svg"
                                width={30}
                                height={30}
                                alt="4 icon"
                                />   
                                <p className="text-left">
                                    上传训练资料(txt/word/excel/pdf）
                                </p>
                            </div>
                            <TextareaAutosize id="iptFileName" value = {fileName}
                            className="input-main" 
                            maxRows={10}
                            placeholder="点击下面的[上传文件]按钮"
                            readOnly
                            onChange={(e) => setFileName(e.target.value)} />  
                        
                            <RawdataSelector fileType="TEXT" onSelect = { (files) => updateFiles(files) }></RawdataSelector>
                        </div>
                        

                        {status === "authenticated" && data && (
                            <div className="w-670 items-left text-left">
                                <p className="px-1 text-left font-medium w-full text-gray-200 ">
                                    <span>
                                        训练{moduleName ? moduleName :'语言'}模型按照1000字/1个{config.creditName}收费，不足1000字的部分收取1个{config.creditName}。
                                    </span>
                                    <span className="text-gray-200">
                                        你还有{data.remainingGenerations}个{config.creditName}。
                                    </span>
                                    <span>
                                        购买{config.creditName}
                                        <Link
                                            href="/buy-credits"
                                            className="font-semibold text-gray-100 underline underline-offset-2 hover:text-red-200 transition" >
                                            在这里
                                        </Link>
                                    </span>
                                </p>
                            </div>
                        )}
                        {loading ? (
                            <button
                                disabled
                                className="button-gold rounded-full text-white font-medium px-4 pt-2 pb-3 mt-8 w-40"
                            >
                                <span className="pt-4">
                                    <LoadingDots color="white" style="large" />
                                </span>
                            </button>
                        ):(
                                <button
                                    onClick={() => {
                                    startTrain();
                                    }}
            
                                    className="button-gold rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition"
                                >
                                    开始训练{moduleName ? moduleName : '小模型'}
                                </button> 
                            )
                        }
                        {error && (
                            <div
                                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]"
                                role="alert"
                            >
                                <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                                    训练模型时发生错误
                                </div>
                                <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                                    {error}
                                </div>
                            </div>
                        )}

                        
                    </div>

                    <div className="flex flex-row flex-col space-y-10 mt-4 mb-4 pt-2 rounded-xl text-left items-center w-full space-x-2">
                        {modelRawdatas && (
                            <div className="px-1 text-left font-medium w-full text-gray-200">
                                目前已经有{modelRawdatas.length}个文件参与模型训练
                            </div>
                        )}
                        <div className="grid grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-8">
                            {modelRawdatas && modelRawdatas.map((m) => (
                                <div className="masonry-item rounded-2xl border-gray-200 bg-gray-100 text-left relative inline-block">
                                    <Link href={ m.rawdata.url } target="_blank">
                                
                                        <Image
                                            alt="AI训练语料"
                                            width={256}
                                            height={256}
                                            src={ getFileIcon(m.rawdata.url) }
                                            className="sm:mt-0 mt-2 w-full"
                                            />
                                    </Link>
                                
                                    <button onClick={() => {
                                        deleteRawdata(m.rawdata.id);
                                    }}
                                        className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500">
                                        <span className="sr-only">删除</span>
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                                        <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                                        </svg>
                                    </button>  

                                    {m.status != "TRAINED" && (
                                    <div className="absolute bottom-0 right-0 flex flex-col items-right">
                                        <button
                                        onClick={() => {
                                            trainRawdata(m);
                                        }}
                                        className=" w-12 h-5 button-main text-white text-xs px-2  rounded-none"
                                        >
                                        训练
                                        </button>    
                                    </div>                             
                                    )}
                                
                                    <p className="text-gray-600  sm:px-2 px-1">
                                    {m.name}
                                    </p>
                                    <p className="text-gray-400  sm:px-2 px-1">
                                    {m.rawdata.name ? ('"' + m.rawdata.name + '"') : ""}
                                    </p>                             
                                </div>    
                            ))}  
                        </div>    
                    </div>
                </main>
            </TopFrame>
        );
    }else{
        return(
            <LoginPage config={config}/>
        );
    }
};

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
  
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let modelId = ctx?.query?.modelId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let userId = "";
    
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        let user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(user){
            userId = user.id;
        }
    }
  
    // 如果给了modelId，就找到对应的模型
    let model = null;
    debug.error("modelId:"  + modelId);
    if(modelId){
        const whereTerm = (modelId == "def_model_") ? {code: "def_model_"+userId} : {id: modelId};
            
        model = await prisma.model.findUnique({
            where: whereTerm,
            include: {
                modelRawdatas: {
                    where: {
                        NOT: {
                        status: "DELETE"
                        }
                    },   
                    take: 1000,
                    include: {
                        rawdata: true
                    },
                        orderBy: {
                            createTime: 'desc',
                        }                  
                }
            }
        });
    }  

    // const rawdatas = model ? model.modelRawdatas.map(modelRawdata => modelRawdata.rawdata) : [];
    const modelRawdatas = model ? model.modelRawdatas : [];
    return {
        props: {
            modelRawdatas,
            model,
            config,
        },
    };
}    
