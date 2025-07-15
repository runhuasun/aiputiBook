import React, { useEffect, useState } from 'react';
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import LoginDialog from "../components/LoginDialog";
import {SparklesIcon as InspireIcon} from '@heroicons/react/24/solid';
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";


interface Props {
    config: any;
    title?: string;
    onStart?: ()=> void;
    className?: string;
    disabled?: boolean;
    isMini?: boolean;
    
    loading?: boolean;   
    minTime?:number;
    maxTime?:number;
    timeUnit?:string;
    loadingTitle?: string;
    
    showPrice?: boolean;
    funcCode?: string;
    model?: any;
    units?: number;
    unitName?: string;
}


export default function StartButton({config, title="开始", onStart, className, disabled=false, isMini=false, 
                                     loading=false, minTime=30, maxTime=60, timeUnit="秒", loadingTitle,
                                     showPrice=false, funcCode, model, units, unitName}:Props){
    const [showLogin, setShowLogin] = useState<boolean>(false);
    const [refreshTime, setRefreshTime] = useState<number>(Date.now());
    
    const { data: session, status } = useSession();
    const mainClass = isMini ? 
        `flex flex-col items-center ${disabled ? "button-dark" : "button-gold"} rounded-xl px-6 py-2 text-sm ${className}`
        :
        `flex flex-col items-center ${disabled ? "button-dark" : "button-gold"} rounded-xl px-16 py-3 text-base ${className}`;

    return (
        <div className= "flex flex-col space-y-2 items-center">
            {showPrice && status === "authenticated" && (
                <PriceTag config={config}  model={model} units={units} unitName={unitName} refreshTime={refreshTime} funcCode={funcCode}/>
            )}  
            {loading ? (
                <LoadingButton minTime={minTime} maxTime={maxTime} timeUnit={timeUnit} isMini={isMini} title={loadingTitle}/>
            ):(            
            <div className={mainClass}>
                <button disabled={disabled}
                    onMouseDown={(e) => {
                        if (status != "authenticated") {
                            setShowLogin(true);
                        } else {
                            if (typeof onStart == "function") {
                                onStart();
                            }
                        }
                    }}
                    className="flex items-center space-x-2">
                    <InspireIcon className="w-5 h-5 text-inherit" />
                    <span>{title}</span>
                </button>
                
                {showLogin && (
                <LoginDialog config={config} isOpened={showLogin} 
                    onOK={()=>{
                        setShowLogin(false);
                        setRefreshTime(Date.now());
                    }} 
                    onCancel={()=>setShowLogin(false)}
                    />
                )}            
            </div>        
            )}
        </div>
    );
}
