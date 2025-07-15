import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Model, User } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "../../pages/api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as am from "../api/actionManager";

import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import { uploader, cnLocale, uploaderOptions} from "../../components/uploadOption";
import { showModel} from "../../components/Genhis";
import LoginPage from "../../components/LoginPage";
import Image from "../../components/wrapper/Image";

import {channelType, channels, loraChannels, channelNames} from "../../utils/channels";
import {isWeixinBrowser} from "../../utils/wechatUtils";
import {bookLabels, portraitLabels} from "../../utils/labels";
import {callAPI} from "../../utils/apiUtils";
import Pagination from '../../components/Pagination';
import * as ru from "../../utils/restUtils";
import { config } from "../../utils/config";

export async function getServerSideProps(ctx: any) {
    const site = ctx?.query?.site || "TESTSITE";
    return {
        props: {
            site
        }
    };
}  


export default function modelList({site}: {site:string}) {

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
   
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [modelPageCount, setModelPageCount] = useState<number>(0);
    const modelPageSize = 16;
    const [modelCurrentPage, setModelCurrentPage] = useState<number>(1);
    const [models, setModels] = useState<any[]>([]);

    async function gotoModelPage(page:number){
        const res = await callAPI("/api/pld", {
            cmd:"QUERY_MODEL_BY_SITE", 
            timeStamp: Date.now(),
            uid: "cm04q8syx000tkxkvqyb68kt1",
            ukey: "$2b$10$jo0z0ISZq04ZWmJfnjge1e6IXO0hCF1HH1N7dKLO4mnhjC6CEsc/C",
            params:{
                pageSize:modelPageSize, 
                currentPage:page, 
                site
            }
        });
        if (res.status != 200) {
            alert(res.result);
        }else{
            setModelCurrentPage(page);
            setModelPageCount(res.result.pageCount);
            setModels(res.result.models);
        }
    }
    
    useEffect(() => {
        gotoModelPage(1);
   }, []); 

    if( status == "authenticated" || status == "unauthenticated"){
        return (
            <div className="flex flex-col items-center justify-center  min-h-screen ">
                <main >
                    <div className="items-center w-full sm:pt-2 pt-0 flex flex-col px-3 space-y-0 sm:space-y-3 sm:mb-0 mb-3">
                        <div className="w-full flex flex-col space-y-0 sm:space-y-10 mt-4 mb-4 pt-1 rounded-xl items-center space-x-2">
                            <div className="grid grid-flow-row-dense gap-3 items-center w-full grid-cols-2 sm:grid-cols-8 ">
                                {models && models.map((m) => (
                                <Image alt="图片素材" src={m.coverImg} 
                                    onClick= {() => {router.push(`/pld/modelSamples?modelId=${m.id}`)} }
                                    onContextMenu ={() => {return false}}                            
                                    className="rounded-xl relative sm:mt-0 mt-2 w-full" />
                                ))}
                            </div>
                            <Pagination pageCount={modelPageCount} currentPage={modelCurrentPage}  
                                onPageChange={(page) => {
                                    gotoModelPage(page);
                                }}  /> 
                        </div>
                    </div>   
    
                </main>
            </div>
        );
    }  
};



    
