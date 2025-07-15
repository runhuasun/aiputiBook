import React, { useRef, useState, useEffect } from 'react';
import { Component } from 'react';
import Link from "next/link";

import Image from "./wrapper/Image";

import * as debug from "../utils/debug";
import * as fu from "../utils/fileUtils";
import {isMobile} from "../utils/deviceUtils";
import * as ru from "../utils/restUtils";
import {callAPI2,callAPI} from "../utils/apiUtils";
import * as enums from "../utils/enums";
import LoadingDots from "./LoadingDots";

interface FlexAudioProps {
    src: string;
    key?: string;
    ref?: any;
    controls?: boolean;
    autoPlay?: boolean;
    loading?: boolean;

    onAudioUpdate: (url:string, duration:number, current:number)=>void;
    onLoading?: (status:boolean) => void;  
}

export default function FlexAudio({
    src, key, ref, controls=true, autoPlay=false, loading=false,
    onAudioUpdate, onLoading, 
}: FlexAudioProps) {  
    
    const [audioUrl, setAudioUrl] = useState(src);
    const audioRef = useRef<HTMLAudioElement | null>(ref || null);
    const [audioCurrent, setAudioCurrent] = useState<number>(0);
    const [audioDuration, setAudioDuration] = useState<number>(0);
    const [audioLoading, setAudioLoading] = useState<boolean>(false);

    function shorter(num1:number, num2:number){
        return num1 < num2 ? num1 : num2;
    }
    
    const handleAudioTimeUpdate = (e:any) => {
        const time = e.target.currentTime;
        setAudioCurrent(time);
        onAudioUpdate(audioUrl, audioDuration, time);
    };   
    const handleAudioLoadedMetadata = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = 0; // audio.duration;
            setAudioDuration(audio.duration);
            setAudioCurrent(0);
            onAudioUpdate(audioUrl, audio.duration, 0);            
        }
    };     
    
    useEffect(() => {
        if(typeof onLoading === "function"){
            onLoading(audioLoading);
        }
    }, [audioLoading]); 
    
    useEffect(() => {
        if(src != audioUrl){
            setAudioUrl(src);
        }
    }, [src]); 
    
    async function trimAudio(start:number, duration:number){
        if(duration > 0.1){
            setAudioLoading(true);
            try{
                const res = await callAPI("/api/simpleAgent", {
                    cmd: "audioTrim",
                    params:{
                        audioURL: audioUrl,
                        trimStart: start,
                        trimDuration: duration
                    }
                });
                if(res.status == enums.resStatus.OK){
                    setAudioUrl(res.result.url);
                }else{
                    alert("裁剪音频时发生未知错误");                
                }
            }catch(err){
                alert("裁剪音频时发生未知错误");
            }finally{
                setAudioLoading(false);
            }
        }else{
            alert("您选择的区域太小，无法截取");
        }
    }
    
    return (
        <div className="w-full flex flex-col space-y-3">
            {audioUrl && (
            <audio ref={audioRef} key={audioUrl} id="audioPlayer" controls className="w-full pt-2"
                    onPause={handleAudioTimeUpdate}
                    onTimeUpdate={handleAudioTimeUpdate}    
                    onLoadedMetadata={handleAudioLoadedMetadata}                                       
                >
                <source src={audioUrl} type="audio/mpeg"/>
                <source src={audioUrl} type="audio/wav"/>
                <source src={audioUrl} type="audio/ogg"/>
            </audio>
            )}
            {audioUrl && (!audioLoading && !loading) && (
            <div className="w-full flex flex-row items-center justify-center space-x-5">
                <button className="button-main px-3 py-2 text-xs" onClick={()=>{trimAudio(0, audioCurrent)}}>截取当前左侧</button>
                <button className="button-main px-3 py-2 text-xs" onClick={()=>{trimAudio(audioCurrent, audioDuration-audioCurrent)}}>截取当前右侧</button>                                    
            </div>
            )} 
            {audioLoading && (
            <div className="w-full flex flex-row items-center justify-center space-x-1">
                <span className="text-xs">正在裁剪中</span>
                <LoadingDots color="white" style="large" />
            </div>
            )}            
        </div>
    );
};
