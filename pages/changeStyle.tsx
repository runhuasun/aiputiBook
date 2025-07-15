import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";

import { Room } from "@prisma/client";
import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import ModelSelector from "../components/ModelSelector";
import StartButton from "../components/StartButton";


export async function getServerSideProps(ctx: any) {
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    if(simRoomBody?.lora){
        simRoomBody.params.loraModel = await prisma.model.findUnique({
            where: { code: simRoomBody.lora }
        });
    }
    
    let imgId = ctx?.query?.roomId;
    let image = null;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }        
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody,          
            image,
            config,
        },
    };
}  



const changeModeNames = new Map([
    ["LORA","模仿套系风格"],
    ["FREE","模仿照片风格"],
    ["FREE2","模仿照片风格2"]
]);
const changeModes = Array.from(changeModeNames.keys());

export default function simStyle({simRoomBody, image, config }: {simRoomBody:any, image:Room, config: any }) {
    const title = "更换照片风格";
    let num = 1;
    const router = useRouter();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [originalPhoto, setOriginalPhoto] = useState<string|null>((router.query.imageURL || image?.outputImage || simRoomBody?.params?.imageURL) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output || null);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession(); 
   
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [changeMode, setChangeMode] = useState<string>(simRoomBody?.params?.changeMode || "FREE");
    const [styleImage, setStyleImage] = useState<string>(simRoomBody?.params?.styleImage);
    const [lora, setLora] = useState<any>(simRoomBody?.params?.loraModel);
    const [filter, setFilter] = useState<any>();
    const [userRecognizing, setUserRecognizing] = useState<boolean>(false);    

    const [prompt, setPrompt] = useState<string>("");
   
    // 画面控制网络
    const [controlNet, setControlNet] = useState<string>(simRoomBody?.params?.controlNet || "soft_edge_hed");
    const [loraScale, setLoraScale] = useState<number>((simRoomBody?.params?.loraScale || 0.6 ) * 100); // 控制力度大于50就开始应用LORA的脸型    
    const [controlStrength, setControlStrength] = useState<number>((simRoomBody?.params?.controlStrength || 1) * 100);
    const [styleStrength, setStyleStrength] = useState<number>((simRoomBody?.params?.StyleStrength || 1) * 100);

    useEffect( () => {
        switch(changeMode){
            case "LORA":
                setControlStrength(100);
                break;
            case "FREE":
                setControlStrength(100);
                break;
            case "FREE2":
                setControlStrength(30);
                setStyleStrength(20);
                break;
        }                
    }, [changeMode]); 
    
    const controlNets: string[] = [
        "openpose",
        "edge_canny", 
        "depth_leres", 
        "depth_midas", 

        "soft_edge_pidi", 
        "soft_edge_hed", 
        
        "lineart", 
    ];
    const controlNetNames = new Map([
        ["edge_canny", "人物硬边缘检测模仿"],
        ["soft_edge_pidi", "人物细节边缘低精度模仿"],
        ["soft_edge_hed", "人物细节边缘高精度模仿"],
        ["depth_leres", "画面颜色深浅高精度模仿"],
        ["depth_midas", "画面颜色深浅低精度模仿"],
        ["lineart", "画面线条模仿"],        
        ["openpose", "画面人物姿态模仿"]        
    ]);  

    async function recognizeFace(imageURL:string){
        /*
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
                setFilter(faces[0]);

                // 根据识别的人脸修改用户描述
                let desc = "一位";
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

                setPrompt(desc);
            }            
        }

        setTimeout(() => {
            setUserRecognizing(false);
        }, 1300);  
        */
    }

    useEffect( () => {
        if(originalPhoto){
            recognizeFace(originalPhoto);
        }        
    }, [originalPhoto]); 
    
    
    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一张照片");
        }
        if(changeMode == "LORA" && !lora){
            return alert("请先选择一个写真套系");
        }
        if(changeMode == "FREE" && !styleImage){
            return alert("请先选择一个希望模仿的风格照片");
        }

        let res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd:"changeStyle", 
                preRoomId,
                params:{
                    changeMode,                
                    imageURL: originalPhoto,
                    styleImage,
                    loraCode: lora?.code,
                    loraScale: loraScale / 100,
                    controlNet,
                    controlStrength: controlStrength / 100,
                    styleStrength: styleStrength / 100,
                    prompt : changeMode=="LORA" ? `${prompt}, ${lora?.params ? JSON.parse(lora.params)?.aPrompt : ''}` : `${prompt}`        
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

    }


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
                    
                        <FormLabel number={`${num++}`} label="选择风格模仿方式"/>
                        <DropDown
                            theme={changeMode}
                            // @ts-ignore
                            setTheme={(newRoom) => {
                                setChangeMode(newRoom);
                            }}
                            themes={changeModes}
                            names={changeModeNames}
                        />
                       
                        {(changeMode == "FREE" || changeMode == "FREE2") && (
                        <>
                            <FormLabel number={`${num++}`} label="选择风格照片" onCancel={() => setStyleImage("")}/>
                            <InputImage src={styleImage}/> 
                            <ComboSelector onSelect = { (newFile) => ( setStyleImage(newFile) )} />    
                        </>
                        )}

                        {changeMode == "LORA" && (
                        <>
                            <FormLabel number={`${num++}`} label="挑选写真套系" onCancel={() => setLora(undefined)}/>
                            <InputImage src={lora?.coverImg}/>
                            <div className="w-full flex flex-col items-center">
                                <ModelSelector onSelect = {(newFile) => {
                                setLora(newFile);
                                }} title="选择写真套系" modelType="LORA" channel="PORTRAIT" filter={filter}  />
                            </div> 
                            <FormLabel label={`套系模仿度：${loraScale}%`}/>
                            <input type="range" value={loraScale} min="0" max="100" step="1" className="slider-dark-green w-full mt-4" 
                                onChange={(e) => setLoraScale(parseInt(e.target.value))}
                            />   
                        </>
                        )}

                        {(changeMode == "FREE2") && (
                        <>
                            <FormLabel number={`${num++}`} label={`风格模仿度：${styleStrength}%`}/>
                            <input type="range" value={styleStrength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4" 
                                onChange={(e) => setStyleStrength(parseInt(e.target.value))}
                            />  
                        </>                                
                        )}
                        
                        <FormLabel number={`${num++}`} label={`原图模仿度：${controlStrength}%`}/>
                        <input type="range" value={controlStrength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4" 
                            onChange={(e) => setControlStrength(parseInt(e.target.value))}
                        />                              

                        <div className="space-y-4 w-full flex flex-col">
                            <FormLabel number={`${num++}`} label="描绘画面（可选）" hint="描绘画面会让AI生成的结果更准确。如果不输入，AI会自动识别，但是可能会有误判。"/>                                
                            <div className="relative inline-block w-full">
                                <PromptArea
                                    hotWords="NO_HOTWORDS"
                                    hasAdvanceButton={false}
                                    userPrompt={prompt}
                                    readOnly={false}
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />  
                            </div>                                      
                        </div>
                        
                        <StartButton config={config} title="开始" loading={loading} showPrice={true}
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
