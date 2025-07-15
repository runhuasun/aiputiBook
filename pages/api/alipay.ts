import AlipaySdk from 'alipay-sdk';
import AlipayFormData from 'alipay-sdk/lib/form';
import prisma from "../../lib/prismadb";
import { v4 as uuidv4 } from 'uuid';

const express = require('express');
// 获取 express 实例对象
let app = express();

// @ts-ignore
export default async function handler(req, res) {
  if (req.method === 'POST') {        
    const params = req.body;
    console.error(params);

    // 创建AlipaySdk实例
    const alipaySdk = new AlipaySdk({
    // @ts-ignore      
      appId: process.env.ALIPAY_APP_ID,
    // @ts-ignore      
      privateKey: process.env.ALIPAY_APP_PRIVATE_KEY,
    // @ts-ignore      
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      signType: "RSA2",
    });

    const { email, subject, body, total_amount } = JSON.parse(req.body);

    const purchase_id = uuidv4();
        
    const bizContent = {
            out_trade_no: purchase_id,
            product_code: "FAST_INSTANT_TRADE_PAY",
            subject: subject,
            body: body,
            email: email,        
            total_amount: total_amount
    };  

// console.error(bizContent);
          
    // 生成支付链接
    const isMobile = /mobile/i.test(req.headers['user-agent']);
    const alipage = isMobile ?  'alipay.trade.wap.pay' : 'alipay.trade.page.pay'
    
    const result = await alipaySdk.pageExec(
      alipage,
      {
          method: 'GET',
          bizContent,
          returnUrl: process.env.WEBSITE_URL+'/buy-credits',
          notifyUrl: process.env.WEBSITE_URL+"/api/alipayHook",
      },
    );

    console.error(result);
    
      
    // 取得对应用户
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if(!user){
      return res.status(500).json("用户不存在，请先登录再购买！");
    }
        
        
    // 创建Purchase记录，置为初始START状态
    if(result){
       await prisma.purchase.create({
            data: {
              id: purchase_id,
              creditAmount: body==null ? 0 : parseInt(body),
              userId: user.id,
              payMoney: total_amount==null ? 0 : Math.round(parseFloat(total_amount)*100),
              payMethod : "ALIPAY",
              status: "START",
            },
         });
        
       res.status(200).json({ url: result });
        
    }else{
        
      res.status(500).json("创建支付发生失败");
           
    }
  }  
}



