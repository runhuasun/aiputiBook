import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room, Model, User } from "@prisma/client";

import { LLMCodes, LLMNames, getLLMByBaseModel, getLLMByCode } from "../ai/AIServiceList";
import { channelType, channels, channelNames } from "../utils/channels";
import { bookLabels, portraitLabels, pldSites } from "../utils/labels";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import TextareaAutosize from "react-textarea-autosize";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";

import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import { rooms, roomNames, roomMap, imageModels, supportRefImg } from "../utils/modelTypes";


//  {status === "authenticated" && data && !restoredImage && (
export type language =
  | "zh"
  | "en"
;

export const languages: language[] = [
  "zh",
  "en"
];

export const languageNames = new Map();
languageNames.set("zh","中文");
languageNames.set("en","英文");


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
  
    const code = ctx?.query?.model;
    const id = ctx?.query?.modelId;
  
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
    let model:any;
    if(code){
        model =  await prisma.model.findUnique({
            where: {
                code: code,
            },
        });  
    }
    if(id){
        model =  await prisma.model.findUnique({
            where: {
                id:id,
            },
        });  
    }        
  
    return {
        props: {
            model,
            config,
            user
        },
    };
}  



export default function publishModel({ model, config, user }: { model: Model, config: any, user: User }) {
  
  
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [price, setPrice] = useState(model?.price || 0);
    const [desc, setDesc] = useState(model?.desc || "");
    const [proMsg, setProMsg] = useState(model.proMsg || "");  
    const [coverImg, setCoverImg] = useState(model.coverImg || "");
    const [imgRecogHint, setImgRecogHint] = useState(model.imgRecogHint || "");
    const [baseModel, setBaseModel] = useState(model.baseModel || "");
  
    const llm = (model.func=="chat" && model.aiservice && model.baseModel) ? getLLMByBaseModel(model.aiservice, model.baseModel) : null;
    const [chatService, setChatService] = useState<string>(llm ? llm.code: "AIPUTI");
    const [language, setLanguage] = useState<language>(model?.language ? (model.language as language): "zh");
    const [channel, setChannel] = useState<string>(model?.channel as channelType || "BOOK");
    const [sysScore, setSysScore] = useState<number>(model?.sysScore || 0);
    const [labels, setLabels] = useState<string[]>(model?.labels ? model.labels.split("|") : []);
    const [temp, setTemp] = useState<string>("");
    const [name, setName] = useState<string>(model?.name || "无名");
    const [params, setParams] = useState<any>(model.params ? JSON.parse(model.params) : {});
    const [aPrompt, setAPrompt] = useState<string>(params?.aPrompt || "");
    const [nPrompt, setNPrompt] = useState<string>(params?.nPrompt || "");
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const isAdmin:boolean = (user && user.actors && user.actors.indexOf("admin")>=0) ? true : false;
    const [allLabels, setAllLabels] = useState<string[]>([]);
    const [introLabel, setIntroLabel] = useState<string>("简单介绍");
  
    function updateAllLabels(ch: string){
        switch(ch){
            case "FASHION":
                setAllLabels(portraitLabels.concat(pldSites));
                setIntroLabel("简单介绍（性别，年龄，身高，体重，肤色，发型等）");
                break;
            
            case "PORTRAIT":
                setAllLabels(portraitLabels.concat(pldSites));
                setIntroLabel("简单介绍（服装，化妆，道具，背景等）");            
                break;
            case "BOOK":
                setAllLabels(bookLabels);
                break;
            case "PLD":
                setAllLabels(pldSites);
            default:
                setAllLabels([]);
        }
    }

    useEffect( () => {
        updateAllLabels(channel);
    }, [channel]); 
        
    const router = useRouter();
    let minPrice = model.func=="lora" ? 10 : 1;
    
    async function publish(access?:string) {
        if(model.func == "chat"){
          const llm = getLLMByCode(chatService);
          if(llm){
              minPrice = llm.basePrice;
          }else{
              return alert("必须选择一个基座大模型");
          }
        }

        if(access == "PUBLIC" && !coverImg){
            return alert("如果希望公开发布，您必须先设置一个封面！");
        }
        
        if(labels && labels.includes("免费")){
            setPrice(0);
        }else if(price==null || price==0){
            if(!isAdmin){
                return alert("必须给模型定一个价格");
            }
        }else if(isNaN(price) || price < minPrice || price > 1000){
            if(!isAdmin){
                return alert(`使用${llm?.name || model?.name}的模型价格必须是一个介于${minPrice}到1000的整数！`);
            }
        }
        
        await new Promise((resolve) => setTimeout(resolve, 200));
        let labelStr = "";
        if(labels){
            for(const label of labels){
                if(labelStr){
                    labelStr += "|" + label;
                }else{
                    labelStr = label;
                }
            }
        }           

        if((model.func == "lora") && (model.channel == "PORTRAIT" || model.channel == "FASHION") && (!aPrompt || aPrompt.length<5)){
            if(!isAdmin){
              return alert("请用不少于5个字简单介绍一下模型，比如人物的外貌特征等。这将有利于AI更好的生成贴切的照片！");
            }
        }
        params.aPrompt = aPrompt.trim() ? aPrompt : "";
        params.nPrompt = nPrompt.trim() ? nPrompt : "";
        
        const res = await fetch("/api/updateModel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ modelId: model.id, name, price, imgRecogHint, access:(access?access:"PUBLIC"), proMsg, desc, coverImg, baseModel,
                                  chatService, language, channel, sysScore, labels:labelStr, params:JSON.stringify(params) }),
        });
        let response = (await res.json());
        if (res.status !== 200) {
            alert(JSON.stringify(response as any));
        } else {
            mutate();
            let seg = "CHATMODEL";
            switch(model.func){
                case "lora": seg = "IMGMODEL"; break;
                case "voice": seg = "VOICEMODEL"; break;
            }
            if(model.func == "lora"){
                if((channel || model.channel) == "PORTRAIT"){
                    window.location.href= "/takePhoto?model=" + model.code;
                }else{
                    window.location.href= "/lora?model=" + model.code;
                }
            }else{
                window.location.href= "/chatbot?model=" + model.id;
            }
        }
        setTimeout(() => {
            setLoading(false);
        }, 1300);


    }

  
  let num = 1;

  if(status == "authenticated"){
  return (
    <TopFrame config={config}>

      <main>
        <h1 className="title-main">
          设置 <span className="title-light">{model ? model.name : "出错啦！"}</span> 
        </h1>
        <div className="flex justify-between items-center w-full flex-col mt-4 max-w-xl">
          { (status === "authenticated") && ( // (model.theme != "myDefModel") && 
            <>

              <div className="space-y-4 w-full max-w-xl">
                  <FormLabel number={`${num++}`} label={`模型名称`}/>
                  <input id="iptImgRecogHint" type="text" value = {name}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                      onChange={(e) => setName(e.target.value)} />
              </div>                 

             {model.func == "chat" &&  isAdmin && (              

             <div className="space-y-4 w-full max-w-xl">
                 <FormLabel number={"A"} label={`基础大语言模型`}/>                 
                <DropDown 
                    theme={chatService}
                    // @ts-ignore
                    setTheme={(newTheme) => {
                        setChatService(newTheme);
                        const llm = getLLMByCode(newTheme);
                        if(llm && llm.basePrice > price){
                            setPrice(llm.basePrice);
                        }
                    }}
                    themes={LLMCodes}
                    names={LLMNames}
                    />
             </div>
              )}

              { model.func == "lora" && (
              <>
                  <div className="space-y-4 w-full max-w-xl">
                      <FormLabel number={`${num++}`} label={introLabel}/>                 
                      <input id="iptImgRecogHint" type="text" value = {aPrompt} placeholder="简介会让AI生成更准确。如：一位美女，身高165，卷发"
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                          onChange={(e) => setAPrompt(e.target.value)} />
                  </div>
                  <div className="space-y-4 w-full max-w-xl">
                      <FormLabel number={`${num++}`} label="不希望生成的内容（可选）"/>                 
                      <input id="iptImgRecogHint" type="text" value = {nPrompt}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                          onChange={(e) => setNPrompt(e.target.value)} />
                  </div>              
              </>                
              )}
              
              { model.func == "chat" && (              
              <div className="space-y-4 w-full max-w-xl">
                  <FormLabel number={`${num++}`} label="语料的主要语言"/>                 
                  <DropDown 
                    theme={language}
                    // @ts-ignore
                    setTheme={(newTheme) => setLanguage(newTheme)}
                    themes={languages}
                    names={languageNames}
                  />
              </div>
              
              )}

              { model.func == "chat" && (
               <div className="space-y-4 w-full max-w-xl">
                  <FormLabel number={`${num++}`} label="识别输入图片时的提示词"/>                 
                  <input id="iptImgRecogHint" type="text" value = {imgRecogHint}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                      onChange={(e) => setImgRecogHint(e.target.value)} />
              </div>
              )}
                
              { isAdmin && (              
              <>
                  <div className="space-y-4 w-full max-w-xl">
                      <FormLabel number={"A"} label="模型的主要频道"/>                 
                      <DropDown 
                          theme={channel}
                          // @ts-ignore
                          setTheme={ (newTheme) => 
                              {
                                  setChannel(newTheme);
                                  updateAllLabels(newTheme);                                  
                              }
                          }
                          themes={channels}
                          names={channelNames}
                          />
                  </div>
                  
                  <div className="space-y-4 w-full max-w-xl">
                      <FormLabel number={`A`} label="排序权重"/>                 
                      <input id="iptSysScore" type="text" value = {sysScore}
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                          onChange={(e) => setSysScore(e.target.value? parseInt(e.target.value) : 0)} />
                  </div>

                
                {allLabels && allLabels.length>0 && (
                  <div className="space-y-4 w-full max-w-xl">
                      <FormLabel number={`A`} label="标签"/>                 
                    { allLabels && allLabels.map((word) => (
                    <button className={ labels.includes(word) ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={() => {
                          if(labels.includes(word)){
                              setLabels(labels.filter(str => str != word));
                              if(word === "免费"){
                                  setPrice(0);
                              }
                          }else{
                              const tmp = labels;
                              tmp.push(word);
                              setLabels(tmp);
                              setTemp(word);
                          }
                      }} 
                      >
                      {word}
                    </button>
            ))} 
                  </div>
                )}
              </>
              )}

             <div className="space-y-4 w-full max-w-xl">
                 <FormLabel number={`${num++}`} label={`${model.func == "chat"  ? "第三方每千字价格" : "第三方每次运行价格"}（${ config.creditName }）`}
                   hint={`这里的价格是指，其它人使用你的模型时，每次的价格。您自己使用自己的模型，价格时固定为${minPrice}${config.creditName}/次`}/>                 
                <input id="iptPrice" type="text" value = {price} 
                          className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                onChange={ (e) => setPrice( e.target.value? parseInt(e.target.value) : 0) } />
              </div>

              { model.func == "lora" && model.trainSrv == "prompt" && (
                <div className="space-y-4 w-full max-w-xl">
                    <FormLabel number={`${num++}`} label="模型的隐藏提示词"/>                 
                    <TextareaAutosize  id="iptProMsg" value = {proMsg} 
                        className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                        onChange={(e) => setProMsg(e.target.value)} />
                </div>
              )}
              
              { model.func == "lora" && model.trainSrv == "prompt" && (
               <div className="space-y-4 w-full max-w-xl">
                   <FormLabel number={`${num++}`} label={`基础绘图模型`}/>                 
                  <DropDown 
                      theme={baseModel}
                      // @ts-ignore
                      setTheme={(newTheme) => {
                          setBaseModel(newTheme);
                      }}
                      themes={rooms}
                      names={roomNames}
                      />
               </div>
              )}
              
              { model.func == "chat" && (
                <>
                    <div className="space-y-4 w-full max-w-xl">
                        <FormLabel number={`${num++}`} label="模型的角色定义"/>                 
                        <TextareaAutosize  id="iptProMsg" value = {proMsg} 
                            placeholder="在这里可以定义模型的角色、行为、语气等"
                            className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                            onChange={(e) => setProMsg(e.target.value)} />
                    </div>
                    
                    <div className="space-y-4 w-full max-w-xl">
                        <FormLabel number={`${num++}`} label="模型的自我介绍"/>                 
                        <TextareaAutosize  id="iptDesc" value = {desc} 
                            placeholder="用户第一次使用模型会看到这些话"
                            className="input-main px-4 py-2 sm:mt-0 mt-2 w-full" 
                            onChange={(e) => setDesc(e.target.value)} />
                    </div>
                </>
                )}
          
                <div className="space-y-4 w-full max-w-xl">
                    <FormLabel number={`${num++}`} label="给模型设定一个封面"/>                 
                    <InputImage  src={coverImg} />
                    <ComboSelector onSelect = {(newFile) => setCoverImg(newFile)} selectorType="MODEL_COVER" selectorCode={model.code} />                       
                </div>                          
                  
            
              <div className="space-x-8 mt-5 flex flex-row justify-center w-full max-w-xl">
                { isAdmin && (
                 <button
                  onClick={() => {
                    if(model.func == "chat"){
                      window.open(`/chatbot?model=${model.id}`, "_blank");
                    }
                    if(model.func == "lora"){
                      window.open(`/lora?chooseInference=TRUE&model=${model.code}`, "_blank");
                    }
                  }}
                  className=" px-4 py-2 mt-8 button-dark"
                >
                  测试模型
                </button>    
                )}
                
                 <button
                  onClick={() => {
                    publish("PRIVATE");
                  }}
                  className=" px-4 py-2 mt-8 button-main"
                >
                  私人使用
                </button>                     

              {model.theme != "myDefModel" && (              
                 <button
                  onClick={() => {
                    publish("PUBLIC");
                  }}
                  className=" px-4 py-2 mt-8 button-main"
                >
                  公开发布
                </button>   
              )}
                
              { ["FINISH", "ERROR"].includes(model.status) && (model.func=="chat") && (
                 <button
                  onClick={() => {
                  window.location.href = "/createChatModel?modelId="+model.id;
                  }}
                  className=" px-2 py-2 mt-8 button-dark "
                >
                  继续训练
                </button>                                  
              )}                

             { ["FINISH", "ERROR"].includes(model.status) && (model.func=="lora") && isAdmin && (
                 <button
                  onClick={() => {
                  window.location.href = "/createLoRA?modelId="+model.id;
                  }}
                  className=" px-2 py-2 mt-8 button-dark "
                >
                  重新训练
                </button>                                  
              )}  

              </div>                  
                
              <div className="space-y-4 w-full max-w-xl">
                <div className="flex mt-3 items-center space-x-3">
                    <p className="text-left font-medium">
                      请仔细看下面的提示：
                    </p>
                  </div>
                    <p className="text-left font-medium">
                      1. 运行本人模型固定价格{minPrice}个{ config.creditName }。其它人运行本模型每次你将获得运行价格的50%（不计小数取整）。
                    </p>
                    <p className="text-left font-medium">
                      2. 模型的版权属于创作者个人和本平台共有，第三方使用需要征得创作者或者本平台的授权。
                    </p>
                    <p className="text-left font-medium">
                      3. 如果公开发布了本模型，本平台其它用户可能利用模型制作各种文章、图片，请注意保护你个人的隐私。
                    </p>
                    <p className="text-left font-medium">
                      4. 请勿发布由公众著名人物、著名动画片人物以及其它受版权保护形象训练的模型！如果发现此类情况，本平台将全权处置你的模型，包括但不限于删除、取证等。
                    </p>
                
              </div>                  
            </>
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

// export default Home;
