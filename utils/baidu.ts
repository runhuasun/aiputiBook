const https = require('https');
const url = require('url');
import  * as fu from "./fileUtils";
import {config} from "./config";
import * as debug from "./debug";


const endpoint = "https://ocpc.baidu.com/ocpcapi/api/uploadConvertData";
const parsedEndpoint = url.parse(endpoint);

export async function callBackOCPC_PAY(source:string){
    return callBackOCPC(source, 26);
}

export async function callBackOCPC_REG(source:string){
    return callBackOCPC(source, 25);
}


export async function callBackOCPC(source:string, callBackType:number){
    if(process.env.BAIDU_OCPC !== "TRUE"){
        debug.error("没有配置百度OCPC");
        return;
    }
    debug.log(`callBackOCPC:${source}`);
    
    const postData = JSON.stringify({
        "token": "ymX6qpw2eZdvmfH4h4Ct7A8z5kdRlJ1P@lhc4j0OwWHlMCHn946de0y93QfmCUwh9",
        "conversionTypes": [
                {
                    "logidUrl": `${config.website}${source}`,
                    "newType": callBackType, // 26:代表付费  25：注册
                }
            ]
    });
    
    const options = {
        hostname: parsedEndpoint.hostname,
        port: parsedEndpoint.port,
        path: parsedEndpoint.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        }
    };
    
    const req = https.request(options, (res:any) => {
        //检验状态码，如果成功接收数据
        if (res.statusCode === 200) {
            res.setEncoding('utf8');
            res.on('data', (chunk:any) => {
                console.log(`"res data: ${chunk}`);
            });
        }
    });
    
    req.on('error', (e:any) => {
        console.error(`problem with request: ${e.message}`);
    });
    
    req.write(postData);
    req.end();

    debug.log(`-----------------callBackOCPC: SUCCESS-----------------`);
}


// 百度统计代码
export const initBaiduAnalytics = () => {
  // 跳过非浏览器环境
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;

  // 初始化队列（防止重复加载）
  window._hmt = window._hmt || [];
  
  // 使用 Next.js 官方 Script 组件加载（见步骤3）
  // 或保留动态注入方式（需添加防重复逻辑）
};



