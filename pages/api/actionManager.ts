import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { Action, Model } from "@prisma/client";
import * as debug from "../../utils/debug";

/*
model Action{
  id          String  @id @default(cuid())
  type        String
  createTime  DateTime  @default(now())
  updateTime  DateTime  @default(now())
  status      String
  fromUserId  String
  user        User      @relation(fields: [fromUserId], references:[id], onDelete: Cascade)
  targetType  String
  targetId    String
  desc        String
}
*/

export type ActionType =
  | "READ" // 看过
  | "LIKE" // 点赞
  | "FAVORITE" // 收藏
;

export type TargetType =
  | "BOOK"
  | "TRAVEL"
;


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    
    try{   
        const { cmd, id, type, userId, targetType, targetId, bookId, desc } = req.query;
      
        let result:any;
        debug.log("----enter action manager----");
           
        switch(cmd){
            case "DELETE":
                result = deleteAction(id as string);
                break;
            case "RECORD":
                result = recordAction(userId as string, type as ActionType, targetType as TargetType, targetId as string, desc as string);
                break;
                
            case "READBOOK":
                result = readBook(userId as string, bookId as string);
                break;
            
            case "READTRAVEL":
                result = readTravel(userId as string, bookId as string);
                break;
            
            case "ADDFAVORITEBOOK":
                result = addBookToFavorites(userId as string, bookId as string);
                break;
                
            case "REMOVEFAVORITEBOOK":
                result = removeBookFromFavorites(userId as string, bookId as string);
                break;

                
            default:
                return res.status(400).json("处理用户历史时收到未知的命令！");                
        }
        if(result){
            return res.status(200).json(result);
        }else{
            return res.status(400).json("处理用户历史记录时发生意外错误！");                
        }
    }catch(e){
        return res.status(500).json("处理用户历史记录时发生意外失败！");
    }
    
}

/**** 用户历史行为的通用函数集 ***/
export async function recordAction(userId:string, type:ActionType, targetType:TargetType, targetId:string, desc?:string){
    const term = {
        where:{ fromUserId:userId, type, targetType, targetId, 
              status:{not:"DELETED"}
              }
    };
    const exists = await prisma.action.findMany(term);
    if(exists && exists.length>0){
        return await modifyAction(exists[0].id, userId, type, targetType, targetId, desc);
    }  
    return await prisma.action.create({
        data: { type, fromUserId:userId, targetType, targetId, desc:desc||'', status:"CREATED" },
    });  
}

export async function modifyAction(id:string, userId:string,  type:ActionType, targetType:TargetType, targetId:string, desc?:string){
    return await prisma.action.update({
        where:{ id },
        data: { type, fromUserId:userId, targetType, targetId, desc:desc||'', updateTime:new Date(), status:"MODIFIED" },
    });  
}

export async function deleteAction(id:string){
    return await prisma.action.update({
        where:{ id },
        data: { status:"DELETED" },
    });  
}

export async function removeAction(userId:string,  type:ActionType, targetType:TargetType, targetId:string){
    return await prisma.action.updateMany({
        where:{ fromUserId:userId, type, targetType, targetId },
        data: { status:"DELETED" },
    });  
}

export async function queryRecords(userId:string, type?:ActionType, targetType?:TargetType, targetId?:string, max:number=10){
    let term:any = {  
        where: { fromUserId:userId, status:{not:"DELETED"} },  
        orderBy: [
            { updateTime: 'desc' }
        ],
        take: max,        
    };
    if(type){
        term.where.type = type;
    }
    if(targetType){
        term.where.targetType = targetType;
    }
    if(targetId){
        term.where.targetId = targetId;
    }
    return await prisma.action.findMany(term);
}


/**** 旅行功率行为的函数集 ****/
export async function readTravel(userId:string, bookId:string){
    return await recordAction( userId, "READ", "TRAVEL", bookId);
}



/**** 用户读书行为的函数集 ****/
export async function readBook(userId:string, bookId:string){
    return await recordAction( userId, "READ", "BOOK", bookId);
}

async function getBooksByActions(actions:any[]){
    const result:any[] = [];
    if(actions){
        for(const a of actions){
            const m = await prisma.model.findUnique({
                where:{id:a.targetId}
            });
            result.push(m);
        }
    }
    return result;
}

export async function getRecentReadingBooks(userId:string, max:number=100){
    const actions = await queryRecords(userId, "READ", "BOOK", undefined, max);
    return await getBooksByActions(actions);
}

export async function addBookToFavorites(userId:string, bookId:string){
    return await recordAction(userId, "FAVORITE", "BOOK", bookId);
}

export async function removeBookFromFavorites(userId:string, bookId:string){
    return await removeAction(userId, "FAVORITE", "BOOK", bookId);
}

export async function getFavoriteBooks(userId:string){
    const actions = await queryRecords(userId, "FAVORITE", "BOOK", undefined, 1000);
    return await getBooksByActions(actions);
}

export async function isFavoriteBook(userId:string, bookId:string){
    const actions = await queryRecords(userId, "FAVORITE", "BOOK", bookId, 1);
    return actions && actions.length==1;
}
