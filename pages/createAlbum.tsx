import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";

import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";

import DropDown from "../components/DropDown";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Album, Room } from "@prisma/client";
import { getServerSession } from "next-auth";
import LoginPage from "../components/LoginPage";
import FileSelector from "../components/FileSelector";
import * as debug from "../utils/debug";
import Uploader, {mimeTypes} from "../components/Uploader";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";

export default function createAlbum({ albumRooms, album, config, user }: { albumRooms:any[], album:any, config:any, user:any }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [id, setId] = useState<string>(album?.id || "");
    const [code, setCode] = useState<string>(album?.code || generateAlbumCode());
    const [name, setName] = useState<string>(album?.name || "");
    const [type, setType] = useState<string>(album?.type || "PHOTO");
    const [desc, setDesc] = useState<string>(album?.desc || "");
    const [coverImg, setCoverImg] = useState<string>(album?.coverImg || `${config.RS}/default/album.jpg`);
    const [access, setAccess] = useState<string>(album?.access || "PRIVATE");
    const [score, setScore] = useState<number>(album?.score || 0);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const UploadDropZone = () => (
        <Uploader 
          mime= {mimeTypes.image}   
          setFiles = { files => {
            if (files.length !== 0) {
                setCoverImg(files[0].uploadedUrl);
            }
        }}/>
    );
    
    function checkFields(){
    
        if(!name || name.length < 2 || name.length > 20){
            alert("请给相册起一个2 - 20个字的名字吧！");
            return false;
        }
        if(!code || code.length < 3 || code.length > 50){
            alert("请给相册起一个3 - 50个字的编码吧！");
            return false;            
        }
        if(!coverImg){
            alert("请给相册设置一个封面！");
            return false;
        }
        return true;
    }

    
    const router = useRouter();
  
    async function createAlbum() {
        try{
            setLoading(true);
            if(checkFields()){
                const res = await fetch("/api/albumManager", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    // 先让code和name取一样的值
                    body: JSON.stringify({ 
                        cmd: "CREATE",
                        data: {
                            code,
                            name,
                            type,
                            desc,
                            score,
                            coverImg,
                            access
                        }
                    }),
                });
                
                if (res.status !== 200) {
                    setError(await res.json() as any);
                    return false;
                } else {
                    const result = await res.json();
                    setId(result.id);
                    alert("相册创建成功！");
                    window.location.href = "/showAlbum?albumId=" + result.id;
                }
            }
        }catch(e){
            debug.error(e);
            return false;
        }finally{
            setLoading(false);
        }
    }
 
    async function updateAlbum() {
        try{
            setLoading(true);
            if(checkFields()){
                const res = await fetch("/api/albumManager", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ 
                        cmd: "UPDATE",
                        id: album?.id || id,
                        data: {
                            code,
                            name,
                            type,
                            desc,
                            score,
                            coverImg,
                            access
                        }         
                    }),
                });
                if (res.status !== 200) {
                    setError(await res.json() as any);
                    return false;
                } else {
                    const result = await res.json();
                    window.location.href = "/showAlbum?albumId=" + result.id;
                }
            }
        }catch(e){
            debug.error(e);
            return false;
        }finally{
            setLoading(false);
        }
    }

  if(status == "authenticated"){  
      return (
          <TopFrame config={config}>
              <main>
                  <h1 className="title-main">
                      {id ? "更新" : "创建"} <span className="title-light">相册</span> 
                  </h1>
                  
                  <div className="flex justify-between items-center w-full flex-col mt-4">
              
                      <div className="hidden space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  相册编号
                              </p>
                          </div>
                          { id ? (
                          <input type="text" value = {code} className="input-main"  readOnly onChange={(e) => setCode(e.target.value)} />
                          ):(
                          <input type="text" value = {code} className="input-main" onChange={(e) => setCode(e.target.value) }/>   
                          )}
                          
                      </div>
              
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  相册名称
                              </p>
                          </div>
                          <input type="text" value = {name} className="input-main"  onChange={(e) => setName(e.target.value)} />
                      </div>

                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  排序权重(越大越靠前)
                              </p>
                          </div>
                          <input type="text" value = {score} className="input-main"  onChange={(e) => setScore(e.target.value? parseInt(e.target.value) : 0)} />
                      </div>
                      
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                              相册封面
                              </p>
                          </div>
                          {coverImg && coverImg!="" && (
                            <div className="w-full max-w-lg items-center justify-center">
                              <Image
                                src={coverImg}
                                width={400}
                                height={400}
                                alt="cover image"
                                className="w-full"
                              />
                            </div>                          
                          )}
                          <div className="w-full flex flex-row">
                              <div className="flex w-1/3">
                                  <FileSelector 
                                      title="选择相册中的图片" 
                                      files={albumRooms} 
                                      fileType="IMAGE"
                                      pageCount={1}
                                      pageSize={18}
                                      currentPage={1}
                                      onSelect={(file) => {
                                          if(file && file.outputImage){
                                              setCoverImg(file.outputImage);
                                          }
                                      }} 
                                  />    
                              </div>
                              <div className="flex flex-1">
                                  <UploadDropZone />
                              </div>
                          </div>                      
                      </div>

                      
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-4 items-center space-x-3">
                              <p className="text-left font-medium">
                                  相册介绍
                              </p>
                          </div>
                          <TextareaAutosize  
                              minRows={4} maxRows={40}
                              className="input-main " 
                              value={desc}
                              onChange={(e) => setDesc(e.target.value)} />
                      </div>
                      
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
                              if(id){
                                  updateAlbum();
                              }else{
                                  createAlbum();
                              }
                          }}
                          className="button-gold rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition">
                          { id ? "修改相册" : "创建相册" }
                      </button> 
                      )}
                      
                      {error && (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]" role="alert">
                          <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                              { id ? "修改相册时发生错误" : "创建相册时发生错误" } 
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
      return(<LoginPage config={config}/>);
  }
    
};

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    monitor.logUserRequest(ctx, session);
    
    let albumId = ctx?.query?.albumId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let user:any;
 
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }
    
    var album:any;
    var albumRooms:any[];
    if(albumId){     
        album = await prisma.album.findUnique({
            where: {
              id: albumId,
            },
            include: {
                albumRooms: {
                    where: {
                        NOT: {
                            status: "DELETED"
                        }
                    },
                    take: 100,
                    include: {
                        room: true
                    },
                    orderBy: {
                        createTime: 'desc',
                    }
                }
            }
        });
        albumRooms = album ? album.albumRooms.map((obj: any) => obj.room) : [];
        return {
            props: {
                albumRooms,
                album,
                config,
                user
            },
        };        
    }
    
    return {
        props: {
            albumRooms:[],
            config,
            user
        },
    };
}    

function generateAlbumCode(){
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0');

    return year + month + day + hours + minutes + seconds + milliseconds;
}
