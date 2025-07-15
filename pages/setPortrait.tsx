import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Footer from "../components/Footer";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import { getAppUserConfigValue } from "./api/appUserConfig";
import { deleteFiles } from "../utils/bytescale";
import Uploader, {mimeTypes} from "../components/Uploader";
import * as monitor from "../utils/monitor";
import InputImage from "../components/InputImage";



export default function setPortrait({ user, config, image }: { user: User, config: any, image:string }) {
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [portraitImage, setPortraitImage] = useState<string>(image);
    
    const router = useRouter();
    let appId = router.query.appId;
    
    const UploadDropZone = () => (
        <Uploader 
            mime= {mimeTypes.image}   
            setFiles ={upfiles => {
                if (upfiles.length !== 0) {
                    setPortraitImage(upfiles[0].uploadedUrl);
                }
            }}
            />           
    );


    async function updatePortrait() {
        
        if(image){
            const res = await fetch("/api/appUserConfig?cmd=UPDATE&key=USER_PORTRAIT&msgToWechat=true&value="+portraitImage + 
                                    "&appId=" + appId + 
                                    "&userId=" + user.id, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            let response = await res.json();
            if (res.status !== 200) {
                alert(response);
                setError(response as any);
            } else {
                // 如果上传成功新的形象，就删除旧的
                if(image){
                    deleteFiles([{filePath:image}]);
                }
                
                // alert(retJson as string);
                if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
                    WeixinJSBridge.invoke('hideToolbar');                    
                    WeixinJSBridge.invoke('closeWindow', {}, function(res) {});
                }
            }
        }else{
            alert("请先上传一张照片！");
        }
    }

    
    if(status == "authenticated"){
        return (
            <div className="flex mx-auto flex-col items-center justify-center min-h-screen">
                <Head>
                    <title>上传个人形象照</title>
                </Head>

                <main>
                    <div className="space-y-4 w-full max-w-lg">
                        <div className="w-full max-w-lg items-center justify-center">
                            <InputImage src={portraitImage} />
                        </div>                          
                        <UploadDropZone />
                    </div>
                    
                    <div className="w-full pt-5 flex flex-row space-x-8 items-center justify-center">
                        <button
                            onClick={() => {
                                updatePortrait();
                           }}
                           className=" rounded-lg button-gold  px-10 py-2 "
                           >
                            <span>保存形象照片</span>
                        </button>
                    </div>
                </main> 
            </div>
        );
    }else{
        return(
            <LoginPage config={config}/>
        );
    }

};



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    
    if (session && session.user  && session.user.email) {
        // Get user from DB
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                name: true,           
                email: true,
                image: true,
                credits: true,
              },
        });

        const appId = ctx.query.appId as string;

        if(user && appId){
            let image = await getAppUserConfigValue(appId, user.id, "USER_PORTRAIT");
            if(!image){
                image = config.RS + "/demo/portrait_demo.jpg";
            }
            return {
                props: {
                    user,
                    config,
                    image
                },
            };
        }
    }
    
    return {
        props: {
            config
        },
    };
}  
