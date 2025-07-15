import React, { useRef, useState, useEffect } from 'react';
import { Component } from 'react';
import Link from "next/link";

import Video from "./wrapper/Video";
import Button from "./wrapper/Button";

import * as debug from "../utils/debug";
import * as fu from "../utils/fileUtils";
import {isMobile} from "../utils/deviceUtils";
import * as ru from "../utils/restUtils";
import {callAPI2,callAPI} from "../utils/apiUtils";
import * as enums from "../utils/enums";
import LoadingDots from "./LoadingDots";

interface FlexVideoProps {
    src: string | null | undefined;
    poster?: string | null | undefined;
    ref?: any;
    speed?: number;
    controls?: boolean;
    autoPlay?: boolean;
    loading?: boolean;

    onVideoUpdate: (url:string, duration:number, current:number)=>void;
    onLoading?: (status:boolean) => void;  
}

export default function FlexVideo({
    src, poster, ref, controls=true, autoPlay=false, loading=false, speed=1,
    onVideoUpdate, onLoading, 
}: FlexVideoProps) {  
    
    const [videoUrl, setVideoUrl] = useState<string>(src || "");
    const videoRef = useRef<HTMLVideoElement | null>(ref || null);
    const [videoCurrent, setVideoCurrent] = useState<number>(0);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [videoLoading, setVideoLoading] = useState<boolean>(false);

    function shorter(num1:number, num2:number){
        return num1 < num2 ? num1 : num2;
    }
    
    const handleVideoTimeUpdate = (e:any) => {
        const time = e.target.currentTime;
        setVideoCurrent(time);
        onVideoUpdate(videoUrl, videoDuration, time);
    };   
    const handleVideoLoadedMetadata = () => {
        debug.log('enter handleVideoLoadedMetadata...');
        const video = videoRef.current;
        if (video) {
            video.currentTime = 0; // video.duration;
            setVideoDuration(video.duration);
            setVideoCurrent(0);
            onVideoUpdate(videoUrl, video.duration, 0); 
            debug.log(`onVideoUpdate(${videoUrl}, ${video.duration}, ${0}); `);
        }
    };     
    
    useEffect(() => {
        if(src != videoUrl){
            setVideoUrl(src || "");
        }
    }, [src]); 

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            setVideoDuration(video.duration);
            setVideoCurrent(0);
            onVideoUpdate(videoUrl, video.duration, 0);             
        }
    }, [videoUrl]);

    useEffect(() => {
        if(typeof onLoading === "function"){
            onLoading(videoLoading);
        }
    }, [videoLoading]); 

    useEffect(() => {
        if (videoRef.current && speed) {
            videoRef.current.playbackRate = speed;
        }
    }, [speed]);     
   
    async function trimVideo(start:number, duration:number){
        if(duration > 0.1){
            setVideoLoading(true);
            try{
                const res = await callAPI("/api/simpleAgent", {
                    cmd: "videoTrim",
                    params:{
                        videoURL: videoUrl,
                        trimStart: start,
                        trimDuration: duration
                    }
                });
                if(res.status == enums.resStatus.OK){
                    setVideoUrl(res.result.url);
                }else{
                    alert("裁剪视频时发生未知错误");                
                }
            }catch(err){
                alert("裁剪视频时发生未知错误");
            }finally{
                setVideoLoading(false);
            }
        }else{
            alert("您选择的区域太小，无法截取");
        }
    }

    if(videoUrl){
        return (
            <div className="w-full flex flex-col space-y-3">
                <Video ref={videoRef} src={videoUrl}  poster={fu.getVideoPoster(videoUrl)}  controls={true} autoPlay={false}  
                        className="w-full max-h-60"
                        onPause={handleVideoTimeUpdate}
                        onTimeUpdate={handleVideoTimeUpdate}    
                        onLoadedMetadata={handleVideoLoadedMetadata}   
                    />
                {(!videoLoading && !loading) && (
                <div className="w-full flex flex-row items-center justify-center space-x-5">
                    <Button 
                        tip={"可以拖动视频的进度条选择位置，然后点击截取部分视频"} tipPlace={"top"} tipOffset={5}
                        className="button-main px-3 py-2 text-xs" onClick={()=>{trimVideo(0, videoCurrent)}}>截取当前左侧</Button>
                    <Button 
                        tip={"可以拖动视频的进度条选择位置，然后点击截取部分视频"} tipPlace={"top"} tipOffset={5}                        
                        className="button-main px-3 py-2 text-xs" onClick={()=>{trimVideo(videoCurrent, videoDuration-videoCurrent)}}>截取当前右侧</Button>                                    
                </div>
                )} 
                {videoLoading && (
                <div className="w-full flex flex-row items-center  justify-center space-x-1">
                    <span className="text-xs">正在裁剪中</span>
                    <LoadingDots color="white" style="large" />
                </div>
                )}
            </div>
        );
    }else{
        return null;
    }
};
