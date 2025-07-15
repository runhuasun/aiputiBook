import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Image from "./wrapper/Image";


interface Props {
    title?: string;
    channel?: string;
    onSelect: (file: any) => void;
    onCancel?: () => void;
    className?: string;
}


export default function PromptSelector({ 
    title="参考创意", channel="PORTRAIT", className="button-main text-xs px-2 py-1 mt-3", onSelect, onCancel}: Props) {

    const [promptPageCount, setPromptPageCount] = useState<number>(0);
    const promptPageSize = 16;
    const promptRowSize = 8;    
    const [promptCurrentPage, setPromptCurrentPage] = useState<number>(1);
    const [prompts, setPrompts] = useState<any[]>([]);
    
    async function gotoPromptPage(page:number){
        const res = await fetch("/api/createPrompt", {
            method: "POST",
            headers: { "Content-Type": "application/json"  },
            body: JSON.stringify({cmd:"GOTOPAGE", pageSize:promptPageSize, currentPage:page, channel})
        });
      
        let response = await res.json();
        if (res.status != 200) {
            alert(JSON.stringify(response as any));
        }else{
            setPromptCurrentPage(page);
            setPromptPageCount(response.pageCount);
            setPrompts(response.prompts);
        }
    }

    useEffect(() => {
        gotoPromptPage(1);
    }, []); // 空数组表示只在组件挂载时执行一次    

    
    return (
        <div className="w-30 flex flex-row text-xs">
            <div className="flex w-full">
              <FileSelector 
                  className={className}
                  title={title} 
                  files={prompts} 
                  fileType={`PROMPT`}
                  pageCount={promptPageCount}
                  pageSize={promptPageSize}
                  rowSize={promptRowSize}
                  currentPage={promptCurrentPage}
                  onSelect={(file) => {
                      onSelect(file);
                  }} 
                  onPageChange={(page) => {
                      if(page){
                          gotoPromptPage(page);
                      }
                  }}                   
              />  
                
            </div>
        </div>             
    );
}
