// 后台程序
import sharp from 'sharp';
import axios from 'axios';
import nodefetch from 'node-fetch';
import tar from 'tar';
import stream from 'stream';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { finished } from 'stream/promises';


import { moveToFileServer, uploadDataToServer } from "./fileServer";
import * as fu from "./fileUtils";
import * as debug from "./debug";
   

/**
 * 解压 TAR 文件并上传指定模型文件
 * @param {string} tarURL - TAR 文件下载地址
 * @returns {Promise<string>} - 返回服务器上的模型文件 URL
 */
export async function extractAndUploadLora(tarURL: string) {
    let tempDir: string | null = null;
    
    try {
        // 下载 TAR 文件
        const response = await nodefetch(tarURL);
        if (!response.ok) {
            throw new Error(`Failed to fetch TAR file from URL: ${tarURL}`);
        }

        // 创建临时目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tar-extract-'));
        const buffer = await response.buffer();

        // 创建转换流进行解压
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const extractStream = tar.x({
            C: tempDir,
            preservePaths: true
        });

        bufferStream.pipe(extractStream);
        await finished(extractStream);

        // 构建目标文件路径
        const targetPath = path.join(
            tempDir,
            'output',
            'flux_train_replicate',
            'lora.safetensors'
        );

        // 验证文件是否存在
        try {
            await fs.access(targetPath);
        } catch {
            throw new Error('lora.safetensors not found in extracted files');
        }

        // 读取文件内容
        const fileBuffer = await fs.readFile(targetPath);

        // 上传到服务器
        const outputFileName = `${Date.now().toString()}_lora.safetensors`;      
        const outputURL = await uploadDataToServer(
            fileBuffer,
            'application/octet-stream',
            outputFileName,
            'M'
        );

        // 清理临时目录
        await fs.rm(tempDir, { recursive: true, force: true });
        tempDir = null;

        console.log(`Model file uploaded: ${outputURL}`);
        return outputURL;
    } catch (error) {
        // 错误时清理临时目录
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
        console.error('Error processing TAR file:', error);
        throw error;
    }
}
