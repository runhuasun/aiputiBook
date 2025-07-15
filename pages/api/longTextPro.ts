import type { NextApiRequest, NextApiResponse } from "next";
import {readFile} from "../../utils/fileReader";
import {parseToSentences} from "../../utils/parser";
import { User, Task } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import { themeType, themes, themeNames, getPrompt } from "../../utils/dealLongTextWays";
import {localModelProcess} from './trainChatModel';
import {log, warn , error} from "../../utils/debug";
import { EventEmitter } from 'events';
import {useCredits, returnCredits} from "./creditManager";
import * as enums from "../../utils/enums";


export type GenerateResponseData = {
  result?: string;
  usedCredits: number;
  estimateTime: number;
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    cmd: string; 
    title: string;
    theme: string;
    length: number; // 返回的最大文本长度
    fileUrl: string; // 待阅读的文件
  };
}

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<GenerateResponseData | string>
) {
    const{cmd, title, theme, length, fileUrl} = req.body;
    log("------start process long text-------");
    log(JSON.stringify(req.body));
  
    try{
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
        
        if(cmd == "readAndPro"){

            // 判断是否有任务在进行
            const tasks = await prisma.task.findMany({
              where: {
                userId: user.id,
                status: "START",
              },
            });          
            if(tasks && tasks.length > 0){
              return res.status(400).json("已经有长文本处理任务正在执行，不能开始新的任务");
            }
          
            ///////////////////////////////////////////////////////////
            // 读取dataset中的文本
            console.log("开始阅读文本");
            console.log("-----读取dataset中的文本-----");
            let dtTexts:string[] = [];
            try{
              if(fileUrl){
                dtTexts = await readFile(fileUrl);
              }
            }catch(e){
              console.error(e);
              return res.status(400).json("文件格式不兼容，请换一个文件试试！");
            }
            
            let totalChars = 0;
            for( const dtText of dtTexts){
              totalChars += dtText.length;
            }
            const usedCredits = calcUsedCredits(totalChars, length);
            const estimateTime = dtTexts.length + (totalChars+length) / 100;
          
            if(user.credits < usedCredits){
              res.status(400).json( "本次任务需要"+ usedCredits + "个提子，你的提子数量不够，请先充值！");
              return;
            }
            let msg = "本次阅读的文件共有" + totalChars + "个字，正在以" + title + "为标题，";
            msg += themeNames.get(theme) + "，最多" + length + "字，";
            msg += "需要消耗" + usedCredits + "个提子，并预计需要" + estimateTime + "秒完成。";

            // 如果没有任务，就创建一个任务
            const task = await prisma.task.create({
              data: {
                userId: user.id,
                func: theme,
                params: JSON.stringify({title: title, length: length}),
                usedCredits: usedCredits,
                input: JSON.stringify({fileUrl:fileUrl, length:length}),
                message: msg,
                status: "START",
              },
            });   
            
            await useCredits(user, usedCredits, enums.creditOperation.LONG_TEXT, task.id);                

            // 开始异步处理
            readAndPro(task, dtTexts, user, totalChars, length, title, theme);
            
            // 返回模型训练结果
            console.log("开始阅读并处理文本....");
            return res.status(200).json( {
                usedCredits: usedCredits,
                estimateTime: estimateTime,
            });
        }
    } catch (error) {
        console.error("long text process exception");
        console.error(error);
        res.status(500).json( "训练模型时发生未知错误！" );
    }
}

export function calcUsedCredits(len:number, secLen:number){

    // 计费 USD $0.004 / 1K tokens
    // 约等于 RMB 0.03 / 1千字
    // 3333个字需要1个提子的成本
    // 暂时按 2个提子/千字符utf-16，不足1千字按1千字收取
  
    // 举例，如果secLen=1000
    // 小于1万字，需要处理10000字
    // 10万字，需要处理11万字
    // 100万字，需要处理111万字
    return (Math.floor((len+secLen) / 1000) + 1)*2;

}

// 把一个长度从0 - 最大一千万字的文本，写出100-5000字的摘要
// 文本100字，输出1000字， 返回错误
// 文本100字，输出100字，一次返回
// 文本10000字，返回5000字，一次返回
// 文本一百万字, 返回1000字
// 极限是：文本一千万字，如何写成100字的总结？
async function readAndPro(task:Task, dtTexts:string[], user:User, total:number, absLen:number, title:string, theme:string): Promise<string>{
    console.log("阅读主题是：" + theme);
  
    const secLen = 7500; // 这个限制是来自openai，这相当于10000个token，加上输出5000token，基本用完16k
  
    let sections:string[] = [];
    const startTime = new Date().getTime(); // 计算时间的时间戳

    try{

      for(const dtText of dtTexts){
          // 把文本分成大约secLen个字符的段落
          const sens = parseToSentences(dtText, undefined, secLen);
          console.log("parse to sentences:" + sens.length);
          sections = sections.concat(sens);
          console.log("sections.length:" + sections.length);
      }
      apppendMessage(task, "\n已经完成阅读分析操作\n开始进行逐段抽取关键内容");

      // 如果只有一条记录就不需要层层压缩
      while(sections.length > 1){
          let threads = 0;
          const eventEmitter = new EventEmitter();

          let tempArrayMap = new Map();
          let tempArray:string[] = [];
          
          // 启动所有段落的读取线程
          for(let i=0; i<sections.length; i++){
              const sec = sections[i];
              // 对每个段落的内容获取长度为length的摘要
              ++threads;
              runTextProStep(user, task, "READ", sec, 3500, title, theme).then( (abs) => {
                  tempArrayMap.set(i, abs);
                  --threads;
                  eventEmitter.emit('threadFinished');                            
              });
          }

          if(threads > 0){
              // 等待所有线程结束
              await new Promise<void>(resolve => {
                  eventEmitter.on('threadFinished', () => {
                      if(threads == 0){
                          log("-----------------所有线程都已经结束-----------------------");
                          resolve();                    
                      }else{
                          log('剩余线程数：' + threads);
                      }
                  });
              });          
          }

          // 把摘要放到一个待处理大串里
          // 如果大串达到secLen字，就压入一个临时集合
          let tempStr = "";
          for(let i=0; i<sections.length;){
              const abs = tempArrayMap.get(i);
              ++i;
              if((tempStr + abs).length > secLen){
                  tempArray.push(tempStr);
                  tempStr = abs;
              }else{
                  tempStr += "\n" + abs;
                  if(i == sections.length){
                      tempArray.push(tempStr);
                      break;
                  }
              }
          }

          // 如果tempArray的长度超过1，那么就把临时串写成sections
          sections = tempArray;
      }
      
      if(sections.length <= 1){
          const result = await runTextProStep(user, task, "PROCESS", (sections.length>0 ? sections[0] : ""), absLen, title, theme);
          await prisma.task.update({
            where: {id: task.id },          
            data: { updateTime:new Date().toISOString(), status: "FINISH", output:result }, 
          });   

          const endTime = new Date().getTime();
          const tj = "本次阅读处理共耗时 " + (endTime - startTime)/1000 + "秒";
          console.log(tj);        
          apppendMessage(task, tj);  
          return result;
      }else{
          throw new Error("阅读数据没有完成所有内容的总结");
      }
    }catch(e){
      console.error("生成摘要时发生意外失败：");
      console.error(e);
      await prisma.task.update({
        where: {id: task.id },          
        data: { updateTime:new Date().toISOString(), status: "ERROR" }, 
      });   
      return "生成摘要时发生意外失败！";
    }
}


// 执行任务的一个步骤
async function runTextProStep(user:User, task:Task, method:string, text:string, outputLength:number, title:string, theme:string="PRO"): Promise<string>{
    
    let prompt = getPrompt(theme, method, {title:title, len:outputLength, segments:Math.floor(outputLength/500)});
    let proMsg = prompt ? prompt.content : "";
  
    console.log("///////////////AI执行操作：" + proMsg);
    console.log("////////////////用户输入的内容：\n" + text.length);
    apppendMessage(task, "\n正在分析段落：" + text.trim().slice(0,15) + "......");  
    // 先把参数预先传到服务器
    let predicturl = "http://gpt.aiputi.cn:7777/api/openai";   
    if(process.env.OPENAI_API_PROXY){
        predicturl = process.env.OPENAI_API_PROXY;  // 参数配置的代理服务器
    }    
    let inputMsg = [
        {role:"system", content:proMsg, name:user.id},          
        {role:"user", content:text, name:user.id}
    ];

    // 处理本地小模型
    if(user && prompt && prompt.model){
         const model = await prisma.model.findUnique({
          where: {
            code: (prompt.model === "def_model_") ? ("def_model_" + user.id) : prompt.model,
          },
        });    
        inputMsg = model ? await localModelProcess(inputMsg, model, user) : inputMsg;
    }
    console.log("IMputMsg:" + JSON.stringify(inputMsg).length);
  
    const ret = await fetch(predicturl  + "?CMD=chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        params: {
            temperature:1, 
            max_tokens: (outputLength && outputLength>50) ? outputLength : 50
        },
        messages: inputMsg,
      }),
    });

    const result = (await ret.json()).choices[0].message.content;
    console.log("////////////////AI执行操作产生内容：\n" + result.length);
    return result;
}

async function apppendMessage(task:Task, msg:string){
    if(task.message){
        task.message += msg;
    }else{
        task.message = msg;
    }
    
    await prisma.task.update({
      where: {id: task.id },          
      data: { updateTime:new Date().toISOString(), message: task.message }, 
    });   
}
