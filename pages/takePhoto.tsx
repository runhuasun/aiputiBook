import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import TextareaAutosize from "react-textarea-autosize";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import PromptSelector from "../components/PromptSelector";
import ModelSelector from "../components/ModelSelector";
import DropDown from "../components/DropDown";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import StartButton from "../components/StartButton";
import AutoSizeImage from "../components/AutoSizeImage";
import TaskPannel from "../components/TaskPannel";
import ResultButtons from "../components/ResultButtons";
import MessageZone from "../components/MessageZone";
import PromptAssistant from "../components/PromptAssistant";

import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config, system } from "../utils/config";
import { callAPI, callAPI2 } from "../utils/apiUtils";
import { getImageSize } from "../utils/fileUtils";
import { roomType, rooms, themeType, themes, themeNames, roomNames  } from "../utils/loraTypes";
import * as ru from "../utils/restUtils";


export async function getServerSideProps(ctx: any) {
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    
    // 从数据库里找到对应的模型
    const defModelCode = ctx?.query?.model || simRoomBody?.params?.modelurl;
    let defModel = defModelCode ? await prisma.model.findUnique({
        where: {
            code: defModelCode,
        },
        include: {
            user: true,
        },
    }) :  undefined; 

    // 缺省脸部照片
    let defFaceImage = ctx?.query?.faceId ? await prisma.room.findUnique({
        where: {
            id: ctx.query.faceId
        },
        select: {
            outputImage: true
        }
    }) : undefined;

    // 缺省姿态照片
    let defPoseImage = ctx?.query?.poseId ? await prisma.room.findUnique({
        where: {
            id: ctx.query.poseId
        },
        select: {
            outputImage: true
        }
    }) : undefined;

    // 缺省背景照片
    let defBackImage = ctx?.query?.backId ? await prisma.room.findUnique({
        where: {
            id: ctx.query.backId
        },
        select: {
            outputImage: true
        }
    }) : undefined;
    
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody,            
            defFaceImage,
            defPoseImage,
            defBackImage,
            defModel,
            config
        },
    }
}  

const inferences = [
    "stylePortrait",
    "normalPortrait",
    "performancePortrait",
    "beatifulPortrait",
  //  "omniedgeio / deepfashionsdxl",
  //  "zylim0702 / sdxl-lora-customize-model",
  // "fofr / sdxl-multi-controlnet-lora",    
  //  "lucataco / realvisxl2-lora-inference",
  //  "fofr / realvisxl-v3-multi-controlnet-lora",
   // "alexgenovese / sdxl-lora",
   // "batouresearch / sdxl-controlnet-lora",
   // "lucataco / ssd-lora-inference",
   // "batouresearch / open-dalle-1.1-lora"     
];

const inferenceNames = new Map([
    ["stylePortrait", "超能高速模拟相机"],
    ["normalPortrait", "超能标准写真套系相机"],
    ["performancePortrait", "超能高表现AI相机"],  
    ["beatifulPortrait",  "超能高美化AI相机"],

/*    
    ["omniedgeio / deepfashionsdxl", "高清AI相机（慢）"],
    ["zylim0702 / sdxl-lora-customize-model", "标准AI相机"],
  
    ["fofr / sdxl-multi-controlnet-lora", "超能高表现AI相机"],  
    ["fofr / realvisxl-v3-multi-controlnet-lora", "超能高美化AI相机"],
  
    ["lucataco / realvisxl2-lora-inference", "全真世界2.0 AI相机"],
    ["alexgenovese / sdxl-lora", "全真世界4.0 AI相机"],
    ["batouresearch / sdxl-controlnet-lora", "带姿态控制的AI相机"],
    ["lucataco / ssd-lora-inference", "快速AI相机"],
    ["batouresearch / open-dalle-1.1-lora", "开源AI相机"]
*/    
]);



export default function takePhoto({ simRoomBody, defFaceImage, defPoseImage, defBackImage, defModel, config }:
                                  { simRoomBody:any, defFaceImage:any, defPoseImage:any, defBackImage:any, defModel:any, config:any}) {

    
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [loading, setLoading] = useState<boolean>(false);

    const [userRecognizing, setUserRecognizing] = useState<boolean>(false);    
     
    const [lora, setLora] = useState<any>(defModel);
    const [filter, setFilter] = useState<any>();
    
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<themeType>(defModel ? (defModel.theme as themeType) : "FACE");
    const [room, setRoom] = useState<roomType>("realistic");

    const [userImage, setUserImage] = useState<string>((defFaceImage?.outputImage || router.query.userImage || router.query.imageURL || simRoomBody?.params?.faceImage || "") as string);
    const [refImage, setRefImage] = useState<string>((defPoseImage?.outputImage || router.query.refImage || simRoomBody?.params?.imageUrl || "") as string);
    const [bgImage, setBGImage] = useState<string>((defBackImage?.outputImage || router.query.bgImage || simRoomBody?.params?.bgImage || "")  as string);
    const [userImageAsRef, setUserImageAsRef] = useState<boolean>(false);

    const [inference, setInference] = useState<string>( simRoomBody?.params?.inference || "beatifulPortrait" );
    const [showInference, setShowInference] = useState<boolean>( true );    
    
    const title = router.query?.title as string || "超能写真相机";
    let defSeed = router.query.seed as string;  
    let defaultPrompt = router.query.prompt as string;
    const [seed, setSeed] = useState<string>(defSeed || simRoomBody?.params?.seed || "");    
    const [prompt, setPrompt] = useState<string>(defaultPrompt || simRoomBody?.params?.inputText || "");
    const [sysPrompts, setSysPrompts] = useState("");
    const [userDesc, setUserDesc] = useState<string>("");
    const [loraPrompt, setLoraPrompt] = useState<string>("");
    
    const [blur, setBlur] = useState<number>(simRoomBody?.params?.blur || 0);
    

    // 相机类型
    const cameraType = (router.query.cameraType as string) || "PRO"; // PRO, SIMPLE

    const showControlStrength:boolean = router.query.showControlStrength as string == "TRUE";

    // 画面比例
    let defaultDrawRatio = router.query.drawRatio as string;
    const [drawRatio, setDrawRatio] = useState<string>(defaultDrawRatio || simRoomBody?.params?.drawRatio || "916");

    // 画面控制网络
    const [controlNet, setControlNet] = useState<string>("soft_edge_hed"); // "depth_midas");
    const [loraScale, setLoraScale] = useState<number>((simRoomBody?.params?.loraScale || 0.6) * 100); // 控制力度大于50就开始应用LORA的脸型  
    useEffect( () => {
        switch(inference){
            case "stylePortrait":
            case "normalPortrait":
                setLoraScale(90);
                break;
            case "performancePortrait":
            case "beatifulPortrait":
                setLoraScale(60);
                break;
        }        
    }, [inference]); 
    
    const [controlStrength, setControlStrength] = useState<number>((simRoomBody?.params?.controlStrength || 0.8) * 100);
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


    function useRefImage():boolean{
        return (inference != "lucataco / realvisxl2-lora-inference") && (inference != "zylim0702 / sdxl-lora-customize-model");
    }
    function useControlNet():boolean{
        return (
            inference == "fofr / realvisxl-v3-multi-controlnet-lora" || 
            inference == "fofr / sdxl-multi-controlnet-lora" ||
            inference == "normalPortrait" ||
            inference == "performancePortrait" || 
            inference == "beatifulPortrait"
        );
    }
  
    function isPositiveInteger(str: string): boolean {
        // 使用正则表达式匹配字符串是否为正整数，^表示开头，\d+表示匹配一个或多个数字，$表示结尾
        const regExp = /^\d+$/;
        return regExp.test(str);
    }
   
    async function generatePhoto() {    
        if(!window){
            return alert("当前浏览器不支持！请使用Chrome, Edge, 360, Safari等主流浏览器");
        }
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(lora){
                params.set("model", lora?.code);
            }
            if(prompt){
                params.set("prompt", prompt);
            }
            if(cameraType){
                params.set("cameraType", cameraType);
            }
            if(drawRatio){
                params.set("drawRatio", drawRatio);
            }
            if(userImage){
                params.set("userImage", userImage);
            }
            if(refImage){
                params.set("refImage", refImage);
            }
            if(bgImage){
                params.set("bgImage", bgImage);
            }            
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
            return;
        }
        
        if(!userImage){
            alert("拍摄AI照片需要上传一张用户形象照片！");
            return;
        }
        
        if(!lora){
            alert("拍摄AI照片需要指定一个写真套系！");
            return;
        }
        if(inference == "batouresearch / sdxl-controlnet-lora" && !refImage){
            alert("使用带姿态控制的AI相机要求必须输入一张参考照片");
            return;
        }         

        const refImgSize = refImage ? await getImageSize(refImage) : undefined;
        const bgImgSize = bgImage ? await getImageSize(bgImage) : undefined;
        
        // alert("refImgSize:" + JSON.stringify(refImgSize));
        // alert("bgImgSize:" + JSON.stringify(bgImgSize));
        if(refImgSize){
            if(bgImgSize){
                if(refImgSize.width > bgImgSize.width){
                    return alert(`第3项拍照姿势照片的宽度${refImgSize.width}必须小于等于第4项背景图片的宽度${bgImgSize.width}`);
                }
                if(refImgSize.height > bgImgSize.height){
                    return alert(`第3项拍照姿势照片的高度${refImgSize.height}必须小于等于第4项背景图片的高度${bgImgSize.height}`);
                }
            }
            
            /*
            let refRatio = refImgSize.width / refImgSize.height;
            // alert("refRatio:" + JSON.stringify(refRatio));
            let outputRatio = 1;
            switch(drawRatio){
                case "916": outputRatio = 0.5625; break;
                case "169": outputRatio = 1.7778; break;
                case "114": outputRatio = 0.7143; break;
            }
            // alert("outputRatio:" + outputRatio);
            if(Math.abs(refRatio - outputRatio) > 0.01){
                return alert("第3项拍照姿势照片的宽/高比例必须和第7项生成照片比例基本一致，请修改！");
            }
            */
        }
        
        let inputText = `${prompt}, ${sysPrompts}`;
        let realText = `${userDesc}, ${loraPrompt}, ${prompt}, ${sysPrompts}`;
        if(sysPrompts && sysPrompts.trim() == ""){
            realText += ", detailed faces,  highres, RAW photo 8k uhd, modelshot, elegant, realistic, movie, intricate details,";
        }
        
        setError(null);
        setRestoredId(null);      
        setRestoredImage(null);      
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "takePhoto", 
                priceModel: {modelCode:lora?.code, inference},
                params: {
                    inference, 
                    controlNet,
                    loraScale: loraScale / 100,
                    controlStrength: controlStrength / 100,
                    faceImage: userImage, 
                    imageUrl: useRefImage() ? refImage : "", 
                    bgImage: bgImage,
                    blur,
                    theme, room, realText:realText, inputText: inputText, func: "lora", 
                    drawRatio, modelurl: lora?.code, modelTheme:lora.theme, access: lora.access, seed:seed
                }
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
                mutate();
                setRestoredId(res.result.genRoomId); 
                setRestoredImage(res.result.generated);            
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

                if(faces[0].pose.yaw > 20 || faces[0].pose.yaw < -20 ||
                   faces[0].pose.pitch > 20 || faces[0].pose.pitch < -20 ||
                   faces[0].pose.roll > 20 || faces[0].pose.roll < -20){

                    alert("建议您选择一张人物的正脸照片作为参考，这样系统才能更好了解人物相貌特征");
                }

                setUserDesc(desc);                
            }            
        }

        setTimeout(() => {
            setUserRecognizing(false);
        }, 1300);        
    }

    useEffect( () => {
        if(lora && lora.params){
            setLoraPrompt(`${JSON.parse(lora!.params!)?.aPrompt}`);        
        }        
        if(lora && lora.trainSrv == "fal-ai/flux-lora-general-training"){
            setInference("normalPortrait");
            setShowInference(false);
        }else{
            setShowInference(true);
        }
    }, [lora]); 

    
    useEffect( () => {
        if(userImage && (status == "authenticated")){
            setUserDesc("");                    
            recognizeFace(userImage);
        }        
    }, [userImage, status]); 
    
    

    async function addRoomToAlbum(roomId:string, album:any){
        if(roomId && album.id){
            const res = await callAPI("/api/albumManager", { cmd:"ADDROOM", id:album.id, roomId });
            if (res.status !== 200) {
                alert(res.result);
            } else {
                alert(`图片已经被加到相册《${album.name}》`);
                // window.open("/showAlbum?albumId=" + albumId, "_blank");
            }
        }
    }    

    let formOrder = 1;
    
        return (
            <TopFrame config={config}>

                <main>
                    <ToolBar config={config} imageURL={userImage}/>
                   
                    <div id="create" className="flex justify-between items-center w-full flex-col mt-4  mb-40">
                        
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:justify-top sm:px-2 sm:mb-5">

                          
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="上传用户形象照片" onCancel={() => setUserImage("")}/>
                                <InputImage alt="图片素材" src={userImage}/>
                                <ComboSelector selectorType="USER"
                                    onSelect = {(newFile) => { 
                                        setUserImage(newFile);
                                        if(userImageAsRef){
                                            setRefImage(newFile);
                                        }
                                    }}                                    
                                    />  
                                {cameraType == "PRO" && (
                                <>
                                    <FormLabel label={userRecognizing ? "用户形象识别中......" : "描述用户形象（可选）"}/>
                                    <PromptArea
                                        hotWords="USER_DESC"
                                        hasAdvanceButton={false}
                                        userPrompt={userDesc}
                                        readOnly={userRecognizing}
                                        onUserPromptChange={(up) => setUserDesc(up) }
                                        />
                                </>       
                                )}
                            </div>

                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="挑选写真套系" onCancel={() => setLora(undefined)}/>
                                <InputImage alt="图片素材" src={lora?.coverImg}/>
                                <div className="w-full flex flex-col items-center">
                                    <ModelSelector onSelect = {(newFile) => {
                                        setLora(newFile);
                                    }} title="选择写真套系" modelType="LORA" channel="PORTRAIT" filter={filter}  />    
                                </div>       
                                {lora && cameraType == "PRO" && (
                                <div className="space-y-4 w-full mb-5">
                                    <FormLabel label={`写真套系：${lora.name}`}/>
                                    <TextareaAutosize id="iptLoraPrompt" 
                                        minRows={4} maxRows={10}
                                        className="input-main rounded-lg w-full" 
                                        value={loraPrompt}
                                        onChange={(e) => {
                                            setLoraPrompt(e.target.value);
                                        }}                                        
                                        />     
                                    <FormLabel label={`套系模仿度：${loraScale}%`}/>
                                    <input type="range" value={loraScale} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                                        onChange={(e) => setLoraScale(parseInt(e.target.value))}
                                        />                                    
                                </div>                                    
                                )}

                            </div>
                            
                            <div className="page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="指定参考姿势（可选）" onCancel={() => setRefImage("")}/>
                                <InputImage alt="图片素材" src={refImage}/>
                                <ComboSelector selectorType="MODEL_POSE" selectorCode={lora?.code}
                                    onSelect = {(newFile) => {
                                        setRefImage(newFile);
                                    }}
                                />    
                                <FormLabel label="同步使用用户形象照片" isChecker={true} initValue={userImageAsRef} onValueChange={(value) => {
                                    setUserImageAsRef(value);
                                    if(value){
                                        setRefImage(userImage);
                                    }
                                } }/>
                                
                                {//    (cameraType == "PRO") && (                                
                                (showControlStrength || (refImage && useControlNet() && (cameraType == "PRO"))) && (

                                <div className="space-y-4 w-full mb-5">
                                    <FormLabel label="参考姿势的方法"/>
                                    <DropDown
                                        theme={controlNet}
                                        // @ts-ignore
                                        setTheme={(newRoom) => {
                                            setControlNet(newRoom);
                                        }}
                                        themes={controlNets}
                                        names={controlNetNames}
                                        />
                                    <FormLabel label={`姿态控制力度：${controlStrength}%`}/>
                                    <input type="range" value={controlStrength} min="0" max="100" step="1" className="slider-dark-green w-full mt-4"                            
                                        onChange={(e) => setControlStrength(parseInt(e.target.value))}
                                        />
                                </div>
                                )}                                
                            </div>

                            {/*
                            <div className="hidden page-tab space-y-4 w-full sm:w-1/3 pb-4 sm:pb-10 px-4 rounded-xl">
                                <FormLabel number={(formOrder++).toString()} label="选择照片背景（可选）" onCancel={() => setBGImage("")}/>
                                <div className="w-full flex flex-col items-center">
                                    {bgImage && (
                                    <Image alt="图片素材" src={getThumbnail(bgImage)} className="rounded-2xl relative sm:mt-0 mt-2 w-full sm:w-auto sm:h-96 " />
                                    )}
                                </div>
                                <BGSelector title="系统推荐背景" 
                                    onSelect = {(newFile) => {
                                        setBGImage(newFile);
                                    }}
                                />    
                                {bgImage && cameraType == "PRO" && (
                                <div className="mt-4 w-full">
                                    <FormLabel label={`背景景深虚化：${blur}%`}/>
                                    <input type="range" value={blur} min="0" max="50" step="2" className="slider-dark-green w-full mt-4"                            
                                        onChange={(e) => setBlur(parseInt(e.target.value))}
                                        />
                                </div>                    
                                )}                                
                            </div>
                            */}
                        </div>

                        { (cameraType == "PRO") && showInference && (
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={(formOrder++).toString()} label="套系写真工作流" />
                            <DropDown
                                theme={inference}
                                // @ts-ignore
                                setTheme={(newRoom) => setInference(newRoom)}
                                themes={inferences}
                                names={inferenceNames}
                                />
                        </div>                    
                        )}

                        { !refImage && (
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel number={(formOrder++).toString()} label="照片比例"/>
                            <DrawRatioSelector onSelect = { (newRatio) => ( setDrawRatio(newRatio) )} />    
                        </div>
                        )}
                       
                        <div className="w-full max-w-lg space-x-3 flex flex-row">
                            <FormLabel number={(formOrder++).toString()} label="对照片的其它要求"/>
                            <PromptSelector onSelect = {(newFile) => setPrompt(newFile.formular)} />
                            <PromptAssistant userPrompt={`${userDesc} . ${loraPrompt} . ${prompt}`} user={session?.user}
                                onUserPromptChange={(np)=>{
                                    // setPrompt(np);
                                }}
                                onOK={(newPrompt)=>{
                                    setUserDesc("");
                                    setLoraPrompt("");                                    
                                    setPrompt(newPrompt);
                                }}
                                />                            
                        </div>                            

                        <div className="space-y-4 w-full mb-5 mt-0 pt-4">
                            <div className="relative inline-block w-full sm:w-2/3 mt-0">
                                <PromptArea hotWords="PORTRAIT" userPrompt={prompt}
                                    onSysPromptChange={(sp) => setSysPrompts(sp) }
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />
                            </div>
                        </div>
                        
                        {status === "authenticated" && data && (
                        <PriceTag config={config} model={{modelCode:lora?.code, inference}} />
                        )}

                        {loading ?  (
                        <LoadingButton/>                    
                        ) : (                    
                        <StartButton config={config} title="开始拍摄照片"
                            onStart={() => {
                                generatePhoto();
                            }}
                            />
                        )}
                        
                        {error && (
                        <MessageZone message={error} messageType="ERROR"/>
                        )}
                        
                        {restoredImage && restoredId && (
                        <div className="w-full flex flex-col items-center space-y-10 pt-10 mt-5 sm:mt-0">
                            <AutoSizeImage
                                alt="照片"
                                src={restoredImage}
                                onLoadingComplete={() => setRestoredLoaded(true)}
                                onClick={() => window.open(ru.getImageRest(restoredId), "_blank")}
                                />
                            <div className="flex flex-row items-center justify-center space-x-4">
                                <TaskPannel config={config} user={session?.user} roomId={restoredId}/>                                        
                            </div>                            
                            <ResultButtons mediaId={restoredId} mediaURL={restoredImage}/>
                        </div>
                        )}
                    
                    </div>
                </main>
            </TopFrame>
        );

};

// export default Home;
/*        
        if(m){
            switch(m.baseModel){
                case "zylim0702 / sdxl-lora-customize-training":
                    defaultInference = "zylim0702 / sdxl-lora-customize-model";
                    break;
                case "lucataco / realvisxl2-lora-training":
                    defaultInference = "lucataco / realvisxl2-lora-inference";
                    break;
                case "alexgenovese / train-sdxl-lora":
                    defaultInference = "alexgenovese / sdxl-lora";
                    break;
                case "lucataco / ssd-lora-training":
                    defaultInference = "lucataco / ssd-lora-inference";
                    break;
                default:
                    defaultInference = "fofr / realvisxl-v3-multi-controlnet-lora"
            }
       }
*/   
