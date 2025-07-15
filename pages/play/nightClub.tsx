import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { UploadDropzone } from "react-uploader";
import { Uploader, UploadWidgetLocale } from "uploader";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";

import { authOptions } from "../../pages/api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { Prompt, Model, Room, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { showPrompt, showModel} from "../../components/Genhis";
import Image from "../../components/wrapper/Image";




export default function nightClub({ pointer, creations }: {  pointer: number, creations: Creation[] }) {

  const [loading, setLoading] = useState<boolean>(false);
  const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, mutate } = useSWR("/api/remaining", fetcher);
  const { data: session, status } = useSession();

//  const channelDesc = "今天新来了几个，你看看有喜欢的吗";
  const channelDesc = "别再刷美女视频了，一起来学点AI吧";
    
  return (
    <div className="flex flex-col items-center min-h-screen bg-nightclub">
      <Head>
        <title>AI夜总会</title>
          <meta property="og:description" content={channelDesc} /> 
          <meta property="og:title" content={"AI夜总会"} />
          <meta property="og:image" content={ "https://fileserver.aiputi.cn/channel/NIGHTCLUB.jpg" } />    
          <meta name="description" content={channelDesc} />        
      </Head>
 
      
      <main className="flex flex-1 w-full flex-col items-center text-center px-0 sm:px-4 mt-2 sm:mb-0 mb-4">
        <h1 className="mx-auto max-w-4xl font-display text-3xl font-bold tracking-normal text-black-100 sm:text-3xl mb-1">
          看看今天新来的
        </h1>

        
        <ResizablePanel>
          <AnimatePresence mode="wait">
            <motion.div className="flex justify-between items-center w-full flex-col ">
        
        <div className="items-center w-full sm:pt-2 pt-1 mt-0 sm:mt-5 flex sm:flex-row px-1 space-y-3 sm:mb-0 mb-1">
          <div className="flex flex-row flex-col space-y-5 mt-2 mb-2 pt-2 rounded-xl items-center w-full space-x-2">

                      <div className="grid grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-4 items-center">

                        {creations.map((m) => (
                           
                            m.type == "Model" && m.model ? ( showModel(m.model) ) : 
                                    ( m.type == "Prompt" && m.prompt ? showPrompt(m.prompt) : "" )
                          
                        ))}
                      </div>
          </div>
        </div>        
                   <button 
             onClick={() => {
                window.scrollTo(0, 0);
                window.location.href="/play/nightClub?pointer=" + pointer;
              }}
              className= " px-10 py-2 mt-0 button-gold "
            >
            换一批...
          </button>     
              </motion.div>
          </AnimatePresence>
        </ResizablePanel>
        
       </main>
  

    </div>
  );
};


export type Creation = {
  createTime: Date;
  type: string;
  id: string;
  sysScore: number;
    
  model?: Model;
  prompt?: Prompt;  
};
    
    
export async function getServerSideProps(ctx: any) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const isLogin = session && session.user  && session.user.email ? true : false;
  const channel = ctx.query.channel;

   // 每页显示的图片数量
  const imgPerPage = 4;
  let pointer = parseInt(ctx?.query?.pointer || '0', 10);      
    
  let prompts = await prisma.prompt.findMany({
    where: {
//        access: "PUBLIC",
        status: "FINISH",
        OR:[
            {name: "穿紧身衣的女人",},         
            {name: "穿绿裙子的女人",},
            {name: "穿日本武士服的亚洲女性",},         
            {name: "神似Lora的女人",},
            {name: "漂亮的美国女人",},         
            {name: "日本女武士",},
            {name: "动感美女",},         
            {name: "穿紧身衣的女人(梦幻版)",},    
            {name: "女巫Elsa",},         
            {name: "瘦瘦的韩国女孩",},    
            {name: "韩国美女",},         
            {name: "健身女友",},    
            {name: "美丽的健身女孩",},         
            {name: "杨敏敏",},          
           ],
    },
    orderBy: [
        { sysScore: 'desc', },
        { createTime: 'desc', },       
      ] ,

  });

    
   let myModels = await prisma.model.findMany({
    where: {
        func: "lora",
//        access: "PUBLIC",
        status: "FINISH",
        OR:[
            {name: "曾相遇",},         
            {name: "混合明星脸",},
            {name: "混血美女",},         
            {name: "cutegirl_v1",},
            {name: "亚洲模特脸",},         
            {name: "我的完美女神",},
           ],
  
    },
    orderBy:     
     [
        { sysScore: 'desc', },
        { createTime: 'desc', },       
     
      ],
  });
    
   // @ts-ignore
   let temp : Creation[] = [];
   // @ts-ignore
   let creations : Creation[] = [];
    
  prompts.map((p) => (
    temp.push({
      createTime: p.createTime,
      type: "Prompt",
      id: p.id,
      prompt: p,
      sysScore: p.sysScore,
    })
    
  ));
  
    
  myModels.map((m) => (
    
    temp.push({
      createTime: m.createTime,
      type: "Model",
      id: m.id,
      model: m,
      sysScore: m.sysScore,
    })
    
  ));
    
  temp.sort(function(x:Creation, y:Creation){
    
    return x.sysScore < y.sysScore ? 1 : -1;
    
  });

  if( (pointer + imgPerPage) >= temp.length ){
    creations = temp.slice(pointer, temp.length);
    pointer = 0;  // 回到第一页
  }else{
    creations = temp.slice(pointer, pointer+imgPerPage);
    pointer += imgPerPage;
  }

  for (let i = 0; i < creations.length; i++) {
    let m = creations[i];
    if(m.type == "Prompt"){ 
     // @ts-ignore
     m.prompt.name = (i + 1) + "号：" + m.prompt.name;
    }else if(m.type == "Model"){
     // @ts-ignore
     m.model.name = (i + 1) + "号：" + m.model.name;
    }
  }
    
  return {
    props: {
      pointer,
      creations,
    },
  };

  
}      
