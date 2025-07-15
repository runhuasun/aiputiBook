import Link from "next/link";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { User, Room } from "@prisma/client";
import TextareaAutosize from "react-textarea-autosize";

import ModelSelector from "../components/ModelSelector";
import * as gh from "../components/Genhis";
import PromptArea from "../components/PromptArea";
import FormLabel from "../components/FormLabel";

import {mimeTypes} from "../utils/fileUtils";
import {callAPI, callAPI2} from "../utils/apiUtils";
import * as debug from "../utils/debug";
import * as ru from "../utils/restUtils";


interface RoomAdminPanelProps {
    room: any;
    user: any;
}


export default function RoomAdminPanel({room, user }: RoomAdminPanelProps) {
   
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [roomScore, setRoomScore] = useState<number>(room?.sysScore || 0);
    const [roomStatus, setRoomStatus] = useState<string>(room?.status);
    const [outputImage, setOutputImage] = useState<string>(room?.outputImage);
    
    const [adminPrompt, setAdminPrompt] = useState<string>(room?.prompt||"");
    const [adminDesc, setAdminDesc] = useState<string>(room?.desc || "");
    const [adminDescPrompt, setAdminDescPrompt] = useState<string>("");
    
    function isAdmin(){
        return status == "authenticated" && user && user.actors && user.actors.indexOf("admin")>=0;
    }

    function reloadPage(room:any){
        if(room){
            switch(room?.resultType){
                case "IMAGE":
                    window.open(ru.getImageRest(room?.id), "_self");
                    return;
                case "VIDEO":
                    window.open(`/videoDetail?roomId=${room?.id}`, "_self");
                    return;
                case "VOICE":
                    window.open(`/createVoice?roomId=${room?.id}`, "_self");
                    return;
            }
        }
    }
    
    async function setScore(room: Room, score: number){
        const res = await callAPI("/api/updateRoom", { id:room?.id, sysScore:score, cmd:"SET_SCORE" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            setRoomScore(score);
        }   
    }

    async function setModel(room: Room, model: any){
        const res = await callAPI("/api/updateRoom", { id:room?.id, modelCode:model?.code, cmd:"SET_MODEL" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            reloadPage(room);
        }   
    }
    
    async function physicalDelete(room: Room){
        const backup = await confirm("提示：是否将数据备份到合法目的地，并保留数据记录吗？");
        if(backup){
            const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"DELETE", backup:true });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                reloadPage(room);
            }   
        }else{
            const confirmed = await confirm("提醒：这是物理删除，一旦执行操作，将完全无法恢复！！！你是否确定要彻底的删除当前图片在文件服务器和数据库中的记录？");
            if(confirmed){
                const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"PHYSICAL_DELETE" });
                if (res.status !== 200) {
                    alert(JSON.stringify(res));
                } else {
                    reloadPage(room);                
                }   
            }
        }
    }

    async function backupToUS(room: Room){
        const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"BACKUP_TO_US" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            reloadPage(room);
        }   
    }

    async function moveToFileServer(room: Room){
        const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"MOVE_TO_FILESERVER" });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            reloadPage(room);
        }   
    }    

    function getRoomDetail(room:any){
    let body = JSON.parse(room.bodystr || "{}");
    let steps = body.STEPS;

    // Generate the STEPS section dynamically
    let stepsSection = '';
    if (steps && steps.length > 0) {
        stepsSection = 'STEPS : {\n';
        steps.forEach((step: any, index: number) => {
            stepsSection += `                STEP${index + 1}: ${JSON.stringify(step)}\n`;
        });
        stepsSection += '            }';
    } else {
        stepsSection = 'STEPS : {}';
    }

    const roomDetail = 
`id : ${room.id}
replicateId : ${room.replicateId}
func : ${room.func}
usedCredits : ${room.usedCredits}                                
aiservice : ${room.aiservice}
outputImage : ${room.outputImage}
prompt : ${room.prompt}
status : ${room.status}
audit : ${room.audit}
createdAt : ${room.createdAt}
callbacked : ${room.callbacked}
body : {
    cmd : ${body.cmd}
    params : ${JSON.stringify(body.params)}
    ${stepsSection}
}
ROOM : ${JSON.stringify(room)}
`;
    return roomDetail;
    }
    

    async function redoRoom(room:any){
        const go = await confirm("重新启动任务，将会破坏当前已有数据，你确定要这么做吗?");
        if(!go){
            return;
        }
        const yes = await confirm("重新启动任务，不会再次对用户扣费，但是如果任务执行失败会进行一次退费，请确认已经处理！");
        if(!yes){
            return;
        }

        await alert("任务准备开始被重新启动！");

        const reqBody = JSON.parse(room.bodystr);
        if(!await confirm(room.bodystr)){
            return;
        }
        callAPI2(
            "/api/workflowAgent2",
            {
                roomId:room.id,
                cmd:reqBody.cmd, 
                preRoomId:reqBody.preRoomId,
                params:reqBody.params,
                email:reqBody.email,
                priceModel:reqBody.priceModel,
                priceUnits:reqBody.priceUnits,
                needZoomIn:reqBody.needZoomIn,
                uid:reqBody.uid,
                ukey:reqBody.ukey,
            },
            "重新启动任务",
            room.resultType,
            (status:boolean)=>{},
            (res:any)=>{
               mutate();
            }
        ); 
        await alert("任务已经被重新启动！");
        window.location.reload();
    }

    async function updateRoom(room: Room){
        const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"UPDATE_ROOM", status:roomStatus, outputImage });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            reloadPage(room);
        }   
    }   

    async function markAudit(room: Room, audit:string){
        const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"MARK_AUDIT", audit });
        if (res.status !== 200) {
            alert(JSON.stringify(res));
        } else {
            reloadPage(room);
        }   
    }   

    
    if(room && user && isAdmin()){
        return (
            <div className="mt-2 w-full p-2 rounded-xl page-tab">
                <div className="text-lg mt-10 mb-5 text-center">
                    <p>管理员功能</p>
                </div>
                <p>内容评分</p>
                <div className="w-full mt-4 flex flex-row gap-2 items-center text-gray-200" >
                   {Array.from({ length: 15 }, (_, index) => {
                    const score = index;
                    return (
                      <button
                        key={score}
                        className={roomScore == score ? "button-main px-2" : "button-dark px-2"}
                        onClick={() => setScore(room, score)}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>

                {room?.resultType == "IMAGE" && (
                <div className="w-full max-w-2xl flex flex-col items-center mt-10">
                    <div className="flex flex-row items-center space-x-3">
                        <button onClick={() => setModel(room, null) }> [X] </button>  
                        <Link href={room?.model ? ("/showImageModel?model=" + room?.model) : "#"} target="_blank">
                            套系：{room?.model}
                        </Link>
                    </div>
                    <ModelSelector onSelect = {(newFile) => {
                        setModel(room, newFile);
                    }} title="选择写真套系" modelType="LORA" />    
                </div>   
                )}

                <div className="w-full flex flex-row items-center space-x-10 mt-10">
                    {room?.access=="PRIVATE" ? (
                    <button onClick={() => { gh.publicRoom(room?.id) }} className="button-dark px-5 py-2">
                     公开
                    </button>

                    ) : (
                    <button onClick={() => { gh.privateRoom(room?.id) }} className="button-dark px-5 py-2">
                     隐藏
                    </button>
                    )}                                
                    {room?.status=="DELETE" ? (
                    <button onClick={() => { gh.recoverRoom(room?.id) }} className="button-dark px-5 py-2">
                     取消删除标记
                    </button>
                    ) : (
                    <button onClick={() => { gh.deleteRoom(room?.id) }} className="button-dark px-5 py-2">
                     设置删除标记
                    </button>
                    )}                                
                    
                    <button onClick={() => { physicalDelete(room) }} className="button-dark px-5 py-2">
                    彻底的物理删除该图片
                    </button>
    
                    <button onClick={() => { backupToUS(room) }} className="button-dark px-5 py-2">
                    从国内存储删除
                    </button>
    
                    <button onClick={() => { moveToFileServer(room) }} className="button-dark px-5 py-2">
                    转储到国内存储
                    </button>

                    <button onClick={() => { redoRoom(room) }} className="button-dark px-5 py-2">
                    重新执行任务
                    </button>

                    <button onClick={() => { markAudit(room, "N") }} className="button-dark px-5 py-2">
                    标记正常
                    </button>

                    <button onClick={() => { markAudit(room, "P") }} className="button-dark px-5 py-2">
                    标记违规
                    </button>                    
                </div>

                <div className="w-full flex flex-row space-x-5">
                    <div className="flex flex-col w-40 space-y-3">
                        <FormLabel label="状态"/>
                        <input id="iptPath" type="text" value={roomStatus} className="input-main w-full" 
                            onChange={(e) => setRoomStatus(e.target.value) } />  
                    </div>   
                    <div className="flex flex-1 flex-col space-y-3">
                        <FormLabel label="结果"/>
                        <input id="iptPath" type="text" value={outputImage} className="input-main w-full" 
                            onChange={(e) => setOutputImage(e.target.value) } />  
                    </div>       
                    <button onClick={() => { updateRoom(room) }} className="button-dark px-5 py-2">
                    更新
                    </button>
                </div>
                    
                <div className="w-full mt-10 flex flex-col">
                    <TextareaAutosize id="iptPrompt"  
                        minRows={10} maxRows={100}
                        className="w-full bg-slate-800 text-gray-100 border border-gray-600 focus:ring-green-800 rounded-lg font-medium px-4 py-2 " 
                        value={ getRoomDetail(room) }
                        readOnly = { true }
                        />
                    {room.status == "DELETE" && (
                    <p className="text-red text-pretty">
                        数据已经被标记删除。目前文件在：{room.outputImage}
                    </p>
                    )}    

                    <div className="relative inline-block w-full mt-0 flex flex-row">
                        <PromptArea
                            hotWords="PORTRAIT_ALL"
                            userPrompt={adminPrompt}
                            // onSysPromptChange={(sp) => setSysPrompts(sp) }
                            onUserPromptChange={(up) => setAdminPrompt(up) }
                            />
                        <button onClick={async () => { 
                            const res = await callAPI("/api/updateRoom", { id:room?.id, prompt:adminPrompt, cmd:"SET_PROMPT" });
                            if (res.status !== 200) {
                                alert(JSON.stringify(res));
                            } else {
                                alert("提示词保存成功!");
                            }                           
                        }} className="button-dark px-5 py-2">
                         保存
                        </button>                                
                    </div>    

                    <div className="relative inline-block w-full mt-0 flex flex-col space-y-3">
                        <PromptArea
                            hotWords="NO_HOTWORDS"
                            userPrompt={adminDescPrompt}
                            // onSysPromptChange={(sp) => setSysPrompts(sp) }
                            onUserPromptChange={(up) => setAdminDescPrompt(up) }
                            />
                        
                        <button onClick={async () => { 
                            const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"GET_DESC", prompt:adminDescPrompt });
                            if (res.status !== 200) {
                                alert(JSON.stringify(res));
                            } else {
                                setAdminDesc(res.result.desc);
                            }                           
                        }} className="button-dark px-5 py-2">
                         生成描述
                        </button>                                
                        <PromptArea
                            hotWords="NO_HOTWORDS"
                            userPrompt={adminDesc}
                            // onSysPromptChange={(sp) => setSysPrompts(sp) }
                            onUserPromptChange={(up) => setAdminDesc(up) }
                            />
                        <button onClick={async () => { 
                            const res = await callAPI("/api/updateRoom", { id:room?.id, cmd:"SET_DESC", desc:adminDesc });
                            if (res.status !== 200) {
                                alert(JSON.stringify(res));
                            } else {
                                alert("设置成功");
                                setAdminDesc(res.result.desc);
                            }                           
                        }} className="button-dark px-5 py-2">
                         保存描述
                        </button>                                
                        
                    </div>
                
                </div>
            </div>
        );
    }else{
        return (<div></div>);
    }
}
