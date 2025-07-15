import { useDropzone } from 'react-dropzone';
import { useCallback } from 'react';
import React, { useEffect, useState } from 'react';
import axios from "axios";
import { Icon } from '@iconify/react';

import * as debug from "../utils/debug";
import * as fu from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as OSS from "../utils/OSS";
import * as enums from "../utils/enums";

import LoadingButton from "../components/LoadingButton";

export const mimeTypes = fu.mimeTypes;

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

interface UploaderProps {
    setFiles: (files:any[]) => void;
    maxFiles?: number;
    minFiles?: number;
    maxFileSize?: number;
    mime?: any;
    className?: string;
    title?: string;
    desc?: string;
    showIcon?: boolean;
    showTitle?: boolean;
}

// TODO: Change names since this is a generic dropdown now
export default function Uploader({ setFiles, maxFiles=1, minFiles=1, maxFileSize=50, mime, 
                                  className, showIcon=false, showTitle=true,
                                  title, desc
                                  }: UploaderProps) {

    const [loadingStatus, setLoadingStatus] = useState<string>("");  // "LOADING", "CONVERTING"

    async function auditImage(image:string){
        if(image.indexOf(".jpg") >= 0 || image.indexOf(".jpeg") >= 0 || image.indexOf(".png") >= 0 || image.indexOf(".webp") >= 0){
            try{
                const res = await callAPI("/api/simpleAgent", {
                    cmd: "auditImage",
                    params: {
                        imageURL: image
                    }
                });
                if(res?.result?.generated){
                    //alert(res?.result?.generated);          
                    const scenes = JSON.parse(res.result.generated);
                    //alert(scenes.porn);
                    if(scenes.porn == "porn" || scenes.ad == "porn"){
                        alert("检测到上传的图片当中包含有不健康的画面！AI生成的图片中记录有完整的操作水印信息，请文明使用AI系统，传播色情、暴力、恐怖等内容可能触犯法律。");
                    }
                    if(scenes.terrorism == "bloody" || scenes.terrorism == "politics" || scenes.ad == "politics" || scenes.ad == "terrorism"){
                        alert("检测到上传的图片当中包含有暴恐或政治敏感信息！AI生成的图片中记录有完整的操作水印信息，请文明使用AI系统，传播色情、暴力、恐怖等内容可能触犯法律。");
                    }
                    if(scenes.terrorism == "drug" || scenes.live == "drug"){
                        alert("检测到上传的图片当中包含有和毒品相关的敏感信息！AI生成的图片中记录有完整的操作水印信息，请文明使用AI系统，传播色情、暴力、恐怖等内容可能触犯法律。");
                    }
                }
            }catch(err){
                debug.error(err);
            }
        }
    }  

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setLoadingStatus("LOADING");

        try{
            // 判断上传文件是否满足约束条件
            if(acceptedFiles.length > maxFiles){
                return alert("您最多可以选择" + maxFiles + "个文件");
            }
            if(acceptedFiles.length < minFiles){
                return alert("您最少要选择" + minFiles + "个文件");
            }
            for(const file of acceptedFiles){
                if(file.size/1024/1024 > maxFileSize){
                    return alert(`${file.name} 文件过大。不要超过${maxFileSize}M`);
                }
            }
          
            // 将所有接受的文件添加到formData对象
            const uploadedFiles:any[] = [];
            for(const file of acceptedFiles) {
                // 获得OSS签名
                const response = await fetch('/api/uploadService', {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                    },              
                    body: JSON.stringify({
                        cmd: "GetOSSSignature",
                        fileName: file.name,
                        fileType: file.type
                    })
                });
                if(response.status == enums.resStatus.OK){
                    const result = await response.json();
                    // 上传文件到OSS
                    const ret = await axios.put(result.signatureUrl.replace(/\+/g, '%2B'), file,
                                                {headers:{
                                                  'Content-Type': file.type
                                                }});
    
                    if(ret.status == enums.resStatus.OK) {
                        const uploadingFile = {
                            originalName: file.name,
                            uploadedUrl: result.url,
                            fileType: file.type,
                            fileSize: file.size,
                        }
                        uploadedFiles.push(uploadingFile);
    
                        // 转换不常见的音频格式
                        const ext = fu.getFileExtFromURL(result.url)?.toLowerCase() || "";
                        let convertCMD = null;
                        if(["ogg", "aac", "m4a", ".mpga"].includes(ext)){
                            convertCMD = "CONVERT_AUDIO";
                        }else if(["png", "bmp", "gif", "tif", "tiff", "heic", "heif", "jfif", "webp"].includes(ext)){
                            convertCMD = "CONVERT_IMAGE";
                        }else if(["cr2", "nef", "arw", "dng"].includes(ext)){
                            convertCMD = "CONVERT_RAW";
                        }else if(['.avi', "asf", "avi", "mov", "wmv", "mkv", "flv", "3gp","vc1"].includes(ext)){
                            convertCMD = "CONVERT_VIDEO";
                        }
                        if(convertCMD){
                          //  alert("正在把您上传的文件转换成AI服务支持的格式，请稍等候！");
                            setLoadingStatus("CONVERTING");

                            const newFile = await callAPI('/api/uploadService', {
                                cmd: convertCMD,
                                fileURL: result.url,
                                newPath: "U"
                            });   
                            if(newFile?.status === enums.resStatus.OK && newFile?.result?.url){
                                uploadingFile.uploadedUrl = newFile.result.url;
                            }else{
                                if(newFile?.status === enums.resStatus.unsupportFormat){
                                    return alert("上传文件的格式不支持。后缀名并不是判断文件格式的唯一标准，当前后缀名虽然被系统支持，但是实际格式无法正确被系统解析。");
                                }else{
                                    return alert("转换文件格式时发生未知错误！请换一个文件试试。");                                    
                                }
                            }
                        }
                        //auditImage(result.url);                  

                        // 记录上传的文件
                        const res = await callAPI("/api/userFileManager", {url:uploadingFile.uploadedUrl, type:fu.getFileTypeByMime(file.type), desc, cmd:"ADDFILE"});                      
                        if(res.status === enums.resStatus.OK){
                            uploadingFile.uploadedUrl = res.result?.url;
                        }else if(res.status === enums.resStatus.inputNSFW){
                            uploadingFile.uploadedUrl = null;                          
                            uploadedFiles.pop();
                            alert(res.result);
                        }                         
                    }              
                }        
            }
            setFiles(uploadedFiles);          
        }catch(e){
            throw new Error("上传文件时发生意外失败！");
        }finally{
            setLoadingStatus("");
        }
        
    }, []);

    const onDropAccepted = useCallback(() => {
        setLoadingStatus("LOADING");
    }, []);
  
    const onFileDialogCancel = useCallback(() => {
      setLoadingStatus("");  // 取消选择文件时恢复状态
    }, []);
  
    let option:any = { 
        onDrop, 
        onDropAccepted,
        onFileDialogCancel,      
        multiple: maxFiles>1,
        maxFiles: maxFiles,
        accept: ['image/*'],
  //      maxSize: maxFileSize * 1024 * 1024,
    };
  //  debug.log("mime:");
  //  debug.log(mime);
    if(mime){
        option.accept = mime;
    }
    const { getRootProps, getInputProps, isDragActive } = useDropzone(option);

    return (
        <div className={className || "w-full flex flex-col items-center justify-center border border-gray-600 border-dashed  text-center"}>
            {loadingStatus == "CONVERTING" ? (
            
            <LoadingButton title="正在转码" titleClass="px-2 text-white text-xs space-y-1" className="flex flex-col items-center text-white" />
            
            ): loadingStatus == "LOADING" ? (
            
            <LoadingButton title="正在上传" titleClass="px-2 text-white text-xs space-y-1" className="flex flex-col items-center text-white" />            
            
            ): (
            
            <div className="w-full ">
                <div {...getRootProps()} className={`cursor-pointer ${isDragActive ? 'bg-gray-100' : ''}`}>
                    <input {...getInputProps()} />

                    <div className="text-white font-bold flex flex-row space-x-1 items-center justify-center">
                        {/*title || (isDragActive ? '把文件拖放到此（<' + maxFileSize + 'M） ...' : '上传') */}
                       {showIcon && (
                        <Icon icon={isDragActive ? "mdi:drag" : "mdi:cloud-upload-outline"} className="w-5 h-5 text-inherit text-xs"/>
                        )}
                        {showTitle && (
                        <span>{title || (isDragActive ? '拖放' : '上传') }</span>
                        )}
                    </div>
                </div>
            </div>                  
            )}
   
        </div>
    );

/*
                  <p>{title || (isDragActive ? '把文件拖放到此（<' + maxFileSize + 'M） ...' : '新上传文件（<' + maxFileSize + 'M）') }</p>
*/
}
