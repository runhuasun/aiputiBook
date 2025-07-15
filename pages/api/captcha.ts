import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
const svgCaptcha = require('svg-captcha');
const sharp = require('sharp');
import { hash , compare } from "bcrypt";

import * as enums from "../../utils/enums";
import {config, defaultImage} from "../../utils/config";
import {log, warn, error} from "../../utils/debug";
import * as monitor from "../../utils/monitor";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        const {size=4, noise=5, width=200, height=100, color=true, background='#f7f7f7'} = req.body;

        const host = req.headers.host; // 获取主机名（包括端口号）  
     
        monitor.logApiRequest(req, res, null, null, {cmd:"captcha", host});
      
        // 生成验证码
        const captcha = svgCaptcha.create({
            size, // 验证码字符长度
            noise, // 干扰线条数量
            color, // 使用彩色
            background, // 背景颜色
            width,
            height
        });
    
        log('验证码文本:', captcha.text); // 验证码答案
    
        // 转换 SVG 为 PNG Buffer
        const pngBuffer = await sharp(Buffer.from(captcha.data)).png().toBuffer();
    
        // 转换为 Base64
        const base64Image = pngBuffer.toString('base64');
        const base64DataURL = `data:image/png;base64,${base64Image}`;

        let text = captcha.text;
        // 防止欺诈网站
        if(!host || host.indexOf(config.domainName)<0){
            text = generateRandomString(size);
        }
        
        return res.status(200).json({
            text : text, // 返回验证码答案
            token : await hash(captcha.text, 10),
            base64: base64DataURL // 返回 Base64 数据 URL
        });

    }catch(e){
        error(e);
        res.status(500).json("服务器发生意外错误，请和网站管理员联系！");
    }
}

function generateRandomString(N:number) {
    // 可能的字符集
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < N; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
