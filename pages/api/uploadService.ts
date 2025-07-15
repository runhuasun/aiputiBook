import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as OSS from "../../utils/OSS";
import axios from "axios";
import fs from "fs";
import * as monitor from "../../utils/monitor";
import {deleteFileByURL, uploadFromUrlToPath} from "../../utils/fileServer";
import * as au from "../../utils/audioUtils";
import * as fu from "../../utils/fileUtils";
import * as iu from "../../utils/imageUtils";
import * as vu from "../../utils/videoUtils";
import * as enums from "../../utils/enums";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        const {cmd, fileName, fileType, fileURL, newPath, root} = req.body;
     
        const session = await getServerSession(req, res, authOptions);

        monitor.logApiRequest(req, res, session, null, {cmd, fileName, fileType});

        switch(cmd){
            case "GetOSSSignature":{
                if(fileName){
                    const result:any = await OSS.getSignature(fileName, fileType, 3600, root);
                    //debug.log("result:");
                    //debug.log(result);
                    return res.status(200).json(result);            
                }
                break;
            }
            case "UPLOAD_URL":{
                const newFile = await uploadFromUrlToPath(fileURL, newPath);
                return res.status(200).json({url:newFile});
            }
            case "CONVERT_IMAGE":{
                const newFile = await iu.convertIMG2JPG(fileURL);
                await deleteFileByURL(fileURL); // 无论是否转换成功，均删除原来文件
                if(newFile){
                    return res.status(200).json({url:newFile});
                }else{
                    return res.status(enums.resStatus.unsupportFormat).json("格式错误");
                }
            }              
            case "CONVERT_RAW":{
                const newFile = await iu.convertRAW2JPG(fileURL);
                await deleteFileByURL(fileURL); // 无论是否转换成功，均删除原来文件
                if(newFile){
                    return res.status(200).json({url:newFile});
                }else{
                    return res.status(enums.resStatus.unsupportFormat).json("格式错误");
                }
            }
            case "CONVERT_VIDEO":{
                const newFile = await vu.convertVideoToMP4(fileURL);
                await deleteFileByURL(fileURL); // 无论是否转换成功，均删除原来文件
                if(newFile){
                    return res.status(200).json({url:newFile});
                }else{
                    return res.status(enums.resStatus.unsupportFormat).json("格式错误");
                }
            }
            case "CONVERT_AUDIO":{
                let newFile:any = null;
                const ext = fu.getFileExtFromURL(fileURL);
                switch(ext){
                    case "ogg":
                        newFile = await au.convertOggToMp3(fileURL, newPath);
                        break;
                    case "m4a":
                        newFile = await au.convertM4aToMp3(fileURL, newPath);
                        break;
                    case "aac":
                        newFile = await au.convertAacToMp3(fileURL, newPath);
                        break;   
                    case "mpga":
                        newFile = await au.convertMpgaToMp3(fileURL, newPath);
                        break;                       
                }                    
                await deleteFileByURL(fileURL); // 无论是否转换成功，均删除原来文件 
                if(newFile){
                    return res.status(200).json({url:newFile});
                }else{
                    return res.status(enums.resStatus.unsupportFormat).json("格式错误");
                }
            }
        }
        debug.error("无效的命令:" + cmd);
        return res.status(400).json("无效的命令");
    }catch(error){
        debug.error(error);
        res.status(500).json("上传文件时发生意外失败！");
    }
}
