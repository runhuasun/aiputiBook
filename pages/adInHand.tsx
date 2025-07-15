import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ComboSelector from "../components/ComboSelector";
import FormLabel from "../components/FormLabel";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import InputImage from "../components/InputImage";
import ResultView from "../components/ResultView";
import Footer from "../components/Footer";

import { callAPI2 } from "../utils/apiUtils";
import * as rmu from "../utils/roomUtils";
import { config, system } from "../utils/config";
import * as monitor from "../utils/monitor";



export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                
            config
        },
    };
}


export default function adInHand({ simRoomBody, config }: { simRoomBody:any, config:any}) {
    
    const router = useRouter();
    const title = "产品使用图制作";
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const [loading, setLoading] = useState<boolean>(false);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
  
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || simRoomBody?.params?.productImage) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);

    const [modelImage, setModelImage] = useState<string>(simRoomBody?.params?.modelImage);
    const [bgImage, setBgImage] = useState<string>(simRoomBody?.params?.bgImage);
    const [prompt, setPrompt] = useState<string>(simRoomBody?.params?.prompt || "");
    const [drawRatio, setDrawRatio] = useState<string>(router.query.drawRatio as string || simRoomBody?.params?.drawRatio || "916");
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    async function generate() {
        if(!originalPhoto){
            alert("请先上传一张产品图片");
            return;
        }
        if(!modelImage){
            alert("请先上传一张模特照片");
            return;
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2",
            { 
                cmd: "adInHand",
                params: {
                    func: "multi-image-kontext-pro", 
                    drawRatio, 
                    productImage: originalPhoto, 
                    modelImage, 
                    bgImage,
                    prompt, 
                },
            },
            "广告生成",
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);                                      
            }
        );
    }


    
    let num = 1;
    
        return (
            <TopFrame config={config}>
                <main>                    
                    <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto}/>
                    
                    <div className="page-container">
                        <div className="page-tab-image-create">
                            <div className="w-full flex flex-row space-x-3 ">
                                <FormLabel number={`${num++}`} label="产品图片（最好无背景）"/>
                                <button className={"button-green-blue text-xs px-2 py-1 mt-3"}
                                    onClick = {() => {
                                        window.open("/removeBG" + (originalPhoto ? `?imageURL=${originalPhoto}&method=AUTO` : ''), "_blank");
                                    }}
                                    >  
                                    抠图工具
                                </button>
                            </div>
                            <InputImage src={originalPhoto} />
                            <ComboSelector 
                                selectorType="TEMPLATE" albumId={system.album.demoProduct.id} albumName="样例"                                                        
                                onSelectRoom = {async (newRoom) => {
                                    setPreRoomId(newRoom?.id);
                                }}                                       
                                onSelect = {(newFile) => setOriginalPhoto(newFile)} showDemo={false}
                                />                               

                            <FormLabel number={`${num++}`} label="模特照片（正面清晰）"/>
                            <InputImage src={modelImage} />
                            <ComboSelector 
                                onSelect = {(newFile) => setModelImage(newFile)} showDemo={false}
                                />                               


                            <FormLabel number={`${num++}`} label="画面输出比例"/>
                            <DrawRatioSelector defaultRatio = {drawRatio} onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                            
                            <FormLabel number={`${num++}`} label="描绘广告画面"/>
                            <div className="relative inline-block w-full">
                                <PromptArea initPlaceHolder="女模特手里拿着口红"
                                    hotWords="AD_IN_HAND"
                                    hasAdvanceButton={false}
                                    userPrompt={prompt}
                                    readOnly={false}
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />  
                            </div>                                  

                            <StartButton config={config} title="开始生成" showPrice={true} loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null); 
                                    generate();
                                }}
                                />

                        </div>

                        <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"adInHand"}} />
                    
                    </div>
                    
                </main>
                
            </TopFrame>
        );
        
};

//export default Home;

