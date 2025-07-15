import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Image from "./wrapper/Image";
import Link from "next/link";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import {mimeTypes} from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as config from "../utils/config";

interface AlbumRoomSelectorProps {
    onSelectFile?: (file: any) => void;
    onSelectRoom?: (file: any) => void;    
    onCancel?: () => void;
    albumId?: string;
    title?: string;
    filter?: any;
    className?: string;
}


export default function AlbumRoomSelector({  title="系统模板", onSelectFile, onSelectRoom, onCancel, albumId=config.system.album.pose.id, filter, className }: AlbumRoomSelectorProps) {

    const fileType = "IMAGE";
    
    const [poseRoomPageCount, setPoseRoomPageCount] = useState<number>(0);
    const poseRoomPageSize = 16;
    const poseRoomRowSize = 8;    
    const [poseRoomCurrentPage, setPoseRoomCurrentPage] = useState<number>(1);
    const [poseRooms, setPoseRooms] = useState<any[]>([]);

    switch(filter?.gender){
        case 0: albumId = config.system.album.pose.id; break;
        case 1: albumId = config.system.album.poseMan.id; break;
    }
    
    async function gotoPoseRoomsPage(page:number){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:poseRoomPageSize, currentPage:page, id:albumId });
        if (res.status != 200) {
           // alert(res.result);
        }else{
            setPoseRoomCurrentPage(page);
            setPoseRoomPageCount(res.result.pageCount);
            setPoseRooms(res.result.rooms);
        }
    }

    useEffect(() => {
        gotoPoseRoomsPage(1);
    }, [filter, albumId]);
    
    
    return (
        <div className="w-full flex flex-row text-xs">
            {poseRooms && poseRooms.length>0 && (
            <div className="flex w-full">
                <FileSelector 
                    title={title}
                    files={poseRooms} 
                    fileType= {fileType}
                    pageCount={poseRoomPageCount}
                    pageSize={poseRoomPageSize}
                    rowSize={poseRoomRowSize}                  
                    currentPage={poseRoomCurrentPage}
                    className={className}
                    onSelect={(file) => {
                        if(file){
                            if(typeof onSelectRoom === "function"){
                                onSelectRoom(file);
                            }
                            if(file.outputImage && (typeof onSelectFile === "function")){
                                onSelectFile(file.outputImage);
                            }
                        }
                    }} 
                    
                    onPageChange={(page) => {
                        if(page){
                            gotoPoseRoomsPage(page);
                        }
                    }}                   
                    />    
            </div>
            )}
        </div>             
    );
}
