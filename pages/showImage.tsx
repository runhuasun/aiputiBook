import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { UploadDropzone } from "react-uploader";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import { User, Room } from "@prisma/client";

import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { GenerateResponseData } from "./api/generate";

import { uploader, cnLocale, uploaderOptions} from "../components/uploadOption";
import { CompareSlider } from "../components/CompareSlider";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import AlbumSelector from "../components/AlbumSelector";
import LoginPage from "../components/LoginPage";
import ErrorPage from "../components/ErrorPage";
import * as gh from "../components/Genhis";
import ModelSelector from "../components/ModelSelector";
import FormLabel from "../components/FormLabel";
import AutoSizeImage from "../components/AutoSizeImage";
import RoomAdminPanel from "../components/RoomAdminPanel";
import Image from "../components/wrapper/Image";

import { config } from "../utils/config";
import { getImageIcon } from "../utils/fileUtils";
import { callAPI } from "../utils/apiUtils";
import { getFuncLink, getFuncTitle, getCreateLink} from "../utils/funcConf";
import downloadPhoto from "../utils/fileUtils";
import * as ru from "../utils/restUtils";
import TextareaAutosize from "react-textarea-autosize";
import * as monitor from "../utils/monitor";




export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);    
    let user;
  
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            }
        });
    }    
    
    let imageURL = ctx?.query?.imageURL as string;
    
    return {
        props: {
            imageURL,
            user,
            config
        },
    };
}  





export default function showImage({ imageURL, user, config}: { imageURL : string, user: User, config: any, }) {  
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(imageURL || null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    
    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }
    
    if( !imageURL){
        return (
            <ErrorPage config={config} pageName="图片详情" errMsg="因为没有指定图片，或者指定的图片不存在，所以无法查看图片"></ErrorPage>
        );
    }
    
    return (
        
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Head>
                <title>{"用户上传的作品"}</title>
                <meta property="og:description" content={"图片细节"} />
                <meta property="og:title" content={"AI艺术家的作品"} />
                <meta property="og:image" content={config.logo32} />    
                <meta name="description" content={"图片细节"} />   
            </Head>
            <Header config={config}/>
      
            <main>
              
                <div className="flex justify-between items-center w-full flex-col mt-2">
                    { originalPhoto && (
                  
                    <div className="flex flex-col sm:flex-row w-full">
                        <div className="flex flex-1 items-center justify-center border border-1 border-gray-300 border-dashed">
                            <Image alt="图片" src={originalPhoto} className="w-auto h-auto"/>
                        </div>                        
                    </div>
                    )}

                </div>
            </main>
            
            <Footer />
        </div>  
    
    );
}
