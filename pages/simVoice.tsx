import React, { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";
import TextareaAutosize from "react-textarea-autosize";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import ComboSelector from "../components/ComboSelector";
import FlexAudio from "../components/FlexAudio";
import LoadingDots from "../components/LoadingDots";
import LoadingButton from "../components/LoadingButton";
import PriceTag from "../components/PriceTag";
import MessageZone from "../components/MessageZone";
import LoadingRing from "../components/LoadingRing";
import InputImage from "../components/InputImage";
import StartButton from "../components/StartButton";
import PromptArea from "../components/PromptArea";

import { callAPI, callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



const trainers = [
    "fish-speech",
];

const trainerNames = new Map();
trainerNames.set("fish-speech", "fish-speech");


export default function simVoice({ room, config }: { room:any, config: any }) {
   
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [recognizing, setRecognizing] = useState<boolean>(false);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);    
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sampleText, setSampleText] = useState<string>();
    const [sampleVoice, setSampleVoice] = useState<string>(room?.outputImage);    

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioDuration, setAudioDuration] = useState<number>(0);

    
    const [trainer, setTrainer] = useState<string>("fish-speech");
    const [cleanVoice, setCleanVoice] = useState<boolean>(false);
    const [text, setText] = useState("");

    const segLength = 100;
    const maxLength = segLength * 10;    
    function getPriceUnits(){
        if(text?.length > 0){
            return Math.ceil(text.length / segLength);
        }else{
            return 0;
        }
    }
    
    async function generate() {
        if(!text){
            return alert("请输入您希望生成语音的内容");
        }
        if(!sampleVoice){
            return alert("请先上传、选择或者录入一段声音素材，我才可以开始模仿您的声音哦！");
        }
        if(!sampleText){
            return alert("请输入您参考语音对应的文字内容。可以点击“AI识别”按钮来自动填写！");
        }              
        if(audioDuration>60){
            return alert(`上传的声音素材不要大于60秒，你现在上传的音频长度${Math.round(audioDuration)}秒，请换一个吧！`);
        }
        
        try{
            setLoading(true);
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "simVoice",
                    params: {
                        func: trainer,
                        cleanVoice,                    
                        params: {
                            text: text,
                            speaker_reference: sampleVoice,
                            text_reference: sampleText,
                        }
                    }
                },
                "生成音频",
                "VOICE",
                (status:boolean)=>{setLoading(status)},
                (res:any)=>{
                    mutate();
                    setRestoredImage(res.result.generated);
                    setRestoredId(res.result.genRoomId);                                      
                }  
            );
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
        }
    }

    async function recognizeVoice(){
        try{
            if(audioDuration<=0){
                return alert(`请您等待音频文件上传完毕，在进行AI语音识别操作！`);
            }            
            if(audioDuration>60){
                return alert(`上传的声音素材不要大于60秒，你现在上传的音频长度${Math.round(audioDuration)}秒，请裁剪音频，或者换一个吧！`);
            }            
            setRecognizing(true);
            const res = await callAPI("/api/simpleAgent", 
                                      {
                                          cmd:"recognizeVoice",
                                          params:{
                                              voiceURL: sampleVoice
                                          }
                                      });
            if (res.status != 200) {
                alert(JSON.stringify(res.result as any));
            }else{
                setSampleText(res.result.text);
            }
        }finally{
            setRecognizing(false);
        }
    }
    

    let num = 1;
        
        return (
            <TopFrame config={config}>
                <main>
                    <ToolBar config={config}/>
                   
                    <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                        
                        <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-5 w-full max-w-2xl">
                            
                            <div className="space-y-4 w-full ">
                                <FormLabel number={`${num++}`} label={`文字内容（${text?.length || 0}/${maxLength}字）`}/>                                                            
                                <PromptArea
                                    initMinRows={5}
                                    initMaxRows={30}
                                    maxLength={maxLength}
                                    hasAdvanceButton={false}
                                    userPrompt={text}
                                    initPlaceHolder="输入需要转换成音频的文字"
                                    onUserPromptChange={e => setText(e)}
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
                                <FormLabel number={`${num++}`} label="学习模仿的声音文件（小于60秒）" />                                    
                                {sampleVoice && (
                                <FlexAudio ref={audioRef} src={sampleVoice} key={sampleVoice} controls loading={loading}
                                    onLoading={(status:boolean)=>setLoading(status)}
                                    onAudioUpdate={(url:string, duration:number, current:number)=>{                                            
                                        if(url != sampleVoice){
                                            setSampleVoice(url);
                                        }
                                        setAudioDuration(duration);
                                    }}                    
                                    />
                                )}
                                <ComboSelector onSelect = {(newFile) => setSampleVoice(newFile)} fileType="VOICE" maxRecordTime={60}/> 
                            </div>
                            
                            <div className="space-y-4 w-full ">
                                <div className="w-full flex flex-row space-x-3 ">
                                    <FormLabel number={`${num++}`} label="模仿声音的原始文本"/>
                                    {sampleVoice && !recognizing && ( 
                                    <button className={"button-green-blue text-sm px-3 py-1 mt-3"}
                                        onClick = {() => {
                                            recognizeVoice();
                                        }}
                                        >  
                                        <span>AI识别</span>                                        
                                    </button>
                                    )}
                                    {recognizing && ( 
                                    <button className={"button-green-blue text-sm px-6 py-1 mt-3"}>
                                        <LoadingDots color="white" style="large" />
                                    </button>
                                    )}
                                    {!sampleVoice && (
                                    <button className={"button-dark text-sm px-3 py-1 mt-3"} disabled >  
                                        <span>AI识别</span>                                        
                                    </button>
                                    )}
                                </div>     
                                <PromptArea
                                    initMinRows={4}
                                    initMaxRows={30}
                                    maxLength={1000}
                                    hasAdvanceButton={false}
                                    userPrompt={sampleText}
                                    initPlaceHolder="输入参考声音的原始文本会强化模仿效果"
                                    onUserPromptChange={e => setSampleText(e)}
                                />                                
                            </div>
                            
                            <FormLabel number={`${num++}`} label="清除背景音乐和背景噪音" isChecker={true} initValue={cleanVoice} onValueChange={(value) => {
                                setCleanVoice(value);
                            } }/>
                            
                            <div className="w-full items-left text-left space-y-3 tracking-wide font-light">
                                <p className="px-1 text-left font-medium w-full text-gray-400 ">
                                    {"1. 音频时长：10～20秒，不超过60秒。在朗读时请保持连贯，至少包含一段超过5秒的连续语音。"}
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
                            <div className= "flex flex-col space-y-2 items-center">
                                {status === "authenticated" && data && (
                                <PriceTag config={config} units={getPriceUnits()} unitName={`${segLength}字`} />
                                )}
                                
                                {loading ? (
                                    <LoadingButton minTime={30} maxTime={60} timeUnit={"秒"}/>
                                ):(
                                <StartButton config={config} title="开始模仿声音"
                                    onStart={() => {
                                        setRestoredImage(null);
                                        setRestoredLoaded(false);
                                        setError(null); 
                                        generate();
                                    }}
                                    />
                                ) }
                            </div>                    

                        </div>
                        
                        <div className="flex flex-1 flex-col space-y-5 w-full rounded-lg min-h-[calc(100vh-180px)] mr-2 items-center justify-center border border-1 border-gray-300 border-dashed">
                            {error && (
                            <MessageZone message={error} messageType="ERROR"/>
                            )}                  

                            {loading && !error && !restoredImage && (
                            <LoadingRing/>
                            )}
                            
                            {restoredImage && restoredId && (
                            <audio id="audioPlayer" controls className="w-2/3">
                                <source src={restoredImage} type="audio/mpeg"/>
                                <source src={restoredImage} type="audio/wav"/>
                                <source src={restoredImage} type="audio/ogg"/>
                            </audio>
                            )}
                        </div>
                        
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
