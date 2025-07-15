import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import nodemailer  from "nodemailer";
import  isMobilePhone from 'validator';
import validator from 'validator';
import { hash , compare } from "bcrypt";

import prisma from "../../lib/prismadb";

import {createDefModel} from './trainChatModel';
import {giveFreeCreditsById} from "./creditManager";
import {removeWatermark} from "./updateUser";

import * as enums from "../../utils/enums";
import {config, defaultImage} from "../../utils/config";
import {log, warn, error} from "../../utils/debug";
import * as debug from "../../utils/debug";
import * as baidu from "../../utils/baidu";
import * as monitor from "../../utils/monitor";


export type UserData = {
  email: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    name: string;
    email: string;
    password: string;
    invitecode : string;
  };
}

const creditName = process.env.AIPUTI_CREDIT_NAME!;     
const inviteBonus = parseInt(process.env.AIPUTI_INVITE_BONUS!);

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<UserData | string>
) {
    try{   
      const { name, email, password, invitecode } = req.body;

      const freeCredits = parseInt(process.env.AIPUTI_FREE_CREDITS!);

      
/*        
      if(invitecode != ""){
      
      // 这个逻辑将来再扩展，暂时用简单逻辑
     ////////////////////////////////
    
          let codes = await prisma.invitation.findMany({
          where: {
              code: invitecode,
          },
          select: {
            authTime: true,
            expTime: true,
          },
        });
        if(codes.length == 0){
          return res.status(500).json("不存在的邀请码，请和邀请者确认！");
        }

        const now = new Date();
        if(now < codes[0].authTime || codes[0].expTime < now){
          return res.status(500).json("邀请码已经过期，请和邀请者确认！");
        }
      
      }
*/   
        if(email){
            const hasuser = await prisma.user.findUnique({
                where: {
                    email: email,
                },
            });
            if(hasuser){
                return res.status(400).json("这个电话/email已经被注册了，请直接去登录！");
            }
        }

        if(name){
            const sameuser = await prisma.user.findMany({
                where: {
                    name: name,
                },
            });
            if(sameuser.length > 0){
                return res.status(400).json("用户名和现有用户重复，请换一个名字试试！");
            }
        }

        if(invitecode){
            const inviter = await prisma.user.findUnique({
                where: {
                    id: invitecode
                }
            });
            if(!inviter){
                return res.status(400).json("邀请码不存在，请与您的邀请者核实邀请码");
            }
        }
        
        let newuser = null;
        if(validator.isMobilePhone(email, 'zh-CN')){
            newuser = await prisma.user.create({
                data: {
                    name: name,
                    email: email,
                    credits: 0, 
                    password: await hash(password, 10),
                    invitedbycode : ((invitecode==null) || (invitecode=="")) ? "walkin" : invitecode,
                    image: defaultImage.userCover,
                    emailVerified: new Date().toISOString(),
                },
            });

            // 给新用户初始credits
            await giveFreeCreditsById(newuser.id, freeCredits, enums.creditOperation.NEW_USER);
            if(invitecode){
                await inviteUser(newuser.id, invitecode);
                // log(invitecode + "邀请" + name + "注册了，奖励" + inviteBonus + "个" + creditName + "已到账！");
                // 给邀请的用户不可提现的credit奖励
                // await giveFreeCreditsById(invitecode, inviteBonus, enums.creditOperation.INVITE_BONUS, newuser.id);
            }    
        }else{
            newuser = await prisma.user.create({
                data: {
                    name: name,
                    email: email,
                    credits: 0, // 如果用邮箱此时不再给credit，到确认邮件的时候给
                    password: await hash(password, 10),
                    invitedbycode : ((invitecode==null) || (invitecode=="")) ? "walkin" : invitecode,
                    image: defaultImage.userCover,
                },
            });
            
            // 发送确认邮箱的邮件
            sendConfirmation(email, res);
        }

        
        if(newuser){
            trackSourceOfUser(newuser);
          
            // 新用户给一个个人小模型          
            const defModel = await createDefModel(newuser);
        }
        
        res.status(200).json("用户创建成功");

        monitor.logApiRequest(req, res, null, newuser, req.body);
    }catch(e){
        error(e);
        res.status(500).json("服务器发生意外错误，请和网站管理员联系！");
    }
}


// 处理用户邀请逻辑
export async function inviteUser(userId:string, invitecode:string){
    if(invitecode && userId){
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if(user){
            if(!user.invitedbycode){
                // 记录邀请用户
                await prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        invitedbycode: invitecode || "walkin",
                    },
                });   
            }
            // 给发出邀请的用户inviteBonus个不可提现的credit奖励
            // 改为被邀请用户第一次使用时才给出奖励
            // await giveFreeCreditsById(invitecode, inviteBonus, enums.creditOperation.INVITE_BONUS, userId);
            // log(invitecode + "邀请" + userId + "注册了，奖励" + inviteBonus + "个" + creditName + "已到账！");

            const invitedUsers = await prisma.user.findMany({
                where: {
                    invitedbycode: invitecode
                }
            });
            if(invitedUsers.length >= 3){
                removeWatermark(user);
            }
        }
       
    }   
}



export async function sendConfirmation(email: string, res: NextApiResponse<UserData | string>){
  error("start send email---");
  
  try{
      // 发送确认邮件
     const transporter = await nodemailer.createTransport({
        host: process.env.MAIL_SERVICE_HOST!,
        port: parseInt(process.env.MAIL_SERVICE_PORT!), 
        secure: true,
        auth: {
            user: process.env.MAIL_SERVICE_AUTH_USER!,
            pass: process.env.MAIL_SERVICE_AUTH_PASS!
        }
    });       


    const hashcode = await hash(email, 10);
    const confirmLink = process.env.WEBSITE_URL + '/checkEmail?email=' + email + '&cmd=CHECKEMAIL&checkcode=' + hashcode;
    log("confirmLink:" + confirmLink);
    const content = '尊敬的客户您好：</br>' + 
              '&nbsp;&nbsp;为了保障您的账户安全，请您点击这个确认链接，以确认您的邮箱正确' +
              '<a href="' + confirmLink + '">' + confirmLink +
                '</a>';
    log("confirmContent:" + content);

    const mailOptions = {
        from: process.env.MAIL_SERVICE_WEBMASTER!,
        to: email,
        subject: '来自AI菩提(aiputi.cn)的邮箱确认邮件',
        html: content,
    };  

    await transporter.sendMail(mailOptions, function(err, info){
        if(err){
            error(err);
//            res.status(500).json("给用户发送确认邮件时发生意外失败！");
        } else {
            log('Email sent: ' + info.response);
        }
    });
  }catch(e){
    error(e);
    
  }
}


const webSiteIPs = JSON.parse(process.env.WEBSITE_IPS!);

export async function trackSourceOfUser(user:any){
    debug.log('start to wait a while for track source of user.......................');
    for(let i=0; i<5; i++){
        if(!user.source){
            // 这可能是当前后湖还没有进行后续操作，所以无法获得source
            await new Promise((resolve) => setTimeout(resolve, 60000));
            user = await findUserSource(user);            
        }else{
            break;
        }
    }
    debug.log('end of wait for track source of user.......................');
    if(user.source){
        debug.log(`tracked: ${user.source}`)
    }else{
        debug.error(`track failed: ${user.id}`)        
    }
    return user;
    
// 不在这里回调了，改在首次使用时回调  
//      if(user?.source){
//          await baidu.callBackOCPC_REG(user.source);
//      }    
}

export async function findUserSource(user:any){
    // 找到用户的IP，一个用户可能从多台电脑登录，IP不同的多行，所以取最早的一行记录
    const rows = await prisma.sysTrace.findMany({
        where:{
            userId: user.id,
            ip: {
                notIn: webSiteIPs
            }
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
    debug.log(JSON.stringify(IPs));
    if(IPs.length>0){
        const traces = await prisma.sysTrace.findMany({
            where: {
                OR: [
                    {userId:user.id},
                    {userId:null}
                ],
                ip: {
                    in: IPs
                }
            },
            take: 1,
            orderBy: [
                { createTime: 'asc' }
            ],
            select:{
                id: true,
                path: true
            }
        });
        debug.log(JSON.stringify(traces));
        if(traces && traces[0]){
            const path = traces[0].path;
            if(path){
                //const matchs = path.match(/bd_keyword=([^&]+)/); // 无论如何，第一个链接点击就是source
                //if(matchs && matchs[1]){
                    user.source = path; // `bd_keyword=${matchs[1]}`;
                    user = await prisma.user.update({
                        where:{
                            id: user.id
                        },
                        data:{
                            source: user.source
                        }                      
                    });
                    debug.log(`user ${user.name}[${user.id}] find source code: ${user.source}`);
                }
           // }
        }
    } 
    debug.log(`trackSourceOfUser got source ${user?.source}!`);
    return user;
}
