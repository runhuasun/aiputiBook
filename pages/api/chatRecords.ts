import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as Fetcher from "node-fetch";


interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    talkId: string;
    CMD: string;
    userId: string;
    lastTime: string;
    firstTime: string;
    model: string;
  };
}

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse
) {
  try{
    const { talkId, CMD, userId, lastTime, firstTime, model } = req.body;
    
    // Check if user is logged in
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(500).json("新用户请先点左下角[登录]按钮，极简注册哦！");
    }

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email!,
      },
      select: {
        id: true,
        name: true,
        credits: true,
        incomeCredits: true,
      },
    });
    if(!user){
      throw new Error("用户没登录");
    }
    

    if(CMD == "delete"){
      console.log("delete talkId:" + talkId);
      // 暂时每次扣除用户1个提子
      await prisma.talk.update({
        where: {
          id: talkId,
 //         userId: user.id, // 只能删除自己的记录
        },
        data: {
          status: "DELETE",
        },
      });

      res.status(200).json( "记录删除成功" );
      
    }else if(CMD == "loadNewTalks"){

      // 获得模型下别人的最近聊天记录
   //   console.log("load new talks for:" + userId + " after " + lastTime);
      
      const talks = await prisma.talk.findMany({
        where: {
          NOT: {
            userId: userId,
          },
          createdAt: {
            gte: lastTime,
          },
          model: model,
          status: "SUCCESS",
        },
        include: {
          user: true,
        }
      });      

      if(talks && talks.length>0){
//        console.log(JSON.stringify(talks));
        res.status(200).json({data:talks});
      }else{
        res.status(201).json("没有新记录");
      }
      
    }else if(CMD == "loadMoreHistory"){

        console.log("load new more history for:" + userId + " before " + firstTime);
   
        const cond = ( userId) ? 
        {
              status: "SUCCESS",
              model: model ? model : "gpt-3.5-turbo",
              userId: userId,
              createdAt: {
                lte: firstTime,
              },              
          } : 
        {
            status: "SUCCESS",
            model: model ? model : "gpt-3.5-turbo",
            createdAt: {
              lte: firstTime,
            },            
        }       
        const talks = await prisma.talk.findMany({
          where: cond,
          include: {
            user: true,
          },
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },          
            
        });      

      if(talks && talks.length>0){
      //  console.log(JSON.stringify(talks));
        res.status(200).json({data:talks});
      }else{
        res.status(201).json("没有新记录");
      }      
    
    }else{
      res.status(400).json("未知的操作命令");
    }
  } catch (error) {
    console.error("chat.ts exception");
    console.error(error);
    res.status(500).json({role:"system", content:"调用ChatBot服务器失败！"});
  }
}
