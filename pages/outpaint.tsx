import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { User, Model } from "@prisma/client";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";

import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";



export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);

    let userId = "";
    let user:any;
    // 判断是否是模型的主人
    if (session?.user?.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                actors: true
            }
        });
        if(user){
            userId = user.id;
        }
    }

    // 从数据库里找到对应的模型
    let defModel;
    let modelCode = ctx?.query?.model;
    if(modelCode){
        defModel =  await prisma.model.findUnique({
            where: {
                code: modelCode,
            },
            include: {
                user: true,
            },
        });  
    }

    let defImageURL = ctx?.query?.defImageURL || ctx?.query?.imageURL; 
    let roomId = ctx?.query?.roomId;    
    if(!defImageURL && roomId){
        const room = await prisma.room.findUnique({ 
            where: {
                id: roomId
            },
            select: {
                id: true,
                outputImage: true
            }
        });
        if(room){
            defImageURL = room.outputImage;
        }
    }
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            defImageURL,
            defModel,
            userId,
            config
        },
    }
}  


export default function outpaint({ simRoomBody, defImageURL, defModel, userId, config }: { simRoomBody:any, defImageURL:string, defModel: (Model & { user: User}), userId: string, config:any}) {
    const router = useRouter();
    const title = router.query?.title as string || "照片扩展内容";
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(simRoomBody?.params?.params?.image);
    const [originalSize, setOriginalSize] = useState<any>();

    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
        
    
    const [lora, setLora] = useState<any>(defModel);
    const [error, setError] = useState<string | null>(null);
    
    const [prompt, setPrompt] = useState(router.query?.prompt as string || simRoomBody?.params?.params?.prompt || ""); // 生成一张画面连续完整的照片。画面不要有任何边框。
    const [sysPrompts, setSysPrompts] = useState("");
    
    // 画面比例
    const [drawRatio, setDrawRatio] = useState<string>(router.query?.drawRatio as string || simRoomBody?.params?.params?.outpaint_selections || "Right, Left");
    const [drawRatios, setDrawRatios] = useState<string[]>( [
        "Right, Left",
        "Top, Bottom",
        "Right, Left, Top, Bottom",
    ]);
  
    const drawRatioNames = new Map([
        ["Right, Left", "向左右扩展内容"],
        ["Top, Bottom", "向上下扩展内容"],        
        ["Right, Left, Top, Bottom", "向四周扩展内容"],
    ]);    

    // 扩图模型
    const [model, setModel] = useState<string>(router.query?.model as string || simRoomBody?.model || "byte-outpainting");
    const modelNames = new Map([
        ["byte-outpainting", "通用扩图引擎"],
        ["ideogram-v3-reframe", "Turbo扩图引擎"],
        ["wanx2.1-imageedit", "WanX快速扩图引擎（国风元素）"],
        ["focus", "Focus基础版扩图引擎"],        
//        ["flux-fill-dev", "高级版扩图引擎（约需30-50秒）"],        
        ["flux-fill-pro", "Flux专业版扩图引擎（约需40-60秒）"],
 //       ["seg-beyond", "超能高级扩图引擎（约需30-50秒）"], // 太贵，轻易不要用，1.22元每次
//        ["combo", "加强版扩图引擎（约需80-120秒）"]        
    ]);
    const models = Array.from(modelNames.keys());
    useEffect(() => {
        if(!models.includes(model)){
            setModel("byte-outpainting");
        }
    }, [model]); // 空数组表示只在组件挂载时执行一次
    
    useEffect(() => {
        if(defImageURL){
            fu.aliyunImageRestrictResize(defImageURL).then((result)=>{
                if(result){
                    setOriginalPhoto(result);
                }
            });
        }
    }, []); // 空数组表示只在组件挂载时执行一次

    
    async function changeImage(newImageURL:any){
        setOriginalPhoto(newImageURL);              
    }

   
    async function generatePhoto() {    
        if(status != "authenticated"){
            let currentURL = new URL(window.location.href);
            let params = new URLSearchParams(currentURL.search);
            if(originalPhoto){
                params.set("defImageURL", originalPhoto);
            }
            if(prompt){
                params.set("prompt", prompt);
            }     
            if(drawRatio){
                params.set("drawRatio", drawRatio);
            }              
            currentURL.search = params.toString();
            window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
            return;
        }
        
        if(!originalPhoto){
            alert("需要先上传一张照片！");
            return;
        }

       // if(!prompt){
       //     const OK = await confirm("您没有描绘扩展区域的内容，AI将根据画面内容自己判断，这可能会产生意想不到的结果，是否继续？");
       //     if(!OK){
       //         return;
       //     }
       // }

        let outpaintX = 0;
        let outpaintY = 0;
        let ex = 256;
        let ey = 256;
        const size = await fu.getImageSize(originalPhoto);
        if(size){
            ex = Math.ceil(size.width * 0.5);
            ey = Math.ceil(size.height * 0.5);
        }
        
        switch(drawRatio){
            case "Right, Left":
                outpaintX = ex;
                break;
            case "Top, Bottom":
                outpaintY = ey;
                break;
            case "Right, Left, Top, Bottom":
            default:
                outpaintX = ex;
                outpaintY = ey;
                break;
        }
        
        setError(null);
        setRestoredId(null);      
        setRestoredImage(null);      
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "outpaint", 
                preRoomId,
                params: {
                    func: model,
                    inputText: prompt,
                    realText: prompt + sysPrompts,   
                    model,
                    params: {
                        image: originalPhoto,
                        prompt: (prompt + sysPrompts) || "backgound", 
                        lora_weights: lora?.url || "",
                        outpaint_left: outpaintX,
                        outpaint_right: outpaintX,
                        outpaint_up: outpaintY,
                        outpaint_down: outpaintY,
                        outpaint_selections: drawRatio,
                        quality: "TURBO",
                    }
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

    let num = 1;
    
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
                                setRestoredId(null);
                                setError(null); 
                            }}
                        />  
                        
                        <div className="page-tab-edit">

                           <div className="space-y-4 w-full mb-5">
                                <FormLabel number={`${num++}`} label="扩展的方向"/>             
                                <DropDown
                                    theme={drawRatio}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setDrawRatio(newRoom)}
                                    themes={drawRatios}
                                    names={drawRatioNames}
                                    />
                            </div>

                            <div className="space-y-4 w-full mb-5">
                                <FormLabel number={`${num++}`} label="扩图引擎" hint="不同扩图引擎适合不同照片，如果当前扩图引擎效果不够好，不妨试着换一种扩图引擎。价格只反映对AI服务器资源的消耗量，针对特定画面，贵的引擎不一定效果更好！"/>             
                                <DropDown
                                    theme={model}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setModel(newRoom)}
                                    themes={models}
                                    names={modelNames}
                                    />
                            </div>
                            
                            <div className="space-y-4 w-full mb-5">
                                <FormLabel number={`${num++}`} label="描绘扩展区域的内容（可选）"
                                    hint="描绘的扩展内容一定要与原图有合理的连续性，否则会生成非连续画面。也可以不填，让AI自动取联想合理内容。"
                                    />             
                                <PromptArea
                                     hasAdvanceButton={false}
                                     hotWords="NO_HOTWORDS"
                                     userPrompt={prompt}                                     
                                     onSysPromptChange={(sp) => setSysPrompts(sp) }
                                     onUserPromptChange={(up) => setPrompt(up) }
                                     />
                            </div>

                            <StartButton config={config} title="开始扩图" model={model} showPrice={true} loading={loading}
                                onStart={async () => {
                                    await generatePhoto();
                                }}
                                />
                            
                        
                        </div>
                 
                    </div>
                </main>
           
            </TopFrame>
        );
};

// export default Home;
