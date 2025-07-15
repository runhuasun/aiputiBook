import {log, warn, error} from "../../utils/debug";
import { EventEmitter } from 'events';
import {BaseTTS} from './BaseTTS';
import fs from 'fs';
import * as global from "../../utils/globalUtils";
import WebSocket from 'ws';
import crypto from 'crypto';


export class XunFeiTTS extends BaseTTS {
  
    constructor(){
        super();
    }
  

    /////////////////////////////////////////////////
    // 讯飞语音合成
    //////////////////////////////////////////////////
    public async textToVoice(content:string, speaker:string="XUNFEI***xiaoyan"){
        let retry = 5;
        while(retry-- > 0){
            try{
                // 如果缓存里有就用缓存内容
                const cache = await global.globalGet("VOICE_CACHE", content + "@@@@" + speaker);
                if(cache){
                    return cache;
                }                      
                const xfSpeakerCode = speaker.split("***").pop() || "xiaoyan";
                const data = xfSpeakerCode.indexOf("vcn")>=0 ? 
                    await this.internalTextToVM(content, xfSpeakerCode) : 
                    await this.internalTextToVoice(content, xfSpeakerCode);
                if(data){
                    await global.globalSet("VOICE_CACHE", content + "@@@@" + speaker, data);
                }
                
                return data;

            }catch(e){
                error("调用讯飞生成语音发生未知错误！");
                error(e);
                await new Promise((resolve) => setTimeout(resolve, 2000));    
            }
            break;
        }
    }
    
    private async internalTextToVoice(content:string, speaker:string="xiaoyan"){
        if(!content){
            return null;
        }

         // 请求地址
        const hostUrl = "wss://tts-api.xfyun.cn/v2/tts";
        const host = "tts-api.xfyun.cn";
        const uri = "/v2/tts";
            
        // 获取当前时间 RFC1123格式
        let date = (new Date().toUTCString());
        
        // 设置当前临时状态为初始化
        const token = await getAccessToken(date, host, uri);
        let wssUrl = hostUrl + "?authorization=" + token + "&date=" + date + "&host=" + host;
        log(wssUrl);
        
        let ws = new WebSocket(wssUrl);
        let result = "";
        const eventEmitter = new EventEmitter(); 

        // 连接建立完毕，读取数据进行识别
        ws.on('open', () => {
            log("讯飞语音合成服务：websocket connect!");
            log("Speaker ：" + speaker);     
            log("content :" + content);
            let frame = {
                // 填充common
                "common": {
                    "app_id": process.env.XUNFEI_APP_ID,
                },
                // 填充business
                "business": {
                    "aue": "lame",
                    "sfl": 1,
                    "auf": "audio/L16;rate=16000",
                    "vcn": speaker,
                    "tte": "UTF8"
                },
                // 填充data
                "data": {
                    "text": Buffer.from(content).toString('base64'),
                    "status": 2
                }
            };
            ws.send(JSON.stringify(frame))          
        });
    
        // 得到结果后进行处理，仅供参考，具体业务具体对待
        ws.on('message', (data, err) => {
            if (err) {
                error('message error: ' + err);
                return;
            }
        
            let res = JSON.parse(data.toString());
        
            if (res.code != 0 || !res.data || !res.data.audio) {
                error(`${res.code}: ${res.message}`);
                ws.close();
                return;
            }
            // log("res.data: " + res.data);
            result = Buffer.concat([Buffer.from(result, 'base64'), Buffer.from(res.data.audio, 'base64')]).toString("base64");
            // Buffer.concat([result, audioBuf]);
            // log("result.length:" + result.length);
            
            if (res.code == 0 && res.data.status == 2) {
                ws.close();
            }
        });
    
        // 资源释放
        ws.on('close', () => {
            log('connect close!');
            eventEmitter.emit('finished');  

        });
        
        // 连接错误
        ws.on('error', (err) => {
            error("websocket connect err: " + err);
        });

        // 等待传递完所有数据
        await new Promise<void>(resolve => {
          eventEmitter.once('finished', () => {
              log('语音生成完毕');
              resolve();
          });
        }); 

        if(result){
            // log("result final length:" + result.length);
            return result; // Buffer.from(result, 'base64');
        }else{
            log("XUNFEI RETURN:" + null);
            return null;
        }

    }// end of textToVoice  


    // 合成虚拟人声音
    // '$.parameter.tts.vcn' must be one of [x4_lingxiaoxuan_oral x4_lingfeizhe_oral x4_lingfeiyi_oral x4_lingyuzhao_oral x4_lingxiaoyue_oral x4_lingxiaoqi_oral x4_lingyuyan_oral x4_oppo_oral]
    private async internalTextToVM(content:string, speaker:string="vcn.x4_lingyuzhao_oral"){
        if(!content){
            return null;
        }

         // 请求地址
        const hostUrl = "wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/medd90fec";
        const host = "cbm01.cn-huabei-1.xf-yun.com";
        const uri = "/v1/private/medd90fec";
            
        // 获取当前时间 RFC1123格式
        let date = (new Date().toUTCString());
        
        // 设置当前临时状态为初始化
        const token = await getAccessToken(date, host, uri);
        let wssUrl = hostUrl + "?authorization=" + token + "&date=" + date + "&host=" + host;
        log(wssUrl);
        
        let ws = new WebSocket(wssUrl);
        let result = "";
        const eventEmitter = new EventEmitter(); 

        // 连接建立完毕，读取数据进行识别
        ws.on('open', () => {
            log("讯飞虚拟人语音合成服务：websocket connect!");
            log("Speaker ：" + speaker);     
            log("content :" + content);
            let frame = {
                // 填充common
                "header": {
                    "app_id": process.env.XUNFEI_APP_ID,
                    "status": 2,                    
                },
                "parameter": {
                   "oral": {
                        "oral_level":"high" // 高:high, 中:mid, 低:low
                    },                    
                    "tts": {
                        "vcn": speaker.split(".").pop()!,
                        "speed": 75,
                        "pitch": 75,
                        "scn": 5, // 0:无, 1:散文阅读, 2:小说阅读, 3:新闻, 4:广告, 5:交互
                        "audio": {
                            "encoding": "lame"
                        }
                    }
                },
                "payload": {
                    "text": {
                        "status": 2,
                        "seq": 0,
                        "text": Buffer.from(content).toString('base64')
                    }
                }
            };
            ws.send(JSON.stringify(frame))          
        });
    
        // 得到结果后进行处理，仅供参考，具体业务具体对待
        let segs:any[] = [];
        ws.on('message', (data, err) => {
            if (err) {
                error('message error: ' + err);
                return;
            }

            // log("data chunk:" + data.toString());
            let res = JSON.parse(data.toString());
        
            if (res.header.code != 0) {
                error(`${res.header.code}: ${res.header.message}`);
                ws.close();
                return;
            }

            if(res.payload && res.payload.audio && res.payload.audio.audio){
                segs.push(res);
            }
            
            if (res.code == 0 && res.data.status == 2) {
                log('res.code == 0 then closed');
                ws.close();
            }
        });
    
        // 资源释放
        ws.on('close', () => {
            log('connect close!');
            eventEmitter.emit('finished');  

        });
        
        // 连接错误
        ws.on('error', (err) => {
            error("websocket connect err: " + err);
        });

        // 等待传递完所有数据
        await new Promise<void>(resolve => {
          eventEmitter.once('finished', () => {
              log('语音生成完毕');
              resolve();
          });
        }); 

        // 把所有片段拼接
        if(segs.length>0){
            log('segments count:' + segs.length);
            segs.sort((a, b) => a.payload.audio.seq - b.payload.audio.seq);
            while(segs.length > 0){
                let seg = segs.shift();
                result = Buffer.concat([Buffer.from(result, 'base64'), Buffer.from(seg.payload.audio.audio, 'base64')]).toString("base64");
            }
        }
        
        if(result){
            // log("result final length:" + result.length);
            return result; // Buffer.from(result, 'base64');
        }else{
            log("XUNFEI RETURN:" + null);
            return null;
        }

    }// end of textToVoice      


    /////////////////////////////////////////////////
    // 讯飞语音识别
    //////////////////////////////////////////////////    
    public async voiceToText(voiceFile:string, encoding:string="lame", speex_size:number=70, language:string="zh_cn"){
        let result = "";
        
        // 系统配置 
        const hostUrl = "wss://iat-api.xfyun.cn/v2/iat";
        const host = "iat-api.xfyun.cn";
        const uri = "/v2/iat";
        const highWaterMark = 1280;
        
        // 帧定义
        const FRAME = {
            STATUS_FIRST_FRAME: 0,
            STATUS_CONTINUE_FRAME: 1,
            STATUS_LAST_FRAME: 2
        }
        
        // 获取当前时间 RFC1123格式
        let date = (new Date().toUTCString());
        // 设置当前临时状态为初始化
        let status = FRAME.STATUS_FIRST_FRAME;
        // 记录本次识别用sid
        let currentSid = "";
        // 识别结果
        let iatResult:any = [];
    
        const token = await getAccessToken(date, host, uri);
        let wssUrl = hostUrl + "?authorization=" + token + "&date=" + date + "&host=" + host;
        let ws = new WebSocket(wssUrl);
    
        const eventEmitter = new EventEmitter(); 
    
        // 连接建立完毕，读取数据进行识别
        ws.on('open', (event:any) => {
            console.log("websocket connect!");
            const readerStream = fs.createReadStream(voiceFile, {
                highWaterMark: highWaterMark
            });
            readerStream.on('data', function (chunk) {
                send(ws, chunk, FRAME, status, encoding, speex_size, language);
            });
            // 最终帧发送结束
            readerStream.on('end', function () {
                status = FRAME.STATUS_LAST_FRAME;
                send(ws, "", FRAME, status, encoding, speex_size, language);
            });
        })
        
        // 得到识别结果后进行处理，仅供参考，具体业务具体对待
        ws.on('message', (data, err) => {
            if (err) {
                console.log(`err:${err}`)
                    return
            }
            log("语音识别data:" + data.toString());
            const res = JSON.parse(data.toString())
                if (res.code != 0) {
                    console.log(`error code ${res.code}, reason ${res.message}`)
                        return
                }
            
            let str = "";
            if (res.data.status == 2) {
                // res.data.status ==2 说明数据全部返回完毕，可以关闭连接，释放资源
                str += "最终识别结果";
                currentSid = res.sid;
                ws.close();
            } else {
                str += "中间识别结果";
            }
            
            iatResult[res.data.result.sn] = res.data.result;
            if (res.data.result.pgs == 'rpl') {
                res.data.result.rg.forEach( (i:any) => {
                    iatResult[i] = null;
                });
                str += "【动态修正】";
            }
            
            str += "：";
            iatResult.forEach( (i:any) => {
                if (i != null) {
                    i.ws.forEach( (j:any) => {
                        j.cw.forEach( (k:any) => {
                            str += k.w;
                            result += k.w;
                        });
                    });
                }
            });            
            console.log(str);            
        });
        
        // 资源释放
        ws.on('close', () => {
            console.log(`本次识别sid：${currentSid}`);
            console.log('connect close!');
            eventEmitter.emit('finished');  
        })
        
        // 建连错误
        ws.on('error', (err) => {
            console.log("websocket connect err: " + err);
            eventEmitter.emit('finished');              
        });
    
        // 等待传递完所有数据
        await new Promise<void>(resolve => {
            eventEmitter.once('finished', () => {
                log('语音识别完毕');
                resolve();
            });
        });    
        return result;
    }
    
    

} // end of class




// 语音传输数据
function send(ws:WebSocket, data:Buffer|string, FRAME:any, status:any, encoding:string="lame", speex_size:number=70, language:string="zh_cn") {
    let frame:any = "";
    let frameDataSection = {
        "status": status,
        "format": "audio/L16;rate=16000",
        "audio": data.toString('base64'),
        "encoding": encoding
    };
    
    switch (status) {
        case FRAME.STATUS_FIRST_FRAME:
            frame = {
                // 填充common
                common: {
                    app_id: process.env.XUNFEI_APP_ID
                },
                //填充business
                business: {
                    language: language,
                    domain: "iat",
                    accent: "mandarin",
                    speex_size: speex_size
                  //   dwa: "wpgs" // 可选参数，动态修正
                        },
                //填充data
                data: frameDataSection
            };
            status = FRAME.STATUS_CONTINUE_FRAME;
            break;
        
        case FRAME.STATUS_CONTINUE_FRAME:
        case FRAME.STATUS_LAST_FRAME:
            //填充frame
            frame = {
                data: frameDataSection
            };
            break;
    }
    
    ws.send(JSON.stringify(frame))
}



function utf8 (str: string) {
    return Buffer.from(str, 'utf8') as any as string;
}

function base64 (str: string) {
    return Buffer.from(str).toString('base64');
}

function hmac (key: string, content: string)  {
    return crypto.createHmac('sha256', key)
        .update(content)
        .digest('base64');
}

/**
* 语言翻译API调用
* 使用 AK，SK 生成鉴权签名（Access Token）
* @return string 鉴权签名信息（Access Token）
export async function getAccessToken(cur_time: string, hostname: string=this.hostname_of_service, path: string=this.path_of_chat) {
*/
export async function getAccessToken(cur_time: string, hostname: string, path: string) {
    try {
        const date = cur_time;
        const APISecret = process.env.XUNFEI_API_SECRET;
        const APIKey = process.env.XUNFEI_API_KEY;            

        if (APISecret && APIKey) {
            const tmp = `host: ${hostname}\ndate: ${date}\nGET ${path} HTTP/1.1`;
            const sign = hmac(utf8(APISecret), utf8(tmp));
            // log(sign);
            const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${sign}"`;
            // log(authorizationOrigin);
            return base64(utf8(authorizationOrigin));
        } else {
            throw new Error("没有配置正确的 XUNFEI APIKEY");
        }
    } catch (e) {
        error("读取 XUNFEI apikey 时发生意外");
        throw new Error("读取 XUNFEI apikey 时发生意外");
    }
}
