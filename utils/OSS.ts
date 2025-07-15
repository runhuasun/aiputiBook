import OSS from "ali-oss";
// import fs from "fs";
import path from "path";
import * as urllib from 'urllib';
import { Readable } from 'stream';
import {log, warn, error} from "./debug";
import axios from "axios";
import fetch from 'isomorphic-fetch';
require('dotenv').config();
import * as fs from "./fileServer";
import * as fu from "./fileUtils";


const OSSBucket = process.env.ALI_OSS_BUCKET || "aiputi";
const OSSRegion = process.env.ALI_OSS_REGION || "oss-cn-beijing";
const OSSKeyID:string = process.env.ALI_ACCESS_KEY_ID || "osskeyid";
const OSSKeySecret:string = process.env.ALI_ACCESS_KEY_SECRET || "osskeysecret";

// 全局公用的OSS对象
function getOSSClient(){
    return new OSS({
        // yourRegion填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
        region: OSSRegion,
        // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
        accessKeyId: OSSKeyID,
        accessKeySecret: OSSKeySecret,
        // 填写Bucket名称，例如examplebucket。
        bucket: OSSBucket,
        // secure: true, // 设置 secure 为 true，表示使用 HTTPS  
        timeout: 60000, // 设置超时时间为 60 秒
        secure: true, // 这里设置为true，以确保通过HTTPS进行通信  
        });
}


// 前端获得图片通过这个函数，提前做打水印等操作
export function processImage( fileUrl: string, hasWatermark: boolean = true, watermarkPath?: string, qrSize:number=80, qrPos:string="g_se" ){
    let result = fileUrl.replace("/aiputi.oss-cn-beijing.aliyuncs.com/", "/aiputi.oss-accelerate.aliyuncs.com/");
//    if(watermarkPath){
//        watermarkPath = "/public/QR.jpg";
//    }
    if(watermarkPath && hasWatermark){
        //获得水印的base64编码
        const url = watermarkPath + "?x-oss-process=image/resize,m_fixed,w_" + qrSize + ",h_" + qrSize;
        const base64Url = Buffer.from(url).toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
        result += "?x-oss-process=image/watermark,image_" + base64Url + "," + qrPos + ",x_0,y_0";
    }
    return result;
}


// 删除文件
export async function deleteFiles(inputFiles: any[] ){
    let files: string[] = [];
    inputFiles.map((file) => {
        files.push(file.filePath);
    });

    try{
        const result = await getOSSClient().deleteMulti(files, {quiet: true});
        if(result){
            log("delete file result:" + result);
            return true;
        }
    }catch(e){
        error("delete file exception:");
        error(e);
    }    
    return false;
}


// 获得网页端上传文件需要的签名
// 网页端上传的文件都放在U开头目录下
export async function getSignature(key:string, type:string, exp:number=3600, root:string="U"){
    try {
        let result:any = {};
        const t = fs.generateFilePath(fs.getExt(key), root || "U");
        console.log("t:" + t);
        result.fileName = t;   
        result.signatureUrl = await getOSSClient().signatureUrl(result.fileName, {
          method: "PUT",
          "Content-Type": type,          
          expires: exp || 3600,  // 签名有效时长，单位秒
          // 可以在这里添加额外参数
          });
        result.url = `https://${OSSBucket}.${OSSRegion}.aliyuncs.com/${result.fileName}`;
        return result;
    } catch (err) {
        error(err);
    }
}



// 上传文件到OSS
export async function moveToOSS(url: string, root: string="T", urlOrPath:string="URL", path?:string){
    log("start to moveToOSS...");
    if(url){
        let response:any;
        if(fu.isBase64Image(url)){
            response = await uploadBase64(url, root);
        }else{
            if(fu.isURL(url)){
              response = await uploadFromUrl(url, root, 6, path);
            }
        }
        if(response){
            console.log(`Success: ${JSON.stringify(response)}`);
            return urlOrPath == "URL" ? response.url : response.path;
        }else{
            error("上传到文件服务器失败！");
        }
    }
}


// 上传一个本地内存数据
export async function uploadData(
  data: any,
  mime: string,
  fileName: string,
  root: string = "U"
): Promise<string> {
  const maxRetries = 5;
  const OSSFilePath = fs.generateFilePath(fs.getExt(fileName), root);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await getOSSClient().put(OSSFilePath, data, { timeout: 3600000 });
      const fileUrl = `https://${OSSBucket}.${OSSRegion}.aliyuncs.com/${OSSFilePath}`;
      return fileUrl;
    } catch (e: any) {
      const isTimeout =
        e?.code === "RequestError" &&
        (e?.message?.includes("ETIMEDOUT") || e?.status === -1);

      if (isTimeout && attempt < maxRetries) {
        const delay = attempt * 1000; // 1s, 2s, 3s, 4s...
        console.warn(`Upload timeout, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // 非超时错误或达到最大重试次数，记录错误并返回空字符串
      error("Exception while uploading file:");
      error(e);
      return "";
    }
  }

  // 理论上不会到这里
  return "";
}



// 上传一个本地文件
export async function uploadFile(imagePath:string, root:string="T"){
    try{
        const OSSFilePath = fs.generateFilePath(fs.getExt(imagePath), root);
        // let stream = fs.createReadStream(imagePath);
        // let result = awiat getOSSClient().putStream(OSSFilePath, stream);    
        let result = await getOSSClient().put(OSSFilePath, path.normalize(imagePath), {timeout:3600000});
        // let result = awiat getOSSClient().put(OSSFilePath, imagePath);
      
        const fileUrl = `https://${OSSBucket}.${OSSRegion}.aliyuncs.com/${OSSFilePath}`;
        log("file uploaded to: " + fileUrl);
      
        return fileUrl;
    } catch (e) {
        error('Error downloading or uploading file:');
        error(e);
        return "";
    }
}


export async function uploadBase64(data: string, root: string = "U"){
    try {
        // 检查并提取 MIME 和 base64 数据
        const matches = data.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error("Invalid base64 format");
        }
        
        const inferredMime = matches[1]; // e.g., "image/png"
        const base64Data = matches[2];   // the actual base64 payload
        const contentType = inferredMime;
        const ext = inferredMime.split("/").pop();
        
        const buffer = Buffer.from(base64Data, 'base64');
        const OSSFilePath = fs.generateFilePath(ext, root);
        
        const result = await getOSSClient().put(OSSFilePath, buffer, {
            headers: {
                'Content-Type': contentType
            },
            timeout: 3600000
        });

        const fileUrl = `https://${OSSBucket}.${OSSRegion}.aliyuncs.com/${OSSFilePath}`;
        return {fileServer:"OSS", url:fileUrl, path:OSSFilePath};
        
    } catch (e) {
        error('Exception while uploading base64 data:');
        error(e);
    }
}



// 上传一个URL中的文件
export async function uploadFromUrl(imageUrl:string, root:string="T", retry:number=6, path?:string){
    
    const OSSFilePath = path || fs.generateFilePath(fs.getExt(imageUrl), root);
    return await uploadFromUrlToPath(imageUrl, OSSFilePath, retry);
    
}


// 上传一个URL中的文件
export async function uploadFromUrlToPath(imageUrl:string, newPath:string, retry:number=6){
 
    // 比较容易发生timeout，重试
    for(let i=0; i<retry; i++){

        if(imageUrl.startsWith("data:image")){
            log("第" + (i+1) + "次尝试上传Base64文件到OSS");  
        }else{
            log("第" + (i+1) + "次尝试上传网络文件到OSS：" + imageUrl);
        }
        
        // 每次尝试前等待0.5秒再开始
        if(i>0){
            await new Promise((resolve) => setTimeout(resolve, (i+1)*500));      
        }
        
        let response:any = null;

        try {
            imageUrl = await fs.getRedirectedUrl(imageUrl);
            const OSSFilePath = newPath;

            if(fu.needProxy(imageUrl) || (i>0 && process.env.UTILS_API_PROXY)){
                log("try to get image data through a proxy");
                const remote = await fetch(process.env.UTILS_API_PROXY!, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },                  
                    body: JSON.stringify({
                        cmd: "FETCH_DATA",
                        params: {
                            url: imageUrl
                        }                        
                    })
                });
                response = {
                    data: Buffer.from(await remote.arrayBuffer())
                };
            }else{              
                response = await axios.get(imageUrl, { 
                  responseType: 'arraybuffer',
                  timeout: 3600000, // 设置超时时间为 600 秒
                });
            }
          
            const options:any = {
                timeout: 3600000,
            };
            const mime = await fu.getMimeOfURL(imageUrl);                
            if(mime){
                options.mime = mime;
            }
            await getOSSClient().put(OSSFilePath, response.data, options);

            const fileUrl = `https://${OSSBucket}.${OSSRegion}.aliyuncs.com/${OSSFilePath}`;
            
            log("file uploaded to: " + fileUrl);

            return {fileServer:"OSS", url:fileUrl, path:OSSFilePath};
            
        } catch (e) {
            error('Exception when uploading file:', imageUrl, e);
        } finally {
            if(response){
                response.data = null; // 显式将 Buffer 对象设置为 null
            }
        }
    }

    // Return an empty string if max retries exceeded
    console.error('Max retries exceeded. File upload failed.');  
  
    return {};
}

export async function isExistObject(name:string, options:any = {}) {
    try {
        await getOSSClient().head(name, options);
        //log('文件存在:', name)
        return true;
    }  catch (error:any) {
        if (error.code === 'NoSuchKey') {
            log('文件不存在:', name)
        }
    }
}
