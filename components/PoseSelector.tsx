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

interface PoseSelectorProps {
    onSelect: (file: any) => void;
    onSelectPrompt?: (prompt: string) => void;    
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


export default function PoseSelector({  title="系统模板", onSelect, onCancel, onSelectPrompt, albumId=config.system.album.pose.id, filter }: PoseSelectorProps) {

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

    const [genFilePageCount, setGenFilePageCount] = useState<number>(0);
    const genFilePageSize = 16;
    const genFileRowSize = 8;    
    const [genFileCurrentPage, setGenFileCurrentPage] = useState<number>(1);
    const [genFiles, setGenFiles] = useState<any[]>([]);
    async function gotoGenFilesPage(page:number){
        const res = await callAPI("/api/updateRoom", {cmd:"GOTOPAGE", pageSize:genFilePageSize, currentPage:page, type:fileType, showMyRooms:true });
        if (res.status != 200) {
          // alert(JSON.stringify(res.result as any));
        }else{
            setGenFileCurrentPage(page);
            setGenFilePageCount(res.result.pageCount);
            setGenFiles(res.result.rooms);
        }
    }

    let mimeType:any = mimeTypes.image;
    let fileTypeName = "图片";
            
    const UploadDropZone = () => (
        <Uploader 
            setFiles = { (files) => {
                if (files.length !== 0) {
                    onSelect(files[0].uploadedUrl);
                }
            }}
            mime= { mimeType }
        />
    ); 


    useEffect(() => {
        gotoGenFilesPage(1);
    }, []);   

    useEffect(() => {
        gotoPoseRoomsPage(1);
    }, [filter]);
    
    return (
        <div className="w-full flex flex-row text-xs">
            {poseRooms && poseRooms.length>0 && (
          <div className="flex w-1/4">
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
                          onSelect(file.outputImage);
                          if(file?.prompt && onSelectPrompt){
                              onSelectPrompt(file.prompt);
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
            
          <div className="flex w-1/4">
              <FileSelector 
         //       title={`我生成的${fileTypeName}`} 
                  title="我的作品"
                  files={genFiles} 
                  fileType={fileType}
                  pageCount={genFilePageCount}
                  pageSize={genFilePageSize}
                  rowSize={genFileRowSize}                  
                  currentPage={genFileCurrentPage}
                  onSelect={(file) => {
                      if(file && file.outputImage){
                          onSelect(file.outputImage);
                          if(file?.prompt && onSelectPrompt){
                              onSelectPrompt(file.prompt);
                          }
                      }
                  }} 
                  onPageChange={(page) => {
                      if(page){
                          gotoGenFilesPage(page);
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
