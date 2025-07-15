import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";

import Image from "./wrapper/Image";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import {mimeTypes, getThumbnail} from "../utils/fileUtils";


interface Props {
    title: string;
    modelType: string;
    channel?: string;
    onSelect: (file: any) => void;
    onCancel?: () => void;
    filter?: {
        age?: number;
        gender?: number;
        glass?: number;
        hat?: number;
    };
}


export default function ModelSelector({ title="选择小模型", modelType="LORA", channel, onSelect, onCancel, filter }: Props) {

    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 16;
    const modelRowSize = 8;    
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);
    const [label, setLabel] = useState<string>("全部");
    
    async function gotoModelPage(page:number){
        const res = await fetch("/api/updateModel", {
            method: "POST",
            headers: { "Content-Type": "application/json"  },
            body: JSON.stringify({cmd:"GOTOPAGE", pageSize:modelPageSize, currentPage:page, modelType, channel, label})
        });
      
        let response = await res.json();
        if (res.status != 200) {
            alert(JSON.stringify(response as any));
        }else{
            setModelCurrentPage(page);
            setModelPageCount(response.pageCount);
            setModels(response.models);
        }
    }


    useEffect(() => {
        switch(filter?.gender){
            case 0: setLabel("女士"); break;
            case 1: setLabel("男士"); break;
        }        
    }, [filter]); 

    useEffect(() => {
        gotoModelPage(1);        
    }, [label]); 
    
    return (
        <>
            <div className="w-full flex flex-row text-xs">
                <div className="flex w-full">
                  <FileSelector 
                      title={title} 
                      files={models} 
                      fileType={`${modelType}MODEL`}
                      pageCount={modelPageCount}
                      pageSize={modelPageSize}
                      rowSize={modelRowSize}
                      currentPage={modelCurrentPage}
                      onSelect={(file) => {
                          onSelect(file);
                      }} 
                      onPageChange={(page) => {
                          if(page){
                              gotoModelPage(page);
                          }
                      }}                   
                  />  
                </div>
            </div>             
    
            <div className="w-full grid grid-flow-row-dense grid-cols-5 sm:grid-cols-8 gap-1" >
                {models && models.slice(0, 8).map((v) => (
                    <Image alt="样片" src={getThumbnail(v.coverImg,256)} className="w-auto h-auto cursor-pointer" 
                        onClick={()=>(onSelect(v))}                            
                        />                    
                ))} 
            </div>
        </>
    );
}
