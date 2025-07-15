import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";



interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
      cmd: string;
      vdh: any; 
      id: string;
  };
}
  
export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse
) {
    try{   
        
        const { cmd, vdh, id } = req.body;
      
        if(cmd === "CREATE" && vdh){
            // 创建应用
            const newVDH = await prisma.vDH.create({
                data: {
                  code: vdh.code,
                  name: vdh.name,
                  gender: vdh.gender,
                  birthday: vdh.birthday,
                  info: vdh.info ? vdh.info : "",
                  desc: vdh.desc ? vdh.desc : "",
                  label: vdh.label ? vdh.label : "",
                  //pModelId: vdh.pModelId,
                  //cModelId: vdh.cModelId,
                  //vModelId: vdh.vModelId,
                  pModel: { connect: { id: vdh.pModelId } },
                  cModel: { connect: { id: vdh.cModelId } },
                  vModel: { connect: { id: vdh.vModelId } },
                  access: vdh.access ? vdh.access : "PUBLIC",
                  status: "SUCCESS",
                  //userId: vdh.userId,
                  user: { connect: { id: vdh.userId } }, 
                }
            });
            res.status(200).json({id:newVDH.id});
            
        }else if(cmd === "UPDATE" && vdh && vdh.id){
            // 更新应用
            const newVDH = await prisma.vDH.update({
                where: {
                    id: vdh.id,
                },
                data: vdh
            });
            res.status(200).json({id:newVDH.id});
            
        }else if(cmd === "DELETE" && id){
            // 删除
            await prisma.vDH.update({
              where: {
                  id: id,
              },
              data: {
                  status: "DELETED",
              }
            });
            res.status(200).json({id});
            
        }else{
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        debug.error(e);
        if(JSON.stringify(e).indexOf("Unique constraint failed on the fields: (`code`)")>=0){
            res.status(400).json("虚拟数字人的编码重复，请换一个试试");
        }else{
            res.status(500).json("更新应用时发生意外失败！");
        }
    }
}
