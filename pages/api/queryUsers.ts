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
        const { cmd, id, name, source, invitedbycode, orderBy, startDate, endDate, pageSize, currentPage } = req.body;
        
        debug.log("---Enter update model Manager-----");            
        // Check if user is logged in
        const session = await getServerSession(req, res, authOptions);
        let operator;

        if(cmd != "GOTOPAGE"){
            if (!session || !session.user) {
                return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
            }
            
            // Get user from DB
            operator = await prisma.user.findUnique({
                where: {
                    email: session.user.email!,
                },
            });
            // Check if user has any credits left
            if(operator?.actors){
                if(operator.actors.indexOf("admin") < 0){
                    return res.status(500).json("该操作需要系统管理员权限登录！");
                }
            }else{
                return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
            }
        }
        
       if(cmd == "GOTOPAGE" && pageSize && currentPage){
    
           let users:any[] = [];
           let pageCount = 0;
           let rowCount = 0;
           
           let whereTerm:any = {
                createdAt: {
                    gt: startDate,
                    lt: endDate
                }
           };
           if(id){
               whereTerm.id = { contains: id };
           }
           if(name){
               whereTerm.name = { contains: name };
           }
           if(source){
               whereTerm.source = { contains: source };
           }
           if(invitedbycode){
               whereTerm.invitedbycode = { contains: invitedbycode };
           }

           const orderByTerm:any[] = [ {createdAt: 'desc'} ];
           if(orderBy == "source"){
               orderByTerm.unshift( {source: 'desc'} );
           }
           const selectTerm = {
               id: true,
               name: true,
               email: true,
               credits: true,
               boughtCredits: true,
               usedCredits: true,
               invitedbycode: true,
               createdAt: true,
               source: true,
               grade: true
           }
           debug.log("Query User Where Term:" + JSON.stringify(whereTerm));
           rowCount = await prisma.user.count({where:whereTerm});
           pageCount = Math.ceil(rowCount / pageSize);        
           users = await prisma.user.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                select: selectTerm,
                orderBy: orderByTerm
            });
            debug.log("rowCount:" + rowCount);
            debug.log("pageCount:" + pageCount);           
            debug.log("user rows:" + users.length);
           
           return res.status(200).json({pageCount, rowCount, users});   
          
        }else{
            debug.error("给应用的命令未知");
            res.status(400).json("给应用的命令未知");
        }
    
    }catch(e){
        debug.error(e);
        res.status(500).json("查询用户时发生意外失败！");
    }
}
