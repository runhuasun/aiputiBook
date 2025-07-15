import {downloadToLocal,  deleteLocalFile, moveToFileServer, uploadDataToServer } from "./fileServer";
import {log, error, warn} from "./debug";
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';

//const ffmpeg = require('fluent-ffmpeg');
// const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { PassThrough } = require('stream');
const path = require('path');
const fs = require('fs');
import { writeFile } from 'fs/promises';

import * as tmp from 'tmp'; 
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
import { exec as _exec } from 'child_process';
const exec = promisify(_exec);

import * as au from "./audioUtils";

// ffmpeg.setFfmpegPath(ffmpegInstaller.path);
tmp.setGracefulCleanup();  // 确保退出时清理临时文件


// 为视频配音
export async function mixAudioToVideo(inputVideoUrl: string, audioURL: string, keepOriginal:boolean=true, folder: string = "U") {
    log("mixAudioToVideo");
    const tempAudioFile = tmp.fileSync({ postfix: '.mp3' });
    const tempAudioPath = tempAudioFile.name;
    
    try{
        // 下载音频文件
        log("下载音频文件：", audioURL);
        const audioResponse = await axios({ method: 'get', url: audioURL, responseType: 'arraybuffer' });
        fs.writeFileSync(tempAudioPath, Buffer.from(audioResponse.data));
        log("音频文件保存到临时路径：", tempAudioPath);
        
        return await mixLocalAudioToVideo(inputVideoUrl, tempAudioPath, keepOriginal, folder);        
    } catch (err) {
        error('mixAudioToVideo 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempAudioFile.removeCallback();
    }        
}

// 从视频里提取音频，为另外一个视频配音
export async function mixAudioFromVideo(videoWithAudioUrl: string, videoWithoutAudioUrl: string, keepOriginal:boolean=true, folder: string = "U") {
    log("开始拷贝声音，从", videoWithAudioUrl, "到", videoWithoutAudioUrl);
    const tempAudio1 = tmp.fileSync({ postfix: '.mp3' }); // 提取自 videoWithAudioUrl
    try {
        const hasAudio = await extractAudioOrCreateSilent(videoWithAudioUrl, tempAudio1.name);

        if(hasAudio){
            return await mixLocalAudioToVideo(videoWithoutAudioUrl, tempAudio1.name, keepOriginal, folder);
        }
    } catch (err) {
        error('视频合成处理过程中出错:', err);
        throw err;
    } finally {
        // 删除临时文件
        tempAudio1.removeCallback();
    }
}


export async function mixLocalAudioToVideo(inputVideoUrl: string, tempAudioPath: string, keepOriginal: boolean = true, folder: string = "U") {
    log("mixLocalAudioToVideo");

    // 如果音频文件为空，则直接返回原视频
    if (!fs.existsSync(tempAudioPath) || fs.statSync(tempAudioPath).size === 0) {
        log("音频为空，跳过混音，直接返回原始视频：", inputVideoUrl);
        return inputVideoUrl;
    }
    
    const tempTrimmedAudioFile = tmp.fileSync({ postfix: '.mp3' });
    const tempTrimmedAudioPath = tempTrimmedAudioFile.name;
    const tempOutputFile = tmp.fileSync({ postfix: '.mp4' });
    const tempOutputPath = tempOutputFile.name;

    try {
        // 检查 inputVideoUrl 是否包含音频
        const videoMetadata = await new Promise<any>((resolve, reject) => {
            (ffmpeg() as any)
                .input(inputVideoUrl)
                .ffprobe((err: Error, metadata: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(metadata);
                    }
                });
        });

        const videoDuration = videoMetadata.format.duration || 0;
        const hasVideoAudio = videoMetadata.streams.some((stream: any) => stream.codec_type === 'audio');
        log("视频时长：", videoDuration, "是否有音频：", hasVideoAudio);

        // 修剪或扩展音频以匹配视频长度
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempAudioPath)
                .outputOptions([
                    '-t', videoDuration.toString(), // 修剪音频到视频长度
                    '-af', `apad=pad_dur=${videoDuration}` // 如果音频较短，填充静音
                ])
                .on('start', (commandLine: string) => {
                    log('修剪或扩展音频 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    error('修剪或扩展音频 FFmpeg 错误: ', err);
                    error('修剪或扩展音频 FFmpeg stdout: ', stdout);
                    error('修剪或扩展音频 FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    log("修剪或扩展音频完成，生成文件：", tempTrimmedAudioPath);
                    resolve();
                })
                .save(tempTrimmedAudioPath);
        });

        // 合并修剪后的音频与视频
        await new Promise<void>((resolve, reject) => {
            const ffmpegCommand = ffmpeg().input(inputVideoUrl).input(tempTrimmedAudioPath);

            if (keepOriginal && hasVideoAudio) {
                ffmpegCommand.complexFilter([
                    '[0:v]copy[v]', // 保留视频流
                    '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=3[aout]' // 混合音频
                ])
                .map('[v]')
                .map('[aout]');
            } else {
                // 移除原音频，仅保留新音频
                ffmpegCommand.outputOptions([
                    '-map 0:v', // 仅映射视频流
                    '-map 1:a', // 映射新音频流
                    '-c:a aac' // 编码为 AAC
                ]);
            }

           (ffmpegCommand as any)
                .outputOptions([
                    '-c:v libx264',
                    '-crf 23',
                    '-r 30',
                    '-preset ultrafast',
                    '-f mp4'
                ])
                .on('start', (commandLine: string) => {
                    log('合并音频与视频 FFmpeg 命令: ', commandLine);
                })
                .on('progress', (progress: any) => {
                    log(`合并音频与视频处理进度: ${inputVideoUrl}`, progress);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    error('合并音频与视频 FFmpeg 错误: ', err);
                    error('合并音频与视频 FFmpeg stdout: ', stdout);
                    error('合并音频与视频 FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    log("合并音频与视频完成，生成文件：", tempOutputPath);
                    resolve();
                })
                .save(tempOutputPath);
        });

        // 上传合成的视频文件
        const videoBuffer = fs.readFileSync(tempOutputPath);
        const newVideoURL = await uploadDataToServer(videoBuffer, "video/mp4", Date.now().toString() + "_mixed_video.mp4", folder);
        log("上传完成，新视频 URL: ", newVideoURL);

        return newVideoURL;
    } catch (err) {
        error('mixLocalAudioToVideo 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempTrimmedAudioFile.removeCallback();
        tempOutputFile.removeCallback();
    }
}




/**
 * Adjusts the audio length to match a given duration by trimming or padding with silence.
 */
async function adjustAudioLength(inputAudioPath: string, targetDuration: number, outputAudioPath: string) {
    await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
            .input(inputAudioPath)
            .outputOptions([
                '-t', targetDuration.toString(), // 修剪到目标时长
                '-af', `apad=pad_dur=${targetDuration}` // 填充静音到目标时长
            ])
            .on('start', (commandLine: string) => log('Adjusting Audio Length FFmpeg Command: ', commandLine))
            .on('error', (err: Error, stdout: string, stderr: string) => {
                error('Adjusting Audio Length FFmpeg Error: ', err.message);
                error('FFmpeg STDOUT: ', stdout);
                error('FFmpeg STDERR: ', stderr);
                reject(err);
            })
            .on('end', () => {
                log('Audio length adjusted to target duration: ', targetDuration);
                resolve();
            })
            .save(outputAudioPath);
    });
}




async function extractAudioOrCreateSilent(videoUrl: string, outputAudioPath: string): Promise<boolean> {
    try {
        await extractAudio(videoUrl, outputAudioPath);
        log(`提取音频成功：${videoUrl}`);
        return true; // 提取成功
    } catch (err) {
        warn(`音频提取失败，生成静音文件代替：${videoUrl}`, err);

        // 获取视频时长
        const videoMetadata = await new Promise<any>((resolve, reject) => {
            (ffmpeg() as any)
                .input(videoUrl)
                .ffprobe((err: Error, metadata: any) => {
                    if (err) reject(err);
                    else resolve(metadata);
                });
        });

        const duration = videoMetadata.format.duration || 0;
        if (duration <= 0) throw new Error(`无法确定视频长度：${videoUrl}`);

        // 生成静音音频
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input('anullsrc') // 使用静音音频滤镜
                .inputOptions(['-f lavfi']) // 指定格式为滤镜
                .outputOptions([`-t ${duration}`]) // 指定音频长度
                .on('start', (commandLine: string) => {
                    log('生成静音音轨 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    error('生成静音音轨 FFmpeg 错误: ', err);
                    error('生成静音音轨 FFmpeg stdout: ', stdout);
                    error('生成静音音轨 FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    log("静音音轨生成完成。");
                    resolve();
                })
                .save(outputAudioPath); // 保存生成的音频
        });

        log(`生成静音音频完成：${outputAudioPath}`);
        return false; // 提取失败，用静音代替
    }
}


// 标准化音频函数,使它具有标准采样速率
async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
            .input(inputPath)
            .audioCodec('pcm_s16le') // 转换为线性 PCM 格式
            .audioChannels(2) // 设置为立体声
            .audioFrequency(44100) // 采样率设为 44100 Hz
            .on('start', (commandLine: string) => {
                log('标准化音频 FFmpeg 命令: ', commandLine);
            })
            .on('error', (err: Error, stdout: string, stderr: string) => {
                error('标准化音频错误: ', err);
                error('标准化音频 stdout: ', stdout);
                error('标准化音频 stderr: ', stderr);
                reject(err);
            })
            .on('end', resolve)
            .save(outputPath);
    });
}



/**
 * 在本地将一个视频的音频复制到另一个视频，返回合成后的视频临时路径
 * @param videoWithAudioPath 本地带音频的视频路径
 * @param videoWithoutAudioPath 本地无音频的视频路径
 */
export async function copyLocalAudioFromVideo(
  videoWithAudioPath: string,
  videoWithoutAudioPath: string
): Promise<string> {
    log("本地音频复制开始，从", videoWithAudioPath, "到", videoWithoutAudioPath);
    const tempAudio = tmp.fileSync({ postfix: ".mp3" });
    const tempOutput = tmp.fileSync({ postfix: ".mp4" });
    
    try {
        // 1. 提取音轨到临时文件
        const audioPath = await extractAudio(videoWithAudioPath, tempAudio.name);
        log("音频提取完成：", tempAudio.name);
        
        if(audioPath){
            // 2. 合并音轨到目标视频，得到 Buffer
            const videoBuffer = await mergeAudioToVideo(
                tempAudio.name,
                videoWithoutAudioPath
            );
            
            // 3. 将 Buffer 写入输出文件
            await writeFile(tempOutput.name, videoBuffer);
            log("本地合成视频输出：", tempOutput.name);
            
            return tempOutput.name;
        }
    } finally {
        // 清理临时音频文件
        try {
            tempAudio.removeCallback();
        } catch (e) {
            error("清理临时音频失败：", e);
        }
    }
    return "";
}

/**
 * 下载远程视频，将音频复制，再上传合成后的视频
 * @param videoWithAudioUrl 带音频的视频 URL
 * @param videoWithoutAudioUrl 无音频的视频 URL
 * @param folder 上传目标文件夹
 */
export async function copyAudioFromVideo(videoWithAudioUrl: string, videoWithoutAudioUrl: string, folder: string = "U"){
    
    log("开始拷贝声音，从", videoWithAudioUrl, "到", videoWithoutAudioUrl);
    
    // 1. 下载两个视频到本地
    const localWithAudio = await downloadToLocal(videoWithAudioUrl);
    const localWithoutAudio = await downloadToLocal(videoWithoutAudioUrl);
    let localOutput: string | undefined;

    try {
        // 2. 本地合并音频
        localOutput = await copyLocalAudioFromVideo(
            localWithAudio,
            localWithoutAudio
        );

        // 3. 读取合成后的视频并上传
        const buffer = await fs.readFile(localOutput);
        const newUrl = await uploadDataToServer(
            buffer,
            "video/mp4",
            `${Date.now()}_video.mp4`,
            folder
        );

        if (!newUrl) {
            throw new Error("上传失败：uploadDataToServer 未返回有效的 URL");
        }
        
        log("新视频文件上传完成，地址：", newUrl);
        return newUrl;
    } catch (err) {
        error("视频合成处理过程中出错:", err);
        // throw err;
        return "";
    } finally {
        // 4. 清理所有本地临时文件
        try { await deleteLocalFile(localWithAudio); } catch {}
        try { await deleteLocalFile(localWithoutAudio); } catch {}
        if (localOutput) {
            try { await deleteLocalFile(localOutput); } catch {}
        }
    }
}



export async function convert24RateTo30(videoURL:string){
    try {
        const videoBuffer = await increaseFrameRate(videoURL, 24, 30);
        
        // 上传视频 Buffer
        const newVideoURL = uploadDataToServer(videoBuffer, "video/mp4", Date.now().toString()+"_video.mp4", "U");

        return newVideoURL;
    } catch (err) {
        error('视频合成处理过程中出错:', err);
    }
}


/**
 * 增强版音频提取函数：如果视频无音轨，直接返回空字符串
 * @param inputVideoUrl 本地或远程视频路径
 * @param outputAudioPath 输出的音频文件路径（.mp3）
 * @returns 成功提取时返回输出路径，视频无音轨时返回 ""
 */
export async function extractAudio(
  inputVideoUrl: string,
  outputAudioPath: string
): Promise<string> {
  log(`开始检查视频音轨: ${inputVideoUrl}`);

  // 1. 先用 ffprobe 检测是否存在音轨
  const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(inputVideoUrl, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const hasAudio = metadata.streams.some(s => s.codec_type === "audio");
  if (!hasAudio) {
    log(`视频不包含音轨，跳过提取: ${inputVideoUrl}`);
    return "";
  }

  // 2. 真正提取音轨
  return new Promise<string>((resolve, reject) => {
    log(`开始提取音频: ${inputVideoUrl} → ${outputAudioPath}`);
    (ffmpeg(inputVideoUrl) as any)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioQuality(2)
      .output(outputAudioPath)
      .on("start", (cmd:any) => log("FFmpeg 命令:", cmd))
      .on("progress", ({ timemark }:any) => log(`处理进度: ${timemark}`))
      .on("end", () => {
        // 校验文件存在且非空
        if (fs.existsSync(outputAudioPath) && fs.statSync(outputAudioPath).size > 0) {
          log("音频提取成功:", outputAudioPath);
          resolve(outputAudioPath);
        } else {
          reject(new Error("生成的音频文件为空或不存在"));
        }
      })
        .on('error', (err: Error, stdout: string, stderr: string) => {
        error("FFmpeg 提取音频出错:", err);
        error("stdout:", stdout);
        error("stderr:", stderr);
        reject(new Error(`音频提取失败: ${stderr || err.message}`));
      })
      .run();
  });
}

/**​
 * 从视频中提取音频并分离人声和背景音乐
 * @param videoURL 视频文件 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "T"
 * @returns 包含人声和背景音乐 URL 的对象
 */
export async function extractVocalsAndBgFromVideo(
    videoURL: string, 
    folder: string = "T"
): Promise<{ vocalURL: string; bgURL: string }> {
    log("extractVocalsAndBgFromVideo");
    
    // 声明临时资源引用
    let tempAudioFile: tmp.FileResult | undefined;
    let extractedAudioPath: string | undefined;

    try {
        // 创建临时音频文件
        tempAudioFile = tmp.fileSync({ postfix: '.mp3' });
        extractedAudioPath = tempAudioFile.name;

        // 步骤1：从视频中提取音频
        log("开始提取视频音频...");
        await extractAudio(videoURL, extractedAudioPath);
        log("音频提取完成:", extractedAudioPath);

        // 步骤2：分离人声和背景音乐
        log("开始分离人声和背景音乐...");
        const result = await au.extractVocalsAndBackground(
            { audioPath: extractedAudioPath }, 
            folder
        );

        log("视频人声分离完成");
        return result;
    } catch (err:any) {
        error('视频处理流程失败:', err);
        throw new Error(`视频处理失败: ${err.message}`);
    } finally {
        // 清理临时音频文件（保留其他临时文件由内部函数处理）
        if (tempAudioFile) {
            log("清理临时音频文件:", tempAudioFile.name);
            tempAudioFile.removeCallback();
        }
    }
}




// 将音频轨道合并到另一个视频并返回 Buffer
function mergeAudioToVideo(audioPath: string, inputVideoUrl: string): Promise<Buffer> {
    log("mergeAudioToVideo");
    return new Promise((resolve, reject) => {
        const tmpFile = tmp.fileSync({ postfix: '.mp4' });

            (ffmpeg() as any)
            .input(inputVideoUrl)
            .input(audioPath)
            .outputOptions(['-c:v libx264', '-crf 23', '-r 30', '-preset ultrafast', '-c:a aac', '-strict experimental', '-f mp4'])
            .on('start', (commandLine: string) => {
                log('mergeAudioToVideo FFmpeg 命令: ', commandLine);
            })
            .on('progress', (progress: any) => {
                log(`mergeAudioToVideo 处理进度: ${inputVideoUrl}`, progress);
            })
            .on('error', (err: Error, stdout: string, stderr: string) => {
                error('mergeAudioToVideo FFmpeg 错误: ', err);
                error('mergeAudioToVideo FFmpeg stdout: ', stdout);
                error('mergeAudioToVideo FFmpeg stderr: ', stderr);
                tmpFile.removeCallback(); // 删除临时文件
                reject(err);
            })
            .on('end', () => {
                fs.readFile(tmpFile.name, (err: NodeJS.ErrnoException | null, data: Buffer) => {
                    tmpFile.removeCallback(); // 删除临时文件
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
            .save(tmpFile.name);
    });
}


// 将视频帧率从24帧每秒提高到30帧每秒，缩短视频总长度，保持总帧数不变
function increaseFrameRate(videoURL:string, fromFrameRate:number=24, targetFrameRate:number=30): Promise<Buffer> {
    log("increaseFrameRate");
    return new Promise((resolve, reject) => {
        const tmpFile = tmp.fileSync({ postfix: '.mp4' });

            (ffmpeg() as any)
            .outputOptions([
                '-c:v libx264', '-crf 23', '-preset ultrafast', '-c:a aac', '-strict experimental', '-f mp4',                
                `-r ${targetFrameRate}`, 
                '-vf', `setpts=PTS*${fromFrameRate/targetFrameRate}`
            ])
            .on('start', (commandLine:any) => {
                log('increaseFrameRate 命令行:', commandLine);
            })
            .on('error', (err: Error, stdout: string, stderr: string) => {
                error('increaseFrameRate 错误:', err);
                error('increaseFrameRate 输出:', stdout);
                error('increaseFrameRate 错误信息:', stderr);
                tmpFile.removeCallback(); // 删除临时文件
                reject(err);
            })
            .on('end', () => {
                fs.readFile(tmpFile.name, (err: NodeJS.ErrnoException | null, data: Buffer) => {
                    tmpFile.removeCallback(); // 删除临时文件
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
            .save(tmpFile.name);
    });
}

/*
// 把一个绿幕视频贴一个新的背景
export function replaceGreenScreen(inputVideoPath, backgroundImagePath, outputPath) {
    // 设置FFmpeg路径，如果FFmpeg不在默认环境变量中
    // ffmpeg.setFfmpegPath('/path/to/ffmpeg');
    ffmpeg(inputVideoPath)
        .input(backgroundImagePath)
        .complexFilter([
            // 使用chromakey删除绿幕
            {
                filter: 'chromakey',
                options: { color: '#00ff00', similarity: 0.2, blend: 0.1 },
                inputs: '0:v',
                outputs: 'keyed'
            },
            // 将原始视频（现在已经去除绿幕）和新背景合并
            {
                filter: 'overlay',
                options: { x: '(W-w)/2', y: '(H-h)/2' },
                inputs: ['1:v', 'keyed'],
                outputs: 'output'
            }
        ])
        .outputOptions([
            '-map', '[output]',
            '-map', '0:a?', // 保留原始音频
        ])
        .on('error', function(err) {
            log('An error occurred: ' + err.message);
        })
        .on('end', function() {
            log('Processing finished !');
        })
        .save(outputPath);
}
*/

async function downloadVideoToFile(url:string, filePath:string) {
    const retries = 3;
    for (let i = 0; i < retries; i++) {
        log(`try to downloadVideoToFile ${i} times......`);
        try {
            await downloadFile(url, filePath);
            return; // 下载成功则退出
        } catch (err) {
            if (i === retries - 1) throw err; // 最后一次失败直接抛出
            console.log(`第 ${i+1} 次重试...`);
            await new Promise(res => setTimeout(res, 2000)); // 2 秒后重试
        }
    }    
}


async function downloadFile(url:string, filePath:string) {    
    const writer = fs.createWriteStream(filePath);
    
    try {
        // 添加 timeout 配置（单位：毫秒）
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 600000 // 600 秒超时
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                writer.close(); // 确保关闭文件句柄
                resolve(filePath);
            });
            writer.on('error', (err:any) => {
                writer.close(); // 发生错误时清理文件
                reject(err);
            });
        });
    } catch (err) {
        writer.close(); // 请求失败时立即清理文件
        fs.unlinkSync(filePath); // 删除已写入的临时文件
        throw err;
    }
}

async function processVideo(inputFilePath:string, outputFilePath:string, startTime:number, duration:number) {
    return new Promise((resolve, reject) => {
        (ffmpeg(inputFilePath) as any)
            .inputOptions(['-probesize 50M', '-analyzeduration 100M'])
            .setStartTime(startTime)
            .setDuration(duration)
            .outputOptions('-c:v libx264')
            .save(outputFilePath)
            .on('end', resolve)
            .on('error', (err:any) => reject(new Error(`Failed to process the video: ${err.message}`)));
    });
}

// 从视频截取一个片段
// 这个函数从网络视频URL截取视频片段并上传
export async function trimVideo(videoUrl:string, startTime:number, duration:number) {
    log(`正在从 ${videoUrl} 截取从 ${startTime} 秒开始的 ${duration} 秒`);
    try {
        const inputTempFile = tmp.fileSync({ prefix: 'input_', postfix: '.mp4', keep: false });
        const outputTempFile = tmp.fileSync({ prefix: 'output_', postfix: '.mp4', keep: false });        

        // 下载视频到临时文件
        await downloadVideoToFile(videoUrl, inputTempFile.name);
        log('Video downloaded to:', inputTempFile.name);
        
        // 处理视频并保存到另一个临时文件
        await processVideo(inputTempFile.name, outputTempFile.name, startTime, duration);
        log('Video processed and saved to:', outputTempFile.name);

        // 从处理过的文件读取数据到Buffer
        const videoBuffer = await readFile(outputTempFile.name);
        
        // 这里的 uploadDataToServer 是假设已定义好的上传函数
        const newVideoURL = await uploadDataToServer(videoBuffer, "video/mp4", `${Date.now()}_video.mp4`, "T");
        log(`截取后的视频存储于：${newVideoURL}`);
        return newVideoURL;

    } catch (err) {
        error('视频处理过程中出现错误:', err);
        throw err;
    }
}

// 获得视频长度 (秒）
export async function getVideoLength(videoURL: string): Promise<number | null> {
    const MAX_RETRIES = 2; // 最大重试次数
    let retryCount = 0;

    const attempt = async (): Promise<number | null> => {
        return new Promise((resolve, reject) => {
            (ffmpeg as any).ffprobe(videoURL, function(err: any, metadata: any) {
                if (err) {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.warn(`Retrying (${retryCount}/${MAX_RETRIES})...`);
                        setTimeout(() => {
                            attempt().then(resolve).catch(reject);
                        }, 1000 * retryCount); // 指数退避：1s, 2s
                    } else {
                        console.error("Error getting video information after retries", err);
                        reject(err);
                    }
                } else {
                    console.log("Duration (s):", metadata.format.duration);
                    resolve(metadata.format.duration);
                }
            });
        });
    };

    return attempt();
}


// 从视频上截取一帧
export async function captureFrame(
    videoURL: string,
    timestamp: number,
    path: string = "T"
): Promise<string | null> {
    const MAX_RETRIES = 2; // 最大重试次数
    let retryCount = 0;

    const attempt = async (): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            log(`[Attempt ${retryCount + 1}] 正在从 ${videoURL} 截取 ${timestamp}ms 的一帧`);

            const outputTempFile = tmp.fileSync({ 
                prefix: 'frame_', 
                postfix: '.jpg', 
                keep: false 
            });

            (ffmpeg(videoURL) as any)
                .inputOptions([
                    '-probesize 50M',
                    '-analyzeduration 100M',
                    '-timeout', '180000000' // 3分钟超时（单位：微秒）
                ])
                .setStartTime(timestamp / 1000) // 毫秒 → 秒
                .frames(1)
                .outputOptions('-q:v 2') // 高质量 JPEG
                .output(outputTempFile.name)
                .on('end', async () => {
                    try {
                        const imageBuffer = await readFile(outputTempFile.name);
                        const newImageURL = await uploadDataToServer(
                            imageBuffer,
                            "image/jpeg",
                            `${Date.now()}_frame.jpg`,
                            path
                        );
                        resolve(newImageURL || null);
                    } catch (err) {
                        reject(new Error(`读取或上传帧失败: ${err}`));
                    }
                })
                .on('error', (err: any) => {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delayMs = 1000 * retryCount; // 退避延迟：1s, 2s
                        log(`截取失败，${delayMs}ms 后重试 (${retryCount}/${MAX_RETRIES})...`);
                        setTimeout(() => {
                            attempt().then(resolve).catch(reject);
                        }, delayMs);
                    } else {
                        reject(new Error(`截取帧失败（已重试 ${MAX_RETRIES} 次）: ${err}`));
                    }
                })
                .run();
        });
    };

    return attempt();
}

// 从视频上截取一帧
export async function captureFrameToLocal(
    videoURL: string,
    timestamp: number
): Promise<string | null> {
    const MAX_RETRIES = 2; // 最大重试次数
    let retryCount = 0;

    const attempt = async (): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            log(`[Attempt ${retryCount + 1}] 正在从 ${videoURL} 截取 ${timestamp}ms 的一帧`);

            const outputTempFile = tmp.fileSync({ 
                prefix: 'frame_', 
                postfix: '.jpg', 
                keep: false 
            });

            (ffmpeg(videoURL) as any)
                .inputOptions([
                    '-probesize 50M',
                    '-analyzeduration 100M',
                    '-timeout', '180000000' // 3分钟超时（单位：微秒）
                ])
                .setStartTime(timestamp / 1000) // 毫秒 → 秒
                .frames(1)
                .outputOptions('-q:v 2') // 高质量 JPEG
                .output(outputTempFile.name)
                .on('end', () => {
                    log('帧已保存到:', outputTempFile.name);
                    resolve(outputTempFile.name);
                })
                .on('error', (err: any) => {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delayMs = 1000 * retryCount; // 退避延迟：1s, 2s
                        log(`截取失败，${delayMs}ms 后重试 (${retryCount}/${MAX_RETRIES})...`);
                        setTimeout(() => {
                            attempt().then(resolve).catch(reject);
                        }, delayMs);
                    } else {
                        reject(new Error(`截取帧失败（已重试 ${MAX_RETRIES} 次）: ${err}`));
                    }
                })
                .run();
        });
    };

    return attempt();
}


export async function captureLastFrame(videoURL: string): Promise<string | null> {
    log("captureLastFrame..... By MIX");
    let lastFrame:string|null = await captureLastFrameByMIX(videoURL);

    if(!lastFrame){
        log("captureLastFrame..... By NB");
        let lastFrame:string|null = await captureLastFrameByNB(videoURL);
    
        if(!lastFrame){
            log("captureLastFrame..... By Time");        
            lastFrame = await captureLastFrameByTime(videoURL);
            if(!lastFrame){
                const videoLength = await getVideoLength(videoURL);
                log("captureLastFrame..... videoLenght:" + videoLength);            
                if(videoLength && videoLength > 0.01){
                    log("captureLastFrame..... By Length");                
                    lastFrame = await captureFrame(videoURL, (videoLength-0.01)*1000);
                }
            }
        }
    }
    
    return lastFrame;
}

// 截取视频最后一帧。因为不同码率、网络波动等复杂因素，需要特别处理，不能直接使用时长
export async function captureLastFrameByNB(videoURL: string): Promise<string | null> {
    const outputTempFile = tmp.fileSync({ prefix: 'last_frame_', postfix: '.jpg', keep: false });

    try {
        // 获取视频总帧数
        const videoMetadata: any = await new Promise((resolve, reject) => {
            (ffmpeg() as any)
                .input(videoURL)
                .ffprobe((err:any, metadata:any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(metadata);
                    }
                });
        });

        const totalFrames = videoMetadata.streams
            .find((stream: any) => stream.codec_type === 'video')
            ?.nb_frames;

        if (!totalFrames) {
            throw new Error("无法获取视频总帧数");
        }

        // 提取最后一帧
        return await new Promise((resolve, reject) => {
            (ffmpeg() as any)
                .input(videoURL)
                .outputOptions([
                    `-vf select='eq(n\\,${totalFrames - 1})'`, // 定位到最后一帧
                    '-vframes 1', // 只输出一帧
                    '-q:v 2' // 设置高质量输出
                ])
                .output(outputTempFile.name)
                .on('start', (commandLine:any) => console.log('FFmpeg Command:', commandLine))
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    console.error('FFmpeg Error:', err.message);
                    console.error('FFmpeg stdout:', stdout);
                    console.error('FFmpeg stderr:', stderr);
                    reject(new Error(`FFmpeg failed: ${err.message}`));
                })
                .on('end', async () => {
                    try {
                        const imageBuffer = await readFile(outputTempFile.name);
                        const frameURL = await uploadDataToServer(
                            imageBuffer,
                            "image/jpeg",
                            `${Date.now()}_last_frame.jpg`,
                            "T"
                        );
                        resolve(frameURL || null);
                    } catch (error: any) {
                        reject(new Error(`Failed to process last frame: ${error.message}`));
                    }
                })
                .run();
        });
    } catch (err:any) {
        console.error('捕获最后一帧时出错:', err.message);
        return null;
    } finally {
        // 清理临时文件
        outputTempFile.removeCallback();
    }
}

// 备选方案：通过时间戳
export async function captureLastFrameByTime(videoURL: string): Promise<string | null> {
    // 创建视频和截图的临时文件
    const videoTempFile = tmp.fileSync({ prefix: 'video_', postfix: '.mp4' });
    const frameTempFile = tmp.fileSync({ prefix: 'frame_', postfix: '.jpg' });

    try {
        // 1. 下载视频到本地（含重试机制）
        await downloadVideoToFile(videoURL, videoTempFile.name);

        // 2. 验证视频完整性（关键修复点[4](@ref)）
        await validateVideoIntegrity(videoTempFile.name);

        // 3. 使用双重定位策略截取最后一帧（最佳实践[2,5](@ref)）
        return await new Promise((resolve, reject) => {
            (ffmpeg() as any)
                .input(videoTempFile.name)
                .inputOptions([
                    '-sseof -1',  // 从文件末尾开始定位（快速模式）
                    '-noaccurate_seek',
                    '-hwaccel auto'  // 启用硬件加速[7](@ref)
                ])
                .outputOptions([
                    '-vf "select=eq(pict_type\\,I)"', // 强制选择关键帧[1](@ref)
                    '-frames:v 1',
                    '-q:v 2',
                    '-vsync 0',  // 禁用帧同步避免时间戳问题
                    '-ignore_seek_error 1'
                ])
                .output(frameTempFile.name)
                .on('start', (cmd:any) => console.log('执行命令:', cmd))
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    console.error('截帧失败:', stderr);
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .on('end', async () => {
                    try {
                        const imageBuffer = await readFile(frameTempFile.name);
                        const frameURL = await uploadDataToServer(
                            imageBuffer,
                            "image/jpeg",
                            `${Date.now()}_last_frame.jpg`,
                            "T"
                        );
                        resolve(frameURL || null);
                    } catch (error: any) {
                        reject(new Error(`Failed to process last frame: ${error.message}`));
                    }
                })
                .run();
        });
    } catch (err) {
        console.error('全流程错误:', err);
        return null;
    } finally {
        [videoTempFile, frameTempFile].forEach(f => f.removeCallback());
    }
}


export async function captureLastFrameByMIX(videoURL: string): Promise<string | null> {
    const videoTempFile = tmp.fileSync({ prefix: 'video_', postfix: '.mp4' });
    const frameTempFile = tmp.fileSync({ prefix: 'frame_', postfix: '.jpg' });

    try {
        // Step 1: 下载视频
        await downloadVideoToFile(videoURL, videoTempFile.name);

        // Step 2: 校验完整性
        await validateVideoIntegrity(videoTempFile.name);

        // Step 3: 获取视频时长
        const duration = await getVideoDuration(videoTempFile.name);
        const seekTime = Math.max(0, duration - 0.1); // 防止负数

        // Step 4: Seek 到末尾截帧
        return await new Promise((resolve, reject) => {
            (ffmpeg(videoTempFile.name) as any)
                .inputOptions(['-hide_banner', '-hwaccel auto']) // 可选：加速
                .seekInput(seekTime)
                .outputOptions([
                    '-frames:v 1',
                    '-q:v 2',
                    '-vsync 0',
                    '-y'
                ])
                .output(frameTempFile.name)
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    console.error('FFmpeg 错误详情:', stderr);
                    reject(new Error(`截帧失败: ${err.message}`));
                })
                .on('end', async () => {
                    try {
                        const imageBuffer = await readFile(frameTempFile.name);
                        const frameURL = await uploadDataToServer(
                            imageBuffer,
                            "image/jpeg",
                            `${Date.now()}_last_frame.jpg`,
                            "T"
                        );
                        resolve(frameURL || null);
                    } catch (error: any) {
                        reject(new Error(`上传截图失败: ${error.message}`));
                    }
                })
                .run();
        });
    } catch (err) {
        console.error('全流程错误:', err);
        return null;
    } finally {
        [videoTempFile, frameTempFile].forEach(f => f.removeCallback());
    }
}

// 视频完整性校验（关键增强点[4](@ref)）
async function validateVideoIntegrity(filePath: string) {
    const { stderr } = await new Promise<{ stderr: string }>((resolve, reject) => {
        const chunks: string[] = [];
        (ffmpeg(filePath) as any)
            .addOption('-v error')
            .addOption('-f null')
            .output('-')
            .on('error', reject)
            .on('end', () => resolve({ stderr: chunks.join('') }))
            .on('stderr', (chunk:any) => chunks.push(chunk))
            .run();
    });

    if (stderr.includes('Invalid data')) {
        throw new Error('视频文件损坏');
    }
}


async function getVideoDuration(filePath: string): Promise<number> {
    const metadata: any = await new Promise((resolve, reject) => {
        ffmpeg(filePath).ffprobe((err, data) => err ? reject(err) : resolve(data));
    });
    return metadata.format.duration;
}

async function getTotalFrames(filePath: string): Promise<number> {
    const { stdout, stderr } = await exec(
        `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 ${filePath}`
    );

    // 检查 stdout 是否为空
    if (!stdout) {
        throw new Error(`FFprobe 未返回有效数据: ${stderr || '未知错误'}`);
    }

    return parseInt(stdout.trim(), 10);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////










export async function mergeVideos(videoUrl1: string, videoUrl2: string) {
    log(`开始合并两个视频：${videoUrl1} 和 ${videoUrl2}`);
    const tempFile1 = tmp.fileSync({ postfix: '.mp4' });
    const tempFile2 = tmp.fileSync({ postfix: '.mp4' });
    const tempOutputFile = tmp.fileSync({ postfix: '.mp4' });

    try {
        // 下载视频
        await downloadVideoToFile(videoUrl1, tempFile1.name);
        await downloadVideoToFile(videoUrl2, tempFile2.name);
        log('两个视频已下载到本地:', tempFile1.name, tempFile2.name);

        // 获取视频分辨率并调整两者一致
        const resolution1 = await getVideoResolution(tempFile1.name);
        const resolution2 = await getVideoResolution(tempFile2.name);
        const targetResolution = `${Math.max(resolution1.width, resolution2.width)}x${Math.max(resolution1.height, resolution2.height)}`;

        log(`调整两个视频到相同分辨率：${targetResolution}`);
        const adjustedFile1 = tmp.fileSync({ postfix: '.mp4' });
        const adjustedFile2 = tmp.fileSync({ postfix: '.mp4' });

        await resizeVideo(tempFile1.name, adjustedFile1.name, targetResolution);
        await resizeVideo(tempFile2.name, adjustedFile2.name, targetResolution);

        // 合并两个视频
        log('开始合并视频');
        await mergeVideoFiles(adjustedFile1.name, adjustedFile2.name, tempOutputFile.name);

        // 上传结果
        const videoBuffer = await readFile(tempOutputFile.name);
        const mergedVideoURL = await uploadDataToServer(videoBuffer, "video/mp4", `${Date.now()}_merged_video.mp4`, "U");
        log(`合并后的视频已上传到：${mergedVideoURL}`);
        return mergedVideoURL;

    } catch (err) {
        error('视频合并过程中出现错误:', err);
        throw err;
    } finally {
        tempFile1.removeCallback();
        tempFile2.removeCallback();
        tempOutputFile.removeCallback();
    }
}

async function getVideoResolution(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err: Error, metadata: any) => {
            if (err) return reject(err);

            const streamWithResolution = metadata.streams.find((s: any) => s.width && s.height);
            if (!streamWithResolution) return reject(new Error('无法获取视频分辨率'));

            const { width, height } = streamWithResolution;

            resolve({ width:width||0, height:height||0 });
        });
    });
}

export async function resizeVideo(input: string, output: string, resolution: string) {
    return new Promise<void>((resolve, reject) => {
        (ffmpeg(input) as any)
            .output(output)
            .outputOptions(['-vf', `scale=${resolution}`, '-preset', 'fast', '-crf', '23'])
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

export async function mergeVideoFiles(input1: string, input2: string, output: string) {
    return new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
            .input(input1)
            .input(input2)
            .outputOptions([
                '-filter_complex', '[0:v:0][1:v:0]hstack=inputs=2',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23'
            ])
            .output(output)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

// 重新编码视频以确保参数一致
async function reencodeVideo(inputPath: string, outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
            .input(inputPath)
            .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a aac', '-ar 44100', '-ac 2'])
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}


/**
 * 在本地拼接两个 mp4 文件，返回拼接后文件的临时路径
 * @param videoAPath 本地视频 A 的完整路径
 * @param videoBPath 本地视频 B 的完整路径
 */
export async function localConcatVideos(
  videoAPath: string,
  videoBPath: string
): Promise<string> {
  log("启动本地视频合并流程，源视频1：", videoAPath, "源视频2：", videoBPath);

  // 创建用于 FFmpeg concat 的清单文件和输出文件
  const mergeListFile = tmp.fileSync({ postfix: ".txt" });
  const outputFile = tmp.fileSync({ postfix: ".mp4" });

  try {
    // 写入合并清单
    const listContent = `file '${videoAPath}'\nfile '${videoBPath}'\n`;
    await writeFile(mergeListFile.name, listContent);
    log("合并清单已写入：", mergeListFile.name);

    // 调用 FFmpeg
    await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
        .input(mergeListFile.name)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-c:v copy",          // 视频流无损复制
          "-c:a aac",           // 音轨转码为 AAC
          "-movflags +faststart" // 优化用于流式播放
        ])
        .output(outputFile.name)
        .on("start", (cmd:any) => log("执行 FFmpeg 命令：", cmd))
                .on('error', (err: Error, stdout: string, stderr: string) => {
          error("FFmpeg 合并出错：", err);
          error("stdout：", stdout);
          error("stderr：", stderr);
          reject(err);
        })
        .on("end", () => {
          log("本地视频合并完成，输出：", outputFile.name);
          resolve();
        })
        .run();
    });

    return outputFile.name;
  } finally {
    // 清理合并清单文件（输出文件保留供调用方使用）
    mergeListFile.removeCallback();
  }
}


export async function concatVideos(videoAUrl: string, videoBUrl: string, targetFolder: string = "U"): Promise<string> {
    log("启动视频合并流程，源视频1：", videoAUrl, "，源视频2：", videoBUrl);

    // 初始化临时文件资源
    const tempFileA = tmp.fileSync({ postfix: ".mp4" });
    const tempFileB = tmp.fileSync({ postfix: ".mp4" });
    const processedFileA = tmp.fileSync({ postfix: ".mp4" });
    const processedFileB = tmp.fileSync({ postfix: ".mp4" });
    const mergeListFile = tmp.fileSync({ postfix: ".txt" });
    const mergedOutput = tmp.fileSync({ postfix: ".mp4" });

    try {
        // 阶段1：资源下载
        log("开始下载源视频文件");
        await downloadVideoToFile(videoAUrl, tempFileA.name);
        await downloadVideoToFile(videoBUrl, tempFileB.name);

        // 阶段2：音轨预处理
        log("执行音轨标准化处理");
        await ensureAudioTrack(tempFileA.name, processedFileA.name);
        await ensureAudioTrack(tempFileB.name, processedFileB.name);

        // 阶段3：生成合并清单
        const mergeContent = `file '${processedFileA.name}'\nfile '${processedFileB.name}'\n`;
        await writeFile(mergeListFile.name, mergeContent);
        log("合并清单创建完成");

        // 阶段4：FFmpeg合并处理
        log("启动视频合并引擎");
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(mergeListFile.name)
                .inputOptions(["-f concat", "-safe 0"])
                .outputOptions([
                    "-c:v copy",         // 视频流无损复制
                    "-c:a aac",          // 音频统一转码
                    "-movflags +faststart" // 流媒体优化
                ])
                .output(mergedOutput.name)
                .on("start", (cmd:any) => log("执行FFmpeg命令：", cmd))
            .on('error', (err: Error, stdout: string, stderr: string) => {
                    error("合并操作异常，原因：", err);
                    error("标准输出：", stdout);
                    error("错误输出：", stderr);
                    reject(new Error(`视频合并失败：${err.message}`));
                })
                .on("end", () => {
                    log("视频合并成功完成");
                    resolve();
                })
                .run();
        });

        // 阶段5：结果上传
        log("准备上传合并结果");
        const videoData = await readFile(mergedOutput.name);
        const resultUrl = await uploadDataToServer(
            videoData,
            "video/mp4",
            `merged_${Date.now()}.mp4`,
            targetFolder
        );

        if (!resultUrl) {
            throw new Error("服务器未返回有效资源地址");
        }
        return resultUrl;
    } catch (err) {
        error("视频处理流程异常终止：", err);
        throw err;
    } finally {
        // 清理临时文件
        log('启动临时文件清理');
        try {
            tempFileA.removeCallback();
            tempFileB.removeCallback();
            processedFileA.removeCallback();
            processedFileB.removeCallback();
            mergeListFile.removeCallback();
            mergedOutput.removeCallback();
            log('临时文件清理完成');
        } catch (e) {
            error(`清理临时文件失败: ${e instanceof Error ? e.message : '未知错误'}`);
        }
    }
}


/**
 * 检测视频是否包含音频流
 */
async function hasAudioStream(inputPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        error('ffprobe 检测失败: %O', err);
        return reject(err);
      }
      const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
      log(`音频流检测结果: ${hasAudio ? '存在' : '缺失'}`);
      resolve(hasAudio);
    });
  });
}


/**
 * 确保视频文件包含有效音频轨道（静音轨道或保留原音频）
 * @param inputPath 输入视频路径
 * @param outputPath 输出视频路径
 * @returns 返回处理后的文件信息
 */
export async function ensureAudioTrack(
  inputPath: string,
  outputPath: string
): Promise<{ name: string }> {
    log(`开始处理音频轨道: ${inputPath}`);

  try {
    // 检测音频流
    const hasAudio = await hasAudioStream(inputPath);

    // 执行音频处理
    await new Promise<void>((resolve, reject) => {
      const command = 
          (ffmpeg() as any)
        .input(inputPath)
        .outputOptions([
          '-c:v copy',          // 保持视频流不变
          '-map_metadata 0',    // 保留元数据
          '-movflags +faststart' // 优化网络播放
        ]);

      if (hasAudio) {
        log(`保留原始音频并进行标准化`);
        command
          .outputOptions([
            '-c:a aac',         // 转码为兼容AAC格式
            '-ar 44100',        // 标准化采样率
            '-b:a 128k'         // 固定比特率
          ]);
      } else {
        log(`添加静音音频轨道`);
        command
            .input('anullsrc=channel_layout=stereo:sample_rate=44100')
            .inputFormat('lavfi')       
            .outputOptions([
                '-shortest',        // 使音频与视频长度一致
                '-c:a aac',
                '-map 0:v:0',       // 映射原始视频流
                '-map 1:a:0'        // 映射生成的音频流
                ]);
      }

      command
        .output(outputPath)
        .on('start', (cmdline:any) => log(`执行FFmpeg命令: ${cmdline}`))
        .on('error', (err:any) => {
          error('音频处理失败: %O', err);
          reject(new Error(`音频处理失败: ${err.message}`));
        })
        .on('end', () => {
          log(`音频处理完成: ${outputPath}`);
          resolve();
        })
        .run();
    });

    return { name: outputPath };
  } catch (err) {
    log('音频轨道处理异常: %O', err);
    throw new Error(`无法确保音频轨道: ${err instanceof Error ? err.message : '未知错误'}`);
  }
}

async function getVideoMetadata(videoPath: string) {
    return new Promise<{ duration: number; hasAudio: boolean }>((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration;
            if (!duration) return reject(new Error('无法获取视频时长'));
            const hasAudio = metadata.streams.some((stream) => stream.codec_type === 'audio');            
            resolve({ duration, hasAudio  });
        });
    });
}


/**
 * 在本地调整视频速度并（减速时）插帧
 * @param videoPath 本地视频文件路径
 * @param speed 速度倍数，>1 加速，<1 减速
 * @param outputFPS 减速时插帧目标帧率
 * @returns 处理后视频的本地临时文件路径
 */
export async function changeLocalVideoSpeed(
  videoPath: string,
  speed: number = 2,
  outputFPS: number = 30
): Promise<string> {
  log("本地视频速度调整开始，文件：", videoPath, "速度：", speed);

  // 输出临时文件
  const tempOutput = tmp.fileSync({ postfix: ".mp4" });

  await new Promise<void>((resolve, reject) => {
    // 音频 atempo 最多支持 0.5–2.0 范围，低速需链式
    const audioFilters =
      speed >= 0.5
        ? [`atempo=${speed}`]
        : [`atempo=0.5`, `atempo=${speed / 0.5}`];

    // 视频 PTS 变换，减速时插帧
    const vf = [
      `setpts=${1 / speed}*PTS`,
      speed < 1 ? `minterpolate=fps=${outputFPS}` : null,
    ]
      .filter(Boolean)
      .join(",");

            (ffmpeg() as any)
      .input(videoPath)
      .videoFilters(vf)
      .audioFilters(audioFilters)
      .outputOptions("-preset ultrafast")
      .on("start", (cmd:any) => log("FFmpeg 本地处理命令：", cmd))
                .on('error', (err: Error, stdout: string, stderr: string) => {
        error("FFmpeg 本地处理出错：", err);
        error("stdout:", stdout);
        error("stderr:", stderr);
        reject(err);
      })
      .on("end", () => {
        log("本地视频处理完成，输出：", tempOutput.name);
        resolve();
      })
      .save(tempOutput.name);
  });

  return tempOutput.name;
}

/**
 * 下载远程视频，调整速度后上传，最后清理临时文件
 * @param videoURL 远程视频 URL
 * @param speed 速度倍数，>1 加速，<1 减速
 * @param outputFPS 减速时插帧目标帧率
 * @param folder 上传目标文件夹
 * @returns 新视频的线上 URL
 */
export async function changeVideoSpeed(
  videoURL: string,
  speed: number = 2,
  outputFPS: number = 30,
  folder: string = "T"
): Promise<string> {
  log("开始调整视频速度，URL：", videoURL, "速度：", speed);

  // 1. 下载到本地
  const tempInput = await downloadToLocal(videoURL);
  let tempOutput: string | undefined;

  try {
    // 2. 本地处理
    tempOutput = await changeLocalVideoSpeed(tempInput, speed, outputFPS);

    // 3. 读取并上传
    const buffer = await readFile(tempOutput);
    const uploadedUrl = await uploadDataToServer(
      buffer,
      "video/mp4",
      `${Date.now()}_speed_${speed}.mp4`,
      folder
    );
    if (!uploadedUrl) {
      throw new Error("上传失败：uploadDataToServer 未返回有效 URL");
    }
    log("新视频文件上传完成，地址：", uploadedUrl);
    return uploadedUrl;
  } catch (err) {
    error("调整视频速度失败：", err);
    throw err;
  } finally {
    // 4. 清理临时文件
    try { await deleteLocalFile(tempInput); } catch { /* ignore */ }
    if (tempOutput) {
      try { await deleteLocalFile(tempOutput); } catch { /* ignore */ }
    }
  }
}




export async function normalizeVideo(videoURL: string, folder: string = "T") {
    log("开始重编码视频：", videoURL);

    // 创建临时文件
    const tempInputFile = tmp.fileSync({ postfix: '.mp4' });
    const tempOutputFile = tmp.fileSync({ postfix: '.mp4' });

    try {
        // 下载视频到本地
        await downloadVideoToFile(videoURL, tempInputFile.name);
        log("视频下载完成：", tempInputFile.name);

        // 检查视频输入文件
        const inputInfo = await getVideoInfo(tempInputFile.name);
        log("视频信息：", inputInfo);

        // 使用 FFmpeg 处理视频
        await new Promise<void>((resolve, reject) => {
            (ffmpeg(tempInputFile.name) as any)
                .output(tempOutputFile.name)
                .videoCodec('libx264') // 使用标准的H.264视频编码
                .audioCodec('aac') // 使用AAC音频编码
                .audioBitrate('128k') // 设置音频比特率为128k
                .videoBitrate('1500k') // 设置视频比特率为1500k
                .fps(30) // 设置标准帧率为30fps
                .outputOptions([
                    '-preset fast', // 快速编码预设
                    '-movflags +faststart', // 优化视频流，避免播放时卡顿
                    '-vf setpts=PTS-STARTPTS', // 修复视频时间戳
                    '-af asetpts=PTS-STARTPTS', // 修复音频时间戳
                    '-map_metadata -1' // 删除旧的元数据
                ])
                .on('start', (commandLine:any) => log("FFmpeg Command:", commandLine))
            .on('error', (err: Error, stdout: string, stderr: string) => {
                    log("FFmpeg Error:", err.message);
                    log("FFmpeg STDOUT:", stdout);
                    log("FFmpeg STDERR:", stderr);
                    reject(err);
                })
                .on('end', () => {
                    log("视频处理完成，输出文件：", tempOutputFile.name);
                    resolve();
                })
                .save(tempOutputFile.name);
        });

        // 检查输出文件是否存在
        if (!fs.existsSync(tempOutputFile.name)) {
            throw new Error("输出文件未生成");
        }

        // 检查输出视频的元数据
        const outputInfo = await getVideoInfo(tempOutputFile.name);
        log("输出视频信息：", outputInfo);

        // 上传重编码后的视频文件
        const videoBuffer = await readFile(tempOutputFile.name);
        const newVideoURL = await uploadDataToServer(videoBuffer, "video/mp4", `${Date.now()}_normalized.mp4`, folder);
        log("重编码视频上传完成，地址：", newVideoURL);

        return newVideoURL;
    } catch (err) {
        log("重编码视频时发生错误：", err);
        throw err;
    } finally {
        // 清理临时文件
        tempInputFile.removeCallback();
        tempOutputFile.removeCallback();
    }
}

// 用ffprobe获取视频信息的辅助函数
async function getVideoInfo(filePath: string) {
    return new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata);
            }
        });
    });
}





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 视频格式支持矩阵
// 输入格式    处理方式                                                                               
// MOV       兼容ProRes/H.264编码，自动处理HEVC/H.265，保留Alpha通道（需特殊参数）                      
// AVI       支持Xvid/DivX等常见编码，修复时间戳问题                                                  
// MKV       兼容H.265/VP9编码，支持多音轨和字幕流                                                    
// WMV       需要wmv3解码器支持，自动修复ASF容器时间戳                                                
// FLV       自动处理H.263/Sorenson编码，修复元数据                                                  
// WEBM      VP8/VP9到H.264转码，启用多线程优化                                                      
// MPEG      包括MPEG-1/2格式，优化量化参数                                                           

// 格式类型      支持情况    注意事项                                                                 
// iPhone MOV    ✅        自动处理HEVC/H.265编码，修正旋转元数据                                      
// Android MP4   ✅        自动处理可变帧率，标准化为30fps                                             
// ASF/WMV       ✅        需确保ffmpeg编译时包含--enable-decoder=wm*                                  
// 3GP           ✅        自动处理AMR-NB音频，优化低比特率音质                                        
// HEVC/H.265    ✅        需要x265库支持，4K视频建议启用硬件加速                                      
// VC-1          ✅        需要非自由解码器，建议使用官方编译版本                                        
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 硬件加速配置（跨平台兼容）
const HW_ACCEL = {
    enable: false,
    type: 'cuda' as 'cuda' | 'qsv' | 'videotoolbox', // 加速类型
    device: process.platform === 'linux' ? '/dev/dri/renderD128' : 'auto' // 动态设备路径
};

export async function convertVideoToMP4(source: string, targetFolder: string = "T") {
    const inputExt = path.extname(source).toLowerCase();
    const tempFiles: tmp.FileResult[] = [];
    
    try {
        // 创建自动清理的临时文件
        const [tempInput, tempOutput] = [
            createTempFile(inputExt || '.tmp'),
            createTempFile('.mp4')
        ];
        tempFiles.push(tempInput, tempOutput);

        // 获取输入文件（支持远程和本地）
        await fetchSourceFile(source, tempInput.name);

        // 深度媒体分析（含最低比特率校验）
        const mediaInfo = await probeMediaInfo(tempInput.name);
        logMediaAnalysis(mediaInfo);

        // 构建智能转换命令
        const command = buildFFmpegCommand({
            inputPath: tempInput.name,
            outputPath: tempOutput.name,
            mediaInfo
        });

        // 执行带重试机制的转换
        await executeFFmpegWithRetry(command, 3);

        // 验证并上传结果文件
        return await validateAndUpload(tempOutput.name, source, targetFolder);
    } catch (error) {
        handleConversionError(error);
        throw error;  // 统一错误处理
    } finally {
        cleanupTempFiles(tempFiles);
    }
}

/* 核心辅助函数模块 */
function createTempFile(postfix: string): tmp.FileResult {
    const file = tmp.fileSync({ postfix });
    process.on('exit', () => file.removeCallback());
    return file;
}

async function fetchSourceFile(source: string, tempPath: string): Promise<void> {
    if (/^(https?|ftp):\/\//.test(source)) {
        await downloadVideoToFile(source, tempPath); // 使用自定义下载函数
    } else if (fs.existsSync(source)) {
        await fs.promises.copyFile(source, tempPath);
    } else {
        throw new Error(`无效输入源: ${source}`);
    }
}

// 新增视频旋转信息解析函数
function getVideoRotation(stream?: ffmpeg.FfprobeStream): number {
    if (!stream || !stream.tags) return 0;
    
    // 处理不同格式的旋转标记
    const rotateTag = stream.tags.rotate;
    if (!rotateTag) return 0;

    // 转换字符串型数值
    const numericValue = typeof rotateTag === 'string' 
        ? parseInt(rotateTag, 10)
        : rotateTag;

    // 返回标准化角度（仅支持 0°、90°、180°、270°）
    switch (Math.abs(numericValue)) {
        case 90:
            return 90;
        case 180:
            return 180;
        case 270:
            return 270;
        default:
            return 0;
    }
}

async function probeMediaInfo(filePath: string): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
        (ffmpeg as any).ffprobe(filePath, (err:any, metadata:any) => {
            if (err) return reject(err);
            
            const formatName = metadata.format?.format_name?.split(',')[0] || 'unknown';
            const videoStream = metadata.streams.find((s:any) => s.codec_type === 'video');
            const audioStream = metadata.streams.find((s:any) => s.codec_type === 'audio');

            // 处理profile字段类型
            const rawProfile = videoStream?.profile;
            const profile = typeof rawProfile === 'number' 
                ? rawProfile 
                : Number(rawProfile) || undefined;

            resolve({
                format: formatName,
                videoCodec: videoStream?.codec_name,
                profile, // 返回数字或undefined
                bitrate: Math.max(parseInt(videoStream?.bit_rate || '0'), 500_000),
                isVFR: videoStream?.r_frame_rate !== videoStream?.avg_frame_rate,
                audioCodec: audioStream?.codec_name,
                isAlpha: Boolean(videoStream?.pix_fmt?.includes('alpha')),
                rotation: getVideoRotation(videoStream)
            });
        });
    });
}

function buildFFmpegCommand(params: {
    inputPath: string;
    outputPath: string;
    mediaInfo: MediaInfo;
}): ffmpeg.FfmpegCommand {
    const { inputPath, outputPath, mediaInfo } = params;
    const command = ffmpeg(inputPath);
    
    // 基础配置（兼容主流设备）
    (command as any)
        .output(outputPath)
        .outputFormat('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioFrequency(44100)
        .outputOptions([
            '-preset', 'faster',
            '-crf', '23',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-max_muxing_queue_size', '1024',
            '-map_metadata', '0',        // 拆分为独立参数
            '-movflags', 'use_metadata_tags'
        ]);

    // 硬件加速配置（NVIDIA/Intel/Apple）
    if (HW_ACCEL.enable) {
        command
            .inputOption(`-hwaccel ${HW_ACCEL.type}`)
            .outputOption(`-hwaccel_device ${HW_ACCEL.device}`);
    }

    // 格式特化处理（覆盖所有支持格式）
    applyFormatSpecificOptions(command, mediaInfo);

    // 旋转修正（处理手机录像方向）
    if (mediaInfo.rotation) {
        command.videoFilter(`transpose=${mediaInfo.rotation/90}`);
    }

    return command;
}

function applyFormatSpecificOptions(command: ffmpeg.FfmpegCommand, info: MediaInfo): void {
    // MOV处理（ProRes/HEVC优化）
    if (info.format === 'mov') {
        if (info.videoCodec === 'prores') {
            command.inputOption('-profile:v 3'); // ProRes HQ配置
        }
        // Alpha通道处理（兼容MP4）
        if (info.isAlpha) {
            command.outputOptions([
                '-x264opts keyint=30:ref=3:qp=22',
                '-profile:v high444'
            ]);
        }
    }

    // ASF/WMV处理（时间戳修复）
    if (info.format === 'asf' || info.format === 'wmv') {
        command.inputOptions([
            '-fflags +genpts',    // 重新生成时间戳
            '-noindex',
            '-correct_ts_overflow 0'
        ]);
    }

    // AVI处理（Xvid/DivX兼容）
    if (info.format === 'avi') {
        command.inputOptions([
            // '-flip_hebrew 0',  // 这个参数可能是从某个自定义版本或特定平台（如老式 Windows 系统、某些嵌入设备）误用而来的，但在标准 Ubuntu FFmpeg 发行版（包括你当前用的 ffmpeg 4.4.2）中并不存在。
            '-mbd rd -flags +mv4+aic' // 运动补偿优化
        ]);
    }

    // WebM/VP9处理（多线程加速）
    if (info.videoCodec === 'vp8' || info.videoCodec === 'vp9') {
        command.outputOptions(['-row-mt 1', '-cpu-used 3']);
    }

    // MPEG处理（量化优化）
    if (info.format === 'mpeg') {
        command
            .inputOption('-mpeg2_mpv_options true:all')
            .outputOption('-qscale:v 2');
    }

    // 可变帧率标准化（Android兼容）
    if (info.isVFR) {
        command.outputOptions([
            '-vsync vfr',
            '-r 30' // 标准化为30fps
        ]);
    }
}

/* 执行与重试机制 */
async function executeFFmpegWithRetry(command: ffmpeg.FfmpegCommand, retries: number) {
    while (retries-- > 0) {
        try {
            await executeFFmpeg(command);
            return;
        } catch (err) {
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, 1000));
            console.log(`剩余重试次数: ${retries}`);
        }
    }
}

async function executeFFmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
    return new Promise((resolve, reject) => {
        (command as any)
            .on('start', (cmd:any) => console.log(`[FFmpeg启动] ${cmd}`))
            .on('progress', (p:any) => {
                console.log(`[转换进度] ${p.timemark} (${p.percent?.toFixed(1)}%)`);
            })
            .on('error', (err: Error, stdout: string, stderr: string) => {
                console.error(`[FFmpeg错误] ${err.message}\n[STDERR] ${stderr}`);
                reject(err);
            })
            .on('end', () => resolve())
            .run();
    });
}

/* 文件验证与上传 */
async function validateAndUpload(outputPath: string, source: string, targetFolder: string) {
    // 增强文件验证
    const stats = fs.statSync(outputPath);
    if (stats.size < 1024 || stats.size > 1024 * 1024 * 1024 /*1GB*/) {
        throw new Error('无效输出文件');
    }

    // 生成规范文件名
    const originalName = path.parse(source).name.replace(/[^\w]/g, '_');
    const uploadName = `${originalName}_${Date.now()}.mp4`;

    // 上传到存储服务
    return uploadDataToServer(
        await fs.promises.readFile(outputPath),
        "video/mp4",
        uploadName,
        targetFolder
    );
}

/* 类型定义 */
interface MediaInfo {
    format: string;
    videoCodec?: string;
    profile?: number; // 修正为数字类型
    bitrate: number;
    isVFR: boolean;
    audioCodec?: string;
    isAlpha: boolean;
    rotation: number;
}

/* 日志与清理 */
function logMediaAnalysis(info: MediaInfo): void {
    console.log('[媒体分析]', {
        format: info.format,
        codec: `${info.videoCodec}/${info.audioCodec}`,
        rotation: `${info.rotation}°`,
        bitrate: `${(info.bitrate / 1e6).toFixed(2)} Mbps`
    });
}

function cleanupTempFiles(files: tmp.FileResult[]): void {
    files.forEach(file => {
        try {
            fs.existsSync(file.name) && fs.unlinkSync(file.name);
            file.removeCallback();
        } catch (err:any) {
            console.error(`临时文件清理失败: ${err.message}`);
        }
    });
}

function handleConversionError(error: any): void {
    console.error(`[转换失败] ${error instanceof Error ? error.stack : error}`);
}




/**
 * 获取视频的宽度和高度
 */
export async function getVideoSize(videoURL: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoURL, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');

      if (!videoStream || !videoStream.width || !videoStream.height) {
        return reject(new Error('未能从视频中提取宽高信息'));
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height
      });
    });
  });
}



/**
 * 将多个图片叠加到视频指定位置上
 */
interface OverlayImage {
  imageURL: string;
  x: number;
  y: number;
}

export async function putImagesOnVideo(videoURL: string, overlays: OverlayImage[], folder = "U"): Promise<string> {
  log("putImagesOnVideo");

  if (!overlays || overlays.length === 0) {
    log("未提供任何叠加图像，直接返回原始视频");
    return videoURL;
  }

  const tempOutputFile = tmp.fileSync({ postfix: ".mp4" });
  const tempOutputPath = tempOutputFile.name;

  try {
    const ffmpegCommand = ffmpeg(videoURL);

    // 添加每个 overlay 输入
    overlays.forEach(overlay => {
      ffmpegCommand.input(overlay.imageURL);
    });

    // 构建 filter chain
    const filterParts: string[] = [];
    let currentLabel = "[0:v]"; // 初始视频

    overlays.forEach((overlay, i) => {
      const inputLabel = `[${i + 1}:v]`; // 每张图片是从 [1:v], [2:v]... 开始
      const outputLabel = `[tmp${i}]`;
      const filter = `${currentLabel}${inputLabel} overlay=${overlay.x}:${overlay.y} ${outputLabel}`;
      filterParts.push(filter);
      currentLabel = outputLabel;
    });

    const finalLabel = currentLabel;
    
    (ffmpegCommand as any)
      .complexFilter(filterParts.join("; ")) // 删除第二个参数
      .outputOptions([
        "-map", finalLabel,   // 视频映射 (唯一)
        "-map", "0:a?",       // 音频可选映射
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-shortest",
        "-f", "mp4"
      ])
      .on("start", (cmd:any) => log("FFmpeg 启动命令:", cmd))
      .on("progress", (p:any) => log("叠加进度:", p))
        .on('error', (err: Error, stdout: string, stderr: string) => {
        error("视频叠加出错:", err);
        error("stdout:", stdout);
        error("stderr:", stderr);
      });

    await new Promise<void>((resolve, reject) => {
      (ffmpegCommand as any).save(tempOutputPath).on("end", resolve).on("error", reject);
    });

    const buffer = fs.readFileSync(tempOutputPath);
    const finalUrl = await uploadDataToServer(buffer, "video/mp4", `${Date.now()}_overlay_video.mp4`, folder);
    if (!finalUrl) throw new Error("上传失败，未返回 URL");

    log("上传完成，返回地址：", finalUrl);
    return finalUrl;
  } catch (err) {
    error("putImagesOnVideo 发生错误：", err);
    throw err;
  } finally {
    tempOutputFile.removeCallback();
  }
}


export async function putWechatQR(videoURL: string, config: any, user: any) {
    const qr = `${config.RS}/niukit/wechat/gw_qrcode_64.jpg`; // 建议视频用png透明图
    let result = videoURL;

    try {
        // 获取视频分辨率
        const size = await getVideoSize(videoURL);  // 你需要有这个工具函数，返回 {width, height}
        if (size && size.width && size.height && size.width > 100 && size.height > 100) {
            const x = size.width - 80;  // 稍微留边
            const y = size.height - 80;

            result = await putImagesOnVideo(videoURL, [
                {
                    imageURL: qr,
                    x,
                    y,
  //                  width: 64,
  //                  height: 64,
                },
            ]) || result;
        }
    } catch (err) {
        error("putWechatQRonVideo:", err);
    }

    return result;
}
