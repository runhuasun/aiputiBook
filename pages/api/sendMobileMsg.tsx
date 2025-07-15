import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash , compare } from "bcrypt";
import nodemailer  from "nodemailer";
// This file is auto-generated, don't edit it
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
// 依赖的模块可通过下载工程中的模块依赖文件或左下角的获取 SDK 依赖信息查看
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import * as $tea from '@alicloud/tea-typescript';
import * as monitor from "../../utils/monitor";
import {config} from "../../utils/config";
import * as debug from "../../utils/debug";


let _fraud_SMS_Count = 0;

export default async function handler( req: NextApiRequest, res: NextApiResponse ) {
 
   const { phone, message, captchaAnswer, captchaQuestion } = req.body;

   // 防止欺诈访问
   const host = req.headers.host; // 获取主机名（包括端口号）
   monitor.logApiRequest(req, res, null, null, {host, phone, message});

   const isGoodToken = captchaQuestion && (await compare(captchaQuestion?.text, captchaQuestion?.token));
   const isGoodAnswer = captchaAnswer == captchaQuestion?.text;
   if(!host || host.indexOf(config.domainName)<0 || !isGoodToken || !isGoodAnswer){
       if(_fraud_SMS_Count++ == 100){  
           debug.log(`第100条欺诈短信: ${host}, ${isGoodToken}, ${JSON.stringify(req.body)}`);   
           _fraud_SMS_Count = 0;
       }
       await new Promise((resolve) => setTimeout(resolve, 5000));      
       return res.status(200).json({result: "发送短信成功！"});
   }else{
       debug.log(`正常短信：${host}, ${JSON.stringify(req.body)}`);
   }
 
    // 工程代码泄露可能会导致AccessKey泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考，建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378664.html
   // @ts-ignore
    let client = createClient(process.env.ALI_ACCESS_KEY_ID, process.env.ALI_ACCESS_KEY_SECRET);
    let sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
        signName: process.env.ALIYUN_SMS_SIGN_NAME || "北京明快信息科技",
        templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || "SMS_485365741",
        phoneNumbers: phone,
        templateParam: "{\"code\":\"" + message + "\"}",
    });
    let runtime = new $Util.RuntimeOptions({ });
    try {
        // 复制代码运行请自行打印 API 的返回值
        await client.sendSmsWithOptions(sendSmsRequest, runtime);
       
        res.status(200).json({ result: "发送短信成功！" });
    } catch (error) {
      // 如有需要，请打印 error
      console.error(error);
      res.status(500).json({ result: "发送短信时发生未知错误！" });    
    }     
}


 /**
   * 使用AK&SK初始化账号Client
   * @param accessKeyId
   * @param accessKeySecret
   * @return Client
   * @throws Exception
   */
  function createClient(accessKeyId: string, accessKeySecret: string): Dysmsapi20170525 {
    let config = new $OpenApi.Config({
      // 必填，您的 AccessKey ID
      accessKeyId: accessKeyId,
      // 必填，您的 AccessKey Secret
      accessKeySecret: accessKeySecret,
    });
    // 访问的域名
    config.endpoint = `dysmsapi.aliyuncs.com`;
    return new Dysmsapi20170525(config);
  }    
