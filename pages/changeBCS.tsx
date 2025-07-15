import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx?.query?.roomId;
    let imageURL = ctx?.query?.imageURL;
    let user;
    
    if (session && session.user  && session.user.email) {
        if(roomId){
            const image = await prisma.room.findUnique({
                where: {
                    id: roomId,
                },
            });
            if(image){
                imageURL = image.outputImage;
            }
        }
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });
    }
    
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            imageURL,
            config
        },
    };
}  



export default function changeBCS({ simRoomBody, imageURL, config }: { simRoomBody:any, imageURL:string, config:any }) {

    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [func, setFunc] = useState<string>("BCS");
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || imageURL || simRoomBody?.params?.imageURL) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [imageCanvas, setImageCanvas] = useState<any>();

    const [BCSParams, setBCSParams] = useState<any>({
        bright:simRoomBody?.params?.bright || 0, 
        contrast: simRoomBody?.params?.contrast || 0, 
        sharpen: simRoomBody?.params?.sharpen || 50, 
        temperature: simRoomBody?.params?.temperature || 0
    });
    
    const [faces, setFaces] = useState<any>();
    const [targetRect, setTargetRect] = useState<any>();
    
    const title = (router.query.title as string) || "调整明暗对比";

    async function generatePhoto() {

        if(!originalPhoto){
            return alert("请先上传一张照片");
        }
         
        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);
        setSideBySide(false);                        
        let adjustImageURL:string="";
        if(!imageCanvas){
            return alert("请先调整一下亮度、对比度、锐度或者色温的数值，再执行操作！");
        }else{
            adjustImageURL = await fu.uploadBase64FileServer(imageCanvas.toDataURL('image/png'));
        }
        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd: "changeBCS",
                preRoomId,
                params:{
                    imageURL: originalPhoto,
                    adjustImageURL,
                    bright:BCSParams.bright, 
                    contrast:BCSParams.contrast, 
                    sharpen:BCSParams.sharpen, 
                    temperature:BCSParams.temperature
                }                    
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result.generated);
               setRestoredId(res.result.genRoomId);  
                setBCSParams({
                    bright: 0,
                    sharpen: 50,
                    contrast: 0,
                    temperature: 0,
                });   
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
                            BCS={true} params={BCSParams}
                            onSelectRoom={(newRoom:any)=>{
                                setPreRoomId(newRoom?.id);
                            }}
                            onSelectImage={(newFile:string)=>{
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setError(null); 
                            }}
                            onContinue={(newFile:string)=>{
                                 setBCSParams({
                                     bright: 0,
                                     sharpen: 50,
                                     contrast: 0,
                                     temperature: 0,
                                 });                                 
                                setOriginalPhoto(newFile);
                                setRestoredImage(null);
                                setRestoredId(null);                                
                                setError(null); 
                            }}
                            onCanvasUpdate={(canvas:HTMLCanvasElement)=>{
                                setImageCanvas(canvas);
                            }}                            
                        />                      
                        
                        <div className="page-tab-edit">                        
                             <div className="space-y-5">
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`亮度：${BCSParams.bright}`}/>                                 
                                     <input type="range" value={BCSParams.bright} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setBCSParams({
                                             bright: parseInt(e.target.value),
                                             sharpen: BCSParams.sharpen,
                                             contrast: BCSParams.contrast,
                                             temperature: BCSParams.temperature,
                                         }) }
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`对比度：${BCSParams.contrast}`}/>                                 
                                     <input type="range" value={BCSParams.contrast} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setBCSParams({
                                             bright: BCSParams.bright,
                                             sharpen: BCSParams.sharpen,
                                             contrast: parseInt(e.target.value),
                                             temperature: BCSParams.temperature,
                                         }) }
                                         />
                                 </div>
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`锐度：${BCSParams.sharpen}`}/>                                 
                                     <input type="range" value={BCSParams.sharpen} min="50" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setBCSParams({
                                             bright: BCSParams.bright,
                                             sharpen: parseInt(e.target.value),
                                             contrast: BCSParams.contrast,
                                             temperature: BCSParams.temperature,
                                         }) }
                                         />
                                 </div>   
                                 <div className="mt-4 w-full max-w-lg">
                                     <FormLabel number={`${num++}`} label={`色温：${BCSParams.temperature}`}/>                                 
                                     <input type="range" value={BCSParams.temperature} min="-100" max="100" step="1" className="slider-dark-green w-full mt-4"
                                         onChange={(e) => setBCSParams({
                                             bright: BCSParams.bright,
                                             sharpen: BCSParams.sharpen,
                                             contrast: BCSParams.contrast,
                                             temperature: parseInt(e.target.value),
                                         }) }
                                         />
                                 </div>                                  
                             </div>

                             <StartButton config={config} title="开始智能修图"  model={func} showPrice={true} loading={loading}
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
