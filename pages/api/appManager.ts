import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";


interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
      cmd: string;
      id?: string;
      name: string; 
      type: string;
      settlement: string;
      userId: string;
      modelId: string;
      config: string;
      desc: string;  
  };
}
  
export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse
) {
    try{   
        
        const { cmd, id, name, type, settlement, userId, modelId, config, desc } = req.body;
        console.log("config:\n" + config);
      
        if(cmd === "CREATE"){
            // 创建应用
            const newApp = await prisma.application.create({
                data: {
                    name: name, 
                    type: type,
                    settlement: settlement, 
                    userId: userId,
                    modelId: modelId,
                    config: JSON.stringify(config),
                    desc: desc 
                }
            });
            res.status(200).json({id:newApp.id});
        }else if(cmd === "UPDATE" && id){
            // 更新应用
            const newApp = await prisma.application.update({
                where: {
                    id: id,
                },
                data: {
                    name: name, 
                    type: type,
                    settlement: settlement, 
                    userId: userId,
                    modelId: modelId,
                    config: JSON.stringify(config),
                    desc: desc 
                }
            });
            res.status(200).json({id:newApp.id});
        }else if(cmd === "DELETE" && id){
            // 删除
            const newApp = await prisma.application.update({
              where: {
                id: id,
              },
              data: {
                status: "DELETE",
              }
            });
            res.status(200).json({id:newApp.id});
        }else{
            res.status(400).json("给应用的命令未知");
        }

    }catch(error){
        res.status(500).json("更新应用时发生意外失败！");
    }
}
