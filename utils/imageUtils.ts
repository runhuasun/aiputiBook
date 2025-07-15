// 后台程序
import sharp from 'sharp';
import axios from 'axios';
// @ts-ignore
import Raw from 'raw.js';
import path from 'path';
import { moveToFileServer, uploadDataToServer } from "./fileServer";
import * as fu from "./fileUtils";
import * as debug from "./debug";
import { EventEmitter } from 'events';
import { default as nFetch } from "node-fetch";
import {   RequestInit as NodeFetchRequestInit,  Response as NodeFetchResponse} from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Agent } from 'http';

import fileType from 'file-type';
import gm from 'gm';
import { promisify } from 'util';
import stream from 'stream';
const fs = require('fs');
import dcraw from 'dcraw';

import pLimit from 'p-limit';


/*​
 * 增强版智能 fetch：返回正确的 node-fetch Response 类型
 */
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:1080');

// 类型定义
interface RetryStrategy {
  maxAttempts?: number;
  backoffBase?: number;
  timeoutMs?: number;
  allowedMethods?: string[];
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

interface FetchConfig {
  fetchOptions: NodeFetchRequestInit;
  retryStrategy?: RetryStrategy;
}

// 类型导出
export type {
  NodeFetchRequestInit as FetchRequestInit,
  NodeFetchResponse as FetchResponse,
  FetchConfig,
  RetryStrategy
};

// 主函数
export async function nodefetch(
  url: string,
  config: FetchConfig = { fetchOptions: {} }
): Promise<NodeFetchResponse> {
  const strategy: Required<RetryStrategy> = {
    maxAttempts: 3,
    backoffBase: 1000,
    timeoutMs: 60000,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
      'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH',
      'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND', 'AbortError'
    ],
    ...config.retryStrategy
  };

  const {
    maxAttempts,
    backoffBase,
    timeoutMs,
    allowedMethods,
    retryableStatuses,
    retryableErrors
  } = strategy;

  const method = (config.fetchOptions.method || 'GET').toUpperCase();
  if (!allowedMethods.includes(method)) {
    return nFetch(url, config.fetchOptions); // ✅ 必须是 nodeFetch
  }

  let attempt = 0;
  let lastError: any;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const shouldUseProxy = attempt % 2 === 0;
      const agent: Agent | undefined = shouldUseProxy ? proxyAgent : undefined;
      const controller = new AbortController();

      const fetchOptions: NodeFetchRequestInit = {
        ...config.fetchOptions,
        agent,
        signal: controller.signal
      };

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const res = await nFetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (res.ok || !retryableStatuses.includes(res.status)) {
          return res;
        }

        throw new Error(`HTTP_${res.status}`);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      lastError = err;

      const isAbortError = err.name === 'AbortError' || err.type === 'aborted';

      const errorCode = err.message?.startsWith('HTTP_')
        ? err.message
        : (err?.code || (isAbortError ? 'AbortError' : 'UNKNOWN_ERROR'));

      const isRetryable =
        isAbortError ||
        retryableErrors.includes(errorCode) ||
        (errorCode.startsWith('HTTP_') &&
          retryableStatuses.includes(parseInt(errorCode.split('_')[1])));

      console.warn(`[nodefetch] attempt ${attempt} failed with error: ${errorCode}`);

      if (!isRetryable || attempt >= maxAttempts) {
        break;
      }

      const backoffDelay = Math.min(
        backoffBase * Math.pow(2, attempt - 1),
        30000
      );
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError || new Error(`Fetch failed after ${maxAttempts} attempts: ${url}`);
}



/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 常量定义
const CONCURRENCY_LIMIT = 4; 
const PROCESS_TIMEOUT = 30000; // 30秒超时
const RETRY_DELAY = 1000; // 1秒重试延迟
const MAX_RETRIES = 5; // 最大重试次数

/**​ 带重试的图片下载（含超时控制） */
async function fetchImageWithTimeout(url: string, timeout: number): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await nodefetch(url, {
            fetchOptions: {
                signal: controller.signal
            }
        });
        clearTimeout(timer);
        
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.statusText} (${url})`);
        }
        
        return await response.buffer();
    } catch (error) {
        clearTimeout(timer);
        throw error;
    }
}

/**​ 带重试的操作封装 */
async function withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number,
    delayMs: number
): Promise<T> {
    let attempt = 0;
    
    while (true) {
        try {
            return await operation();
        } catch (error:any) {
            attempt++;
            
            if (attempt >= maxRetries) {
                debug.warn(`${operationName} failed after ${maxRetries} attempts`);
                throw error;
            }
            
            debug.log(`${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

/**​ 超时控制工具函数 */
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    errorMsg = "Operation timed out"
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(errorMsg));
        }, ms);

        promise.then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

/**​ 处理单个叠加图片层 */
async function processImageLayer(
    img: { imageURL: string; x: number; y: number; width: number; height: number }
): Promise<sharp.OverlayOptions> {
    // 限制图片处理尺寸
    if (img.width > 2048 || img.height > 2048) {
        throw new Error(`Image dimensions too large (${img.width}x${img.height})`);
    }

    // 下载图片（带超时和自动重试）
    const buffer = await fetchImageWithTimeout(img.imageURL, 10000);

    return withTimeout<sharp.OverlayOptions>(
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await sharp(buffer).metadata();
                const originalWidth = metadata.width || 0;
                const originalHeight = metadata.height || 0;

                // 边界安全检查
                if (img.width > originalWidth || img.height > originalHeight) {
                    debug.warn(`Crop dimensions exceed source: ${img.imageURL}`);
                }

                const left = Math.max(0, Math.floor((originalWidth - img.width) / 2));
                const top = Math.max(0, Math.floor((originalHeight - img.height) / 2));

                const cropped = await sharp(buffer)
                    .extract({
                        left,
                        top,
                        width: Math.min(img.width, originalWidth),
                        height: Math.min(img.height, originalHeight)
                    })
                    .toBuffer();

                resolve({ 
                    input: cropped, 
                    left: img.x, 
                    top: img.y 
                });
            } catch (e) {
                reject(e);
            }
        }),
        15000,
        `Image processing timeout: ${img.imageURL}`
    );
}

export async function putImagesOnImage(
    image1: string,
    images: { imageURL: string; x: number; y: number; width: number; height: number }[],
    path: string = "T"
) {
    debug.log("putImagesOnImage started", { mainImage: image1, imageCount: images.length });
    
    try {
        // 主图获取（带重试机制）
        const buffer1 = await withRetry(
            () => fetchImageWithTimeout(image1, 10000),
            `Fetch main image ${image1}`,
            MAX_RETRIES,
            RETRY_DELAY
        );
        debug.log("Main image loaded", buffer1.length);

        // 使用并发控制处理叠加图片
        const limit = pLimit(CONCURRENCY_LIMIT);
        const compositePromises = images.map(img => 
            limit(() => 
                withRetry(
                    () => processImageLayer(img),
                    `Process layer ${img.imageURL}`,
                    MAX_RETRIES,
                    RETRY_DELAY
                ).catch(e => {
                    debug.warn(`Skipping image ${img.imageURL}:`, e.message);
                    return null;
                })
            )
        );

        const composites = (await Promise.all(compositePromises))
            .filter(Boolean) as sharp.OverlayOptions[];
            
        debug.log(`Valid composites: ${composites.length}/${images.length}`);

        // 主图处理（带超时）
        const resultBuffer = await withTimeout(
            sharp(buffer1).rotate().composite(composites).toBuffer(),
            PROCESS_TIMEOUT,
            'Main image processing timeout'
        );

        // 结果上传（带重试）
        const outputFileName = `${Date.now()}_composited.png`;
        const outputURL = await withRetry(
            () => withTimeout(
                uploadDataToServer(resultBuffer, "image/png", outputFileName, path),
                15000,
                'Upload timeout'
            ),
            `Upload final image`,
            MAX_RETRIES,
            RETRY_DELAY
        );

        debug.log("Image composition successful", outputURL);
        return outputURL;
    } catch (err: any) {
        debug.error("Critical failure:", err.message, err.stack);
        throw err;
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// 主函数：递归替换图片 URL 为 base64
export async function replaceImageURLsByBase64(obj: any, withPrefix: boolean = true):Promise<any>{
    if (typeof obj === 'string' && fu.isURL(obj) && (fu.getFileTypeByURL(obj)==="IMAGE")) { // 判断是否是一个对应图片的URL
        try {
            return await convertImageToBase64(obj, withPrefix);
        } catch (err) {
            debug.error(`转换失败: ${obj}`, err);
            return obj; // 失败时保留原值
        }
    } else if (Array.isArray(obj)) {
        const newArray = await Promise.all(obj.map(item => replaceImageURLsByBase64(item, withPrefix)));
        return newArray;
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = await replaceImageURLsByBase64(obj[key], withPrefix);
        }
        return newObj;
    } else {
        return obj;
    }
}


export async function convertImageToBase64(
    url: string,
    withPrefix: boolean = true
): Promise<string | null> {
    if (!url || !url.startsWith('http')) {
        return null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        // 将响应体转换为 Buffer
        const buffer = await response.arrayBuffer()
            .then(ab => Buffer.from(ab));
        
        const processedBuffer = await sharp(buffer)
            .jpeg({ quality: 80 })
            .toBuffer();
        
        const base64 = processedBuffer.toString('base64');
        
        // 根据 withPrefix 决定是否添加前缀
        return withPrefix 
            ? `data:image/jpeg;base64,${base64}`
            : base64;
    } catch (error) {
        debug.error('Error converting image to Base64:', error);
        return null;
    }
}
    
export async function converLocalImageToBase64(imgPath:string) {
    const data = fs.readFileSync(path.resolve(imgPath));
    return Buffer.from(data).toString('base64');
}   

// 获得图片的尺寸
// metadata.width && metadata.height
export async function getImageSize(imageURL: string): Promise<{ width: number; height: number } | null> {
    try {
        const meta = await getImageMeta(imageURL);
        if (meta?.width && meta?.height) {
            return {
                width: meta.width,
                height: meta.height,
            };
        }
    } catch (err) {
        debug.error("getImageSize exception:", err);
    }
    return null;
}

export async function getImageMeta(imageURL: string, maxRetries: number = 3): Promise<sharp.Metadata | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios({
                method: 'get',
                url: imageURL,
                responseType: 'arraybuffer',
                timeout: 10000, // 设置超时
            });

            return await sharp(response.data).metadata();
        } catch (error: unknown) {
            const err = error as any;
            debug.error(`getImageMeta attempt ${attempt} failed:`, err?.code || err?.message || err);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            } else {
                debug.error(`getImageMeta failed after ${maxRetries} attempts:`, imageURL);
            }
        }
    }

    return null;
}


// 把一张图片缩小到可以装到另外一个图片里
export async function resizeToBound(imageURL:string, boundURL:string){
    if(imageURL && boundURL){
        //处理图片，让它小于等于背景尺寸
        let imgSize = await getImageSize(imageURL);
        debug.log("imgSize:", imageURL, JSON.stringify(imgSize));
        let bgSize = await getImageSize(boundURL);
        debug.log("bgSize:", boundURL, JSON.stringify(bgSize));
        if(imgSize && bgSize){
            let newWidth = imgSize.width;
            let newHeight = imgSize.height;
            if(imgSize.width > bgSize.width){
                newWidth = bgSize.width;
                newHeight = Math.round(imgSize.height * (newWidth / imgSize.width));
            }
            if(newHeight > bgSize.height){
                newHeight = bgSize.height;
                newWidth = Math.round(imgSize.width * (newHeight / imgSize.height));
            }
    
            if(newWidth < imgSize.width || newHeight < imgSize.height){
                debug.log("new Size:", newWidth, newHeight);
                return await resizeImageToSizeBound(imageURL, {width:newWidth, height:newHeight});        
            }
        }
    }
    return imageURL;
}

// 把一张图片缩小到指定大小，只是确保在这个范围，不保证宽高都合适
async function resizeImageToSizeBound(inputUrl:string, newSize:{width:number, height:number}) {
    try{
        let newBuffer:any;
        
        const response = await axios({
            url: inputUrl,
            responseType: 'arraybuffer'
        });
        const inputBuffer = Buffer.from(response.data);

        const image = sharp(inputBuffer);   
        debug.log("resizeImageToSize:", newSize.width, newSize.height);
        const outputBuffer = await image
            .rotate()  // 自动根据 EXIF 旋转图像
            .resize(newSize.width, newSize.height, {fit:'inside'})// 确保图片完整地缩放进这个区域内
            .toBuffer();
        debug.log('Image resized appropriately.');
        
        const ext = fu.getFileExtFromURL(inputUrl);
        const mime = fu.getMimeByExt(ext || "jpg");
        const newFileName = `${Date.now().toString()}.${ext}`;
        const newImageURL = await uploadDataToServer(outputBuffer, mime!, newFileName, "T");
        debug.log("new image resized:" + newImageURL);   
        
        return newImageURL;
    }catch(err){
        debug.error("resizeImageToSize:", err);
    }
}


// 让图片和目标图片一样大
export async function makeImageSameSize(inputURL:string, targetURL:string){
    try{
        // 如果已经是目标大小就返回原图
        const inputSize = await getImageSize(inputURL);
        const targetSize = await getImageSize(targetURL);
        if(inputSize && targetSize){
            if(inputSize.width == targetSize.width && inputSize.height == targetSize.height){
                return inputURL;
            }else{
                return await resizeImageToSize(inputURL, targetSize);                
            }
        }

    }catch(err){
        debug.error("makeImageSameSize:", err);
    }
}

// 把一张图片强制缩放到指定大小，无论比目标尺寸大还是小，宽高也要和目标尺寸一样
export async function resizeImageToSize(inputUrl:string, newSize:{width:number, height:number}, folder:string="T") {
    try{
        // 如果已经是目标大小就返回原图
        const inputSize = await getImageSize(inputUrl);
        if(inputSize && inputSize.width == newSize.width && inputSize.height == newSize.height){
            return inputUrl;
        }
        
        let newBuffer:any;
        
        const response = await axios({
            url: inputUrl,
            responseType: 'arraybuffer'
        });
        const inputBuffer = Buffer.from(response.data);

        const image = sharp(inputBuffer);   
        debug.log("resizeImageToSize:", newSize.width, newSize.height);
        const outputBuffer = await image
            .rotate()  // 自动根据 EXIF 旋转图像
            .resize(newSize.width, newSize.height, {fit:'fill'})// 强制缩放到指定尺寸
            .toBuffer();
       
        const ext = fu.getFileExtFromURL(inputUrl);
        const mime = fu.getMimeByExt(ext || "jpg");
        const newFileName = `${Date.now().toString()}.${ext}`;
        const newImageURL = await uploadDataToServer(outputBuffer, mime!, newFileName, folder);
        debug.log(inputUrl, " resized to: ", newImageURL);   
        
        return newImageURL;
    }catch(err){
        debug.error("resizeImageToSize:", err);
    }
}


// 把一张图片的尺寸，等比例缩小到不大于maxWidth, maxHeight
// 不是把图片压缩成newSize*newSize，而是说，如果图片小于newSize*newSize就直接返回图片，如果宽度大于高度，并且宽度大于newSize，
// 就把宽度压缩成newSize，然后高度等比压缩。如果高度大于宽度，并且高度大于newSize，就把高度压缩成newSize，宽度等比缩小
export async function resizeImage(inputUrl:string, newSize:number) {
    try {
        let newBuffer:any;
        
        const response = await axios({
            url: inputUrl,
            responseType: 'arraybuffer'
        });
        const inputBuffer = Buffer.from(response.data);

        const image = sharp(inputBuffer);
        const metadata = await image.metadata();

        if(metadata && metadata.width && metadata.height){
            let newWidth, newHeight;
            if (metadata.width <= newSize && metadata.height <= newSize) {
                return inputUrl;  // 如果图片已经小于newSize*newSize，直接返回原图
            }else{
                if (metadata.width > metadata.height) {
                    if (metadata.width > newSize) {
                        newWidth = newSize;
                        newHeight = Math.round((metadata.height / metadata.width) * newWidth);
                    } else {
                        newWidth = metadata.width;
                        newHeight = metadata.height;
                    }
                } else {
                    if (metadata.height > newSize) {
                        newHeight = newSize;
                        newWidth = Math.round((metadata.width / metadata.height) * newHeight);
                    } else {
                        newWidth = metadata.width;
                        newHeight = metadata.height;
                    }
                }
                const outputBuffer = await image
                    .rotate()  // 自动根据 EXIF 旋转图像
                    .resize(newWidth, newHeight, {fit:'inside'})// 确保图片完整地缩放进这个区域内
                    .toBuffer();
                debug.log('Image resized appropriately.');

                const ext = fu.getFileExtFromURL(inputUrl);
                const mime = fu.getMimeByExt(ext || "jpg");
                const newFileName = `${Date.now().toString()}.${ext}`;
                const newImageURL = await uploadDataToServer(outputBuffer, mime!, newFileName, "T");
                debug.log("new image resized:" + newImageURL);   
                return newImageURL;
            }
        }else{
            return inputUrl;
        }
    } catch (err) {
        debug.error("resizeImage:", err);
    }
}


// 把一张图片的高度调整为目标图片的高度，宽度按比例缩放
export async function resizeToSameHeight(imageURL: string, targetURL: string) {
  try {
    let newBuffer: any;

    // 下载输入图片
    const imageResponse = await axios({
      url: imageURL,
      responseType: "arraybuffer",
    });
    const inputBuffer = Buffer.from(imageResponse.data);

    // 下载目标图片以获取其高度
    const targetResponse = await axios({
      url: targetURL,
      responseType: "arraybuffer",
    });
    const targetBuffer = Buffer.from(targetResponse.data);
    const targetMetadata = await sharp(targetBuffer).metadata();
    const targetHeight = targetMetadata.height;

    if (!targetHeight) {
      throw new Error("Failed to retrieve target image height.");
    }

    debug.log("resizeToSameHeight:", targetHeight);

    // 调整输入图片高度，并保持宽高比
    const resizedBuffer = await sharp(inputBuffer)
      .rotate() // 自动旋转
      .resize({ height: targetHeight, fit: "inside" }) // 高度对齐，宽度按比例缩放
      .toBuffer();
    debug.log("Image resized to match target height.");

    // 获取文件扩展名和 MIME 类型
    const ext = fu.getFileExtFromURL(imageURL);
    const mime = fu.getMimeByExt(ext || "jpg");
    const newFileName = `${Date.now().toString()}.${ext}`;
    const newImageURL = await uploadDataToServer(
      resizedBuffer,
      mime!,
      newFileName,
      "T"
    );

    debug.log("Resized image URL:", newImageURL);

    return newImageURL;
  } catch (err) {
    debug.error("resizeToSameHeight error:", err);
    throw err; // 抛出错误以便调用方处理
  }
}


export async function concatImage(leftURL: string, rightURL: string) {
  try {
    // 下载左侧图片
    const leftResponse = await axios({ url: leftURL, responseType: "arraybuffer" });
    const leftBuffer = Buffer.from(leftResponse.data);

    // 下载右侧图片
    const rightResponse = await axios({ url: rightURL, responseType: "arraybuffer" });
    const rightBuffer = Buffer.from(rightResponse.data);

    // 获取左侧图片的元数据
    const leftMetadata = await sharp(leftBuffer).metadata();
    const leftHeight = leftMetadata.height;
    const leftWidth = leftMetadata.width;

    if (!leftHeight || !leftWidth) {
      throw new Error("Failed to retrieve valid metadata from left image.");
    }

    // 调整右侧图片的高度与左侧一致
    const resizedRightBuffer = await sharp(rightBuffer)
      .rotate() // 自动旋转
      .resize({ height: leftHeight, fit: "inside" }) // 高度调整，宽度自动按比例缩放
      .toBuffer();

    // 获取右侧图片的元数据
    const rightMetadata = await sharp(resizedRightBuffer).metadata();
    const rightWidth = rightMetadata.width;

    if (!rightWidth) {
      throw new Error("Failed to retrieve valid metadata from resized right image.");
    }

    // 拼接图片
    const concatenatedBuffer = await sharp({
      create: {
        width: leftWidth + rightWidth,
        height: leftHeight,
        channels: 3, // JPG 不支持透明背景，因此使用 3 通道
        background: { r: 255, g: 255, b: 255 }, // 白色背景
      },
    })
      .composite([
        { input: leftBuffer, top: 0, left: 0 },
        { input: resizedRightBuffer, top: 0, left: leftWidth },
      ])
      .jpeg({ quality: 90 }) // 指定 JPG 格式和质量
      .toBuffer();

    // 上传拼接后的图片
    const newFileName = `${Date.now()}.jpg`;
    const newImageURL = await uploadDataToServer(
      concatenatedBuffer,
      "image/jpeg", // MIME 类型为 JPG
      newFileName,
      "T"
    );

    return newImageURL;
  } catch (err) {
    debug.error("concatImage error:", err);
    throw err; // 抛出错误以便调用方处理
  }
}

// 根据 templateURL 的大小，从 imageURL 的左上角裁剪出对应尺寸的一块图像
export async function cutImage(imageURL: string, templateURL: string) {
    // 下载目标图像
    const imageResponse = await axios({ method: "get", url: imageURL, responseType: "arraybuffer" });
    const targetImage = sharp(imageResponse.data);

    // 获取目标图像的元数据
    const targetMetadata = await targetImage.metadata();

    // 下载模板图像
    const templateResponse = await axios({ method: "get", url: templateURL, responseType: "arraybuffer" });
    const templateImage = sharp(templateResponse.data);

    // 获取模板图像的元数据
    const templateMetadata = await templateImage.metadata();

    // 检查模板大小是否大于目标图像大小
    if (
        templateMetadata.width! > targetMetadata.width! ||
        templateMetadata.height! > targetMetadata.height!
    ) {
        throw new Error("Template dimensions exceed the target image dimensions.");
    }

    // 裁剪图像
    const croppedImageBuffer = await targetImage
        .extract({
            left: 0,
            top: 0,
            width: templateMetadata.width!,
            height: templateMetadata.height!,
        })
        .toBuffer();

    // 保存裁剪后的图像并返回其 URL
    const newFileName = Date.now().toString() + "_cropped_image.png";
    const croppedImageURL = await uploadDataToServer(croppedImageBuffer, "image/png", newFileName, "T");

    return croppedImageURL;
}


export async function cutRectFromImage(
imageURL: string,
rect: { top: number; left: number; width: number; height: number }
) {
    // 用 nodefetch 获取图像数据
    const response = await nodefetch(imageURL, {
        fetchOptions: {
            method: "GET",
        },
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // 获取 buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 加载并旋转图像
    const targetImage = sharp(buffer).rotate();
    
    // 获取元信息
    const metadata = await targetImage.metadata();
    const imageWidth = metadata.width!;
    const imageHeight = metadata.height!;
    
    // 修正 rect
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const width = Math.min(rect.width, imageWidth - left);
    const height = Math.min(rect.height, imageHeight - top);
    
    if (width <= 0 || height <= 0) {
        throw new Error("Rect dimensions are invalid after adjustment.");
    }
    
    // 裁剪图像
    const croppedImageBuffer = await targetImage
        .extract({
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
        })
        .toBuffer();
    
    // 上传图像并返回新地址
    const newFileName = `${Date.now()}_cropped_image.png`;
    const croppedImageURL = await uploadDataToServer(
        croppedImageBuffer,
        "image/png",
        newFileName,
        "T"
    );
    
    return croppedImageURL;
}


// imageURL和maskURL尺寸一样，maskURL是一个黑白二值的PNG遮罩。根据maskURL的白色区域，从imageURL上截取部分图像，maskURL黑色区域对应的部分仍然为黑色
// 当alpha为真时，黑色部分变为透明
export async function cutImageByMask(imageURL: string, maskURL: string, alpha: boolean = false) {
    try {
        debug.log(`start to cutImageByMask: ${imageURL}, by: ${maskURL}, alpha=${alpha}`);

        // 下载原图和遮罩图
        const [imageRes, maskRes] = await Promise.all([
            axios({ method: "get", url: imageURL, responseType: "arraybuffer" }),
            axios({ method: "get", url: maskURL, responseType: "arraybuffer" }),
        ]);

        const image = sharp(imageRes.data).rotate().ensureAlpha();
        const mask = sharp(maskRes.data).rotate().removeAlpha().greyscale();

        const metadata = await image.metadata();
        const { width, height } = metadata;
        if (!width || !height) throw new Error("Invalid image metadata");

        if (alpha) {
            // 获取 RGBA 图像和 mask 灰度图
            const rgbaBuffer = await image.raw().toBuffer(); // 4 通道 RGBA
            const alphaBuffer = await mask.raw().toBuffer(); // 灰度（单通道）

            // 合成 alpha 图像
            const finalBuffer = mergeAlpha(rgbaBuffer, alphaBuffer, width, height);

            // 输出为 PNG
            const outputBuffer = await sharp(finalBuffer, {
                raw: { width, height, channels: 4 },
            }).png().toBuffer();

            const newFileName = Date.now().toString() + "_cut_transparent.png";
            const outputURL = await uploadDataToServer(outputBuffer, "image/png", newFileName, "T");

            debug.log(`cutImageByMask (transparent) created: ${outputURL}`);
            return outputURL;
        } else {
            // 不透明模式：白色区域显示图像，黑色区域显示为黑色
            const maskBuffer = await mask.raw().toBuffer();
            const rgbaBuffer = await image.raw().toBuffer();
            const finalBuffer = mergeBlackMask(rgbaBuffer, maskBuffer, width, height);

            const outputBuffer = await sharp(finalBuffer, {
                raw: { width, height, channels: 4 },
            }).png().toBuffer();

            const newFileName = Date.now().toString() + "_cut_black.png";
            const outputURL = await uploadDataToServer(outputBuffer, "image/png", newFileName, "T");

            debug.log(`cutImageByMask (black fill) created: ${outputURL}`);
            return outputURL;
        }
    } catch (err) {
        debug.error("cutImageByMask exception:", err);
        throw err;
    }
}

// 合成带透明区域的图像
function mergeAlpha(rgbaBuffer: Buffer, alphaBuffer: Buffer, width: number, height: number): Buffer {
    const out = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        out[i * 4 + 0] = rgbaBuffer[i * 4 + 0]; // R
        out[i * 4 + 1] = rgbaBuffer[i * 4 + 1]; // G
        out[i * 4 + 2] = rgbaBuffer[i * 4 + 2]; // B
        out[i * 4 + 3] = alphaBuffer[i];        // A (直接使用灰度图作为 alpha)
    }
    return out;
}

// 合成黑色填充区域图像（mask 黑色区域置为黑色）
function mergeBlackMask(rgbaBuffer: Buffer, maskBuffer: Buffer, width: number, height: number): Buffer {
    const out = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const maskValue = maskBuffer[i]; // 灰度值（0~255）
        const keep = maskValue > 127; // 白色区域保留，黑色区域清除
        if (keep) {
            out[i * 4 + 0] = rgbaBuffer[i * 4 + 0];
            out[i * 4 + 1] = rgbaBuffer[i * 4 + 1];
            out[i * 4 + 2] = rgbaBuffer[i * 4 + 2];
            out[i * 4 + 3] = 255;
        } else {
            out[i * 4 + 0] = 0;
            out[i * 4 + 1] = 0;
            out[i * 4 + 2] = 0;
            out[i * 4 + 3] = 255;
        }
    }
    return out;
}


// 判断一张图片是否是纯白色的遮罩，意味着什么也没有遮挡
export async function isWhiteMask(imageURL:string){
    try {
        const response = await axios({
            method: "get",
            url: imageURL,
            responseType: "arraybuffer",
        });

        const image = sharp(response.data).ensureAlpha(); // 确保有 alpha 通道
        const { width, height, channels } = await image.metadata();

        if (!width || !height || !channels || channels < 4) {
            throw new Error("Invalid image format or missing alpha channel");
        }

        // 获取 RGBA 原始像素数据
        const raw = await image.raw().toBuffer(); // 每个像素 4 字节（R,G,B,A）

        for (let i = 0; i < raw.length; i += 4) {
            const r = raw[i];
            const g = raw[i + 1];
            const b = raw[i + 2];
            const a = raw[i + 3];

            // 如果不是白色或不是完全不透明，立即返回 false
            if (r !== 255 || g !== 255 || b !== 255 || a !== 255) {
                return false;
            }
        }

        return true; // 所有像素都是白色且完全不透明
    } catch (err) {
        debug.error("isWhiteMask exception:", err);
        return false;
    }    
}

// 判断一张图片是否是空遮罩，也就是纯白、纯黑或者完全透明
export async function isEmptyMask(imageURL:string){
    try {
        const response = await axios({
            method: "get",
            url: imageURL,
            responseType: "arraybuffer",
        });

        const image = sharp(response.data).ensureAlpha(); // 确保有 alpha 通道
        const { width, height, channels } = await image.metadata();

        if (!width || !height || !channels || channels < 4) {
            throw new Error("Invalid image format or missing alpha channel");
        }

        const raw = await image.raw().toBuffer(); // RGBA 格式，4 通道

        let isAllWhite = true;
        let isAllBlack = true;
        let isAllTransparent = true;

        for (let i = 0; i < raw.length; i += 4) {
            const r = raw[i];
            const g = raw[i + 1];
            const b = raw[i + 2];
            const a = raw[i + 3];

            // 判断是否完全透明
            if (a !== 0) isAllTransparent = false;

            // 判断是否纯白（必须不透明 + RGB = 255）
            if (!(r === 255 && g === 255 && b === 255 && a === 255)) isAllWhite = false;

            // 判断是否纯黑（必须不透明 + RGB = 0）
            if (!(r === 0 && g === 0 && b === 0 && a === 255)) isAllBlack = false;

            // 提前退出优化
            if (!isAllWhite && !isAllBlack && !isAllTransparent) {
                return false;
            }
        }

        return isAllWhite || isAllBlack || isAllTransparent;
    } catch (err) {
        debug.error("isEmptyMask exception:", err);
        return false;
    }
}

// 生成方行的MASK
export async function generateRectMaskImage(imgWidth:number, imgHeight:number, rectLeft:number, rectTop:number, rectWidth:number, rectHeight:number, reverse:boolean=false){
    // 定义图片尺寸和颜色
    const width = imgWidth;
    const height = imgHeight;

    const maskImage = Buffer.alloc(width * height * 4); // 创建黑色背景（0, 0, 0, 255）

    // 填充整个 Buffer
    for (let i = 0; i < maskImage.length; i += 4) {
        maskImage[i] = reverse ? 255 : 0;       // R
        maskImage[i + 1] = reverse ? 255 : 0;   // G
        maskImage[i + 2] = reverse ? 255 : 0;   // B
        maskImage[i + 3] = 255;                 // Alpha
    }

    // 定义需要改变颜色的区域
    const rect = {
        x: rectLeft,
        y: rectTop,
        width: rectWidth,
        height: rectHeight,
    };

    // 填充矩形区域为白色或黑色，取决于反色设置
    for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
            const index = (y * width + x) * 4;
            maskImage[index] = reverse ? 0 : 255;       // R
            maskImage[index + 1] = reverse ? 0 : 255;   // G
            maskImage[index + 2] = reverse ? 0 : 255;   // B
            maskImage[index + 3] = 255;                 // Alpha
        }
    }

    // 使用 Sharp 创建 PNG 图片
    const maskFileName = Date.now().toString() + "_mask.png";
    const maskImageBuffer = await sharp(maskImage, { raw: { width, height, channels: 4 } })
        .png({ compressionLevel: 9 }) // 最大压缩级别
        .toBuffer();

    // 调试信息
    debug.log("Generated mask image buffer length: " + maskImage.length);
    debug.log("First few bytes of mask image buffer: ", maskImage.slice(0, 20));

    // 上传图片并返回 URL
    const maskImageURL = await uploadDataToServer(maskImageBuffer, "image/png", maskFileName, "T");
    debug.log("Mask image generated:" + maskImageURL);

    return maskImageURL; 
}


// 扩展 maskURL 成与 imageURL 一样大，新增部分填充为黑色
export async function enlargeMask(maskURL: string, imageURL: string) {
    // 下载掩码图像
    const maskResponse = await axios({ method: 'get', url: maskURL, responseType: 'arraybuffer' });
    const maskImage = sharp(maskResponse.data);

    // 获取掩码图像的元数据
    const maskMetadata = await maskImage.metadata();

    // 下载目标图像
    const imageResponse = await axios({ method: 'get', url: imageURL, responseType: 'arraybuffer' });
    const targetImage = sharp(imageResponse.data);

    // 获取目标图像的元数据
    const targetMetadata = await targetImage.metadata();

    // 计算扩展后的宽度和高度
    const newWidth = targetMetadata.width!;
    const newHeight = targetMetadata.height!;

    // 如果掩码已经符合目标图像尺寸，则直接返回
    if (maskMetadata.width === newWidth && maskMetadata.height === newHeight) {
        return maskURL; // 已经是目标尺寸，无需扩展
    }

    // 将掩码标准化为单通道黑白图像（确保黑白）
    const standardizedMask = await maskImage
        .toColourspace('b-w') // 转换为黑白（灰度）
        .raw()
        .toBuffer();

    // 创建一个新的缓冲区，填充为黑色（0 表示黑色）
    const newMaskBuffer = Buffer.alloc(newWidth * newHeight, 0);

    // 将掩码合并到新的黑色图像中
    const enlargedMaskBuffer = await sharp(newMaskBuffer, {
        raw: {
            width: newWidth,
            height: newHeight,
            channels: 1 // 单通道黑白图像
        }
    }).composite([{
        input: standardizedMask,
        top: 0,
        left: 0,
        raw: {
            width: maskMetadata.width!,
            height: maskMetadata.height!,
            channels: 1
        }
    }]).png().toBuffer();

    // 保存新掩码图像并返回其 URL
    const newFileName = Date.now().toString() + "_enlarged_mask.png";
    const newMaskURL = await uploadDataToServer(enlargedMaskBuffer, "image/png", newFileName, "M");

    return newMaskURL;
}



// 把一个MASK反转颜色
export async function reverseMaskImage(maskImageURL: string) {
    const response = await axios({
        method: 'get',
        url: maskImageURL,
        responseType: 'arraybuffer'
    });

    const buffer = await sharp(response.data).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

    const { data, info } = buffer;
    const { width, height, channels } = info;
    const newData = Buffer.alloc(width * height * channels);

    for (let i = 0; i < width * height * channels; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 判定当前颜色是黑色还是白色
        if (r === 0 && g === 0 && b === 0) {
            // 当前像素是黑色，转换为白色
            newData[i] = 255;       // R
            newData[i + 1] = 255;   // G
            newData[i + 2] = 255;   // B
            newData[i + 3] = 255;   // A
        } else {
            // 当前像素是白色或其他颜色，转换为黑色
            newData[i] = 0;         // R
            newData[i + 1] = 0;     // G
            newData[i + 2] = 0;     // B
            newData[i + 3] = 255;   // A
        }
    }

    const reverseMaskFileName = Date.now().toString() + "_reverse_mask.png";
    const reverseMaskImageBuffer = await sharp(newData, { raw: { width, height, channels } }).png().toBuffer();

    // 假设 `uploadDataToServer` 为将图像上传到服务器的函数，需要自行实现
    const reverseMaskImageURL = await uploadDataToServer(reverseMaskImageBuffer, "image/png", reverseMaskFileName, "T");
    
    return reverseMaskImageURL;
}


// 从透明PNG生成一个MASK，将有图像的部分变成白色，无图像的部分变成黑色
export async function generateMaskImageFromPNG(pngURL:string){
    
    const response = await axios({
        method: 'get',
        url: pngURL,
        responseType: 'arraybuffer'
    });
    
    const buffer = await sharp(response.data).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

    const {data, info} = buffer;
    const { width, height, channels } = info;
    const newData = Buffer.alloc(width * height * channels);

    for (let i = 0; i < width * height * channels; i += channels) {
        const alpha = data[i + 3];
        if (alpha > 0) {
            // 有图像的部分（alpha > 0），设为白色
            newData[i] = 255;       // R
            newData[i + 1] = 255;   // G
            newData[i + 2] = 255;   // B
            newData[i + 3] = 255;   // A
        } else {
            // 无图像的部分（alpha == 0），设为黑色
            newData[i] = 0;         // R
            newData[i + 1] = 0;     // G
            newData[i + 2] = 0;     // B
            newData[i + 3] = 255;   // A
        }
    }

    const maskFileName = Date.now().toString() + "_mask.png";
    const maskImageBuffer = sharp(newData, { raw: { width, height, channels } }).png();
    debug.log("Generated mask image buffer length: " + newData.length);
    debug.log("First few bytes of mask image buffer: ", newData.slice(0, 20));    
    
    const maskImageURL = await uploadDataToServer(maskImageBuffer, "image/png", maskFileName, "T");
    debug.log("mask image generated:" + maskImageURL);
    return maskImageURL;
}


// 给一个四通道的PNG文件A的URL，生成一个新的四通道PNG文件B，已知新图片B的长度和宽度，以及A在B的位置X，Y
export async function enlargePNG(pngURL:string, startX:number, startY:number, newWidth:number, newHeight:number){
    // 下载图像A
    const response = await axios({method: 'get', url: pngURL, responseType: 'arraybuffer'});
    const inputImage = sharp(response.data);

    // 获取输入图像的元数据
    const metadata = await inputImage.metadata();
    // 提取图像A的部分（假设从(0, 0)开始，大小为整个图像）    
    const pngBuffer = await inputImage.extract({ left: 0, top: 0, width: metadata.width!, height: metadata.height! }).toBuffer();

    // 创建一个新图像B，初始内容为透明
    const newData = Buffer.alloc(newWidth * newHeight * 4, 0); // 4通道（RGBA）

    const newFileName = Date.now().toString() + "_tmp.png";
    const newImageBuffer = sharp(newData, {
        raw: {
            width: newWidth,
            height: newHeight,
            channels: 4
        }
    }).composite([{
        input: pngBuffer,
        top: startY,
        left: startX
    }]).png();
    debug.log("Generated new image buffer length: " + newData.length);
    debug.log("First few bytes of new image buffer: ", newData.slice(0, 20));    
    
    const newImageURL = await uploadDataToServer(newImageBuffer, "image/png", newFileName, "T");
    debug.log("new image generated:" + newImageURL);
    return newImageURL;
    

}


// 生成指定大小和颜色的单色图片
export async function generateSolidColorImage(imgWidth: number, imgHeight: number, color: {r: number, g: number, b: number, alpha?: number}, 
                                              format: 'jpeg' | 'jpg' | 'png' = 'jpeg') {
    let mime:string = "image/jpg";
    let ext:string = "jpg";
    switch(format){
        case 'jpg':
            format = 'jpeg';
        case 'jpeg':
            mime = "image/jpeg";
            ext = "jpg";
            break;
        case 'png':
            mime = "image/png";
            ext = "png";
    }
    // 定义图片尺寸和颜色
    const width = imgWidth;
    const height = imgHeight;
    const { r, g, b, alpha = 1 } = color;  // 解构颜色和alpha值（不传递alpha时默认为1）

    // 创建一个 Buffer 用于存储图片数据，初始全部设置为透明
    const imageBuffer = Buffer.alloc(width * height * 4, 0);

    // 填充整个 Buffer 为指定颜色
    for (let i = 0; i < imageBuffer.length; i += 4) {
        imageBuffer[i] = r;      // R
        imageBuffer[i + 1] = g;  // G
        imageBuffer[i + 2] = b;  // B
        imageBuffer[i + 3] = Math.round(alpha * 255); // Alpha (0-255)
    }

    // 使用 Sharp 生成输出图像
    try {
        const buffer = await sharp(imageBuffer, {
            raw: {
                width,
                height,
                channels: 4
            }
        })[format]({
            quality: 90  // 如果是JPEG格式，设置压缩质量
        })
        .toBuffer();

        const newImageURL = await uploadDataToServer(buffer, "image/jpg", `image_${Date.now()}.` + ext, "T");
        debug.log("generateSolidColorImage generated:" + newImageURL);
        return newImageURL;
    } catch (error) {
        debug.error('Error generating image:', error);
        throw error;
    }
}


// image1和image2是两张图片的URL，image2的长宽小于image1。把image2像素级复制到image1上，给定的x, y是image2在image1上左上角的位置，width, height是image2的宽度和高度
/*
export async function putImagesOnImage(
    image1: string,
    images: { imageURL: string; x: number; y: number; width: number; height: number }[],
    path: string = "T"
) {
    debug.log("putImagesOnImage:", image1, JSON.stringify(images));
    
    try {
        // 获取 image1 的数据
        const data1 = await nodefetch(image1);
        debug.log("putImagesOnImage length:", data1?.length);

        if (data1.ok) {
            const buffer1 = await data1.buffer();
            debug.log("putImagesOnImage buffer1 length:", buffer1?.length);

            // 创建一个数组，用于存放所有需要叠加的图像配置
            const composites = (
                await Promise.all(
                    images.map(async ({ imageURL, x, y, width, height }) => {
                        const data = await nodefetch(imageURL);
                        if (data.ok) {
                            const buffer = await data.buffer();

                            // 使用 sharp 对图像进行自动旋转和中心裁剪
                            const croppedBuffer = await sharp(buffer)
                                .rotate() // 根据 EXIF 自动旋转
                                .metadata()
                                .then(({ width: originalWidth, height: originalHeight }) => {
                                    if (!originalWidth || !originalHeight) {
                                        throw new Error("Unable to get image dimensions");
                                    }

                                    // 计算中心裁剪的起始点
                                    const left = Math.max(0, Math.floor((originalWidth - width) / 2));
                                    const top = Math.max(0, Math.floor((originalHeight - height) / 2));

                                    return sharp(buffer)
                                        .extract({
                                            left,
                                            top,
                                            width: Math.min(width, originalWidth),
                                            height: Math.min(height, originalHeight),
                                        })
                                        .toBuffer();
                                });

                            return { input: croppedBuffer, left: x, top: y };
                        }
                        return null; // 若请求失败，返回 null
                    })
                )
            ).filter((item): item is NonNullable<typeof item> => item !== null); // 过滤掉 null

            // 使用 composite 方法叠加所有图像
            const resultBuffer = await sharp(buffer1).rotate().composite(composites).toBuffer();

            // 上传结果并返回 URL
            const outputFileName = Date.now().toString() + "_composited.png";
            const outputURL = await uploadDataToServer(resultBuffer, "image/png", outputFileName, path);
            debug.log("putImagesOnImage image generated: " + outputURL);
            return outputURL;
        }
    } catch (err) {
        debug.error("putImagesOnImage exception:", image1, JSON.stringify(images), err);
    }
}
*/



// mask1和mask2的URL是两个一样大小的PNG格式遮罩MASK图片。通过函数生成一个新的MASK图片，包含mask1和mask2的白色区域
export async function combineMasks(mask1:string, mask2:string){
    try {
        // 获取 mask1 的数据
        const data1 = await nodefetch(mask1);
        let buffer1;
        
        if (data1.ok) {
            buffer1 = await data1.buffer();
        } else {
            throw new Error(`Failed to fetch ${mask1}`);
        }

        // 获取 mask2 的数据
        const data2 = await nodefetch(mask2);
        let buffer2;

        if (data2.ok) {
            buffer2 = await data2.buffer();
        } else {
            throw new Error(`Failed to fetch ${mask2}`);
        }

        // 使用 composite 方法结合两个遮罩的白色区域
        // 注意：考虑到这里处理的都是遮罩图片，我们需要将两者合并的方式设置为 'over'
        const resultBuffer = await sharp(buffer1)
            .composite([{ input: buffer2, blend: 'screen' }])  // 使用 'screen' 混合模式来合并白色区域
            .toColourspace('b-w') // 转换为黑白图片，以确保最终是遮罩样式
            .toBuffer();

        // 上述步骤完成后，resultBuffer中存储了合并后的遮罩图
        // 接下来，根据你的需求上传resultBuffer到服务，并获取一个URL

        // 上传结果并返回 URL
        const outputFileName = `combined_mask_${Date.now()}.png`; 
        // 假定 uploadDataToServer 是一个函数，用来将给定的buffer上传到服务器
        const outputURL = await uploadDataToServer(resultBuffer, "image/png", outputFileName, "T");
        
        debug.log("combineMasks mask generated: " + outputURL);
        return outputURL;
    } catch (err) {
        debug.error("combineMasks exception:", err);
    }   
}


// mask1和mask2的URL是两个一样大小的黑白二值遮罩MASK图片。通过函数把mask2的白色区域的点在mask1上对应的点改成黑色，mask2黑色区域的点在mask1上对应的点仍然保持mask1原有的色值
export async function maskDeductMask(mask1:string, mask2:string){
    try{
        const data1 = await nodefetch(mask1);
        const data2 = await nodefetch(mask2);

        if(data1.ok && data2.ok){
            const buffer1 = await data1.buffer();
            const buffer2 = await data2.buffer();
            // 获取 mask1 和 mask2 的原始像素数据
            const image1 = await sharp(buffer1).raw().toBuffer({ resolveWithObject: true });
            const image2 = await sharp(buffer2).raw().toBuffer({ resolveWithObject: true });

            // 检查两图是否尺寸一致
            if (image1.info.width !== image2.info.width || image1.info.height !== image2.info.height) {
                throw new Error("mask1 and mask2 must have the same dimensions");
            }

            const width = image1.info.width;
            const height = image1.info.height;
            const channels1 = image1.info.channels; // mask1 的通道数
            const channels2 = image2.info.channels; // mask2 的通道数

            // 创建一个新的缓冲区来存储结果，初始为 mask1 的像素数据
            const outputBuffer = Buffer.from(image1.data);  

            // 遍历每个像素，根据 mask2 的白色区域将 mask1 的对应像素改为黑色
            for (let i = 0; i < image1.data.length; i += channels1) {
                // 使用 % 运算符处理 mask2 的通道数
                const mask2PixelIndex = Math.floor(i / channels1) * channels2; // 当前像素对应在 mask2 中的起始索引

                // 检查 mask2 像素是否为白色（假设二值图像：255 为白色，0 为黑色）
                if (image2.data[mask2PixelIndex] > 0) {  // 只访问第一个通道，只要是不是绝对黑，都算是mask
                    // 将 mask1 的对应像素设为黑色
                    outputBuffer[i] = 0;   // 修改红色通道
                    if (channels1 > 1) {
                        outputBuffer[i + 1] = 0; // 修改绿色通道
                        if (channels1 > 2) {
                            outputBuffer[i + 2] = 0; // 修改蓝色通道
                        }
                        // 如果 mask1 是 RGBA，则保持透明度通道不变
                    }
                }else{
                   /*
                    // 将image1当中不是绝对黑的部分设为绝对白
                    outputBuffer[i] = image1.data[i] > 0 ? 255 : 0;   // 修改红色通道
                    if (channels1 > 1) {
                        outputBuffer[i + 1] = image1.data[i+1] > 0 ? 255 : 0; // 修改绿色通道
                        if (channels1 > 2) {
                            outputBuffer[i + 2] = image1.data[i+2] > 0 ? 255 : 0; // 修改蓝色通道
                        }
                        // 如果 mask1 是 RGBA，则保持透明度通道不变
                    }
                    */
                }
            }

            // 将修改后的缓冲区转回 PNG 格式
            const resultBuffer = await sharp(outputBuffer, {
                raw: {
                    width,
                    height,
                    channels: channels1 // 输出使用 mask1 的通道数
                }
            }).toFormat('png').toBuffer();
            
            const maskFileName = Date.now().toString() + "_mask.png";
            const maskImageURL = await uploadDataToServer(resultBuffer, "image/png", maskFileName, "T");
            debug.log("maskDeductMask image generated:" + maskImageURL);
            return maskImageURL;
        }
    }catch(err){
        debug.error("maskDeductMask exception:", err);
    }
}


// 将imageURL中只要不是绝对黑的部分设为绝对白。如果一个点的四周有两个以上的点是白色，那么把这个点也设为白色
export async function cleanMask(imageURL:string){
    try {
        // 获取图像数据
        const response = await nodefetch(imageURL);
        if (!response.ok) throw new Error("Failed to fetch image");
        const buffer = await response.buffer();

        // 读取图像的原始像素数据
        const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
        
        const width = info.width;
        const height = info.height;
        const channels = info.channels;

        // 创建一个新的缓冲区来存储结果
        const outputBuffer = Buffer.alloc(data.length);

        // 遍历每个像素，将绝对黑色以外的像素设置为白色
        for (let i = 0; i < data.length; i += channels) {
            if (data[i] !== 0 || (channels > 1 && data[i + 1] !== 0) || (channels > 2 && data[i + 2] !== 0)) {
                // 将该像素设置为白色
                outputBuffer[i] = 255; // R
                if (channels > 1) outputBuffer[i + 1] = 255; // G
                if (channels > 2) outputBuffer[i + 2] = 255; // B
                if (channels === 4) outputBuffer[i + 3] = data[i + 3]; // 保持透明通道不变
            } else {
                // 绝对黑色保持不变
                outputBuffer[i] = 0; // R
                if (channels > 1) outputBuffer[i + 1] = 0; // G
                if (channels > 2) outputBuffer[i + 2] = 0; // B
                if (channels === 4) outputBuffer[i + 3] = data[i + 3]; // 保持透明通道不变
            }
        }
/*
        // 再次遍历，设置白色像素的邻居规则
        const resultBuffer = Buffer.alloc(data.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let index = (y * width + x) * channels;

                // 计算周围白色像素的数量
                let whiteNeighborCount = 0;

                // 检查周围的8个像素
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue; // 忽略中心像素
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborIndex = (ny * width + nx) * channels;
                            if (outputBuffer[neighborIndex] === 255) { // 如果邻居是白色
                                whiteNeighborCount++;
                            }
                        }
                    }
                }

                // 如果周围有两个或以上的白色像素，则设置为白色
                if (whiteNeighborCount >= 1) {
                    resultBuffer[index] = 255; // R
                    if (channels > 1) resultBuffer[index + 1] = 255; // G
                    if (channels > 2) resultBuffer[index + 2] = 255; // B
                    if (channels === 4) resultBuffer[index + 3] = outputBuffer[index + 3]; // 保持透明通道不变
                } else {
                    // 保持原样
                    resultBuffer[index] = outputBuffer[index]; // R
                    if (channels > 1) resultBuffer[index + 1] = outputBuffer[index + 1]; // G
                    if (channels > 2) resultBuffer[index + 2] = outputBuffer[index + 2]; // B
                    if (channels === 4) resultBuffer[index + 3] = outputBuffer[index + 3]; // 透明通道
                }
            }
        }
*/
        // 将修改后的缓冲区转回 PNG 格式
        const finalBuffer = await sharp(outputBuffer, {
            raw: {
                width,
                height,
                channels
            }
        }).toFormat('png').toBuffer();

        // 上传结果并返回 URL
        const maskFileName = Date.now().toString() + "_cleaned_mask.png";
        const maskImageURL = await uploadDataToServer(finalBuffer, "image/png", maskFileName, "T");
        debug.log("cleanMask image generated:" + maskImageURL);
        return maskImageURL;
    } catch (err) {
        debug.error("cleanMask exception:", err);
    }
}

// 把一个图片放大scale倍，可以是小数，比如1.05倍，也可以是2、3、4倍
export async function zoomInImage(imageURL:string, scale:number){
    try {
        // 获取图像数据
        const response = await nodefetch(imageURL);
        if (!response.ok) throw new Error("Failed to fetch image");
        const buffer = await response.buffer();

        // 使用 sharp 读取图像的元数据，包括格式、宽度和高度
        const { width, height, format } = await sharp(buffer).metadata();
        if (!width || !height || !format) throw new Error("Failed to get image dimensions or format");

        // 计算放大后的宽度和高度
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        // 放大图像并保留原始格式
        const resizedBuffer = await sharp(buffer)
            .resize(newWidth, newHeight, { fit: 'fill' })
            .toFormat(format) // 动态设置格式为原始格式
            .toBuffer();

        // 上传结果并返回 URL
        const zoomedFileName = `${Date.now()}_zoomed_image.${format}`;
        const mimeType = `image/${format}`;
        const zoomedImageURL = await uploadDataToServer(resizedBuffer, mimeType, zoomedFileName, "T");
        debug.log("zoomInImage generated:" + zoomedImageURL);
        return zoomedImageURL;
    } catch (err) {
        debug.error("zoomInImage exception:", err);
    }
}

//把一个黑白二值的PNG格式的MASK图片中，白色区域扩大一个比例scale
async function dilate(data: Buffer, width: number, height: number): Promise<Buffer> {
    const output = Buffer.from(data);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (data[index] === 255) {
                // 将周围像素设为白色
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            output[ny * width + nx] = 255;
                        }
                    }
                }
            }
        }
    }
    return output;
}

export async function expandWhiteRegion(imageURL: string, scale: number) {
    try {
        // 获取图像数据
        const response = await nodefetch(imageURL);
        if (!response.ok) throw new Error("Failed to fetch image");
        const buffer = await response.buffer();

        // 使用 sharp 读取图像元数据
        const { width, height, format } = await sharp(buffer).metadata();
        if (!width || !height || !format) throw new Error("Invalid image dimensions or format");

        // 转换图像为二值化灰度图
        const { data, info } = await sharp(buffer)
            .grayscale()
            .threshold(128) // 二值化阈值处理
            .raw()
            .toBuffer({ resolveWithObject: true });

        const originalArea = data.filter((value) => value === 255).length;
        const targetArea = Math.ceil(originalArea * scale);
        let currentArea = originalArea;
        let dilatedData = data;

        // 执行膨胀操作，直到达到目标面积
        while (currentArea < targetArea) {
            dilatedData = await dilate(dilatedData, info.width, info.height);
            currentArea = dilatedData.filter((value) => value === 255).length;
        }

        // 转换膨胀后的数据为图像
        const expandedBuffer = await sharp(dilatedData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 1, // 灰度图单通道
            },
        })
            .toFormat(format)
            .toBuffer();

        // 上传扩展后的图像并返回 URL
        const expandedFileName = `${Date.now()}_expanded_image.${format}`;
        const mimeType = `image/${format}`;
        const expandedImageURL = await uploadDataToServer(expandedBuffer, mimeType, expandedFileName, "T");

        debug.log("expandWhiteRegion generated: " + expandedImageURL);
        return expandedImageURL;

    } catch (err) {
        debug.error("expandWhiteRegion exception: ", err);
        return;
    }
}

export async function expandWhitePixel(imageURL: string, pixel: number) {
    try {
        const response = await nodefetch(imageURL);
        if (!response.ok) throw new Error("Failed to fetch image");
        const buffer = await response.buffer();

        const { width, height, format } = await sharp(buffer).metadata();
        if (!width || !height || !format) throw new Error("Invalid image metadata");

        // 转为灰度并二值化，得到单通道图像
        const { data: inputData } = await sharp(buffer)
            .grayscale()
            .threshold(128)
            .raw()
            .toBuffer({ resolveWithObject: true });

        let dilatedData = Buffer.from(inputData); // 初始状态

        for (let i = 0; i < pixel; i++) {
            dilatedData = await dilate(dilatedData, width, height);
        }

        const outputBuffer = await sharp(dilatedData, {
            raw: {
                width,
                height,
                channels: 1,
            },
        })
            .toFormat(format)
            .toBuffer();

        const fileName = `${Date.now()}_expanded_${pixel}px.${format}`;
        const mimeType = `image/${format}`;
        const url = await uploadDataToServer(outputBuffer, mimeType, fileName, "T");

        debug.log("expandWhitePixel output: " + url);
        return url;

    } catch (err) {
        debug.error("expandWhitePixel exception: ", err);
    }
}



// 把一张输入的图片imageURL，根据给定的参数left,right,top,bottom的数值，加一个纯色的边。
// 比如输入一个1024*1024的图片，给定参数left:256,right:256:top:256,bottom:256。输出一个1536*1536的图片，中间是原来的图片，四周加了256宽的边。
export async function addFrame(imageURL:string, frame: { left:number, right:number, top:number, bottom:number}, 
                                    color:{r:number, g:number, b:number} ={r: 255, g: 255, b: 255}){
    try {
        const data = await nodefetch(imageURL);

        if (data.ok) {
            const buffer = await data.buffer();
            const { left, right, top, bottom } = frame;

            const image = sharp(buffer);
            const metadata = await image.metadata();

            if (!metadata.width || !metadata.height) {
                throw new Error('Unable to retrieve image dimensions.');
            }

            const newWidth = metadata.width + left + right;
            const newHeight = metadata.height + top + bottom;

            const resultBuffer = await sharp({
                create: {
                    width: newWidth,
                    height: newHeight,
                    channels: 3,
                    background: color,
                },
            })
                .composite([{ input: buffer, top, left }])
                .toFormat('png') // 强制输出 PNG 格式
                .toBuffer();

            // 上传到服务器
            const outputFileName = `${Date.now().toString()}_with_frame.png`;
            const outputURL = await uploadDataToServer(resultBuffer, 'image/png', outputFileName, 'T');
            debug.log('addWhiteFrame image generated: ' + outputURL);

            return outputURL;
        } else {
            throw new Error(`Failed to fetch image: ${imageURL}`);
        }
    } catch (err) {
        debug.error('addWhiteFrame exception:', err);
        throw err;
    } 
}


// ----------模仿色彩----------------------
// 让一张图片模拟另一张图片的色彩色调，达到快速图像风格调整的效果。
// 主函数

export async function simulateColorTone(
    sourceImageURL: string,
    targetImageURL: string,
    blendFactor: number = 1
) {
    try {
        // 下载图像
        const [sourceRes, targetRes] = await Promise.all([
            fetch(sourceImageURL),
            fetch(targetImageURL)
        ]);

        if (!sourceRes.ok || !targetRes.ok) {
            throw new Error("无法获取图像");
        }

        const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
        const targetBuffer = Buffer.from(await targetRes.arrayBuffer());

        // 应用专业级色彩匹配
        const adjustedBuffer = await applyProfessionalColorMatch(
            sourceBuffer,
            targetBuffer,
            blendFactor
        );

        // 上传并返回结果
        const outputURL = await uploadDataToServer(
            adjustedBuffer,
            "image/png",
            `${Date.now()}_color_toned.png`,
            "T"
        );

        return outputURL;
    } catch (error) {
        debug.error("色彩调整错误:", error);
        throw error;
    }
}

async function applyProfessionalColorMatch(
    sourceBuffer: Buffer,
    targetBuffer: Buffer,
    blendFactor: number
): Promise<Buffer> {
    // 获取源图像和参考图像的统计信息
    const sourceStats = await getImageStats(sourceBuffer);
    const targetStats = await getImageStats(targetBuffer);
    
    // 计算调整系数 - 基于参考图像的统计特征
    const adjustmentFactors = calculateAdjustmentFactors(sourceStats, targetStats);
    
    // 创建调整管道
    const pipeline = sharp(sourceBuffer);
    
    // 应用亮度调整
    if (adjustmentFactors.brightness !== 1) {
        pipeline.linear([adjustmentFactors.brightness], [0]);
    }
    
    // 应用色彩通道调整（分别处理RGB通道）
    const rgbAdjustments = [
        adjustmentFactors.red,
        adjustmentFactors.green,
        adjustmentFactors.blue
    ];
    
    // 应用多通道调整
    pipeline.linear(rgbAdjustments, [0, 0, 0]);
    
    // 应用饱和度调整
    if (adjustmentFactors.saturation !== 1) {
        pipeline.modulate({
            saturation: adjustmentFactors.saturation
        });
    }
    
    // 应用整体风格混合
    if (blendFactor < 1) {
        return applyGradualBlend(
            sourceBuffer,
            await pipeline.toBuffer(),
            blendFactor
        );
    }
    
    return pipeline.png().toBuffer();
}

async function getImageStats(imageBuffer: Buffer): Promise<ImageStats> {
    const stats = await sharp(imageBuffer).stats();
    
    return {
        brightness: stats.entropy, // 使用熵作为整体亮度的指示器
        red: stats.channels[0]?.mean || 0,
        green: stats.channels[1]?.mean || 0,
        blue: stats.channels[2]?.mean || 0,
        saturation: calculateSaturation(stats),
        contrast: stats.channels.reduce((sum, ch) => sum + (ch.max - ch.min), 0) / 3
    };
}

function calculateSaturation(stats: sharp.Stats): number {
    const maxSaturation = Math.max(
        stats.channels[0]?.max || 0,
        stats.channels[1]?.max || 0,
        stats.channels[2]?.max || 0
    );
    
    const minSaturation = Math.min(
        stats.channels[0]?.min || 0,
        stats.channels[1]?.min || 0,
        stats.channels[2]?.min || 0
    );
    
    return maxSaturation - minSaturation > 128 ? 1.2 : 0.8;
}

function calculateAdjustmentFactors(
    source: ImageStats,
    target: ImageStats
): AdjustmentFactors {
    const factors: AdjustmentFactors = {
        brightness: 1,
        red: 1,
        green: 1,
        blue: 1,
        saturation: 1
    };
    
    // 计算亮度调整
    if (source.brightness > 0 && target.brightness > 0) {
        factors.brightness = target.brightness / source.brightness;
        factors.brightness = clamp(factors.brightness, 0.8, 1.2);
    }
    
    // 计算各通道的色彩调整
    const maxChannelMean = Math.max(source.red, source.green, source.blue, 1);
    factors.red = target.red / Math.max(source.red, maxChannelMean / 5);
    factors.green = target.green / Math.max(source.green, maxChannelMean / 5);
    factors.blue = target.blue / Math.max(source.blue, maxChannelMean / 5);
    
    // 限制调整幅度在合理范围内
    factors.red = clamp(factors.red, 0.7, 1.3);
    factors.green = clamp(factors.green, 0.7, 1.3);
    factors.blue = clamp(factors.blue, 0.7, 1.3);
    
    // 计算饱和度调整
    factors.saturation = target.saturation / source.saturation;
    factors.saturation = clamp(factors.saturation, 0.5, 1.5);
    
    return factors;
}

async function applyGradualBlend(
    originalBuffer: Buffer,
    modifiedBuffer: Buffer,
    factor: number
): Promise<Buffer> {
    // 创建锐利掩模
    const mask = await createContrastMask(originalBuffer);
    
    // 应用混合
    const result = await sharp(originalBuffer)
        .composite([
            {
                input: modifiedBuffer,
                blend: 'over',
                density: 96,
                tile: false
            },
            {
                input: await mask.toBuffer(),
                blend: 'dest-in',
                density: 96,
                tile: false
            }
        ])
        .png()
        .toBuffer();
    
    return result;
}

async function createContrastMask(imageBuffer: Buffer): Promise<sharp.Sharp> {
    return sharp(imageBuffer)
        .greyscale() // 转为灰度
        .linear(1.5, -38) // 提高对比度
        .threshold(128) // 创建二值掩模
        .blur(1); // 轻微模糊使边缘平滑
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// 类型定义
interface ImageStats {
    brightness: number;
    red: number;
    green: number;
    blue: number;
    saturation: number;
    contrast: number;
}

interface AdjustmentFactors {
    brightness: number;
    red: number;
    green: number;
    blue: number;
    saturation: number;
}


// ----------模仿色彩结束----------------------




//把一张照片上下或左右翻转
export async function flipImage(imageURL:string, direction:string) {
    try {
        const response = await nodefetch(imageURL);

        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageURL}`);
        }

        const buffer = await response.buffer();
        let image = sharp(buffer);

        // 根据方向翻转图片
        if (direction === 'vertical') {
            image = image.flip(); // 上下翻转
        } else if (direction === 'horizontal') {
            image = image.flop(); // 左右翻转
        } else if (direction === 'both') {
            image = image.flip().flop(); // 上下左右同时翻转
        } else {
            throw new Error('Invalid direction. Use "vertical", "horizontal", or "both".');
        }

        const flippedBuffer = await image.jpeg({ quality: 90 }).toBuffer(); // 输出 JPG 格式

        // 上传到服务器
        const outputFileName = `${Date.now().toString()}_flipped_${direction}.jpg`;
        const outputURL = await uploadDataToServer(flippedBuffer, 'image/jpeg', outputFileName, 'T');

        debug.log(`Image flipped (${direction}) and uploaded to ${outputURL}`);
        return outputURL;
    } catch (error) {
        debug.error('Error flipping image:', error);
        throw error;
    }
}
// 把一张照片向左或向右旋转90度
export async function rotateImage(imageURL:string, direction:string) {
    try {
        const response = await nodefetch(imageURL);

        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageURL}`);
        }

        const buffer = await response.buffer();

        // 确定旋转角度
        let angle;
        if (direction === 'left') {
            angle = 270; // 左旋 90°
        } else if (direction === 'right') {
            angle = 90; // 右旋 90°
        } else {
            throw new Error('Invalid direction. Use "left" or "right".');
        }

        const rotatedBuffer = await sharp(buffer)
            .rotate(angle)
            .jpeg({ quality: 90 }) // 输出 JPG 格式
            .toBuffer();

        // 上传到服务器
        const outputFileName = `${Date.now().toString()}_rotated_${direction}.jpg`;
        const outputURL = await uploadDataToServer(rotatedBuffer, 'image/jpeg', outputFileName, 'T');

        debug.log(`Image rotated 90° ${direction} (${angle}°) and uploaded to ${outputURL}`);
        return outputURL;
    } catch (error) {
        debug.error('Error rotating image:', error);
        throw error;
    }
}


/**
 * 调整图像色温、亮度、对比度和锐度并上传到服务器
 * @param {string} imageURL - 图像的 URL
 * @param {number} temperature - 色温调整值（范围：-100 到 100）
 * @param {number} bright - 亮度调整值（范围：-100 到 100）
 * @param {number} contrast - 对比度调整值（范围：-100 到 100）
 * @param {number} sharpen - 锐度调整值（范围：50 到 100）
 * @returns {Promise<string>} - 上传后的图片 URL
 */
export async function adjustImage(
    imageURL: string,
    { temperature = 0, bright = 0, contrast = 0, sharpen = 50 } = {}
) {
    try {
        // 参数校验
        if (temperature < -100 || temperature > 100) {
            throw new Error('Temperature must be in the range of -100 to 100');
        }
        if (bright < -100 || bright > 100) {
            throw new Error('bright must be in the range of -100 to 100');
        }
        if (contrast < -100 || contrast > 100) {
            throw new Error('Contrast must be in the range of -100 to 100');
        }
        if (sharpen < 50 || sharpen > 100) {
            throw new Error('sharpen must be in the range of 50 to 100');
        }
       
        const response = await nodefetch(imageURL);
        if (!response.ok) throw new Error(`Failed to fetch image from URL: ${imageURL}`);

        const buffer = await response.buffer();
        const metadata = await sharp(buffer).metadata();
        const { width, height, channels = 3 } = metadata; // 如果 channels 未定义，默认为 3（RGB 格式）
        
        if (!width || !height || channels < 3) {
            throw new Error('Invalid image metadata: width, height, or channels are incorrect.');
        }

        const isRGBA = channels === 4;

        // 获取原始图像数据
        const raw = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
        const adjustedData = new Uint8Array(raw.data.length);

        // 色温调整因子
        const redAdjust = temperature > 0 ? 1 + temperature / 100 : 1;
        const blueAdjust = temperature < 0 ? 1 + Math.abs(temperature) / 100 : 1;

        // 对比度和亮度计算
        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const brightOffset = (bright / 100) * 255;

         // 遍历像素进行调整
         for (let i = 0; i < raw.data.length; i += channels) {
             let r = raw.data[i];
             let g = raw.data[i + 1];
             let b = raw.data[i + 2];
             let a = channels === 4 ? raw.data[i + 3] : 255;
         
             // 色温调整
             r = Math.min(255, r * redAdjust);
             b = Math.min(255, b * blueAdjust);
         
             // 对比度和亮度调整
             r = contrastFactor * (r - 128) + 128 + brightOffset;
             g = contrastFactor * (g - 128) + 128 + brightOffset;
             b = contrastFactor * (b - 128) + 128 + brightOffset;
         
             // 写回调整后的值
             adjustedData[i] = Math.min(255, Math.max(0, r));
             adjustedData[i + 1] = Math.min(255, Math.max(0, g));
             adjustedData[i + 2] = Math.min(255, Math.max(0, b));
             if (channels === 4) adjustedData[i + 3] = a; // 保持透明通道
         }

        // 创建调整后的图像
        let adjustedImage = sharp(adjustedData, {
            raw: { width, height, channels },
        });

        // 锐化处理（仅在 sharpen > 50 时应用）
        if (sharpen > 50) {
            const sharpenFactor = (sharpen - 50) / 50;
            const kernel = [
                0, -sharpenFactor, 0,
                -sharpenFactor, 1 + 4 * sharpenFactor, -sharpenFactor,
                0, -sharpenFactor, 0,
            ];
            adjustedImage = adjustedImage.convolve({ width: 3, height: 3, kernel });
        }

        // 输出调整后的图像
        const adjustedBuffer = await adjustedImage.png({ quality: 90 }).toBuffer();

        // 上传图像到服务器
        const outputFileName = `${Date.now()}_adjusted_image.png`;
        const outputURL = await uploadDataToServer(adjustedBuffer, 'image/png', outputFileName, 'T');

        return outputURL;
    } catch (error) {
        debug.error('Error adjusting image:', error);
        throw error;
    }
}


// 将 PNG 格式的图片转换为 JPG 格式，并填充透明区域为黑色
export async function convertPNG2JPG(imageURL: string) {
    try {
        const response = await nodefetch(imageURL);

        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageURL}`);
        }

        const buffer = await response.buffer();

        // 使用 sharp 处理图片
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // 判断图片是否为 PNG 格式
        if (metadata.format !== 'png') {
            return imageURL;
        }

        // 转换为 JPG 格式，透明区域填充为黑色
        const jpgBuffer = await image
            .flatten({ background: { r: 0, g: 0, b: 0 } }) // 填充透明区域为黑色
            .jpeg({ quality: 90 }) // 转换为 JPG 格式
            .toBuffer();

        // 上传到服务器
        const outputFileName = `${Date.now().toString()}_converted.jpg`;
        const outputURL = await uploadDataToServer(jpgBuffer, 'image/jpeg', outputFileName, 'T');

        debug.log(`PNG converted to JPG and uploaded to ${outputURL}`);
        return outputURL;
    } catch (error) {
        debug.error('Error converting PNG to JPG:', error);
        throw error;
    }
}

const gmPromisified = gm.subClass({ imageMagick: false }); // true 使用 imagemagick，false 使用 graphicsmagick
const pipeline = promisify(stream.pipeline);
// 将 BMP buffer 转换为 PNG buffer
async function convertBMPtoPNG(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        gmPromisified(buffer)
            .setFormat('png')
            .toBuffer((err, pngBuffer) => {
                if (err) return reject(err);
                resolve(pngBuffer);
            });
    });
}

// 这个函数支持 jfif, bmp, gif, heic, hif, tif, tiff 等格式
// 并确保透明区域填充为黑色。
// 如果格式不受支持，它会直接返回原始 URL。你可以根据你的需求调整 allowedFormats 列表。
export async function convertIMG2JPG(imageURL:string) {
    try {
        const response = await nodefetch(imageURL);
        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageURL}`);
        }

        let buffer = await response.buffer();

        const type = await fileType.fromBuffer(buffer);
        const format = type?.ext || '';
        
        const allowedFormats = [
          'jpeg', 'jpg', 'png', 'webp', 'gif',
          'tiff', 'tif', 'jp2', 'bmp',
          'heic', 'heif', 'avif', 'jfif',
          'ico', 'dib', 'ppm', 'pgm', 'pnm'
        ];

        if (!allowedFormats.includes(format)) {
            debug.log(`Unsupported format: ${format}, returning original URL.`);
            return null;
        }

        // 针对 bmp 特殊处理，先用 gm 转成 png
        if (format === 'bmp') {
            try {
                buffer = await convertBMPtoPNG(buffer);
                debug.log('BMP format converted to PNG via gm.');
            } catch (e) {
                debug.error('Failed to convert BMP to PNG via gm:', e);
                return null;
            }
        }

        const image = sharp(buffer);

        const jpgBuffer = await image
            .flatten({ background: { r: 0, g: 0, b: 0 } }) // 填充透明区域为黑色
            .jpeg({ quality: 90 })
            .toBuffer();

        const outputFileName = `${Date.now().toString()}_converted.jpg`;
        const outputURL = await uploadDataToServer(jpgBuffer, 'image/jpeg', outputFileName, 'T');

        debug.log(`Image converted to JPG and uploaded to ${outputURL}`);
        return outputURL;
    } catch (err) {
        debug.error('Error converting image to JPG:', err);
        return null;
    }
}

/**
 * 将 RAW 图片（如 CR2, NEF, ARW, DNG）转换为 JPG
 * @param {string} rawFilePath - 输入 RAW 文件路径
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} - 返回转换后的 JPG 文件路径
 */
export async function convertRAW2JPG(imageURL: string) {
  try {
    // 1. 下载到 Buffer
    const res = await fetch(imageURL);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // 2. 试着用 dcraw 解码成 TIFF
    let decodeBuffer: Buffer;
    try {
      const result = dcraw(buffer, { exportAsTiff: true });
      const [tiffName] = Object.keys(result.files);
      const tiffBuf = result.files[tiffName];
      if (!tiffBuf) throw new Error('dcraw returned empty TIFF');
      decodeBuffer = tiffBuf; // RAW 解码成功：用 TIFF Buffer
    } catch (decodeErr) {
      // 解码失败——说明不是我们支持的 RAW
      debug.log(`Not a RAW file or unsupported RAW format, fallback to original:`, decodeErr);
      decodeBuffer = buffer;  // 回退到原始 Buffer
    }

    // 3. 用 sharp 转成 JPG
    const jpgBuffer = await sharp(decodeBuffer, { failOnError: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 4. 上传并返回 URL
    const outputName = `${Date.now()}_converted.jpg`;
    const outputURL = await uploadDataToServer(
      jpgBuffer,
      'image/jpeg',
      outputName,
      'T'
    );

    debug.log(`Conversion successful: ${outputURL}`);
    return outputURL;

  } catch (err) {
    debug.error('Conversion failed:', err);
    return null;
  }
}



export async function putWechatQR(imageURL:string, config:any, user:any){
    const qrCodes = [
        {qr:`${config.RS}/niukit/wechat/gw_qrcode_64.jpg`, width: 64, height: 64},
        {qr:`${config.RS}/niukit/wechat/gw_qrcode_128.jpg`, width: 128, height: 128},
        {qr:`${config.RS}/niukit/wechat/gw_qrcode_258.jpg`, width: 258, height: 258}
    ];
    let qr = qrCodes[0];
    
    let result = imageURL;
    try{
        const size = await getImageSize(imageURL);
        if(size && size.height && size.width && size.height > 70 && size.width > 70){
            if(size.width > 3000 && size.height > 3000){
                qr = qrCodes[2];
            }else if(size.width > 1500 && size.height > 1500){
                qr = qrCodes[1];
            }else{
                qr = qrCodes[0];
            }
            
            const x = size.width - qr.width - 1;
            const y = size.height - qr.height - 1;
            
            result = await putImagesOnImage(imageURL, [{imageURL:qr.qr, x, y, width:qr.width, height:qr.height}], "U") || result;
        }
    }catch(err){
        debug.error("putWechatQR:", err);
    }
    return result;
}
            
