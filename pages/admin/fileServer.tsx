import Head from "next/head";
import { useSession, signIn } from "next-auth/react";
import React from 'react';
import useSWR from "swr";
import Link from "next/link";
import prisma from "../../lib/prismadb";
import { Room, User } from "@prisma/client";
import { RoomGeneration } from "../../components/RoomGenerator";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";


import SquigglyLines from "../../components/SquigglyLines";
import { useEffect, useState } from "react";
import {showRoom} from "../../components/Genhis";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingButton from "../../components/LoadingButton";
import Image from "../../components/wrapper/Image";

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // 引入日期选择器的样式文件


import {config} from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import LoginPage from "../../components/LoginPage";
import * as ru from "../../utils/restUtils";





export default function fileServer({ config }: { config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [startDate, setStartDate] = useState<any>(new Date());
    const [endDate, setEndDate] = useState<any>(new Date());
    
    async function clearRoom(){
        const confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(confirmed){
            const res = await callAPI(
                "/api/adminFileServer", 
                { 
                    cmd:"PHYSICAL_CLEAR_ROOM", 
                    params:{
                        startDate,
                        endDate
                    }
                });
            alert(JSON.stringify(res));          
        }
    }

    async function clearUserFile(){
        let confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(!confirmed){
            return;
        }
        if(confirmed){
            const res = await callAPI(
                "/api/adminFileServer", 
                { 
                    cmd:"PHYSICAL_CLEAR_USERFILE", 
                    params:{
                        startDate,
                        endDate
                    }
                });
            alert(JSON.stringify(res));          
        }
    }

    async function clearAllUserFile(){
        let confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(!confirmed){
            return;
        }
        confirmed = await confirm("提醒：这将删除选择事件范围内所有的用户上传文件，请谨慎检查！！！！！");
        if(!confirmed){
            return;
        }
        
        if(confirmed){
            const res = await callAPI(
                "/api/adminFileServer", 
                { 
                    cmd:"PHYSICAL_CLEAR_ALL_USERFILE", 
                    params:{
                        startDate,
                        endDate
                    }
                });
            alert(JSON.stringify(res));          
        }
    }    

    async function clearNoPaymentUserRoom(){
        let confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(!confirmed){
            return;
        }
        confirmed = await confirm("提醒：这样会删除大量未付费用户的作品，请谨慎！！！！");
        if(!confirmed){
            return;
        }
        
        if(confirmed){
            const res = await callAPI(
                "/api/adminFileServer", 
                { 
                    cmd:"PHYSICAL_CLEAR_NO_PAYMENT_USER_ROOM", 
                    params:{
                        startDate,
                        endDate
                    }
                });
            alert(JSON.stringify(res));          
        }
    }

    async function clearNoPaymentUserFile(){
        let confirmed = await confirm("提醒：一旦将会有很大操作量，长时间等待？");
        if(!confirmed){
            return;
        }
        confirmed = await confirm("提醒：这样会删除大量未付费用户的文件，请谨慎！！！！");
        if(!confirmed){
            return;
        }
        
        if(confirmed){
            const res = await callAPI(
                "/api/adminFileServer", 
                { 
                    cmd:"PHYSICAL_CLEAR__NO_PAYMENT_USERFILE", 
                    params:{
                        startDate,
                        endDate
                    }
                });
            alert(JSON.stringify(res));          
        }
    }    
    
    if(status == "authenticated"){
        
        return (
            <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
                <Header config={config} title="清理删除的文件"/>
           
                <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">
                    <div className="w-full space-y-5 flex flex-col items-center max-w-lg">
                        <div className="w-full max-w-lg space-x-5 items-center">
                            <DatePicker
                                className="text-black"
                                selected={startDate}
                                onChange={(newDate)=>setStartDate(newDate)}
                                placeholderText="开始日期"
                                />                      
                            <DatePicker
                                className="text-black"                                
                                selected={endDate}
                                onChange={(newDate)=>setEndDate(newDate)}
                                placeholderText="结束日期"
                                />                      
                        </div>    
                        <button onClick={() => { clearRoom() }} className="button-main px-5 py-2">
                        开始清理标记删除的ROO
                        </button>
                        <button onClick={() => { clearUserFile() }} className="button-main px-5 py-2">
                        开始清理标记删除或未登录的USERFILE
                        </button>

                        <button onClick={() => { clearNoPaymentUserRoom() }} className="button-main px-5 py-2">
                        开始清理未付费用户的Room
                        </button>
                        <button onClick={() => { clearNoPaymentUserFile() }} className="button-main px-5 py-2">
                        开始清理未付费用户的UserFile
                        </button>


                        <button onClick={() => { clearAllUserFile() }} className="button-main px-5 py-2">
                        开始清理时间范围内所有的USERFILE
                        </button>
                        
                    </div>
                </main>
    
                <Footer />
            </div>
        );
    }else{
        return(
            <LoginPage config={config}/>
        );        
    }
}

export async function getServerSideProps(ctx: any) {
    return {
        props: {
            config
        },
    };      
}
