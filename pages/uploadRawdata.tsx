import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { uploader, cnLocale, uploaderOptions} from "../components/uploadOption";
import { UploadWidgetResult } from "uploader";
import { UploadDropzone } from "react-uploader";
import UploadedFile, { Uploader, UploadWidgetLocale } from "uploader";
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
import { getServerSession } from "next-auth";
import { User } from "@prisma/client";

import { config } from "../utils/config";
import * as debug from "../utils/debug";
import {getFileTypeByMime} from "../utils/rawdata";
import LoginPage from "../components/LoginPage";
import * as monitor from "../utils/monitor";

export default function uploadRawdata({user, config }: { user:User, config:any }) {
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [fileName, setFileName] = useState<string>("");
    const [fileUrl, setFileUrl] = useState<string>("");
    const [fileType, setFileType] = useState<string>("");
    const [desc, setDesc] = useState<string>("");
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    let volumn = 0;

    uploaderOptions.maxFileSizeBytes = 544857600;
    uploaderOptions.mimeTypes = ["text/plain", 
                              "application/pdf", 
                              "application/vnd.ms-powerpoint",
                              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                              "application/vnd.ms-excel",
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                              "application/msword", 
                              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                              "image/jpeg", "image/png", "image/jpg", "image/webp",
                                ];
    uploaderOptions.maxFileCount = 100;
    uploaderOptions.onValidate = async (file: File): Promise<undefined | string> => {
        volumn++;
        debug.log(volumn);
        return undefined;
    };

    
    let uploadedFiles:UploadWidgetResult[]|null = null;

    function updateFiles(){
        if(uploadedFiles){
            let urls = fileUrl;
            let names = fileName;
            let types = fileType;
            for(const file of uploadedFiles){
                urls = (urls ? (urls + "|") : "") + file.originalFile.fileUrl!;
                names = (names ? (names + "|") : "") + file.originalFile.originalFileName!;
                types = (types ? (types + "|") : "") + getFileTypeByMime(file.originalFile.mime!);
            }
            
            uploadedFiles = null;            
            setFileUrl(urls);
            setFileName(names);
            setFileType(types);   
        }
    }
    
    const UploadDropZone = () => (
    <UploadDropzone
      uploader={uploader}
      options={uploaderOptions}
      onUpdate={upfiles => {
        uploadedFiles = upfiles;
        if (uploadedFiles.length == volumn) {
            updateFiles();
        }
      }}
      width="670px"
      height="300px"
    />
    );

    
    async function startUpload(){
    
        if(uploadedFiles){
            updateFiles();
        }  
          
        if(!desc || desc.length<5){
            alert("数据文件的描述至少需要5个字符，越详尽的描述文件的内容对于训练越有帮助");
            return;
        }else if( fileUrl == null || fileUrl.length < 1 ){
            alert("请先上传至少一个文件");
            return; 
        }
          
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);          
          
        let trainData = fileUrl;
        
        setError(null);
        if(await uploadFiles()){
          window.location.reload();
        }
        
        setTimeout(() => {
          setLoading(false);
        }, 1300);
        
    }
  

  const router = useRouter();
  
  async function uploadFiles() {
      try{
          const res = await fetch("/api/rawdataManager", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              // 先让code和name取一样的值
              body: JSON.stringify({ 
                  cmd: "CREATE",
                  urls:fileUrl, 
                  names: fileName, 
                  types: fileType,
                  desc: desc,
              }),
          });
          
          if (res.status !== 200) {
              setError(await res.json() as any);
              return false;
          } else {
              const result = await res.json();
              alert("文件上传成功！");
                setFileUrl("");
                setFileName("");
                setFileType("");                 
              return true;
          }
      }catch(e){
          debug.error(e);
          return false;
      }
  }

  
 if(status == "authenticated"){

    return (
        <TopFrame config={config}>

            
            <main>
                <h1 className="title-main">
                    上传 <span className="title-light">训练文件</span> 
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
                            文件内容描述（越详细对于训练越有利）
                            </p>
                        </div>
                 
                        <TextareaAutosize id="iptDesc" value = {desc}
                        className="input-main" 
                        maxRows={10}
                        placeholder="请尽量详细和贴切的描述语料文件的概要内容"
                        onChange={(e) => setDesc(e.target.value)} />  
                    </div>
                    
                    <div className="w-full max-w-lg">
                        <div className="flex mt-3 w-96 items-center space-x-3">
                            <Image
                            src="/number-2-white.svg"
                            width={30}
                            height={30}
                            alt="2 icon"
                            />                              
                            <p className="text-left">
                            上传文件(txt/word/excel/pdf/image/video/mp3）
                            </p>
                        </div>
                        <TextareaAutosize id="iptFileName" value = {fileName}
                        className="input-main" 
                        maxRows={10}
                        placeholder="点击下面的[上传文件]按钮"
                        readOnly
                        onChange={(e) => setFileName(e.target.value)} />  
                    </div>
                    <UploadDropZone />

                    
                    {loading ? (
                        <button disabled className="button-gold rounded-full text-white font-medium px-4 pt-2 pb-3 mt-8 w-40" >
                            <span className="pt-4">
                                <LoadingDots color="white" style="large" />
                            </span>
                        </button>
                    ):(
                        <button
                            onClick={() => {
                              startUpload();
                            }}
                            className="button-gold rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            开始上传文件
                        </button> 
                    )
                    }
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]" role="alert">
                            <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                                上传文件时发生错误
                            </div>
                            <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                                {error}
                            </div>
                        </div>
                    )}
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
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let user = null;
 
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }
    return {
        props: {
            user,
            config,
        },
    };
  
}    
