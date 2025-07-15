import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { getServerSession } from "next-auth";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room, Prompt, User } from "@prisma/client";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import { CompareSlider } from "../components/CompareSlider";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import Genhis from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import Uploader, {mimeTypes} from "../components/Uploader";
import ComboSelector from "../components/ComboSelector";
import Image from "../components/wrapper/Image";

import {channelType, channels, channelNames} from "../utils/channels";
import { config } from "../utils/config";
import {bookLabels} from "../utils/labels";
import { rooms, roomNames  } from "../utils/modelTypes";
import {hasSensitiveWord} from "../utils/sensitiveWords";
import * as monitor from "../utils/monitor";





export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    let pcode = ctx?.query?.prompt;
    let user = null;
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
  
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }
  
    // 从数据库里找到对应的模型
    let prompt =  await prisma.prompt.findUnique({
        where: {
            code: pcode,
        },
    });  

  let orTerm : any[] = [{access: "PUBLIC",   sysScore:  { gt: 1 },}];
    if(user?.id){
        orTerm.push({userId: user?.id});
    }  
    let imghis = await prisma.room.findMany({
        where: {
            model: pcode,
            status: "SUCCESS",
            OR: orTerm,
            NOT: {
                func: "lora"
            }
        },
        take: 100,
        orderBy: {
          createdAt: 'desc',
        },         
        include: {
          user:true,           
        },
    });
  
  return {
    props: {
      imghis,      
      prompt,
      config,
      user
    },
  };
}  



export default function publishPrompt({ imghis, prompt, config, user }: { imghis: (Room & { user: User; })[], prompt: Prompt, config: any, user: User }) {
  
  
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [price, setPrice] = useState(prompt.price || 4);
    const [desc, setDesc] = useState(prompt.desc || "");
    const [coverImg, setCoverImg] = useState(prompt.coverImg || "");
    const [func, setFunc] = useState(prompt.func || "sdxl-lighting");

    let defaultChannel = prompt.channel as channelType;
    if(!defaultChannel){
        switch(config.wesiteName){
            case "aixiezhen":
                defaultChannel = "PORTRAIT";
                break;
            default:
                 defaultChannel = "PUBLIC";
        }
    }
    const [channel, setChannel] = useState<string>(defaultChannel);
    const [sysScore, setSysScore] = useState<number>(prompt.sysScore || 0);
    const [temp, setTemp] = useState<string>("");
    const [name, setName] = useState<string>(prompt.name || "");
    const [formular, setFormular] = useState<any>(prompt.formular || "");
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    let minPrice = 2;
    const isAdmin:boolean = (user && user.actors && user.actors.indexOf("admin")>=0) ? true : false;
    
    async function updatePrompt(access:string){
        if(name==null || name.trim()==""){
          alert("需要给提示词应用起个名字，他是唯一标识");
          return;
        }
        if(!price || price < 4 || price > 10000){
          if(!isAdmin){
              return alert("模型价格必须是一个介于4到10000的整数！");
          }
        }
        if(sysScore<0 || sysScore>100000){
            alert("排序权重必须是一个介于0到100,000的整数！");
            return;
        }
        if(hasSensitiveWord(name)){
          alert("输入应用名称中有敏感词，请修改！");
          return;
        }
        if(hasSensitiveWord(desc)){
          alert("输入的描述中有敏感词，请修改！");
          return;
        }    
        if(!formular || formular.trim()==""){
          alert("提示词不能为空，请修改！");
          return;
        }   
        
        const res = await fetch("/api/createPrompt", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
              id:prompt?.id, 
              cmd:"UPDATE",
              name: name,
              func: func,
              access: access,
              formular: formular,
              coverImg: coverImg,
              price: price || 10, 
              desc: desc, 
              sysScore,
              channel,
          }),
        });
        
        let response = await res.json();
        if (res.status !== 200) {
          alert(response as any);
        } else {
          switch(access){
              case "PUBLIC":
                  alert("提示词应用已经被发布！");
                  break;
              case "PRIVATE":
                  alert("提示词应用改为私有应用！");
                  break;
              default:
                  alert("提示词应用已经被更新！");
                  break;
          }     

            window.location.href = "/runPromptApp?prompt=" + prompt.code;
        }    
        
  }

    
    if(status == "authenticated"){
        return (
        <TopFrame config={config}>
          <main>
            <h1 className="title-main">
              设置提示词应用 <span className="title-light">{prompt ? prompt.name : "出错啦！"}</span> 
            </h1>
            <div className="flex justify-between items-center w-full flex-col mt-4">
              { (status === "authenticated") && ( 
                <>
                  <div className="space-y-4 w-full max-w-lg">
                      <div className="flex mt-3 items-center space-x-3">
                          <p className="text-left font-medium">
                              提示词名称
                          </p>
                      </div>
                      <input type="text" value = {name}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                          onChange={(e) => setName(e.target.value)} />
                  </div>                 
                  
                  { prompt.func != "chat" && (
                     <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                            <p className="text-left font-medium">
                              AI基础大模型
                            </p>
                        </div>  
                        <DropDown
                            theme={func}
                            // @ts-ignore
                            setTheme={(newRoom) => setFunc(newRoom)}
                            themes={rooms}
                            names={roomNames}
                        />
                    </div>
                  )}
                    
                  <div className="mt-4 w-full max-w-lg">
                      <div className="flex mt-6 w-96 items-center space-x-3">
                          <p className="text-left font-medium">
                            提示词应用公式
                          </p>
                      </div>
                      <TextareaAutosize value={formular}   style={{ borderRadius: "8px" }}  
                          className="bg-slate-800 rounded-full w-full text-gray-100 border-gray-600 font-medium px-4 py-2 sm:mt-0 mt-2 h-16" 
                          onChange={(e) => setFormular(e.target.value)} />  
                  </div>  
    
                  { isAdmin && (              
                  <>
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  模型的主要频道
                              </p>
                          </div>              
                          <DropDown 
                              theme={channel}
                              // @ts-ignore
                              setTheme={(newTheme) => setChannel(newTheme)}
                              themes={channels}
                              names={channelNames}
                              />
                      </div>
                      
                      <div className="space-y-4 w-full max-w-lg">
                          <div className="flex mt-3 items-center space-x-3">
                              <p className="text-left font-medium">
                                  排序权重
                              </p>
                          </div>
                          <input id="iptSysScore" type="text" value = {sysScore}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                              onChange={(e) => setSysScore(e.target.value? parseInt(e.target.value) : 0)} />
                      </div>
                   
                  </>
                  )}
    
                  <div className="mt-4 w-full max-w-lg">
                      <div className="flex mt-6 w-96 items-center space-x-3">
                          <p className="text-left font-medium">
                            应用简介(可选)
                          </p>
                      </div>
                      <TextareaAutosize value={desc}   style={{ borderRadius: "8px" }}  
                          className="bg-slate-800 rounded-full w-full text-gray-100 border-gray-600 font-medium px-4 py-2 sm:mt-0 mt-2 h-16" 
                          onChange={(e) => setDesc(e.target.value)} />    
                  </div>                               
    
                    {isAdmin && (
                 <div className="space-y-4 w-full max-w-lg">
                    <div className="flex mt-3 items-center space-x-3">
                        <p className="text-left font-medium">
                          {"每次运行价格"}（{ config.creditName }数）
                        </p>
                    </div>
                    <input id="iptPrice" type="text" value = {price} 
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                    onChange={ (e) => setPrice( e.target.value? parseInt(e.target.value) : 0) } />
                  </div>
                   )}
                    
                  <div className="space-y-4 w-full max-w-lg">
                    <div className="flex mt-3 items-center space-x-3">
                        <p className="text-left font-medium">
                          给提示词应用设定一个封面
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
                      
                      <ComboSelector onSelect = {(newFile) => setCoverImg(newFile)} selectorType="PROMPT_COVER" selectorCode={prompt.code} />                       
                  </div>
                  
                  <div className="space-x-8 flex flex-row justify-center w-full max-w-lg">
                  
                     <button
                      onClick={() => {
                        updatePrompt("PRIVATE");
                      }}
                      className=" px-4 py-2 mt-8 button-main"
                    >
                      私人使用
                    </button>                     
    
                     <button
                      onClick={() => {
                        updatePrompt("PUBLIC");
                      }}
                      className=" px-4 py-2 mt-8 button-main"
                    >
                      公开发布
                    </button>   
                      
                  </div>                  
    
                </>
              )}
    
    
            </div>
        
          </main>
    
    </TopFrame>
  );

  }else{
    return( <LoginPage config={config}/> );
  }
  
};

// export default Home;
