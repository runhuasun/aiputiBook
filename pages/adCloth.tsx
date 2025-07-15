import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";
import TextareaAutosize from "react-textarea-autosize";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import DrawRatioSelector from "../components/DrawRatioSelector";
import StartButton from "../components/StartButton";
import ImageView from "../components/ImageView"; // 虽未贴出但你实际使用了

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { callAPI2, callAPI } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config, system } from "../utils/config";
import {callChatStream} from "../utils/apiUtils";


export default function adCloth({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: Room, config:any }) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [clothImage, setClothImage] = useState<string>(simRoomBody?.params?.clothImage || defaultImage?.outputImage || "");
    const [clothDesc, setClothDesc] = useState(simRoomBody?.params?.clothDesc || "");
    const [modelDesc, setModelDesc] = useState(simRoomBody?.params?.modelDesc || "");
    const [bgDesc, setBgDesc] = useState(simRoomBody?.params?.bgDesc || "");
    const [drawRatio, setDrawRatio] = useState<string>(router.query.drawRatio as string || simRoomBody?.params?.drawRatio || "916");
    const [title, setTitle] = useState<string>("生成服装模特展示图");
    const [recognizing, setRecognizing] = useState<boolean>(false);
    
    useEffect(() => {
        if(defaultImage?.outputImage){
            fu.aliyunImageRestrictResize(defaultImage.outputImage).then((result)=>{
                if(result){
                    setClothImage(result);
                }
            });
        }
    }, []); // 空数组表示只在组件挂载时执行一次

    async function recognizeCloth(){
        if(clothImage && session?.user){
            // let question:string = "Identify the style, color scheme, and material of the clothes in the current image and provide a concise description. For example, a red T-shirt with a rose pattern, made of pure cotton material";
            let question:string = `请识别图片中衣服，并用中文准确描述衣服的款式、色系、花纹、材质面料。
            输出举例：一件白色的T恤衫，中间印有玫瑰花的图案，纯棉的材质。
            此外，你的思考过程也要用中文输出。`;
            setRecognizing(true);    
            await callChatStream(
                session?.user, question, clothImage, system.chatModels.clothKnowlege.id, 
                (content:string, realContent:string, retMsg:string) => {
                    setRecognizing(false);
                    if(realContent){
                        setClothDesc(realContent);    
                    }else{
                        setClothDesc(content);
                    }
                },
                (content:string, realContent:string) => {
                    setTimeout(() => {
                        setRecognizing(false);
                    }, 200);                              
                }
            );                       
        }
     }
    
   
    async function generate() {
        if(!clothImage){
            return alert("请先选择或上传一张衣服的照片！");
        }
        if(!clothDesc){
            return alert("请先描述一下服装的主要特征特点");
        }
        if(!modelDesc){
            return alert("请描述一下模特的外贸特征");
        }
        if(!bgDesc){
            return alert("请描述一下产品图的别境");
        }
        
        let params:any = {
            func: "segfit-v1.1",
            clothImage,
            clothDesc,
            modelDesc,
            bgDesc,
            drawRatio
        };

        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd:"adCloth", 
                preRoomId,
                params
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            },
            (res:any)=>{
                if(res.result.indexOf("输入无效")>=0){
                    alert("图片尺寸不符合要求，请用照片裁剪功能，先把照片裁剪成标准16:9，标准9:16，标准4:3，标准3:4，或者标准1:1尺寸，再来尝试");
                    window.open(`/editImage?imageURL=${clothImage}`);
                    return true;
                }else{
                    return false;
                }
            }
        );                    
    }

    let num = 1;

       
    return (
        <TopFrame config={config}>
            <main>
                
                <ToolBar config={config} roomId={preRoomId} imageURL={clothImage} restoredImage={restoredImage} restoredId={restoredId} />
                
                <div className="page-container">

                    <ImageView num={num++} originalPhoto={clothImage} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        selectorType="TEMPLATE" albumId={system.album.demoCloth.id} albumName="样例"                        
                        originalTitle={"原始服装照片（最好无背景)"}
                        restoredTitle={"模特试穿效果"}
                        onSelectRoom={(newRoom:any)=>{
                            setPreRoomId(newRoom?.id);
                        }}
                        onSelectImage={(newFile:string)=>{
                            setClothImage(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                        onContinue={(newFile:string)=>{
                            setClothImage(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                    />  
                    
                    <div className="page-tab-edit">                        
                        <div className="w-full flex flex-row space-x-3 ">                        
                            <FormLabel number={`${num++}`} label="描绘左侧服装的款式特点" hint="描绘服装款式特点有利于AI更好的复刻服装细节，并应用于模特的试穿图上"/>   
                            <button
                                className="button-green-blue text-xs px-2 py-1 mt-3"
                                onClick={() => {
                                    recognizeCloth()
                                }}
                            >
                                AI识别
                            </button>                            
                        </div>
                        <PromptArea
                            hotWords="CLOTH_DESC"
                            hasAdvanceButton={false}
                            userPrompt={recognizing ? "AI正在识别中..." : clothDesc}
                            readOnly={recognizing}
                            onUserPromptChange={(up) => setClothDesc(up) }
                            />  
                        
                        <FormLabel number={`${num++}`} label="描绘您期待的模特样貌特征"/>                                
                        <div className="relative inline-block w-full">
                            <PromptArea
                                hotWords="MODEL_DESC"
                                hasAdvanceButton={false}
                                userPrompt={modelDesc}
                                readOnly={false}
                                onUserPromptChange={(up) => setModelDesc(up) }
                                />  
                        </div>     

                        <FormLabel number={`${num++}`} label="描绘产品图的背景"/>                                
                        <div className="relative inline-block w-full">
                            <PromptArea
                                hotWords="BG"
                                hasAdvanceButton={false}
                                userPrompt={bgDesc}
                                readOnly={false}
                                onUserPromptChange={(up) => setBgDesc(up) }
                                />  
                        </div>                                   
                            
                        <FormLabel number={`${num++}`} label="照片输出比例"/>
                        <DrawRatioSelector defaultRatio = {drawRatio} onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    

                        <StartButton config={config} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}/>

                    </div>

                </div>                          
        
            </main>
        </TopFrame>
    );
};

    
      
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    let defaultImage = null;
    
    if(imgId){
        defaultImage = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            defaultImage,
            config
        },
    };
  
}            
