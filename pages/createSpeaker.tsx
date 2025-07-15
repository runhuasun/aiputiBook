import React, { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { useRouter } from "next/router";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import FlexAudio from "../components/FlexAudio";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import StartButton from "../components/StartButton";
import MessageZone from "../components/MessageZone";
import LoadingRing from "../components/LoadingRing";
import ResultView from "../components/ResultView";

import { callAPI } from "../utils/apiUtils";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";



const trainers = [
    "aliyun_cosyvoice_v1",
];

const trainerNames = new Map();
trainerNames.set("aliyun_cosyvoice_v1", "阿里云声音大模型V1");


export default function createSpeaker({ room, config }: { room:any, config: any }) {

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState<string>("");
    const [trainer, setTrainer] = useState<string>("aliyun_cosyvoice_v1");
    const [dataset, setDataset] = useState<string>(room?.outputImage);
    const [cleanVoice, setCleanVoice] = useState<boolean>(false);

    const router = useRouter();

    async function generate() {
        if(!name){
            return alert("请先给发音人起一个好听的名字吧！");
        }
        if(!dataset){
            return alert("请先上传、选择或者录入一段声音素材，我才可以开始克隆您的声音哦！");
        }
        try{
            setLoading(true);
            const res = await callAPI("/api/workflowAgent", {
                cmd: "createSpeaker",
                params: {
                    name,
                    dataset,
                    cleanVoice,
                    trainer
                }
            });
            if (res.status !== 200) {
                setError(res.result);
                return false;
            } else {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.id);                                      
            }                
        }catch(e){
            setError(JSON.stringify(e));
            return false;
        }finally{
            setLoading(false);
        }
    }

    let num = 1;
        
        return (
            <TopFrame config={config}>
                <main>
                    <ToolBar config={config}/>
                   
                    <div className="page-container">
                        
                        <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-5 w-full max-w-2xl">
                            
                            <div className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label={`发音人的名字`}/>
                                <input type="text" className="input-main" 
                                    defaultValue={name}
                                    onChange={(e) => setName(e.target.value)}                      
                                    />
                            </div>
                            {/*                        
                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label="训练服务"/>
                                <DropDown 
                                    theme={trainer}
                                    // @ts-ignore
                                    setTheme={(newTheme) => setTrainer(newTheme)}
                                    themes={trainers}
                                    names={trainerNames}
                                    />
                            </div>                    
                            */}
                            <div className="space-y-4 w-full">
                                <FormLabel number={`${num++}`} label="克隆声音的素材文件(.mp3/.wav)" />                                    
                                {dataset && (
                                <FlexAudio src={dataset} key={dataset} controls={true} loading={loading} 
                                        onLoading={(status:boolean)=>setLoading(status)}
                                        onAudioUpdate={(url:string, duration:number, current:number)=>{                                            
                                            if(url != dataset){
                                                setDataset(url);
                                            }
                                        }}    
                                    />                
                                )}
                                <ComboSelector onSelect = {(newFile) => setDataset(newFile)} fileType="VOICE" maxRecordTime={60}/> 
                            </div>

                            <FormLabel number={`${num++}`} label="清除背景音乐和背景噪音" isChecker={true} initValue={cleanVoice} onValueChange={(value) => {
                                setCleanVoice(value);
                            } }/>
                            
                            <div className="w-full items-left text-left space-y-3 tracking-wide font-light">
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {"1. 音频时长：10～20秒，不建议超过60秒。在朗读时请保持连贯，至少包含一段超过5秒的连续语音。"}
                                </p>
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {"2. 录音环境的选择主要考虑降低噪音和混响，建议使用10平方米以内的小型房间进行录音，特别是配置吸音装置的房间，录音效果更佳。"}
                                </p>       
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {"3. 录音时请与麦克风保持约10厘米距离，避免太近/太远造成喷麦和电流问题。"}
                                </p> 
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {"4. 室内噪音主要来自空调、风扇（含电脑风扇）、日光灯镇流器、人声等。可以利用手机录制环境声音，放大音量倾听录音，识别并关闭噪音源。"}
                                </p>     
                                <p className="px-1 text-left font-medium w-full text-gray-400">
                                    {"5. 文案中请避免出现只有几个字的短小句。在朗读时请保持连贯，避免频繁出现不必要的停顿（至少连续5秒），因为这会严重影响复刻效果，甚至导致复刻失败。"}
                                </p>      
                                <p className="px-1 text-left font-medium w-full text-gray-400">
                                    {"6. 建议在录音前熟悉文案，并确定好人设及演绎风格。带有情绪的朗读，避免机械地“读稿”，以免复刻的效果与您的心理预期不符。"}
                                </p>     
                                <p className="px-1 text-left font-medium w-full text-gray-400">
                                    {"7. 文案内容无特殊限制，但是请不要朗读具有敏感词的文案，这会导致复刻失败。"}
                                </p>                                 
                            </div>

                            <StartButton config={config} title="开始克隆声音" showPrice={true} loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null); 
                                    generate();
                                }}
                                />

                        </div>
                        
                        <ResultView
                            config={config}
                            loading={loading}
                            mediaType={"AUDIO"}
                            error={error}
                            restoredImage={restoredImage}
                            restoredId={restoredId}
                            demoRooms={{ func: "createSpeaker"}}
                        />
                        
                    </div>
                    
                </main>
                
            </TopFrame>
        );    
    
  
};


      
      
      
export async function getServerSideProps(ctx: any) {
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx?.query?.roomId;
    let room:any = null;
    if(roomId){
        room = await prisma.room.findUnique({
            where: {
                id: roomId
            },
            select: {
                outputImage: true,
                resultType: true,
            }
        });
        if(room.resultType != "VOICE"){
            room = null;
        }
    }
    monitor.logUserRequest(ctx, session);
    return {
        props: {
            room,
            config
        },
    };
}        
