import type { NextApiRequest, NextApiResponse } from "next";
import { Model, User, Rawdata, ModelRawdatas } from "@prisma/client";
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import {embeddingText, cosineSimilarity} from "../../utils/embedding";
import prisma from "../../lib/prismadb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {log, warn, error} from "../../utils/debug";
import * as faiss from "faiss-node";
import { WechatyBuilder } from 'wechaty';
import { moveToUploadio, deleteFiles, getFilePathFromURL } from "../../utils/bytescale";
import {moveToCOS} from "../../utils/COS";
import {moveToOSS, uploadFile} from "../../utils/OSS";
import * as vm from "../../utils/speakers";
import {XunFeiTTS} from '../../ai/tts/XunFeiTTS';
import {TencentTTS} from '../../ai/tts/TencentTTS';
import { moveToFileServer, uploadDataToServer } from "../../utils/fileServer";
import {translate} from "../../utils/localTranslate";
import {BaseTTS} from "../../ai/tts/BaseTTS";
import * as AIS from "../../ai/AIService";
import { hash , compare } from "bcrypt";

/*
interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    messages: {role: string;
              content: string;
              name: string;
              }[];
    modelId: string;
    modelCode: string;
    rawdataId: string;
    cmd: string;
    text1: string;
    text2: string;
    url: string;
  };
}
*/


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions);

    try{
        let {CMD} = req.query;
        let {cmd, url, text1, text2, modelId, modelCode, messages, rawdataId, userId, 
             
             value1, value2} = req.body;

        if(CMD){
          cmd = CMD;
        }
      
        log("cmd:" + cmd);
        const email = session?.user?.email!; // "runhuasun@hotmail.com"; 
        if(!email){
            return res.status(400).json("请先用系统管理员登录，再做操作！");
        }
        const user = await prisma.user.findUnique({
            where: {
                email: email,
            }
        });
        if(!user || user.actors.indexOf("admin")<0){
            return res.status(400).json("请先用系统管理员登录，再做操作！");
        }

        if(cmd == "TEST_HASH"){
          const testResult = await compare(value1, value2);
          return res.status(200).json({testResult});
          
        }else if(cmd == "WECHAT_PASSWORD"){
            const users = await prisma.user.findMany({
                where: {
                    weixinId: { not: null },
                }
            });
            log("found users:", users.length);
            const changed:any[] = [];
            for(const u of users){
                if(!await compare("wechat", u.password)){
                    changed.push(u);
                }
            }
            log(JSON.stringify(changed));
            
            return res.status(200).json({changed});

        }else if(cmd == "TEST_PRISMA"){
            let roomId:undefined;
            try{
                log("test findUnique");
                const room1 = prisma.room.findUnique({
                    where:{ id: roomId}
                });
                log(JSON.stringify(room1));
            }catch(e){
                error(e);
            }

            try{
                log("test update");
                const room2 = prisma.room.update({
                    where:{ id: roomId },
                    data: {status: "SUCCESS"}
                });
                log(JSON.stringify(room2));
            }catch(e){
                error(e);
            }

            return res.status(200).json("测试完毕，请查看后台");
            
        }else if(cmd == "updateVoiceModel"){
         
            for(const s of vm.speakers){
                const tmp = s.code.split("***");
                const oldcode = tmp[0] + "&&&" + tmp[1];
                
                let m:any = await prisma.model.findUnique({
                    where:{
                        code: s.code
                    }
                });
                if(!m){
                    m = await prisma.model.findUnique({
                        where:{
                            code: oldcode,
                        }
                    });

                    if(!m){
                        m = await prisma.model.create({
                            data:{
                                code: s.code,
                                name: s.name,
                                func: "voice",
                                status: "FINISH",
                                trainSrv: "pretrained",
                                userId: user.id,
                                usedCredits: 0,
                                proId: "retrainded",
                                price: s.basePrice,
                                url: "",
                                proMsg: "",
                                coverImg: "",
                                aiservice: s.aiservice,
                                language: s.language,
                                labels:"",
                                theme: s.gender,
                                channel: "PUBLIC",
                                access: "PUBLIC"
                            }
                        });
                        continue;
                    }
                    
                }
              
                m = await prisma.model.update({
                    data:{
                        code: s.code,
                        name: s.name,
                        func: "voice",
                        status: "FINISH",
                        trainSrv: "pretrained",
                        userId: user.id,
                        usedCredits: 0,
                        proId: "retrainded",
                        price: s.basePrice,
                        url: "",
                        proMsg: "",
                        coverImg: "",
                        aiservice: s.aiservice,
                        language: s.language,
                        labels:"",
                        theme: s.gender,
                        channel: "PUBLIC",
                        access: "PUBLIC"
                    },
                    where:{
                        id: m.id
                    }
                });

                if(!m.desc){
                    let demo = "这样说话好听吧！你喜欢不喜欢我的声音呢？轻轻的我走了，正如我轻轻的来，我挥一挥衣袖，不带走一片云彩..."
                    if(m.language != "zh"){
                      demo = await translate(demo, "zh", m.language);
                    }
                  
                    const vData = await AIS.textToVoice(demo, s.code, m.aiservice);
                    if(vData && typeof vData === 'string' && vData.trim() !== ''){
                        const remoteFile = await uploadDataToServer(Buffer.from(vData, 'base64'), "audio/x-mpeg", "temp.mp3");
                        if(remoteFile){
                            m = await prisma.model.update({
                                data: { 
                                    desc: remoteFile
                                },
                                where:{
                                    id: m.id
                                }
                            });
                            log("为" + m.code + '(' + m.name + ')添加样本语音：' + remoteFile);
                        }
                    }  
                }
            }

            res.status(200).json("语音模型更新成功");

        }else if(cmd == "uploadToOSS"){
            // await moveToOSS(url, "T");
            await uploadFile(url, "T");
        }else if(cmd == "moveUser"){

            try{
                const users = await prisma.user.findMany({
                    select:{
                        id:true,
                        image:true
                    },
                    orderBy: {
                      createdAt: 'desc'
                    }  
                });

                for(const u of users){
                    const url = u.image;
                    log("url is : " + url);
                    if(url && url.indexOf("https://upcdn.io/")>=0){
                        const cosUrl = await moveToCOS(url, "S");

                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.user.update({
                                where:{
                                    id: u.id
                                },
                                data:{
                                    image:cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            const path = getFilePathFromURL(url);
                            if(path){
                                const result = await deleteFiles([{filePath:path}]);
                                if(result){
                                    log(path + " was deleted");
                                }else{
                                    error("failed to delete " + path);
                                }
                            }
                        }
                    }
                }
            }catch(e){
                error(e);
            }

          
        }else if(cmd == "moveRawData"){

            try{
                const rawdatas = await prisma.rawdata.findMany({
                    where:{
                        status:"PUBLISH"
                    },
                    orderBy: {
                      createTime: 'desc'
                    },
                    select: {
                        id: true,
                        url: true
                    }
                });

                for(const m of rawdatas){
                    const url = m.url;
                    log("url is : " + url);
                    if(url && url.indexOf("https://upcdn.io/")>=0){
                        const cosUrl = await moveToCOS(url, "U");

                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.rawdata.update({
                                where:{
                                    id: m.id
                                },
                                data:{
                                    url:cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            const path = getFilePathFromURL(url);
                            if(path){
                                const result = await deleteFiles([{filePath:path}]);
                                if(result){
                                    log(path + " was deleted");
                                }else{
                                    error("failed to delete " + path);
                                }
                            }
                        }
                    }
                }
            }catch(e){
                error(e);
            }

          
        }else if(cmd == "moveRoom"){

            try{
                const rooms = await prisma.room.findMany({
                    where:{
                        status:"SUCCESS"
                    },
                    orderBy: {
                      createdAt: 'desc'
                    },
                    select: {
                        id: true,
                        outputImage: true
                    }
                });

                for(const m of rooms){
                    const url = m.outputImage;
                    log("url is : " + url);
                    if(url && url.indexOf("https://upcdn.io/")>=0){
                        const cosUrl = await moveToCOS(url, "G");

                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.room.update({
                                where:{
                                    id: m.id
                                },
                                data:{
                                    outputImage:cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            const path = getFilePathFromURL(url);
                            if(path){
                                const result = await deleteFiles([{filePath:path}]);
                                if(result){
                                    log(path + " was deleted");
                                }else{
                                    error("failed to delete " + path);
                                }
                            }
                        }
                    }
                }
            }catch(e){
                error(e);
            }

        }else if(cmd == "movePrompt"){
            try{
                const prompts = await prisma.prompt.findMany({
                    where:{
                        status:"FINISH"
                    },
                    select:{
                        id: true,
                        coverImg: true,
                    }                    
                });

                for(const m of prompts){
                    if(m.coverImg && m.coverImg.indexOf("myqcloud.com")<0){
                        log("coverImg is : " + m.coverImg);
                        const cosUrl = await moveToCOS(m.coverImg, "G");
                     
                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.prompt.update({
                                where:{
                                    id: m.id
                                },
                                data:{
                                    coverImg: cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            if(m.coverImg.indexOf("upcdn.io")>=0){
                                const path = getFilePathFromURL(m.coverImg);
                                if(path){
                                    const result = await deleteFiles([{filePath:path}]);
                                    if(result){
                                        log(path + " was deleted");
                                    }else{
                                        error("failed to delete " + path);
                                    }
                                }
                            }
                        }
                    }
                }
            }catch(e){
                error(e);
            }           
        }else if(cmd == "moveModel"){

            try{
                const models = await prisma.model.findMany({
                    where:{
                        status:"FINISH"
                    },
                    select:{
                        id: true,
                        url: true,
                        coverImg: true,
                        func: true
                    }
                });

                for(const m of models){

                    // 对于lora迁移url
                    if(m.func=="lora" && m.url && m.url.indexOf("myqcloud.com")<0 && m.url.indexOf("replicate.delivery")<0){
                        log("url is : " + m.url);
                        const cosUrl = await moveToCOS(m.url, "G");

                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.model.update({
                                where:{
                                    id: m.id
                                },
                                data:{
                                    url: cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            if(m.url.indexOf("upcdn.io")>=0){
                                const path = getFilePathFromURL(m.url);
                                if(path){
                                    const result = await deleteFiles([{filePath:path}]);
                                    if(result){
                                        log(path + " was deleted");
                                    }else{
                                        error("failed to delete " + path);
                                    }
                                }
                            }
                        }
                    }

                    
                    if(m.coverImg && m.coverImg.indexOf("myqcloud.com")<0){
                        log("coverImg is : " + m.coverImg);
                        const cosUrl = await moveToCOS(m.coverImg, "G");
                     
                        if(cosUrl && cosUrl.indexOf("myqcloud.com")>=0){
                            await prisma.model.update({
                                where:{
                                    id: m.id
                                },
                                data:{
                                    coverImg: cosUrl
                                }
                            });
                            log("moved to : " + cosUrl);

                            if(m.coverImg.indexOf("upcdn.io")>=0){
                                const path = getFilePathFromURL(m.coverImg);
                                if(path){
                                    const result = await deleteFiles([{filePath:path}]);
                                    if(result){
                                        log(path + " was deleted");
                                    }else{
                                        error("failed to delete " + path);
                                    }
                                }
                            }
                        }
                    }
                  
                }
            }catch(e){
                error(e);
            }
        }else if(cmd == "uploadToCOS"){
            
            await moveToCOS("https://upcdn.io/kW15bC3/raw/U/2024/02/28/2Guy5f.jpeg", "T");
          
        }else if(cmd == "clearInputs"){
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 1);         
            try{
                const rooms = await prisma.room.findMany({
                    where:{
                        createdAt: {
                            lte: thirtyDaysAgo,
                        },
                      inputImage: {
                        not: '',
                      },             
                    },
                    select:{
                        id:true,
                        inputImage:true,
                      
                    }
                });
    
                log("rooms need to be cleared: " + rooms.length);
                for(const room of rooms){
                    if(room.inputImage && room.inputImage.indexOf("upcdn")>=0){
                        const keywords = ['/image/', '/raw/', '/thumbnail/'];
                        let path = "";
                        let p = -1;
                        for(const word of keywords){
                            p = room.inputImage.indexOf(word);
                            if(p > 0){
                                p += word.length;
                                path = room.inputImage.substring(p-1);
                                const wen = path.indexOf("?");
                                if(wen>0){
                                    path = path.substring(0, wen-1);
                                }                                
                                break;
                            }
                        }
                        if(p >0){
                            const result = await deleteFiles([{filePath:path}]);
                            if(result){
                                await prisma.room.update({
                                    where:{
                                        id: room.id
                                    },
                                    data:{
                                        inputImage: ""
                                    }
                                });
                                log("upload image is deleted:" + path);
                            }else{
                                error("upload image is NOT deleted:" + path);
                            }
                        }
                    }
                }
                             
                return res.status(200).json("30天之前上传的图片都被删除了！");            
            }catch(e){
                error("exception on clearInputs");
                error(e);
                return res.status(400).json("操作发生意外失败！");            
            }
        }if(cmd == "startWechaty"){
            const bot = WechatyBuilder.build() // get a Wechaty instance
                bot.on('scan', (qrcode, status) => console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`));
                bot.on('login',            user => console.log(`User ${user} logged in`));
                bot.on('message',       message => console.log(`Message: ${message}`));
            await bot.start();

            
        }else if(cmd == "removeRawdata"){
            const model = await prisma.model.findUnique({
                where:{
                    id: modelId
                }
            });

            const index = faiss.IndexFlatL2.read(model!.url!);

            const vectors = await prisma.vector.findMany({
                where: {
                    modelId: modelId,
                    rawdataId: rawdataId,
                    scope: 'MODEL',
                }
            });
            let keys = [];
            for(const v of vectors){
                keys.push(Number(v.key));
            }
            const nRemoved = index.removeIds( keys );

            log("keys:" + keys.length);
            log("nRemoved:" + nRemoved);
            
            if(nRemoved == keys.length){
                await index.write(model!.url!); // 存储索引        
                log("index saved");
            }else{
                log("index not save");
            }

        }else if(cmd == "getModelData"){
            const model = await prisma.model.findUnique({
                where:{
                    id: modelId
                },
                include:{
                    vectors:{
                        where:{
                            scope: "MODEL",
                        },
                    },
                    modelRawdatas: {
                        include: {
                            rawdata: true
                        },
                        orderBy: {
                            createTime: 'asc'
                        }                  
                    }
                }
            });
/*
            if(model){
                let ctrl = 0;
                while(ctrl < 10000){              
                    const vecs = await prisma.vector.findMany({
                        where:{
                            modelId: model.id,
                            scope: "MODEL",
                            rawdataId: {
                                not: null,
                            }
                        },
                        skip: ctrl*1000,
                        take: 1000
                    });
                    if(vecs && vecs.length>0){
                        model.vectors = model.vectors.concat(vecs);
                        if(vecs.length<1000){
                            break;
                        }
                    }
                    ctrl++;
                }
            }
*/
          
            // log("getModelData:" + JSON.stringify(model));
            return res.status(200).json({model:model});

        }else if(cmd == "migrateModel"){
            // Check if user is logged in
            if (!session || !session.user) {
                return res.status(401).json("请先登录，再进行操作！");
            }
            
            // Query the database by email to get the number of generations left
            const user = await prisma.user.findUnique({
                where: {
                  email: session.user.email!,
                },
            });        
    
            if(!user || user.actors!.indexOf("admin") == -1){
                return res.status(401).json("只有管理员才可以执行该操作！");            
            }
              
            const ret = await fetch("https://debug.aiputi.cn/api/testAPI", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                  cmd: "getModelData",
                  modelId: modelId
              }),
            });
        
            const result = await ret.json();
            // log(JSON.stringify(result));
            const im = result.model;          
          
            if(ret.status == 200){
                // 写入模型
                const model = await prisma.model.create({
                    data:{
                        userId: user.id,
                        code: modelCode,
                        name: im.name+modelCode,
                        func: im.func,
                        theme: im.theme,
                        trainSrv: im.trainSrv,
                        status: im.status,
                        proId: im.proId,
                        usedCredits: 0,
                        access: "PRIVATE",
                        url: im.url,
                        proMsg: im.proMsg,
                        price: im.price,
                        coverImg: im.coverImg,
                        desc: im.desc,
                        callbacked: im.callbacked,
                        channel: im.channel,
                        datasets: im.datasets,
                        aiservice: im.aiservice,
                        baseModel: im.baseModel,
                        params: im.params,
                        usedTokens: im.usedTokens,
                        imgRecogHint: im.imgRecogHint,
                        labels: im.labels,
                        language: im.language,
                    }
                });

                let pVec = 1;
                let pRaw = 1;
                log("vectors.length:" + im.vectors.length);              

                let noRawdataVecs = [];
                let hasRawdataVecs = [];
                for(const iv of im.vectors){                    
                    if(iv.rawdataId){
                        hasRawdataVecs.push(iv);
                    }else{
                        noRawdataVecs.push(iv);
                    }
                }
                  
                for(const imr of im.modelRawdatas){
                    // 写入模型的语料
                    const rawdata = await prisma.rawdata.create({
                        data:{
                            name: imr.rawdata.name,
                            type: imr.rawdata.type,
                            status: imr.rawdata.status,
                            userId: user.id,
                            desc: imr.rawdata.desc,
                            url: imr.rawdata.url
                        }
                    });
                  
                    // 关联模型和语料
                    const mrd = await prisma.modelRawdatas.create({
                        data:{
                            modelId: model.id,
                            rawdataId: rawdata.id,
                        }
                    });

                    log("-------写入第" + pRaw++ + "条语料文件");

                    for(const iv of hasRawdataVecs){                    
                        // 如果向量是由当前语料产生                        
                        if(iv.rawdataId == imr.rawdata.id){
                            // 写入模型的向量
                            await prisma.vector.create({
                                data:{
                                    modelId: model.id,
                                    key: iv.key,
                                    value: iv.value,
                                    vecVal: iv.vecVal ? iv.vecVal : [],
                                    rawdataId: rawdata.id
                                }
                            });
                            log("写入第" + pVec++ + "条向量");
                        }
                    }                  
                }

                log("---------------------开始写入rawdata为空的向量----------------");
                for(const iv of noRawdataVecs){
                    // 写入模型的向量
                    await prisma.vector.create({
                        data:{
                            modelId: model.id,
                            key: iv.key,
                            value: iv.value,
                            vecVal: iv.vecVal ? iv.vecVal : [],
                        }
                    });
                    log("写入第" + pVec++ + "条向量");                    
                }
                
                return res.status(200).json("OK");
            }
            return res.status(400).json("未知错误！");            

            
        }else if(cmd == "migrateDataset"){
            const models = await prisma.model.findMany({
                where: {
                    datasets: {
                        not: null,
                    },
                    likes:{
                        not: 2
                    }
                },
                orderBy: {
                    createTime: 'asc',
                },           
            });

        for(const m of models){
            const datas = m.datasets!.split(/[|;]/);
            for(const data of datas){
                const name = data.split("/").pop();
                const ext = name!.split(".").pop();
                const type = (m.func! == "chat") ? "TEXT" : ( ext!=="zip" ? "ZIP" : "IMAGE");
                
                const newRawdata = await prisma.rawdata.create({
                    data: {
                        name: name!, 
                        url: data,
                        type: type,
                        status: "PUBLISH",
                        userId: m.userId,
                        desc: m.name                       
                    }
                });
                const newModelRawdata = await prisma.modelRawdatas.create({
                    data: {
                        modelId: m.id, 
                        rawdataId: newRawdata.id,
                    }
                });
            }

           const newModel = await prisma.model.update({
              where: {
                id: m.id,
              },
              data: {
                likes: 2,
              }
            });          
        }
     
        
        }else if(cmd == "compareEmb"){

            const emb1 = (await embeddingText(text1)).vector;
            const emb2 = (await embeddingText(text2)).vector;
            
            console.log("EMB1:" + emb1);
            console.log("EMB2:" + emb2);
            
            const sim = cosineSimilarity(emb1, emb2);      
            
            console.log("SIM:" + sim);
            
            return res.status(200).json({sim:sim});

            
        }else if(cmd == "testEventSource"){
     //   }else{     
            console.error("--------enter test API------------------");    
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Encoding', 'identity');            
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader("Cache-Control", "no-store");
            
          res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有来源访问，你也可以指定具体的来源
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // 允许的请求方法
     //     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // 允许的请求头

            res.flushHeaders();

            const data = "测试数据在这里：《三国演义》是中国古代长篇小说的代表作，作者为明代小说家罗贯中。本书是以历史为蓝本，讲述了自184年至280年间中国东汉末年至晋朝建立的历史事件和人物，并描绘了当时的政治、军事、文化等方面的风貌。《三国演义》的故事起于东汉末年，国家统治由儿子傀儡皇帝与权臣窦氏集团掌握。其中刘备、关羽、张飞是最早提出反抗的豪杰，他们三人结下桃园三结义，并开始了他们的事业。而孙权在江东也崭露头角，以孙刘联合对抗曹操。曹操是勇冠三军的一代军事家，统军有方，但他野心勃勃，觊觎天下，所以他引起了刘备等反对的力量。在曹操部队内部，还有许多有能力的将领如许褚、许攸、夏侯惇、夏侯渊等。而他的妹妹曹贵人，更因为她的睿智和美貌征服了曹操部队的北方地区的人民。在逐渐扩大的战乱中，刘备遇到了诸葛亮这样一个千年一遇的智者。诸葛亮提供了背后的智慧和支持，让刘备能够逐渐取得一些军事成果。";

            for(const delta of data){
                await new Promise((resolve) => setTimeout(resolve, 50));
                res.write('event:message\n');
                res.write('data:' + delta + '\n\n');
                // res.flushHeaders();
                console.log(delta);
            }
            res.write('data:[DONE]\n\n');            
            res.end();  
            
        }
  } catch (error) {
    console.error("testAPI exception");
    console.error(error);
    res.status(500).json("调用Test服务器发生未知错误！");
  }
  
}


