import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";
import { useSession, signIn } from "next-auth/react";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    let imgId = ctx?.query?.roomId;
    let image = null;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }        
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            image,
            config,
        },
    };
}  



const modelNames = new Map([
    ["wanx-ast","自动配标题和文字"],
]);
const models = Array.from(modelNames.keys());

export default function autoCaption({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    let num = 1;
    const router = useRouter();

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [originalPhoto, setOriginalPhoto] = useState<string|null>((router.query.imageURL || image?.outputImage || simRoomBody?.params?.imageURL) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output || null);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession(); 
   
    const [model, setModel] = useState<string>(simRoomBody?.params?.model || "wanx-ast");
    const [logo, setLogo] = useState<string>(simRoomBody?.params?.logo || "");
    const [title, setTitle] = useState<string>(simRoomBody?.params?.titles?.[0] || "");
    const [subTitle, setSubTitle] = useState<string>(simRoomBody?.params?.subTitles?.[0] || "");
    const [text_1, setText_1] = useState<string>(simRoomBody?.params?.texts?.[0] || "");  
    const [text_2, setText_2] = useState<string>(simRoomBody?.params?.texts?.[1] || "");  
    const [text_3, setText_3] = useState<string>(simRoomBody?.params?.texts?.[2] || "");    


    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一张照片");
        }
        setLoading(true);

        try{
            if(await fu.checkImageConstraint(originalPhoto, {width:3840, height:2160, mb:50}, true)){
                return;
            }
            if(await fu.checkImageConstraint(logo, {width:1280, height:1280, mb:5}, true)){
                return;
            }        
            
            const texts = [text_1, text_2, text_3].filter(Boolean);
            
            let res = await callAPI2(
                "/api/workflowAgent2", 
                { 
                    cmd:"autoCaption", 
                    preRoomId,
                    params:{
                        func:model,                
                        imageURL: originalPhoto,
                        logo,
                        titles: [title],
                        subTitles: [subTitle],
                        texts
                    }
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
        }finally{
            setLoading(false);
        }
    }
    
    
    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />

                <div className="page-container">

                    <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        showDemo={false}
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
                        
                        <div className="space-y-3 w-full">                            
                            <FormLabel number={`${num++}`} label={`主标题（${title.length} / 30）`}/>   
                            <PromptArea hasAdvanceButton={false} initMinRows={2} initMaxRows={4} maxLength={30} 
                                userPrompt={title}
                                onUserPromptChange={(up) => setTitle(up) }
                                />                          
                        </div>
                        <div className="space-y-3 w-full">                            
                            <FormLabel number={`${num++}`} label={`副标题[${subTitle.length} / 30]`}/>   
                            <PromptArea hasAdvanceButton={false} initMinRows={2} initMaxRows={4} maxLength={30}
                                userPrompt={subTitle}
                                onUserPromptChange={(up) => setSubTitle(up) }
                                />                          
                        </div>
                        <div className="space-y-3 w-full">                                                    
                            <FormLabel number={`${num++}`} label="企业LOGO（必须PNG格式）" onCancel={() => setLogo("")}/>
                            <InputImage src={logo} maxSize={{width:1280, height:1280, mb:5}}/> 
                            <ComboSelector maxFileSize={5} mimeType={{'image/png': ['.png']}}
                                showDemo={false}
                                onSelect = {(newFile) => ( setLogo(newFile) )} />                            
                        </div>
                        <div className="space-y-3 w-full">                            
                            <FormLabel number={`${num++}`} label={`内容文字（1）[${text_1.length} / 30]`}/>   
                            <PromptArea hasAdvanceButton={false} initMinRows={2} initMaxRows={5} maxLength={30} 
                                userPrompt={text_1}
                                onUserPromptChange={(up) => setText_1(up) }
                                />                            
                        </div>
                        <div className="space-y-3 w-full">                            
                            <FormLabel number={`${num++}`} label={`内容文字（2）[${text_2.length} / 30]`}/>   
                            <PromptArea hasAdvanceButton={false} initMinRows={2} initMaxRows={5} maxLength={30} 
                                userPrompt={text_2}
                                onUserPromptChange={(up) => setText_2(up) }
                                />                            
                        </div>
                        <div className="space-y-3 w-full">                            
                            <FormLabel number={`${num++}`} label={`内容文字（3）[${text_3.length} / 30]`}/>   
                            <PromptArea hasAdvanceButton={false} initMinRows={2} initMaxRows={5} maxLength={30} 
                                userPrompt={text_3}
                                onUserPromptChange={(up) => setText_3(up) }
                                />                            
                        </div>

                        <StartButton config={config} title="开始" showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                                generatePhoto();
                            }}
                            />
                    </div> 
                </div>
            </main>
        </TopFrame>
    );
};
