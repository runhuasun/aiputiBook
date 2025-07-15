import prisma from "../../lib/prismadb";
import { v4 as uuidv4 } from 'uuid';
import crypto from "crypto-js";
// import wx from "wx-jssdk-ts";
import type { NextApiRequest, NextApiResponse } from "next";
// var wx = require('weixin-js-sdk-ts');
// import wx from "weixin-sdk-js";
// import wx from "weixin-js-sdk-ts";
import jsrsasign from "jsrsasign";
import { getSignature, getUnionID } from "../../utils/wechatUtils";
import { config } from "../../utils/config";
import { log, warn, error } from "../../utils/debug";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

// 全局变量定义
export let access_token : string;
export let access_tokenExpTime : number;

export let jsapi_ticket : string ;
export let jsapi_ticketExpTime : number;

export let noncestr: string = "Wm3WZYTPz0wzccnW";


interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    cmd: string; // SIGNATURE
    url: string;
    desc: string;
    money: string; // 客户付款金额
    credits: string; // 买到的credits数
    openid: string;  // jsapi支付传来微信UUID
    clientIP: string; // H5支付传来用户IP
  };
}


export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse
) {

    // Check if user is logged in
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
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
        },
    });  
    if(!user){
        return res.status(500).json("请先登录，再购买！");
    }
        
    
    error("---- enter wechat ------");
    const {cmd, url, desc, money, credits, openid, clientIP} = req.body;
    
    
    if(cmd == "SIGNATURE"){
        
        if(url){
            return res.status(200).json( await getSignature(url) );
        }else{
            return res.status(400).json("获取签名的URL不能为空");
        }
        
    }else if(cmd == "NEW_ORDER_JSAPI" || cmd == "NEW_ORDER_H5" || cmd == "NEW_ORDER_PC"){
        error("new order：" + cmd);
        const out_trade_no = uuidv4().substring(0,32);
        const creditAmount = credits ? parseInt(credits) : 0;
        const payMoney = money ? Math.round(parseFloat(money)*100) : 1;
        error("process.env.WECHAT_MCHID:" + process.env.WECHAT_MCHID);
        const mchid = process.env.WECHAT_MCHID;
        
        let reqUrl = "";
        let body:any = { 
            "mchid": mchid,
            "out_trade_no": out_trade_no,
            "appid": process.env.WECHAT_MCH_APP_ID,
            "description": desc ? desc : (config.appName + "购买" + config.creditName),
            "notify_url": process.env.WEBSITE_URL+"/api/wechatPayHook",
            "amount": {
                "total": payMoney,
                "currency": "CNY"
            },
        };
        
        if(cmd == "NEW_ORDER_JSAPI"){
            reqUrl = "/v3/pay/transactions/jsapi";
            body.payer = {
                "openid": openid,
            };      
        }else if(cmd == "NEW_ORDER_H5"){
            reqUrl = "/v3/pay/transactions/h5";
            body.scene_info = {
                "payer_client_ip": clientIP,
                "h5_info": {
                    "type": "Wap"
                }
            };
        }else if(cmd == "NEW_ORDER_PC"){
            reqUrl = "/v3/pay/transactions/native";
        }
        
        const bodyStr = JSON.stringify(body);
        
        let signStr = "POST\n";
        signStr += reqUrl + "\n";
        const timestamp = Date.parse(new Date().toString()) / 1000;
        signStr += timestamp + "\n";
        const noncestr = "sjfwoiwennv89e4jkln32";
        signStr += noncestr  + "\n";
        signStr += bodyStr + "\n";
        
        
        const sig = await getSignature(signStr);
        const auth = 'WECHATPAY2-SHA256-RSA2048 mchid="' + mchid + '",nonce_str="' + noncestr +
            '",signature="' + sig + '",timestamp="' + timestamp + '",serial_no="76B8C6543F1F9D74C599BB44F30736CDDF1F694C"';
        log("AUTH:" + auth);
        
        const result = await fetch("https://api.mch.weixin.qq.com" + reqUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth,
                "Accept-Language": "zh-CN",
            },
            body: bodyStr,
        });
        
        const r = await result.json();
        log("支付调用结果：", r);
        
        // 取得对应用户
        /*
        const unionid = await getUnionID(openid);
        let user = null;
        if(unionid){
            user = await prisma.user.findUnique({
                where: {
                    email: unionid, // 微信
                    },
            });
        }
        
        if(!user){
            error("用户不存在，请先登录再购买！");
            return res.status(500).json("用户不存在，请先登录再购买！");
        }
        */
        
        await prisma.purchase.create({
            data: {
                id: out_trade_no,
                creditAmount: (creditAmount),
                userId: user.id,
                payMoney: payMoney,
                payMethod : "WECHATPAY",
                status: "START",
            },
        });
        
        return res.status(200).json( r );
    
    }else{
        return res.status(400).json("内部错误：未知的微信请求");
    }
}


