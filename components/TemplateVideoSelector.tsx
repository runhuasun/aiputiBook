import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import Link from "next/link";

import Image from "./wrapper/Image";
import Pagination from '../components/Pagination';
import FileSelector from '../components/FileSelector';
import Uploader from "../components/Uploader";
import {mimeTypes,getThumbnail} from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as config from "../utils/config";

interface PoseSelectorProps {
    onSelect: (file: any) => void;
    onCancel?: () => void;
    albumId?: string;
    title?: string;
    filter?: {
        age?: number;
        gender?: number;
        glass?: number;
        hat?: number;
    };
}


export default function TemplateVideoSelector({  title="表情视频模板", onSelect, onCancel, albumId=config.system.album.motionVideo.id, filter }: PoseSelectorProps) {

    const fileType = "VIDEO";
    
    const [poseRoomPageCount, setPoseRoomPageCount] = useState<number>(0);
    const poseRoomPageSize = 16;
    const poseRoomRowSize = 8;    
    const [poseRoomCurrentPage, setPoseRoomCurrentPage] = useState<number>(1);
    const [poseRooms, setPoseRooms] = useState<any[]>([]);

  
    async function gotoPoseRoomsPage(page:number){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:poseRoomPageSize, currentPage:page, id:albumId });
        if (res.status != 200) {
            alert(res.result);
        }else{
            setPoseRoomCurrentPage(page);
            setPoseRoomPageCount(res.result.pageCount);
            setPoseRooms(res.result.rooms);
        }
    }

    useEffect(() => {
        gotoPoseRoomsPage(1);
    }, []);


    
    return (
        <>
            <div className="w-full flex flex-row text-xs">
                <div className="flex w-full">
                    <FileSelector 
                        title={title}
                        files={poseRooms} 
                        fileType= {fileType}
                        pageCount={poseRoomPageCount}
                        pageSize={poseRoomPageSize}
                        rowSize={poseRoomRowSize}                  
                        currentPage={poseRoomCurrentPage}
                        onSelect={(file) => {
                            if(file && file.outputImage){
                                onSelect({
                                    videoURL:file.outputImage,
                                    posterURL:file.inputImage
                                });
                            }
                        }} 
                        onPageChange={(page) => {
                            if(page){
                                gotoPoseRoomsPage(page);
                            }
                        }}                   
                        />    
                </div>
            </div>             
            <div className="w-full grid grid-flow-row-dense grid-cols-5 sm:grid-cols-8 gap-1" >
                {poseRooms && poseRooms.slice(0, 8).map((v) => (
                    <Image alt="样片" src={getThumbnail(v.inputImage,256)} className="w-auto h-auto cursor-pointer" 
                        onClick={()=>(
                                onSelect({
                                    videoURL:v.outputImage,
                                    posterURL:v.inputImage
                                })                            
                        )}                            
                        />                    
                ))} 
            </div>
        </>            
    );
}
