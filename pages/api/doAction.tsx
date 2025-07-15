import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as enums from "../../utils/enums";

 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
   try{   
      const { fromUserId, modelId, userId, pormptId, 
             cmd, actionType, dataType, desc, targetId, // 通用数据
             pageSize, currentPage   // 翻页相关
            } = req.body;
     
      if(cmd === "favorModel"){
          // 收藏一个模型
          await prisma.action.create({
              data: {
                  type: enums.actionType.favorite,
                  status: enums.actionStatus.finish,
                  fromUserId: fromUserId,
                  targetType: enums.dataType.model,
                  targetId : modelId,
                  desc: desc,
              },
          });
      }else if(cmd === "unfavorModel"){
          // 取消收藏一个模型
          await prisma.action.updateMany({
              where: {
                  type: enums.actionType.favorite,
                  fromUserId: fromUserId,
                  targetId: modelId,
                  targetType: enums.dataType.model,
                  status: enums.actionStatus.finish,
              },
              data: {
                  status: enums.actionStatus.delete,
                  updateTime: new Date(),
              }
          });
      }else if(cmd === "DO_ACTION"){
          // 针对一个对象做一个动作
          await prisma.action.create({
              data: {
                  type: actionType,
                  status: enums.actionStatus.finish,
                  fromUserId: fromUserId,
                  targetType: dataType,
                  targetId : targetId,
                  desc: desc,
              },
          });
      }else if(cmd === "UNDO_ACTION"){
          // 删除针对一个对象做的一个动作
          await prisma.action.updateMany({
              where: {
                  type: actionType,
                  fromUserId: fromUserId,
                  targetId: targetId,
                  targetType: dataType,
                  status: enums.actionStatus.finish,
              },
              data: {
                  status: enums.actionStatus.delete,
                  updateTime: new Date(),
              }
          });
      }else if(cmd === "GOTOPAGE" && pageSize && currentPage){
          
          let whereTerm:any = {
              type: actionType,              
              targetType: dataType,
              userId: fromUserId,
              status: enums.actionStatus.finish,
          };
          const rowCount = await prisma.action.count({where:whereTerm});
          const pageCount = Math.ceil(rowCount / pageSize);        
          const actions = await prisma.action.findMany({
              where: whereTerm,
              take: pageSize,
              skip: (currentPage-1) * pageSize,
              orderBy: [
                  { createTime: 'desc' }
              ]
          });
          return res.status(enums.resStatus.OK).json({pageCount, actions});   
      }
       
      res.status(enums.resStatus.OK).json("状态更新成功");

  }catch(error){
    res.status(enums.resStatus.unExpErr).json("更新状态时发生意外失败！");
  }
}
