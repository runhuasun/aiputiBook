import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as Fetcher from "node-fetch";
// import { Configuration, OpenAIApi } from "openai";
import * as fs from 'fs';
//// import Docxtemplater from 'docxtemplater';
//// import pptxgen from "pptxgenjs";
// import PPTX from "nodejs-pptx-fix";
// import pptxParser from "pptx-parser";
// import Presentation from "ppt-template";
import {log, warn, error} from "../../utils/debug";
import { Model, User, Rawdata, ModelRawdatas } from "@prisma/client";
import { EventEmitter } from 'events';
import {embeddingText, embeddingSearch, embeddingAndSaveTexts} from "../../utils/embedding";
import {remember, recall} from "../../utils/memory";
import {readFile} from "../../utils/fileReader";
import * as AIS from "../../ai/AIService";
import { translate } from "../../utils/localTranslate";
import {config, defaultImage} from "../../utils/config";
import * as enums from "../../utils/enums";
import {useCredits} from "./creditManager";



export type GenerateResponseData = {
  usedCredits: number;
  estimateTime: number;
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    datasetUrls: string; // 训练子模型的数据集存放的网址
    datasetNames: string; // 训练文件的名称
    datasetTypes: string; // 训练文件的类型
    datasetRawdataIds: string; 
    modelId: string; // 如果模型已经存在，告诉我是追加到哪个模型
    modelName: string; // 模型的名字
    title: string; // 模型本次训练的标题或者介绍
    levelSigns: string; // 内容结构的标识符，如章、节。。。
    channel: string;
  };
}

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<GenerateResponseData | string>
) {
  try{
    // Check if user is logged in
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
    }

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email!,
      },
    });
    if(!user){
      throw new Error("用户没登录");
    }
    
    let authstr = "Bearer " + process.env.OPENAI_API_KEY;       
    
    log("----enter train chat model-----");

    const {datasetUrls, datasetTypes, datasetNames, datasetRawdataIds, modelId, modelName, title, levelSigns, channel} = req.body;

    // 找到或者创建模型    
    let model = null;
    if(modelId && modelId.trim() != ""){
      // 如果是向以往的model追加知识，那么就找到模型
      model = await prisma.model.findUnique({
        where: {
            id: modelId,
        },
      });
    }
    
    // 如果没有传入模型，或者查不到模型，就创立一个
    if(!model && user){
      // 检查名字是否重复
      const ms = await prisma.model.findMany({
        where: {
            name: modelName,
        },
      });
      if(ms.length>0){
          return res.status(400).json("模型名字和其他模型重复了，请换一个吧！");
      }      
      
      // 如果没有模型，就创建一个模型
      model= await prisma.model.create({
        data: {
          userId: user!.id!,
          code: modelName,    
          name: modelName,
          func: "chat",
          theme: "gpt",
          trainSrv: "openai embedding",
          status: "CREATE",
          proId: "",
          usedCredits: 0,
          access: "PRIVATE",
          url: "",  // 训练的结果
          proMsg: "",
          price: 1, // 缺省价格
          coverImg: defaultImage.modelRunning,
          channel: channel,
          aiservice: "BAIDUAI",
          baseModel: "ERNIE-Bot-turbo"
        },
      });   
    }

    if (!model) {
      return res.status(500).json("创建模型时发生意外失败！");
    }
    
    ///////////////////////////////////////////////////////////
    // 读取dataset中的文本
    log("-----读取dataset中的文本-----");
    log(datasetUrls);
    let dtTexts:{
        content:string, 
        fileUrl:string,
        fileType:string,
        fileName:string,
        fileTitle:string,
        rawdataId:string
    }[] = [];
    let dtFileUrls:string[] = datasetUrls.split("|");
    let dtFileTypes:string[] = datasetTypes.split("|");
    let dtFileNames:string[] = datasetNames.split("|");
    let dtRawdataIds:string[] = datasetRawdataIds ? datasetRawdataIds.split("|") : [];
      
    // 记录插入数据库中的数据方便回滚
    let newRawdataArray:Rawdata[] = [];
    let allRawdataArray:Rawdata[] = [];
    let newModelRawdatasArray:ModelRawdatas[] = [];
    
    try{
        // 读取所有文件的内容
        for(let i=0; i<dtFileUrls.length; i++){
            const file = dtFileUrls[i];
            const type = dtFileTypes[i];
            const name = dtFileNames[i];
            const fileTitle = title ? (title==="NO TITLE" ? "" : title) : (name.split("."))[0].replace(/^\d+/, ''); //如果用户没有输入title，就用文件名做title，并且删除文件名前面的数字
            
            let rawdata = null;
            let newRawdata = null;
            
            // 如果是已经存在的原始文件，就读出记录，不再创建
            if(dtRawdataIds[i]){
                rawdata = await prisma.rawdata.findUnique({
                    where:{
                        id: dtRawdataIds[i]
                    }
                });
            }
            if(!rawdata){
                newRawdata = await prisma.rawdata.create({
                    data: {
                        name: name, 
                        url: file,
                        type: type,
                        status: "PUBLISH",
                        userId: user.id,
                        desc: title                       
                    }
                });

                // 新创建的原始数据记录保存在数组里，回滚的时候会用到
                newRawdataArray.push(newRawdata);                
                rawdata = newRawdata;
            }
            allRawdataArray.push(rawdata);
            
            let fileContents:any[] = [];
            switch(type){
                case "TEXT": 
                    fileContents = await readFile(file, levelSigns);
                    break;
                case "DATABASE": 
                    // fileContents = await readDatabase();
                    break;
                default:
                    fileContents = [title];
            }
       
            if(fileContents){
                for(const fc of fileContents){
                    if(title === "AgodaHotelDataPackage" ){    
                        dtTexts = await trainAgodaDataModel(fc, model, user, rawdata, file, type, name, dtTexts, 
                                                            allRawdataArray, newRawdataArray, newModelRawdatasArray);
                    }else{
                        // 通用的处理
                        dtTexts.push({
                            content: fc,
                            fileUrl: file,
                            fileType: type,
                            fileName: name,
                            fileTitle: fileTitle,
                            rawdataId: rawdata.id
                        });
                    }
                }
            }

            if(newRawdata){
                // 如果有新的数据集被创建，那么把和模型的关系也建立
                const modelRawdata = await prisma.modelRawdatas.create({
                    data: {
                      modelId: model.id, 
                      rawdataId: newRawdata.id,  
                    }
                });     
                newModelRawdatasArray.push(modelRawdata);
            }

        }
    }catch(e){
      error(e);
      rollbackTraining(model, newRawdataArray, newModelRawdatasArray);
      return res.status(400).json("文件格式不兼容，请换一个文件试试！");
    }
   
    let totalChars = 0;
    let i=1;
    for( const dtText of dtTexts){
      log("--------第" + i++ + "条，共" + dtText.content.length + "字------------");
      totalChars += dtText.content.length;
    }
    const usedCredits = calcUsedCredits(totalChars);
    if(user.credits < usedCredits){
        rollbackTraining(model, newRawdataArray, newModelRawdatasArray);
        return res.status(400).json( "本次训练需要"+ usedCredits + "个" + config.creditName + "，你的" + config.creditName + "数量不够，请先充值！");
    }
    
    // 开始异步训练语言模型
    trainModel(dtTexts, model!, usedCredits, user!, title, datasetUrls).then( async()=>{
        log("训练成功后，把所有训练数据标记为已经训练完毕");
      
        for(const rd of newModelRawdatasArray){
            log("UPDATE modelrawdats: id=" + rd.id);
            await prisma.modelRawdatas.update({
                where:{
                    id: rd.id
                },
                data:{
                    status: "TRAINED"
                }
            });
        }
    });
   
    // 返回模型训练结果
      log("模型开始训练！");
      // 写入训练起止时间
      
      res.status(200).json( {
        usedCredits: usedCredits,
        estimateTime: totalChars / 500,
      });
      
  } catch (e) {
    error("trainChatModel.ts exception");
    error(e);
    // rollbackTraining(model, newRawdataArray, newModelRawdatasArray);      
    res.status(500).json( "训练模型时发生未知错误！" );
  }
}


async function trainAgodaDataModel(fc:string, model:Model, user:User, rawdata:Rawdata, file:string, type:string, name:string,
                                   dtTexts:any[], allRawdataArray:any[], newRawdataArray:any[], newModelRawdatasArray:any[]){
    // log("进入AgodaHotelDataPackage解析模式");
    // log("片段的内容是：\n" + fc);
    if(fc.indexOf("AgodaHotelPhotoLink") < 0){
        return dtTexts;      
    }
  
    // 酒店集团	酒店品牌	酒店英文名称	酒店名称	城市	省
    let lines = fc.split("\n");
    let hotelLabel = "";
    let hotelTitle = "";
    let hotelData = "";
    let hotelGroup = ""; 
    let hotelBrand = ""; 
    let hotelEngName = ""; 
    let hotelName = ""; 
    let hotelCity = ""; 
    let hotelProvince = "";          
    
    for(const line of lines){
      hotelGroup = line.startsWith("酒店集团") ? (line + "\n") : hotelGroup;
      hotelBrand = line.startsWith("酒店品牌") ? (line + "\n") : hotelBrand;
      hotelEngName = line.startsWith("酒店英文名称") ? (line + "\n") : hotelEngName;
      hotelName = line.startsWith("酒店名称") ? (line + "\n") : hotelName;
      hotelCity = line.startsWith("城市") ? (line + "\n") : hotelCity;
      hotelProvince = line.startsWith("省") ? (line + "\n") : hotelProvince;
      
      // AgodaHotelPhotoLink1:http://pix3.agoda.net/hotelimages/617/61708/61708_17112809120059931850.jpg?s=312x?ca=6&ce=1
      if(line.startsWith("AgodaHotelPhotoLink")){
          // log("开始处理AgodaHotelPhotoLink");
        
          // 处理含有link的行
          hotelTitle = (hotelName ? hotelName.split(":")!.pop()!.trim() : "");
            // (hotelProvince ? hotelProvince.split(":")!.pop()!.trim() : "") + 
            // (hotelCity ? hotelCity.split(":")!.pop()!.trim() : "") + 
            
                                          
          hotelLabel = hotelTitle + "的照片\n" + hotelEngName + hotelGroup + hotelBrand + hotelCity + hotelProvince;
    
        
          // log("hotelLabel: " + hotelLabel);
        
          // 创建一个媒体文件，并用标签来建立向量索引
          const photoLink = line.substring(line.indexOf(":")+1).split("?")[0];
          const photoName = photoLink.split("/").pop();
/*
          const exsitRawdatas = await prisma.rawdata.findMany({
              where: {
                  name: hotelTitle, 
                  url: photoLink,
                  type: "IMAGE",
                  status: "PUBLISH",
                  userId: user.id,
                  desc: hotelLabel   
              }
          });
          let rawdata = null;
        
          if(exsitRawdatas && exsitRawdatas.length == 1){
              log("发现已有的Rawdata:" + exsitRawdatas[0].name);
              allRawdataArray.push(exsitRawdatas[0]);
              rawdata = exsitRawdatas[0];
          }else{
              const newRawdata = await prisma.rawdata.create({
                  data: {
                      name: hotelTitle, 
                      url: photoLink,
                      type: "IMAGE",
                      status: "PUBLISH",
                      userId: user.id,
                      desc: hotelLabel                       
                  }
              });
              log("创建了新的Rawdata:" + newRawdata.name);
            
              newRawdataArray.push(newRawdata);
              allRawdataArray.push(newRawdata);
              rawdata = newRawdata;

              const modelRawdata = await prisma.modelRawdatas.create({
                  data: {
                    modelId: model.id, 
                    rawdataId: newRawdata.id,  
                  }
              });     
              newModelRawdatasArray.push(modelRawdata);
              log("新Rawdata被连接到当前模型");
          }
*/          
           
          dtTexts.push({
              content: hotelLabel,
              fileUrl: photoLink,
              fileType: "IMAGE",
              fileName: photoName ? photoName : "",
              fileTitle: "", // hotelTitle,
              rawdataId: rawdata.id
          });
      }else{
          // 处理正常的行
          hotelData += line + "\n";
      }
    }
    
    // 因为媒体库和文本库分离，所以不再保留酒店基础信息
    /*
    dtTexts.push({
      content: hotelData,
      fileUrl: file,
      fileType: type,
      fileName: name,
      fileTitle: hotelTitle,
      rawdataId: rawdata.id
    });
    */
    return dtTexts;
}


async function rollbackTraining(model:Model, newRawdataArray: Rawdata[], newModelRawdatasArray: ModelRawdatas[]){
    try{
        if(model){
            await prisma.model.update({
                data:{
                    status: "ERROR",
                },
                where:{
                    id: model.id
                }
            });
        }
        for(const newRawdata of newRawdataArray){
            await prisma.rawdata.update({
                data:{
                    status: "DELETE",
                },
                where:{
                    id: newRawdata.id
                }
            });
        }
        for(const m of newModelRawdatasArray){
            await prisma.modelRawdatas.update({
                data:{
                    status: "DELETE",
                },
                where:{
                    id: m.id
                }
            });
        }       
    }catch(e){
        error("--- rollbackTraining error ---");
        error(e);
    }
}

export function calcUsedCredits(len:number){

    // 计费 USD $0.0001 / 1K tokens
    // 约等于 RMB 0.0007 / 1千字
    // = 1个提子 142K tokens
    // 暂时按 1个提子 1千字符utf-16，不足1千字按1千字收取
    return Math.floor(len / 1000) + 1;

}


export async function trainModel(dtInputs:any[], model:Model, usedCredits:number, user:User, title?:string, datasetUrl?:string) : Promise<string|undefined> {
    if(!model || !dtInputs || dtInputs.length==0){
      return undefined;
    }
  
    const startTime = new Date().getTime(); // 计算时间的时间戳
    let coverImg = defaultImage.modelComplete;
  
    if(model.coverImg && model.coverImg.indexOf("running")<0){
        coverImg = model.coverImg;
        await prisma.model.update({
            where: {
                id: model.id,
            },
            data: {
                coverImg: defaultImage.modelRunning,
                status: "START",
            },
        });          
    }

    let dtTexts:any[] = [];
    let dtMedias:any[] = [];
    for(const data of dtInputs){
        if(data.fileType == "TEXT"){
            dtTexts.push(data);
        }else{
            dtMedias.push(data);
        }
    }
    const embTextResult = await embeddingAndSaveTexts(dtTexts, model.url, model.id, title);
    const embMediaResult = (dtMedias && dtMedias.length>0) ? await embeddingAndSaveTexts(dtMedias, model.url+".media", model.id, title) :
        {url:"", totalLength:0, totalLines:0, usedTokens:0};    
    const embResult = {
        url: embTextResult.url,
        totalLength: embTextResult.totalLength + embMediaResult.totalLength,
        totalLines: embTextResult.totalLines + embMediaResult.totalLines,       
        usedTokens: embTextResult.usedTokens + embMediaResult.usedTokens      
    }
    
    /////////////////////////////////////////////////////////
    // 对每个词计算向量值
    let usedTokens = embResult.usedTokens;

    // log("当前模型文件已经是：" + indexPath);
    const newModel = await prisma.model.update({
        where: {
            id: model.id,
        },
        data: {
            usedCredits: usedCredits + model.usedCredits,     
            usedTokens: usedTokens + model.usedTokens,
            status: "FINISH",
            url: embResult.url,
            coverImg: coverImg,
            datasets: datasetUrl ? (model.datasets ? (model.datasets + "|" + datasetUrl) : datasetUrl) : (model.datasets ? model.datasets : ""),
        },
    });  

    // 扣除用户的提子
    await useCredits(user, usedCredits, enums.creditOperation.CREATE_CHAT_MODEL, newModel.id);
  
    if(usedCredits > 0){
      log("模型训练结束！");
      log("模型数据库被存储在 ：" + embResult.url);
      log("本次训练的文本长度为：" + embResult.totalLength + "字");
      log("本次训练生成" + embResult.totalLines + "条记录");
      log("本次训练一共消耗 " + usedTokens + "个tokens");
      const endTime = new Date().getTime();
      log("本次训练共耗时 " + (endTime - startTime)/1000 + "秒");
    }else{
      log("记录用户" + embResult.totalLength + "个字对话消耗" + usedTokens + "个token");
    }

    return embResult.url;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////
//  用本地模型先预处理用户输入
///////////////////////////////////////////////////////////////////////////////////////////////////////
export async function localModelProcess(
  messages: {role: string; content: string | any[]; name: string; }[], 
  model:Model, user:User, 
  params: {useModel:boolean; useMem:boolean} = {useModel:true, useMem:true}
):  Promise<{role: string; content:string|any[]; name:string;}[]>{

    // 获得输入内容的一个副本，防止数据干扰
    let finalMsg = messages.slice();
    
    // 如果模型有对应的文件，就先进行预处理
    if(model){
        let word:string = "";
        if(Array.isArray(finalMsg[messages.length-1].content)){ // 兼容OPENAI多模态新格式
            for(const m of finalMsg[messages.length-1].content){
                if(m.type === "text"){
                    word = m.text;
                    break;
                }
            }
        }else{
          word = String(finalMsg[messages.length-1].content);
        }
        // 当用户说某些特殊内容时，如果有历史记录，把最后一条历史记录作为搜索依据
        const preTrigers = ["上述", "上面", "刚才", "之前", "继续", "详细说", "详细讲", "详细阐述", 
                            "继续", "接着说", "然后呢", "continue", "你说吧",
                            "说吧", "请说", "说啊", "快说", "详细点"]

        if(finalMsg.length > 2){
            let triggered = false;
            for(const t of preTrigers){
                if(word.indexOf(t) >= 0){
                    triggered = true;
                    break;
                }
            }
            if(triggered){
                word = finalMsg[messages.length-2].content + "\n" + word;
            }
        }
        
        log("search word:" + word);
        if(model.language != "zh"){
            // 把问题翻译成对应的语言
            word = await translate(word, "zh", model.language);
        }

        if(model){
            const ais = model.aiservice!;
            const bm = model.baseModel!;
            const service = AIS.createLLMInstance(ais, bm);
            if(service){      
                let vvModel = null;
                let maxInput = service.maxInputLength;
                maxInput -= word.length;
                
                // 计算本地模型中的内容
                if(params.useModel && model.url && model.url.trim()!= ""){
                    log("开始计算小模型中的相关内容");
                    vvModel = await embeddingSearch(word, model.url, model.id, undefined, 10, Math.floor(maxInput*0.7)); // 模型中的相关内容
                    log("小模型中被采纳" + (vvModel ? vvModel.length : 0) + "条记录");
                }
                // log(vvModel);

                // 计算历史上下文的内容
                let vvMem = null;
                if(params.useMem){
                    log("开始回忆用户历史上下文中的内容");
                    vvMem = await recall(word, model.id, user.id, 2, Math.floor(maxInput*0.3), model.theme=="WALL" ? "WALL" : "PRIVATE"); // 用户记忆中的相关内容
                    log("历史记忆中被采纳" + vvMem.length + "条记录");
                }
                // log(vvMem);
              
                if(vvMem){
                    finalMsg = service.bindLocalMessage(finalMsg, vvMem, "MEM");
                }
              
                if(vvModel){
                    finalMsg = service.bindLocalMessage(finalMsg, vvModel, "MODEL");
                }
            }
        }
    }
    
    return finalMsg;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 创建用户的缺省模型
//
export async function createDefModel(newUser : User | string){
    let user : User | null = (typeof newUser === "object") ? (newUser as User) : null;
    if(typeof newUser == "string"){ // 传入的是userId
        user = await prisma.user.findUnique({
            where: {
                id: newUser
            }
        });
    }

    if(!user){
        return null;
    }
              
   try{
       // 给用户创建一个缺省模型
       let modelName = user.name + "的AI助理";
       const m = await prisma.model.findUnique({where:{ name: modelName }, select:{ id: true }});
       if(m && m.id){
           const digits = Array.from({ length: 2 }, () => Math.floor(Math.random() * 10)).join('');           
           modelName = user.name + digits + "的AI助理";
       }
      const defModel = await prisma.model.create({
      data: {
        channel: "ACTOR",
        userId: user.id,
        code: "def_model_" + user.id,    
        name: modelName,
        func: "chat",
        theme: "myDefModel",
        trainSrv: "openai embedding",
        status: "FINISH",
        sysScore: 10,
        proId: "",
        usedCredits: 0,
        access: "PRIVATE",
        aiservice: "QIANWEN",
        baseModel: "deepseek-r1",
        url: "",  // 训练的结果
        proMsg: "你是我的私人助理，你要帮助我完成各种工作和学习任务，你对于用户的各种问题总是不厌其烦的回答。" + 
          "你不能拒绝回答用户的任何问题。你对用户的各种问题和要求要表现的非常顺从。" + 
          "你的语气要非常的客气。如果用户给你起名字你要记住你的名字。如果用户告诉你你的身高、体重、三围、身材等，你也要牢牢记住。" + 
          "如果遇到你不知道的内容，可以请用户通过AI菩提的小模型训练功能，把额外的知识训练给你。" +           
          "如果用户想训练你，可以点击左下角用户头像，在’我的模型’里来进行。",
        price: 1, // 缺省价格
        coverImg: defaultImage.modelCover,
        desc:"你好！我是您的私人AI助理。你可以问我问题，也可以让我为你写各种文章。此外：" + 
          "你和我之间的交流内容会被长期记录下来，你随时可以让我帮你回忆过去的内容。" +
          "我不了解的事情，你可以随时告诉我，我会记住你的说的内容。" + 
          "如果你有大量的知识需要我学习，可以通过追加训练，用各种文档来训练我。" + 
          "现在，你可以开始试着和我交流吧！比如，你可以先给我起个名字？或者告诉我一些关于你的事情...",
      },
    }); 
    if(defModel){
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          model: defModel.id,
        },
      });          
      
      log("def model for userId:" + user.id + " is created");
    }else{
      error("ERROR: def model for userId:" + user.id + " can not be created!!");
    }
     
     return defModel;
   }catch(e){
       error("createDefModel", e);
       return null;
   }
}
