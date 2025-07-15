import axios from 'axios';
import tmp from "tmp";
import * as fsp from "fs/promises";
import * as fs from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
import path from "path";
import fetchFile from "node-fetch"; // ✅ 重命名避免覆盖原生 fetch

const streamPipeline = promisify(pipeline);

import * as cos from "./COS";
import * as oss from "./OSS";
import * as bytescale from "./bytescale";
import * as debug from "./debug";
import {log, error, warn} from "./debug";

import * as enums from "./enums";
import * as fu from "./fileUtils";

import Replicate from "replicate";
const replicate = new Replicate({
  // get your token from https://replicate.com/account/api-tokens
  auth: process.env.REPLICATE_API_KEY
});

const fileServer = process.env.FILESERVER!;



export async function getRedirectedUrl(url: string){
    let retry = 5;
    while(retry-- > 0){
        try{
            let response:any;
            if(fu.needProxy(url) || (retry < 4 && process.env.UTILS_API_PROXY)){
                debug.log("retry getRedirectedUrl throght proxy");
                const remote = await fetch(process.env.UTILS_API_PROXY!, { 
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },            
                    body: JSON.stringify({
                        cmd: 'REDIRECT',
                        params:{
                            url
                        }
                    })
                });
                if(remote){
                    response = {
                        url: (await remote.json()).toString()
                    }
                }
            }else{
                response = await fetch(url, { 
                  redirect: 'follow',
                //  timeout: 30000 
                });
            }
            
            if(response && response.status == 200 && response.url){
               // debug.log("getRedirectedUrl response.url:" + response.url);
                return response.url;
            }else{
                return url;
            }
        }catch(e){
            debug.error("server side getRedirectedUrl exception for URL:", url);
        }

        // 每次失败等待1秒再重新尝试
        await new Promise((resolve) => setTimeout(resolve, 1000));        
    }

    // 无法获得redirect url就返回原来的url
    return url;
}


// 生成一个字符串，每一位可以是1-10或者大小写字母
export function generateRandomString(length:number) {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomString = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }
    return randomString;
}

export function getExt(url:string){
    // 从URL中抛弃问号后面的内容
    const fileNameWithoutParams = url.split('?')[0]
    if(fileNameWithoutParams){
        // 去除前面域名和路径
        const fileName = fileNameWithoutParams.split('/').pop(); 
        if(fileName){
            // 提取文件名中的扩展名部分
            const tmpAry = fileName.split('.');
            if(tmpAry.length > 1){
                const ext = tmpAry.pop();
               // if(ext == "image"){ // 处理豆包的情况
               //     return "jpg";
               // }
                return ext;
            }
        }
    }
}

// 按照规则生成一个文件名和文件路径
export function generateFilePath(ext:string|undefined, root:string='G'){
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();    
    
    let filePath = root + "/" + year + "/" + month + "/" + day + "/" + generateRandomString(5);
    if(ext){
        filePath += "." + ext;
    }else{
        filePath += ".jpg"; // 这主要是为生成的二维码用的。是临时的办法，将来需要改
    }
    
    return filePath;
}


// 把敏感数据备份到美国的服务器，保留证据，避免违反中国法律
// 如果成功备份，就返回新URL
// 如果备份失败，就返回空
export async function backupToUS(image: string){
    debug.log('start to backup to US....');
    if(fu.isBase64Image(image)){
        debug.log('backup a base64 to US....');
        const mime = fu.getMimeFromBase64(image);
        if(mime){
            const ext = mime.split("/").pop();
            const fileName = `${generateRandomString(6)}.${ext}`;
            return await bytescale.uploadFileToServer(fu.converBase64ToBuffer(image), mime, fileName);
        }
    }else{
        if(fu.isURL(image)){
            debug.log('backup a URL to US....');          
            if(image.indexOf("upcdn.io") < 0){
                return await bytescale.moveToUploadio(image, "B", "URL");
            }
        }
    }
}


export async function moveToFileServer(image: string, root:string="U", urlOrPath:string="URL"){
    try{
        switch(fileServer){
            case enums.fileServer.BYTESCALE:
                return await bytescale.moveToUploadio(image, root, urlOrPath);
            case enums.fileServer.COS:
                // return await cos.moveToCOS(image, root, urlOrPath);
                debug.error("系统没有指定文件服务器，请检查配置文件！");
                throw new Error("系统没有指定文件服务器，请检查配置文件！");
                
            case enums.fileServer.OSS:
                return await oss.moveToOSS(image, root, urlOrPath);
            default:
                debug.error("系统没有指定文件服务器，请检查配置文件！");
        }
    }catch(err){
        debug.error("move to file server unknown error");
    }
}


export async function uploadDataToServer(data:any, mime:string, fileName:string, root:string="U"){

    switch(fileServer){
        case enums.fileServer.BYTESCALE:
            return await bytescale.uploadFileToServer(data, mime, fileName);
        case enums.fileServer.COS:
            return await cos.uploadData(data, mime, fileName, root);
        case enums.fileServer.OSS:
            return await oss.uploadData(data, mime, fileName, root);
        default:
            debug.log("系统没有指定文件服务器，请检查配置文件！");
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
    }
}

export async function uploadFileToServer(file:any, root:string="T"){
    switch(fileServer){
        case enums.fileServer.BYTESCALE:
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
        case enums.fileServer.COS:
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
        case enums.fileServer.OSS:
            return await oss.uploadFile(file, root);
        default:
            debug.log("系统没有指定文件服务器，请检查配置文件！");
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
    }
}

export async function uploadFromUrlToPath(imageUrl:string, newPath:string){
    switch(fileServer){
        case enums.fileServer.BYTESCALE:
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
        case enums.fileServer.COS:
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
        case enums.fileServer.OSS:
            return await oss.uploadFromUrlToPath(imageUrl, newPath);
        default:
            debug.log("系统没有指定文件服务器，请检查配置文件！");
            throw new Error("系统没有指定文件服务器，请检查配置文件！");            
    }
}

// 水印必须被传输到和文件同一个文件服务器
export async function uploadQRCode(path:string, watermark:string){
    if(path.indexOf("upcdn.io")>=0){
        if(watermark.indexOf("upcdn.io")<0){
            return {fileServer: enums.fileServer.BYTESCALE, filePath: await bytescale.moveToUploadio(watermark, "T", "PATH")};
        }        
    }else if(path.indexOf("aliyuncs.com")>=0){
        if(watermark.indexOf("aliyuncs.com")<0){
            return  {fileServer: enums.fileServer.OSS, filePath: await oss.moveToOSS(watermark, "T", "PATH")};
        }
    }else if(path.indexOf("myqcloud.com")>=0){
        if(watermark.indexOf("myqcloud.com")<0){
            return  {fileServer: enums.fileServer.COS, filePath: await cos.moveToCOS(watermark, "T", "PATH")};
        }
    }        
}

export function inOSSBucket(fileUrl:string){
    return (fu.getFileServerOfURL(fileUrl) == enums.fileServer.OSS) && inBucket(fileUrl);
}

export function inBucket(fileUrl:string){
    if(fileUrl.indexOf("upcdn.io")>=0){
        return process.env.NEXT_PUBLIC_UPLOAD_USERID && fileUrl.indexOf(process.env.NEXT_PUBLIC_UPLOAD_USERID!) > 0;
    }else if(fileUrl.indexOf("aliyuncs.com")>=0){
        return process.env.ALI_OSS_BUCKET && process.env.ALI_OSS_REGION && 
          fileUrl.indexOf(process.env.ALI_OSS_BUCKET!) > 0 && fileUrl.indexOf(process.env.ALI_OSS_REGION!) > 0;
    }else if(fileUrl.indexOf("myqcloud.com")>=0){
        return process.env.TENCENT_COS_BUCKET && process.env.TENCENT_COS_REGION && 
          fileUrl.indexOf(process.env.TENCENT_COS_BUCKET!) > 0 && fileUrl.indexOf(process.env.TENCENT_COS_REGION!) > 0;
    }
    return false;
}

export function getImageURL( fileUrl: string, hasWatermark: boolean = true, watermarkPath?: string, qrSize:number=80, qrPos:string="bottom-right" ){
    if(fileUrl.indexOf("upcdn.io")>=0){
        return bytescale.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }else if(fileUrl.indexOf("aliyuncs.com")>=0){
        return oss.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }else if(fileUrl.indexOf("myqcloud.com")>=0){
        return cos.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }
    return fileUrl;
}

export async function deleteFileByURL(fileURL:string){
    const file = {
        fileServer: fu.getFileServerOfURL(fileURL),
        filePath: fu.getPathOfURL(fileURL)
    }
    await deleteFiles([file]);
}


export async function deleteFiles(files:any[]){
    for(const f of files){
        switch(f.fileServer){
            case enums.fileServer.BYTESCALE:
                return await bytescale.deleteFiles([{filePath:f.filePath}]);            
            case enums.fileServer.OSS:
                return await oss.deleteFiles([{filePath:f.filePath}]);       
            case enums.fileServer.COS:
                return await cos.deleteFiles([{filePath:f.filePath}]);                     
        }
    }
}


////////////////////////////////////////////////////////////////////////////
export async function uploadToReplicate(url:string){
    const buffer = await downloadFileToBuffer(url);
    const response = await replicate.files.create(buffer);
    if(response){
        return response.urls?.get;
    }
}

async function downloadFileToBuffer(url:string) {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer' // 确保响应数据是一个 buffer
        });

        // 将响应数据转换为 Buffer
        const buffer = Buffer.from(response.data);

        return buffer;
    } catch (error) {
        debug.error('下载文件时出错:', error);
        throw error;
    }
}

export async function getThumbnail(url:string, size: number=576){
    if(url){
        if(url.indexOf("upcdn.io") > 0){
            return url;
        }else if(url.indexOf("aliyuncs.com")>=0){
            return await getOSSThumbnail(url, size);
        }else if(url.indexOf("myqcloud.com")>=0){
            return url;
        }
    }
    return url;
}

export async function getOSSThumbnail(url:string, size: number=576){
    if(size > 768){
        size = 768;
    }
    if(size < 8){
        size = 8;
    }
    // 判断是否有Thumbnail
    const thumbURL = url.replace("/U/", `/S/${size}/`);
    let thumbPath = fu.getPathOfURL(thumbURL);   
    if(thumbPath?.startsWith("/")){
        thumbPath = thumbPath.substring(1);
    }  
    if(thumbPath && await oss.isExistObject(thumbPath)){
        return thumbURL;
    }else{        
        let newFile:string;
        if(url.indexOf("?")>0){
            if(url.indexOf("x-oss-process=image")>=0){
                newFile = `${url}/resize,w_${size}`;        
            }else{
                // 一般这是异常情况
                return url;
            }
        }else{
            newFile = `${url}?x-oss-process=image/resize,w_${size}`;
        }
        // 为了用户响应速度，异步让后台上传一个Thumbnail文件，本次直接先返回OSS的处理结果
        if(url && thumbPath){
            uploadFromUrlToPath(newFile, thumbPath).then((file:any)=>{
                debug.log("Thumb file created:", file?.url);
            });
        }
      
        return newFile;
    }
    return url;
}

/**
 * 下载远程文件到本地临时文件，带重试和超时机制（使用 node-fetch 实现）
 * @param url 要下载的文件 URL
 * @param maxRetries 最大重试次数，默认 3
 * @param timeoutMs 单次请求超时时间（毫秒），默认 120 秒
 * @returns 本地文件路径
 */
export async function downloadToLocal(
  url: string,
  maxRetries: number = 3,
  timeoutMs: number = 120000
): Promise<string> {
  console.log("开始下载文件，URL：", url);

  const ext = path.extname(new URL(url).pathname) || "";
  const tempFile = tmp.fileSync({ postfix: ext });
  console.log("临时文件路径：", tempFile.name);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`下载尝试 ${attempt}/${maxRetries}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetchFile(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      clearTimeout(timeout);

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await streamPipeline(response.body, fs.createWriteStream(tempFile.name));
      console.log(`✅ 下载完成：${tempFile.name}`);
      return tempFile.name;
    } catch (err: any) {
      console.error(`❌ 下载失败 (第 ${attempt} 次):`, err.message || err);
      if (attempt < maxRetries) {
        console.log(`等待 1 秒后重试...`);
        await new Promise((res) => setTimeout(res, 1000));
      } else {
        try {
          tempFile.removeCallback();
        } catch {}
        throw new Error(`下载失败（共尝试 ${maxRetries} 次）: ${err.message}`);
      }
    }
  }

  return tempFile.name;
}


/**
 * 删除本地临时文件
 * @param filePath 要删除的本地文件路径
 */
export async function deleteLocalFile(filePath: string): Promise<void> {
    log("开始删除本地临时文件：", filePath);
    try {
        await fsp.unlink(filePath);
        log("文件删除成功：", filePath);
    } catch (err) {
        error("删除本地临时文件失败：", filePath, err);
        // 如果文件不存在或权限问题，也可以选择不抛出，视业务需求而定
        throw err;
    }
}
