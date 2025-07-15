import React from 'react';
import { useEffect, useState } from "react";
import { config } from "../utils/config";
import LoginPage from "../components/LoginPage";
import * as monitor from "../utils/monitor";


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    return {
        props:{ 
            config
        }
    };  
}


export default function loginChoice({ config }: { config:any} ){
    
    useEffect(() => {
        const url = new URL(window.location.href);
        if(url.hostname != config.domainName){            
            url.hostname = config.domainName;
            window.location.href = url.toString();
        }
    }, []);
    
    return (
        <LoginPage config={config}/>
    );
};
