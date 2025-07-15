import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";
import prisma from "../lib/prismadb";
import Link from "next/link";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";

import { callAPI, callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (session && session.user  && session.user.email) {
        let roomId = ctx?.query?.roomId;
        let image = null;
        if(roomId){
            image = await prisma.room.findUnique({
                where: {
                    id: roomId,
                },
            });
        }
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });

        if(user){
            monitor.logUserRequest(ctx, session, user);            
            return {
                props: {
                    simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                    
                    image,
                    config
                },
            };
        }
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            config
        },
    };
}  


const imageThemes: string[] = [
    "ghiblify",
    "anime",
    "3d",
    "handdrawn",
    "sketch",
    "artstyle",
    "claborate",
    "hongkong",
    "comic",
    "animation3d",    
];
let themes:string[] = imageThemes;

const themeNames = new Map();
themeNames.set("ghiblify", "吉卜力画风");
themeNames.set("anime","日漫风");
themeNames.set("3d","3D");
themeNames.set("handdrawn","手绘");
themeNames.set("sketch","铅笔画");
themeNames.set("artstyle","艺术特效");
themeNames.set("claborate","国画工笔画");
themeNames.set("hongkong","港漫风");
themeNames.set("comic","漫画风格");
themeNames.set("animation3d","动画3D");

export default function photo2cartoon({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>();
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);
    const [theme, setTheme] = useState<string>(simRoomBody?.params?.params?.algoType || "ghiblify");

    const [fileType, setFileType] = useState<string>("image");
    const [themes, setThemes] = useState<string[]>(imageThemes);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    useEffect(() => {
        const inputImage = (router.query.imageURL || image?.outputImage || simRoomBody?.params?.params?.imageURL || "") as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setOriginalPhoto(result);
                }
            });
        }else{
            setOriginalPhoto("");
        }
    }, []); // 空数组表示只在组件挂载时执行一次
    
    // @ts-ignore
    const title="艺术风格转换";

    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张照片");
        }
        
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);
        let rid = "";
        switch(theme){
            case "Cartoonify": rid = "f109015d60170dfb20460f17da8cb863155823c85ece1115e1e9e4ec7ef51d3b"; break;
            case "Sticker": rid = "764d4827ea159608a07cdde8ddf1c6000019627515eb02b6b449695fd547e5ef"; break;
            default: rid = "a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf";
        }

        let func = "photo2cartoon";
        if(theme == "ghiblify"){
            func = "ghiblify";
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "photo2cartoon",
                preRoomId,
                params: {
                    func,
                    rid,
                    params: {
                        imageURL: originalPhoto, 
                        algoType: theme, 
                    }
                },
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
                                      func: "photo2cartoon",
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
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />
                    
                    <div className="page-container">
                        
                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                            onSelectRoom={(newRoom:any)=>{
                                setPreRoomId(newRoom?.id);
                            }}
                            onSelectImage={(newFile:string)=>{
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                            onContinue={(newFile:string)=>{
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                        />  

                        <div className="page-tab-edit">
                          
                            <FormLabel number={`${num++}`} label="我喜欢的风格"/>
                            <DropDown theme={theme} themes={themes} names={themeNames}
                                // @ts-ignore
                                setTheme={(newTheme) => setTheme(newTheme)}
                                />
                            
                            <StartButton config={config} title="开始转换" showPrice={true} loading={loading}
                                onStart={async () => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);
                                    generatePhoto();  
                                }}
                                />

                            <div className="hidden w-full max-w-lg flex flex-col items-start space-y-2 pt-20">
                                <div className="w-full max-w-lg flex flex-row items-center justify-center">
                                    <span>想模仿任意图片的风格？</span>
                                    <Link href={`/changeStyle?imageURL=${originalPhoto}`} className="underline underline-offset-2">模仿画风</Link>
                                </div>   
                            </div>
                        </div>

                    </div>
               
                </main>
            </TopFrame>
        );
    
  
};

