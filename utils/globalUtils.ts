import Redis from 'ioredis';

export type globalType =
  | "WECHAT_SERVICE"
  | "APPLICATION_CONFIG"
  | "EMB_CACHE"
  | "GENERATE"
  | "WORKFLOW_AGENT"
  | "VOICE_CACHE"
  | "ALIYUN"
  | "TRANSLATE_CN_EN"
  | "GLOBAL_VALUE"
  | "GLOBAL_WAITING_LIST"
  | "SIMPLE_AGENT"
;


export async function globalSet(type:globalType, key:string, val:string){
    return await _globalSet(type.toString() + key, val);
}
async function _globalSet(key:string, val:string){
    try{
        const globalKeyMap = new Redis();
        await globalKeyMap.set(key, val);
        globalKeyMap.disconnect();
    }catch(e){
        console.error("设置全局变量时发生错误。key：" + key + "\n" + e);
        return false;
    }
    return true;
}


export async function globalGet(type:globalType, key:string){
    return await _globalGet(type.toString() + key);   
}
async function _globalGet(key:string){
    try{
        const globalKeyMap = new Redis();    
        const val = await globalKeyMap.get(key);
        globalKeyMap.disconnect();     
        return val;
    }catch(e){
        console.error("获得全局变量时发生错误。key：" + key + "\n" + e);
        return null;
    }
}


export async function globalDel(type:globalType, key:string){
    return await _globalDel(type.toString() + key);
}
async function _globalDel(key:string){
    try{
        const globalKeyMap = new Redis();    
        await globalKeyMap.del(key);
        globalKeyMap.disconnect();
        return true;
    }catch(e){
        console.error("删除全局变量时发生错误。key：" + key + "\n" + e);
        return false;        
    }
}



export async function globalGetAndDel(type:globalType, key:string){
    return await _globalGetAndDel(type.toString() + key);
}
async function _globalGetAndDel(key:string){
    try{
        const globalKeyMap = new Redis();   
        const val = await globalKeyMap.get(key);
        await globalKeyMap.del(key);
        globalKeyMap.disconnect();
        return val;
    }catch(e){
        console.error("获取并删除全局变量时发生错误。key：" + key + "\n" + e);
        return null;        
    }
}
