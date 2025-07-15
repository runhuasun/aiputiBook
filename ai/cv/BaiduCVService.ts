const fs = require('fs');
const http = require('http');
const https = require('https');
import { Readable } from 'stream';
import {imageprocess as AipImageProcessClient, HttpClient} from "baidu-aip-sdk";

import * as iu from "../../utils/imageUtils";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {BaseCVService} from "./BaseCVService";
import * as vu from "../../utils/videoUtils";
import * as fu from "../../utils/fileUtils";
import * as enums from "../../utils/enums";
import {moveToFileServer} from "../../utils/fileServer";

const client = new AipImageProcessClient(
    process.env.BAIDU_APP_ID!, 
    process.env.BAIDU_API_KEY!, 
    process.env.BAIDU_SECRET_KEY!
);

// 设置request库的一些参数，例如代理服务地址，超时时间等
// request参数请参考 https://github.com/request/request#requestoptions-callback
HttpClient.setRequestOptions({timeout: 5000});

// 也可以设置拦截每次请求（设置拦截后，调用的setRequestOptions设置的参数将不生效）,
// 可以按需修改request参数（无论是否修改，必须返回函数调用参数）
// request参数请参考 https://github.com/request/request#requestoptions-callback
HttpClient.setRequestInterceptor(function(requestOptions:any) {
    // 查看参数
    console.log(requestOptions)
    // 修改参数
    requestOptions.timeout = 5000;
    // 返回参数
    return requestOptions;
});


export class BaiduCVService extends BaseCVService{
    public modelName: string = "ali";
    public predicturl: string = "";
    public version: string = "";
    public func: string = "";
    public replicate = null;
    private predictType = "";
    private resultType: string = "MEDIA";
    private result:any = null;
    
    constructor(func:string){
        super();
        this.func = func;
         
    }

    public async predict(input:any){
        switch(this.func){
            case "baidu-colourize":
            //    const base64Image = await iu.converImageToBase64(input.image);
                this.result = await client.colourizeUrl(input.image!, {});
                log("BaiduCVService predict:", JSON.stringify(this.result));
                this.result.task_id = String(this.result.log_id);
                this.result.status = enums.resStatus.OK;
                this.result.result = await moveToFileServer( `data:image/jpeg;base64,${this.result.image}`, "T") || this.result.image;
                break;
        }
        return this.result;
    }

    public async getPredictResult(id:string){
        return this.result;
    }
}

