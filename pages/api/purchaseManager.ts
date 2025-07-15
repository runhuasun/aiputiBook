import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as fs from "../../utils/fileServer";
import * as du from "../../utils/dateUtils";

  
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        // debug.log("----start purchaseManager----");
        // Check if user is logged in
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user) {
            return res.status(500).json("请先登录！");
        }
        
        // Get user from DB
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                credits: true,
                actors: true
            },
        });  
        if(!user){
            return res.status(500).json("请先登录！");
        }
        
        let { id, cmd, pageSize, currentPage, queryAll, userId} = req.body;

        if(cmd == "SUM"){
            let whereTerm:any = {
                status: "PAID"
            };
            if(!(queryAll && user.actors && user.actors.indexOf("admin")>=0)){                
                whereTerm.userId = user.id;
            }

            whereTerm.payMethod = "ALIPAY";
            const aliSum = await sum(whereTerm);

            whereTerm.payMethod = "WECHATPAY";
            const wechatSum = await sum(whereTerm);

            return res.status(200).json({
                daySum:aliSum.daySum/100 + wechatSum.daySum/100, 
                weekSum:aliSum.weekSum/100 + wechatSum.weekSum/100, 
                monthSum:aliSum.monthSum/100 + wechatSum.monthSum/100, 
                yearSum:aliSum.yearSum/100 + wechatSum.yearSum/100,
                allSum:aliSum.allSum/100 + wechatSum.allSum/100,
            });
            

        }else if(cmd === "GOTOPAGE" && pageSize && currentPage){
            let whereTerm:any = {};
            
            if(user.actors?.indexOf("admin")>=0){                
                if(!queryAll){
                    if(userId){
                        whereTerm.userId = userId;    
                    }else{
                        whereTerm.userId = user.id;    
                    }
                }
            }else{
                whereTerm.userId = user.id;
            }
            const data = await prisma.purchase.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: [
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' }
                ],
            });
            debug.log("data:" + data.length);
            const dataCount = await prisma.purchase.count({where:whereTerm});
            const pageCount = Math.ceil(dataCount / pageSize);         
            for(const d of data){
                d.payMoney = d.payMoney/100;
                d.createdAt = du.UTCtoBJ(d.createdAt);
                d.updatedAt = du.UTCtoBJ(d.updatedAt);
            }
            return res.status(200).json({pageCount, data});
          
        }else{
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        debug.error(e);
        res.status(500).json("更新用户购买记录时发生意外失败！");
    }
}


export async function sum(whereTerm:any){
    // 合计
    whereTerm.updatedAt = {
        gte: new Date("2024-07-15"),
    }   
    const allSum = await prisma.purchase.aggregate({
        _sum: {
            payMoney: true,
        },
        where: whereTerm
    });

    const now = new Date();
    // 当天合计
    let start = new Date(now.setHours(0, 0, 0, 0));
    let end = new Date(now.setHours(23, 59, 59, 999));            
    whereTerm.updatedAt = {
        gte: start,
        lte: end
    }
    const daySum = await prisma.purchase.aggregate({
        _sum: {
            payMoney: true
        },
        where: whereTerm
    });

    // 当周合计
    start = new Date(now.setHours(0, 0, 0, 0));
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // 设置为周的第一天（假设周一是一周的开始）
    end = new Date(now.setHours(23, 59, 59, 999));      
    end.setDate(start.getDate() + 6);
    debug.log("week start:", start);
    debug.log("week end:", end);
    whereTerm.updatedAt = {
        gte: start,
        lte: end
    }          
    const weekSum = await prisma.purchase.aggregate({
        _sum: {
            payMoney: true
        },
        where: whereTerm
    });
    
    // 当月合计
    start = new Date(now);
    start.setDate(1);// 月的第一天
    start.setHours(0,0,0,0);
    end = new Date(now.getFullYear(), now.getMonth()+1, 0);
    end.setHours(23,59,59,999);
   // debug.log("monthSum start:", start);
   // debug.log("monthSum end:", end);
    whereTerm.updatedAt = {
        gte: start,
        lte: end
    }          
    const monthSum = await prisma.purchase.aggregate({
        _sum: {
            payMoney: true
        },
        where: whereTerm
    });

    // 当年合计
    start = new Date(now);
    if(start.getFullYear() == 2024){
        start.setMonth(7,1);// 8月1日
    }else{
        start.setMonth(0,1);// 年的第一天
    }
    start.setHours(0,0,0,0);
    end = new Date(now);
    end.setMonth(11,31); // 年的最后一天
    end.setHours(23,59,59,999);
    //debug.log("year start:", start);
    //debug.log("year end:", end);
    whereTerm.updatedAt = {
        gte: start,
        lte: end
    }          
    const yearSum = await prisma.purchase.aggregate({
        _sum: {
            payMoney: true
        },
        where: whereTerm
    });

    // debug.log("SUM:", JSON.stringify(daySum), JSON.stringify(weekSum), JSON.stringify(monthSum), JSON.stringify(yearSum), JSON.stringify(allSum));
    return {
        daySum:daySum?._sum?.payMoney||0, 
        weekSum:weekSum?._sum?.payMoney||0, 
        monthSum:monthSum?._sum?.payMoney||0, 
        yearSum:yearSum?._sum?.payMoney||0,
        allSum:allSum?._sum?.payMoney||0,
    };
}
