import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import {mimeTypes} from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import { PlusCircleIcon } from '@heroicons/react/24/solid';

interface Props {
    title?: string;
    onSelect: (file: any) => void;
    onCancel?: () => void;
    className?: string;
}


export default function AlbumSelector({ 
    title="选择相册", 
    className="w-full flex flex-row text-base", 
    onSelect, onCancel }: Props) {

    const [albumPageCount, setAlbumPageCount] = useState<number>(0);
    const albumPageSize = 16;
    const albumRowSize = 8;    
    const [albumCurrentPage, setAlbumCurrentPage] = useState<number>(1);
    const [albums, setAlbums] = useState<any[]>([]);

  
    async function gotoAlbumPage(page:number){
        const res = await callAPI("/api/albumManager", {
            cmd:"GOTOPAGE", pageSize:albumPageSize, currentPage:page
        });
        if (res.status != 200) {
            alert(res.result);
        }else{
            setAlbumCurrentPage(page);
            setAlbumPageCount(res.result.pageCount);
            setAlbums(res.result.albums);
        }
    }

    useEffect(() => {
        gotoAlbumPage(1);
    }, []); // 空数组表示只在组件挂载时执行一次    

    
    return (
        <div className={className}>
            <FileSelector 
                title={
                    <span className="flex items-center gap-2">
                        <PlusCircleIcon className="w-5 h-5 text-inherit" />
                        加入相册
                    </span> as unknown as string
                }
                files={albums} 
                fileType={`ALBUM`}
                pageCount={albumPageCount}
                pageSize={albumPageSize}
                rowSize={albumRowSize}
                currentPage={albumCurrentPage}
                className="w-full flex items-center gap-2"
                onSelect={(file) => {
                    onSelect(file);
                }} 
                onPageChange={(page) => {
                    if(page){
                        gotoAlbumPage(page);
                    }
                }}   
                createLink="/createAlbum"
                createLabel="创建相册"
                />  
        </div>
    );
}
