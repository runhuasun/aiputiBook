const axios = require('axios');
const JSZip = require('jszip');
const fs = require('fs');
const { pipeline } = require('stream');
import { EventEmitter } from 'events';
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import { uploadFileToServer } from "../../utils/fileServer";
import * as fu from "../../utils/fileUtils";
import * as du from "../../utils/dateUtils";
import {findUserSource} from "./createuser";
import * as baidu from "../../utils/baidu";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        debug.log("----Start AlbumManager Running----");
        const {email, cmd, userId, startDate, endDate, ip, path, pageSize, currentPage} = req.body;
        debug.log(JSON.stringify(req.body));
      
        let userEmail = email;
        if(!userEmail){
            const session = await getServerSession(req, res, authOptions);            
            if (session && session.user) {
                userEmail = session.user.email!;
            }else{
                if(cmd != "ALBUM_ROOMS_GOTOPAGE"){
                    return res.status(500).json("进行相册操作前，请先登录！");
                }
            }
        }
      
        let user:any;
        if(userEmail){
            user = await prisma.user.findUnique({
                where: {
                    email: userEmail,
                },
                select: {
                    id: true,
                    name:true,
                    credits: true,
                    actors: true
                },
            });  
        }
        if(!user || user.actors.indexOf("admin")<0){
            return res.status(500).json("没有权限操作！");
        }

        if(cmd === "CALL_BACK_OCPC_REG"){
            const traceUser = await prisma.user.findUnique({
                where:{
                    id: userId
                },
                select:{
                    source: true
                }
            });
            if(traceUser?.source){
                await baidu.callBackOCPC_REG(traceUser.source);
            }
            return res.status(200).json("OCPC完成注册回调操作！");
        }else if(cmd === "CALL_BACK_OCPC_PAY"){
            const traceUser = await prisma.user.findUnique({
                where:{
                    id: userId
                },
                select:{
                    source: true
                }
            });
            if(traceUser?.source){
                await baidu.callBackOCPC_PAY(traceUser.source);
            }
            return res.status(200).json("OCPC完成付款回调操作！");
          
        }else if(cmd == "BUILD_SOURCE"){
            // 找到所有没source的用户
            const users = await prisma.user.findMany({
                where:{
                    source: null
                },
                select:{
                    id: true,
                    name: true,
                    source: true
                }
            });
            debug.log(JSON.stringify(users));
            // 找到所有用户的source
            // 排除系统IP
            const webSiteIPs = JSON.parse(process.env.WEBSITE_IPS!);
            for(let u of users){
                u = await findUserSource(u);
                if(!u?.source){
                    await prisma.user.update({
                        where:{
                            id:u.id
                        },
                        data:{
                            source: "no source"
                        }
                    });
                }
            }

            return res.status(200).json("build source success!");

        }else if(cmd == "GOTOPAGE" && pageSize && currentPage){
            // 找到用户的IP，可能有多个          
            const rows = await prisma.sysTrace.findMany({
                where:{
                    userId: userId
                },
                distinct:['ip'],
                select: {
                    ip: true
                },
            });
            const IPs:string[] = [];
            for(const row of rows){
                if(row?.ip){
                    IPs.push(row.ip);
                }
            }
            if(IPs.length>0){
                let whereTerm = {
                    OR: [
                      {userId:userId},
                      {userId:null}
                    ],
                    ip: {
                        in: IPs
                    }
                }
                const rowCount = await prisma.sysTrace.count({where:whereTerm});
                const pageCount = Math.ceil(rowCount / pageSize);        
                const traces = await prisma.sysTrace.findMany({
                    where: whereTerm,
                    take: pageSize,
                    skip: (currentPage-1) * pageSize,
                    orderBy: [
                        { createTime: 'desc' }
                    ]
                });
                for(const t of traces){
                    t.createTime = du.UTCtoBJ(t.createTime);
                }
                return res.status(200).json({pageCount, traces});   
            }

            return res.status(200).json({pageCount:0, traces:[]});

        }else if(cmd == "GOTO_TRACE_PAGE" && pageSize && currentPage){
            // 找到用户的IP，可能有多个
            let whereTerm = {
                ip: {
                    contains: ip,
                },
                path: {
                    contains: path
                },
                createTime: {
                    gt: startDate,
                    lt: endDate
                },
            };

            const rowCount = await prisma.sysTrace.count({where:whereTerm});
            const pageCount = Math.ceil(rowCount / pageSize);        
            const traces = await prisma.sysTrace.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: [
                    { createTime: 'desc' }
                ]
            });
            for(const t of traces){
                t.createTime = du.UTCtoBJ(t.createTime);
            }
            return res.status(200).json({pageCount, traces});   
                   
        }else{
            debug.error("给应用的命令未知");
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        debug.error(e);
        res.status(500).json("更新应用时发生意外失败！");
    }
}


