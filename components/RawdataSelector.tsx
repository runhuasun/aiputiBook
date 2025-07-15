import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";

import Image from "./wrapper/Image";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import {mimeTypes} from "../utils/fileUtils";


interface RawdataSelectorProps {
    fileType?: string;
    onSelect: (file: any) => void;
    onCancel?: () => void;
}


export default function RawdataSelector({ fileType, onSelect, onCancel }: RawdataSelectorProps) {

    const [rawdataPageCount, setRawdataPageCount] = useState<number>(0);
    const rawdataPageSize = 18;
    const [rawdataCurrentPage, setRawdataCurrentPage] = useState<number>(1);
    const [rawdata, setRawdata] = useState<any[]>([]);
    async function gotoRawdataPage(page:number){
        const res = await fetch("/api/rawdataManager", {
            method: "POST",
            headers: { "Content-Type": "application/json"  },
            body: JSON.stringify({cmd:"GOTOPAGE", pageSize:rawdataPageSize, currentPage:page, fileType })
        });
      
        let response = await res.json();
        if (res.status != 200) {
           // alert(JSON.stringify(response as any));
        }else{
            setRawdataCurrentPage(page);
            setRawdataPageCount(response.pageCount);
            setRawdata(response.rawdata);
        }
    }

    let uploaderMime:any = mimeTypes.file;
    switch(fileType){
        case "IMAGE": uploaderMime = mimeTypes.image; break;
        case "TEXT": uploaderMime = mimeTypes.text; break;
        case "ZIP": uploaderMime = mimeTypes.zip; break;
        default: uploaderMime = mimeTypes.file;
    }
    const UploadDropZone = () => (
        <Uploader 
            setFiles = { (files) => {
                if (files.length !== 0) {
                    onSelect(files);
                }
            }}
            mime= {uploaderMime}
        />
    ); 

    useEffect(() => {
        gotoRawdataPage(1);
    }, []); // 空数组表示只在组件挂载时执行一次    

    
    return (
        <div className="w-full flex flex-row text-xs">
          <div className="flex w-1/3">
              <FileSelector 
                  title="选择语料文件" 
                  files={rawdata} 
                  fileType="RAWDATA"
                  pageCount={rawdataPageCount}
                  pageSize={rawdataPageSize}
                  currentPage={rawdataCurrentPage}
                  onSelect={(file) => {
                      if(file && file.url){
                          onSelect([{
                            uploadedUrl: file.url,
                            originalName: file.name,
                            fileType: file.type
                          }]);
                      }
                  }} 
                  onPageChange={(page) => {
                      if(page){
                          gotoRawdataPage(page);
                      }
                  }}                   
              />    
          </div>
            <div className="flex flex-1">
              <UploadDropZone />
          </div>
        </div>             
    );
}
