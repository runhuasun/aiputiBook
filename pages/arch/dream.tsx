import { useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import prisma from "../../lib/prismadb";
import { authOptions } from "../../pages/api/auth/[...nextauth]";

import TopFrame from "../../components/TopFrame";
import ToolBar from "../../components/ToolBar";
import ImageView from "../../components/ImageView";
import DropDown from "../../components/DropDown";
import FormLabel from "../../components/FormLabel";
import StartButton from "../../components/StartButton";
import PromptArea from "../../components/PromptArea";

import { callAPI2 } from "../../utils/apiUtils";
import * as rmu from "../../utils/roomUtils";
import * as monitor from "../../utils/monitor";
import { config, system } from "../../utils/config";
import * as ddt from "../../utils/dropdownTypes";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let func = simRoomBody?.params?.func || ctx?.query?.func || "deco";
    
    if (session && session.user  && session.user.email) {
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
            },
        });
        
        return {
            props: {
                simRoomBody,                
                func,
                config,
            },
        };
    }else{
        return {
            props: {
                func,
                config, 
            },
        };
  }
}




export default function dream({ simRoomBody, func, config }: { simRoomBody:any, func:string, config: any }) {
    const router = useRouter();
    
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query?.imageURL || simRoomBody?.params?.imageUrl) as string);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    let roomInit:string, themeInit:string, rooms:string[], themes:string[], themeNames:Map<string, string>, roomNames:Map<string, string>, windowTitle:string, 
        themeLabel:string, roomLabel:string, objName:string, demoAlbumId:string;
    
    switch(func){
        case "draft":
            objName = "建筑";
            windowTitle = "AI建筑渲染";
            themeLabel = "设计风格";
            roomLabel = "建筑类型";            
            themes = ddt.archStyles;
            themeNames = ddt.archStyleNames;
            themeInit = "Modern";
            rooms = ddt.archTypes;
            roomNames = ddt.archTypeNames;
            roomInit = "House";
            demoAlbumId = system.album.demoArchDraft.id;
            break;
        case "garden":
            objName = "花园";
            windowTitle = "AI花园改造";
            themeLabel = "花园风格";
            roomLabel = "改造力度";            
            themes = ddt.gardenStyles;
            themeNames = ddt.gardenStyleNames;
            themeInit = "British";
            rooms = ddt.reformTypes;
            roomNames = ddt.reformTypeNames;
            roomInit = "Major";
            demoAlbumId = system.album.demoArchGarden.id;            
            break;
        case "deco":
        default: 
            objName = "房间";
            windowTitle = "AI室内装修";
            themeLabel = "装修风格";
            roomLabel = "房间类型";
            themes = ddt.decoThemes;
            themeNames = ddt.decoThemeNames;
            themeInit = "Modern";
            rooms = ddt.roomTypes;
            roomNames = ddt.roomTypeNames;
            roomInit = "Living Room";
            demoAlbumId = system.album.demoArchDeco.id;            
    }
    
    const [theme, setTheme] = useState<string>(simRoomBody?.params?.theme || themeInit || "");
    const [room, setRoom] = useState<string>(simRoomBody?.params?.room || roomInit || "");
    const [extraPrompt, setExtraPrompt] = useState<string>(simRoomBody?.params?.extraPrompt || "");
    
    async function generatePhoto() {
        if(!originalPhoto){
            return alert("请先上传一张原始照片！");
        }
        let text = "";
        switch(func){
            case "deco":
                text = room === "Gaming Room"
                    ? "a room for gaming with gaming computers, gaming consoles, and gaming chairs. "
                    : `a ${theme.toLowerCase()} ${room.toLowerCase()}. `;
                break;
                    
            case "draft":
                text = `a ${theme.toLowerCase()} ${room.toLowerCase()}. `;
                break;
            case "garden":
                text = `a ${theme.toLowerCase()} garden. `;
                break;
        }
        if(extraPrompt){
            text += extraPrompt;
        }
        
        const res = await callAPI2(
            "/api/workflowAgent2", 
            { 
                cmd:func,
                params: {
                    func,                
                    imageUrl: originalPhoto, 
                    theme, 
                    room, 
                    extraPrompt,
                    inputText: text,
                    realText: text,
                }
            },
            "生成",
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
                    <ToolBar config={config} imageURL={originalPhoto}/>

                    <div className="page-container">

                        <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error} 
                            selectorType="TEMPLATE" albumId={demoAlbumId} albumName="样例"                                                                                        
                            resultButtonParams={{continueButton:false, inpaintButton:true}}
                            onSelectRoom={(newRoom:any)=>{
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
                            
                            <FormLabel number={`${num++}`} label={themeLabel}/>
                            <DropDown setTheme={(newTheme) => setTheme(newTheme)} theme={theme} themes={themes} names={themeNames} />
                            
                            <FormLabel number={`${num++}`} label={roomLabel}/>
                            <DropDown setTheme={(newRoom) => setRoom(newRoom)} theme={room} themes={rooms} names={roomNames} />

                            <FormLabel number={`${num++}`} label={"其它要求（可选）"}/>
                            <PromptArea
                                initPlaceHolder={"例如：实木地板，墙壁是淡黄色"}
                                hotWords="NO_HOTWORDS"
                                initMinRows={5} initMaxRows={15}
                                hasAdvanceButton={false}
                                userPrompt={extraPrompt}
                                onUserPromptChange={(up) => setExtraPrompt(up) }
                                />                              
                       
                            <StartButton config={config} title="开始设计" loading={loading} showPrice={true}
                                onStart={() => {
                                setRestoredImage(null);
                                setRestoredId(null);                                    
                                setRestoredLoaded(false);
                                setError(null);  
                                setSideBySide(false);
                                generatePhoto();
                            }}/>
                            
                        </div>
                        
                    </div>
                   
                </main>

            </TopFrame>
        );
    
};




