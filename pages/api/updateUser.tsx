import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash , compare } from "bcrypt";
import nodemailer  from "nodemailer";
import { User } from "@prisma/client";
import { getGradeByBC } from "../../utils/grade";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {isURL} from "../../utils/fileUtils";
import * as fs from "../../utils/fileServer";


export type UserData = {
    email: string | null;
};
 
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<UserData | string>
) {
    try{   
        let { id, name, email, password, image, desc } = req.body;
        
        const sameuser = await prisma.user.findMany({
            where: {
                name: name,
            },
        });
        if(sameuser.length > 0 && (sameuser[0].id != id)){
            return res.status(500).json("用户名和现有用户重复，请换一个名字试试！");
        }
        if(image && !fs.inBucket(image)){
            image = await fs.moveToFileServer(image);
        }
            
        if(password.trim().length > 0){
            await prisma.user.update({
                where: {
                    id: id,
                },
                data: {
                    name,
                    password: await hash(password, 10),
                    image,
                    desc
                },
            });
        }else{
            await prisma.user.update({
                where: {
                    id: id,
                },
                data: {
                    name,
                    image,
                    desc
                },
            });    
        }
        res.status(200).json("用户信息修改成功");
    }catch(error){
        console.error(error);
        res.status(500).json("服务器发生意外错误，请和网站管理员联系！");
    }
}


export async function removeWatermark(user:any){
    try{
        log("user: ", JSON.stringify(user));
        const rooms = await prisma.room.findMany({
            where: {
                userId: user.id,
                outputImage: {
                    contains: '?x-oss-process=image/watermark',
                    mode: 'insensitive', // 不区分大小写，取决于数据库配置和需要
                },
                status: "SUCCESS"
            },
            select:{
                id: true,
                outputImage: true
            }
        });
        log("rooms find count:", rooms.length);
        log("rooms find:", JSON.stringify(rooms));
        const regex = /\?x-oss-process=image\/watermark.*/;
        for(const room of rooms){
            log("room:", JSON.stringify(room));
            if(room.outputImage && isURL(room.outputImage)){
                const newUrl = room.outputImage.replace(regex, '');
                log("newUrl: ", newUrl);
                if(room.id && newUrl){
                    await prisma.room.update({
                        where: {
                            id: room.id
                        },
                        data: {
                            outputImage: newUrl
                        }
                    });
                }
            }
        }
    }catch(e){
        error("removeWatermark exception:", e);
    }
}

