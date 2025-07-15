import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import { Room, Prompt, User } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";
import ImageView from "../components/ImageView";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import PromptSelector from "../components/PromptSelector";
import PromptAssistant from "../components/PromptAssistant";

import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import {callAPI, callAPI2} from "../utils/apiUtils";
import { rooms, roomNames, supportRefImg } from "../utils/modelTypes";



const cameraNames = new Map([
    ["flux-kontext-pro", "用当前衣着形象拍摄快照"],
    ["minimax-image-01", "自然唯美人像摄影"],
    ["flux-pulid", "创意人像摄影"],
    ["flux-pro-ultra", "超清高细节人像摄影"],
]);
const cameras = Array.from(cameraNames.keys());
    
export default function superCamera({ simRoomBody, defaultPrompt, defaultFunc, config }: { simRoomBody:any, defaultPrompt:string, defaultFunc:string, config:any}) {
    
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [price, setPrice] = useState("");

    const router = useRouter();

    let title = router.query.title as string || "极简人像摄影";    
    let defSeed = router.query.seed as string;  
    let defaultDrawRatio = router.query.drawRatio as string;
    const [seed, setSeed] = useState<string>(defSeed || simRoomBody?.params?.seed || "");  
    const [room, setRoom] = useState<string>(simRoomBody?.params?.func || "flux-pulid"); // defaultFunc as roomType || 
    const [prompt, setPrompt] = useState(defaultPrompt || simRoomBody?.params?.inputText || "");
    const [sysPrompts, setSysPrompts] = useState<string>(""); 
    const [drawRatio, setDrawRatio] = useState<string>(defaultDrawRatio || simRoomBody?.params?.drawRatio || "916");
    const [refImage, setRefImage] = useState<string>((router.query.refImage || simRoomBody?.params?.imageUrl || "") as string);
    const [faceImage, setFaceImage] = useState<string>((router.query.imageURL || router.query.faceImage || simRoomBody?.params?.swap_image || "") as string );
    const [swapMode, setSwapMode] = useState<string>(simRoomBody?.params?.swapMode || "faceswapHD");
    const [userDesc, setUserDesc] = useState<string>("");          
    const [userRecognizing, setUserRecognizing] = useState<boolean>(false);    
    
    let tizi = router.query.price;
    const drawRatios: string[] = [
        "916",
        "169",
        "11"
    ];
    
    const drawRatioNames = new Map([
        ["916", "9:16 适合手机/PAD"],
        ["169", "16:9 适合电脑"],
        ["11", "1:1 适合画框"]
    ]);

    const swapModes: string[] = [
        "faceswap",
        "faceswapHD",
        "facefusion"
        ];
    const swapModeNames = new Map([
        ["faceswap", "快速用户形象约10秒钟"],
        ["faceswapHD", "高清用户形象约30秒钟"],
        ["facefusion", "深度学习用户形象大约1分钟"]
        ]);

    
    function isPositiveInteger(str: string): boolean {
        // 使用正则表达式匹配字符串是否为正整数，^表示开头，\d+表示匹配一个或多个数字，$表示结尾
        const regExp = /^\d+$/;
        return regExp.test(str);
    }
    
    async function generatePhoto() {

        if(!window){
            return;
        }
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(prompt){
                params.set("prompt", prompt);
            }
            if(refImage){
                params.set("refImage", refImage);
            }
            if(faceImage){
                params.set("faceImage", faceImage);
            }            
            if(room){
                params.set("func", room);
            }
                
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
            return;
        }
        
        if(!faceImage){
            return alert("需要先提供一张用户形象照！");
        }
    
        if(seed && seed.trim()!="" && !isPositiveInteger(seed)){
            alert("图片种子必须是一个正整数，如果不知道用什么种子，可以不输入，系统会随机产生");
            return;
        }

        setRestoredImage(null);
        setRestoredId(null);                
        setError(null);        

        let inputText = `一张高清照片, 画面细节丰富。${prompt}, ${sysPrompts}`;
        let realText = `一张高清照片, 画面细节丰富。${room==="flux-kontext-pro" ? " a person " : userDesc}, ${prompt}, ${sysPrompts}`;
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "superCamera", 
                params: { 
                    swap_image: faceImage, 
                    imageUrl: refImage,
                    drawRatio, 
                    realText, 
                    inputText, 
                    func:room, 
                    swapMode, 
                    price: 2 , 
                    access:"PRIVATE", 
                    seed:seed, 
                }
            },
            "拍摄",
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);                                      
            }
        );        
    }


    async function recognizeFace(imageURL:string){
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUserRecognizing(true);
        const res = await callAPI("/api/simpleAgent", {
            cmd:"recognizeFace", 
            params:{imageURL}
        });
        if (res.status != 200) {
            alert("没有检测到清晰的人物，建议更换照片试试");
        }else{
            const faces = JSON.parse(res.result?.generated);
            if(faces && faces.length>1){
                alert("检测到上传的图片多于一张人脸，这将不能正确执行拍照，请重新上传");
            }else{
                // 根据识别的人脸修改用户描述
                let desc = "一位";
                
                // 做一下减龄处理
                if(faces[0].age > 25){
                    faces[0].age = Math.round(faces[0].age * 0.9); 
                }else if(faces[0].age > 30){
                    faces[0].age = Math.round(faces[0].age * 0.8);
                }else if(faces[0].age > 50){
                    faces[0].age = Math.round(faces[0].age * 0.7);
                }
                
                switch(faces[0].gender){
                    case 0: 
                        if(faces[0].age <= 3){
                            desc += "女婴";                                
                        }else if(faces[0].age >= 4 && faces[0].age <= 8){
                            desc += "小女孩";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "女孩";
                        }else if(faces[0].age >= 13 && faces[0].age <= 16){
                            desc += "少女";
                        }else if(faces[0].age >= 17 && faces[0].age <= 40){
                            desc += "年轻女性";
                        }else if(faces[0].age >= 41 && faces[0].age <= 60){
                            desc += "中年女士";
                        }else if(faces[0].age >= 61 && faces[0].age <= 80){
                            desc += "老年女士";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "老奶奶";
                        }

                        if(faces[0].beauty > 80){
                            desc += ", 女模特";
                        }else if(faces[0].beauty > 70){
                            desc += ", 非常漂亮";
                        }else if(faces[0].beauty > 50){
                            desc += "，美女";
                        }
                        break;
                    case 1:
                        if(faces[0].age <= 3){
                            desc += "男婴";                                
                        }else if(faces[0].age >= 4 && faces[0].age <= 8){
                            desc += "小男孩";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "男孩";
                        }else if(faces[0].age >= 13 && faces[0].age <= 16){
                            desc += "大男生";
                        }else if(faces[0].age >= 17 && faces[0].age <= 40){
                            desc += "青年男性";
                        }else if(faces[0].age >= 41 && faces[0].age <= 60){
                            desc += "中年男士";
                        }else if(faces[0].age >= 61 && faces[0].age <= 80){
                            desc += "老年男士";
                        }else if(faces[0].age >= 9 && faces[0].age <= 12){
                            desc += "老奶奶";
                        }

                        if(faces[0].beauty > 80){
                            desc += "，男模特";
                        }else if(faces[0].beauty > 70){
                            desc += "，大帅哥";
                        }else if(faces[0].beauty > 50){
                            desc += "，帅哥";
                        }
                }

                desc += `，${faces[0].age}岁的外貌`;
                
                if(faces[0].hat == 1){
                    desc += "，戴帽子";
                }

                if(faces[0].glass == 1){
                    desc += "，戴眼镜";
                }
                if(faces[0].glass == 2){
                    desc += "，戴墨镜";
                }

                if(faces[0].pose.yaw > 20 || faces[0].pose.yaw < -20 ||
                   faces[0].pose.pitch > 20 || faces[0].pose.pitch < -20 ||
                   faces[0].pose.roll > 20 || faces[0].pose.roll < -20){

                    alert("建议您选择一张人物的正脸照片作为参考，这样系统才能更好了解人物相貌特征");
                }

                setUserDesc(`${desc}`);                
            }            
        }

        setTimeout(() => {
            setUserRecognizing(false);
        }, 1300);        
    }
    
    useEffect( () => {
        if(faceImage && status == "authenticated"){
            setUserDesc("");                    
            recognizeFace(faceImage);
        }        
    }, [faceImage, status]);     

    function needFaceswap():boolean{
        return room != "flux-pulid"; 
    }

    function supportRef(room:string):boolean{
        return supportRefImg(room) && room != "flux-pulid" && room != "minimax-image-01" && room != "flux-kontext-pro";
    }
    
    let num = 1;
    

    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} imageURL={faceImage}/>
                
                <div className="page-container">
                    <div className="page-tab-image-create">

                        <FormLabel number={`${num++}`} label="选择人像摄影工作流"/>
                        <DropDown  theme={room}
                            setTheme={(newRoom) => setRoom(newRoom)}
                            themes={cameras}
                            names={cameraNames}
                            />
                        
                        <FormLabel number={`${num++}`} label="用户清晰形象照" onCancel={() => setFaceImage("") }/>
                        <InputImage src={faceImage} />
                        <ComboSelector  selectorType="USER" onSelect = {(newFile) => setFaceImage(newFile)} />  
                        {userRecognizing && (
                        <FormLabel label={"用户形象识别中......"}/>
                        )}
                        {!userRecognizing && userDesc && (
                        <FormLabel label={"用户形象"} hint="您可以修改智能识别出的人物形象，让AI更准确的生成照片"/>
                        )}
                        {userDesc && (
                        <PromptArea
                            hotWords="USER_DESC"
                            hasAdvanceButton={false}
                            userPrompt={userDesc}
                            readOnly={userRecognizing}
                            onUserPromptChange={(up) => setUserDesc(up) }
                            />     
                        )}
    
                        { supportRef(room) && (
                        <div className="space-y-3 w-full">
                            <FormLabel number={`${num++}`} label="参考照片（可选）" onCancel={() => setRefImage("") }/>
                            <InputImage src={refImage}/>
                            <ComboSelector onSelect = {(newFile) => setRefImage(newFile)} />    
                        </div>
                        )}
                        
                        <FormLabel number={`${num++}`} label="照片画面比例"/>
                        <DrawRatioSelector onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    

                        <div className="w-full flex flex-row space-x-3 ">
                            <FormLabel number={`${num++}`} label="照片画面要求"/>
                            <PromptSelector 
                                onSelect = {(newFile) => {
                                    setPrompt(newFile.formular);
                                    if(room != newFile.func){
                                        const newFuncName = roomNames.get(newFile.func);
                                        if(newFuncName){
                                            //setRoom(newFile.func as roomType); // 模型改为提示词的默认模型
                                            //alert(`提示：相机模型换成创意的最佳搭配：${newFuncName}！`);
                                        }
                                    }
                            }} />    
                            {status == "authenticated" && (
                            <PromptAssistant userPrompt={`${userDesc}. ${prompt}`} user={session?.user}
                                onUserPromptChange={(np)=>{
                                    // setPrompt(np);
                                }}
                                onOK={(newPrompt)=>{
                                    setUserDesc("");
                                    setPrompt(newPrompt);
                                }}
                                />     
                            )}
                        </div>
                  
                        <div className="space-y-4 w-full mb-5 mt-0">
                            <div className="relative inline-block w-full ">
                                <PromptArea
                                    userPrompt={prompt}                                    
                                    onSysPromptChange={(sp) => setSysPrompts(sp) }
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    hotWords="PHOTO_DESC"
                                    />
                            </div>   
                        </div> 

                        <StartButton config={config} title="开始拍摄" model={room} showPrice={true} loading={loading}
                            onStart={async () => {
                                await generatePhoto();
                            }}
                            />
                    
                    </div>
                     <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"superCamera"}} />
                </div>
            </main>
        </TopFrame>
    );
};


export async function getServerSideProps(ctx: any) {
    let defaultPrompt = ctx.query.prompt as string;    
    let defaultFunc = ctx.query.func as string;
    let promptApp = ctx.query.promptApp as string;    
    if(promptApp){
        const p = await prisma.prompt.findUnique({
            where: {
                id: promptApp
            },
            select: {
                formular: true,
                func: true
            }
        });
        if(p){
            defaultPrompt = p.formular;
            defaultFunc = p.func;            
        }
    }

    monitor.logUserRequest(ctx);    
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            defaultPrompt,
            defaultFunc,
            config
        },
    };
}   

                            
                            {/* needFaceswap() && (
                            <div className="space-y-4 w-full  mb-5">
                                <FormLabel number={`${num++}`} label="形象模仿方式"/>
                                <DropDown
                                    theme={swapMode}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setSwapMode(newRoom)}
                                    themes={swapModes}
                                    names={swapModeNames}
                                    />                               
                            </div>
                            ) */}
