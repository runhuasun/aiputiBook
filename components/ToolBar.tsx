import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { Icon } from '@iconify/react';
import { Tooltip } from 'react-tooltip';

import Button from "./wrapper/Button";
import { useSession } from "next-auth/react"
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import * as fc from "../utils/funcConf";
import * as fu from "../utils/fileUtils";
import * as debug from "../utils/debug";



export default function ToolBar({config, initTools, cols, roomId, imageURL, videoURL, audioURL, prompt, restoredImage, restoredId }: 
                               { config:any, initTools?: any[], cols?: number, roomId?:string|null, restoredImage?:string|null, restoredId?:string|null,
                                imageURL?:string|null, videoURL?:string|null, audioURL?:string|null, prompt?:string|null
                               }) {


    const router = useRouter();
    const [tbCode, setTbCode] = useState<string>(router.query.tbCode as string);
  
    const [title, setTitle] = useState<string>("");
    const [tools, setTools] = useState<any[]>(initTools || []);
    const [currentTool, setCurrentTool] = useState<any>();
    const [barText, setBarText] = useState<string>("name");

    useEffect(() => {
        if(typeof window !== 'undefined' && window.location?.href){
            if(initTools){
                setTools(initTools);
            }else{
                const tb = fc.getToolBar(window.location.href, tbCode);
                if(tb){
                    setTitle(tb.title);
                    setTools(tb.tools);
                    setBarText(tb.barText);
                    setCurrentTool(tb.currentTool);
                }
            }
        }
    
        if(!cols){
            cols = 12;
        }        
    }, []);
  
    function goURL(url:string){      
        if(url){
            if(prompt){
                url = fu.addParamToURL(url, "prompt", prompt);
            }
            if(roomId){
                url = fu.addParamToURL(url, "roomId", restoredId || roomId);
            }
            if(imageURL && !imageURL.includes("white_1024.jpg")){
                url = fu.addParamToURL(url, "imageURL", restoredImage || imageURL);
            }
            if(videoURL){
                url = fu.addParamToURL(url, "videoURL", videoURL);
            }
            if(audioURL){
                url = fu.addParamToURL(url, "audioURL", audioURL);
            }
            if(tbCode){
                url = fu.addParamToURL(url, "tbCode", tbCode);
            }
            
            fu.safeWindowOpen(url, "_self");
        }
    }


    function isCurrentTool(code:string){
        return code == currentTool?.code;
    }
  
    
    return (
        <div className="hidden sm:flex flex-wrap w-full px-5 py-2 flex-row items-center justify-start gap-1 text-xs">
            {title && (
            <p className="text-sm py-1 whitespace-nowrap">{`${title}：`}</p>
            )}
            {tools && tools.map((tool) => (
                <Button key={tool.code} 
                  tip={`💡 ${tool.hint || tool.name}`}  tipPlace={"bottom"}  tipOffset={30}
                  className={`${isCurrentTool(tool.code) ? "button-tool-selected" : "button-tool"} px-3 py-1 rounded-xs whitespace-nowrap flex flex-row items-center gap-1`} onClick={()=>{goURL(tool.url)}}>
                    <Icon icon={tool.icon} className="w-5 h-5 text-inherit text-xs"/>
                    <span>{(barText === "shortName" ? tool.shortName : "") || tool.name}</span>
                </Button>
            ))}
     
        </div>            
    );
}

