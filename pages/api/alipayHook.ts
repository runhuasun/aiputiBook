import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { hash } from "bcrypt";
import { boughtCredits } from "./creditManager";
import * as enums from "../../utils/enums";



export type UserData = {
  status: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    out_trade_no: string; // 支付宝的订单号
  //  money: string;
  //  credits: string;
  //  payMethod: string;
  };
}


// @ts-ignore  
export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<UserData | string>
) {
    try{   
      const {out_trade_no} = req.body;
      console.error("------handle notify-----");
      console.error(out_trade_no);
      
      const purchase = await prisma.purchase.findUnique({
          where: {
            id: out_trade_no,
          },
       });
      
      if(!purchase){
        return res.status(500).json("没有发起支付的记录，如果您已经被扣款，请和网站管理员联系！");
      }  

      // 发生故障的时候支付宝会重复调用这个回调函数
      // 所以如果发现这条记录已经受到过，就返回成功。阻止支付宝继续调用
      if(purchase.status == 'PAID'){
        return res.end('success'); // 回复支付宝我已经成功收到，不然他会不停的调
      }
      
      const user = await prisma.user.findUnique({
          where: {
            id: purchase.userId,
          },
       });
      console.error(user);
      if(!user){
        return res.status(500).json("发起支付的用户已经不存在，如果您已经被扣款，请和网站管理员联系！");
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
    
      // 给用户增加提子
      const credits = purchase.creditAmount;
     
      await boughtCredits(user, credits);
      
      res.end('success'); // 回复支付宝我已经成功收到，不然他会不停的调
  }catch(error){
    console.error(error);
    res.status(500).json("服务器发生意外错误，请和网站管理员联系！");
  }
}
