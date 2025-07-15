import * as crypto from 'crypto';

import {BaseCVService} from "./BaseCVService";
import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import * as enums from "../../utils/enums";
import * as du from "../../utils/dateUtils";
import * as fs from "../../utils/fileServer";

export class ByteCVService extends BaseCVService{
    public modelName: string = "ByteDance";
    public predicturl: string = "https://visual.volcengineapi.com?Action=CVProcess&Version=2022-08-31";
    public fetchurl: string = '';
    public func: string = "";
    public replicate = null;
    public result: any;

    private ak = process.env.BYTE_ACCESS_KEY_ID!;
    private sk = process.env.BYTE_SECRET_KEY!;
    private ark = process.env.BYTE_API_KEY;
    
    private req_key: string = "";
    private region: string = "cn-beijing";
    private service: string = "cv";
    private host: string = "visual.volcengineapi.com";
    private version: string = "";
    private apiAction: string = "CVProcess";
    private apiVersion: string = "2022-08-31";
    private apiGetResult: string = "CVSync2AsyncGetResult";
    private model: string = "";
    private resultMethod:string = "synchronous"; // asynchronous

   
    constructor(func:string){
        super();
        this.func = func;
        switch(func){
            case "byte-general-3.0":
                this.apiAction = "CVSync2AsyncSubmitTask";
                this.apiGetResult = "CVSync2AsyncGetResult";
                this.apiVersion = "2022-08-31";
                this.req_key = "high_aes_general_v30l_zt2i";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;                
            case "byte-general-2.1":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.version = "general_v2.1_L";
                this.req_key = "high_aes_general_v21_L";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-anime_v1.3.1":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.version = "anime_v1.3.1";
                this.req_key = "high_aes";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-inpainting-edit":
                this.apiAction = "Img2ImgInpaintingEdit";
                this.apiVersion = "2022-08-31";
           //     this.version = "anime_v1.3.1";
                this.req_key = "i2i_inpainting_edit";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-outpainting":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
          //      this.version = "anime_v1.3.1";
                this.req_key = "i2i_outpainting";
                this.region = "cn-north-1";
                this.service = "cv";
                break;                
            case "jimeng_general_2.1":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.req_key = "jimeng_high_aes_general_v21_L";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-edit_v2.0":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.req_key = "byteedit_v2.0";
                this.region = "cn-north-1";
                this.service = "cv";
                break;  
                
            case "byte-recolor":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.req_key = "lens_opr";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-faceswap":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.req_key = "faceswap_ai";
                this.region = "cn-north-1";
                this.service = "cv";
                break;
            case "byte-bgpaint":
                this.apiAction = "CVProcess";
                this.apiVersion = "2022-08-31";
                this.req_key = "img2img_bgpaint_light";
                this.region = "cn-north-1";
                this.service = "cv";
                break;


                // 视频模型                
            case "jimeng_vgfm_t2v_l20":
                this.apiAction = "CVSync2AsyncSubmitTask";
                this.apiGetResult = "CVSync2AsyncGetResult";
                this.apiVersion = "2022-08-31";
                this.req_key = "jimeng_vgfm_t2v_l20";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;
            case "jimeng_vgfm_i2v_l20":
                this.apiAction = "CVSync2AsyncSubmitTask";
                this.apiGetResult = "CVSync2AsyncGetResult";
                this.apiVersion = "2022-08-31";
                this.req_key = "jimeng_vgfm_i2v_l20";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;       
            case "byte-video_trans":
                this.apiAction = "CVSubmitTask";
                this.apiGetResult = "CVGetResult";
                this.apiVersion = "2022-08-31";
                this.req_key = "realman_video_trans_basic_chimera";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;       
            case "byte-video_avatar_imitator":
                this.apiAction = "CVSubmitTask";
                this.apiGetResult = "CVGetResult";
                this.apiVersion = "2022-08-31";
                this.req_key = "realman_avatar_imitator_v2v_gen_video";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;                   
            case "byte-video_upscale":
                this.apiAction = "VideoOverResolutionSubmitTaskV2";
                this.apiGetResult = "VideoOverResolutionQueryTaskV2";
                this.apiVersion = "2022-08-31";
                this.req_key = "lens_video_nnsr";
                this.region = "cn-north-1";
                this.service = "cv";
                this.resultMethod = "asynchronous";
                break;                   

            case "doubao-seedance-pro":
                this.predicturl = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
                this.model = "doubao-seedance-1-0-pro-250528";
                this.region = "cn-beijing";
                this.service = "ark";                
                this.resultMethod = "asynchronous";
                this.apiVersion = "v3";
                break;

            case "doubao-seedance-1-0-lite-t2v":
                this.predicturl = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
                this.model = "doubao-seedance-1-0-lite-t2v-250428";
                this.region = "cn-beijing";
                this.service = "ark";                
                this.resultMethod = "asynchronous";
                this.apiVersion = "v3";
                break;

            case "doubao-seedance-1-0-lite-i2v":
                this.predicturl = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
                this.model = "doubao-seedance-1-0-lite-i2v-250428";
                this.region = "cn-beijing";
                this.service = "ark";                
                this.resultMethod = "asynchronous";
                this.apiVersion = "v3";
                break;                
        }
    }

    // 解析出结果，对于图片和图像类，解析出最终图片或图像，数据类解析出数据的JSON
    private async getResult(response:any){
        if(response){
            switch(this.func){
                case "byte-video_avatar_imitator":
                case "jimeng_vgfm_t2v_l20":
                case "jimeng_vgfm_i2v_l20":
                    return {
                        id: response.request_id,                    
                        status: enums.resStatus.OK,
                        result: response.data.video_url,
                        message: response.message
                    };

                case "byte-video_upscale":
                case "byte-video_trans":
                    try{
                        const respData = JSON.parse(response.data.resp_data);
                        return {
                            id: response.request_id,                    
                            status: enums.resStatus.OK,
                            result: respData.url || respData.video_url,
                            message: response.message
                        };
                    }catch(err){
                        error("Byte getResult:", err);
                        return {
                            id: response.request_id,
                            status: enums.resStatus.unExpErr,
                            message: response.message        
                        }
                    }

                case "doubao-seedance-1-0-lite-t2v":
                case "doubao-seedance-1-0-lite-i2v":                    
                case "doubao-seedance-pro":
                    return {
                        id: response.id,                    
                        status: enums.resStatus.OK,
                        result: response.content.video_url,
                    };
                    
                default:
                    if(response.data?.binary_data_base64?.length){
                        for(let i=0; i<response.data.binary_data_base64.length; i++){
                            if(!response.data.image_urls){
                                response.data.image_urls = [];
                            }
                            response.data.image_urls.push(
                                await fs.moveToFileServer(`data:image/jpeg;base64,${response.data.binary_data_base64[i]}`, "T") || 
                                `data:image/jpeg;base64,${response.data.binary_data_base64[i]}`
                            );
                        }                       
                    }
                    return {
                        id: response.request_id,                    
                        status: enums.resStatus.OK,
                        result: response.data?.image_urls[0],
                        results: response.data?.image_urls,
                        message: response.message
                    }
            }
        }
    }

    public async predict(input: any): Promise<any> {
        switch(this.apiVersion){
            case "2022-08-31":
                return await this.predictV2(input);
            case "v3":
//                return {
//                    id:"cgt-20250613101611-7qz65",
//                    status:200
//                }
            default:
                return await this.predictV3(input);
        }
    }
    
    public async getPredictResult(id: string): Promise<any> {
        log(`getPredictResult: ${id}`);
        log(`this.apiVersion: ${this.apiVersion}`);        
        switch(this.apiVersion){
            case "2022-08-31":
                return await this.getPredictResultV2(id);
            case "v3":
            default:
                return await this.getPredictResultV3(id);
        }
    }


    public async predictV3(input: any): Promise<any> {       
        try{
            log("V3 body:", input);
            input.model = this.model;
            const startResponse = await fetch(this.predicturl, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.ark}`
                },
                body: JSON.stringify(input)
            });
            const jsonStartResponse = await startResponse.json();
            log("callByte:", JSON.stringify(jsonStartResponse));
            
            if(startResponse.status == 200){      
                jsonStartResponse.status = enums.resStatus.OK;
                this.result = jsonStartResponse;
            }else if(startResponse.status == 400 || startResponse.status == 50413){
                if(jsonStartResponse){
                    log("[BYTE server response:]", JSON.stringify(jsonStartResponse));
                }                
                if(jsonStartResponse.error?.code == "InputImageSensitiveContentDetected"){
                    this.result = {
                        id: jsonStartResponse.id,
                        status: enums.resStatus.NSFW,
                        message: "本次请求输入的内容不符合社区规则，请更换输入内容再尝试！"
                    }
                }else{                
                    switch(jsonStartResponse?.code){
                        case 50411:
                        case 50511:                             
                        case 50412: 
                        case 50413:
                        case 50512: 
                            this.result = {
                                id: jsonStartResponse.id,
                                status: enums.resStatus.NSFW,
                                message: "本次请求输入的内容不符合社区规则，请更换输入内容再尝试！"
                            }
                            break;
                        default: 
                            this.result = {
                                id: jsonStartResponse.id,
                                status: enums.resStatus.unknownErr,
                                message: jsonStartResponse.message                                
                            }
                    }
                }
            }else{
                this.result = {
                    id: jsonStartResponse.id,
                    status: enums.resStatus.unExpErr,
                    message: jsonStartResponse.message                                
                }         
            }
            
        } catch (err) {
            error("调用Byte服务器发生异常", err);               
            this.result = {
                status: enums.resStatus.unExpErr,
                message: "访问AI服务器失败，原因未知！"
            }
        }  
        return this.result;
    }    

    public async getPredictResultV3(id: string): Promise<any> {
        if (id && this.resultMethod == "asynchronous") {
            for(let retry=0; retry<1000; retry++){
                try{
                    if(retry < 2){
                        log("V3 getResult:", id);
                    }
                    const startResponse = await fetch(`${this.predicturl}/${id}`, {
                        method: "GET",
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.ark}`
                        }
                    });
                    if(startResponse.status == 200){
                        const jsonStartResponse = await startResponse.json();
                        if(retry < 2){                        
                            log("getByte Result:", JSON.stringify(jsonStartResponse), JSON.stringify(startResponse));                    
                        }
                        switch(jsonStartResponse?.status){
                            case "succeeded":
                                this.result = this.getResult(jsonStartResponse);
                                return this.result;
                            case "running":
                            case "queued":
                                await new Promise((resolve) => setTimeout(resolve, 1000));                                
                                continue;
                            case "cancelled":
                                this.result = {
                                    id: id,
                                    status: enums.resStatus.unExpErr,
                                    message: "访问AI服务器任务被意外取消！"
                                }    
                                return this.result;
                            case "failed":
                            default:
                                this.result = {
                                    id: id,
                                    status: enums.resStatus.unExpErr,
                                    message: "访问AI服务器异常，原因未知！"
                                }    
                                return this.result;
                        }                                
                    }else{
                        log("getByte Result:", startResponse);                    
                        this.result = {
                            id: id,
                            status: enums.resStatus.unExpErr,
                            message: "访问AI服务器异常，原因未知！"
                        }    
                        break;
                    }
                    
                } catch (err) {
                    error("调用Byte服务器发生异常", err);               
                    this.result = {
                        status: enums.resStatus.unExpErr,
                        message: "访问AI服务器失败，原因未知！"
                    }
                    break;
                }  
            }
        }
        return this.result;
    }
    
    
    //  'getPredictResult retry [3]:',
//  '{"code":10000,"data":{"binary_data_base64":[],"image_urls":null,"resp_data":"","status":"in_queue","video_url":""},"message":"Success","request_id":"20250510012030AF65B035DD322B2E4149","status":200,"time_elapsed":"11.383257ms"}'
    public async getPredictResultV2(id: string): Promise<any> {
        if (id && this.resultMethod == "asynchronous") {
            const body = JSON.stringify({req_key: this.req_key, task_id:id});
            const signature = await this.buildSignature(body, this.apiGetResult, this.apiVersion);
            this.predicturl = `https://visual.volcengineapi.com?Action=${this.apiGetResult}&Version=${this.apiVersion}`;
            for(let retry=0; retry<10000; retry++){
                const byteResult = await this.callByteV2(body, signature);                
                if(byteResult.status === 200){
                    if(byteResult.data.status === "done"){
                        this.result = await this.getResult(byteResult);
                        break;
                    }else{
                        const interval = 2000 + retry*10;
                        await new Promise((resolve) => setTimeout(resolve, interval));                        
                        if(retry % 10 === 0){
                            log(`BYTE getPredictResult retry [${retry}]`, JSON.stringify(byteResult));                        
                        }
                        continue;
                    }
                }else{
                    this.result = byteResult;
                    break;
                }
            }
        }
        return this.result;
    }

   public async predictV2(input: any): Promise<any> {
       // 构建BODY
       input.req_key = this.req_key;
       if(this.version){
           input.model_version = this.version;   
       }
       input.return_url = false;
       let body = JSON.stringify(input);
       const signature = await this.buildSignature(body, this.apiAction, this.apiVersion);
       this.predicturl = `https://visual.volcengineapi.com?Action=${this.apiAction}&Version=${this.apiVersion}`;
       
       const byteResponse = await this.callByteV2(body, signature);
       if(byteResponse.status === 200){
           if(this.resultMethod == "asynchronous"){
               this.result = {
                   status: enums.resStatus.OK,
                   task_id: byteResponse.data.task_id
               };
           }else{
               this.result = await this.getResult(byteResponse);
           }                    
       }else{
           this.result = byteResponse;
       }
    
       return this.result;
    }
    
    
    public async callByteV2(body: any, sign:any, retryTimes:number=3): Promise<any> {
        const {xDate, xContentSha256, credentialScope, signHeader, signature} = sign;
        
        let retry = 0;
        while(retry <= retryTimes){        
            try{
                log("body:", body);
                const startResponse = await fetch(this.predicturl, {
                    method: "POST",
                    headers: {
                        'Host': this.host,
                        'X-Date': xDate,
                        'X-Content-Sha256': xContentSha256,
                        'Content-Type': 'application/json',
                        // 'Accept': contentType,
                        'Authorization': `HMAC-SHA256 Credential=${this.ak}/${credentialScope}, SignedHeaders=${signHeader}, Signature=${signature}`
                    },
                    body: body
                });
                const jsonStartResponse = await startResponse.json();
                // log("callByte:", JSON.stringify(jsonStartResponse), JSON.stringify(startResponse));
                
                if(startResponse.status == 200){
                    jsonStartResponse.status = 200;
                    return jsonStartResponse;                    
                }else if(startResponse.status == 400 || startResponse.status == 50413){
                    if(jsonStartResponse){
                        log("[BYTE server response:]", JSON.stringify(jsonStartResponse));
                    }                    
                    switch(jsonStartResponse?.code){
                        case 50411:
                        case 50511:                             
                        case 50412: 
                        case 50413:
                        case 50512:
                        case 60208:
                            return {
                                id: jsonStartResponse.request_id,
                                status: enums.resStatus.NSFW,
                                message: "本次请求输入的内容不符合社区规则，请更换输入内容再尝试！"
                            }
                            break;
                        default: 
                            return {
                                id: jsonStartResponse.request_id,
                                status: enums.resStatus.unknownErr,
                                message: jsonStartResponse.message                                
                            }
                    }
                }else{
                    return {
                        id: jsonStartResponse.request_id,
                        status: enums.resStatus.unExpErr,
                        message: jsonStartResponse.message                                
                    }         
                }
                
            } catch (err) {
                error("调用Byte服务器发生异常", err);               
            }  
            
            retry++;
            if(retry <= 3){
                error("调用BYTE服务器失败，开始第" + retry + "次重新尝试");
                // 每次失败等待5秒再重新尝试
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }else{
                error("调用BTYE服务器失败，多次重试后仍然失败！AI服务可能发生了严重错误，请尽快排查");
            }
        }
        this.result = {
            status: enums.resStatus.unExpErr,
            message: "访问AI服务器多次尝试后仍然失败，原因未知！"
        }
        return this.result;
    }

    private async buildSignature(body:string, action:string, version:string){
        // 加密
        const now = new Date();
        const xDate = du.getUTCString(now);
        const shortXDate = xDate.substring(0, 8); 
        const signHeader = 'host;x-date;x-content-sha256;content-type';

        const xContentSha256 = this.hashSHA256(body);
        const contentType = 'application/json';
        const method = 'POST';
        const realQueryList = { Action: action, Version: version };
        const canonicalQueryString = this.buildCanonicalQueryString(realQueryList);

        const canonicalString = `${method}\n${"/"}\n${canonicalQueryString}\n` +
            `host:${this.host}\n` +
            `x-date:${xDate}\n` +
            `x-content-sha256:${xContentSha256}\n` +
            `content-type:${contentType}\n\n` +
            `${signHeader}\n${xContentSha256}`;

        const hashCanonicalString = this.hashSHA256(Buffer.from(canonicalString));
        const credentialScope = `${shortXDate}/${this.region}/${this.service}/request`;
        const signString = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${hashCanonicalString}`;

        const signKey = await this.genSigningSecretKeyV4(this.sk, shortXDate, this.region, this.service);
        const signature = this.hmacSHA256(signKey, signString).toString('hex');

        return {xDate, xContentSha256, credentialScope, signHeader, signature};
    }

    private buildCanonicalQueryString(queryList:any) {
        return Object.keys(queryList)
            .sort()
            .map(key => `${this.signStringEncoder(key)}=${this.signStringEncoder(queryList[key])}`)
            .join('&');
    }

    private signStringEncoder(source: string): string {
        return encodeURIComponent(source).replace(/%20/g, '+');
    }
    
    private hashSHA256(content: Buffer | string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    private hmacSHA256(key: Buffer | string, content: string): Buffer {
        return crypto.createHmac('sha256', key).update(content).digest();
    }
    
    private async genSigningSecretKeyV4(secretKey: string, date: string, region: string, service: string): Promise<Buffer> {
        const kDate = this.hmacSHA256(Buffer.from(secretKey), date);
        const kRegion = this.hmacSHA256(kDate, region);
        const kService = this.hmacSHA256(kRegion, service);
        return this.hmacSHA256(kService, 'request');
    }
}
