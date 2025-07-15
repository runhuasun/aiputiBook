import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Link from "next/link";
import Head from "next/head";
import { useState } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import { Room, Prompt, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { Toaster, toast } from "react-hot-toast";

import { GenerateResponseData } from "../api/generate";
import { authOptions } from "../../pages/api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";

import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import Genhis  from "../../components/Genhis";
import {publicRoom} from "../../components/Genhis";
import LoginPage from "../../components/LoginPage";
import Image from "../../components/wrapper/Image";

import * as ru from "../../utils/restUtils";
import {hasSensitiveWord} from "../../utils/sensitiveWords";
import { config } from "../../utils/config";
import {parseParams, replaceParam, replaceKeyValues, checkSyntax} from "../../utils/formularTools";


export async function getServerSideProps(ctx: any) {
    return {
     props:{ 
       config
     }
    };
  
}

export default function manghe({ config }: { config:any }) {
  
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, mutate } = useSWR("/api/remaining", fetcher);
  const { data: session, status } = useSession();
 
  
  const router = useRouter();
  let tizi = router.query.price;

  async function share(){
    // 检查浏览器是否支持Web Share API
    if (navigator.share) {
      try {
        // 调用navigator.share()方法并传入要分享的数据
        const u = "/mangheShare?roomId=" + restoredId + (data.currentUserId? ("&inviteBy=" + data.currentUserId) : "");
        await navigator.share({
          title: "大家一起拆AI盲盒",
          text: "看看我在AI盲盒里拆到的惊喜",
          url: u,
        });
      } catch (error) {
        // 如果分享失败，打印一个错误
        console.error("Share failed", error);
      }
    } else {
      // 如果浏览器不支持Web Share API，打印一个警告
      alert('请点击右上角浏览器的"..." 按钮，通过浏览器分享。');
    }
    
  }
    

  
  type Box = {
    want: string;
    call: {func:string, model:string, theme:string, formular:string }[];
    prompt: string[];
  };
    
  const hotBoxes:Box[] = [
    {
      want: "看到女神", 
      call: [ 
              {func: "lora", model:"cengxiangyu_v1", theme:"FACE", formular:""},
              {func: "lora", model:"混合明星脸", theme:"FACE", formular:""},
              {func: "lora", model:"成熟点的动漫风", theme:"FACE", formular:""},
              {func: "lora", model:"mixgirl", theme:"FACE", formular:""},
              {func: "lora", model:"我的完美女神", theme:"FACE", formular:""},
              {func: "realistic", model:"no model", theme:"", formular:" [内容:一个美女] "},
              {func: "realistic", model:"no model", theme:"", formular:"angelina jolie dressed as lara croft, gorgeous, attractive, flirting, old ruins in background,[动作:看着我], (((full body visible))), looking at viewer, portrait, photography, detailed skin, realistic, photo-realistic, 8k, highly detailed, full length frame, High detail RAW color art, piercing, diffused soft lighting, shallow depth of field, sharp focus, hyperrealism, cinematic lighting "},
              {func: "realistic", model:"no model", theme:"", formular:"female dressed in latex suit, gorgeous, attractive, ((flirting)), (((full body visible))), looking at viewer, portrait, photography, detailed skin, realistic, photo-realistic, 8k, highly detailed, full length frame, High detail RAW color art, piercing, diffused soft lighting, shallow depth of field, sharp focus, hyperrealism, cinematic lighting"},
    
              {func: "realistic", model:"no model", theme:"", formular:" female dressed as samurai, gorgeous, attractive, flirting, (((full body visible))), looking at viewer, portrait, photography, detailed skin, realistic, photo-realistic, 8k, highly detailed, full length frame, High detail RAW color art, piercing, diffused soft lighting, shallow depth of field, sharp focus, hyperrealism, cinematic lighting"},
              {func: "dreamshaper", model:"我的完美女神", theme:"FACE", formular:"Belle, Average Height, Toned, Diamond-Shaped Face, Olive Skin, Chestnut Hair, black Eyes, Long Nose, Full Lips, Round Chin, Shoulder-Length Hair, Wavy Hair, Voluminous Waves, perky breasts, Clip-on earrings, orange gloss lipstick, Brown Strappy Bodysuit, rooftop terrace, [其它要求: 看着我], rim light, incandescent"},
              {func: "dreamshaper", model:"Dreamshaper Demo", theme:"FACE", formular:"NAOMI SCOTT, messy hair, small body,  warrior princess cosplay, full body, jewelry set balayage, brown hair, royal vibe, [什么要求:手持长剑], UHD, 8K, Very Detail. cave, masterpiece. portrait, happy face"},

            ], 
      prompt: [
               "一个美女穿婚纱站在我面前",
               "一个美女手捧鲜花朝我微笑",
               "一个美女黑色晚礼服在酒吧喝酒",
               "一个美女穿和服走在樱花树下",
               "一个美女穿汉服走在海边",
               "一个美女在巴黎街头散步",   
               "一个美女穿连衣裙走在沙滩上",
             ],
   },
    {
      want: "偶遇男神", 
      call: [ 
              {func: "lora", model:"PT Boy", theme:"FACE", formular:""},
              {func: "realistic", model:"no model", theme:"", formular:""},
            ], 
      prompt: [
               "一个高大帅气的男生，脸型刚毅，穿西装打领带，迎面走来",
               "一个高大帅气的男生，脸型刚毅，穿白色衬衣，朝我微笑",
               "一个高大帅气的男生，脸型刚毅，穿运动装，和我撞了个满怀",
               "一个高大帅气的男生，在打排球",
               "一个高大帅气的男生，在海边看日出",
               "一个高大帅气的男生，走在校园里",
             ],
   },  
    {
      want: "梦想豪宅", 
      call: [ 
              {func: "realistic", model:"no model", theme:"", formular:""},
            ], 
      prompt: [
               "Residential home high end futuristic interior, olson kundig::1 Interior Design by Dorothy Draper, maison de verre, axel vervoordt::2 award winning photography of an indoor-outdoor [什么空间:厨房] space, minimalist modern designs::1 high end indoor/outdoor residential living space, rendered in vray, rendered in octane, rendered in unreal engine, architectural photography, photorealism, featured in dezeen, cristobal palma::2.5 chaparral landscape outside, black surfaces/textures for furnishings in outdoor space::1 –q 2 –ar 4:7",
               "Interior Design, a perspective of of a study, large windows with natural light, light colors, plants, modern furniture, modernist, modern interior design",
               "new architecture that becomes popular in 2050",
               "A modern living room with a beautiful white marble table between 2 white sofas ,on the left of the living room there are floor to ceiling glass window and on the right of the living room there are wooden stairs to the second floor, 8k resolution, professional interior design photograph",
               "Small villa with veranda. A small lake. A Northern European Forest. Sunset. perfect composition, hyper realistic, super detailed, 8k, high quality, trending art, trending on artstation, sharp focus, studio photo, intricate details, highly detailed",
             ],
   },  
    {
      want: "我的新车", 
      call: [ 
              {func: "laion", model:"no model", theme:"", formular:" 设计一辆三层的房车，顶层是个大露台, [其它要求:行驶在公路上]"},
              {func: "realistic", model:"no model", theme:"", formular:" 一辆跑车, [其它要求:行驶在公路上]"},
    
              {func: "lora", model:"理想One的模型", theme:"OBJECT", formular:""},
              {func: "lora", model:"小牛电动MQi", theme:"OBJECT", formular:""},

            ], 
      prompt: [
               "行驶在公路上",
               "行驶在森林里",
               "行驶在校园里",
               "行驶在沙漠里",
               "行驶在水面上",
             ],
   },      
    {
      want: "可爱萌宠", 
      call: [ 
              {func: "lora", model:"小区的黑白猫", theme:"OBJECT", formular:""},
              {func: "lora", model:"熊猫萌兰", theme:"OBJECT", formular:""},
              {func: "realistic", model:"狗狗", theme:"OBJECT", formular:"a cute dog [在干什么:在路上发呆]"},
    
              {func: "MidJourney-V4", model:"no model", theme:"", formular:"Cute small cat [在哪: 坐在电影院] [在干啥: 吃鸡翅看电影]  , unreal engine, cozy indoor lighting, artstation, detailed, digital painting,cinematic,character design by mark ryden and pixar and hayao miyazaki, unreal 5, daz, hyperrealistic, octane render"},
            ], 
      prompt: [
               "在草地上晒太阳",
               "在巴黎铁塔",
               "在吃肉",
               "坐在沙发上看电视",
               "坐在电影院里吃爆米花",
               "在路上发呆",
             ],
   }, 
    {
      want: "专属玩偶", 
      call: [ 
              {func: "lora", model:"可爱的玩偶形象V1.2", theme:"OBJECT", formular:""},
              {func: "lora", model:"可爱玩偶 Emma", theme:"OBJECT", formular:""},
    
            ], 
      prompt: [
               "a comic doll, cartoon style",
             ],
   },          
    {
      want: "吃点啥", 
      call: [ 
              {func: "laion", model:"no model", theme:"", formular:"A professional food photo of [食物名字:牛排] on a dish, on a wooden table, overhead. centered.  20% negative space on all sides. minimalist style. centered: 1"},
              {func: "realistic", model:"no model", theme:"", formular:" a red lobster "},
              {func: "realistic", model:"no model", theme:"", formular:" delicious food "},
              {func: "lora", model:"麻辣火锅", theme:"STYLE", formular:""},

            ], 
      prompt: [
               "羊排",
               "牛排和红酒",
               "火锅",
               "薯条",
               "华夫饼",
               "凯撒沙拉",
               "汉堡和薯条",
               "蛋炒饭",
               "牛肉面",
             ],
   }, 
    {
      want: "遇见心佛", 
      call: [ 
              {func: "lora", model:"fozu_v1", theme:"FACE", formular:""},
            ], 
      prompt: [
               "一尊佛在云中静坐，微笑",
               "一尊佛坐在山上，图片中间",
               "一尊佛 sit in meditation",
               "一尊佛在庄严的庙宇中",
               "一尊佛坐在竹林中",
               "一尊佛坐在水面上",
               "一尊佛坐在灵鹫山上",
               "一尊佛坐在灵鹫山上，夕阳西下",
               "一尊佛静坐在云端",
             ],
   },  
    {
      want: "偶遇财神", 
      call: [ 
              {func: "lora", model:"财神到", theme:"STYLE", formular:""},
            ], 
      prompt: [
               "财神骑摩托车",
               "财神在淄博吃烧烤",
               "财神在西安街头逛街",
               "财神在开拖拉机",
               "财神在滑雪",
               "财神在巴黎街头",
               "财神手捧鲜花",
               "财神在跳舞",
               "财神在树林里",
               "财神在喝酒",
             ],
   },       
 ];

 const [boxChoice, setBoxChoice] = useState<Box>(hotBoxes[0]);

    
    
  async function openBox(){
    if(boxChoice == null){
      alert("请先告诉我你要什么样的盲盒好吗？");
      return;
    }
    const calls = boxChoice.call.length;
    const prompts = boxChoice.prompt.length;
    const randomCall = Math.floor(Math.random() * (calls-1));
    const randomPrompt = Math.floor(Math.random() * (prompts-1));
    
    await generatePhoto(boxChoice.call[randomCall].func, boxChoice.call[randomCall].model, boxChoice.call[randomCall].theme, boxChoice.prompt[randomPrompt], boxChoice.call[randomCall].formular);
    
      
  }
    
    
  async function generatePhoto(func:string, model:string, theme:string, prompt:string, formular:string) {
    
    let realText = prompt;
    
    if(model != "lora" && formular.trim() != ""){
      realText = formular;
   
      const params = parseParams(formular);

      if(params.length >0){
        realText = replaceParam(realText, params[0][0], prompt);
      }
      if(params.length >1){
        realText = replaceParam(realText, params[1][0], " ");
      }
      if(params.length >2){
        realText = replaceParam(realText, params[2][0], " ");
      }    
    }
    
    setError(null);
 
    await new Promise((resolve) => setTimeout(resolve, 200));
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl:"", theme:"", room:"", realText:realText, inputText: prompt, func:func, modelurl:model, modelTheme:theme, price: 10 , access:"PRIVATE"}), // 目前提示词实验室每次收费2，图片缺省隐藏
    });

    let response = (await res.json()) as GenerateResponseData;
    if (res.status !== 200) {
      setError(response as any);
    } else {
      mutate();
      setRestoredImage(response.generated);
      setRestoredId(response.genRoomId);   
    }
    setTimeout(() => {
      setLoading(false);
    }, 1300);
  }


  if(status == "authenticated"){
  
  return (
    <div className="flex mx-auto flex-col items-center justify-center min-h-screen bg-gifts ">
      <Head>
        <title>一起拆AI盲盒</title>
          <meta property="og:description" content={"看看我在AI盲盒里拆到的惊喜！"} /> 
          <meta property="og:title" content="一起拆AI盲盒" />
          <meta property="og:image" content={restoredImage? restoredImage : "https://fileserver.aiputi.cn/icon/gifts-icon.jpg"} />    
          <meta name="description" content={"看看我在AI盲盒里拆到的惊喜！"} />        
      </Head>
      <Header config={config}/>
      
      <main>
      {restoredImage ? (
        
       <div className = "text-white rounded-2xl bg-black opacity-80  py-5 px-2 w-4/5">
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold tracking-normal text-white sm:text-4xl mb-4">
            我的<span className="text-main">AI盲盒</span>礼物
          </h1>
       </div>

         ) : (
        
       <div className = "text-white rounded-2xl bg-black opacity-80  py-5 px-2 w-4/5">
        
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold tracking-normal text-white sm:text-4xl mb-4">
            猜猜<span className="text-main">AI盲盒</span>里有啥?
          </h1>
          <p className=" sm:px-2 px-1 sm:py-2 py-1">
          选择今日份的愿望，开出独一无二的惊喜！
          </p>
         
        </div>
      )}
        
            <div className="flex justify-between items-center w-full flex-col mt-1">
                  <div className="space-y-4 w-full mb-5">
                      <div className="w-full flex flex-wrap space-x-2  justify-center">
                      { !restoredImage && hotBoxes && hotBoxes.map((box) => (
                        <button className={box.want == boxChoice.want ? 'button-main px-4 py-2 mb-4 text-lg' : 'button-dark px-4 py-2 mb-4 text-lg'}    
                                onClick={() => {
                                  setBoxChoice( box );
                                }} 
                        >
                          {box.want}
                        </button>
                      ))}                        
                      </div>
                  </div> 
              
              {loading ? (
                <div className= "flex flex-col items-center ">
                  <button
                    disabled
                          className="button-main w-4/5 rounded-full text-white text-lg px-4 py-2 mt-4 mb-5"
                  >
                    <span className="pt-4">
                      <LoadingDots color="white" style="large" />
                    </span>
                  </button>
                  <div  className="text-white bg-black opacity-80 px-2 py-2 w-4/5">
                         拆开盲盒需要10-30秒，请默念心中愿望。开呀！开呀！开呀...... 
                  </div>
                 </div>
              ):(
                <div className= "flex flex-col items-center">
                    {!restoredImage && (
                        <button
                        onClick={() => {
                            openBox();
                          }}
                          className="button-gold w-4/5 rounded-full text-white text-lg px-4 py-2 mt-4 mb-5"
                        >
                        拆开我的AI盲盒
                      </button>    
                  )}                  
                    {status === "authenticated" && data && !restoredImage && (
                      <p className="text-white bg-black opacity-80 px-2 py-2">
                        拆盲盒每次需要2-10颗幸运提子，
                        <span className="font-semibold text-gray-200">
                          你还有{data.remainingGenerations}颗提子。
                        </span>
                        {data.remainingGenerations < 10 && (
                          <>
                            <span>
                              购买更多提子
                              <Link
                                href="/buy-credits"
                                className="font-semibold text-gray-100 underline underline-offset-2 hover:text-gray-200 transition" >
                                在这里
                              </Link>
                            </span>
                          </>
                        )}
                      </p>
                    )}     
                  
                </div>
              )
              }

              
               {restoredImage && restoredId && (
               <>
              
                <div className="flex sm:space-x-4 sm:flex-row flex-col pt-0">
                  <div className="sm:mt-0 mt-0">
                     <Link href={ru.getImageRest(restoredId)} target="_blank">
                        <Image
                          alt="restored photo"
                          src={restoredImage}
                          className=" relative sm:mt-0 mt-0"
                          width={768}
                          height={768}
                          onLoadingComplete={() => setRestoredLoaded(true)}
                        />
                    </Link>   
                    
                    <div className="flex space-x-8 justify-center">
                       
                      <button
                        onClick={() => {
                          share();
                        }}
                        className="button-main rounded-full text-lg text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                      >
                        分享朋友(得提子)
                      </button>  

                      <button
                        onClick={() => {
                          window.location.reload();
                        }}
                        className="button-main rounded-full text-lg text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                      >
                        再拆一个盲盒
                      </button>  
                      
                    </div>
                  </div>
                </div>
              
               </>
              )}

              {error && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]"
                  role="alert"
                >
                  <div className="bg-green-500 text-white font-bold rounded-t px-4 py-2">
                    操作提示
                  </div>
                  <div className="border border-t-0 border-green-400 rounded-b bg-green-100 px-4 py-3 text-gray-700">
                    {error}
                  </div>
                </div>
              )}
             </div>

        <Toaster position="top-center" reverseOrder={false} />

      </main>
    </div>
  );
    
 }else{
    return(
      <LoginPage config={config}/>
        );
  }    
};


