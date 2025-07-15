import Head from "next/head";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room , User} from "@prisma/client";

import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import { getImageSize } from "../utils/fileUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import DropDown from "../components/DropDown";
import ComboSelector from "../components/ComboSelector";
import InputImage from "../components/InputImage";
import PromptArea from "../components/PromptArea";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx?.query?.roomId;
    let image;

    if(roomId){
        image = await prisma.room.findUnique({
            where: {
                id: roomId,
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

const modelNames = new Map([
    ["expression-editor", "参数化调整面部表情"],
    ["flux-kontext-pro", "指令调整和修复面部"],
    ["live-portrait-image", "模仿照片面部表情"],
    ]);
const models = Array.from(modelNames.keys());

export default function changeExpression({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [originalPhoto, setOriginalPhoto] = useState<string | null>();
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [smile, setSmile] = useState<number>(simRoomBody?.params?.smile || 0);
    const [pitch, setPitch] = useState<number>(simRoomBody?.params?.rotate_pitch || 0);
    const [yaw, setYaw] = useState<number>(simRoomBody?.params?.rotate_yaw || 0);
    const [roll, setRoll] = useState<number>(simRoomBody?.params?.rotate_roll || 0);
    const [blink, setBlink] = useState<number>(simRoomBody?.params?.blink || 0);
    const [eyebrow, setEyebrow] = useState<number>(simRoomBody?.params?.eyebrow || 0);
    const [wink, setWink] = useState<number>(simRoomBody?.params?.wink || 0);
    const [pupil_x, setPupil_x] = useState<number>(simRoomBody?.params?.pupil_x || 0);
    const [pupil_y, setPupil_y] = useState<number>(simRoomBody?.params?.pupil_y || 0);
    const [aaa, setAaa] = useState<number>(simRoomBody?.params?.aaa || 0);
    const [eee, setEee] = useState<number>(simRoomBody?.params?.eee || 0);
    const [woo, setWoo] = useState<number>(simRoomBody?.params?.woo || 0);

    const [targetRect, setTargetRect] = useState<any>();
    const [targetFaceCount, setTargetFaceCount] = useState(-1);

    const [prompt, setPrompt] = useState<string>(simRoomBody?.params?.prompt || "修复面部瑕疵");
    
    const title = (router.query.title as string) || "修复调整面部表情";
    const [model, setModel] = useState<string>("expression-editor");
    const [refImage, setRefImage] = useState<string>(simRoomBody?.params?.refImage);
    const [useRect, setUseRect] = useState<boolean>(true);

    
    useEffect(() => {
        const inputImage = (router.query.imageURL || image?.outputImage || simRoomBody?.params?.image) as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setOriginalPhoto(result);
                }
            });
        }
    }, []); 

    useEffect(() => {
        if(model === "flux-kontext-pro"){
            setUseRect(false);
        }else{
            setUseRect(true);
        }
    }, [model]);
    
    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张照片");
        }

        if(targetFaceCount < 0){
            return alert("超能AI正在努力识别照片中的人脸，请稍等候...");
        }

        if(targetFaceCount == 0){
            const OK = await confirm("在将被换脸的原始照片中没有检测到清晰的人物，这有可能是您提供的照片清晰度太差，或者照片中的人物五官不清晰，亦或是头部扭动的幅度过大，AI无法准确识别用户脸部细节。您还要继续执行本次换脸操作吗？");
            if(!OK){
                return;
            }
        }
        
        if(useRect && !(targetRect && targetRect.width>10 && targetRect.height>10)){
            return alert("请选择一张人脸进行操作！");
        }
/*
        let faceRect = targetRect;
        if(!faceRect || !faceRect.x || !faceRect.y){
            if(!faces || faces.length<1){
                return alert("在图片中没有检测到人物面部，或者图片中包含敏感信息，无法进行检测。您也可以鼠标圈选一个人物面部区域。");
            }else{
                if(faces.length>1){
                    return alert ("检测到多个人物，请选择一个人物进行操作");
                }else{
                    faceRect = {x:faces[0].left, y:faces[0].top, width:faces[0].width, height:faces[0].height};
                    setTargetRect(faceRect);
                }
            }
        }
  */          
        setLoading(true);

        try{
            const size = await getImageSize(originalPhoto);
            if(size.width > 2000 || size.height > 2000){
                const ok = await confirm(`图片宽度和高度不能超过2000像素。目前图片的高度为${size.height}像素，宽度为${size.width}像素。去图片裁剪功能把图片缩小，再来使用本功能吧！`);
                if(ok){
                    fu.safeWindowOpen(`/editImage?imageURL=${originalPhoto}`, "_self");
                    return;
                }else{
                    return;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
            setSideBySide(false);                        
            
            const res = await callAPI2(
                "/api/workflowAgent2", 
                {
                    cmd: "changeExpression",
                    preRoomId,
                    model,
                    params: {
                        func: model,
                        prompt: prompt || "修复面部瑕疵",
                        refImage,
                        imageURL: originalPhoto,
                        image: originalPhoto,                    
                        targetRect: useRect ? targetRect : undefined,
                        rotate_pitch: pitch,
                        rotate_yaw: yaw,
                        rotate_roll: roll,
                        smile,
                        blink,
                        eyebrow,
                        wink,
                        pupil_x,
                        pupil_y,
                        aaa,
                        eee,
                        woo
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
    
    let num = 1;
    
    return (
        <TopFrame config={config}>

            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} />
                
                <div className="page-container">
                    
                    <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        selectFace={true}
                        onSelectRect = {(rect) => {
                            setTargetRect(rect);
                        }}
                        onFacesDetected = {(faces:any) => {
                            setTargetFaceCount(faces.length);
                        }}                              
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
                            setRestoredId(null);
                            setError(null); 
                        }}
                    />

                    <div className="page-tab-edit">      

                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="选择表情调整模型"/>
                            <DropDown
                                theme={model}
                                // @ts-ignore
                                setTheme={(newRoom) => {
                                    setModel(newRoom);
                                }}
                                themes={models}
                                names={modelNames}
                                />
                        </div>

                        {model == "flux-kontext-pro" && (
                        <FormLabel number={`${num++}`} isChecker={true} label="只调整选中人物的表情（单人照勿选）" initValue={useRect} hint="画面中有多个人物时，才需要选择。慎重试用，有可能影响画面质量。尤其是对于单人大头照，不要选择！"
                            onValueChange={(newVal)=>{
                                setUseRect(!useRect);
                            }}
                            />    
                        )}
                
                        {model == "live-portrait-image" && (
                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="选择参考照片" onCancel={() => setRefImage("")}/>
                            <InputImage alt="图片素材" src={refImage}/> 
                            <ComboSelector 
                                onSelect = {(newFile) => {
                                    setRefImage(newFile);
                                }
                            } />                               
                        </div>
                        )}

                        {model == "flux-kontext-pro" && (
                        <div className="space-y-4 mt-4 w-full">
                            <FormLabel number={`${num++}`} label="需要如何调整面部"/>                                
                            <div className="relative inline-block w-full">
                                <PromptArea
                                    hotWords="FACE_DETAIL"
                                    hasAdvanceButton={false}
                                    userPrompt={prompt}
                                    readOnly={false}
                                    onUserPromptChange={(up) => setPrompt(up) }
                                    />  
                            </div>   
                        </div>
                        )}
                        
                        {model == "expression-editor" && (
                        <div className="w-full felx flex-col space-y-5">
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`微笑程度：${smile}`}/>                                 
                                 <input type="range" value={smile} min="-0.3" max="1.3" step="0.1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setSmile(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`上下摇头角度：${pitch}`}/>                                 
                                 <input type="range" value={pitch} min="-20" max="20" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setPitch(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`左右水平转头角度：${yaw}`}/>                                 
                                 <input type="range" value={yaw} min="-20" max="20" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setYaw(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`左右倾斜头部角度：${roll}`}/>                                 
                                 <input type="range" value={roll} min="-20" max="20" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setRoll(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`眼睛睁开闭合：${blink}`}/>                                 
                                 <input type="range" value={blink} min="-20" max="5" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setBlink(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`眉毛高度：${eyebrow}`}/>                                 
                                 <input type="range" value={eyebrow} min="-10" max="15" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setEyebrow(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`单眼闭合：${wink}`}/>                                 
                                 <input type="range" value={wink} min="0" max="25" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setWink(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`瞳孔水平转动角度：${pupil_x}`}/>                                 
                                 <input type="range" value={pupil_x} min="-15" max="15" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setPupil_x(parseFloat(e.target.value))}
                                     />
                             </div>
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`瞳孔垂直转动角度：${pupil_y}`}/>                                 
                                 <input type="range" value={pupil_y} min="-15" max="15" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setPupil_y(parseFloat(e.target.value))}
                                     />
                             </div>                            
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`嘴唇做出[啊...]的动作：${aaa}`}/>                                 
                                 <input type="range" value={aaa} min="-30" max="120" step="5" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setAaa(parseFloat(e.target.value))}
                                     />
                             </div>   
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`嘴唇做出[咦...]的动作：${eee}`}/>                                 
                                 <input type="range" value={eee} min="-20" max="15" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setEee(parseFloat(e.target.value))}
                                     />
                             </div>   
                             <div className="mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`嘴唇做出[喔...]的动作：${woo}`}/>                                 
                                 <input type="range" value={woo} min="-20" max="15" step="1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setWoo(parseFloat(e.target.value))}
                                     />
                             </div>                               
                        </div>
                        )}
                        
                         <StartButton config={config} title="开始智能修图" showPrice={true} model={model} loading={loading}
                             onStart={() => {
                                 setRestoredImage(null);
                                 setRestoredId(null);
                                 setRestoredLoaded(false);
                                 setError(null);
                                 generatePhoto();
                             }}
                             />

                        <div className="w-full max-w-lg flex flex-col items-start space-y-2 pt-10">
                            <div className="w-full max-w-lg flex flex-row items-center justify-center tracking-wider">
                                <span>还可以让表情变化动起来！</span>
                                <Link href="/portraitVideo" className="underline underline-offset-2">表情视频</Link>
                            </div>                            
                        </div>                                
             
                    </div>
                
                </div>
            </main>
        </TopFrame>
    );
};
