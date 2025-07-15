import COS from "cos-nodejs-sdk-v5";
import axios from "axios";
import fs from "fs";
import {log, warn, error} from "./debug";
import {generateRandomString, generateFilePath, getRedirectedUrl, getExt} from "./fileServer";




// 全局公用的COS对象
var cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID, // 推荐使用环境变量获取；用户的 SecretId，建议使用子账号密钥，授权遵循最小权限指引，降低使用风险。子账号密钥获取可参考https://cloud.tencent.com/document/product/598/37140
    SecretKey: process.env.TENCENT_SECRET_KEY, // 推荐使用环境变量获取；用户的 SecretKey，建议使用子账号密钥，授权遵循最小权限指引，降低使用风险。子账号密钥获取可参考https://cloud.tencent.com/document/product/598/37140
});
const cosBucket = process.env.TENCENT_COS_BUCKET!;
const cosRegion = process.env.TENCENT_COS_REGION!;



// 前端获得图片通过这个函数，提前做打水印等操作
export function processImage( fileUrl: string, hasWatermark: boolean = true, watermarkPath?: string, qrSize:number=80, qrPos:string="southeast" ){
    let result = fileUrl;
//    if(watermarkPath){
//        watermarkPath = "/public/QR.jpg";
//    }
    if(watermarkPath && hasWatermark){
        //获得水印的base64编码
        const url = watermarkPath + "?imageMogr2/thumbnail/" + qrSize + "x" + qrSize + "!";
        const base64Url = Buffer.from(url).toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
        result += "?watermark/1/image_key/" + base64Url + "/" + qrPos;

        // 输出格式和输入格式保持一致        
        const ext = getExt(fileUrl);
        if(ext){
            result += "|imageMogr2/format/" + ext;
        }
    }
    return result;
}



// 删除文件
export async function deleteFiles(inputFiles: any[] ){
    let files: any[] = [];
    inputFiles.map((file) => {
        files.push({Key: file.filePath});
    });

    try{
        const result = await cos.deleteMultipleObject({
            Objects:files, 
            Bucket: cosBucket,
            Region: cosRegion
        });
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




// 上传文件到COS
export async function moveToCOS(url: string, root:string="T", urlOrPath:string="URL"){
    if(url){
        const response = await uploadFromUrl(url, root, 1);
        if(response){
            console.log(`Success: ${JSON.stringify(response)}`);
            return urlOrPath == "URL" ? response.url : response.path;
        }else{
            error("上传到文件服务器失败！");
        }
    }  
}


// 上传一个本地文件
export async function uploadData(data:any, mime:string, fileName:string, root:string="U"){
    try{
        const cosFilePath = generateFilePath(getExt(fileName), root);
        const cosData = new Promise((resolve, reject) => {
            cos.putObject(
                {
                    Bucket: cosBucket, 
                    Region: cosRegion,   
                    Key: cosFilePath,        
                    StorageClass: 'STANDARD',
                    Body: data, // 上传文件对象
                    ContentType: mime,
                }, 
                (err, data) => {
                    if (err) {
                        error('Error uploading file to COS:');
                        reject(err);
                    } else {
                        log('File uploaded successfully:');
                        resolve(data);
                    }
                }
            );
        });
        const fileUrl = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${cosFilePath}`;
        return fileUrl;
    } catch (e) {
        error('Exception while uploading file:');
        return "";
    }
}


// 上传一个本地文件
export async function uploadFile(imagePath:string){
    try{
        const cosFilePath = generateFilePath(getExt(imagePath));
        const cosData = new Promise((resolve, reject) => {
            cos.putObject(
                {
                    Bucket: cosBucket, 
                    Region: cosRegion,   
                    Key: cosFilePath,        
                    StorageClass: 'STANDARD',
                    Body: fs.createReadStream(imagePath), // 上传文件对象
                    ContentLength: fs.statSync(imagePath).size,        
                }, 
                (err, data) => {
                    if (err) {
                        error('Error uploading file to COS:');
                        reject(err);
                    } else {
                        log('File uploaded successfully:');
                        resolve(data);
                    }
                }
            );
        });
        const fileUrl = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${cosFilePath}`;
        // console.log("The file URL is " + fileUrl);
        return fileUrl;
    } catch (e) {
        error('Error downloading or uploading file:');
        error(e);
        return "";
    }
}



// 上传一个URL中的文件
export async function uploadFromUrl(imageUrl:string, root:string="T", retry:number=3){
    // 比较容易发生timeout，重试
    for(let i=0; i<retry; i++){
        log("第" + (i+1) + "次尝试上传网络文件到COS");
        // 每次尝试前等待i秒再开始
        await new Promise((resolve) => setTimeout(resolve, (i)*3000));         
        
        let response:any = null;
        try {
            imageUrl = await getRedirectedUrl(imageUrl);
            const cosFilePath = generateFilePath(getExt(imageUrl), root);
            log("generateFilePath:" + cosFilePath);
            response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            log("axios.get response:" + response.data.length);
            
            const cosData = await new Promise((resolve, reject) => {
                cos.putObject(
                    {
                        Bucket: cosBucket,
                        Region: cosRegion,
                        Key: cosFilePath,  // 保存在 COS 中的文件名
                        Body: response.data, // 图片数据
                        ContentLength: response.data.length
                    },
                    (err, data) => {
                        if (err) {
                            error('Error uploading file to COS:');
                            reject(err);
                        } else {
                            log('File uploaded successfully');
                            resolve(data);
                        }
                    }
                );
            });
    
            const fileUrl = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${cosFilePath}`;
            // console.log("The file URL is " + fileUrl);

            return {fileServer:"COS", url:fileUrl, path:cosFilePath};
        } catch (e) {
            error('Error downloading or uploading file:');
            error(e);
                  
        } finally {
            if(response){
                response.data = null; // 显式将 Buffer 对象设置为 null
            }
        }
    }
    return {};
}

