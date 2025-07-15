import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as fs from "../../utils/fileServer";
import {isURL, getFileTypeByURL, getRedirectedUrl} from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import {translate} from "../../utils/localTranslate";
import * as AIS from "../../ai/AIService";
import {system} from "../../utils/config";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        let { cmd, params } = req.body;
        let session:any;
        let user:any;
      
        // Check if user is logged in
        session = await getServerSession(req, res, authOptions);
        if (!session || !session.user.actors) {
            return res.status(403).json("您没有权限！");
        }
        // 未登录用户上传的文件被放在这里
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email
            },
            select: {
                id: true,
                actors: true
            },
        });  
        if(user.actors.indexOf("admin")<0) {
            return res.status(403).json("您没有权限！");
        }

        if(cmd === "PHYSICAL_CLEAR_NO_PAYMENT_USER_ROOM"){
            const deletedRooms = await prisma.room.findMany({
                where:{
                    createdAt: {
                        gte: params.startDate, // 大于等于起始日期
                        lte: params.endDate   // 小于等于结束日期
                        },
                    user: {
                        boughtCredits: {
                            lte: 0
                        },
                        email: {
                            not: {
                                contains: "aiputi.cn" // 排除 email 包含 "aiputi.cn" 的用户
                            }
                        }                      
                    }                        
                },
                select:{
                    id: true,
                    outputImage: true
                }
            });
            debug.log("PHYSICAL_CLEAR_NO_PAYMENT_USER_ROOM found rooms:", deletedRooms.length);
            let failedRooms:any[] = [];
            for(const room of deletedRooms){
                try{
                    await fs.deleteFileByURL(room.outputImage);
                    debug.log("删除存储桶中的Room数据：", room.outputImage);
                    //await prisma.room.delete({ where: { id: room.id } });
                    //debug.log("删除数据库中Room记录：", room.id);
                }catch(err){
                    debug.error("PHYSICAL_CLEAR_DATA failed room:", JSON.stringify(room));
                    failedRooms.push(room);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));              
            }
            debug.log("PHYSICAL_CLEAR_NO_PAYMENT_USER_ROOM delete room SUCCESS:", deletedRooms.length - failedRooms.length);
            debug.log("PHYSICAL_CLEAR_NO_PAYMENT_USER_ROOM delete room FAILED:", failedRooms.length);
                
            return res.status(200).json("图片被删除成功");
            
        }else if(cmd === "PHYSICAL_CLEAR_ROOM"){
            const deletedRooms = await prisma.room.findMany({
                where:{
                    createdAt: {
                        gte: params.startDate, // 大于等于起始日期
                        lte: params.endDate   // 小于等于结束日期
                            },
                    status: enums.roomStatus.delete,
                    OR: [
                      {resultType: "IMAGE"},
                      {resultType: "VOICE"},
                      {resultType: "VIDEO"}
                      ]
                },
                select:{
                    id: true,
                    outputImage: true
                }
            });
            debug.log("PHYSICAL_CLEAR_DATA found rooms:", deletedRooms.length);
            let failedRooms:any[] = [];
            for(const room of deletedRooms){
                try{
                    await fs.deleteFileByURL(room.outputImage);
                    debug.log("删除存储桶中的Room数据：", room.outputImage);
                    //await prisma.room.delete({ where: { id: room.id } });
                    //debug.log("删除数据库中Room记录：", room.id);
                }catch(err){
                    debug.error("PHYSICAL_CLEAR_DATA failed room:", JSON.stringify(room));
                    failedRooms.push(room);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));              
            }
            debug.log("PHYSICAL_CLEAR_ROOM delete room SUCCESS:", deletedRooms.length - failedRooms.length);
            debug.log("PHYSICAL_CLEAR_ROOM delete room FAILED:", failedRooms.length);
                
            return res.status(200).json("图片被删除成功");
            
        }else if(cmd === "PHYSICAL_CLEAR_USERFILE"){
            const deletedFiles = await prisma.userFile.findMany({
                where:{
                    createTime: {
                        gte: params.startDate, // 大于等于起始日期
                        lte: params.endDate   // 小于等于结束日期
                            },
                    OR: [
                      {status: enums.userFileStatus.deleted},
                      {userId: system.users.notLoginUserId}
                      ]
                },
                select:{
                    id: true,
                    url: true
                }
            });
            debug.log("PHYSICAL_CLEAR_DATA found user files:", deletedFiles.length);
            let failedFiles:any[] = [];
            for(const file of deletedFiles){
                try{
                    await fs.deleteFileByURL(file.url);
                    debug.log("删除存储桶中的UserFile数据：", file.url);
                    await prisma.userFile.delete({ where: { id: file.id } });
                    debug.log("删除数据库中UserFile记录：", file.id);
                }catch(err){
                    debug.error("PHYSICAL_CLEAR_DATA failed user file:", JSON.stringify(file));
                    failedFiles.push(file);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            debug.log("PHYSICAL_CLEAR_USERFILE delete user file SUCCESS:", deletedFiles.length - failedFiles.length);
            debug.log("PHYSICAL_CLEAR_USERFILE delete user file FAILED:", failedFiles.length);

            return res.status(200).json("图片被删除成功");

        }else if(cmd === "PHYSICAL_CLEAR_ALL_USERFILE"){
            const deletedFiles = await prisma.userFile.findMany({
                where:{
                    createTime: {
                        gte: params.startDate, // 大于等于起始日期
                        lte: params.endDate   // 小于等于结束日期
                            },
                },
                select:{
                    id: true,
                    url: true
                }
            });
            debug.log("PHYSICAL_CLEAR_ALL_USERFILE found user files:", deletedFiles.length);
            let failedFiles:any[] = [];
            for(const file of deletedFiles){
                try{
                    await fs.deleteFileByURL(file.url);
                    debug.log("删除存储桶中的UserFile数据：", file.url);
                    await prisma.userFile.delete({ where: { id: file.id } });
                    debug.log("删除数据库中UserFile记录：", file.id);
                }catch(err){
                    debug.error("PHYSICAL_CLEAR_DATA failed user file:", JSON.stringify(file));
                    failedFiles.push(file);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            debug.log("PHYSICAL_CLEAR_ALL_USERFILE delete user file SUCCESS:", deletedFiles.length - failedFiles.length);
            debug.log("PHYSICAL_CLEAR_ALL_USERFILE delete user file FAILED:", failedFiles.length);

            return res.status(200).json("图片被删除成功");          
        }else if(cmd === "PHYSICAL_CLEAR__NO_PAYMENT_USERFILE"){
            const deletedFiles = await prisma.userFile.findMany({
                where:{
                    createTime: {
                        gte: params.startDate, // 大于等于起始日期
                        lte: params.endDate   // 小于等于结束日期
                            },
                    user: {
                        boughtCredits: {
                            lte: 0
                        },
                        email: {
                            not: {
                                contains: "aiputi.cn" // 排除 email 包含 "aiputi.cn" 的用户
                                }
                        }                                            
                    },
                },
                select:{
                    id: true,
                    url: true
                }
            });
            debug.log("PHYSICAL_CLEAR__NO_PAYMENT_USERFILE found user files:", deletedFiles.length);
            let failedFiles:any[] = [];
            for(const file of deletedFiles){
                try{
                    await fs.deleteFileByURL(file.url);
                    debug.log("删除存储桶中的UserFile数据：", file.url);
                    await prisma.userFile.delete({ where: { id: file.id } });
                    debug.log("删除数据库中UserFile记录：", file.id);
                }catch(err){
                    debug.error("PHYSICAL_CLEAR_DATA failed user file:", JSON.stringify(file));
                    failedFiles.push(file);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            debug.log("PHYSICAL_CLEAR__NO_PAYMENT_USERFILE delete user file SUCCESS:", deletedFiles.length - failedFiles.length);
            debug.log("PHYSICAL_CLEAR__NO_PAYMENT_USERFILE delete user file FAILED:", failedFiles.length);

            return res.status(200).json("图片被删除成功");
                    
        }else{
            return res.status(400).json("给图片的命令未知");
        }
    }catch(error){
        debug.error("adminFileServer exception:", error);
        return res.status(500).json("adminFileServer发生意外失败！");
    }
}

