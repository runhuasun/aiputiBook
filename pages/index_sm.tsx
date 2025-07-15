
import Head from "next/head";
import Header from "../components/Header";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Footer from "../components/Footer";
import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";
import { RoomGeneration } from "../components/RoomGenerator";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import Image from "../components/wrapper/Image";
import SquigglyLines from "../components/SquigglyLines";
import { useEffect, useState } from "react";
import {showRoom} from "../components/Genhis";
import { Testimonials } from "../components/Testimonials";
import { useRouter } from "next/router";
import React from 'react';
import { config } from "../utils/config";

import * as monitor from "../utils/monitor";


export default function index( { rooms, imageAmount, pointer, config }: {rooms: (Room & { user: User; })[] , imageAmount:number, pointer: number, config: any} ) {
  const { data: session } = useSession();

  const router = useRouter();
  const preWord = router.query.word as string;
  const [word, setWord] = useState<string>(preWord ? preWord : "");

  const [currentIndex, setCurrentIndex] = useState(0);
  const imageUrls = [
//    'https://upcdn.io/kW15bC3/raw/U/2023/06/06/2JtcUa.png',
//    [`${config.RS}/index/prompt.jpg`, '免费的提示词分享社区', '让每个人都成为AI艺术家', '#newArts'],
    [`${config.RS}/index/model8.jpg`, '特劳特经典丛书', '语言小模型，经管，2023', '/chatbot?model=clop5cbbi07qqku7gv1dikgcv'],
    [`${config.RS}/index/model9.jpg`, '英国皇家园艺学会', '语言小模型，园艺，2023', '/chatbot?model=clnzhs00d07epkux2uvkby5qp'],
    [`${config.RS}/index/model10.jpg`, '法国蓝带西餐烹饪', '语言小模型，美食，2023', '/chatbot?model=clo04l8d500knkutdussjuh1w'],    

    [`${config.RS}/index/model4.jpg`, '人物写真案例', '图像小模型，人物，2023', '/lora?price=20&model=cutegirl_v1'],
    [`${config.RS}/index/model2.jpg`, '木屋广告案例', '图像小模型，建筑，2023', '/lora?price=10&model=木屋设计师'],
    [`${config.RS}/index/model3.jpg`, '敦煌艺术案例', '图像小模型，艺术，2023', '/lora?price=10&model=敦煌飞天模拟V1.0'],
    [`${config.RS}/index/model1.jpg`, '汽车广告案例', '图像小模型，汽车，2023', '/lora?price=10&model=理想One的模型'],
//    [`${config.RS}/index/model5_2.jpg`, '法律咨询案例', '语言小模型，法律，2023', '/chatbot?model=cljkup5vm0005kurugyfuus8g'],
//    [`${config.RS}/index/model6_1.jpg`, '长文本阅读处理', '语言小模型，长文本，2023', '/dealLongText'],       
  ]; // 图片数组

useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((currentIndex + 1) % imageUrls.length);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [currentIndex, imageUrls.length]);


  return (
    <div className="flex mx-auto w-full flex-col items-center justify-center min-h-screen">

      <Header config={config} noMargin={true} />      
      <div className="relative w-full text-left items-left text-white text-3xl sm:block  hidden" >
         <Image
            alt="AI作品"
            src={imageUrls[currentIndex][0]}
            className=" object-cover w-full shadow-dark-corners"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black to-transparent mix-blend-multiply dark-corners"></div>

        <Link className="absolute bottom-0 left-0 mb-40 space-y-5"
            href={imageUrls[currentIndex][3]}
          >
          <p className="px-10 text-5xl text-left  font-display font-bold">
            “{imageUrls[currentIndex][1]}”
          </p>
          <p className="px-10 mt-2 text-1xl text-left  font-display ">
            —— {imageUrls[currentIndex][2]}
          </p>    
        </Link>
      </div>
      
      
      <main className="mt-10 sm:mt-0 sm:bg-gray-100">
       <span className="text-xl sm:text-4xl font-display font-bold tracking-normal text-gray-500 mt-10 sm:mt-20 mb-0">
       “只要有数据，你也可以训练自己的AI模型”
       </span>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 sm:mt-12 mb-5 pb-4">
          <Link className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href="/createLoRA">
            <span
             className="sm:text-gray-700 sm:text-2xl px-5 py-2"
             >
                训练AI图像小模型
            </span>            
            
            <div className="flex space-x-2 flex-row ">
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Original photo"
                  src="https://fileserver.aiputi.cn/demo/model_in.jpg"
                  className="object-cover rounded-2xl"
                  width={512}
                  height={512}
                />
              </div>
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Generated photo"
                  width={512}
                  height={512}
                  src="https://fileserver.aiputi.cn/demo/model_out.jpg"
                  className="object-cover rounded-2xl"
                />
              </div>
            </div>
          </Link>
         
          <Link className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center" href="/createChatModel">
            <span
             className="sm:text-gray-700 sm:text-2xl px-5 py-2"
             >
                训练AI语言小模型
            </span>            
            
            <div className="flex space-x-2 flex-row ">
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Original photo"
                  src="https://fileserver.aiputi.cn/demo/chatmodel_in.jpg"
                  className="object-cover rounded-2xl"
                  width={512}
                  height={512}
                />
              </div>
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Generated photo"
                  width={512}
                  height={512}
                  src="https://fileserver.aiputi.cn/demo/chatmodel_out.jpg"
                  className="object-cover rounded-2xl"
                />
              </div>
            </div>
          </Link>
        </div>

       <span className="text-xl sm:text-4xl font-display font-bold tracking-normal text-gray-500 mt-10 sm:mt-20 mb-0">
       “扫码关注以下公众号应用，体验AI小模型”
       </span>
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 sm:mt-12 mb-5 pb-4">
           <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
               <span className="sm:text-gray-700 sm:text-2xl px-5 py-2">
                AI菩提（通用模型）
               </span>            
       
               <div className="flex space-x-2 flex-row ">
                   <div className="sm:mt-0 mt-1">
                       <Image
                          alt="Original photo"
                          src="https://fileserver.aiputi.cn/QR/aiputi.jpg"
                          className="object-cover rounded-2xl"
                          width={512}
                          height={512}
                        />
                   </div>
               </div>
           </div>
           <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
               <span className="sm:text-gray-700 sm:text-2xl px-5 py-2">
                AI凡提（法律咨询）
               </span>            
       
               <div className="flex space-x-2 flex-row ">           
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Generated photo"
                  width={512}
                  height={512}
                  src="https://fileserver.aiputi.cn/QR/aifanti.jpg"
                  className="object-cover rounded-2xl"
                />
              </div>
            </div>
          </div>
           <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
               <span className="sm:text-gray-700 sm:text-2xl px-5 py-2">
                海玩旅行助手
               </span>            
       
               <div className="flex space-x-2 flex-row ">
                   <div className="sm:mt-0 mt-1">
                       <Image
                          alt="Original photo"
                          src="https://fileserver.aiputi.cn/QR/haiwan.jpg"
                          className="object-cover rounded-2xl"
                          width={512}
                          height={512}
                        />
                   </div>
               </div>
           </div>
           <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
               <span className="sm:text-gray-700 sm:text-2xl px-5 py-2">
                AI小提（儿童启蒙）
               </span>            
       
               <div className="flex space-x-2 flex-row ">           
              <div className="sm:mt-0 mt-1">
                <Image
                  alt="Generated photo"
                  width={512}
                  height={512}
                  src="https://fileserver.aiputi.cn/QR/aixiaoti.jpg"
                  className="object-cover rounded-2xl"
                />
              </div>
            </div>
          </div>         

        </div>

     
        
      <Testimonials />
        
      </main>
      <Footer />
    </div>
  );
}


export async function getServerSideProps(ctx: any) {
  monitor.logUserRequest(ctx);
  
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

   // 每页显示的图片数量
  const imgPerPage = 24;
    
  // 从 Cookie 中获取 pointer 值
  let pointer = parseInt(ctx?.query?.pointer || '0', 10);  

  // 230521:加入搜索
  // "prompt" like '%熊猫%' or "model" like '%熊猫%' or "func" like '%熊猫%'
  let search:{}[] = [{access: "PUBLIC"}];
  let word = ctx?.query?.word;
  if(word){
    search = [
      {access: "PUBLIC", prompt: { contains: word } }, 
      {access: "PUBLIC", model: { contains: word } },
      {access: "PUBLIC", func: { contains: word } },
      ];
  }
      
  let rooms = await prisma.room.findMany({
    where: {
      status: "SUCCESS", 
      OR: search,
      sysScore:  {
             gt: (word && word.length >0) ? 1 : 2  // 3分以下的不显示在首页
            },
      NOT:{
        func: {
          in: ["zoomIn", "changeBG", "removeBG", "deco", "draft", "garden", "photo2cartoon"], // 会产生异形照片的不放进去
        }
      },
    },
    orderBy: [
      {
        sysScore: 'desc',
      },
      {
        createdAt: 'desc',
      },      
    ],
    skip: pointer,
    take: imgPerPage,
    include: {
      user:true,

    },
  });

  // 设置新的 pointer 值
  // const newPointer = rooms.length<imgPerPage ? 0: (pointer + imgPerPage);
  pointer = rooms.length<imgPerPage ? 0: (pointer + imgPerPage);
      
  // 更新 Cookie 中的 pointer 值
  // ctx.res.setHeader('Set-Cookie', `pointer=${newPointer}`);

 // 打乱内容的顺序，防止连续生成的图片在一起                                     
 if(rooms && rooms.length > 0){ 
   rooms.sort(() => Math.random() - 0.5);
 }

 const imageAmount = await prisma.room.count();
      
  return {
    props: {
      rooms,
      imageAmount,
      pointer,
      config
    },
  };

}


/*        
      <div id="newArts" className="flex flex-col w-full bg-black py-10 items-center">
        <h1 className="mx-auto max-w-4xl font-display text-3xl py-2 sm:mt-5 text-white mb:50 sm:text-4xl background-gradient">
          看看
          <span className="relative whitespace-nowrap text-white ">
            <SquigglyLines />
            AI艺术家们
          </span>的新作品
     
        </h1>     
        
        <div className="w-full sm:w-1/2 flow flow-row items-center justify-center">
             <input id="iptWord" type="text" value = {word}
                      placeholder = {"这里有" + imageAmount + "幅AI作品！输入你要搜索的内容"}
                    className="bg-black rounded-2xl mx-3 sm:mx-0 text-gray-200 hover:text-black border border-gray-300 hover:border-green-500 font-medium px-4 py-2 hover:bg-gray-100 transition sm:mt-4 mt-8 w-full h-12" 
                    onChange={(e) => setWord(e.target.value)} />
           
             <div className="flow flow-row items-center justify-center mt-8 space-x-4">
                 <button 
                     onClick={() => {
                        if(word && word.length>0){
                          window.location.href="/?word=" + word + "&pointer=0";
                        }else{
                          alert("请先输入你想搜索的内容");
                        }
                      }}
                      className=" px-6 sm:px-8 py-2 button-gold rounded-2xl"
                    >
                    搜索AI作品
                </button>     
               <button 
                 onClick={() => {
                    window.location.href="/createPrompt" + ((word && word.trim().length>0) ? "?prompt="+word : "");
                  }}
                  className=" px-6 sm:px-8 py-2 button-gold rounded-full"
                >
                  创作AI作品
              </button>                    
           </div>
         </div>        
        <div className="grid grid-flow-row-dense grid-cols-2 sm:grid-cols-6 gap-3 py-10" >

          {rooms && rooms.map((img) => (
            showRoom(img, "", "SHOW_TITLE")   
          ))} 
          
        </div>
        
           <button 
             onClick={() => {
                window.scrollTo(0, 0);
                window.location.href="/?pointer=" + pointer + ( word && word.length>0 ? ("&word=" + word ) : "") + "#newArts";
              }}
              className= { pointer == 0 ? " hidden " : " px-8 py-2 mt-8 button-gold " }
            >
            继续查看更多...
          </button>     
      </div>  

*/
