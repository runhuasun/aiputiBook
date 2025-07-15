import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as enums from "../../utils/enums";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    try{   
        const { cmd, target, targetId, pos, content} = req.body;
        
        switch(cmd){
            case "LOG":
            case "WARN":
            case "ERROR":
                record(cmd, target, targetId, pos, content);
                break;
                res.status(enums.resStatus.OK).json("日志在数据库记录成功");                
        }
       
      res.status(enums.resStatus.unknownCMD).json("dbLogger: 未知命令");
  }catch(error){
       res.status(enums.resStatus.unExpErr).json("dbLogger: 记录日志时发生意外失败！");
  }
}


const debugLevelDB = process.env.DEBUG_LEVEL_DB || 'NONE'; // 默认日志级别

type LogItem = {
  level: string;
  target?: string;
  targetId?: string;
  pos?: string;
  content: any[];
};


// 顺序队列实现
class SequentialQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  async add(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue[0]; // 先查看但不移除
      try {
        await task();
        this.queue.shift(); // 成功后才移除
      } catch (err) {
        console.error("日志任务执行失败，将重试", err);
        await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟后重试
        continue;
      }
    }
    
    this.isProcessing = false;
  }
}

const logQueue = new SequentialQueue();

// 原始record函数改为加入队列
async function record(level: string, target?: string, targetId?: string, pos?: string, ...content: any[]) {
  await logQueue.add(async () => {
    await prisma.dbLog.create({
      data: {
        level,
        target,
        targetId,
        pos,
        content: JSON.stringify(content),
      },
    });
  });
}

// 完全保持原始API不变
export async function log(target?: string, targetId?: string, pos?: string, ...content: any[]) {
  if (debugLevelDB == "LOG") {
    return record("LOG", target, targetId, pos, ...content);
  }
}

export async function warn(target?: string, targetId?: string, pos?: string, ...content: any[]) {
  if (debugLevelDB == "LOG" || debugLevelDB == "WARN") {
    return record("WARN", target, targetId, pos, ...content);
  }
}

export async function error(target?: string, targetId?: string, pos?: string, ...content: any[]) {
  if (debugLevelDB == "LOG" || debugLevelDB == "WARN" || debugLevelDB == "ERROR") {
    return record("ERROR", target, targetId, pos, ...content);
  }
}

// 可选：等待所有日志写入完成的方法
export async function flushLogs() {
  while (logQueue['queue'].length > 0) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
