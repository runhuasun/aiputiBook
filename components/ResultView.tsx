import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

import { CompareSlider } from "../components/CompareSlider";
import Toggle from "../components/Toggle";
import ResultButtons from "../components/ResultButtons";
import AutoSizeImage from "../components/AutoSizeImage";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import LoadingRing from "../components/LoadingRing";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import ImageCanvas from "../components/ImageCanvas";
import RulerBox from "../components/RulerBox";
import {showRoom, publicRoom} from "../components/Genhis";
import Image from "./wrapper/Image";
import Video from "./wrapper/Video";
import {callAPI} from "../utils/apiUtils";
import * as ru from "../utils/restUtils";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import {callAPI2} from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as mt from "../utils/modelTypes";
import * as fc from "../utils/funcConf";

interface ResultViewProps {
    config: any;
    error?: string | undefined | null;
    loading?: boolean;
    restoredImage?: string | undefined | null;
    restoredId?: string | undefined | null;
    restoredSeed?: string | undefined | null;
    demoRooms?: any[] | any | null;
    mediaType?: string;
}

export default function ResultView({
    config, restoredImage, restoredId, restoredSeed, loading, error, demoRooms, mediaType="IMAGE"
}: ResultViewProps) {
    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [rooms, setRooms] = useState<any>(null);

    async function loadDemoRooms(){
        //alert(demoRooms);
        //alert(demoRooms?.func);
        //alert(demoRooms?.model);
        const res = await callAPI("/api/updateRoom", 
                                  {
                                      cmd:"GOTOPAGE", 
                                      pageSize:10, 
                                      currentPage:1,
                                      type:mediaType, 
                                      publicOnly: true, 
                                      func: demoRooms?.func,
                                      baseModelCode: demoRooms?.model
                                  });
        if (res.status == 200 && res.result?.rooms && res.result.rooms?.length>0) {
            setRooms(res.result.rooms);
        }else{
            const func = fc.getFuncByCode(config, demoRooms.func);
            debug.log("func:", func);
            if(func){
                if(demoRooms.model && func.code === "createPrompt"){
                    const m = mt.roomMap.get(demoRooms.model);
                    debug.log("model:", m);
                    if(m){
                        setRooms([`${config.RS}/demo/model/${m.code}.jpg`]);
                        return;
                    }
                }else if(demoRooms.model && func.code === "createVideo"){
                    const m = mt.videoModelMap.get(demoRooms.model);
                    debug.log("model:", m);
                    if(m){
                        setRooms([`${config.RS}/demo/model/${m.code}.mp4`]);
                        return;
                    }
                }else if(func?.demos){
                    const demos:string[] = [];
                    for(const demo of func.demos){
                        demos.push(`${config.RS}/demo/${demo}`);
                    }
                    setRooms(demos);
                }
            }
        }
    }

    useEffect(() => {
        if(!demoRooms) return;
        
        if(demoRooms.func){
            loadDemoRooms();
        }
    }, [demoRooms?.func, demoRooms?.model]); 

    useEffect(() => {
        if(!demoRooms) return;
        
        if(Array.isArray(demoRooms)){
            setRooms(demoRooms);
        }
    }, [demoRooms]); 

    let maxWidth = "max-w-7xl";
    let cols = "sm:grid-cols-5";
    if(rooms){
        switch(rooms.length){
            case 1:
                maxWidth = "max-w-xl";
                cols = "sm:grid-cols-1";
                break;
            case 2:
                maxWidth = "max-w-3xl";
                cols = "sm:grid-cols-2";
                break;                
            case 3:
            case 6:
            case 9:
                maxWidth = "max-w-5xl";
                cols = "sm:grid-cols-3";
                break;
            case 4:
            case 7:
            case 8:
                maxWidth = "max-w-6xl";
                cols = "sm:grid-cols-4";
                break;
            case 5:
            case 10:
            default:                
        }
    }

    let demoCount = 0;
    return (    
        <RulerBox  className="flex flex-1 w-full rounded-lg  min-h-[calc(100vh-50px)]  mr-2 items-center justify-center border border-1 border-gray-300 border-dashed">
            {error && (
            <MessageZone message={error} messageType="ERROR"/>
            )}                  
    
            {loading && !error && !restoredImage && (
            <LoadingRing/>
            )}
    
            {rooms && rooms.length>0 && !restoredImage && !loading && !error && (
            <div className="w-full flex flex-col items-center justify-center space-y-5 py-5 px-20">
                <div className={`w-full ${maxWidth} grid grid-flow-row-dense grid-cols-2 ${cols} gap-3`}>
                    {rooms.map((item: any, index: number) => {
                        if (item?.outputImage) {
                            demoCount++;
                            return showRoom(item, "", "SHOW_TITLE", true);
                        } else {
                            const ext = item?.split(".").pop()?.toLowerCase();
                            const url = item;
                            switch (mediaType) {
                                case "IMAGE":
                                    if(ext === "jpg"){
                                        demoCount++;
                                        return ( <Image key={`image-${index}`} className="object-cover w-full rounded-xl" src={url}/> );
                                    }
                                    break;
                                case "VIDEO":
                                    if(ext === "mp4"){
                                        demoCount++;                                        
                                        return ( <Video key={`video-${index}`} className="w-full rounded-xl" src={url} preload="none" controls={true} autoPlay={false} muted={false} poster={fu.getVideoPoster(url)} /> );
                                    }
                                    break;
                                case "AUDIO":
                                    if(ext === "mp3" || ext === "wav" || ext === "ogg"){
                                        demoCount++;
                                        return ( 
                                            <audio key={`audio-${index}`} id={`audioPlayer-${index}`} controls className="w-full pt-2" >
                                              <source src={url} type="audio/mpeg"/>
                                              <source src={url} type="audio/wav"/>
                                              <source src={url} type="audio/ogg"/>                        
                                            </audio>
                                        );
                                    }
                                    break;
                                default:
                            }
                            return null;
                        }
                    })}
                </div>

                { demoCount>0 && (
                <button 
                    onClick={() => {
                        window.open("/index_aiyishujia", "_blank");
                    }}
                    className=" px-8 py-2 button-dark "
                    >
                    更多精彩样片...
                </button>     
                )}
            </div>
            )}
    
            {restoredImage && restoredId && (
                <div className="w-full flex flex-col items-center space-y-4">
                    <div className="w-full flex flex-col justify-center items-center">
                        {restoredSeed && (
                        <p className="text-sm text-gray-500">{`创意种子：${restoredSeed}`}</p>
                        )}
                        {mediaType === "IMAGE" && (
                        <AutoSizeImage initShow={"SCREEN"}
                            src={restoredImage}
                            onLoadingComplete={() => setRestoredLoaded(true)}
                            onClick={() => window.open(ru.getImageRest(restoredId), "_blank")}
                            />
                        )}
                        {mediaType === "VIDEO" && (
                        <Video src={restoredImage} muted={true} controls={true} autoPlay={true} 
                            onClick={() => window.open(ru.getVideoRest(restoredId), "_blank")}
                            className="w-auto h-auto max-w-full max-h-[calc(100vh-100px)]"
                            />
                        )}
                        {mediaType === "AUDIO" && (
                        <audio controls={true} 
                            onClick={() => window.open(ru.getVideoRest(restoredId), "_blank")}
                            className="w-2/3 h-20"
                            >
                              <source src={restoredImage} type="audio/mpeg"/>
                              <source src={restoredImage} type="audio/wav"/>
                              <source src={restoredImage} type="audio/ogg"/>   
                            
                        </audio>
                        )}
                    </div>    
    
                    {/*
                    <div className="hidden flex flex-row items-center justify-center space-x-4">
                        <TaskPannel config={config} user={user} roomId={restoredId}/>                                        
                    </div>
                    */}    
                    <div className="w-full flex flex-row items-center justify-center space-x-4">
                        <ResultButtons mediaId={restoredId} mediaURL={restoredImage} zoomInButton={true} mediaType={mediaType}/>                                            
                    </div>
                </div>
            )}
        
        </RulerBox >
    );
}
