import * as Upload from "upload-js-full";
import { UploadWidgetResult } from "uploader";
import JSZip from "jszip";
// import JSZipUtils from "jszip-utils";
// import nodefetch from 'node-fetch';
import {log, warn, error} from "./debug";
import * as Bytescale from "@bytescale/sdk";
// import nodeFetch from "node-fetch";
import fetch from 'isomorphic-fetch';
import * as fu from "./fileUtils";


const uploadManager = new Upload.UploadManager(
    new Upload.Configuration({
        fetchApi: fetch,
        apiKey: process.env.NEXT_PUBLIC_UPLOAD_API_SECRET // e.g. "secret_xxxxx"
            })
);

// 准备upload.io的参数
export const fileApi = new Upload.FileApi(
    new Upload.Configuration({
        fetchApi: fetch,
        apiKey: process.env.NEXT_PUBLIC_UPLOAD_API_SECRET, // e.g. "secret_xxxxx"
        })
);  


// 前端获得图片通过这个函数，提前做打水印等操作
export function processImage( fileUrl: string, hasWatermark: boolean = true, watermarkPath?: string, qrSize:number=80, qrPos:string="bottom-right" ){
    let result = fileUrl;
//    if(watermarkPath){
//        watermarkPath = "/public/QR.jpg";
//    }
    if(watermarkPath && hasWatermark){
        result = result.replace("/raw/", "/image/");
        result = result.replace("/thumbnail/", "/image/");
        result += "?image=" + watermarkPath + "&layer-w=" + qrSize + "&layer-h=" + qrSize + "&gravity=" + qrPos;
    }
    return result;
}


// 前端获得图片的<= 2000x2000，主要用于aliyun需要的尺寸
export function resizeImageTo2000( path: string ){
    return path.replace("/raw/", "/T2000/");
}


// 前端获得图片的Icon 32x32
export function getImageIcon( path: string ){
    return path.replace("/raw/", "/jpg32/");
}


// 把URL的图片上传到文件服务器
// @ts-ignore
async function uploadFromUrl(url:string) {
    log(`start to upload from url: ${url}`);
    try{
        const baseUrl  = "https://api.bytescale.com";
        const params = {
              accountId: process.env.NEXT_PUBLIC_UPLOAD_USERID,
              apiKey: process.env.NEXT_PUBLIC_UPLOAD_API_KEY,
              requestBody: {
                  url: url,
              }
          };
        const path = `/v2/accounts/${params.accountId}/uploads/url`;
    
        // @ts-ignore    
        const entries  = obj => Object.entries(obj).filter(([,val]) => (val ?? null) !== null);    
        let retry = 0;
        while(retry++ < 6){
            try{
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "POST",
                    body: JSON.stringify(params.requestBody),
                    // @ts-ignore
                    headers: Object.fromEntries(entries({
                        "Authorization": `Bearer ${params.apiKey}`,
                        "Content-Type": "application/json",
                    }))
                });
                const result = await response.json();
                if (Math.floor(response.status / 100) == 2){
                    log(`uploadFromUrl: ${url}文件上传bytescale成功:${result}------`);
                    return result;                
                }else{
                    error(`uploadFromUrl: ${url}文件上传bytescale失败${response.status}------`);
                }            
            }catch(e){
                error("upload to bytescael error：" + url);
                error(e);
            }
            
            await new Promise((resolve) => setTimeout(resolve, 1000));      
    
            log(`${retry} tims retry upload ${url} to upload.io......`);
        }
    }catch(err){
        error(`uploadFromUrl exception:`, err);
    }
}

// urlOrPath，是返回URL还是返回PATH
export async function moveToUploadio(imageurl: string, root:string="T", urlOrPath:string="URL"){
    log('start to move to uploadio...');
    if(fu.isBase64Image(imageurl)){
        const buffer = await fu.converBase64ToBuffer(imageurl);
        const mime = await fu.getMimeFromBase64(imageurl);
        if(mime){
            const fileName = fu.randomFileName(mime, 6);
            return await uploadFileToServer(buffer, mime, fileName);
        }
    }else{
        log('start to move a URL to upload...');
        const url = await fu.getRedirectedUrl(imageurl);
        if(url){
            const response = await uploadFromUrl(url);
            if(response){
                console.log(`Success: ${JSON.stringify(response)}`);
                return urlOrPath == "URL" ? response.fileUrl : response.filePath;
            }else{
                error("上传到文件服务器失败！");
            }
        }
    }
}


// upload to bytescale
// Supported data types:
// - String
// - Blob
// - ArrayBuffer
// - Buffer
// - ReadableStream (Node.js), e.g. fs.createReadStream("file.txt")
export async function uploadFileToServer(data:any, mime:string, fileName:string){
    log("---uploadFileToServer---", mime, fileName);
  
    const um = new Bytescale.UploadManager({
        fetchApi: fetch, // nodeFetch as any,
        apiKey: process.env.NEXT_PUBLIC_UPLOAD_API_KEY!
    });

    for(let i=0; i<3; i++){
        try{
            const result = await um.upload({
              data: data,
              mime: mime,
              originalFileName: fileName ? fileName : "",  // Required if 'data' is a stream, buffer, or string.
              size: data.length ? data.length : 0
            });
            
            return result.fileUrl; // fileUrl, filePath
        }catch(err){
            error("bytescale.uploadFileToServer exeption:", err);
        }
    }
    return undefined;
}


/*
export async function getRedirectedUrl(url: string){
    let retry = 5;
    while(retry-- > 0){
        try{
            log("getRedirectedUrl url:" + url);
            const response = await fetch(url, { 
              redirect: 'follow',
              // timeout: 30000 
            });
            
            log("getRedirectedUrl response:" + response);
            log("getRedirectedUrl response.status:" + response.status);
            
            if(response && response.status == 200 && response.url){
                log("getRedirectedUrl response.url:" + response.url);
                return response.url;
            }else{
                return null;
            }
        }catch(e){
            error("getRedirectedUrl exception");
            error(e);
        }

        // 每次失败等待3秒再重新尝试
        await new Promise((resolve) => setTimeout(resolve, 3000));        
    }

    // 无法获得redirect url就返回原来的url
    return url;
}
*/

// 对外输出的函数，后台有多种选择的算法
export async function zipFiles(uploadedFiles: UploadWidgetResult[]){
  return await zipFilesUpload(uploadedFiles);
}

export async function zipFilesUpload(uploadedFiles: UploadWidgetResult[]){

  let request = "https://upcdn.io/"+process.env.NEXT_PUBLIC_UPLOAD_USERID+"/archive";
  let i = 0;
  uploadedFiles.map((file) => {
    if(i++ == 0){
      request += file.filePath + "?m=archive&large=true";
    }else{
      request += "&file=" + file.filePath;
    }
  });
  
  console.error("-----upload-----");
  console.error(request);
  const zipfile = moveToUploadio(request);
  console.error(zipfile);
  return zipfile;
  
}


export async function zipFilesPAS(uploadedFiles: UploadWidgetResult[]){
  let request = "https://upcdn.io/"+process.env.NEXT_PUBLIC_UPLOAD_USERID+"/archive";
  let i = 0;
  uploadedFiles.map((file) => {
    if(i++ == 0){
      request += file.filePath + "?m=archive&large=true";
    }else{
      request += "&file=" + file.filePath;
    }
  });
  
  console.error("-----upload-----");
  console.error(request);
  let zipfile = "";
  
//  const zipfile = moveToUploadio(request);
  i = 0;
  const len = uploadedFiles.length;
  let zipPath = "";
  
  while(i < len){
    const file = uploadedFiles[i];
    if(i++ == 0){
      const res = await processFileAndSave(file.filePath);
      zipfile = res.baseUrl;
      zipPath = res.basePath;
    }else{
      await processFileAndSave(file.filePath, zipPath);
    }
  }
  console.error(zipfile);
  return zipfile;
  
}


export async function zipFilesJSZIP(uploadedFiles: UploadWidgetResult[]){
  // 创建一个新的zip对象
  let zip = new JSZip();

  // 添加图片文件到zip对象中，假设图片文件是Blob类型的
  let i = 0;
  const len = uploadedFiles.length;
  
  while(i < len){
    const file = uploadedFiles[i++];
    console.error("fileUrl:" + file.fileUrl);
    console.error("filePath:" + file.filePath);
   
    // 获取图片文件的文件名，假设是URL的最后一部分
    let filename = file.filePath.split("/").pop();
    console.error("filename:" + filename);
    
    const arr = file.fileUrl.split("?");
    arr.pop();
    let url = arr[0];
    url = url.replace("/image/", "/raw/");
    console.error("url:" + url);
    
    if(filename){

      // 使用fetch函数从URL获取图片文件
      const response = await fetch(url);
      console.error("response:" + response);
      console.error("response.ok:" + response.ok);
      console.error("response.status:" + response.status);
      console.error("response.type:" + response.type);
      console.error("response.headers:" + response.headers.toString());
      console.error("json:" + JSON.stringify(response));

      const data = await response.blob();
      console.error("data:" + data);

      zip.file(filename, data,  {binary:true, base64:true});
    }

  }  
  
  console.error("start compress:");
  const content = await zip.generateAsync({type:'blob'});
  console.error("content:" + content);
  
  const result = await uploadManager.upload({
    // @ts-ignore
    accountId: process.env.NEXT_PUBLIC_UPLOAD_USERID, // This is your account ID.

    data: content,
      path: {
        // See path variables: https://upload.io/dashboard/docs/path-variables
        folderPath: "/Z/{UTC_YEAR}/{UTC_MONTH}/{UTC_DAY}",
        fileName: "{UNIQUE_DIGITS_4}{ORIGINAL_FILE_EXT}"
      },
  });
  
  return result.fileUrl;

}



function pathToDestination(file:string){
  let arr = file.split("/"); // ["", "abc", "xxx", "ddd.jpg"]
  let filename = arr.pop(); // "ddd.jpg"
  let path = arr.join("/"); // "/abc/xxx"  
  
  return{
    "fileName": filename,
    "folderPath": path,    
  }
}

///////////////////////////////////////////////////////////////////////////
// 处理远程把upload.io上的一些文件压缩在一个zip文件
///////////////////////////////////////////////////////////////////////////
export async function processFileAndSave(file:string, zip?:string) {  
  log("file:" + file);
  log("zip:" + zip);
  const dest = pathToDestination(zip?zip:"");
  log("destination:" + dest.fileName + "+" + dest.folderPath);
  
  const result = await fileApi.processFileAndSave({
      // @ts-ignore
      "accountId": process.env.NEXT_PUBLIC_UPLOAD_USERID,
      "filePath": file,
      "processFileAndSaveRequest": {
        "destination": zip ? pathToDestination(zip) : {
          "fileName": "{UNIQUE_DIGITS_4}{ORIGINAL_FILE_EXT}",
          "folderPath": "/Z",
        }
      },
      "transformation": "compress"
    });
 log("result:" + result.toString());
 log("result:" + result.basePath);
 return result;
}


export function getFilePathFromURL(url:string){
    const keywords = ['/image/', '/raw/', '/thumbnail/'];
    let path = "";
    let p = -1;
    for(const word of keywords){
        p = url.indexOf(word);
        if(p > 0){
            p += word.length;
            path = url.substring(p-1);
            const wen = path.indexOf("?");
            if(wen>0){
                path = path.substring(0, wen-1);
            }
            break;
        }
    }
    if(p >0){
        return path;
    }else{
        return url;
    }
}


// 删除文件
export async function deleteFiles(inputFiles: any[] ){
    let files: string[] = [];
    inputFiles.map((file) => {
        files.push(getFilePathFromURL(file.filePath));
    });
    
    log("files:" + files);
    log("accountId:" + process.env.NEXT_PUBLIC_UPLOAD_USERID);

    try{
        const result = await fileApi.deleteFileBatch({
            // @ts-ignore
            "accountId": process.env.NEXT_PUBLIC_UPLOAD_USERID,
            "deleteFileBatchRequest": {
                "files": files,
            }
        });
        if(result){
            log("delete file result:", JSON.stringify(result));
            return true;
        }
    }catch(e){
        error("delete file exception:");
        error(e);
    }    
    return false;
}
