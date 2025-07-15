import {config} from "../../utils/config";
import {log, warn, error} from "../../utils/debug";

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const {id, code, name, func, coverImg, formular, price, access, desc, cmd, initRoomId, sysScore, pageSize, currentPage, channel, word } = req.body;
    
    // Check if user is logged in
    const session = await getServerSession(req, res, authOptions);
    let user:any;

    // 校验登录和账户余额
    if (cmd != "GOTOPAGE" && (!session || !session.user)) {
        return res.status(500).json("请先登录！");
    }
    // Get user from DB
    if(session?.user?.email){
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                credits: true,
                actors: true
            },
        });
    }
    
    if(cmd != "GOTOPAGE"){
        // Check if user has any credits left
        if(!user?.credits){
            return res.status(500).json("请先登录！");
        }else if (user?.credits <= 0) {
            return res.status(400).json("你已经没有" + config.creditName + "了，请先去买一些");
        }
    }

    // 获得提示词
    if((cmd=="CREATE" || cmd=="UPDATE") && name){
        const ps = await prisma.prompt.findMany({
            where: {
                name : name,
            },
            select: {
                id: true,
            },
        });  
        if(ps.length > 0){
            for(const p of ps){
                if(p.id != id){
                    return res.status(400).json("提示词的名字已经有人再用了，请换一个试试吧");
                }
            }
        }
    }

    try{
       if(cmd == "GOTOPAGE" && pageSize && currentPage){
    
           let prompts:any[] = [];
           let pageCount = 0;
           let rowCount = 0;
           
           let whereTerm:any;

           if(!user){
               // 未登录访问
               whereTerm = {
                   status: "FINISH",
                   access: "PUBLIC"                 
               };
               // 按关键词搜索
               if(word){
                   whereTerm.OR = [
                       { name: {contains: word}},
                       { desc: {contains: word}},
                   ];
               }
           }else if(user.actors.indexOf("admin")>=0){
               // 系统管理员
               whereTerm = {
                   status: "FINISH",
               };
               // 按关键词搜索
               if(word){
                   whereTerm.OR = [
                       { name: {contains: word}},
                       { desc: {contains: word}},
                   ];
               }
           }else{
               whereTerm = {
                   AND:[
                       { 
                           OR: [
                               {access: "PUBLIC"},
                               {AND: [
                                   {access: "PRIVATE"},
                                   {userId: user!.id}
                               ]}
                           ],
                       },
                       {status: "FINISH"},
                   ]
               };
               // 按关键词搜索
               if(word){
                   whereTerm.AND.push(
                       { OR:[
                           { name: {contains: word}},
                           { desc: {contains: word}},
                       ] });
               }
           }
           
           // 按频道搜索
           if(channel && channel != "ALL"){
               whereTerm.channel = channel;
           }

           log("prompts Where Term:" + JSON.stringify(whereTerm));
           rowCount = await prisma.prompt.count({where:whereTerm});
           pageCount = Math.ceil(rowCount / pageSize); 
           prompts = await prisma.prompt.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: [
                  { sysScore: 'desc' },
                  { runtimes: 'desc' },                      
                  { createTime: 'desc' }
                ]
            });
           log("prompts rows:" + prompts.length);
           log("prompts pageCount:" + pageCount);
           
           return res.status(200).json({pageCount, rowCount, prompts});   
              
       }else if(cmd == "CREATE" && user){
           // 再创建一个提示词
           await prisma.prompt.create({
               data: {
                   code: code,
                   name: name,
                   userId: user.id,                              
                   func: func,
                   status: "FINISH",
                   access: access,
                   formular: formular,
                   coverImg: coverImg,
                   price: !price ? 10 : parseInt(price), //给一个默认值防止出现价格漏洞
                   desc: desc,
                   runtimes: 1,
                   sysScore: !sysScore ? 0 : parseInt(sysScore),
               },
           });
           // 把最后一个图片的应用指向这个提示词应用
           await prisma.room.update({
               where: {
                   id: initRoomId,
               },
               data: {
                   model: name,
               },
           });
           res.status(200).json("提示词应用创建成功！");
           
       }else if(cmd == "UPDATE" && user){
        await prisma.prompt.update({
            where: {
              id: id,
            },
            data: {
              name: name,
              func: func,
              access: access,
              formular: formular,
              coverImg: coverImg,
              price: !price ? 10 : parseInt(price), //给一个默认值防止出现价格漏洞
              desc: desc,
              sysScore: !sysScore ? 0 : parseInt(sysScore),  
              channel: channel || 'PUBLIC'
            },
          });
          res.status(200).json("提示词应用发布成功！");      
      
    }else if(cmd == "PUBLISH"){

      await prisma.prompt.update({
          where: {
            id: id,
          },
          data: {
            access: "PUBLIC",
          },
        });
        res.status(200).json("提示词应用发布成功！");

    }else if(cmd == "CANCEL"){
        await prisma.prompt.update({
          where: {
            id: id,
          },
          data: {
            access: "PRIVATE",
          },
        });
        res.status(200).json("提示词应用已经被取消发布！");
    }else if(cmd == "DELETE"){
        await prisma.prompt.update({
          where: {
            id: id,
          },
          data: {
            status: "DELETE",
          },
        });
        res.status(200).json("提示词应用已经被删除！");

    }else if(cmd == "COVERIMG"){
        await prisma.prompt.update({
          where: {
            id: id,
          },
          data: {
            coverImg: coverImg,
          },
        });
        res.status(200).json("封面已经被更换！");
      
    }
  } catch (e) {
    error(e);
    res.status(500).json("提示词应用操作发生后台服务错误，请和网站管理员联系！");
  }
}
