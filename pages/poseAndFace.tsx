import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room } from "@prisma/client";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import PromptSelector from "../components/PromptSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";
import InputImage from "../components/InputImage";
import ComboSelector from "../components/ComboSelector";
import PoseSelector from "../components/PoseSelector";

import { callAPI, callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";



const checkpoints: string[] = [
   // "stable-diffusion-xl-base-1.0",
   // "juggernaut-xl-v8",
   // "afrodite-xl-v2", // 一般
    "albedobase-xl-20", // OK
   // "albedobase-xl-v13", // OK
   // "animagine-xl-30", // 很差的动画
   // "anime-art-diffusion-xl",
   // "anime-illust-diffusion-xl",
   // "dreamshaper-xl", // 一般
   // "dynavision-xl-v0610", // 乱
    "guofeng4-xl", // 国风
   // "nightvision-xl-0791",
    "omnigen-xl",
 //   "pony-diffusion-v6-xl", // 动画效果
 //   "protovision-xl-high-fidel",
 //   "RealVisXL_V3.0_Turbo", // 容易NSFW
 //   "RealVisXL_V4.0_Lightning" // 效果不好
];

const checkpointNames = new Map();
checkpointNames.set("albedobase-xl-20", "通用相机");        
checkpointNames.set("guofeng4-xl", "中国风拍照");        
checkpointNames.set("omnigen-xl", "高仿真相机");        
checkpointNames.set("RealVisXL_V4.0_Lightning", "快速仿真相机");        


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

export default function poseAndFace({ image, config, simRoomBody }: { image: Room, config:any, simRoomBody:any }) {
    const router = useRouter();  
    let defaultPrompt = router.query.prompt as string; 
    let title = "超能肖像模拟相机";
   
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [poseUrl, setPoseUrl] = useState(simRoomBody?.params?.pose_image || image?.outputImage || "");
    const [faceUrl, setFaceUrl] = useState((router.query.imageURL || simRoomBody?.params?.image || "") as string);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [sysPrompts, setSysPrompts] = useState<string>("");  
    const [checkpoint, setCheckpoint] = useState<string>(simRoomBody?.params?.sdxl_weights || "albedobase-xl-20");
    const [drawRatio, setDrawRatio] = useState<string>("916");
    const [poseControl, setPoseControl] = useState<number>((simRoomBody?.params?.pose_strength || 1) * 10);
    const [depthControl, setDepthControl] = useState<number>((simRoomBody?.params?.depth_strength || 0) * 10);
    const [cannyControl, setCannyControl] = useState<number>((simRoomBody?.params?.canny_strength || 0) * 10);
    const [filter, setFilter] = useState<any>();
   
    const [prompt, setPrompt] = useState(simRoomBody?.params?.prompt || defaultPrompt || "");

    let tizi = 10; // router.query.price ? router.query.price : 2;
   
    async function generate() {
        
        if(!faceUrl){
            alert("请上传一张包含你清晰面孔的照片");
            return;                                                           
        }      

        // pose & Face control generation
        let params:any = {
            image: faceUrl,             
            prompt: "a portrait of a [MODEL] , " + prompt + sysPrompts,
            width: drawRatio=="916" ? 576 : 1024,
            height: drawRatio=="169" ? 576 : 1024,            
            sdxl_weights: checkpoint,
            enable_lcm: true,
            lcm_num_inference_steps: 10,
            output_format: "jpg",
            ip_adapter_scale: 0.8,
            controlnet_conditioning_scale: 0.8,
           
            output_quality: 100,

            enable_pose_controlnet: poseControl>0,
            pose_strength: poseControl * 0.1,
            enable_depth_controlnet: depthControl>0,
            depth_strength: depthControl * 0.1,
            enable_canny_controlnet: cannyControl>0,
            canny_strength: cannyControl * 0.1
        };
        if(poseUrl){params.pose_image = poseUrl}

         const res = await callAPI2(
             "/api/workflowAgent2", 
             { 
                 cmd: "poseAndFace", 
                 params: params
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

    let num = 1;
 
        return (
           <TopFrame config={config}>
                <main>
                   <ToolBar config={config} imageURL={faceUrl}/>
                   
                   <div className="page-container">
                      <div className="page-tab-image-create">                            
                            <FormLabel number={`${num++}`} label="人物脸部细节照片" onCancel={() => setFaceUrl("")} hint="为了达到更好效果，脸部照片的面部请选用尽量清晰的正脸照片。" />
                            <InputImage src={faceUrl}/>
                            <ComboSelector  selectorType="USER"
                                onSelect = {(newFile) => setFaceUrl(newFile)}  
                                onRecognizedFaces = {(faces) => {
                                    if(faces && faces.length>1){
                                        alert("检测到上传的图片多于一张人脸，这将不能正确执行拍照，请重新上传");
                                    }else{
                                        setFilter(faces[0]);
                                    }
                                }}                                   
                                />                           
                            
                            <FormLabel number={`${num++}`} label="选择参考照片（可选）" onCancel={() => setPoseUrl("")} hint="姿势照片请使用单人的照片，人物在画面中比例不小于50%"/>                                                              
                            <InputImage  alt="图片素材" src={poseUrl} />
                            <PoseSelector  filter={filter} onSelect = {(newFile) => setPoseUrl(newFile)} />                     

                           { poseUrl && (
                           <>
                               <FormLabel number={`${num++}`} label={`模仿参考照的姿态：${poseControl}`} />                                                              
                               <input type="range" value={poseControl} min="0" max="10" step="1" className="slider-dark-green w-full mt-4"
                                   onChange={(e) => setPoseControl(parseInt(e.target.value))}
                                   />                                      
                               <FormLabel number={`${num++}`} label={`模仿参考照的构图：${depthControl}`} />                                                              
                               <input type="range" value={depthControl} min="0" max="10" step="1" className="slider-dark-green w-full mt-4"
                                  onChange={(e) => setDepthControl(parseInt(e.target.value))}
                                  />                                      
   
                               <FormLabel number={`${num++}`} label={`模仿参考照的细节：${cannyControl}`} />                                                              
                               <input type="range" value={cannyControl} min="0" max="10" step="1" className="slider-dark-green w-full mt-4"
                                  onChange={(e) => setCannyControl(parseInt(e.target.value))}
                                  />                                        
                           </>
                           )}
                           
                            <FormLabel number={`${num++}`} label="选择相机大模型"/>                                                              
                            <DropDown
                              theme={checkpoint}
                              // @ts-ignore
                              setTheme={(newTheme) => setCheckpoint(newTheme)}
                              themes={checkpoints}
                              names={checkpointNames}
                            />
                           {/*
                            <FormLabel number={`${num++}`} label="画面的比例"/>                                                              
                            <DropDown
                              theme={drawRatio}
                              // @ts-ignore
                              setTheme={(newTheme) => setDrawRatio(newTheme)}
                              themes={drawRatios}
                              names={drawRatioNames}
                            />
                              */}  
                            <div className="w-full flex flex-row space-x-3 ">
                               <FormLabel number={`${num++}`} label="输入你的提示词"/>                                                              
                                <PromptSelector className={"button-main text-sm px-2 py-1 mt-3"}
                                   onSelect = {(newFile) => setPrompt(newFile.formular)} 
                                   />                                   
                            </div>
                            <PromptArea
                                hotWords="PORTRAIT_ALL"
                                userPrompt={prompt}
                                onSysPromptChange={(sp) => setSysPrompts(sp) }
                                onUserPromptChange={(up) => setPrompt(up) }
                                />                                
                            

                             <StartButton config={config} title="开始拍摄" showPrice={true} loading={loading}
                                 onStart={async () => {
                                     setRestoredImage(null);
                                     setRestoredLoaded(false);
                                     setError(null);                      
                                     generate();
                                 }}
                                 />
                        
                        </div>
              
                        <ResultView config={config} loading={loading} error={error} restoredImage={restoredImage} restoredId={restoredId} demoRooms={{func:"poseAndFace"}} />

                    </div>
                </main>
            </TopFrame>
        );

};

    
      
export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let image = null;
    
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    monitor.logUserRequest(ctx, session);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            image,
            config
        },
    };
  
}            
