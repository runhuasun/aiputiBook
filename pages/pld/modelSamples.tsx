import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { getServerSession } from "next-auth";

import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { Model, User, Room } from "@prisma/client";
import prisma from "../../lib/prismadb";
import * as am from "../api/actionManager";

import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import LoginPage from "../../components/LoginPage";
import {showRoom} from "../../components/Genhis";
import Pagination from "../../components/Pagination";
import Image from "../../components/wrapper/Image";

import {getThumbnail} from "../../utils/fileUtils";
import { config } from "../../utils/config";
import {isWeixinBrowser} from "../../utils/wechatUtils";
import * as debug from "../../utils/debug";
import {callAPI} from "../../utils/apiUtils";


export default function showImageModel() {
    
    const router = useRouter();
    const modelId = router.query.modelId;     

    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const mpPageSize = 16;
    const mpRowSize = 8;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>();
    async function gotoMPsPage(page:number){
        const res = await callAPI("/api/pld", {
            cmd:"QUERY_SAMPLE_BY_MODEL", 
            timeStamp: Date.now(),
            uid: "cm04q8syx000tkxkvqyb68kt1",
            ukey: "$2b$10$jo0z0ISZq04ZWmJfnjge1e6IXO0hCF1HH1N7dKLO4mnhjC6CEsc/C",
            params:{
                pageSize:mpPageSize, 
                currentPage:page, 
                modelId,
            }
        });
        if (res.status != 200) {
            alert(JSON.stringify(res.result as any));
        }else{
            setMPCurrentPage(page);
            setMPPageCount(res.result.pageCount);
            setMPs(res.result.rooms);
        }
    }

    useEffect(() => {
        if(modelId){
            gotoMPsPage(1);                
        }        
   }, [modelId]); 

    if(modelId){
        return (
            <div className="flex  mx-auto flex-col items-center justify-center py-2 min-h-screen">
                <main>
                    <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-8 gap-3 px-3 py-5 ">            
                        {mps && mps.map((img) => ( 
                            <Image alt="图片素材" src={img.outputImage} 
                                onClick= {() => {router.push(`/pld/takePhoto?modelId=${modelId}&refImage=${img.outputImage}`)}}
                                onContextMenu ={() => {return false}}                            
                                className="rounded-xl relative sm:mt-0 mt-2 w-full" />
                        ))}
                    </div>                     
    
                    <Pagination pageCount={mpPageCount} currentPage={mpCurrentPage} 
                        onPageChange={(page) => {
                            gotoMPsPage(page);
                        }} 
                        />                     
                    
                    <div className="w-full max-w-lg space-x-8 flex flex-row justify-center py-10">
                        <button
                            onClick={() => {
                                window.location.href = "/pld/modelList";
                            }}
                            className="px-4 py-2 mt-8 button-main"
                            >
                            返回选择套系
                        </button> 
                    </div>
                    
                </main>
            </div>
        );
    }
};
