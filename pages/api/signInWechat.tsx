import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash , compare } from "bcrypt";
import nodemailer  from "nodemailer";
import  isMobilePhone from 'validator';
import validator from 'validator';
import { signIn, signOut, useSession } from "next-auth/react";

import { moveToFileServer } from  "../../utils/fileServer";
import { config } from "../../utils/config";
import {log, warn, error} from "../../utils/debug";
import { createDefModel } from "./trainChatModel";
import {defaultImage} from "../../utils/config";
import {giveFreeCreditsById} from "./creditManager";
import * as enums from "../../utils/enums";
import {inviteUser, trackSourceOfUser} from "./createuser";
import * as monitor from "../../utils/monitor";
import * as wu from "../../utils/wechatUtils";
import * as ws from "./wechatService";



export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    try{   
        log("enter signInWechat service: ", JSON.stringify(req.body));
        let { 
            cmd, 
            loginToken,
            code, openid, unionid, inviteBy, signInType, headimgurl, nickname, source
        } = req.body;

        switch(cmd){
            case "GET_USER_INFO":{
                const userInfo = await getUserInfo(code, signInType);
                return res.status(200).json(userInfo);
            }

            case "GET_INVITATION_QR": {
                const session = await getServerSession(req, res, authOptions);
                if (!session || !session?.user?.email) {
                    return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
                }
                // Get user from DB
                const user = await prisma.user.findUnique({
                    where: {
                        email: session.user.email!,
                    },
                });

                const app = await prisma.application.findUnique({
                    where: {
                        id: process.env.WECHAT_APP_AIPUTI_ID!,
                    },
                    include: {
                        user: true,
                    },
                });
                if(user?.id && app){
                    const QRCode = await ws.genInvitationQRCode(app, user.id, {shareType:"SHARE_USER"});     
                    log("QRCode:" + QRCode);
                    return res.status(200).json(QRCode);
                }else{
                    return res.status(400).json("获取用户邀请二维码时发生未知错误！");
                }
            }
                
            case "GET_QRCODE": {
                const codeURL = await genQRCode(loginToken);

                monitor.logApiRequest(req, res, null, null, req.body);                
                return res.status(200).json(codeURL);
            }
            break;
            
            case "GET_LOGIN_STATUS":{
                const users = await prisma.user.findMany({
                    where: {
                        emailVerified: new Date(parseInt(loginToken))
                    },
                    select:{
                        id:true,
                        email:true,
                        weixinId:true
                    }
                });
                if(users?.length > 0){
                    monitor.logApiRequest(req, res, null, users[0], req.body);            
                    return res.status(200).json({id:users[0]?.id, openid:users[0]?.weixinId, unionid:users[0]?.email});
                }else{
                    return res.status(enums.resStatus.waitForResult).json("等待用户登录！");
                }
            }
            break;
            
            default: {
                if(code){
                    const userInfo = await getUserInfo(code, signInType);
                    openid = openid || userInfo?.openid;
                    unionid = unionid || userInfo?.unionid;
                    headimgurl = userInfo?.headimgurl;
                    nickname = userInfo?.nickname;
                }
                if(!nickname){
                    // 说明是在微信对话过程中的简易登录，无法获得用户名等更多信息
                    const randomNumber = Math.floor(Math.random() * 9000000000) + 1000000000;
                    nickname = "WX" + randomNumber.toString();
                }
        
                log("-----signInWechat prepare info-----");
                log("openid:" + openid);
                log("unionid:" + unionid);
                log("nickname:" + nickname);
                log("headimgurl:" + headimgurl);
                
                const image = headimgurl ? await moveToFileServer(headimgurl) : defaultImage.userCover;
        
                let hasUser = null;
                if(openid && unionid && nickname){
        
                    // 根据unionid找到用户
                    const userByUnionid = await prisma.user.findUnique({
                        where: {
                            email: unionid,
                        }      
                    });
        
                    // 如果能找到用户，说明是迁移后的用户正常登录
                    if(userByUnionid){
                        hasUser = userByUnionid;
                      
                        // 如果登录的平台发生变化，就更新最新的openid
                        if(userByUnionid.weixinId != openid || userByUnionid.name != nickname){
                            hasUser = await prisma.user.update({
                                where: {
                                    id: userByUnionid.id,
                                },
                                data: {
                                    weixinId: openid,
                                    email: unionid,
                                    name: nickname,
                                    image: image,
                                },
                            });  
                        }
                    }else{
                        // 如果unionid找不到用户，尝试用openid找
                        const userByOpenid = await prisma.user.findUnique({
                            where: {
                                email: openid,
                            } 
                        });
        
                        // 如果满足以上条件有用户，说明是老用户
                        if(userByOpenid){
                            hasUser = userByOpenid;
                            hasUser = await prisma.user.update({
                                where: {
                                    id: userByOpenid.id,
                                },
                                data: {
                                    weixinId: openid,
                                    email: unionid,
                                    name: nickname,
                                    image: image,
                                },
                            });  
                        }else{
        
                            // 最后再尝试一种情况
                            if(signInType != "INSIDE" ){
                                
        
                            }
        
                        }
                    }
        
                    // 此时为通过微信登录的新用户
                    if(!hasUser){
                        log(`准备创建用户\n name:${nickname}\n email&unionid:${unionid}\n weixinId:${openid}`);
                        let newUser:any;
                        // 因为并发速度太快，有可能这一瞬间email已经被创建一个用户了
                        try{
                            newUser = await prisma.user.create({
                                data: {
                                  name: nickname,
                                  email: unionid, 
                                  weixinId: openid,                  
                                  credits: 0, 
                                  password: await hash("wechat", 10),
                                  image: image,
                                  invitedbycode : inviteBy ? inviteBy : "walkin",
                                  emailVerified: new Date().toISOString(),
                                  source: source
                                },
                              });
                          
                              if(newUser){        
                                  // 计算source
                                  trackSourceOfUser(newUser);
                                
                                  // 新用户给一个个人小模型                  
                                  const defModel = await createDefModel(newUser);
              
                                  // 给新用户初始credits
                                  await giveFreeCreditsById(newUser.id, config.freeCredits, enums.creditOperation.NEW_USER);
                                  if(inviteBy){
                                      await inviteUser(newUser.id, inviteBy);
                                      //log(inviteBy + "邀请" + nickname + "注册了，奖励credits已到账！");
                                      // 给邀请的用户不可提现的credit奖励
                                      //await giveFreeCreditsById(inviteBy, config.inviteBonus, enums.creditOperation.INVITE_BONUS, newUser.id);
                                  }  
                              }
                              monitor.logApiRequest(req, res, null, newUser, req.body);                
                        }catch(err){
                            error("signInWechat create new user exception:", err);
                            newUser = await prisma.user.findUnique({
                                where: {
                                    email: unionid,
                                }      
                            });
                            if(!newUser){
                                throw err;
                            }
                        }
                    }else{
                        monitor.logApiRequest(req, res, null, hasUser, req.body);
                    }
                    
                    return res.status(200).json({email: unionid});
                }
            }
        }
        
        res.status(400).json("获取微信用户信息时失败");
        
    }catch(e){
        error("Sign in wechat error");
        error(e);
        res.status(500).json("服务器发生意外错误，请和网站管理员联系！");
    }
}


async function getUserInfo( code:string|undefined, signInType:string, openid?:string, accessToken?:string ){
                log("param token:" + accessToken);
                log("param openid:" + openid);   
                log("param cod:" + code);
                log("param signIntype:" + signInType);    
    if(code && !openid && !accessToken){
        // 获得当前登录用户的openid
        log("signInType:" + signInType);
        const appId = signInType == "INSIDE" ? process.env.WECHAT_APP_ID : process.env.WECHAT_WEB_APP_ID;
        const appSec = signInType == "INSIDE" ? process.env.WECHAT_APP_SECRET : process.env.WECHAT_WEB_APP_SECRET;        

        const result1 = await fetch(
            "https://api.weixin.qq.com/sns/oauth2/access_token?appid=" + 
            appId + "&secret=" + appSec + "&code=" + code + "&grant_type=authorization_code" ,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
        
        const ret1 = await result1.json();
        accessToken = ret1.access_token;
        openid = ret1.openid;
                log("------result1----------");
                log(JSON.stringify(ret1));
                log(accessToken);
                log(openid);
        
        if(ret1.errcode === 40163){
            //{"errcode":40163,"errmsg":"code been used, rid: 681f041e-2f22b656-514a9f4f"}
            return ret1
        }
    }

    // 根据openid获得登录用户的unionid
    if(openid && accessToken){
        const url = "https://api.weixin.qq.com/sns/userinfo?access_token=" + 
            accessToken + "&openid=" + openid + "&lang=zh_CN";
        log("URL to fetch userinfo:\n" + url);
        const result2 = await fetch(url , 
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
    
        const ret2 = await result2.json();
        const nickname = ret2.nickname;
        const headimgurl = ret2.headimgurl;
              log("------result2----------");
              log(nickname);
              log(headimgurl);
        const unionid = ret2.unionid;

      //  responseToUserByCS(accessToken, openid, `openid:${openid}现在关注微信公众号超能照相馆，立即获得20个能量点！`);
      //  responseToUserByCS(accessToken, unionid, `unionid:${unionid}现在关注微信公众号超能照相馆，立即获得20个能量点！`);
        
        return { openid, unionid, nickname, headimgurl };
    }
    
    return {};
}


async function responseToUserByCS(token:string, toUserId: string, msg:string){
    const body = {
        "touser": toUserId,
        "msgtype":"text",
        "text": {
            "content": msg
        },
    };
    
    const result = await fetch(
        "https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=" + token, 
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body:  JSON.stringify(body),
        });
    const ret1 = await result.json();
    log("客服返回消息:" + JSON.stringify(ret1));
}



async function genQRCode(scene_str:any){
    const token = await wu.getAccessToken();
    // 生成新的二维码
    const now = new Date();
    const result = await fetch(
        "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" + token,                    
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body:JSON.stringify({
                "expire_seconds":180, // 3分钟内有效的临时二维码
                "action_name": "QR_STR_SCENE", // 字符串类型，会传入当前时间戳,
                "action_info": {
                    "scene": {
                        "scene_str": scene_str,
                    }
                }
            })
        });
    
    if(result.status == 200){
        const ret = await result.json();
        const qrCodeUrl = "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=" + ret.ticket;
        
        log("New QR Code URL:" + qrCodeUrl);    
        return qrCodeUrl;
    }else{
        error("QR Code Gen Failed");
        return "";
    }
}
