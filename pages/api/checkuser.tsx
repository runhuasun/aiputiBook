import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";

export type UserData = {
    email: string | null;
    name: string | null;
    image: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
    body: {
        email: string;
        password: string;
    };
}

  
export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<UserData | string>
) {
    
    try{   
        const { email, password } = req.body;

        let users = null;
        
        if(email){
            users = await prisma.user.findMany({
                where: {
                    email: email,
                },
                select: {
                    email: true,
                    name: true,
                    password: true,
                    image: true,
                },
            });
        }
        
        if(!users || users.length == 0 || password != users[0].password){
            res.status(500).json("用户不存在或者密码错误！");
        }else{
            res.status(200).json({
                email: users[0]?.email,
                name: users[0]?.name,
                image: users[0]?.image,
            });
        }
        
    }catch(error){
        console.error("exception here ...................................");
        console.error(error);
        res.status(500).json("登录用户时服务器发生意外失败！");
    }
}
