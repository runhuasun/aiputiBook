const debugLevel = process.env.DEBUG_LEVEL || "LOG";

function anyToString(...txt:any){
    if(typeof txt == "object"){
        try{
            if(Array.isArray(txt)){
                let ret = "";
                for(const sub of txt){
                    ret += JSON.stringify(sub) + "\n\n";
                }
                return ret;
            }else{
                return JSON.stringify(txt);
            }
        }catch(e){
            return txt;
        }
    }
    return txt;
}

export function log(...content:any){
    if(debugLevel == "LOG"){
        console.log(getTimeNow(), "|", content);
    }
}

export function warn(...content:any){
    if(debugLevel == "LOG" || debugLevel == "WARN"){
        console.warn(getTimeNow(), "|", content);
    }
}

export function error(...content:any){
    if(debugLevel == "LOG" || debugLevel == "WARN" || debugLevel == "ERROR"){
        console.error(getTimeNow(), "|", content);
    }
}

function getTimeNow(){
    const now = new Date();
    return now.toLocaleString('en-US', { 
        day: 'numeric',        
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false  // 使用24小时制
        })
}

