import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as fs from "../../utils/fileServer";
import {system} from "../../utils/config";
import {isURL, getRedirectedUrl} from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import * as audit from "../../utils/auditUtils";

  
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        debug.log("----start userFileManager----");
      
        let { id, cmd, url, type, desc, pageSize, currentPage, backup, userId} = req.body;

        // Check if user is logged in
        const session = await getServerSession(req, res, authOptions);
        let userEmail = session?.user?.email;
        let user:any;
        
        if (!userEmail) {
            if(cmd != "ADDFILE"){
                return res.status(500).json("更新用户文件请先登录！");
            }else{
                // 未登录用户上传的文件被放在这里
                user = await prisma.user.findUnique({
                    where: {
                        id: system.users.notLoginUserId
                    },
                    select: {
                        id: true,
                        credits: true,
                        boughtCredits: true,
                        actors: true
                    },
                });  
            }
        }else{       
            user = await prisma.user.findUnique({
                where: {
                    email: userEmail,
                },
                select: {
                    id: true,
                    credits: true,
                    actors: true,
                  boughtCredits: true
                },
            });  
        }
        if(!user){
            return res.status(500).json("更新用户文件请先登录！");
        }
        

        if(cmd === "RAISE_SCORE"){
            
            await prisma.userFile.update({
                where: {
                    id: id,
                },
                data: {
                    score: {
                        increment: 1
                    },              
                }
            });
            res.status(200).json({id});

        }else if(cmd === "ADDFILE" && url && type){
            // 审核内容  
            const auditResult = await audit.auditURL(url, type);
            // 这几种情况绝对禁止！！！！！
            if(["Z", "T", "D"].includes(auditResult)){
                debug.warn("发现严重违规数据，删除存储桶中的数据：" + url);                                
                await fs.deleteFileByURL(url);
                return await res.status(enums.resStatus.inputNSFW).json("您的输入内容包含敏感信息，无法为您处理！");
            }
            if(auditResult !== "N"){
                const backupImage = await fs.backupToUS(url);
                debug.log(`发现不符合规范文件，备份${url}到-->${backupImage}`);                
                await fs.deleteFileByURL(url);
                debug.warn("删除存储桶中的数据：" + url);                  
                url = backupImage;
            }            
            const newFile = await prisma.userFile.create({
                data: {
                    url: url,
                    type: type,
                    desc: desc,   
                    access: "PRIVATE",
                    score: 0,
                    status: "CREATED",
                    user: { connect: { id: user.id } }, 
                }
            });
            res.status(200).json({id:newFile.id, url});

        }else if(cmd === "PHYSICAL_DELETE"){
            // 物理删除，也就是从存储中彻底删除，也从数据库中删除
            if(user?.actors && user.actors.indexOf("admin")){
                debug.warn("系统管理员物理的删除一条图片记录");
                const file = await prisma.userFile.findUnique({ where:{ id:id} });
                if(file && isURL(file.url)){
                    debug.warn("删除存储桶中的数据：" + file.url);
                    await fs.deleteFileByURL(file.url);

                    debug.warn("删除数据库中的数据：" + JSON.stringify(file));
                    await prisma.userFile.delete({ where: { id: id } });
                  
                    return res.status(200).json("图片在存储桶和数据库中被彻底删除成功");
                }
            }
          
        }else if(cmd === "DELETE" && id){
            if(process.env.CONSTRAIN_PAYMENT_DELETE == "TRUE"){
                if(user.boughtCredits <= 0){
                    return res.status(enums.resStatus.constrainOpPaymentDelete).json("感谢您的试用，删除上传文件是付费用户的专有功能。请付费后重试，谢谢！");
                }
            }
            // 删除
            let oldFile = await prisma.userFile.update({
              where: {
                  id: id,
              },
              data: {
                  status: "DELETED",
              }
            });
            res.status(200).json({id});
          
            backup = true; // 所有标记删除的，都把数据备份到US
            if(backup){
                if(oldFile && isURL(oldFile.url)){
                    const backupImage = await fs.backupToUS(oldFile.url);
                    debug.log(oldFile.url, "备份到-->", backupImage);                
                    await fs.deleteFileByURL(oldFile.url);
                    debug.warn("删除存储桶中的数据：" + oldFile.url);                
                    const newRoom = await prisma.userFile.update({
                        where: {
                            id: id,
                        },
                        data: {
                            url: backupImage
                        }
                    });
                }
            }

        }else if(cmd == "BACKUP_TO_US"){
            let oldFile:any;
            oldFile = await prisma.userFile.findUnique({ where:{ id:id} });
            if(oldFile && isURL(oldFile.url)){
                const backupImage = await fs.backupToUS(oldFile.url);
                debug.log(oldFile.url, "备份到-->", backupImage);                
                await fs.deleteFileByURL(oldFile.url);
                debug.warn("删除存储桶中的数据：" + oldFile.url);                
                const newRoom = await prisma.userFile.update({
                    where: {
                        id: id,
                    },
                    data: {
                        url: backupImage
                    }
                });
            }
            return res.status(200).json({id});
         
        }else if(cmd === "GOTOPAGE" && pageSize && currentPage){
            const filterUserId = user.actors.indexOf("admin")>=0 ? (userId || user.id) : user.id;
            let whereTerm:any = {
                OR: [
                    { userId: filterUserId }, // 我的图片
                    { access: 'PUBLIC' } // 或者公开的图片
                    ],
                status: {
                    notIn: ['DELETE', 'FAILED', 'DELETED', 'CREATING']
                },
                type: type=="ALL" ? undefined : (type || "IMAGE"),
                desc: desc
            };
            debug.log("WhereTerm:" + JSON.stringify(whereTerm));
          
            const userFileCount = await prisma.userFile.count({where:whereTerm});
            const pageCount = Math.ceil(userFileCount / pageSize);         
            const userFiles = await prisma.userFile.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: [
                  { createTime: 'desc' },
                  { score: 'desc' }
                ],
                select: {
                    id: true,
                    url: true,
                    type: true
                }                    
            });
            debug.log("userFiles:" + userFiles.length);
            res.status(200).json({pageCount, userFiles});
          
        }else{
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        debug.error(e);
        res.status(500).json("更新用户上传的文件时发生意外失败！");
    }
}
