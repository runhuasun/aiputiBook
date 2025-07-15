import {log, warn, error} from "../../utils/debug";
import { EventEmitter } from 'events';
import {BaseTTS} from './BaseTTS';
import RPCClient from '@alicloud/pop-core';
//import { SpeechSynthesizer } from "alibabacloud-nls";
import * as global from "../../utils/globalUtils";
import WebSocket from "ws";
import fs from "fs";
import { v4 as uuid } from "uuid";
import axios from 'axios';



export class AliyunTTS extends BaseTTS {
    public maxLength = 150;
    private dash_api_key = process.env.ALI_QIANWEN_API_KEY;
    
    constructor(){
        super();
    }

    /////////////////////////////////////////////////
    // 语音合成
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="ALIYUN***aixia"){    
        if(speaker.indexOf("cosyvoice-v1-")>=0){
            speaker = speaker.replace("cosyvoice-v1-", "");
            return await this.textToVoiceCosyVoice(content, speaker);
        }else{
            return await this.textToVoiceNLS(content, speaker);
        }               
    }

    public async textToVoiceCosyVoice(content:string, speaker:string){
        // 检查缓存
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if (cache) {
            return cache;
        }
    
        let result = "";
        const eventEmitter = new EventEmitter();
        const taskId = uuid();
        const outputFilePath = `temp_audio_${taskId}.mp3`;
        fs.writeFileSync(outputFilePath, "");
    
        const ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference/', {
            headers: {
                Authorization: `bearer ${this.dash_api_key}`,
                "X-DashScope-DataInspection": "enable",
            },
        });
    
        const fileStream = fs.createWriteStream(outputFilePath, { flags: "a" });
    
        ws.on("open", () => {
          console.log("已连接到 WebSocket 服务器");
    
          // 发送 run-task 指令
          const runTaskMessage = JSON.stringify({
            header: {
              action: "run-task",
              task_id: taskId,
              streaming: "duplex",
            },
            payload: {
              task_group: "audio",
              task: "tts",
              function: "SpeechSynthesizer",
              model: "cosyvoice-v1",
              parameters: {
                text_type: "PlainText",
                voice: speaker.split("***").pop() || "longxiaochun", // 默认音色
                format: "mp3",
                sample_rate: 22050,
                volume: 50,
                rate: 1,
                pitch: 1,
              },
              input: {},
            },
          });
    
          ws.send(runTaskMessage);
          console.log("已发送 run-task 消息");
        });
    
        ws.on("message", (data, isBinary) => {
          if (isBinary) {
            fileStream.write(data);
          } else {
            const message = JSON.parse(data.toString()); // 🔹 转换 Buffer 为字符串
            switch (message.header.event) {
              case "task-started":
                console.log("任务已开始");
                this.sendContinueTask(ws, taskId, content);
                break;
              case "task-finished":
                console.log("任务已完成");
                ws.close();
                fileStream.end(async () => {
                  console.log("文件流已关闭");
                  result = fs.readFileSync(outputFilePath).toString("base64");
                  await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, result);
                  eventEmitter.emit("finished");
                });
                break;
              case "task-failed":
                console.error("任务失败：", message.header.error_message);
                ws.close();
                fileStream.end();
                eventEmitter.emit("finished");
                break;
              default:
                break;
            }
          }
        });

    
        ws.on("close", () => {
            console.log("已断开 WebSocket 连接");
        });
    
        return new Promise<string>((resolve) => {
            eventEmitter.once("finished", () => {
                console.log("阿里云语音合成完毕");
                resolve(result);
            });
        });
    }
    
    private sendContinueTask(ws: WebSocket, taskId: string, text: string) {
        const continueTaskMessage = JSON.stringify({
            header: {
                action: "continue-task",
                task_id: taskId,
                streaming: "duplex",
            },
            payload: {
                input: {
                    text: text,
                },
            },
        });
        ws.send(continueTaskMessage);
        console.log(`已发送 continue-task，文本：${text}`);
    
        setTimeout(() => {
            const finishTaskMessage = JSON.stringify({
                header: {
                    action: "finish-task",
                    task_id: taskId,
                    streaming: "duplex",
                },
                payload: {
                    input: {},
                },
            });
            ws.send(finishTaskMessage);
            console.log("已发送 finish-task");
        }, 1000);
    }

    
    public async textToVoiceNLS(content:string, speaker:string){
    
        // 如果缓存里有就用缓存内容
        const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
        if(cache){
            return cache;
        }
        let result = "";
        const eventEmitter = new EventEmitter(); 
        const Nls = require('alibabacloud-nls')

        try{
            const TTSClient = new Nls.SpeechSynthesizer({
                url: "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1",
                appkey: process.env.ALI_APP_KEY!,
                token: await this.getToken()!
            });     
            
            let param = TTSClient.defaultStartParams();
            param.text = content;
            param.voice = speaker.split("***").pop() || "aixia";
            param.format = "mp3";
            
            TTSClient.on("meta", (msg:any)=>{
                log("阿里云语音合成 recv metainfo:" + msg);
            });
            TTSClient.on("data", (msg:any)=>{
                //log(`阿里云语音合成 recv size: ${msg.length}`);
                result = Buffer.concat([Buffer.from(result, 'base64'), Buffer.from(msg, 'base64')]).toString("base64");
            });
            TTSClient.on("completed", (msg:any)=>{
                console.log("阿里云语音合成 Client recv completed:" + msg);
            });
            TTSClient.on("closed", () => {
                console.log("阿里云语音合成 Client recv closed");
                eventEmitter.emit('finished');                  
            });
            TTSClient.on("failed", (msg:any)=>{
                console.log("阿里云语音合成 Client recv failed:", msg);
                eventEmitter.emit('finished');                  
            });      
            await TTSClient.start(param, true, 6000);

            // 等待传递完所有数据
            await new Promise<void>(resolve => {
              eventEmitter.once('finished', () => {
                  log('阿里云语音生成完毕');
                  resolve();
              });
            });             
            if(result){
                await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, result);
                return result;
            }
        }catch(e){
            error("阿里云语音合成发生错误");
            error(e);
        }        
    }


    // 复刻声音
    public async cloneSpeaker(voiceUrl:string){
        try {
            // 定义请求数据
            const requestData = {
                model: 'voice-enrollment',
                input: {
                    action: 'create_voice',
                    target_model: 'cosyvoice-v1',
                    prefix: "aiputi",
                    url: voiceUrl,
                },
            };
            
            // 发起HTTP请求
            const response = await axios.post(
                'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization',
                requestData,
                {
                    headers: {
                        Authorization: `Bearer ${this.dash_api_key}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            // 返回复刻完成后的voice_id
            const voiceId = response.data.output.voice_id;
            return voiceId;
        } catch (err) {
            // 错误处理
            if (axios.isAxiosError(err)) {
                error('声音复刻请求失败:', err.response?.data || err.message);
            } else {
                error('未知错误:', err);
            }
            throw new Error('声音复刻失败');
        }    
    }

    // 删除音色
    public async deleteSpeaker(voiceId: string): Promise<void> {
        try {
            // 定义请求数据
            const requestData = {
                model: 'voice-enrollment',
                input: {
                    action: 'delete_voice',
                    voice_id: voiceId,
                },
            };
            
            // 发起HTTP请求
            const response = await axios.post(
                'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization',
                requestData,
                {
                    headers: {
                        Authorization: `Bearer ${this.dash_api_key}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            // 返回删除结果
            log('音色删除成功:', response.data);
        } catch (err) {
            // 错误处理
            if (axios.isAxiosError(err)) {
                error('音色删除请求失败:', err.response?.data || err.message);
            } else {
                error('未知错误:', err);
            }
            throw new Error('音色删除失败');
        }
    }


    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public async voiceToText(voiceUrl:string, format:string){
        throw new Error("voiceToText unimplemented");
    }
/*    
    public async startTask(voiceUrl:string, format:string){
        let retry = 0;
        while(retry <= 3){        
            try{
                const result = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
                        "X-DashScope-Async": enable
                    },
                    body: JSON.stringify({
                        model: "sensevoice-v1",
                        input: {
                            "file_urls":[
                                voiceUrl  // aac、amr、avi、flac、flv、m4a、mkv、mov、mp3、mp4、mpeg、ogg、opus、wav、webm、wma、wmv
                            ]                         
                        },   
                    })
                });
                if(result){
                    const resObj = await result.json();
                    log("resOBJ:" + JSON.stringify(resObj));                    
                    return {
                        id: resObj?.output?.task_id, 
                        output: resObj?.output,
                        staus: resObj?.output?.task_status
                    };                   
                }                
            } catch (err) {
                error("调用AI服务器发生异常");
                // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
                // 错误 message
                error(err);
            }  
            
            retry++;
            if(retry <= 3){
                log("调用AI服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用AI服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }

        return {
            status: "ERROR",
            message: "访问AI服务发生未知错误！"
        }                
    }          

    public async getTaskResult(id:string){
        // GET request to get the status of the image restoration process & return the result when its ready
        let tryTimes = 0;
        let generatedImage = null;
        
        while (!generatedImage && tryTimes++ < 1000) {
            // Loop in 1s intervals until the alt text is ready
            log("polling for result...");
            let finalResponse = null;
            let jsonFinalResponse = null;
        
            try{
                finalResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + process.env.ALI_QIANWEN_API_KEY,
                        "X-DashScope-Async": "enable"
                    },
                    body: JSON.stringify({
                        task_id: id
                    })
                });
                if(finalResponse){
                    const resObj = await finalResponse.json();
                    // 获取整体结果
                    log("RESOBJ:" + JSON.stringify(resObj));

                    switch(resObj.output.task_status){
                        case "SUCCEEDED":
                            // 获取单个字段
                            if(this.resultType == "MEDIA"){
                                return resObj?.output?.results?.[0]?.url || resObj?.output?.results?.video_url || resObj?.output?.video_url || resObj?.output?.output_video_url;
                            }else{
                                return resObj.output;
                            }
                            break;
                        case "FAILED":
                            return null;
                        case "UNKNOWN": // 作业不存在或状态未知
                            return null;
                            
                        case "PENDING":
                        case "PENDING": // 排队中
                        case "PRE-PROCESSING": // 前置处理中
                        case "RUNNING": // 处理中
                        case "POST-PROCESSING": // 后置处理中
                        default:
                            log(`${this.func} is ${resObj.output.task_status}...`);
                    }
                }
            }catch(err){
                error("调用AI服务器，获取生成结果时发生异常");
                error(err);     
            }
            log("第" + tryTimes + "次尝试重新获取返回图片");
            // 每次查询结果等待5秒
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
    */
    
    private async getToken(){
        const cache = await global.globalGet("ALIYUN", "TOKEN");
        if(cache){
            const token = JSON.parse(cache);
            const now = new Date();
            if(token){
                const expTime = new Date(token.ExpireTime);
                if(now < expTime){
                    return token.Id;
                }
            }
        }
                
        const client = new RPCClient({
            accessKeyId: process.env.ALI_ACCESS_KEY_ID!,
            accessKeySecret: process.env.ALI_ACCESS_KEY_SECRET!,
            endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
            apiVersion: '2019-02-28'
        });

        const result:any = await client.request('CreateToken', {});
        if(result){
            log(result);
            await global.globalSet("ALIYUN", "TOKEN", JSON.stringify(result.Token));            
            return result.Token.Id;
        }
    }
}
