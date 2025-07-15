import { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import Link from "next/link";

import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room, User } from "@prisma/client";
import { GenerateResponseData } from "./api/generate";

import { CompareSlider } from "../components/CompareSlider";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import Genhis from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import Uploader, {mimeTypes} from "../components/Uploader";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import ComboSelector from "../components/ComboSelector";
import Image from "../components/wrapper/Image";

import { config } from "../utils/config";
import * as ru from "../utils/restUtils";
import downloadPhoto from "../utils/fileUtils";
import {callAPI} from "../utils/apiUtils";
import * as monitor from "../utils/monitor";


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
  
  return {
    props: {
      config
    },
  };
}  



export default function studyWords({config }: { config:any }) {

    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);  
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    
    async function detect(fileUrl: string) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);
        const res = await callAPI("/api/generate", {
            func: "detectAnything",
            params: {
                imageURL: fileUrl,
            }
        });
    
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            mutate();
            setRestoredImage(res.result.generated);
            setRestoredId(res.result.genRoomId);         
        }
        setTimeout(() => {
            setLoading(false);
        }, 1300);
    }


    let title = "看图学英语";
    
    if(status == "authenticated"){ 
        return (
            <div className="flex mx-auto flex-col items-center justify-center min-h-screen">
                <Head>
                    <title> {title} </title>
                    <meta property="og:description" content={"随手一拍，随时学英语"} /> 
                    <meta property="og:title" content={title} />
                    <meta property="og:image" content={config.logo32} />    
                    <meta name="description" content={"随手一拍，随时学英语"} />
                </Head>              
              <Header config={config}/>
              <main className="relative">
                <h1 className="hidden sm:block title-main">
                    {title}
                </h1>
            
                <div className="flex justify-between items-center w-full flex-col mt-4">
                    {originalPhoto && !restoredImage && (
                    <Image alt="original photo" src={originalPhoto}
                        className="rounded-2xl relative w-full sm:w-auto min-h-40"
                        onLoadingComplete={() => {
                            detect(originalPhoto);
                        }}
                        />
                    )}
                    
                    {!originalPhoto && !restoredImage && (
                    <div className="mt-4 w-full max-w-lg space-y-5">
                        <div className="flex mt-6 items-center space-x-3">
                            <p className="text-left font-medium">
                                上传一张照片(.jpg/.jpeg）
                            </p>
                        </div>

                        <ComboSelector 
                            onSelect = {(newFile) => setOriginalPhoto(newFile)}                                    
                            />
                    </div>
                    )}
                    
                    {restoredImage && (
                    <div className="w-full max-w-lg flex sm:space-x-4 flex-col items-center space-y-4">
                        <h2 className="mb-1 font-medium text-lg">What's in the picture?</h2>
                        <Image alt="restored photo" src={restoredImage}
                            className="rounded-2xl sm:mt-0 mt-2 w-full sm:w-auto min-h-40"                            
                            onLoadingComplete={() => setRestoredLoaded(true)}
                            onContextMenu ={() => {return false}}                        
                            />
                    </div>
                    )}                   
                   
                    {loading && (
                    <div className="absolute top-1/2 w-full flex flex-col items-center">
                      <LoadingButton/>
                    </div>                      
                    )}
                      
                    {error && (
                    <MessageZone message={error} messageType="ERROR"/>
                    )}
                    
                    <div className="flex space-x-2 justify-center">
                        {restoredLoaded && !loading && !error && (
                        <button
                            onClick={() => {
                              setOriginalPhoto(null);
                              setRestoredImage(null);
                              setRestoredLoaded(false);
                              setError(null);
                            }}
                            className="button-main rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                            再试一次
                        </button>
                        )}
                      </div>
                    </div>
                
              </main>
              <Footer />
            </div>
            );
            
    }else{
        return(
            <LoginPage config={config}/>
        );
    }
  
};
