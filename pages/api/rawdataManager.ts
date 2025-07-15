import {log, warn, error} from "../../utils/debug";

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { embeddingRemove } from "../../utils/embedding";


  
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{ 

        log("---Enter rawdataManager-----");            
        // Check if user is logged in
        const session = await getServerSession(req, res, authOptions);
        if (!session || !session.user) {
            return res.status(400).json("新用户请先点左下角[登录]按钮，极简注册哦！");
        }
        
        // Get user from DB
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
        if(!user){
            throw new Error("用户没登录");
        }      
        
        const { 
          cmd, 
          names, types, urls, id, modelId, desc, 
          pageSize, currentPage, fileType 
        } = req.body;
        log("rawdataManager CMD:" + cmd);
        
        if(cmd === "GOTOPAGE" && pageSize && currentPage){

            let whereTerm:any = {
                userId: user.id, 
                status: {
                    notIn: ['DELETE', 'FAILED', 'DELETED', 'CREATING']
                }
            };
            if(fileType && fileType!="ALL"){
              whereTerm.type = fileType;
            }
            const userFileCount = await prisma.rawdata.count({where:whereTerm});
            const pageCount = Math.ceil(userFileCount / pageSize);         
            const rawdata = await prisma.rawdata.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: {
                    createTime: 'desc',
                },
                select: {
                    name: true,
                    url: true,
                    type: true
                }                    
            });
          
            res.status(200).json({pageCount, rawdata});          
          
        }else if(cmd === "CREATE"){
            // 创建Rawdata
            try{
                const fileNames:string[] = names.split("|");
                const fileUrls:string[] = urls.split("|");
                const fileTypes:string[] = types.split("|");
                
                for(let i=0; i<fileUrls.length; i++){
                    log(fileNames[i]);
                    log(fileUrls[i]);
                    log(fileTypes[i]);
                    log(user.id);
                    log(desc);
                    if(fileNames[i] && fileUrls[i] && fileTypes[i] && user.id && desc){
                      const newRawdata = await prisma.rawdata.create({
                          data: {
                              name: fileNames[i], 
                              url: fileUrls[i],
                              type: fileTypes[i],
                              status: "PUBLISH",
                              userId: user.id,
                              desc: desc                       
                          }
                      });
                    }
                }
            }catch(e){
                error("创建Rawdata记录失败");
                error(e);
                return res.status(400).json("创建语料文件记录失败");
            }
            return res.status(200).json({"result":"ok"});
            
        }else if(cmd === "UPDATE" && id){
            try{
                // 更新
                const newRawdata = await prisma.rawdata.update({
                    where: {
                        id: id,
                    },
                    data: {
                        name: names, 
                        url: urls,
                        desc: desc  
                    }
                });
            }catch(e){
                error("更新Rawdata记录失败，rawdataId:" + id);
                error(e);
                return res.status(400).json("更新语料文件记录失败");                
            }
            return res.status(200).json({"result":"ok"});
            
        }else if(cmd === "DELETE" && id){
            // 删除
            try{
                const newRawdata = await prisma.rawdata.update({
                  where: {
                    id: id,
                  },
                  data: {
                    status: "DELETE",
                  }
                });
            }catch(e){
                error("删除Rawdata记录失败，rawdataId:" + id);
                error(e);
                return res.status(400).json("删除语料文件记录失败");                 
            }
            return res.status(200).json({"result":"ok"});
            
        }else if(cmd === "DELETE_FROM_MODEL" && id){
            log("---DELETE_FROM_MODEL-----");
          
            // 删除
            try{
                const model = await prisma.model.findUnique({
                  where:{
                    id: modelId
                  }
                });

                if(model && model.url){
                    let batch = 10000;                    
                    let skip = 0;
                    let take = batch;
                    let batchRemoving = 0;
                    let removed = 0;

                    log("开始删除向量数据从模型：" + model.name);
                    do{
                        const vectors = await prisma.vector.findMany({
                            where: {
                                modelId: modelId,
                                scope: 'MODEL',
                                rawdataId: id,
                                status: 'CREATE'
                            },
                            select:{
                                key: true,
                                type: true
                            },
                            skip: skip,
                            take: take,
                        });
                        batchRemoving = vectors.length;
                        log("从模型中读取到数据的条数：" + batchRemoving);
                        
                        if(batchRemoving > 0){
                            let textKeys = [];
                            let mediaKeys = [];
                            for(const v of vectors){
                                if(v.type == "TEXT"){
                                    textKeys.push( Number(v.key) );
                                }else{
                                    mediaKeys.push( Number(v.key) );
                                }
                            }
                            if(textKeys.length>0){
                                removed += await embeddingRemove(modelId, textKeys, model.url, "MODEL", user.id, false);
                            }
                            if(mediaKeys.length>0){
                                removed += await embeddingRemove(modelId, mediaKeys, model.url+".media", "MODEL", user.id, false);
                            }
                            if(removed == batchRemoving){
                                log("从模型中成功删除的记录数量:" + removed);
                            }else{
                                error("从索引文件中删除记录出错，但是已经有" + removed + "条记录被删除");   
                            }
                          
                             skip += batch;
                          
                        }
                    }while(batchRemoving === batch); //  && removed === batchRemoving);

                    // 删除向量数据
                    await prisma.vector.updateMany({
                        where: {
                            modelId: modelId,
                            rawdataId: id,
                            scope: 'MODEL',
                        },
                        data:{
                            status:'DELETE'
                        }
                    });

                    // 删除模型和语料文件的关系
                    await prisma.modelRawdatas.update({
                        where: {
                            modelId_rawdataId : {
                                modelId: modelId,
                                rawdataId: id,
                            },
                        },
                        data: {
                            status: "DELETE",
                        }
                    });
                }
            }catch(e){
                error("删除Rawdata记录失败，rawdataId:" + id);
                error(e);
                return res.status(400).json("删除语料文件记录失败");                 
            }
            return res.status(200).json({"result":"ok"});
            
        }else{
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        error(e);
        res.status(500).json("更新应用时发生意外失败！");
    }
}
