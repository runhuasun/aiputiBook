import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
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
    title?: string;
}


export default function BackgroundSelector({  title="系统背景", onSelect, onCancel, onSelectPrompt }: PoseSelectorProps) {

    const fileType = "IMAGE";

    const [userFilePageCount, setUserFilePageCount] = useState<number>(0);
    const userFilePageSize = 16;
    const userFileRowSize = 8;    
    const [userFileCurrentPage, setUserFileCurrentPage] = useState<number>(1);
    const [userFiles, setUserFiles] = useState<any[]>([]);
    async function gotoUserFilesPage(page:number){
        const res = await callAPI("/api/userFileManager", {
            cmd:"GOTOPAGE", pageSize:userFilePageSize, currentPage:page, type:fileType });
        if (res.status != 200) {
            // alert(JSON.stringify(res.result as any));
        }else{
            setUserFileCurrentPage(page);
            setUserFilePageCount(res.result.pageCount);
            setUserFiles(res.result.userFiles);
        }
    }
    
    const [BGPageCount, setBGPageCount] = useState<number>(0);
    const BGPageSize = 16;
    const BGRowSize = 8;    
    const [BGCurrentPage, setBGCurrentPage] = useState<number>(1);
    const [BGs, setBGs] = useState<any[]>([]);
    async function gotoBGsPage(page:number){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:BGPageSize, currentPage:page, id:config.system.album.bg.id });
        if (res.status != 200) {
            // alert(res.result);
        }else{
            setBGCurrentPage(page);
            setBGPageCount(res.result.pageCount);
            setBGs(res.result.rooms);
        }
    }

    const [travelPageCount, setTravelPageCount] = useState<number>(0);
    const travelPageSize = 16;
    const travelRowSize = 8;    
    const [travelCurrentPage, setTravelCurrentPage] = useState<number>(1);
    const [travels, setTravels] = useState<any[]>([]);
    async function gotoTravelsPage(page:number){
        const res = await callAPI("/api/albumManager", 
                                  {cmd:"ALBUM_ROOMS_GOTOPAGE", pageSize:travelPageSize, currentPage:page, id:config.system.album.bgTravel.id });
        if (res.status != 200) {
            // alert(res.result);
        }else{
            setTravelCurrentPage(page);
            setTravelPageCount(res.result.pageCount);
            setTravels(res.result.rooms);
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
        gotoBGsPage(1);
        gotoTravelsPage(1);
        gotoUserFilesPage(1);
    }, []);   

    
    return (
        <div className="w-full flex flex-row text-xs">

            {userFiles && userFiles.length>0 && (
            <div className="flex w-1/4">
              <FileSelector 
                  //title={`我上传的${fileTypeName}`}
                  title="最近上传"
                  files={userFiles} 
                  fileType= {`USER${fileType}`}
                  pageCount={userFilePageCount}
                  pageSize={userFilePageSize}
                  rowSize={userFileRowSize}                  
                  currentPage={userFileCurrentPage}
                  onSelect={async (file) => {
                      if(file && file.url){
                          onSelect(file.url);
                          callAPI("/api/userFileManager", {cmd:"RAISE_SCORE", id:file.id});
                      }
                  }} 
                  onPageChange={(page) => {
                      if(page){
                          gotoUserFilesPage(page);
                      }
                  }}                   
              />    
            </div>
            )}
            
            {BGs && BGs.length>0 && (
          <div className="flex w-1/4">
              <FileSelector 
                  title="影棚背景"
                  files={BGs} 
                  fileType= {fileType}
                  pageCount={BGPageCount}
                  pageSize={BGPageSize}
                  rowSize={BGRowSize}                  
                  currentPage={BGCurrentPage}
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
                          gotoBGsPage(page);
                      }
                  }}                   
              />    
          </div>
            )}

            {travels && travels.length>0 && (
          <div className="flex w-1/4">
              <FileSelector 
                  title="旅行风景"
                  files={travels} 
                  fileType= {fileType}
                  pageCount={travelPageCount}
                  pageSize={travelPageSize}
                  rowSize={travelRowSize}                  
                  currentPage={travelCurrentPage}
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
                          gotoTravelsPage(page);
                      }
                  }}                   
              />    
          </div>
            )}
          
          
          <div className="flex flex-1">
              <UploadDropZone />
          </div>
        </div>             
    );
}
