import {log, warn, error} from "../../utils/debug";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as Fetcher from "node-fetch";
import * as faiss from "faiss-node";
import { embeddingText } from "../../utils/embedding";
import { Model, User } from "@prisma/client";
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import {trainModel, localModelProcess} from './trainChatModel';
import  * as AIS from "../../ai/AIService";
import {remember, recall} from "../../utils/memory";
import { embeddingSearch } from "../../utils/embedding";
import {replaceParam, parseParams} from "../../utils/formularTools";
import { filterWords } from "../../utils/sensitiveWords";
import { showChineseDateTime } from "../../utils/dateUtils";
import {useCredits, returnCredits, giveUserModelIncome} from "./creditManager";
import * as enums from "../../utils/enums";

export type ChatResponseData = {
    talkId: string | null;
    role: string | null;
    content: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
    body: {
        messages: {role: string;
                   content: string | any[];
                   name: string;
                  }[];
        modelId: string;
        historyRound: number;
        drawModel: string;
        drawMethod?: string;
        drawRatio?: string;
        maxOutput?: number;
    };
}



export default async function handler(
    req: ExtendedNextApiRequest,
    res: NextApiResponse< ChatResponseData  | string>
) {
    
    try{
        let { email, CMD, key } = req.query;
        let {messages, modelId, maxOutput, historyRound} = req.body;

        // 处理用户登录
        if(!email){
            const session = await getServerSession(req, res, authOptions);
            if (session && session.user) {
                email = session.user.email!;
            }
        }
        if(!email){
            return res.status(401).json("新用户请先点左下角[登录]按钮，极简注册哦！");
        }
    
        // Get user from DB
        const user = await prisma.user.findUnique({
            where: {
                email: email as string,
            },
        });
        if(!user){
            return res.status(401).json("新用户请先点左下角[登录]按钮，极简注册哦！");
        }
        if(user.credits <= 0){
            return res.status(402).json("用户已经没有提子了，请先购买！");
        }
        
        let authstr = "Bearer " + process.env.OPENAI_API_KEY;       
        
        log("----enter chat.ts-----");
        log("CMD:" + CMD);
        log("email:" + email);
        log("modelId:" + modelId);
        log("historyRound:" + historyRound);
        log("key:" + key);

        let model:Model | null = null;
        if(CMD != "prepareChat"){
            // 如果传递了key，就看看键值对里是否已经有了
            if(key){
                const globalKeyMap = new Redis();          
                
                const valMsg = await globalKeyMap.get("chat_messages" + key)
                log("redis_messages:" + valMsg);
                messages = valMsg ? JSON.parse(valMsg):{};

                const valModelId = await globalKeyMap.get("chat_modelId" + key);
                modelId = valModelId ? valModelId : "";
                log("redis_modelId:" + modelId);
                
                const valHistoryRound = await globalKeyMap.get("chat_history_round" + key);
                if(valHistoryRound){
                    historyRound = parseInt(valHistoryRound);
                }
                log("redis_history_round:" + valHistoryRound);

                globalKeyMap.del("chat_messages" + key);
                globalKeyMap.del("chat_modelId" + key);      
                globalKeyMap.del("chat_history_round" + key);      
                
                globalKeyMap.disconnect();
            }
          
          if(modelId){
            // 所找本次对话的角色模型，校验一下是否存在
            model = await prisma.model.findUnique({
              where: {
                  id: modelId,
              },
            });
            
            if(model){
              log("model.code=" + model.code);
            }
          }
  
          if(!model){    
              // 这种情况一般是有意外未返回的请求，写一个DONE先结束掉会话
              res.write("data:[DONE]\n\n"); 
              error("意外的无效请求，直接返回！");
              return;
              // return res.status(500).json("模型不存在，意外错误，无法继续服务！");
          }
        }
        

        let userMsg = "";
        if(messages.length > 0){
            const lastMsg = messages[messages.length-1];
            if(Array.isArray(lastMsg.content)){
                for(const m of lastMsg.content){
                    if(m.type === "text"){
                        userMsg = m.text?.trim();
                        break;
                    }
                }
            }else{
                userMsg = lastMsg.content.trim();
            }
        }
        const userMsgType = messages[messages.length-1].role == "user" ? "text" : messages[messages.length-1].role;
        let usedCredits = 0;
        let retObj : ChatResponseData | undefined = undefined;       

        
        // 开始处理用户指令

        if(CMD == "prepareChat"){
            log("chatbot准备流式对话");
            
            const {messages, modelId, historyRound} = req.body;
            log("prepare Chat modelId:" + modelId);
            const newRecord = await prisma.talk.create({
                data: {
                    replicateId: "",
                    userId: user.id,
                    inputMsg: "",
                    outputMsg: "",
                    aiservice: "",
                    predicturl: "",
                    func: "",
                    usedCredits: 0,
                    usedTokens: 0,
                    access: "PRIVATE",
                    status: "CREATE",
                    model: "",
                },
            });   
            
            const key = newRecord.id;
            const globalKeyMap = new Redis();
            await globalKeyMap.set("chat_messages" + key, JSON.stringify(messages));
            await globalKeyMap.set("chat_modelId" + key, modelId);    
            if(typeof historyRound === "number"){
                await globalKeyMap.set("chat_history_round" + key, String(historyRound));    
            }
            globalKeyMap.disconnect();

            res.status(200).json( key.toString() );
            return;
          
        }else if(CMD == "chatStream"){
            log("chobot开始执行流式对话");
            
            ////////////////////////////////////////
            // 处理生成文字    
            // 正常情况，前台传来用户的问题和之前的一组历史记录

            // 保存一份用户最原始的输入信息备用
            let userContent = messages[messages.length-1].content;

            const talkUserId = messages[messages.length-1].name;
            
            // Get user from DB
            const talkUser = await prisma.user.findUnique({
                where: {
                    id: talkUserId,
                },
            });
            if(!talkUser){
                return res.status(400).json( "系统错误：前台没有传递用户登录信息！" );
            }
            
            log("\n\n-------用户输入消息---------");
            log(userContent);

            log("\n\n-------过滤敏感词后---------");
            if(Array.isArray(userContent)){
                for(const m of userContent){
                    if(m.type === "text"){
                        m.text = filterWords(m.text);
                    }
                }
            }else{
                messages[messages.length-1].content = filterWords(userContent);
            }
            log(messages);
     
            log("\n\n-------加入模型系统消息---------");
            messages = bindSystemMsg(messages, model);
            //log(messages);
            
            log("\n\n-------加入用户最后3轮历史消息---------");
            log("historyRound:" + historyRound);
            let round = process.env.CHAT_HISTORY_ROUND ? parseInt(process.env.CHAT_HISTORY_ROUND) : 3;
            if(historyRound != undefined && typeof historyRound === 'number'){
                round = historyRound;
            }
            messages = await bindHistoryMsg(messages, model, talkUser, round);
            //log(messages);
            
            log("-------加入小模型知识---------");
            // 用小模型进行预处理
            const useMem = round > 0;
            messages = model ? await localModelProcess(messages, model, user, {useModel:true, useMem}) : messages;
            const advMsg = (model && model.name && (model.channel=="BOOK")) ? ("\n 你要结合" + model.name.trim() + "中的内容尽量正确的回答。") : "";
            if(advMsg){
                if(Array.isArray(messages[messages.length-1].content)){
                    for(const m of messages[messages.length-1].content){
                        if(m.type === "text"){
                            m.text += advMsg;
                            break;
                        }
                    }
                }else{
                    messages[messages.length-1].content += advMsg;
                }
            }
            // log(messages);
         
            log("----------------最终传递给大模型进行计算润色的信息---------------");
            let inputMsg = {
                params: (model && model.params) ? JSON.parse(model.params) : undefined,
                messages: messages,
            };
            log(inputMsg);
            //for(const msg of inputMsg.messages){
            //    log("role: " + msg.role + "\n");
            //    log("content: " + msg.content + "\n");                
            //}
            log("----------------结束输出最终信息---------------");

            const baseModel = (model && model.baseModel) ? model.baseModel : "ERNIE-Bot-turbo";
            const aiServiceProvider = (model && model.aiservice) ? model.aiservice : "BAIDUAI";
          
           // const aiservice = "BAIDUAI";
           // const baseModel = 'ERNIE-Bot-turbo';
           // const ais = new OpenAIService(baseModel); 
            const ais = AIS.createLLMInstance(aiServiceProvider, baseModel);

            if(!ais){
                return res.status(400).json( "没有找到对应的AI服务！" );
            }

            const cs = await ais.chat(inputMsg, res, true);
          
            let usedTokens = cs.usedTokens;
            let replicateId = cs.replicateId;
          
            // 计费 USD 0.002 / 1K tokens
            // = RMB 0.016 / 1K 
            // = 1个提子 6.25K tokens
            // 计算用户消耗的提子数，缺省每1000字扣1个，不足1000字也扣一个
            const userMsg = (messages.length > 0) ? messages[messages.length-1].content : "";
            const assMsg = cs.outputMsg;
            const totalUsage = userMsg.length + assMsg.length;
            usedCredits = Math.floor(totalUsage / 1000) + (totalUsage % 1000 == 0 ? 0 : 1);
            if(model && model.price && model.price>=0){
                usedCredits = usedCredits * model.price; // 模型的基础价格会加到对话价格中
            }else{
                usedCredits = 0;
            }
            
            // 记录每次生成结果
            if(user){
                const newRecord = await prisma.talk.update({
                    where: {
                        id: key as string,
                    },
                    data: {
                        replicateId: replicateId.toString(),
                        userId: talkUserId,
                        inputMsg: JSON.stringify({role:"user", content:userContent, name:talkUserId }),  // 这里只存储用户输入的消息，并且把信息储存在登录用户名下
                        outputMsg: JSON.stringify({role:"assistant", content:assMsg}),
                        aiservice: "OPENAI",
                        predicturl: cs.predicturl,
                        func: "chat",
                        usedCredits: usedCredits,
                        usedTokens: usedTokens,
                        access: "PRIVATE",
                        status: "SUCCESS",
                        model: model ? model.code : cs.baseModel, // 这里的model是整个对话的语言模型
                        },
                });  
                retObj = {
                    talkId: newRecord.id, 
                    role: "assistant", 
                    content: assMsg, 
                };  

                log("扣除用户" + user.name + "[" +  usedCredits.toString() + "]个提子");                  
                if(usedCredits > 0){
                    // 暂时每次扣除用户提子
                    await useCredits(user, usedCredits, enums.creditOperation.CHAT_GPT, newRecord.id);                
                    
                    // 更新模型的个中收入和分账记录
                    if(model){           
                        const userIncome = model.userId==user.id ? 0 : Math.floor(usedCredits/2);
                        await giveUserModelIncome(model.userId, model.id, usedCredits, userIncome);
                    }
                }
                
                // 把谈话内容都记录到小模型
                if(model && assMsg && assMsg.trim().length>0){
                    try{
                        const dtUser = new Date(Date.now()).toLocaleString() + 
                            " 用户说:\n" + userContent;
                        const dtAI = new Date(Date.now()).toLocaleString() + 
                            " AI返回:\n" + assMsg;     
                        
                        if(model.theme=="WALL"){
                            // 如果是墙，就把所有人说的话记录到公共区域
                            remember([dtUser + "\n\n" +  dtAI], model.id, talkUser.id, "WALL");
                        }else{
                            remember([dtUser + "\n\n" + dtAI], model.id, talkUser.id, "PRIVATE");
                        }
                    }catch(e){
                        error("记录聊天内容时发生意外错误！");
                        error(e);
                    }
                }
            }
                        
        }else if(CMD == "mediaMatch" && model){
            
            log("chatbot 开始寻找相关的媒体文件");
            const word = userMsg.substring(12);
            const vv = await embeddingSearch(word!, model.url!+".media", model.id, undefined, 5, 1000, 0.3, "MODEL", "IMAGE"); // 模型中的相关内容
            let rets = [];
            maxOutput = maxOutput ? (maxOutput as number) : 4;
          
            for(const v of vv){
                log(v);
                if(v.type=="IMAGE"){
                    if(rets.length < maxOutput){
                        rets.push({roomId:v.id, roomUrl:v.content, roomSource:"MATCH"});
                    }else{
                        break;
                    }
                }
            }
            
            const newRecord = await prisma.talk.create({
              data: {
                  replicateId: "",
                  userId: user.id,
                  inputMsg: JSON.stringify({
                          messages: messages  // 这里只存储用户输入的消息
                      }),                  
                  outputMsg: JSON.stringify({
                          role: "image",
                          content: JSON.stringify(rets), 
                      }),
                  aiservice: "aiputi",
                  predicturl: "",
                  func: "media",
                  usedCredits: 0,
                  usedTokens: 0,
                  access: "PRIVATE",
                  status: "SUCCESS",
                  model: model!.code, // 这里的model是整个对话的语言模型
              },
            });   

            retObj = {
                talkId: newRecord.id, 
                role: "image", 
                content: JSON.stringify(rets),
            };
          
            log("#MEDIA#CHAT# return：" + JSON.stringify(retObj));          
            return res.status(200).json( retObj ); // 附加媒体信息不再计费
            
        }else if(CMD == "draw"){
            log("chatbot 开始画一张图片");
            ////////////////////////////////////////
            // 处理生成图片
            let {drawModel, drawMethod, drawRatio} = req.body;
            let predicturl = process.env.WEBSITE_URL + "/api/workflowAgent2";                

            drawMethod = drawMethod ? drawMethod : "LARGE_MODEL";
            drawRatio = drawRatio ? drawRatio : "1:1";
            const func = drawModel ? drawModel : "flux-schnell";
            log("drawMethod:" + drawMethod);
            log("drawRatio:" + drawRatio);
            log("func:" + func);

            var response:any;
            var result:any;
          
            // 对于用户的测试要求，回一个缓存中的图片
            if(userMsg.length<5 && drawMethod=="LORA"){
                log("试图找一张现有照片返回");
                const lora = await prisma.model.findUnique({
                    where: { id: drawModel }
                });   

                if(lora){
                    const rooms = await prisma.room.findMany({
                        where:{
                            userId: {
                                not: user.id
                            },
                            func:"lora",
                            status: "SUCCESS",
                            model: lora.code,
                        },
                    });
                    log("发现了" + rooms.length + "张照片！");
    
                    for(const oldRoom of rooms){
                        const used = await prisma.room.findMany({
                            where:{
                                replicateId:oldRoom.id,
                                userId:user.id
                            }
                        });
                        log("已经被使用了" + used.length + "次");
                        if(used.length == 0){
                            log("当前用户没有收到过这张照片的拷贝");
                            const newRoom = await prisma.room.create({
                                data:{
                                    replicateId: oldRoom.id,
                                    userId: user.id,
                                    inputImage: "",
                                    outputImage: oldRoom.outputImage,
                                    prompt: userMsg,
                                    func: "lora",
                                    model: oldRoom.model,
                                    usedCredits: 0, // 这种情况不扣点, oldRoom.usedCredits,
                                    status:"SUCCESS",
                                    callbacked: "N",
                                    price: 0,
                                    access: "PRIVATE",
                                    aiservice: "COPY",
                                    predicturl: oldRoom.predicturl,
                                    bodystr: oldRoom.bodystr,
                                    seed: oldRoom.seed,
                                    resultType: "IMAGE"
                                }
                            });
                            if(newRoom){
                                log("成功拷贝了一张照片:" + newRoom.id);
                                response = {
                                    replicateId: newRoom.replicateId,
                                    genRoomId: newRoom.id, 
                                    generated: newRoom.outputImage, 
                                    original: oldRoom.outputImage,
                                    id: newRoom.id,
                                    seed: newRoom.seed
                                };
                                result = {status:200};
                                break;
                            }
                        }
                    }
                }
            }

            if(!response){
                let body:any = {
                    email: user.email, 
                    timeStamp: Date.now(),
                };
                switch(drawMethod){
                    case "LORA":
                        const lora = await prisma.model.findUnique({
                            where: { id: drawModel }
                        });
                        if(lora){
                            body.cmd = "lora";
                            body.params = {
                                inference: "lucataco / realvisxl2-lora-inference",
                                loraCover: lora.coverImg,
                                theme:lora.theme, room:lora.func, realText:userMsg, inputText: userMsg, func: "lora", price:lora.price,
                                modelurl: lora.code, modelTheme:lora.theme, access: lora.access, email:user.email, drawRatio, mandatorySafeCheck:true 
                            };
                        }
                        break;
                        
                    case "PROMPT":
                        const prompt = await prisma.prompt.findUnique({
                            where: {id: drawModel }
                        });
                        if(prompt){
                            let realText = (prompt && prompt.formular) ? prompt.formular : "";
                            let inputText = " ";
                            const params = (prompt && prompt.formular) ? parseParams(prompt.formular) : [];                    
                            if(params.length >0 && userMsg){
                                realText = replaceParam(realText, params[0][0], userMsg);
                                inputText = userMsg;
                            }
                            body.cmd = "createPrompt";
                            body.params = { 
                                func: prompt.func,
                                inputText:inputText, 
                                realText:realText,  
                                modelurl: prompt.code, 
                                email:user.email, drawRatio, mandatorySafeCheck:true 
                            };
                        }
                        break;
                        
                    case "LARGE_MODEL":
                        predicturl = process.env.WEBSITE_URL + "/api/workflowAgent2";                                        
                        body.cmd = "createPrompt";
                        body.params = { 
                            func:func, 
                            realText:userMsg, 
                            inputText:userMsg, 
                            email:user.email, 
                            drawRatio, 
                            mandatorySafeCheck:true 
                        };
                }
                
                result = await fetch(predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),               
                });      
                
                // 无论图片是否当场返回
                if(result.status == 400 || result.status == 500 || result.status == 405){
                    return res.status(result.status).json( response );
                }else{
                    response = await result.json();                             
                }
            }
            
            // 记录每次生成结果
            let room = [];
            
            let outputMsg = "";
            if(result.status == 200 || result.status == 403){
                room.push({roomId:response.genRoomId, roomUrl:response.generated, roomSource:"AI"});
                outputMsg = JSON.stringify({
                            role: "image",
                            content: JSON.stringify(room),
                        });
                retObj = {
                    talkId: "", 
                    role: "image", 
                    content: JSON.stringify(room),
                };                    
            }else{
                outputMsg = JSON.stringify(response);
                retObj = {
                    talkId: "", 
                    role: "image", 
                    content: JSON.stringify(response),
                };                    
            }
                
            const newRecord = await prisma.talk.create({
                data: {
                    replicateId: response.replicateId ? response.replicateId : "",
                    userId: user.id,
                    inputMsg: JSON.stringify({
                            messages: messages  // 这里只存储用户输入的消息
                        }),                  
                    outputMsg: outputMsg,
                    aiservice: func,
                    predicturl: predicturl,
                    func: "text2img",
                    usedCredits: usedCredits,
                    usedTokens: 0,
                    access: "PRIVATE",
                    status: "SUCCESS",
                    model: model ? model.code : "gpt-3.5-turbo", // 这里的model是整个对话的语言模型
                    },
            });    
            retObj.talkId = newRecord.id;
            res.status(result.status).json( retObj );
  
        }

        if(retObj){
            log("-------AI返回内容：-------\n" + JSON.stringify(retObj));
        }else{
            throw new Error("生成对话记录失败");
        }
    } catch (err) {
        error("chat.ts exception");
        error(err);
        res.status(500).json( {talkId:"", role:"system", content:"调用ChatBot服务器失败！"} );
    }
}



// 绑定系统消息
function bindSystemMsg(messages:any, model:Model|null){
    if(model && messages && model.proMsg){
        let msg = model.proMsg;        
        msg = msg.replace("$$$datetime$$$", showChineseDateTime(new Date()));            
        const sysMsg = {
            role: "system",
            content: msg,
        }
        messages.unshift(sysMsg);
    }
    
    return messages;
}


// 绑定历史消息
async function bindHistoryMsg(messages:any, model:Model|null, user:User|null, round:number=1){
    if(messages && model && user && round>0){
        // 获得模型和用户的最后round组对话
        let talks = await prisma.talk.findMany({
            where: {
                userId: user.id,
                model: model.code,
                func: "chat",
                status: "SUCCESS"
            },
            orderBy: {
              createdAt: 'desc'
            },    
            take: round
        });        

        if(talks){
            talks = talks.reverse(); // 反转顺序，先压入更早的对话
            const lastMsg = messages.pop();
            for(const talk of talks){
                if(talk.outputMsg && talk.inputMsg){
                    let output = null;
                    let input = null;
                    try{
                        output = JSON.parse(talk.outputMsg);
                        input = JSON.parse(talk.inputMsg);
                        if(input.messages){
                          input = input.messages.pop();
                        }
                    }catch(e){
                        error("获取历史聊天记录失败:\n" + e);                    
                    }
                    if(input && output && input.content && output.content){
                        messages.push(input);
                        messages.push(output);
                    }
                }
            }
            if(lastMsg){                 
                messages.push(lastMsg);
            }
        }
    }
    return messages;
}






/*
        if(userMsgType == "image"){
            const newRecord = await prisma.talk.create({
                data: {
                    replicateId: "",
                    userId: user.id,
                    inputMsg: JSON.stringify({
                            messages: messages  // 这里只存储用户输入的消息
                        }),                  
                    outputMsg: "",
                    aiservice: "",
                    predicturl: "",
                    func: "img2img",
                    usedCredits: usedCredits,
                    usedTokens: 0,
                    access: "PRIVATE",
                    status: "CREATE",
                    model: ""
                    },
            });    

            retObj = {
                    talkId: newRecord.id, 
                    role: "assistant", 
                    content: "您能告诉我您画的内容吗",
            };

            res.status(200).json( retObj );
        }
*/
