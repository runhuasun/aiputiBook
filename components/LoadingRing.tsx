import React from 'react';
import { Rings } from 'react-loader-spinner'; 
import * as du from "../utils/deviceUtils";


export default function LoadingRing(){
    return (
        <div className="max-w-[670px] h-[250px] flex justify-center items-center">
            {(du.isMobile() || du.isWeixinBrowser()) ? (
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-white"></div>
            ):(
            <Rings
                height="200"
                width="200"
                color="white"
                radius="6"
                wrapperStyle={{}}
                wrapperClass=""
                visible={true}
                ariaLabel="rings-loading"
                />
            )}
        </div>
    );
}
