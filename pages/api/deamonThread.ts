import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as debug from "../../utils/debug";
import * as fs from "../../utils/fileServer";
import * as fu from "../../utils/fileUtils";
import {config, system, defaultImage } from "../../utils/config";
import * as global from "../../utils/globalUtils";
import {AliCVService} from '../../ai/cv/AliCVService';
import * as enums from "../../utils/enums";
import * as au from "../../utils/auditUtils";

let deamonThreads = false;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) { 
    try{   
        if(!deamonThreads){
            runDeamonThreads();
            deamonThreads = true;
            debug.log("----------后台任务启动成功！-----------");            
        }
        
        res.status(200).json("----------后台任务启动成功！-----------");
        
    }catch(e){
        debug.error("----------启动后台任务时，发生异常，请检查！");
        debug.error(e);
        res.status(500).json("----------启动后台任务时，发生异常，请检查！");
    }
}

async function runDeamonThreads(){
    debug.log("----------------enter deamon thread----------------------");
    /****** 以下是系统重启时执行一次的任务 *************
    ***************************************************/
    // 初始化数据库中的初始数据
    await initTableData();
    await initGlobalValues();
    
    // 重新加载执行到一半的模型训练任务
    reuploadModels();
    
    // 以下是定时执行的任务

    let time = 0;
    while(true){
        try{
            // 每分钟执行一次的任务 
            const now = new Date().toLocaleString();
            debug.log(`-----------[${now}] deamon thread still alive in last 1 minute------------`);

            // 每十分钟执行一次的任务           
            if(time % 10 == 0){
                if(process.env.AUTO_AUDIT == "TRUE"){
                    await auditContent();
                }
                if(process.env.MOVE_BASE64_TO_FILE_SERVER == "TRUE"){
                    await moveBase64ToFileServer();
                }
            }

            // 每60分钟执行一次的任务           
            if(time % 60 == 0){
                if(process.env.AUTO_DELETE_NOT_LOGIN_USER_DATA == "TRUE"){
                    await autoDeleteNotLoginUserData();
                }
            }            
        }catch(e){
            debug.error("------------------deamon thread error-----------------");
            debug.error(e);
        }
        await new Promise((resolve) => setTimeout(resolve, 60000));
        time++;
    }
}



///////////////////////////////////////////////////////////////////////////////////////////
// 以下是各种任务进程
async function initGlobalValues(){
    let imageAmount = await prisma.room.count(); // 这里只是统计以下数据库里一共有多少张图片
    imageAmount = imageAmount * 100 + Math.floor((Math.random()*100)); 
    await global.globalSet("GLOBAL_VALUE", "IMAGE_AMOUNT", String(imageAmount));
}



const rootUserId = system.users.rootId;

async function initTableData(){
    // 系统账号
    const rootAccount = await prisma.user.findUnique({where:{id:system.users.rootId}});
    if(!rootAccount){
        const root = await prisma.user.create({
            data:{
                id: system.users.rootId,
                name: "系统管理员",
                email: "runhuasun@hotmail.com",
                emailVerified: new Date(),
                image: config.logo128,
                boughtCredits: 0,
                credits: 0,
                password: "$2b$10$fv/vAkmdY/aFzAMIj/E8ae.WHbJrPLElA9VXxX2G2g0lvYAa4sheO",
                invitedbycode: "walkin",
                incomeCredits: 0,
                createdAt: new Date(),
                desc: JSON.stringify({"contactPhone":"","contactEmail":"","contactWechat":"","contactQQ":"","selfIntro":"我是系统ROOT管理员"}),
                fans: 0,
                actors: "admin|user"
            }
        });
    }
    
    const trashAccount = await prisma.user.findUnique({where:{id:system.users.trashId}});
    if(!trashAccount){
        const user = await prisma.user.create({
            data:{
                id: system.users.trashId,
                name: "超能写真馆",
                email: "trash_account@aiputi.cn",
                emailVerified: new Date(),
                image: config.logo128,
                boughtCredits: 0,
                credits: 0,
                password: "$2b$10$fv/vAkmdY/aFzAMIj/E8ae.WHbJrPLElA9VXxX2G2g0lvYAa4sheO",
                invitedbycode: "root",
                incomeCredits: 0,
                createdAt: new Date(),
                desc: JSON.stringify({"contactPhone":"","contactEmail":"","contactWechat":"","contactQQ":"","selfIntro":"我是系统默认的垃圾箱账号。系统生成的中间结果被放到这个账号"}),
                fans: 0,
                actors: "trash"
            }
        });
    }

    const notLoginAccount = await prisma.user.findUnique({where:{id:system.users.notLoginUserId}});
    if(!notLoginAccount){
        const user = await prisma.user.create({
            data:{
                id: system.users.notLoginUserId,
                name: "未知用户",
                email: "unknown_account@aiputi.cn",
                emailVerified: new Date(),
                image: config.logo128,
                boughtCredits: 0,
                credits: 0,
                password: "$2b$10$fv/vAkmdY/aFzAMIj/E8ae.WHbJrPLElA9VXxX2G2g0lvYAa4sheO",
                invitedbycode: "root",
                incomeCredits: 0,
                createdAt: new Date(),
                desc: JSON.stringify({"contactPhone":"","contactEmail":"","contactWechat":"","contactQQ":"","selfIntro":"我是未知用户账号，所以未知用户上传的文件被放在这里"}),
                fans: 0,
                actors: "unknown"
            }
        });
    }

    //////////////////////////////////////////////////////////////////////
    // 系统缺省模型
    ////////////////////////////////////////////////////////////////////////
    const chatModels = system.chatModels;
   
    for (const [key, model] of Object.entries(chatModels)) {
        try {
            const existing = await prisma.model.findUnique({
                where: { id: model.id }, select: { id: true}
            });
    
            if (!existing) {
                await prisma.model.create({
                    data: {
                        id: model.id,
                        channel: "SYSTEM",
                        user: { connect: { id: rootUserId } },
                        code: model.code,    
                        name: model.name,
                        func: "chat",
                        theme: "SYSTEM",
                        trainSrv: model.trainSrv,
                        status: "FINISH",
                        sysScore: 0,
                        proId: "",
                        usedCredits: 0,
                        access: "PRIVATE",
                        aiservice: model.aiservice,
                        baseModel: model.baseModel,
                        url: "",  // 训练的结果
                        proMsg: model.proMsg,
                        price: 0, // 缺省价格
                        coverImg: defaultImage.modelCover,
                        desc: model.desc,
                    },
                });
    
                console.log(`✅ Model created: ${model.name}`);
            } else {
                console.log(`🟡 Model exists: ${model.name}`);
            }
        } catch (e) {
            console.error(`❌ Failed to process model '${key}':`, e);
        }
    }
    
    /////////////////////////////////////////////////////////////////////////////////////////////
    // 系统相册
    /////////////////////////////////////////////////////////////////////////////////////////////
    const albums = system.album;
   
    for (const [key, album] of Object.entries(albums)) {
        try {
            const existing = await prisma.album.findUnique({
                where: { id: album.id }, select: { id: true}
            });
    
            if (!existing) {
                await prisma.album.create({
                    data: {
                        id: album.id,
                        code: album.id,
                        name: album.name,
                        type: album.mediaType,
                        desc: album.name,
                        coverImg: defaultImage.albumCover,
                        access: "PUBLIC",
                        score: 9999999,
                        status: "CREATED",
                        user: { connect: { id: rootUserId } },
                    },
                });
    
                console.log(`✅ Album created: ${album.name}`);
            } else {
                console.log(`🟡 Album exists: ${album.name}`);
            }
        } catch (e) {
            console.error(`❌ Failed to process album '${key}':`, e);
        }
    }
}



async function reuploadModels(){
    debug.log("--------reuploadModels---------");
    let channel = "PUBLIC";
    switch(config.websiteName){
        case "aixiezhen":
            channel = "PORTRAIT";
            break;
    }
    
    try{
        // 把所有没上传的lora文件上传到文件服务器
        const models = await prisma.model.findMany({
            where: {
                status: "FINISH",
                channel,
                func: "lora",
                OR: [
                    {
                        proMsg: {
                            equals: null
                        }
                    },
                    {
                        NOT: {
                            proMsg: {
                                contains: "http"
                            }
                        }
                    }
                ],               
                url: {
                    contains: 'replicate.'
                }
            },
            select: {
                id: true,
                name: true,
                url: true
            },
            orderBy: [
                { createTime: 'asc', }
            ],          
        });
        
        if(models && models.length>0){
            debug.warn(`found ${models.length} models files still not been uploded to file server`);
            for(const m of models){
                // 一个一个上传，谨防占用过多系统资源
                if(m.url){
                    debug.log("deamon thread uploading lora file " + m.url);                                              
                    const uploaded = await fs.moveToFileServer(m.url, "M");
                    if(uploaded){
                        debug.log("deamon thread uploaded lora file to:" + uploaded);                            
                        // 更新训练任务
                        await prisma.model.update({
                            where: { id: m.id },
                            data: {
                                url: uploaded,
                                proMsg: m.url || "",
                            }  // 替换到正式URL                            
                            });
                    }else{
                        debug.error(m.name + " was failed to be uploaded in deamon thread reuploadModels");
                    }
                }
            }
        }
    }catch(e){
        debug.error("exception in reuploadModels");
        debug.error(e);
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 定期检查Room, UserFile, Rawdata表，如果是图片和视频类型，就审核内容
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function auditContent(){
    debug.log("--------------auto audit thread start-----------------");
    const now = new Date();
    const roomAuditTime = new Date(now.getTime() - 60 * 60 * 1000); 
    
    // Room表审核
    const unauditRooms = await prisma.room.findMany({
        where:{
            audit: null,
            // status: "SUCCESS",
            outputImage: {
                contains: "aliyuncs.com"
            },
            createdAt: {
                lt: roomAuditTime
            }
        },
        select: {
            id: true,
            inputImage: true,            
            outputImage: true,
            audit: true,
            resultType: true,
            func: true,
        }
    });

    for(const room of unauditRooms){
        await new Promise((resolve) => setTimeout(resolve, 500)); // aliyun限流QPS 3
        if(fu.isURL(room.outputImage)){
            try{
                const auditResult = await au.auditURL(room.outputImage, room.resultType);
                
                if(auditResult != "N"){
                    debug.log("found unsafe room：" + room.outputImage);
                    const backupImage = await fs.backupToUS(room.outputImage);
                    debug.log(room.outputImage, "移动到-->", backupImage);
                    await fs.deleteFileByURL(room.outputImage);
                    debug.warn("删除存储桶中的数据：" + room.outputImage);  
                    const data:any = {
                            outputImage: backupImage,
                            audit: auditResult,
                            access: "PRIVATE", // 审核不通过的作品只能私人观看                            
                        };
                    // 处理videoPoster
                    if(room.inputImage && room.resultType=="VIDEO"){
                        debug.log("backup poster image" + room.inputImage);
                        const bi = await fs.backupToUS(room.inputImage);
                        debug.log(room.inputImage, "移动到-->", bi);
                        await fs.deleteFileByURL(room.inputImage);
                        debug.warn("删除存储桶中的数据：" + room.inputImage);  
                        data.inputImage = bi;
                    }
                    //if(room.func == "createPrompt"){
                    //    data.status = "DELETE";
                    //}
                    const newRoom = await prisma.room.update({
                        where: {
                            id: room.id,
                        },
                        data: data
                    });
                    continue;
                }
            }catch(err){
                debug.error("deamon thread audit room exception:", err);
                continue;
            }
        }
        const newRoom = await prisma.room.update({
            where: {
                id: room.id,
            },
            data: {
                audit: "N", // 不是URL或者没问题就标记N
            }
        });
    }

    
    // UserFile表审核
    debug.log(`----------------start to audit user files-----------------------`);
    const userFileAuditTime = new Date(now.getTime() - 120 * 60 * 1000); 
    const unauditFiles = await prisma.userFile.findMany({
        where:{
            audit: null,
            // status: "CREATED",
            url: {
                contains: "aliyuncs.com"
            },            
            createTime: {
                lt: userFileAuditTime
            }
        },
        select: {
            id: true,
            url: true,
            audit: true,
            type: true
        }
    });
    debug.log(`found ${unauditFiles?.length} unaudit user files......`);
    for(const file of unauditFiles){
        await new Promise((resolve) => setTimeout(resolve, 500)); // aliyun限流QPS 3
        if(fu.isURL(file.url)){
            try{
                const auditResult = await au.auditURL(file.url, file.type);
                if(auditResult != "N"){
                    debug.log("found unsafe user file：" + file.url);
                    const backupImage = await fs.backupToUS(file.url);
                    debug.log(file.url, "移动到-->", backupImage);
                    await fs.deleteFileByURL(file.url);
                    debug.warn("删除存储桶中的数据：" + file.url);   
                    
                    const newFile = await prisma.userFile.update({
                        where: {
                            id: file.id,
                        },
                        data: {
                            url: backupImage,
                            audit: auditResult,
                        }
                    });
                    continue;
                }
            }catch(err){
                debug.error("deamon thread audit room exception:", err);
                continue;
            }
        }
        const newFile = await prisma.userFile.update({
            where: {
                id: file.id,
            },
            data: {
                audit: "N"
            }
        });
    }    
}


async function moveBase64ToFileServer(){
    debug.log("--------------Base64 image moving thread start-----------------");
    const base64Rooms = await prisma.room.findMany({
        where: {
            outputImage: {
                contains: "data:image/jpeg;base64"
            }
        },
        select:{
            id: true,
            resultType: true,
            audit: true,
            outputImage: true
        }
    });
    debug.log(`--------------found ${base64Rooms.length} Base64 images to move-----------------`);    
    for(const room of base64Rooms){
        try{
            const newURL = await fs.moveToFileServer(room.outputImage, "U");
            debug.log(room.id, " base64图片移动到-->", newURL);
            await prisma.room.update({
                where:{
                    id: room.id
                },
                data:{
                    outputImage: newURL,
                    audit: null
                }
            });
        }catch(err){
            debug.error("deamon thread base64 moving exception:", err);
            continue;
        }
    }

}

// 每天凌晨4点执行一次图片清理工作
// 找到截至0点，已经满72小时的ROOM, USEFILE
// 付款用户保留144小时
// 如果ROOM为公开，并且审核通过的不删除
// 如果ROOM在用户相册里不删除
// 系统管理员的数据不删除
// 删除操作数据库记录标记删除，媒体物理删除
// 所有物理删除的文件考虑下载到服务器本地，每天一个文件夹保存，并定期离线备份
async function autoDeleteOldData(){
    debug.log("--------------autoDeleteOldData thread start-----------------");    
    
    // 计算一个月前的时间
    const oneMonthAgo = new Date(Date.now() - 3600 * 1000 * 24 * 30);    
    
    const oldUserFiles = await prisma.userFile.findMany({
        where:{
            access: "PRIVATE",
            createTime: {
                lte: oneMonthAgo
            },
            
        },
        select: {
            id: true,
            url: true,
        }
    });

    for(const file of oldUserFiles){
        await new Promise((resolve) => setTimeout(resolve, 500)); // aliyun限流QPS 3
        if(fu.isURL(file.url)){
            try{
                await fs.deleteFileByURL(file.url);
                debug.warn("删除存储桶中的数据：" + file.url);  
                await prisma.userFile.delete({ where: { id: file.id } });
                debug.log("物理删除数据库中UserFile记录：", file.id);
            }catch(err){
                debug.error("deamon thread autoDeleteNotLoginUserData exception:", err);
                continue;
            }
        }
    }     
}



// 每小时删除一次一小时前的未登录用户数据
async function autoDeleteNotLoginUserData(){
    debug.log("--------------autoDeleteNotLoginUserData thread start-----------------");    
    // 计算一小时前的时间
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);    
    const notLoginFiles = await prisma.userFile.findMany({
        where:{
            userId: "not_login_user_id",
            createTime: {
                lte: oneHourAgo
            },
        },
        select: {
            id: true,
            url: true,
        }
    });

    for(const file of notLoginFiles){
        await new Promise((resolve) => setTimeout(resolve, 500)); // aliyun限流QPS 3
        if(fu.isURL(file.url)){
            try{
                await fs.deleteFileByURL(file.url);
                debug.warn("删除存储桶中的数据：" + file.url);  
                await prisma.userFile.delete({ where: { id: file.id } });
                debug.log("物理删除数据库中UserFile记录：", file.id);
            }catch(err){
                debug.error("deamon thread autoDeleteNotLoginUserData exception:", err);
                continue;
            }
        }
    }    

}



