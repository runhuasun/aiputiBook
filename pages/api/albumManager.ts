const axios = require('axios');
const JSZip = require('jszip');
const fs = require('fs');
const { pipeline } = require('stream');
import { EventEmitter } from 'events';
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import { uploadFileToServer } from "../../utils/fileServer";
import * as fu from "../../utils/fileUtils";
import {AliCVService} from '../../ai/cv/AliCVService';
import {defaultImage, system} from "../../utils/config";
import {getThumbnail} from "../../utils/fileServer";
import * as audit from "../../utils/auditUtils";
import * as enums from "../../utils/enums";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        debug.log("----Start AlbumManager Running----");
        let {email, cmd, data, id, roomId, imageURL, pageSize, currentPage, waitForZipped, mediaType, func, prompt, useTempAlbum } = req.body;
        debug.log(JSON.stringify(req.body));
      
        let userEmail = email;
        if(!userEmail){
            const session = await getServerSession(req, res, authOptions);            
            if (session && session.user) {
                userEmail = session.user.email!;
            }else{
                if(cmd != "ALBUM_ROOMS_GOTOPAGE"){
                    return res.status(500).json("进行相册操作前，请先登录！");
                }
            }
        }
      
        let user:any;
        if(userEmail){
            user = await prisma.user.findUnique({
                where: {
                    email: userEmail,
                },
                select: {
                    id: true,
                    name:true,
                    credits: true,
                },
            });  
        }
        if(!user && cmd!="ALBUM_ROOMS_GOTOPAGE"){
            return res.status(500).json("进行相册操作前，请先登录！");
        }


        if(cmd === "CREATE" && data){
            const newAlbum = await prisma.album.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type: data.type,
                    desc: data.desc,   
                    coverImg: await auditCover(data.coverImg),
                    access: data.access || "PRIVATE",
                    score: data.score,
                    status: "CREATED",
                    user: { connect: { id: user.id } }, 
                }
            });
            res.status(200).json({id:newAlbum.id});
            
        }else if(cmd === "UPDATE" && data && id){
            // 更新应用
            debug.log("UPDATE album:", JSON.stringify(data));
            if(data.coverImg){
                data.coverImg = await auditCover(data.coverImg);
            }
            const updatedAlbum = await prisma.album.update({
                where: {
                    id: id,
                },
                data: data
            });
            res.status(200).json({id:updatedAlbum.id});
            
        }else if(cmd === "DELETE" && id){
            // 删除
            await prisma.album.update({
              where: {
                  id: id,
              },
              data: {
                  status: "DELETED",
              }
            });
            res.status(200).json({id});

        }else if(cmd == "ADDIMAGE" && imageURL){
            // 先审计imageURL
        //    const auditResult = await audit.auditURL(imageURL, mediaType);
        //    if(["Z", "T", "D"].includes(auditResult)){
        //        return await res.status(enums.resStatus.inputNSFW).json("您的输入内容不符合规范，无法为您处理！");
        //    }
        //    if(process.env.AUDIT_CHECK === "STRICT"){
        //        if(auditResult !== "N"){
        //            return await res.status(enums.resStatus.inputNSFW).json("您的输入内容不符合规范，无法为您处理！");
        //        }
        //    }
          
            debug.log("创建一个新的ROOM");
            const tempAlbum:any = (useTempAlbum && !id) ? (await createTempAlbum()) : null;
            id = id || tempAlbum?.id;
            
            let inputImage = imageURL;
            if(mediaType == "VIDEO"){
                inputImage = await fu.getVideoPoster(imageURL);
            }
            const newRoom = await prisma.room.create({
                data: {
                    replicateId: Date.now().toString(),
                    user: {
                        connect: {
                            id: user.id,
                        },
                    },
                    inputImage: inputImage,
                    outputImage: imageURL,
                    zoomInImage: "",
                    prompt: prompt || (user.name + "上传的文件"),
                    func: func || "userUpload",
                    usedCredits: 0,
                    status: "SUCCESS",
                    model: "no model",
                    access: "PRIVATE",
                    viewTimes: 0, 
                    dealTimes: 0,
                    likes: 0,
                    aiservice: "",
                    predicturl: "",
                    bodystr: "",
                    seed: "0",
                    resultType: mediaType || "IMAGE"
                },
            });           
            debug.log("把room加入相册");
            const newAR = await prisma.albumRoom.create({
                data: {
                    albumId: id,
                    roomId: newRoom.id,
                    status: "CREATED",
                }
            });    
          
            return res.status(200).json({id:newAR.id, room:newRoom, tempAlbum:tempAlbum});          
          
        }else if(cmd === "ADDROOM" && roomId){
        
            const tempAlbum:any = (useTempAlbum && !id) ? (await createTempAlbum()) : null;
            id = id || tempAlbum?.id;
            
            const finds = await prisma.albumRoom.findMany({
                where:{
                    albumId: id,
                    roomId: roomId,
                    status: "CREATED",
                }
            });
            if(finds.length > 0){
                const ar = finds[0];              
                return res.status(200).json({id:ar.id});              
            }
          
            const newRoom = await prisma.room.findUnique({
                where: {
                    id: roomId
                },
                select:{
                    outputImage:true
                }
            });          
            if(!newRoom){
                return res.status(400).json("试图将不存在的文件加入相册，请检查系统错误！");
            }
            
            const newAR = await prisma.albumRoom.create({
                data: {
                    albumId: id,
                    roomId: roomId,
                    status: "CREATED",
                }
            });    

            if(tempAlbum){
                res.status(200).json({id:newAR.id, tempAlbum:tempAlbum});
            }else{
                res.status(200).json({id:newAR.id});
            }
        }else if(cmd === "REMOVEROOM" && id && roomId){
            const updatedAR = await prisma.albumRoom.updateMany({
                where: {
                    albumId: id, 
                    roomId: roomId,
                    status: "CREATED",
                },
                data: {
                    status: "DELETED",
                }
            });  
            res.status(200).json({id:id});

        }else if(cmd === "ZIP" && id){
            const album = await prisma.album.findUnique({
              where:{
                id,
              },
              select:{
                name: true
              }
            });
          
            const roomsInAlbum = await prisma.albumRoom.findMany({
                where:{
                    albumId: id,
                    status: {
                        notIn: ['DELETE', 'FAILED', 'DELETED', 'CREATING']
                    },
                },
                select:{
                    roomId: true
                }              
            });
            const roomIdsInAlbum = roomsInAlbum.map(room => room.roomId);
            const whereTerm = {
              // userId: user.id, // 相册的图片有可能不是自己的
                    OR: [
                        { userId: user.id }, // 我的图片
                        { access: 'PUBLIC' } // 或者公开的图片
                    ],            
                    status: {
                        notIn: ['DELETE', 'FAILED', 'DELETED', 'CREATING']
                    },
                    id: {
                        in: roomIdsInAlbum
                    }
            };
            // const albumRoomsCount = await prisma.room.count({where:whereTerm}); 
            // if(albumRoomsCount > 20){
            //    return res.status(400).json("使用压缩服务，要求相册中的文件不能多于20个");
            // }
            const rooms = await prisma.room.findMany({
                where: whereTerm,
                take: 50, // 使用压缩服务，只使用相册中前50个文件
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    outputImage: true
                }
            });            

            const zip = new JSZip();
            for(const room of rooms){
                const url = room.outputImage;
                try {
                    const response = await axios({
                        url,
                        responseType: 'arraybuffer',
                    });
            
                    // 从URL中提取文件名
                    const filename = fu.getFileNameFromURL(url);
                    // 将图像添加到ZIP
                    zip.file(filename, response.data);
                    console.log(`${filename} has been added to the zip.`);
                } catch (error) {
                    console.error(`Error downloading ${url}:`, error);
                }                
            }

            const tmpZipFile = "./tmp/zip/" + (new Date()).getTime().toString() + "zipfile.zip";
            const ns = await zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
            const writeStream = fs.createWriteStream(tmpZipFile)
            const file = await ns.pipe(writeStream);
            const eventEmitter = new EventEmitter(); 
            let zippedFile;
            
            writeStream.on('finish', function() {
                uploadFileToServer(tmpZipFile, "Z").then(async (zipfile) => {
                    if(zipfile){
                        zippedFile = zipfile;
                        const newFile = await prisma.rawdata.create({
                          data: {
                              url: zipfile,
                              name: "相册[" + album!.name + "]的压缩包",
                              type: "ZIP",
                              desc: "",   
                              status: "CREATED",
                              user: { connect: { id: user.id } }, 
                          }
                        });   
                      
                        fs.unlink(tmpZipFile, (err:any) => {
                            if (err) {
                                console.log(tmpZipFile+'删除失败:', err);
                            } else {
                                console.log(tmpZipFile+'被删除成功');
                            }
                        });  
                    }
                    eventEmitter.emit('zipped');  
                });
            });

            if(waitForZipped){
                // 等待传递完所有数据
                await new Promise<void>(resolve => {
                    eventEmitter.once('zipped', () => {
                        debug.log('压缩完毕');
                        resolve();
                    });
                });              
                if(zippedFile){
                    return res.status(200).json({zippedFile});
                }else{
                    return res.status(403).json("压缩任务发生意外失败");
                }
            }else{
                return res.status(200).json("OK");
            }
            
        }else if(cmd === "ALBUM_ROOMS_GOTOPAGE" && pageSize && currentPage && id){
            
            // 获取总记录数
            const totalCount = await prisma.albumRoom.count({
                where: {
                    albumId: id,
                    status: { not: 'DELETED' },
                    room: {
                        status: { not: 'DELETE' },
                    },
                },
            });
            
            // 分页查询记录
            const paginatedRooms = await prisma.albumRoom.findMany({
                where: {
                    albumId: id,
                    status: { not: 'DELETED' },
                    room: {
                        status: { not: 'DELETE' },
                    },
                },
                include: {
                    room: true,
                },
                orderBy: [
                    { score: 'desc' },
                    { room: { sysScore: 'desc' } },  // 第一优先级
                    { createTime: 'desc' },
                    { room: { createdAt: 'desc' } }  // 第二优先级                  
                ],
                skip: (currentPage-1) * pageSize,
                take: pageSize,
            });
            
            // 提取 rooms 数组
            const rooms:any[] = paginatedRooms.map(roomRelation => roomRelation.room);
            const pageCount = Math.ceil(totalCount / pageSize);  
            
            debug.log("-----album manager Room gotopage-----");
            //debug.log(currentPage);
            ///debug.log(pageCount);
            //debug.log(rooms.length);
            //for(const r of rooms){
            //  debug.log(r.outputImage);
            //}

            // 生成缩略图
            for(const room of rooms){
                if(room.resultType == "IMAGE"){
                    if(room.audit == "N"){ // 只有审计过，并且是正常的图片才生成缩略图
                        room.outputImageThumbnail = await getThumbnail(room.outputImage, 256);
                    }
                }
            }
          
            return res.status(200).json({pageCount, rooms});        


        }else if(cmd == "GOTOPAGE" && pageSize && currentPage){
            
            let whereTerm:any = {
                userId: user.id,
                status: "CREATED",
            };
            const rowCount = await prisma.album.count({where:whereTerm});
            const pageCount = Math.ceil(rowCount / pageSize);        
            const albums = await prisma.album.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy: [
                  { score: 'desc' },
                  { createTime: 'desc' }
                ]
            });
           
           return res.status(200).json({pageCount, albums});   
          
        }else{
            debug.error("给应用的命令未知");
            res.status(400).json("给应用的命令未知");
        }

    }catch(e){
        debug.error(e);
        res.status(500).json("更新相册时发生意外失败！");
    }
}


async function auditCover(imageURL:string){
    let result = imageURL;
    const audit = await AliCVService.auditImage(imageURL);
    debug.log("audit cover:", JSON.stringify(audit));
    if(audit?.scenes?.porn == "porn" || audit?.scenes?.ad == "porn"){
        result = defaultImage.albumCover;
    }
    return result;
}

async function createTempAlbum(){
    const tempAlbum:any = await prisma.album.create({
        data: {
            code: fu.generateRandomString(20),
            name: fu.generateRandomString(20),
            type: "PHOTO",
            desc: "制作模型的临时相册",   
            coverImg: defaultImage.albumCover,
            access: "PRIVATE",
            score: 0,
            status: "CREATED",
            user: { connect: { id: system.users.trashId } }, 
        }
    });
    return tempAlbum;
}
