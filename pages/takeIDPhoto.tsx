import Head from "next/head";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import DropDown from "../components/DropDown";
import PoseSelector from "../components/PoseSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

import { config, system } from "../utils/config";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2, callAPI } from "../utils/apiUtils";



let funcs: string[] = [
    "faceswap",
    "facefusion"
    ];
const funcNames = new Map([
    ["faceswap", "快速证件照——约30秒钟"],
    ["facefusion", "超能证件照——约1分钟"]
    ]);

export default function takeIDPhoto({ simRoomBody, image,  config }: { simRoomBody:any, image: Room, config:any }) {
    const router = useRouter();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [swapUrl, setSwapUrl] = useState((router.query.imageURL || router.query.swapUrl || image?.outputImage || simRoomBody?.params?.swap_image ||  "") as string);
    const [targetUrl, setTargetUrl] = useState(router.query.targetURL as string || simRoomBody?.params?.target_image || "");
    const [targetRect, setTargetRect] = useState<any>();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [background, setBackground] = useState<string>(simRoomBody?.params?.background || "default");
    const [func, setFunc] = useState<string>(simRoomBody?.params?.func || "facefusion");

    
    const backgrounds: string[] = [
        "default",
        "blue_bg",
        "white_bg",
        "red_bg"
    ];
    const backgroundNames = new Map([
        ["default", "保持当前模板背景"],
        ["blue_bg", "换成蓝色背景"],
        ["white_bg", "换成白色背景"],
        ["red_bg", "换成红色背景"],      
    ]);


    let title = router.query.title as string || "拍摄证件照";
    
    async function generate() {
        if(!window){
            return;
        }
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(swapUrl){
                params.set("swapUrl", swapUrl);
            }
            if(targetUrl){
                params.set("targetURL", targetUrl);
            }
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
            return;
        }
        
        if(!targetUrl){
            alert("请选择一个证件照的模板，或者自行上传一张！");
            return;                                                           
        }
        
        if(!swapUrl){
            alert("请上传一张包含你清晰面孔的照片");
            return;                                                           
        }      
        
        const params = {
            func,
            background,
            swap_image:swapUrl, 
            target_image:targetUrl,
        };
        const service = "/api/workflowAgent2";
        const res = await callAPI2(
            service, 
            {
                cmd: "takeIDPhoto", 
                params
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            }
        );   
    }


    const [demoRooms, setDemoRooms] = useState<any[]>([]);
    async function loadDemoRooms(){
        const res = await callAPI("/api/updateRoom", 
                                  {
                                      cmd:"GOTOPAGE", 
                                      pageSize:6, 
                                      currentPage:1,
                                      type:"IMAGE", 
                                      showBest: true, 
                                      word: "证件照",
                                  });
        if (res.status != 200) {
            alert(JSON.stringify(res.result as any));
        }else{
            setDemoRooms(res.result.rooms);
        }
    }

    useEffect(() => {
        loadDemoRooms();
    }, []); // 空数组表示只在组件挂载时执行一次   
    
    let num = 1;

    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} imageURL={swapUrl}/>                    
                
                <div className="page-container">
                    <div className="page-tab-image-create">
                        
                        <div className="space-y-4 w-full justify-center">
                            <FormLabel number={`${num++}`} label="您的照片（包含清晰脸部）"/>
                            <InputImage src={swapUrl}/>
                            <ComboSelector selectorType="USER" onSelect = {(newFile) => setSwapUrl(newFile)} />
                        </div>

                        <div className="space-y-4 w-full justify-center">
                            <FormLabel number={`${num++}`} label="参考模板（模仿着装、姿态和背景）"/>                                
                            <InputImage alt="证件照模板" src={targetUrl}/>
                            <PoseSelector 
                                onSelect = {(newFile) => setTargetUrl(newFile)}                                    
                                albumId = {system.album.ID.id}
                                />
                        </div>

                        <div className="space-y-4 w-full justify-center">
                            <FormLabel number={`${num++}`} label="证件照拍摄引擎"/>
                            <DropDown
                                theme={func}
                                // @ts-ignore
                                setTheme={(newRoom) => setFunc(newRoom)}
                                themes={funcs}
                                names={funcNames}
                                />
                        </div>
                        
                        <div className="space-y-4 w-full justify-center">
                            <FormLabel number={`${num++}`} label="更换照片背景"/>                                
                            <DropDown
                                theme={background}
                                // @ts-ignore
                                setTheme={(newRoom) => setBackground(newRoom)}
                                themes={backgrounds}
                                names={backgroundNames}
                                />
                        </div>

                        <div className="hidden w-full items-left text-left">
                            <p className="px-1 text-left font-medium w-full text-gray-200 ">
                                1、为了达到更好效果，原始照片的面部请选用尽量清晰的正脸照片。
                            </p>
                            <p className="px-1 text-left font-medium w-full text-gray-200 ">
                                2、请尽量选择和自己胖瘦、气质相近的证件照模板
                            </p>       
                        </div>                                

                        <StartButton config={config} title="开始拍摄" model={func} showPrice={true} loading={loading}
                            onStart={async () => {
                                setRestoredImage(null);
                                await generate();
                            }}
                            />
                        
                    </div>

                    <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"takeIDPhoto", model:func}} />

                </div>
            </main>
        </TopFrame>
    );
};

    
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let image = null;
    
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    monitor.logUserRequest(ctx, session);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),
            image,
            config
        },
    };
  
}            
