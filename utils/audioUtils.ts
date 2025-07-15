import { moveToFileServer, uploadDataToServer } from "./fileServer";
import * as debug from "./debug";
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';

//const ffmpeg = require('fluent-ffmpeg');
// const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { PassThrough } = require('stream');
const path = require('path');
const fs = require('fs');
import { writeFile } from 'fs/promises';

const tmp = require('tmp');
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
import { exec } from 'child_process';



/**
 * 下载文件的工具函数
 * @param url 文件的 URL
 * @returns 文件的 Buffer
 */
async function downloadFile(url: string): Promise<Buffer> {
    const axios = await import('axios'); // 动态加载 axios 以减少依赖
    const response = await axios.default.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

// 计算一个URL上的音频的时长，可能格式mp3,ogg,wav
export async function getDuration(url:string): Promise<number>{
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(url,  (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration ?? 0); 
        });
    });
}

/*
 * 将 MPGA 文件转换为 MP3 格式并上传到文件服务器
 * @param inputMpgaUrl MPGA 文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的 MP3 文件 URL
 */
export async function convertMpgaToMp3(inputMpgaUrl: string, folder: string = "U"): Promise<string> {
    debug.log("convertMpgaToMp3");

    // 创建临时 MP3 文件（扩展名必须显式指定）
    const tempMp3File = tmp.fileSync({ postfix: '.mp3' });
    const tempMp3Path = tempMp3File.name;

    try {
        // 下载 MPGA 文件到本地临时路径
        const tempMpgaFile = tmp.fileSync({ postfix: '.mpga' });
        const tempMpgaPath = tempMpgaFile.name;

        debug.log("下载 MPGA 文件中...");
        const mpgaFileBuffer = await downloadFile(inputMpgaUrl);
        fs.writeFileSync(tempMpgaPath, mpgaFileBuffer);
        debug.log("MPGA 文件已下载：", tempMpgaPath);

        // 使用 FFmpeg 转换 MPGA 到 MP3
        await new Promise<void>((resolve, reject) => {
            (ffmpeg(tempMpgaPath) as any)
                .output(tempMp3Path)
                .audioCodec('libmp3lame')
                .audioQuality(2)
                .on('start', (cmd: string) => {
                    debug.log('FFmpeg命令:', cmd);
                })
                .on('error', (err: Error) => {
                    debug.error('转换失败: ', err);
                    reject(err);
                })
                .on('end', () => {
                    debug.log('转换完成');
                    resolve();
                })
                .run();
        });

        // 读取并上传 MP3 文件
        const mp3Buffer = fs.readFileSync(tempMp3Path);
        const newMp3URL = await uploadDataToServer(
            mp3Buffer,
            "audio/mpeg",
            `${Date.now()}_converted.mp3`,
            folder
        );

        if (!newMp3URL) throw new Error("上传后未返回有效URL");
        return newMp3URL;
    } catch (err) {
        debug.error('convertMpgaToMp3 错误:', err);
        throw err; // 向上抛出错误供调用方处理
    } finally {
        // 强制清理临时文件（防止磁盘泄漏）
        tempMp3File.removeCallback();
    }
}


/**
 * 将 OGG 文件转换为 MP3 格式并上传到文件服务器
 * @param inputOggUrl OGG 文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的 MP3 文件 URL
 */
export async function convertOggToMp3(inputOggUrl: string, folder: string = "U"): Promise<string> {
    debug.log("convertOggToMp3");

    // 创建临时 MP3 文件
    const tempMp3File = tmp.fileSync({ postfix: '.mp3' });
    const tempMp3Path = tempMp3File.name;

    try {
        // 下载 OGG 文件到本地临时路径
        const tempOggFile = tmp.fileSync({ postfix: '.ogg' });
        const tempOggPath = tempOggFile.name;

        debug.log("下载 OGG 文件中...");
        const oggFileBuffer = await downloadFile(inputOggUrl); // 假设有一个下载文件的函数
        fs.writeFileSync(tempOggPath, oggFileBuffer);
        debug.log("OGG 文件已下载：", tempOggPath);

        // 将 OGG 文件转换为 MP3
        await new Promise<void>((resolve, reject) => {
            (ffmpeg(tempOggPath) as any)
                .output(tempMp3Path)
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('转换 OGG 到 MP3 的 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('OGG 到 MP3 转换错误: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("OGG 到 MP3 转换完成，生成文件：", tempMp3Path);
                    resolve();
                })
                .run();
        });

        // 上传 MP3 文件到服务器
        const mp3Buffer = fs.readFileSync(tempMp3Path);
        const newMp3URL = await uploadDataToServer(mp3Buffer, "audio/mpeg", Date.now().toString() + "_converted.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newMp3URL) {
            throw new Error("上传失败，未能获取新 MP3 文件的 URL");
        }

        debug.log("上传完成，新 MP3 文件 URL: ", newMp3URL);
        return newMp3URL;
    } catch (err) {
        debug.error('convertOggToMp3 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempMp3File.removeCallback();
    }
}


/**
 * 将 M4A 文件转换为 MP3 格式并上传到文件服务器
 * @param inputM4aUrl M4A 文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的 MP3 文件 URL
 */
export async function convertM4aToMp3(inputM4aUrl: string, folder: string = "U"): Promise<string> {
    debug.log("convertM4aToMp3");

    // 创建临时 MP3 文件
    const tempMp3File = tmp.fileSync({ postfix: '.mp3' });
    const tempMp3Path = tempMp3File.name;

    try {
        // 下载 M4A 文件到本地临时路径
        const tempM4aFile = tmp.fileSync({ postfix: '.m4a' });
        const tempM4aPath = tempM4aFile.name;

        debug.log("下载 M4A 文件中...");
        const m4aFileBuffer = await downloadFile(inputM4aUrl); // 假设有一个下载文件的函数
        fs.writeFileSync(tempM4aPath, m4aFileBuffer);
        debug.log("M4A 文件已下载：", tempM4aPath);

        // 将 M4A 文件转换为 MP3
        await new Promise<void>((resolve, reject) => {
            (ffmpeg(tempM4aPath) as any)
                .output(tempMp3Path)
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('转换 M4A 到 MP3 的 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('M4A 到 MP3 转换错误: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("M4A 到 MP3 转换完成，生成文件：", tempMp3Path);
                    resolve();
                })
                .run();
        });

        // 上传 MP3 文件到服务器
        const mp3Buffer = fs.readFileSync(tempMp3Path);
        const newMp3URL = await uploadDataToServer(mp3Buffer, "audio/mpeg", Date.now().toString() + "_converted.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newMp3URL) {
            throw new Error("上传失败，未能获取新 MP3 文件的 URL");
        }

        debug.log("上传完成，新 MP3 文件 URL: ", newMp3URL);
        return newMp3URL;
    } catch (err) {
        debug.error('convertM4aToMp3 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempMp3File.removeCallback();
    }
}



/**
 * 拼接两个音频文件并上传到文件服务器
 * @param audioUrl1 第一个音频文件的 URL
 * @param audioUrl2 第二个音频文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的拼接音频文件 URL
 */
export async function concatAudioFiles(audioUrl1: string, audioUrl2: string, folder: string = "U"): Promise<string> {
     debug.log("concatenateAudioFiles");

    // 创建临时输出音频文件
    const tempOutputFile = tmp.fileSync({ postfix: '.mp3' });
    const tempOutputPath = tempOutputFile.name;

    try {
        // 下载两个音频文件到本地临时路径
        const tempAudioFile1 = tmp.fileSync({ postfix: '.mp3' });
        const tempAudioPath1 = tempAudioFile1.name;
        const tempAudioFile2 = tmp.fileSync({ postfix: '.mp3' });
        const tempAudioPath2 = tempAudioFile2.name;

        debug.log("下载第一个音频文件中...");
        const audioBuffer1 = await downloadFile(audioUrl1);
        fs.writeFileSync(tempAudioPath1, audioBuffer1);
        debug.log("第一个音频文件已下载：", tempAudioPath1);

        debug.log("下载第二个音频文件中...");
        const audioBuffer2 = await downloadFile(audioUrl2);
        fs.writeFileSync(tempAudioPath2, audioBuffer2);
        debug.log("第二个音频文件已下载：", tempAudioPath2);

        // 使用 FFmpeg 拼接音频文件（不需要文本文件）
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempAudioPath1)
                .input(tempAudioPath2)
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('拼接音频 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('拼接音频出错: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("音频拼接完成，生成文件：", tempOutputPath);
                    resolve();
                })
                .output(tempOutputPath)
                .complexFilter([
                    // 拼接两个音频文件，n=2表示有两个输入文件，a=1表示处理音频流
                    '[0][1]concat=n=2:v=0:a=1[out]'
                ])
                .outputOptions('-map', '[out]') // 指定输出的音频流
                .run();
        });

        // 上传拼接后的音频文件到服务器
        const outputAudioBuffer = fs.readFileSync(tempOutputPath);
        const newAudioURL = await uploadDataToServer(outputAudioBuffer, "audio/mpeg", Date.now().toString() + "_concatenated.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newAudioURL) {
            throw new Error("上传失败，未能获取新音频文件的 URL");
        }

        debug.log("上传完成，新音频文件 URL: ", newAudioURL);

        return newAudioURL;
    } catch (err) {
        debug.error('concatenateAudioFiles 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempOutputFile.removeCallback();
    }
}

/**
 * 将 AAC 文件转换为 MP3 格式并上传到文件服务器
 * @param inputAacUrl AAC 文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的 MP3 文件 URL
 */
export async function convertAacToMp3(inputAacUrl: string, folder: string = "U"): Promise<string> {
    debug.log("convertAacToMp3");

    // 创建临时 MP3 文件
    const tempMp3File = tmp.fileSync({ postfix: '.mp3' });
    const tempMp3Path = tempMp3File.name;

    try {
        // 下载 AAC 文件到本地临时路径
        const tempAacFile = tmp.fileSync({ postfix: '.aac' });
        const tempAacPath = tempAacFile.name;

        debug.log("下载 AAC 文件中...");
        const aacFileBuffer = await downloadFile(inputAacUrl); // 假设有一个下载文件的函数
        fs.writeFileSync(tempAacPath, aacFileBuffer);
        debug.log("AAC 文件已下载：", tempAacPath);

        // 将 AAC 文件转换为 MP3
        await new Promise<void>((resolve, reject) => {
            (ffmpeg(tempAacPath) as any)
                .output(tempMp3Path)
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('转换 AAC 到 MP3 的 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('AAC 到 MP3 转换错误: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("AAC 到 MP3 转换完成，生成文件：", tempMp3Path);
                    resolve();
                })
                .run();
        });

        // 上传 MP3 文件到服务器
        const mp3Buffer = fs.readFileSync(tempMp3Path);
        const newMp3URL = await uploadDataToServer(mp3Buffer, "audio/mpeg", Date.now().toString() + "_converted.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newMp3URL) {
            throw new Error("上传失败，未能获取新 MP3 文件的 URL");
        }

        debug.log("上传完成，新 MP3 文件 URL: ", newMp3URL);
        return newMp3URL;
    } catch (err) {
        debug.error('convertAacToMp3 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempMp3File.removeCallback();
    }
}


/**
 * 合并两个音频文件并上传到文件服务器
 * @param audioUrl1 第一个音频文件的 URL
 * @param audioUrl2 第二个音频文件的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的合并音频文件 URL
 */
export async function mergeAudioFiles(audioUrl1: string, audioUrl2: string, folder: string = "U"): Promise<string> {
    debug.log("mergeAudioFiles");

    // 创建临时输出音频文件
    const tempOutputFile = tmp.fileSync({ postfix: '.mp3' });
    const tempOutputPath = tempOutputFile.name;

    try {
        // 下载两个音频文件到本地临时路径
        const tempAudioFile1 = tmp.fileSync({ postfix: '.mp3' });
        const tempAudioPath1 = tempAudioFile1.name;
        const tempAudioFile2 = tmp.fileSync({ postfix: '.mp3' });
        const tempAudioPath2 = tempAudioFile2.name;

        debug.log("下载第一个音频文件中...");
        const audioBuffer1 = await downloadFile(audioUrl1);
        fs.writeFileSync(tempAudioPath1, audioBuffer1);
        debug.log("第一个音频文件已下载：", tempAudioPath1);

        debug.log("下载第二个音频文件中...");
        const audioBuffer2 = await downloadFile(audioUrl2);
        fs.writeFileSync(tempAudioPath2, audioBuffer2);
        debug.log("第二个音频文件已下载：", tempAudioPath2);

        // 使用 FFmpeg 合并音频文件
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempAudioPath1)
                .input(tempAudioPath2)
                .complexFilter([
                    '[0:0][1:0]amix=inputs=2:duration=longest:dropout_transition=3[aout]'
                ])
                .map('[aout]')
                .output(tempOutputPath)
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('合并音频 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('合并音频出错: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("音频合并完成，生成文件：", tempOutputPath);
                    resolve();
                })
                .run();
        });

        // 上传合并后的音频文件到服务器
        const outputAudioBuffer = fs.readFileSync(tempOutputPath);
        const newAudioURL = await uploadDataToServer(outputAudioBuffer, "audio/mpeg", Date.now().toString() + "_merged.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newAudioURL) {
            throw new Error("上传失败，未能获取新音频文件的 URL");
        }

        debug.log("上传完成，新音频文件 URL: ", newAudioURL);

        return newAudioURL;
    } catch (err) {
        debug.error('mergeAudioFiles 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempOutputFile.removeCallback();
    }
}



export async function trimAudio(inputAudioUrl: string, startPoint: number, secondsToTrim: number, outputFolder: string = "U"): Promise<string> {
    debug.log("trimAudioFromUrl");

    const tempOutputFile = tmp.fileSync({ postfix: ".mp3" });
    const tempOutputPath = tempOutputFile.name;

    try {
        // 获取音频文件的时长
        const audioMetadata = await new Promise<any>((resolve, reject) => {
            (ffmpeg() as any)
                .input(inputAudioUrl)
                .ffprobe((err: Error, metadata: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(metadata);
                    }
                });
        });

        const audioDuration = audioMetadata.format.duration || 0;
        debug.log("音频总时长：", audioDuration);

        // 检查 startPoint 和 secondsToTrim 是否有效
        if (startPoint < 0 || startPoint >= audioDuration) {
            throw new Error("起始时间点无效！");
        }

        const newDuration = Math.min(audioDuration - startPoint, secondsToTrim); // 截取音频的实际持续时长
        if (newDuration <= 0) {
            throw new Error("裁剪时长过短，无法生成音频！");
        }

        // 裁剪音频
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(inputAudioUrl)
                .outputOptions([
                    '-ss', startPoint.toString(), // 设置起始时间
                    '-t', newDuration.toString(), // 设置裁剪时长
                ])
                .audioCodec("libmp3lame") // 使用 MP3 编码器
                .on("start", (commandLine: string) => {
                    debug.log("裁剪音频 FFmpeg 命令: ", commandLine);
                })
                .on("error", (err: Error, stdout: string, stderr: string) => {
                    debug.error("裁剪音频出错: ", err);
                    debug.error("FFmpeg stdout: ", stdout);
                    debug.error("FFmpeg stderr: ", stderr);
                    reject(err);
                })
                .on("end", () => {
                    debug.log("裁剪音频完成，生成文件：", tempOutputPath);
                    resolve();
                })
                .save(tempOutputPath);
        });

        // 上传裁剪后的音频文件到服务器
        const audioBuffer = fs.readFileSync(tempOutputPath);
        const newAudioURL = await uploadDataToServer(
            audioBuffer,
            "audio/mp3",
            Date.now().toString() + "_trimmed_audio.mp3",
            outputFolder
        );
        debug.log("上传完成，新音频 URL: ", newAudioURL);

        // 检查返回的 URL 是否为 undefined
        if (!newAudioURL) {
            throw new Error("上传失败，未能获取新 MP3 文件的 URL");
        }

        return newAudioURL;
    } catch (err) {
        debug.error("trimAudioFromUrl 过程中发生错误:", err);
        throw err;
    } finally {
        // 清理临时文件
        tempOutputFile.removeCallback();
    }
}




// 把音频裁剪掉N秒
export async function cutOffAudio(inputAudioUrl: string, secondsToTrim: number, outputFolder: string = "U"): Promise<string> {
    debug.log("trimAudioFromUrl");

    const tempOutputFile = tmp.fileSync({ postfix: '.mp3' });
    const tempOutputPath = tempOutputFile.name;

    try {
        // 获取音频文件的时长
        const audioMetadata = await new Promise<any>((resolve, reject) => {
            (ffmpeg() as any)
                .input(inputAudioUrl)
                .ffprobe((err: Error, metadata: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(metadata);
                    }
                });
        });

        const audioDuration = audioMetadata.format.duration || 0;
        debug.log("音频总时长：", audioDuration);

        // 计算裁剪后的音频时长
        const newDuration = audioDuration - secondsToTrim;
        if (newDuration <= 0) {
            throw new Error("裁剪时间过长，音频时长不足！");
        }

        // 裁剪音频
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(inputAudioUrl)
                .outputOptions([
                    '-t', newDuration.toString() // 设置新的音频时长
                ])
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .on('start', (commandLine: string) => {
                    debug.log('裁剪音频 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('裁剪音频出错: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("裁剪音频完成，生成文件：", tempOutputPath);
                    resolve();
                })
                .save(tempOutputPath);
        });

        // 上传裁剪后的音频文件到服务器
        const audioBuffer = fs.readFileSync(tempOutputPath);
        const newAudioURL = await uploadDataToServer(audioBuffer, "audio/mp3", Date.now().toString() + "_trimmed_audio.mp3", outputFolder);
        debug.log("上传完成，新音频 URL: ", newAudioURL);
        
        // 检查返回的 URL 是否为 undefined
        if (!newAudioURL) {
            throw new Error("上传失败，未能获取新 MP3 文件的 URL");
        }
        
        return newAudioURL;
    } catch (err) {
        debug.error('trimAudioFromUrl 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempOutputFile.removeCallback();
    }
}


/**
 * 提取歌曲中的人声部分并转换为 MP3 格式
 * @param songURL 歌曲的 URL
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 上传后的包含人声的 MP3 文件 URL
 */
export async function extractVocals(songURL: string, folder: string = "U"): Promise<string> {
    debug.log("extractVocals");

    // 创建临时文件
    const tempSongFile = tmp.fileSync({ postfix: '.mp3' });
    const tempSongPath = tempSongFile.name;

    try {
        // 下载歌曲到本地临时路径
        debug.log("下载歌曲中...");
        const songFileBuffer = await downloadFile(songURL);
        fs.writeFileSync(tempSongPath, songFileBuffer);
        debug.log("歌曲已下载：", tempSongPath);

        // 使用 Spleeter 提取人声部分
        const tempVocalsFile = tmp.dirSync({ unsafeCleanup: true });
        const inputFileName = path.basename(tempSongPath, path.extname(tempSongPath));        
        const tempVocalsPath = path.join(tempVocalsFile.name, inputFileName, 'vocals.wav');

        debug.log("提取人声中...");
        await new Promise<void>((resolve, reject) => {
            exec(`spleeter separate -p spleeter:2stems -o ${tempVocalsFile.name} --mwf ${tempSongPath}`, (error, stdout, stderr) => {
                if (error) {
                    debug.error(`提取人声错误: ${stderr}`);
                    reject(error);
                } else {
                    debug.log(`提取人声完成: ${stdout}`);
                    resolve();
                }
            });
        });

        // 使用 FFmpeg 将 WAV 格式的人声转换为 MP3 格式
        const mp3VocalsFile = tmp.fileSync({ postfix: '_vocals.mp3' });
        const mp3VocalsPath = mp3VocalsFile.name;

        debug.log("转换人声为 MP3 格式...");
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempVocalsPath) // 输入文件路径
                .audioCodec('libmp3lame') // 使用 MP3 编码器
                .audioQuality(2) // 设置音频质量（相当于 -qscale:a 2）
                .on('start', (commandLine: string) => {
                    debug.log('转换 MP3 FFmpeg 命令: ', commandLine);
                })
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('转换 MP3 出错: ', err);
                    debug.error('FFmpeg stdout: ', stdout);
                    debug.error('FFmpeg stderr: ', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("转换 MP3 完成，生成文件：", mp3VocalsPath);
                    resolve();
                })
                .save(mp3VocalsPath); // 输出文件路径
        });

        // 读取 MP3 格式的人声文件
        const vocalsMp3Buffer = fs.readFileSync(mp3VocalsPath);

        // 上传人声音频文件到服务器
        const newVocalsURL = await uploadDataToServer(vocalsMp3Buffer, "audio/mpeg", Date.now().toString() + "_vocals.mp3", folder);

        // 检查返回的 URL 是否为 undefined
        if (!newVocalsURL) {
            throw new Error("上传失败，未能获取人声部分的 MP3 文件的 URL");
        }

        debug.log("上传完成，人声文件 URL: ", newVocalsURL);
        return newVocalsURL;
    } catch (err) {
        debug.error('extractVocals 过程中发生错误:', err);
        throw err;
    } finally {
        // 清理临时文件
        tempSongFile.removeCallback();
    }
}


/*
 * 提取音频中的人声和背景音乐部分并转换为 MP3 格式
 * @param audioURL 音频的 URL（可选）
 * @param audioPath 本地音频文件路径（可选）
 * @param folder 上传到服务器的文件夹名称，默认为 "U"
 * @returns 包含人声和背景音乐 URL 的对象
 * @throws 当既没有提供 audioURL 也没有提供 audioPath 时抛出错误
 */
export async function extractVocalsAndBackground(
    { audioURL, audioPath }: { audioURL?: string; audioPath?: string },
    folder: string = "U"
): Promise<{ vocalURL: string; bgURL: string }> {
    debug.log("extractVocalsAndBackground");

    // 声明所有临时资源引用
    let tempSongFile: any; // tmp.FileResult | undefined;
    let tempOutputDir: any; // tmp.DirResult | undefined;
    let mp3VocalsFile: any; // tmp.FileResult | undefined;
    let mp3BgFile: any; // tmp.FileResult | undefined;

    try {
        // 参数验证
        if (!audioURL && !audioPath) {
            throw new Error("必须提供 audioURL 或 audioPath 参数");
        }

        let tempSongPath: string;

        if (audioPath) {
            // 使用本地文件路径
            if (!fs.existsSync(audioPath)) {
                throw new Error(`本地音频文件不存在: ${audioPath}`);
            }
            tempSongPath = audioPath;
            debug.log("使用本地音频文件:", tempSongPath);
        } else {
            // 从 URL 下载音频
            tempSongFile = tmp.fileSync({ postfix: '.mp3' });
            tempSongPath = tempSongFile.name;

            debug.log("下载音频中...");
            const songFileBuffer = await downloadFile(audioURL!);
            fs.writeFileSync(tempSongPath, songFileBuffer);
            debug.log("音频已下载：", tempSongPath);
        }

        // 使用 Spleeter 提取人声和背景音乐部分
        tempOutputDir = tmp.dirSync({ unsafeCleanup: true });
        const inputFileName = path.basename(tempSongPath, path.extname(tempSongPath));        
        const tempVocalsPath = path.join(tempOutputDir.name, inputFileName, 'vocals.wav');
        const tempBgPath = path.join(tempOutputDir.name, inputFileName, 'accompaniment.wav');

        debug.log("提取人声和背景音乐中...");
        await new Promise<void>((resolve, reject) => {
            exec(
                `spleeter separate -p spleeter:2stems -o "${tempOutputDir.name}" --mwf "${tempSongPath}"`, 
                (error, stdout, stderr) => {
                    if (error) {
                        debug.error(`提取错误: ${stderr}`);
                        reject(error);
                    } else {
                        debug.log(`提取完成: ${stdout}`);
                        resolve();
                    }
                }
            );
        });

        // 转换人声为 MP3 格式
        mp3VocalsFile = tmp.fileSync({ postfix: '_vocals.mp3' });
        const mp3VocalsPath = mp3VocalsFile.name;

        debug.log("转换人声为 MP3 格式...");
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempVocalsPath)
                .audioCodec('libmp3lame')
                .audioQuality(2)
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('人声转换错误:', err);
                    debug.error('FFmpeg stdout:', stdout);
                    debug.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("人声 MP3 转换完成");
                    resolve();
                })
                .save(mp3VocalsPath);
        });

        // 转换背景音乐为 MP3 格式
        mp3BgFile = tmp.fileSync({ postfix: '_bg.mp3' });
        const mp3BgPath = mp3BgFile.name;

        debug.log("转换背景音乐为 MP3 格式...");
        await new Promise<void>((resolve, reject) => {
            (ffmpeg() as any)
                .input(tempBgPath)
                .audioCodec('libmp3lame')
                .audioQuality(2)
                .on('error', (err: Error, stdout: string, stderr: string) => {
                    debug.error('背景音乐转换错误:', err);
                    debug.error('FFmpeg stdout:', stdout);
                    debug.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .on('end', () => {
                    debug.log("背景音乐 MP3 转换完成");
                    resolve();
                })
                .save(mp3BgPath);
        });

        // 生成唯一文件名
        const timestamp = Date.now();
        const vocalsFileName = `${timestamp}_vocals.mp3`;
        const bgFileName = `${timestamp}_bg.mp3`;

        // 读取并上传人声文件
        const vocalsMp3Buffer = fs.readFileSync(mp3VocalsPath);
        const vocalURL = await uploadDataToServer(
            vocalsMp3Buffer, 
            "audio/mpeg", 
            vocalsFileName, 
            folder
        );

        // 读取并上传背景音乐文件
        const bgMp3Buffer = fs.readFileSync(mp3BgPath);
        const bgURL = await uploadDataToServer(
            bgMp3Buffer, 
            "audio/mpeg", 
            bgFileName, 
            folder
        );

        if (!vocalURL || !bgURL) {
            throw new Error("上传失败");
        }

        return { vocalURL, bgURL };
    } catch (err) {
        debug.error('处理错误:', err);
        throw err;
    } finally {
        // 统一清理所有临时资源（仅清理由本函数创建的临时文件）
        if (tempSongFile) tempSongFile.removeCallback();
        if (tempOutputDir) tempOutputDir.removeCallback();
        if (mp3VocalsFile) mp3VocalsFile.removeCallback();
        if (mp3BgFile) mp3BgFile.removeCallback();
    }
}
