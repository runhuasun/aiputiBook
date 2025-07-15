import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Room, User } from "@prisma/client";
import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";

import { GenerateResponseData } from "./api/generate";

import TopFrame from "../components/TopFrame";
import { CompareSlider } from "../components/CompareSlider";

import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import DropDown from "../components/DropDown";
import Genhis from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import FormLabel from "../components/FormLabel";
import AutoSizeImage from "../components/AutoSizeImage";
import ImageCanvas from "../components/ImageCanvas";
import ResultButtons from "../components/ResultButtons";
import StartButton from "../components/StartButton";
import LoadingRing from "../components/LoadingRing";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import Image from "../components/wrapper/Image";

import downloadPhoto from "../utils/fileUtils";
import {callAPI2} from "../utils/apiUtils";
import {getImageSize} from "../utils/fileUtils";
import * as ru from "../utils/restUtils";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";
import * as fu from "../utils/fileUtils";
import * as rmu from "../utils/roomUtils";



export async function getServerSideProps(ctx: any) {
    let roomId = ctx?.query?.roomId;
    let image;
    if(roomId){
        image = await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });
    }
    
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            image,
            config
        },
    };
}  



const funcs: string[] = [
    "faceBeauty",
    "faceTidyup",
    "faceMakeup",
 //   "faceFilter",
    "enhanceFace",
    "liquifyFace",
    "retouchSkin",
];
const funcNames = new Map();
funcNames.set("liquifyFace","智能瘦脸");
funcNames.set("retouchSkin","智能美肤");
funcNames.set("faceTidyup","人脸美型");
funcNames.set("faceBeauty","人脸美颜");
funcNames.set("faceMakeup","人脸美妆");
// funcNames.set("faceFilter","风格滤镜");
funcNames.set("enhanceFace","人脸修复");

const shapeTypeNames = new Map([
    ['0', "瘦颧骨"],
    ['1', "整体削脸"],
    ['2', "瘦脸颊"],
    ['3', "缩短脸部长度"],
    ['4', "下巴缩短"],
    ['5', "下巴拉长"],
    ['6', "瘦下巴"],
    ['7', "瘦下颌"],
    ['8', "眼睛变大"],
    ['9', "让眼角对称"], // 眼角1
    ['12', "提高内眼角"], // 眼角2
    ['10', "缩小眼距"],
    ['11', "拉宽眼距"],
    ['13', "眼睛上下变宽"],
    ['14', "整体瘦鼻"],
    ['15', "鼻翼变窄"],
    ['16', "鼻子变短"],
    ['17', "鼻头上移"],
    ['18', "嘴左右变窄"],
    ['19', "嘴左右变宽"],
    ['20', "嘴唇位置提高"],
//    ['21', "人中"]
]);
const shapeTypes: string[] = Array.from(shapeTypeNames.keys());

const makeupResourceTypeNames = new Map([
//    ['0', "whole"],
    ['1', "基础妆"],
    ['2', "少女妆"],
    ['3', "活力妆"],
    ['4', "优雅妆"],
    ['5', "魅惑妆"],
    ['6', "梅子妆"]
]);
const makeupResourceTypes: string[] = Array.from(makeupResourceTypeNames.keys());

const filterResourceTypeNames = new Map([
    ["向日葵", "向日葵"],
    ["桔梗", "桔梗"],
    ["垦丁", "垦丁"],
    ["大理", "大理"],
    ["丽江", "丽江"]
    ]);
const filterResourceTypes:string[] = Array.from(filterResourceTypeNames.keys());



export default function beautifyPhoto({ simRoomBody, image, config }: { simRoomBody:any, image:Room, config:any }) {

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [func, setFunc] = useState<string>(router.query?.func as string || simRoomBody?.params?.func || "faceBeauty");
    const [originalPhoto, setOriginalPhoto] = useState<string | null>();
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);

    const [retouchSkinParams, setRetouchSkinParams] = useState<any>({retouchDegree:1, whiteningDegree:1});
    const [liquifyFaceParams, setLiquifyFaceParams] = useState<any>({slimDegree:1});
    const [faceBeautyParams, setFaceBeautyParams] = useState<any>({sharp:0.1, smooth:0.2, white:0.5});
    const [faceTidyupParams, setFaceTidyupParams] = useState<any>({shapeType:'0', strength:0.5});
    const [faceMakeupParams, setFaceMakeupParams] = useState<any>({resourceType:'1', strength:0.5});
    const [faceFilterParams, setFaceFilterParams] = useState<any>({resourceType:"垦丁", strength:0.5});
    const [BCSParams, setBCSParams] = useState<any>({bright:0, contrast: 0, sharpen:50});
    
    const [faces, setFaces] = useState<any>();
    const [targetRect, setTargetRect] = useState<any>();
    
    const title = (router.query.title as string) || "美颜美型";

    useEffect(() => {
        const inputImage = (router.query.imageURL || image?.outputImage || simRoomBody?.params?.imageURL) as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setOriginalPhoto(result);
                }
            });
        }else{
            setOriginalPhoto("");
        }
    }, []); // 空数组表示只在组件挂载时执行一次
    
    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张照片");
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
        const size = await getImageSize(originalPhoto);
        if(size.width > 2000 || size.height > 2000){
            const ok = await confirm(`图片宽度和高度不能超过2000像素。目前图片的高度为${size.height}像素，宽度为${size.width}像素。去图片裁剪功能把图片缩小，再来使用本功能吧！`);
            if(ok){
                window.open(`/editImage?imageURL=${originalPhoto}`, "_self");
                return;
            }else{
                return;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);
        setSideBySide(false);                        
        
        let params:any = {};
        switch(func){
            case "faceTidyup":
                params = faceTidyupParams;
                break;
            case "faceMakeup":
                params = faceMakeupParams;
                params.makeupType = "whole";
                break;
            case "faceFilter":
                params = faceFilterParams;
                break;
            case "faceBeauty":                
                params = faceBeautyParams;
                break;
            case "liquifyFace":
                params = liquifyFaceParams;
                break;
            case "retouchSkin":
                params = retouchSkinParams;
                break;
        }
        params.imageURL = originalPhoto;
        params.targetRect = targetRect;
        params.func = func;
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "decoratePhoto",
                preRoomId,
                params
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
                    
                    <div className="w-full flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">
                        
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

                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label="选择修图功能"/>                             
                                <DropDown theme={func} themes={funcs} names={funcNames}  setTheme={(newTheme:string) => setFunc(newTheme)} />
                            </div>

                            {/* 瘦脸功能参数 */}
                            {func == "liquifyFace" && (
                            <div className="space-y-4 mt-4 w-full max-w-lg">
                                 <FormLabel number={`${num++}`} label={`瘦脸力度：${liquifyFaceParams.slimDegree}`}/>                             
                                 <input type="range" value={liquifyFaceParams.slimDegree} min="0" max="2" step="0.1" className="slider-dark-green w-full mt-4"
                                     onChange={(e) => setLiquifyFaceParams({
                                         slimDegree:parseFloat(e.target.value),
                                     })}
                                     />
                             </div>
                             )}
                            
                             
                             {/* 美肤功能参数 */}
                             {func == "retouchSkin" && (
                             <div className="space-y-5">
                                 <div className="space-y-4 mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`磨皮力度：${retouchSkinParams.retouchDegree}`}/>
                                     <input type="range" value={retouchSkinParams.retouchDegree} min="0" max="1.5" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setRetouchSkinParams({
                                             retouchDegree:parseFloat(e.target.value),
                                             whiteningDegree:retouchSkinParams.whiteningDegree,
                                         })}
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`美白力度：${retouchSkinParams.whiteningDegree}`}/>                                 
                                     <input type="range" value={retouchSkinParams.whiteningDegree} min="0" max="1.5" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setRetouchSkinParams({
                                             retouchDegree:retouchSkinParams.retouchDegree,
                                             whiteningDegree:parseFloat(e.target.value),
                                         })}
                                         />
                                 </div>
                              </div>
                             )}                     
                            
                           
                             {/* 美颜功能参数 */}
                             {func == "faceBeauty" && (
                             <div className="space-y-5">
                                 <div className="space-y-4 mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`锐化程度：${faceBeautyParams.sharp}`}/>                                 
                                     <input type="range" value={faceBeautyParams.sharp} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setFaceBeautyParams({
                                             sharp:parseFloat(e.target.value),
                                             smooth:faceBeautyParams.smooth,
                                             white:faceBeautyParams.white
                                         })}
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`平滑程度：${faceBeautyParams.smooth}`}/>                                 
                                     <input type="range" value={faceBeautyParams.smooth} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setFaceBeautyParams({
                                             sharp:faceBeautyParams.sharp,
                                             smooth:parseFloat(e.target.value),
                                             white:faceBeautyParams.white
                                         })}
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`美白程度：${faceBeautyParams.white}`}/>                                 
                                     <input type="range" value={faceBeautyParams.white} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setFaceBeautyParams({
                                             sharp:faceBeautyParams.sharp,
                                             smooth:faceBeautyParams.smooth,
                                             white:parseFloat(e.target.value)
                                         })}
                                         />
                                 </div>
                             </div>
                             )}
                            
                             {/* 美形功能参数 */}
                             {func == "faceTidyup" && (
                             <div className="space-y-5">
                                 <div className="space-y-4 mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`选择美型部位`}/>                                 
                                     <DropDown theme={faceTidyupParams.shapeType} themes={shapeTypes} names={shapeTypeNames}  setTheme={(newTheme:string) => (faceTidyupParams.shapeType=newTheme)} />
                            
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`美型力度：${faceTidyupParams.strength}`}/>                                 
                                     <input type="range" value={faceTidyupParams.strength} min="0.1" max="1" step="0.1" className="w-full mt-4"
                                         onChange={(e) => setFaceTidyupParams({
                                             strength: parseFloat(e.target.value),
                                             shapeType: faceTidyupParams.shapeType
                                         }) }
                                         />
                                 </div>
                             </div>
                             )}
                            
                            
                             {/* 美妆功能参数 */}
                             {func == "faceMakeup" && (
                             <div className="space-y-5">
                                 <div className="space-y-4 mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`选择美妆风格`}/>                                 
                                     <DropDown theme={faceMakeupParams.resourceType} themes={makeupResourceTypes} names={makeupResourceTypeNames} 
                                         setTheme={(newTheme:string) => (faceMakeupParams.resourceType=newTheme)} />
                            
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`美妆力度：${faceMakeupParams.strength}`}/>                                 
                                     <input type="range" value={faceMakeupParams.strength} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setFaceMakeupParams({
                                             strength: parseFloat(e.target.value),
                                             resourceType: faceMakeupParams.resourceType
                                         }) }
                                         />
                                 </div>
                             </div>
                             )}
                            
                            
                             {/* 风格滤镜功能参数 */}
                             {func == "faceFilter" && (
                             <div className="space-y-5">
                                 <div className="space-y-4 mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`选择滤镜风格`}/>                                 
                                     <DropDown theme={faceFilterParams.resourceType} themes={filterResourceTypes} names={filterResourceTypeNames} 
                                         setTheme={(newTheme:string) => (faceFilterParams.resourceType=newTheme)} />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`美妆力度：${faceFilterParams.strength}`}/>                                 
                                     <input type="range" value={faceFilterParams.strength} min="0.1" max="1" step="0.1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setFaceFilterParams({
                                             strength: parseFloat(e.target.value),
                                             resourceType: faceFilterParams.resourceType
                                         }) }
                                         />
                                 </div>
                             </div>
                             )}   

                             <StartButton config={config} title="开始智能修图" model={func} showPrice={true} loading={loading}
                                 onStart={() => {
                                     setRestoredImage(null);
                                     setRestoredId(null);
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
