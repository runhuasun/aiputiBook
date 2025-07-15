import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react';
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";

import Pagination from '../components/Pagination';
import PromptArea from '../components/PromptArea';
import LoadingDots from "../components/LoadingDots";
import MessageDialog from "../components/MessageDialog";

import { getFileIcon } from "../utils/rawdata";
import * as du from "../utils/deviceUtils";
import * as debug from "../utils/debug";
import {system} from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import * as enums from "../utils/enums";

interface TaskPannelProps {
    config: any;
    user: any;
    title?: string;
    roomId?: string;
    roomDesc?: string|null;
    className?: string;
    isOpened?: boolean;    

    onCancel?: () => void;
    onOpen?: () => void;
}


export default function TaskPannel({ 
    config,
    user,
    title, roomId, roomDesc,
    onOpen, onCancel,
    isOpened 
}: TaskPannelProps) {
  /*  
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [AIPrompt, setAIPrompt] = useState<string>("");
    const [loading, setLoading] = useState(false);
    //let AIPrompt:string="";
    const [hideMsg, setHideMsg] = useState("");

    const [showInviteUserTask, setShowInviteUserTask] = useState<boolean>(false);
    const [bonusTask, setBonusTask] = useState<string>("");
    useEffect( () => {
        if(user.boughtCredits <= 0){
            if(roomId && config.paymentWatermark!="NO"){
                setBonusTask("INVITE_TO_DEL_WATERMARK");
            }else if(config.inviteBonus > 0){
                setBonusTask("INVITE_BONUS");
            }else{
                callAPI(
                    "/api/creditManager", 
                    {
                        cmd: "HAS_CLOCK_IN_RECORD",
                    }
                ).then((res:any)=>{
                    if(res.status == enums.resStatus.OK){
                        if(res.result.hasCockInRecord == false){
                            setBonusTask("CLOCK_IN");
                        }else{
                            if(roomId && !roomDesc){
                                setBonusTask("ROOM_EVALUATE");
                            }
                        }
                    }
                });
            }
        }
    }, [roomId]); 
    
    if(!title){
        title = `奖励任务：最高可得999个${config.creditName}`
    }
    
    function open() {
        if(onOpen){
            onOpen();
        }
        setIsOpen(true);
    }

    function cancel() {
        setIsOpen(false);
        if(onCancel){
            onCancel();
            setAIPrompt("");
        }
    }
  
    async function generate(){
        
        if(!user){
            alert("AI辅助创意操作需要先登录系统再开始！");
            window.open("/loginChoice", "_blank");
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);    

        // 准备输入的数据
        try{
            let msg:string = "";
            let res = await callAPI(
                "/api/updateRoom", 
                { id:roomId, cmd:"GET_SET_DESC", 
                 // prompt:"Please describe this photo and provide a positive and encouraging evaluation." 
                 prompt: "Please provide a detailed description of the content of this photo and give a positive, uplifting, and flattering evaluation. Finally, evaluate the quality of such images and give a rating on a scale of 1-10."
                });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                msg = JSON.parse(res.result.desc).zh;
                setAIPrompt(msg);
            } 
/*
            res = await callAPI(
                "/api/updateRoom", 
                { id:roomId, cmd:"GET_DESC", 
                 prompt:"Evaluate the quality of such images on a scale of 1-10 points, give a score, and only output one score" 
                });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                const score = parseFloat(JSON.parse(res.result.desc).en) || Math.round(Math.random() * 2);
                const scorePrompt = `我给您的作品打${score}分！`;
                msg += "\n" + scorePrompt;
                setAIPrompt(msg);
            } 
*/
    /*
            res = await callAPI(
                "/api/creditManager", 
                { cmd:"TASK_EVALUATE_ROOM", roomId
                });
            if (res.status !== 200) {
                alert(JSON.stringify(res));
            } else {
                const bonus = res.result.bonus;
                if(bonus>0){
                    msg += "\n" + `恭喜你，我猜你就是传说中的AI大神！获得超能摄影大师的${bonus}个${config.creditName}的奖励，再接再厉哦！！！`;
                }else if(bonus>5){
                    msg += "\n" + `哇噢，中大奖了，你的作品真的是棒极了！难道你就是传说中的AI至尊宝，竟然获得超能摄影大师的${bonus}个${config.creditName}的奖励，久仰久仰！！！`;
                }else{
                    msg += "\n" + `虽然您的作品已经非常棒了，但是还没有让超能摄影大师满意的给出奖励，再试试别的作品吧，加油哦！相信你一定行！`;
                }
                setAIPrompt(msg);
            } 
        }catch(e){
            alert("系统对话发生未知错误，请和管理员联系");
            debug.error(e);
        }finally{
            setLoading(false);                
        }
  }
    

    if(!user){
        return (<div></div>);
    }

    if(bonusTask == "CLOCK_IN"){
        return (
            <button className="button-green-blue text-base px-10 py-2" 
                     onClick={() => {
                         window.open(`/dashboard`, "_self");
                     }}
                >                                        
                {`每日打卡可得4个${config.creditName}奖励`}
            </button>
        )
    }else if(bonusTask == "INVITE_TO_DEL_WATERMARK"){
        return (
            <div className="w-30 flex flex-row text-xs">
                <div className="flex w-full">
                    <div className="w-full h-2/3-screen">
                        <button className={"button-green-blue text-base px-10 py-2"}
                            onClick={() => {
                                setShowInviteUserTask(true)
                            }} >
                            <p>奖励任务：邀请朋友注册删除水印</p>
                        </button>
                        {showInviteUserTask && (
                        <MessageDialog title={"奖励任务"} message={""} isOpened={showInviteUserTask} onCancel={()=>(setShowInviteUserTask(false))} >
                            <div className="page-tab text-base text-white rounded-lg p-5 flex flex-col space-y-5">
                                <p>邀请三位以上您的朋友注册时，会自动删除您现有作品的水印</p>
                                <p className="text-gray-300 w-full max-w-3xl text-left">
                                    方法一、让您的朋友使用手机或Email注册，并输入您的邀请码：
                                    <span className="text-gray-200">{user.id}</span>
                                </p>   
                                <p className="text-gray-300 w-full max-w-3xl text-left">
                                    方法二、把以下链接发给您的朋友，请他（她）点击链接注册新用户：
                                    <span className="text-gray-200">{`${config.website}/loginChoice?inviteBy=${user.id}`}</span>
                                </p>   
                            </div>                                
                        </MessageDialog>
                        )}
                    </div>
                </div>
            </div>
            );
    }else if(bonusTask == "INVITE_BONUS"){
        return (
            <div className="w-30 flex flex-row text-xs">
                <div className="flex w-full">
                    <div className="w-full h-2/3-screen">
                        <button className={"button-green-blue text-base px-6 py-2"}
                            onClick={() => {
                                setShowInviteUserTask(true)
                            }} >
                            <p>奖励任务：邀请朋友注册获得奖励</p>
                        </button>
                        {showInviteUserTask && (
                        <MessageDialog title={"奖励任务"} message={""} isOpened={showInviteUserTask} onCancel={()=>(setShowInviteUserTask(false))} >
                            <div className="page-tab text-base text-white rounded-lg p-5 flex flex-col space-y-5">
                               {config.inviteBonus > 0 && (
                              <h4 className="flex-none leading-6 mt-2 mb-6 text-xl font-bold tracking-tight text-white">
                                  每邀请一位朋友注册，您就将立即获得{config.inviteBonus}个{config.creditName}：
                              </h4>
                               )}
                               {config.ICR > 0 && (
                              <h4 className="flex-none leading-6 mt-2 mb-6 text-xl font-bold tracking-tight text-white">
                                  您邀请注册的朋友充值，您将按照他充值{config.creditName}数的{Math.round(config.ICR*100)}%获得奖励：
                              </h4>
                                )}
                              {(config.inviteBonus > 0 || config.ICR > 0) && (
                              <>
                                  <p className="text-gray-400 mb-5 w-full max-w-3xl text-left">
                                      方法一、让您的朋友使用手机或Email注册，并输入您的邀请码：
                                      <span className="text-gray-300">{user.id}</span>
                                  </p>   
                                  <p className="text-gray-400 mb-5 w-full max-w-3xl text-left">
                                      方法二、把以下链接发给您的朋友，请他（她）点击链接注册新用户：
                                      <span className="text-gray-300">{`${config.website}/loginChoice?inviteBy=${user.id}`}</span>
                                  </p>   
                              </>
                              )} 
                            </div>                                
                        </MessageDialog>
                        )}
                    </div>
                </div>
            </div>
            );        
    }else if(bonusTask == "ROOM_EVALUATE"){      
        return (
            <div className="w-30 flex flex-row text-xs">
                <div className="flex w-full">
                    <div className="w-full h-2/3-screen">
                        <button className={(AIPrompt ? "button-disable" : "button-green-blue") + " text-base px-6 py-2"}
                            onClick={() => {
                                open();
                            }} >
                            <p>{title}</p>
                        </button>
                                
                        <Transition appear show={isOpen} as={Fragment}>
                            <Dialog as="div" className="relative z-10 focus:outline-none" onClose={cancel}>
                                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                                    <div className="flex min-h-full items-center justify-center p-4">
                                        <Transition.Child 
                                            className="w-full flex justify-center"
                                            enter="ease-out duration-300"
                                            enterFrom="opacity-0 transform-[scale(95%)]"
                                            enterTo="opacity-100 transform-[scale(100%)]"
                                            leave="ease-in duration-200"
                                            leaveFrom="opacity-100 transform-[scale(100%)]"
                                            leaveTo="opacity-0 transform-[scale(95%)]"
                                          >
                                            <Dialog.Panel className="w-full flex flex-col items-center sm:w-4/5 rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                                                <Dialog.Title as="h3" className="font-medium button-green-blue px-2 py-1 text-xl">
                                                    {title}
                                                </Dialog.Title>
                                                
                                                <div className="w-full items-center text-sm/6 text-white/50 px-10 mt-2">
                                                    <div className="w-full">
                                                        <TextareaAutosize id="iptPrompt"  
                                                            minRows={10} maxRows={15}
                                                            className="w-full bg-slate-800 text-gray-100 border border-gray-600 focus:ring-green-800 rounded-lg font-medium px-4 py-2 " 
                                                            value={AIPrompt}
                                                            placeholder={loading ?
                                                                `超能大师正在评估您的作品，请稍等候......` :
                                                                `现在让超能摄影大师评估您的作品，并给出画面评价。如果您的作品非常优秀，将会被奖励1-999个${config.creditName}` 
                                                            }                                                        
                                                            readOnly = { true }
                                                            onChange={(e) => {
                                                                // setUserPrompt(e.target.value);
                                                                // setAIPrompt(e.target.value);
                                                            }} />                                            
                                                    </div>
                                                </div>
                
                                                <div className="flex flex-row justify-between px-10 mt-20 w-full">
                                                    <div>
                                                        {loading ? (
                                                        <button className="button-gold px-16 py-2">
                                                            <LoadingDots color="white" style="small" />
                                                        </button>
                                                        ) : (
                                                        <button className={(AIPrompt ? "button-dark" : "button-gold") + " px-8 py-2"} disabled={!!AIPrompt}
                                                            onClick={()=>generate()}
                                                            >                                          
                                                            <span> 开始评价 </span>
                                                        </button>                                                        
                                                        )}
                                                    </div>
    
                                                    <div className="flex flex-row space-x-8 justify-center">
                                                        <button
                                                            className=" px-8 py-2 button-main"
                                                            onClick={() => cancel()}
                                                            >
                                                            关闭任务
                                                        </button>   
                                                    </div>
                                                </div>
                                            </Dialog.Panel>
                                        </Transition.Child>
                                    </div>
                                </div>
                            </Dialog>
                        </Transition>
                    </div>
                </div>
                
            </div>
        );
    }else{
        return (<></>);
    }
*/
        return (<></>);    
}
