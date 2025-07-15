import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash } from "bcrypt";
import jsrsasign  from "jsrsasign";
import { v4 as uuidv4 } from 'uuid';
import crypto from "crypto";
import * as CryptoJS from 'crypto';
import {log, warn, error} from "../../utils/debug";
import { boughtCredits } from "./creditManager";
import * as enums from "../../utils/enums";


export type UserData = {
  code: string | null;
  message: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
    "id": string, // "EV-2018022511223320873",
    "create_time": string, // "2015-05-20T13:29:35+08:00",
    "resource_type": string, // "encrypt-resource",
    "event_type": string, // "TRANSACTION.SUCCESS",
    "summary": string, // "支付成功",
    "resource": {
        "original_type": string, // "transaction",
        "algorithm": string, // "AEAD_AES_256_GCM",
        "ciphertext": string, // "",
        "associated_data": string, // "",
        "nonce": string, //""
    }
}


// @ts-ignore  
export default async function handler(
    req: ExtendedNextApiRequest,
    res: NextApiResponse<UserData | string>
) {
    try{   
        const {event_type, summary, resource} = req.body;
        error("------handle wechatpay notify-----");
        error("summary is : " + summary);
        const apiKey = "mingkuaiaiputi20230511181600ming";
        const decryptedData = decryptData(resource, apiKey);
        
        const out_trade_no = decryptedData.out_trade_no;
        
        const purchase = await prisma.purchase.findUnique({
            where: {
                id: out_trade_no,
            },
        });
        
        if(!purchase){
            error("没有发起支付的记录，如果您已经被扣款，请和网站管理员联系！");
            error("没有发起支付的记录，如果您已经被扣款，请和网站管理员联系！");
            error("没有发起支付的记录，如果您已经被扣款，请和网站管理员联系！");            
            return res.status(200).json({code:"FAIL", message: "没有发起支付的记录，如果您已经被扣款，请和网站管理员联系！"});
        }  

        // 发生故障的时候微信会重复调用这个回调函数
        // 所以如果发现这条记录已经受到过，就返回成功。阻止微信继续调用
        if(purchase.status == 'PAID'){
            return res.status(200).json('success'); // 回复微信我已经成功收到，不然他会不停的调
        }
      
        const user = await prisma.user.findUnique({
            where: {
                id: purchase.userId,
            },
        });
        log(user);
        if(!user){
            error("发起支付的用户已经不存在，如果您已经被扣款，请和网站管理员联系！");
            error("发起支付的用户已经不存在，如果您已经被扣款，请和网站管理员联系！");
            error("发起支付的用户已经不存在，如果您已经被扣款，请和网站管理员联系！");            
            return res.status(200).json({code:"FAIL", message: "发起支付的用户已经不存在，如果您已经被扣款，请和网站管理员联系！"});
        }

        // 修改purchase的状态为支付完成
        const now = new Date();
        await prisma.purchase.update({
            where:{
                id : out_trade_no,
            },
            data: {
                status : 'PAID',
                updatedAt: now,
            },
        });
    
        // 给用户增加credit
        const credits = purchase.creditAmount;
        await boughtCredits(user, credits);
        
        res.status(200).json('success'); // 回复微信已经成功收到，不然他会不停的调
    }catch(e){
        error("Exception in wechatPayHook:", e);
        res.status(500).json({code:"FAIL", message: "服务器发生意外错误，请和网站管理员联系！"});
    }
}

// @ts-ignore  
function decryptData(resource: {
        "original_type": string, // "transaction",
        "algorithm": string, // "AEAD_AES_256_GCM",
        "ciphertext": string, // "",
        "associated_data": string, // "",
        "nonce": string, //""
    }, apiKey:string) {
  // 解密数据

  const { algorithm, ciphertext, nonce, associated_data } = resource;

  if (algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const nonceBytes = nonce; // Buffer.from(nonce, 'base64');
  const cipherBytes = Buffer.from(ciphertext, 'base64');
//  error("apiKey：" + apiKey);
//  error("apiKey length: " + apiKey.length);
  const keyBytes = apiKey; //  Buffer.from(apiKey, 'base64');
//  error("apiKey base64 length：" + keyBytes.length);
  const associatedDataBytes = Buffer.from(associated_data, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes, nonceBytes);
  // {
  //    authTagLength: 16,
  // });
  const tag = cipherBytes.slice(-16);
  const encrypted = cipherBytes.slice(0, -16);
  decipher.setAuthTag(tag);
  decipher.setAAD(associatedDataBytes);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString());
  
}

// 这里写了hardcode，需要改成配置文件
function getAPIKey(){
    let rsa = new jsrsasign.RSAKey() 
    // SHA256withRSA私钥
    const k = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3UhNw172uVPWy
16WAgph0GzEg/YrPwdBdx2MLGEaNWiZSSOYsMXTade1dTljksb4uJ62EA8aIv+fF
6qUouwevj04iERc4Y2SLizomMupqnhO/ym4FOq//+pNUcG3qkE6fouA81X5GaJXm
hx1TGJtUcGKPfEWgGZhB06tQSM8Pjh+EM56K28s2iTWDGIT7mPoFmybh1HjFFOVG
aHFPlygIbBcSD9TXpRtXEnNuIa8L2JUdd1yTIMDPL4apSjg8fjbWX4JYYVqYi+lf
K2fTwz8u/TzddyUHRozzReT+XiTJCZcg3n/BUjETFS0G+abos3zCM2/cTXi0LYzx
JzUYMLytAgMBAAECggEADuAkH7YB+FGAloCVN3ZhdJp4RBsO1oj9pX52dQIFR5cX
IPo1Y0SoHMoQ9s9Su0wJCKnDlMDRrWsVHaRKvqFeoEpapr0IS1UVZZVopIzhJMGr
DJcakmYOvhDRP7rX0H7hQmbvF0CjvIbkEw7HvGR0xkdQWCBXbgRlrIHGlv8xfiuB
Db0LSRMqawOhH1PZiGAiAQPitEtYKgCgnLr/G0YfL1R6QyHPIhXExEFp74I9+cNr
U2i5cGuCUuPW1xY3NJUIGOt4o94I3Dtkm9ehDw1Wknj9VmfK1FYwHh0EihO5hGj+
1t4mzfcXtKU5JJbRGgqfoWZa43LV+dA9f50gkLc4AQKBgQDb6fFLATXRjEKeuhD8
9IE5Ul/k+jWZnQCZUbRgQY7jlox/BiIk0rnTgamMO2IjjzLjMjdtUPUX6G7gvXjk
pKB2fQzsMUNasCz071S9iiPQc6fPt9xL6uP0G0/SWfn/+ZM3XkjQvkrmxWewzLn+
TX5sLziGOcWMMynoHyb4swkhrQKBgQDVZvBYcSwc/XTkPfV8drGVtJWsw2sNf0SZ
GsBl3JVKcLv9u9Ke+7q3Ui0CfxZQqVlLiW4bTFSKprh6Q2D1G3cWbDav/KBrb6Cr
4YeswgvDFFCGfy8mtCooL2wTpgPi81lVqFmGwzOwj98T+AMdipCLIiT4woIUI4Th
YqzBXGdnAQKBgFeFGTSCfMqyiWjmIBCrtin78JIOSfqikzRxYdnU/Wrx5WRAKqKB
Atd8CN/4WixQty3YNFrbF0+2fzoN7ekA46OETPpK+MVEy/+GqDDuoyY4gRaX06Kb
DrF9lRzgFjCbQM2ORmhc8y44bfXc5ECi0qd3e4VfxJDxY8Ivc7ESf5XZAoGBAKVS
/lhGNPqwkOJR7eDiw2lLYblaG5F1S1uhkfRYE4B8HefQnrd0JY7oJt6MPml3CSqv
6ZFUbRqNVtXBZVf+UyAX7bYhbNZOwJboPgfkvOAA2PGZjpnZcd93/a6rKs+j302x
AsqYZ28dxqDdvuwf8SMY7LObXNLlQYiqvVN/lswBAoGBANZd2oKBP6dhfftfjlci
Kdi3NP6G+IP61LEFcAwyQolog0lof9wPBl7gooyIRiGiz4cns3aZ3Tc1Ub4oqoIo
nrL5TJOSgOXNm3zKcBpeucdtYTwbYGYnvkeKxbLR4wJ5bMMOx0yDj9+LjZyuscXv
XGZ1MBimDxvmhqtCs5UJWJAO
-----END PRIVATE KEY-----` 
     // 将私钥 转成16进制
    // @ts-ignore
    rsa = jsrsasign.KEYUTIL.getKey(k);

  return rsa;
}
