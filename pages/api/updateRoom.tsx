import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as fs from "../../utils/fileServer";
import * as fu from "../../utils/fileUtils";
import * as oss from "../../utils/OSS";
import * as vu from "../../utils/videoUtils";
  
import {isURL, isInUS, isBase64Image, getFileTypeByURL, getFileServerOfURL, getRedirectedUrl} from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import {translate} from "../../utils/localTranslate";
import * as AIS from "../../ai/AIService";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    try{   
        let { id, sysScore, cmd, pageSize, currentPage, type, func, modelCode, baseModelCode, promptCode, showBest, showMyRooms, showUserPage, publicOnly, backup, currentTime, audit, 
             inputImage, prompt, desc, word, userId, status, outputImage } = req.body;
        let session:any;
        let user:any;
        // Check if user is logged in
        session = await getServerSession(req, res, authOptions);
        if (cmd != "GOTOPAGE" && (!session || !session.user)) {
            return res.status(500).json("请先登录！");
        }

        if(session?.user?.email){
            // Get user from DB
            user = await prisma.user.findUnique({
              where: {
                  email: session.user.email!,
              }
            });  
        }
        if(cmd != "GOTOPAGE" && !user){
            return res.status(500).json("修改资源前，请先登录！");
        }
        const isAdmin = user?.actors?.indexOf("admin")>=0;
      
        if(cmd == "REMOVE_BASE64_FROM_BODYSTR"){
            if(isAdmin){
                debug.log("--------------REMOVE_BASE64_FROM_BODYSTR-----------------");
                const base64Rooms = await prisma.room.findMany({
                    where: {
                        bodystr: {
                            contains: "data:image/jpeg;base64"
                        }
                    },
                    take: 100,
                    select:{
                        id: true,
                        resultType: true,
                        audit: true,
                        bodystr: true
                    }
                });
                debug.log(`--------------found ${base64Rooms.length} Base64 images to move-----------------`);    
                for(const room of base64Rooms){
                    try{
                        if(room.bodystr){
                            const bodyJson = JSON.parse(room.bodystr);
                            replaceBase64ImageProperties(bodyJson);
                            const newbodystr = JSON.stringify(bodyJson);
                            await prisma.room.update({
                                where:{
                                    id: room.id
                                },
                                data:{
                                    bodystr: newbodystr,
                                    audit: null
                                }
                            });
                            debug.log(`Room ${room.id} bodystr updated to ${newbodystr}`);
                        }
                    }catch(err){
                        debug.error("REMOVE_BASE64_FROM_BODYSTR exception:", err, JSON.stringify(room));
                        continue;
                    }
                }
                return res.status(200).json(`BODYSTR更新完毕！`);
            }else{
                return res.status(400).json(`这是管理员才可以的操作！`);                
            }

        }else if(cmd == "BUILD_ALL_DESC"){
            if(isAdmin){
                debug.log("开始更新所有好图片的描述，如果已经有描述，就不更新");
                const goodRooms = await prisma.room.findMany({
                    where:{
                        sysScore: { gt: 3 },
                        access: "PUBLIC",
                        resultType: "IMAGE",
                        OR: [
                            { desc: null },
                            { desc: "" }
                            ]
                    },
                    select: {
                        id: true,
                        desc: true,
                        outputImage: true
                    }
                });
                debug.log("一共找到" + goodRooms?.length + "张图片");
                let i = 1;
                let errRooms:string[] = [];
                for(const room of goodRooms){
                    debug.log(`更新描述进度: ${i++} / ${goodRooms.length}`);
                    const desc = await genDesc(room);
                    if(desc){
                        await prisma.room.update({
                            where: {
                                id: room.id,
                            },
                            data: {
                                desc: desc,
                            }
                        });
                        debug.log(`图片${room.id}的描述更新为：${desc}`);
                    }else{
                        debug.error(`图片${room.id}没有正确生成描述！！`);
                        errRooms.push(room.id);
                    }                    
                }
                debug.log("------------------图片更新操作全部结束------------");
                if(errRooms.length > 0){
                    debug.error("以下是失败的更新记录：", errRooms);
                }
            }
            return res.status(200).json(`图片描述全部更新完毕！`);

        }else if(cmd == "UPDATE_ROOM"){
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    status,
                    outputImage
                }
            });
            return res.status(200).json("更新成功");

        }else if(cmd == "MARK_AUDIT"){
           if(audit){
                await prisma.room.update({
                    where: {
                        id: id,
                    },
                    data: {
                        audit: audit,
                    }
                });
            }
            return res.status(200).json("设置成功");          
        }else if(cmd == "SET_DESC"){
           if(desc){
                await prisma.room.update({
                    where: {
                        id: id,
                    },
                    data: {
                        desc: desc,
                    }
                });
            }
            return res.status(200).json("设置成功");
        }else if(cmd == "GET_DESC"){
            const room = await prisma.room.findUnique({where:{id}});

            const desc = await genDesc(room, prompt);
            if(desc){
                return res.status(200).json({desc});
            }else{
                return res.status(400).json("获得图片描述失败");
            }
        }else if(cmd == "GET_SET_DESC"){
            const room = await prisma.room.findUnique({where:{id}});

            const desc = await genDesc(room, prompt);
            if(desc){
                await prisma.room.update({
                    where: {
                        id: id,
                    },
                    data: {
                        desc: desc,
                    }
                });
                return res.status(200).json({desc});
            }else{
                return res.status(400).json("获得图片描述失败");
            }          
        }else if(cmd == "GET_DATA"){
          
            const room = await prisma.room.findUnique({ where:{ id:id} });
            debug.log(`Room Status, USER:${user?.name}[${user?.id}], ROOM:${room?.id}, ${room?.status}, ${room?.outputImage}`);
            return res.status(200).json(room);

        }else if(cmd == "SET_PROMPT"){
            if(prompt){
                await prisma.room.update({
                    where: {
                        id: id,
                    },
                    data: {
                        prompt: prompt,
                    }
                });
            }
            return res.status(200).json("设置成功");
        }else if(cmd === "SET_POSTER" && id){
            debug.log("currentTime:" + currentTime);
            const room = await prisma.room.findUnique({
                where: {
                    id: id,
                },
                select: {
                    outputImage: true,
                    inputImage: true,
                }
            });
            if(room?.outputImage){
                const poster = await vu.captureFrame(room.outputImage, (currentTime || 0.001)*1000, "U");
                debug.log("POSTER:" + poster);
                if(poster){       
                    if(room.inputImage){
                        await fs.deleteFileByURL(room.inputImage);
                        debug.log("原来的poster被删除：" + room.inputImage);
                    }
                    await prisma.room.update({
                        where: {
                            id: id,
                        },
                        data: {
                            inputImage: poster,
                        }
                    });
                    return res.status(200).json({poster});                              
                }
            }
            return res.status(400).json("给视频设置封面时发生意外失败");
        }else if(cmd === "SET_INPUTIMAGE"){
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    inputImage: inputImage || "",
                }
            });
            return res.status(200).json("设置成功");
          
        }else if(cmd === "SET_MODEL"){
            // 设置模型
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    model: modelCode || "no model",
                }
            });
            return res.status(200).json("图片打分更新成功");
            

        }else if(cmd === "SET_SCORE"){
            // 人工打分
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    sysScore: sysScore,
                }
            });
            return res.status(200).json("图片打分更新成功");
        
        }else if(cmd === "PUBLIC"){
            if(process.env.CONSTRAIN_PAYMENT_DELETE == "TRUE"){
                if(user.boughtCredits <= 0){
                    return res.status(enums.resStatus.constrainOpPaymentDelete).json("感谢您的试用，公开图片、视频或音频是付费用户的专有功能。请付费后重试，谢谢！");
                }
            }      
            const room = await prisma.room.findUnique({
                where: {
                    id: id
                },
                select:{
                    audit: true
                }
            });
            if(room?.audit && room.audit != 'N'){
                if(!isAdmin){
                  return res.status(enums.resStatus.constrainOpPaymentDelete).json("经过系统的审核，该作品不适合公开分享给他人，请更换作品再尝试！");
                }
            }
          
            // 公开图片
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    access: "PUBLIC",
                }
            });
            return res.status(200).json("图片公开发布成功");
            
        }else if(cmd === "PRIVATE"){
            // 隐藏图片
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    access: "PRIVATE",
                }
            });
            return res.status(200).json("图片已经隐藏成功");
          
        }else if(cmd === "PHYSICAL_DELETE"){
            
            // 物理删除，也就是从存储中彻底删除，也从数据库中删除
            if(isAdmin){
                debug.warn("系统管理员物理的删除一条图片记录");
                const room = await prisma.room.findUnique({ where:{ id:id} });
                if(room){
                    if(isURL(room.outputImage)){
                        debug.warn("删除存储桶中的数据：" + room.outputImage);
                        await fs.deleteFileByURL(room.outputImage);
    
                        //if(room.bodystr){
                        //    const body = JSON.parse(room.bodystr);
                        //    if(body?.input?.target_image){
                        //        debug.warn("删除存储桶中的traget_image数据：" + body.input.target_image);
                        //        await fs.deleteFileByURL(body.input.target_image);
                        //    }
                        //}
                    }                    
                    debug.warn("删除数据库中的数据：" + JSON.stringify(room));
                    try{
                        await prisma.room.delete({ where: { id: id } });
                    }catch(err){
                        debug.error("exception when deleting room:", err);
                        return res.status(400).json("有其它非层级删除的数据引用该文件，无法删除");
                    }                      
                  
                    return res.status(200).json("图片在存储桶和数据库中被彻底删除成功");
                }                  
            }

        }else if(cmd === "DELETE"){
          
            if(process.env.CONSTRAIN_PAYMENT_DELETE == "TRUE"){
                if(user.boughtCredits <= 0){
                    return res.status(enums.resStatus.constrainOpPaymentDelete).json("感谢您的试用，删除图片、视频或音频是付费用户的专有功能。请付费后重试，谢谢！");
                }
            }

            // 打上删除标记
            const oldRoom = await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    status: "DELETE",
                }
            });
            // 先回复用户已经删除成功了
            res.status(200).json("文件被成功删除！");

            backup = true; // 所有标记删除的都把数据转移到US
            if(backup){
                if(oldRoom && isURL(oldRoom.outputImage) && !isInUS(oldRoom.outputImage) && (oldRoom.outputImage.indexOf("/running.gif")<0)){
                    const backupImage = await fs.backupToUS(oldRoom.outputImage);
                    if(backupImage){
                        debug.log(oldRoom.outputImage, "成功备份到-->", backupImage);
                        await fs.deleteFileByURL(oldRoom.outputImage);
                        debug.warn("删除存储桶中的数据：" + oldRoom.outputImage);                
                        const newRoom = await prisma.room.update({
                            where: {
                                id: id,
                            },
                            data: {
                                outputImage: backupImage
                            }
                        });                       
                    }else{
                        debug.error(oldRoom.outputImage, "备份失败，原文件没有删除");
                    }
                }
            }
            return;
        }else if(cmd == "BACKUP_TO_US"){
            let oldRoom:any;
            oldRoom = await prisma.room.findUnique({ where:{ id:id} });
            if(oldRoom && ( (isURL(oldRoom.outputImage) && !isInUS(oldRoom.outputImage)) || isBase64Image(oldRoom.outputImage) )){
                const backupImage = await fs.backupToUS(oldRoom.outputImage);
                if(backupImage){
                    debug.log(oldRoom.outputImage, "备份到-->", backupImage);                
                    await fs.deleteFileByURL(oldRoom.outputImage);
                    debug.warn("删除存储桶中的数据：" + oldRoom.outputImage);                
                    const newRoom = await prisma.room.update({
                        where: {
                            id: id,
                        },
                        data: {
                            outputImage: backupImage
                        }
                    });
                }else{
                    debug.error(oldRoom.outputImage, "备份失败");                
                }
            }
            return res.status(200).json("图片被备份成功");
            
        }else if(cmd === "RECOVER"){
            // 删除
            await prisma.room.update({
                where: {
                    id: id,
                },
                data: {
                    status: "SUCCESS",
                }
            });
            
            return res.status(200).json("图片被恢复成功");

        }else if(cmd == "MOVE_TO_FILESERVER"){
            let oldRoom:any;
            oldRoom = await prisma.room.findUnique({ where:{ id:id} });
            if(oldRoom && ( 
              (isURL(oldRoom.outputImage) && (getFileServerOfURL(oldRoom.outputImage) != process.env.FILESERVER)) // 只要不在国内文件服务器
              || isBase64Image(oldRoom.outputImage) ) // 或者是base64
              ){
                const newFile = await fs.moveToFileServer(oldRoom.outputImage);
                if(newFile){
                    debug.log(oldRoom.outputImage, "上传到-->", newFile);   
                    if(isInUS(oldRoom.outputImage)){
                        await fs.deleteFileByURL(oldRoom.outputImage);
                        debug.warn("删除US存储中的数据：" + oldRoom.outputImage);                
                    }
                    const newRoom = await prisma.room.update({
                        where: {
                            id: id,
                        },
                        data: {
                            outputImage: newFile
                        }
                    });
                }else{
                    debug.error(oldRoom.outputImage, "MOVE_TO_FILESERVER失败");                
                }
            }
            return res.status(200).json("图片被上传到文件服务器成功");
      
        }else if(cmd === "GOTOPAGE" && pageSize && currentPage){
            if(showMyRooms && !user){
                return res.status(500).json("浏览我的资源前请先登录！");
            }
          
            //debug.log("---GOTOPAGE---");
            let whereTerm:any = {
                status: "SUCCESS"
            };

            if(publicOnly){
                whereTerm.access = "PUBLIC";              
                whereTerm.sysScore = { gt: 2 }; // 显示4\5分图片
            }else if(showBest){
                whereTerm.access = "PUBLIC";
                whereTerm.sysScore = word ? {gt: 3} : { gt: 4 }; // 缺省显示所有5分图片， 搜索的时候4分的也显示
            }else if(showUserPage){
                if(!isAdmin){
                    whereTerm.access = "PUBLIC";
                }else{
                    whereTerm.status = undefined; // admin显示所有状态照片
                }
                whereTerm.userId = userId; // 我的图片 
            }else if(user){
                whereTerm.OR = [ { userId: user.id }]; // 我的图片 
            }
          
            if(modelCode){
                whereTerm.model = modelCode;
                if(whereTerm.OR){
                    whereTerm.OR.push({ access: 'PUBLIC' }); // 可以显示公开的图片              
                }else{
                    whereTerm.access = "PUBLIC";
                }
            }else if(promptCode){
                whereTerm.model = promptCode;
                if(whereTerm.OR){
                    whereTerm.OR.push({ access: 'PUBLIC' }); // 可以显示公开的图片              
                }else{
                    whereTerm.access = "PUBLIC";
                }
            }
            switch(type){
                case "IMAGEVIDEO":
                    whereTerm.resultType = { in: ["IMAGE", "VIDEO"] };
                    break;
                case "ALL":
                    whereTerm.NOT = {resultType:"JSON"};
                    break;
                case "VIDEO":
                    whereTerm.resultType = "VIDEO";
                    break;
                case "VOICE":
                    whereTerm.resultType = "VOICE";
                    break;
                case "IMAGE":
                case "PHOTO":
                default:
                    whereTerm.resultType = "IMAGE";
            }
            if(func){
              whereTerm.func = func;
            }
            if (baseModelCode) {
                whereTerm.bodystr = { contains: `":"${baseModelCode}"` };
            }
            if(word){
                const search = [
                    {access: "PUBLIC", desc: { contains: word } },
                    {access: "PUBLIC", prompt: { contains: word } }, 
                    {access: "PUBLIC", model: { contains: word } },
                    {access: "PUBLIC", bodystr: { contains: word } },                  
                ];
                whereTerm.AND = [{OR:search}];
                if(whereTerm.OR){
                    whereTerm.AND.push({OR:whereTerm.OR});
                    whereTerm.OR = undefined;
                }
            }   
            debug.log(`Goto Room Page, user:${user?.name}[${user?.id}], ${JSON.stringify(whereTerm)}`);
            const orderBy:any = ( showMyRooms || (isAdmin && showUserPage) ) ? 
                [
                    {createdAt: 'desc'},
                ]              
                :
                [
                    {sysScore: 'desc'},
                    {createdAt: 'desc'},
                ];
                
            const roomCount = await prisma.room.count({where:whereTerm});
            const pageCount = Math.ceil(roomCount / pageSize);         
            const rooms:any[] = await prisma.room.findMany({
                where: whereTerm,
                take: pageSize,
                skip: (currentPage-1) * pageSize,
                orderBy:orderBy,
                select: {
                    id:true,
                    inputImage:true,
                    outputImage:true,
                    prompt:true,
                    createdAt:true,
                    updatedAt:true,
                    func:true,
                    model:true,
                    usedCredits:true,
                    status:true,
                    price:true,
                    viewTimes:true,
                    dealTimes:true,
                    sysScore:true,
                    likes:true,
                    access:true,
                    seed:true,
                    resultType:true,
                    desc:true,
                    audit:true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            actors: true,
                            grade: true
                        }
                    }
                }                            
            });

            // 生成缩略图
            //if(type == "IMAGE" || type == "ALL" || type == "PHOTO"){
            //    for(const room of rooms){
            //        if(room.resultType == "IMAGE"){
            //            if(room.audit == "N"){ // 只有审计过，并且是正常的图片才生成缩略图
            //                room.outputImageThumbnail = await fs.getThumbnail(room.outputImage, 256);
            //            }
            //       }
            //   }
           //}

            // 生成视频Poster
            if(type == "VIDEO" || type == "ALL"){
                for(const room of rooms){
                    if(room.resultType == "VIDEO" && fu.isURL(room.outputImage) && !room.inputImage){ // 如果视频没有inputImage
                        try{
                            vu.captureFrame(room.outputImage, 0, "U").then(async (frame:string|null)=>{
                                if(frame){
                                  room.inputImage = frame;
                                  await prisma.room.update({data:{inputImage:frame}, where:{id:room.id}});
                                }
                            });
                        }catch(err){
                            debug.error("exception when captureFrame:", err);
                        }
                      
                    }
                }
            }
           // debug.log("-----updateRoom gotopage-----");
           // debug.log("current page:", currentPage);
           // debug.log("page count:", pageCount);
           // debug.log("page items:", rooms.length);
            return res.status(200).json({pageCount, rooms});
        }else if(cmd == "COPY_THUMBNAIL"){
            // 遍历所有公开room
            const rooms = await prisma.room.findMany({
                where:{
                    status: "SUCCESS",
                    access: "PUBLIC",
                    resultType: "IMAGE",
                },
                select:{
                    id: true,
                    outputImage: true
                }
            });
            // 判断每一个room的outputImage是否存在
            let deals = 0;
            for(const room of rooms){
                // 判断是否在OSS
                if(fu.getFileServerOfURL(room.outputImage) == enums.fileServer.OSS){
                    let roomPath = fu.getPathOfURL(room.outputImage);
                    if(roomPath && roomPath.startsWith("/")){
                        roomPath = roomPath.substring(1);
                    }                   
                    if( roomPath && !(await oss.isExistObject(roomPath)) ){
                        // 如果不存在，就把对应的thumbnail拷贝过来                    
                        const thumbURL = room.outputImage.replace("/U/", `/S/256/`);
                        let thumbPath = fu.getPathOfURL(thumbURL);   
                        if(thumbPath?.startsWith("/")){
                            thumbPath = thumbPath.substring(1);
                        }  
                        if(thumbPath && await oss.isExistObject(thumbPath)){
                            await oss.moveToOSS(thumbURL, "U", "URL", roomPath);
                            deals++;
                            debug.error(`ROOM ${room.id}[${thumbURL}] copy thumbnail ${room.outputImage}`);
                        }
                    }else{
                       // debug.log(`ROOM ${room.id}[${room.outputImage}] 存在！`);
                    }
                }
            }
            debug.error(`检查${rooms.length}条记录，一共转移恢复${deals}条数据`);
            
        }else{
            return res.status(400).json("给图片的命令未知");
        }
    }catch(error){
        debug.error("updateRoom exception:", JSON.stringify(req.body), error);
        return res.status(500).json("更新图片状态时发生意外失败！");
    }
}


async function genDesc(room:any, prompt?:string){
    try{
        if(room?.outputImage){
            const imageURL = room.outputImage;
            if(isURL(imageURL) && (getFileTypeByURL(imageURL) == "IMAGE")){
                // 识别当前图片的内容
                const cv = AIS.createCVInstance("REP", "recogImgByPrompt");
                if(cv){
                    const getURL = await cv.predict({
                        image: room.outputImage,
                        prompt: prompt || "Please provide a detailed description of the content in this photo. If there is a woman in the photo, describe her figure, hairstyle, clothing, appearance, face shape, accessories, breast size, and cup size clearly. If there is a man in the photo, describe his figure, hairstyle, clothing, appearance, face shape, beard, accessories, etc. clearly.",
                        // max_new_tokens: 300,
                        // max_length: 400,
                        temperature: 1
                    });  
                    if(getURL){
                        const enDesc = await cv.getPredictResult(getURL);
                        debug.log("recognition:" + enDesc);
                        const zhDesc = await translate(enDesc, "en", "zh");
                        debug.log("translate to:" + zhDesc);
                        const desc = JSON.stringify( { zh: zhDesc, en: enDesc } );
                        //const room = await prisma.room.update({
                        //    where: { id },
                        //    data: {
                        //        desc
                        //    }
                        //});
                        return desc;
                    }
                }
            }
        }
    }catch(e){
        debug.error("image recognition error:");
        debug.error(e);
    }    
}

function replaceBase64ImageProperties(obj:any) {
    // Helper function to check if a value is an object or array for recursion
    function isObjectOrArray(value:any) {
        return value && typeof value === 'object';
    }

    // Recursive function to replace strings
    function replace(obj:any) {
        for (let key in obj) {
            // Check if the property belongs to the object or array
            if (obj.hasOwnProperty(key) || Array.isArray(obj)) {
                const value = obj[key];
                if (isObjectOrArray(value)) {
                    replace(value); // Recursively process objects and arrays
                } else if (typeof value === 'string' && value.startsWith('data:image/jpeg;base64')) {
                    obj[key] = 'A Base64 Image'; // Replace matching string values
                }
            }
        }
    }

    replace(obj);
}
