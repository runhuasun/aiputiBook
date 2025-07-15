import * as debug from "./debug";

export function isMobile(): boolean {
    try{
        if(typeof navigator !== "undefined"){
            const userAgent = navigator.userAgent.toLowerCase();
            return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        }
    }catch(e){
        debug.log("is Mobile exception:", e);
    }
    return false;
}

export function isWeixinBrowser(): boolean {
    try{
        if(typeof navigator !== "undefined"){
            var ua = navigator.userAgent.toLowerCase();
            return /micromessenger/.test(ua);
        } 
    }catch(e){
        debug.error("is WexinBrowser Error:", e);
    }
    return false;
}
