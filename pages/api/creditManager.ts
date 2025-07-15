import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash , compare } from "bcrypt";
import nodemailer  from "nodemailer";
import { User } from "@prisma/client";
import * as cu from "./createuser";

import { getGradeByBC } from "../../utils/grade";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {isURL} from "../../utils/fileUtils";
import * as fs from "../../utils/fileServer";
import * as enums from "../../utils/enums";
import {removeWatermark} from "./updateUser";
import * as du from "../../utils/dateUtils";
import * as monitor from "../../utils/monitor";
import * as baidu from "../../utils/baidu";

const creditName = process.env.AIPUTI_CREDIT_NAME!;     
const inviteBonus = parseInt(process.env.AIPUTI_INVITE_BONUS!);

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try{   
        log("----entering credit manager ----");
        let { cmd, userId, roomId, queryAll, pageSize, currentPage, } = req.body;

        // 判断登录
        const session = await getServerSession(req, res, authOptions);            
        let user:any;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where:{
                    email:session.user.email
                }
            });
        }
        
        monitor.logApiRequest(req, res, session, user, req.body);
        
        if(!user){
            return res.status(enums.resStatus.unauthErr).json("这是未授权得操作，请先登录后再操作！");
        }      

        
        // 进行相关操作
        switch(cmd){
            case "TASK_EVALUATE_ROOM":{
                let bonus = 0;
                const userCreditItems = await prisma.creditItem.findMany({
                    where:{
                        userId:user.id,
                        operation: enums.creditOperation.TASK_EVALUATE_ROOM,
                    },
                    take: 1,
                    orderBy:[
                        { createTime: 'asc' }
                    ]
                });
                // 如果曾经完成过这个任务，就随机给一个BONUS
                if(userCreditItems.length>0 && userCreditItems[0].amount>0){
                    bonus = generateRandomNumber();
                }else{
                    // 从来没有做过任务的人，第一次给4个
                    bonus = 4;
                }
                await giveFreeCreditsById(user.id, bonus, enums.creditOperation.TASK_EVALUATE_ROOM);

                return res.status(enums.resStatus.OK).json({bonus});
            }

            case "HAS_CLOCK_IN_RECORD":{
                // 判断用户是否有过打卡记录
                const userCreditItems = await prisma.creditItem.findMany({
                    where:{
                        userId:user.id,
                        operation: enums.creditOperation.CLOCK_IN
                    },
                    take: 1,
                    orderBy:[
                        { createTime: 'desc' }
                    ]
                });
                if(userCreditItems?.length > 0){
                    return res.status(enums.resStatus.OK).json({hasCockInRecord:true});
                }else{
                    return res.status(enums.resStatus.OK).json({hasCockInRecord:false});                    
                }
            }
            case "CLOCK_IN": {
                // 先检查用户是否已经打卡
                const today = new Date();
                log("today day:", today.getDate());
                log("today date:", du.showDateTime(today));
                const userCreditItems = await prisma.creditItem.findMany({
                    where:{
                        userId:user.id,
                        operation: enums.creditOperation.CLOCK_IN
                    },
                    take: 1,
                    orderBy:[
                        { createTime: 'desc' }
                    ]
                });
                if(userCreditItems.length>0 && userCreditItems[0].createTime){
                    const lastDate = userCreditItems[0].createTime;
                    log("lastDate day:", lastDate.getDate());
                    log("lastDate date:", du.showDateTime(lastDate));
                    if(today.getFullYear() == lastDate.getFullYear() && 
                       today.getMonth() == lastDate.getMonth() &&
                       today.getDate() == lastDate.getDate()){
                        // 如果已经打卡就提示用户
                        return res.status(enums.resStatus.expErr).json("您今天已经打过卡了，请明天再来领取打卡奖励吧！");
                    }
                }

                // 如果没有打卡就打卡
                const clockInBonus = parseInt(process.env.AIPUTI_CLOCK_IN_BONUS!) + (user?.grade || 0);
                await giveFreeCreditsById(user.id, clockInBonus, enums.creditOperation.CLOCK_IN);
                
                return res.status(enums.resStatus.OK).json(`您今天打卡获得了${clockInBonus}个${config.creditName}！`);
            }
            case "GOTOPAGE": {
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
    
                const data = await prisma.creditItem.findMany({
                    where: whereTerm,
                    take: pageSize,
                    skip: (currentPage-1) * pageSize,
                    orderBy: [
                        { createTime: 'desc' }
                    ],
                });
                log("data:" + data.length);
                const dataCount = await prisma.creditItem.count({where:whereTerm});
                const pageCount = Math.ceil(dataCount / pageSize);         
                for(const d of data){
                    d.createTime = du.UTCtoBJ(d.createTime);
                }
                return res.status(200).json({pageCount, data});
            }          
        }
        res.status(enums.resStatus.unknownCMD).json("未知操作！");
    }catch(error){
        console.error(error);
        res.status(enums.resStatus.unExpErr).json("服务器发生意外错误，请和网站管理员联系！");
    }
}

function generateRandomNumber() {
    let randomNumber = Math.random() * 10000;  // 生成一个0到10000的随机数

    if (randomNumber < 6000) {  // 30%的概率
        return 0;
    } else if (randomNumber < 9000) {  // 30%的概率
        return 1;
    } else if (randomNumber < 9600) {  // 20%的概率
        return 2;  // 返回2
    } else if (randomNumber < 9800) {  // 10%的概率
        return 3 + Math.floor(Math.random() * 8);  // 返回3到10
    } else if (randomNumber < 9900) { // 5%的概率
        return 11 + Math.floor(Math.random() * 10);  // 返回11到20
    } else if (randomNumber < 9980) { // 3%的概率
        return 21 + Math.floor(Math.random() * 20);  // 返回21到40
    } else if (randomNumber < 9995) { // 1%的概率
        return 41 + Math.floor(Math.random() * 20);  // 返回41到60
    } else if (randomNumber < 9997) { // 0.5%的概率
        return 61 + Math.floor(Math.random() * 40);  // 返回61到100
    } else if (randomNumber < 9998) { // 0.25%的概率
        return 101 + Math.floor(Math.random() * 100);  // 返回101到200
    } else if (randomNumber < 9999) { // 0.1%的概率
        return 201 + Math.floor(Math.random() * 100);  // 返回201到300
    } else if (randomNumber < 9999.5) { // 0.05%的概率
        return 301 + Math.floor(Math.random() * 100);  // 返回301到400
    } else if (randomNumber < 9999.99) { // 0.04%的概率
        return 401 + Math.floor(Math.random() * 100);  // 返回401到500
    } else {  // 0.01%的概率
        return 501 + Math.floor(Math.random() * 499);  // 返回501到999
    }
}
        
export async function useCredits(user:any, needCredits:number, operation:string, objectId:string){
    log(`扣除用户${user.id}|${user.name},${needCredits}个点，操作${operation}，目标对象${objectId}`);
    try{
        if(user && user.id && needCredits){
            const decrementOfCredits = needCredits < user.credits ? needCredits : user.credits;
            const decrementOfIncomeCredits = (user.incomeCredits <= 0) ? 0 : ( needCredits < user.incomeCredits ? needCredits : user.incomeCredits);
            const isFirstOperation = user.usedCredits === 0;
            
            if(decrementOfCredits>0){
                await prisma.creditItem.create({
                    data:{
                        userId:user.id,
                        amount: -decrementOfCredits,
                        operation: operation,
                        objectId: objectId,
                    }
                });
                await prisma.user.update({
                    where: {
                        id:user.id,
                    },
                    data: {
                        credits: {
                            decrement: decrementOfCredits,
                        },
                        incomeCredits: {
                            decrement: decrementOfIncomeCredits,
                        },    
                        usedCredits: {
                            increment: decrementOfCredits,
                        }
                    },
                });
            }

            if(isFirstOperation){
                log(`--------------------用户第一次使用--------------------`);

                log(`反馈OCPC注册并且第一次试用`);
                setTimeout(async () => {
                    try {
                        let callBackUser = user;
                        if(!callBackUser?.source){
                            callBackUser = await cu.trackSourceOfUser(user);    
                        }
                        if(callBackUser?.source){
                            await baidu.callBackOCPC_REG(user.source);
                        }
                    } catch (e) {
                        error("Failed to call callBackOCPC_REG source:", e);
                    }
                }, 0); 

                if(user.invitedbycode && user.invitedbycode!="walkin"){
                    log('检测是否已经给过邀请奖励');
                    const exists = await prisma.creditItem.findMany({
                        where:{
                            userId: user.invitedbycode,
                            objectId: user.id,
                            operation: enums.creditOperation.INVITE_BONUS
                        },
                        select:{ id: true }
                    });
                    log(`exists:${exists}`);
                    if(!exists || exists.length === 0){
                        log(`给邀请他的用户奖励：[${isFirstOperation}]/[${user.invitedbycode}]`);                                    
                        await giveFreeCreditsById(user.invitedbycode, inviteBonus, enums.creditOperation.INVITE_BONUS, user.id);
                        log(user.invitedbycode + "邀请" + user.id + "注册了，奖励" + inviteBonus + "个" + creditName + "已到账！");   
                    }
                }
            }
        }

    }catch(e){
        error("扣除用户提子时发生未知错误！请尽快检查", e, user?.name, needCredits, operation, objectId);
        return false;
    }

    return true;
}

export async function returnCreditsById(id:string, credits:number, operation:string, objectId:string){
    if(id){
        const user = await prisma.user.findUnique({where:{id}});
        if(user){
            return await returnCredits(user, credits, operation, objectId);
        }
    }
}

export async function returnCredits(user:any, credits:number, operation:string, objectId:string){
    log(`returning ${credits} credits to ${user?.name}(${user?.id})`); 
    try{
        if(user && user.id){
            //检查不能有相同的退款
            const exist = await prisma.creditItem.findFirst({
                where:{
                    userId:user.id,
                    amount: credits,
                    operation: operation,
                    objectId: objectId,
                }
            });
            if(!exist){
                await prisma.creditItem.create({
                    data:{
                        userId:user.id,
                        amount: credits,
                        operation: operation,
                        objectId: objectId,
                    }
                });            
                return await prisma.user.update({
                    where: {
                        id:user.id
                    },                
                    data: {
                        credits: {
                            increment: credits,
                        },
                        incomeCredits: {
                            //increment: credits < user.incomeCredits ? credits : user.incomeCredits,
                            increment: user.incomeCredits >0 ? credits : 0
                        },        
                        usedCredits: {
                            decrement: user.usedCredits >= credits ? credits : user.usedCredits
                        }                    
                    },
                });      
            }else{
                error("returnCredits：拦截了意外多次退款的情况！请尽快检查！");
            }
        }
    }catch(e){
        error("returnCredits：返还给用户提子时发生未知错误！请尽快检查");
    }
}

export async function giveFreeCreditsById(userId:string, credits:number, operation:string, objectId?:string){
    log(`giving ${credits} credits to ${userId} for ${operation} at ${objectId}`);
    if(userId && credits){
        await prisma.creditItem.create({
            data:{
                userId: userId,
                amount: credits,
                operation: operation,
                objectId: objectId
            }
        });
        return await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                credits: {
                    increment: credits,
                },
            },
        });
    }
}


export async function boughtCreditsById(id:string, credits:number){
    if(id && credits){
        const user = await prisma.user.findUnique({
            where: { id }
        });
        return await boughtCredits(user, credits);
    }
}


export async function boughtCredits(user:any, credits:number){
    if(user && credits){

        // 为用户充值，并晋升级别
        const newGrade = getGradeByBC(user.boughtCredits + credits);
        const userUpdated = await prisma.user.update({
            where: {
                id:user.id
            },
            data: {
                credits: {
                    increment: credits,
                },
                boughtCredits: {
                    increment: credits,
                },
                grade: newGrade.grade
            }
        });
        await prisma.creditItem.create({
            data:{
                userId: user.id,
                amount: credits,
                operation: enums.creditOperation.BOUGHT,
            }
        });        
        log(`${user.id}成功充值了${credits}`);
        
        //如果有邀请人，就给邀请人奖励
        if(config.ICR && user.invitedbycode && user.invitedbycode != "walkin"){
            const commission = Math.round(credits * config.ICR);
            await prisma.user.update({
                where: {
                    id:user.invitedbycode
                },
                data: {
                    credits: {
                        increment: commission,
                    },
                },
            });
            await prisma.creditItem.create({
                data:{
                    userId: user.invitedbycode,
                    amount: commission,
                    operation: enums.creditOperation.INVITE_COMMISSION,
                    objectId: user.id
                }
            });        
            log(`${user.invitebycode}邀请的${user.id}充值${credits}，从而获得了${commission}奖励`);
        }

        // 回调百度OCPC记录
        // 如果用户首次晋级VIP，触发 OCPC 回调        
        // 因为可能注册完太快购买，所以还没有生成source，所以单独启动一条线程，延迟3分钟再做处理
        if( (!user.grade || user.grade < 1) && (newGrade.grade >= 1) ){
            log(`等待3分钟再执行OCPC回调检查...`);
            setTimeout(async () => {
                try{
                    const nu = await prisma.user.findUnique({
                        where: { id:user.id},
                        select: { id:true, source:true, grade:true, boughtCredits:true}
                    });
                    if(nu){
                        log(`回调百度OCPC记录 source:${nu.source} grade:${nu.grade} user.boughtCredits:${nu.boughtCredits}`);
                        if (nu.source) {
                            log(`a qualified payment client ${nu.id} call callBackOCPC`);
                            await baidu.callBackOCPC_PAY(nu.source);
                        }
                    }
                }catch(err){
                    error("OCPC_Payment回调出错:", err);
                }
            }, 3 * 60 * 1000); // 3分钟 = 180000ms
        }
        
        await removeWatermark(user);
        
        return userUpdated;
    }
}


export async function giveUserModelIncome(userId:string, modelId:string, totalIncome:number, userIncome:number){
    log(`给模型${modelId}的用户${userId}收入${userIncome}个点`);
    try{
        if(userId && modelId && totalIncome && userIncome){
            await prisma.creditItem.create({
                data:{
                    userId,
                    amount: userIncome,
                    operation: enums.creditOperation.MODEL_INCOME,
                    objectId: modelId,
                }
            });
            
            await prisma.model.update({
                where: {
                    id: modelId,
                },
                data: {
                    runtimes: {
                        increment: 1,
                    },                  
                    totalIncome: {
                        increment: totalIncome,
                    },
                    ownerIncome: {
                        increment: userIncome, 
                    },                              
                },
            });               
            //////////////////////////
            // 给模型的作者分账
            await prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    credits: {
                        increment: userIncome,
                    },
                    incomeCredits: {
                        increment: userIncome,
                        //increment: Credits > 0 ? userIncome : 0, // 为什么只有大于0的才分账，忘了原因
                    },    
                },
            });
        }
    }catch(e){
        error(`给模型${modelId}的用户${userId}收入${userIncome}个点时发生未知错误！请尽快检查`);
    }
}


// 这个函数理论上一个系统只执行一次
export async function initCreditItemTable(){
    const users = await prisma.user.findMany({
        select: {
            id: true,
            credits: true,
            boughtCredits: true,
            incomeCredits: true,
            usedCredits: true
        }
    });
    for(const u of users){
        await prisma.creditItem.create({
            data:{
                amount: u.credits,
                userId: u.id,
                operation: enums.creditOperation.INIT,
            }
        });
    }
}
