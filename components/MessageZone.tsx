import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { signIn, signOut, useSession } from "next-auth/react"
import React, { useEffect, useState } from 'react';



export default function MessageZone({message, messageType="HINT"}: 
                               { message:string, messageType?:string}) {
    let title = "提示";
    let borderColor = "border-red-500";
    let bgColor = "bg-red-100";
    let textColor = "text-red-700";
    messageType = "HINT";
  
    switch(messageType){
        case "HINT":
            title = "操作提示";
            borderColor = "border-green-500";
            bgColor = "bg-green-100";
            textColor = "text-green-700";
            break;
        case "ERROR":
            title = "发生错误";
            borderColor = "border-red-500";
            bgColor = "bg-red-100";
            textColor = "text-red-700";
            break;
    }
    
    return (
        <div className={`${bgColor} ${borderColor} ${textColor} border px-4 py-3 rounded-xl mt-8 max-w-[575px]`} role="alert">
            <div className={`${bgColor} ${borderColor} ${textColor} font-bold rounded-t px-4 py-2`}>
                {title}
            </div>
            <div className={`${bgColor} ${borderColor} ${textColor} border border-1 rounded-b px-4 py-3`}>
                {message}
            </div>
        </div>      
    );
}

