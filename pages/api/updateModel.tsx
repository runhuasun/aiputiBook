import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import {getLLMByCode} from "../../ai/AIServiceList";
import {translate} from "../../utils/localTranslate";
import * as debug from "../../utils/debug";
import * as am from "../api/actionManager";
import {config} from "../../utils/config";
import {AliyunTTS} from '../../ai/tts/AliyunTTS';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{  
        const { modelId, name, imgRecogHint, price, access, coverImg, cmd, desc, proMsg, baseModel, chatService, language, channel, sysScore, labels, params, roomId, pageSize, 
              currentPage, modelType, showHistory, showFavorites, label, word, func, order } = req.body;
        
        debug.log("---Enter update model Manager-----");            
        // Check if user is logged in
        const session = await getServerSession(req, res, authOptions);
        let user;

        if(cmd != "GOTOPAGE"){
            if (!session || !session.user) {
                return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
            }
            
            // Get user from DB
            user = await prisma.user.findUnique({
                where: {
                    email: session.user.email!,
                },
            });
            // Check if user has any credits left
            if(user?.credits == undefined){
                return res.status(500).json("该操作需要您先登录！");
            }else if (user?.credits <= 0) {
                return res.status(400).json("你已经没有" + config.creditName + "了，请先去买一些");
            }          
        }
        
       if(cmd == "GOTOPAGE" && pageSize && currentPage){
    
           let models:any[] = [];
           let pageCount = 0;
           let rowCount = 0;
           
           if(channel == "BOOK" && showHistory && user){
               models = await am.getRecentReadingBooks(user.id);
               pageCount = models ? Math.ceil(models.length / pageSize) : 0;          
           }else if(channel == "BOOK" && showFavorites && user){
               models = await am.getFavoriteBooks(user.id);
               pageCount = models ? Math.ceil(models.length / pageSize) : 0;          
           }else{
               let whereTerm:any = {
                   func: func? func : "lora",
                   access: "PUBLIC",
                   status: "FINISH",
               };
               if(modelType && modelType!="ALL"){
                   whereTerm.func = modelType?.toLowerCase();
               }               
               // 按频道搜索
               if(channel && channel != "ALL"){
                   whereTerm.channel = channel;
               }
               // 按标签搜索
               if(label && label != "全部"){
                   whereTerm.labels = {
                       contains: label
                   };
               }
               // 按关键词搜索
               if(word){
                   whereTerm.OR = [
                       { name: {contains: word}},
                       { desc: {contains: word}},
                       { labels: {contains: word}}
                   ];
               }
    
               debug.log("Model Where Term:" + JSON.stringify(whereTerm));
               rowCount = await prisma.model.count({where:whereTerm});
               pageCount = Math.ceil(rowCount / pageSize);        
                models = await prisma.model.findMany({
                    where: whereTerm,
                    take: pageSize,
                    skip: (currentPage-1) * pageSize,
                    orderBy: order=="RUN" ? 
                      [
                        { sysScore: 'desc' },                        
                        { runtimes: 'desc' },                      
                        { createTime: 'desc' }
                      ]
                      :
                      [
                        { sysScore: 'desc' },
                        { createTime: 'desc' },
                        { runtimes: 'desc' },                      
                      ]
                });
                debug.log("Model rows:" + models.length);
           }
           
           return res.status(200).json({pageCount, rowCount, models});   
          
       }else if(cmd == "DELETE"){
           let m = await prisma.model.findUnique({
               where: {
                   id: modelId,
               }
           });   
           if(m){
               if(m.func == "voice" && m.theme == "CUSTOM" && m.aiservice == "ALIYUN" && m.trainSrv == "aliyun_cosyvoice_v1"){                   
                   const voice_id = m.code.replace("ALIYUN***cosyvoice-v1-", "");
                   const tts = new AliyunTTS();
                   await tts.deleteSpeaker(voice_id);
                   debug.log(`ALIYUN speaker ${voice_id} has been deleted!`);
               }
               m = await prisma.model.update({
                   where: {
                       id: m.id,
                   },
                   data:{
                       code: m.id + m.code + "_DELETED_",
                       name: m.id + m.name + "_DELETED_",
                       status: "DELETE",
                   },
               });
         }
        if(m){
            return res.status(200).json(m.status);
        }else{
            return res.status(400).json("更新模型状态时发生意外失败！");
        }
         
      }else if(cmd == "STATUS"){
        const m = await prisma.model.findUnique({
          where: {
              id: modelId,
          },
          select:{
            id: true,
            name: true,
            status: true
          },
        });
        if(m){
          debug.log(`${m.name}的状态目前是：${m.status}`);
          res.status(200).json({status:m.status});
        }else{
          res.status(400).json("查询模型状态时发生意外失败！");
        }
          
        return;
        
      }else if(cmd === "COVERIMG"){

           if(coverImg){
               // 如果指定封面就就直接设置
               // 设置封面
               await prisma.model.update({
                   where: {
                       id: modelId,
                   },
                   data: {
                       coverImg: coverImg,
                   }
               });
           }else if(roomId){
               let room;
               let retry=10;
               
               do{
                   room = await prisma.room.findUnique({ 
                       where:{ id: roomId },
                       select:{ 
                         id: true, 
                         outputImage: true, 
                         sysScore:true 
                       }
                   });
                   if(room){
                       // 设置封面
                       await prisma.model.update({
                           where: {
                               id: modelId,
                           },
                           data: {
                               coverImg: room.outputImage,
                           }
                       });
                       await prisma.room.update({
                           where: {
                               id: roomId
                           },
                           data: {
                               sysScore: (!room.sysScore || room.sysScore<4) ? 4 : room.sysScore,
                               access: "PUBLIC"
                           }
                       });
                   }
               }while(room && 
                      room.outputImage.indexOf("replicate.delivery")>=0 &&
                      await new Promise((resolve) => setTimeout(resolve, 5000)))                           
           }else{
               return res.status(400).json("需要指定一个封面");
           }
         
      }else{
        const llm = chatService ? getLLMByCode(chatService) : null;
        const engHint = imgRecogHint ? (await translate(imgRecogHint, "zh", "en")) : "";
        let data:any = {
              name: name,
              access: access,
              price: parseInt(price),
              coverImg: coverImg,
              desc: desc,
              proMsg: proMsg,
              language: language,
              channel: channel,
              sysScore: sysScore,
              imgRecogHint: engHint,
              labels: labels ? labels : "",
              params: params
            };

        if(baseModel){
          data.baseModel = baseModel;
        }
        if(llm){
            data.aiservice = llm.aiservice;
            data.baseModel = llm.baseModel;
        }
        if(params){
            data.params = params;
        }
          
        // 更新模型
        await prisma.model.update({
            where: {
              id: modelId,
            },
            data: data,
        });
      }
     
      res.status(200).json("模型状态更新成功");

  }catch(e){
    if(JSON.stringify(e).indexOf("Unique constraint failed on the fields: (`name`)")>=0){
        res.status(400).json("模型名称重复，请换一个试试");
    }else{     
      res.status(500).json("更新模型时发生意外失败！");
    }
     debug.error(e);
    
  }
}
