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
import DropDown from "../components/DropDown";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";

import { extractMaskImage } from "../components/MaskImageEditor";
import { callAPI2 } from "../utils/apiUtils";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";




//    "take-off-eyeglasses"
const funcNames = new Map([
    ["flux-dev-inpaint", "Flux-Dev局部重绘引擎"],
    ["ideogram", "IDEOGRAM-V2局部重绘引擎"],
    ["ideogram-t", "IDEOGRAM-V2 Turbo局部重绘引擎"],
    ["ideogram-v3-turbo", "ideogram-v3-turbo局部重绘引擎"],
]);
const funcs: string[] = Array.from(funcNames.keys());
    
const objectNames = new Map([
    ["text", "删除区域文字、水印或标记"],
    ["person", "删除区域人物"],
    ["glasses", "摘除人物的眼镜"],
    ["hair", "清除发丝"],
    ["eye bags", "消除脸部眼袋"],
    ["crow's feet", "清除眼角的鱼尾纹"]
]);
const objects:string[] = Array.from(objectNames.keys());

export default function removeObject({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: any, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [image, setImage] = useState<string>("");
    const [targetRect, setTargetRect] = useState<any>();
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);
   
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [func, setFunc] = useState("ideogram-v3-turbo");
    const [title, setTitle] = useState<string>("选区删除对象");
    const [object, setObject] = useState<string>(simRoomBody?.params.object || "text");
    const [prompt, setPrompt] = useState<string>("none");
    const [maskCanvas, setMaskCanvas] = useState<any>();

    useEffect(() => {
        const inputImage = (router.query.imageURL || defaultImage?.outputImage || simRoomBody?.params?.image || "") as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setImage(result);
                }
            });
        }else{
            setImage("");
        }
    }, []); // 空数组表示只在组件挂载时执行一次

    useEffect(() => {
        switch(object){
            case "glasses":
                setFunc("flux-dev-inpaint");
                setPrompt("Remove the person's glasses");
                break;
            case "person":
                setFunc("ideogram-v3-turbo");
                setPrompt("remove the people");
                break;
            case "text":
                setFunc("ideogram-v3-turbo");
                setPrompt("none");
                break;
            case "hair":
                setFunc("ideogram-v3-turbo");
                setPrompt("清除发丝");
                break;
            case "eye bags":
                setFunc("ideogram-v3-turbo");
                setPrompt("清除发丝");
                break;
            case "crow's feet":
                setFunc("ideogram-v3-turbo");
                setPrompt("清除鱼尾纹");
                break;                
            default:
                setFunc("ideogram-v3-turbo");
                setPrompt("none");
        }
    }, [object]); 
    
    async function generate() {
        if(!image){
            return alert("请先选择或上传一张照片！");
        }

        let maskImage;
        if(maskCanvas){
            maskImage = extractMaskImage(maskCanvas);
        }
        if(!maskImage){
            return alert("请先在原始图片上选择一个修改区域");
        }
        const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
        switch(bwt){
            case "B":
                return alert("您还没有在原始图片上选择一个修改区域");
            case "W":
                return alert("您不能把所有的区域都涂抹成修改区域！");
        }
        
        const imageMeta = await fu.getImageSize(image);
        if(imageMeta && (imageMeta.width!>2000 || imageMeta.height!>2000)){
            return alert(`图片尺寸必须小于2000 X 2000像素，当前图片高度${imageMeta.height}，宽度${imageMeta.width}，请裁剪后重试。`);
        }
        
        let params:any = {
            func,
            object,
            image, 
            width:imageWidth,
            height:imageHeight,     
            prompt,
            maskImage:extractMaskImage(maskCanvas),
        };

        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd:"removeObject", 
                preRoomId,
                params
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result?.generated);
               setRestoredId(res.result?.genRoomId);                                      
            },
            (res:any)=>{
                if(res?.result?.indexOf("输入无效")>=0){
                    alert("图片尺寸不符合要求，请用照片裁剪功能，先把照片裁剪成标准16:9，标准9:16，标准4:3，标准3:4，或者标准1:1尺寸，再来尝试");
                    window.open(`/editImage?imageURL=${image}`);
                    return true;
                }else{
                    return false;
                }
            }
        );                    
    }


    let num = 1;

       
        return (
            <TopFrame config={config}>
               
                <main>

                    <ToolBar config={config} roomId={preRoomId} imageURL={image} restoredImage={restoredImage} restoredId={restoredId} />
                    
                    <div className="page-container">
                        <ImageView num={num++} originalPhoto={image} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                            supportMask={true} needMask={true}
                            onMaskUpdate={(maskCanvas: HTMLCanvasElement)=>{
                                setMaskCanvas(maskCanvas);
                            }}
                            onSelectRoom={(newRoom:any)=>{
                                setPreRoomId(newRoom?.id);
                            }}
                            onSelectImage={(newFile:string)=>{
                                setImage(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                            onContinue={(newFile:string)=>{
                                setImage(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                        />
                  
                      
                        <div className="page-tab-edit">                        
   
                            <div className="space-y-4 w-full max-w-lg  justify-center">
                                <FormLabel number={`${num++}`} label="删除涂抹区域的内容"/>                                
                                <DropDown
                                    theme={object}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setObject(newRoom)}
                                    themes={objects}
                                    names={objectNames}
                                    />
                            </div>
     
                            <StartButton config={config}  model={func} showPrice={true} loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredLoaded(false);
                                    setError(null);                      
                                    generate();
                                }}/>
 
                        </div>

                    </div>                          
            
                </main>
                
            </TopFrame>
        );
};

    
      
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let imgId = ctx?.query?.roomId;
    
    // 如果用户没登录显示最热门的，如果已经登录显示最新的
    const isLogin = session && session.user  && session.user.email ? true : false;
    let defaultImage = null;
    
    if(imgId){
        defaultImage = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),            
            defaultImage,
            config
        },
    };
  
}            
