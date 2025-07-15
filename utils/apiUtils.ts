import * as enums from "./enums";
import * as debug from "./debug";
import * as sw from "./sensitiveWords";
import * as fu from "./fileUtils";

import {alertAndWait} from "../components/MessageDialog";

// 访问chat
export async function callChatStream(
    user:any, text:string, imageURL:string, modelId:string,
    onDelta?:(content:string, realContent:string, retMsg:string)=>boolean | void,
    onEnd?:(content:string, realContent:string)=>boolean | void
){
    // 准备输入的数据
    const messages:{role:string, content:any, name:string}[] = [];

    // 压入当前的问题
    messages.push({
        role: "user",
        // content: "请把以下提示词扩充成一个细节丰富的Stable Diffusion生成照片的提示词，要对画质，摄影角度，摄影师，作品的高水平都做出要求：\n" + inputText,
        content: imageURL ? [
          {
            type: "image_url",
            image_url: imageURL
          },
          {
            type: "text",
            text: text,
          }
        ] : text,
        name: user?.id || user?.email || Date.now().toString(),
    });         

    let content = "";
    let realContent = "";
    let realChunk = 0;
    
    try{
        const res = await fetch("/api/chat?CMD=prepareChat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: messages, 
                modelId,
                historyRound: 0,
            }),
        });        
        
        if (res.status === 200) {                
            let response = await res.json();
            // 开始陆续接收内容
            const streamUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/chat?CMD=chatStream&key=${response}`;
            debug.log(streamUrl);
            
            const source = new EventSource(streamUrl);
            source.onmessage = (event) => {
                if(event.data.trim().indexOf('[DONE]') < 0){
                    const retMsg = JSON.parse(event.data);
                    debug.log("Delta:", retMsg.content);
                    if(retMsg.type == "REASON"){
                        realChunk = 0;
                    }else{
                        realChunk ++;
                    }

                    // 加入这一段，reason结束会清空内容，开始显示正式内容
                    if(realChunk > 0){
                        realContent = `${realContent}${retMsg.content}`;                            
                    }
                    content = `${content}${retMsg.content}`;
                    if(typeof onDelta === "function"){
                        onDelta(content, realContent, retMsg.content);
                    }
                }else{
                    debug.log("[DONE]");
                    source.close();
                    if(typeof onEnd === "function"){
                        onEnd(content, realContent);
                    }
                }
            };
            
            //source.addEventListener('message', function (e) {
            //  debug.log(e.data)
            //})   
            
            source.onopen = function(){
                debug.log("event source is opened");
            };
            source.onerror = function(){
                debug.log("sth is wrong");
                if(typeof onEnd === "function"){
                    onEnd(content, realContent);
                } 
            };
            
        }else if(res.status == 201){ 
            if(typeof onEnd === "function"){
                onEnd(content, realContent);
            } 
            return;
        }else if(res.status == 401){
            alert("请先登录，再开始对话");
            fu.safeWindowOpen("/loginChoice", "_blank");
            return;
        }else if(res.status == 402){
            alert("您的余额不足，请先充值，再来尝试哦！");
            fu.safeWindowOpen("/buy-credits", "_blank");
        }else{
            alert("系统发生未知错误，请和管理员联系！");
            return;
        }

    }catch(e){
        alert("系统对话发生未知错误，请和管理员联系");
        debug.error(e);
    }
}

// 访问API的标准调用
export async function callAPI(
    url: string,
    params: any,
    method: string = "POST",
    contentType: string = "application/json"
) {
    let body: any = params || {};

    if (url && url.trim() == "/api/generate") {
        url = "/api/workflowAgent";
        body = {
            cmd: "DEFAULT",
            timeStamp: Date.now(),
            params: params,
        };
    } else {
        if (!body.timeStamp) {
            body.timeStamp = Date.now();
        }
    }

    // 嵌入跟踪客户端信息的代码
    if (typeof window !== "undefined") {
        const screenWidth = window?.screen?.width;
        const screenHeight = window?.screen?.height;
        if (screenWidth && screenHeight) {
            url += `${url.indexOf("?") >= 0 ? "&" : "?"}screenWidth=${screenWidth}&screenHeight=${screenHeight}`;
        }
    }

    const timeout = 3600000; // 1小时
    let res: any;
    const startTime = Date.now();

    try {
        res = await fetchWithTimeout(
            url,
            {
                method,
                headers: {
                    "Content-Type": contentType,
                },
                body: JSON.stringify(body),
            },
            timeout
        );
    } catch (error: any) {
        if (error.name === "AbortError" || error.message?.includes("timeout")) {
            debug.error("请求超时，时间阈值:", timeout);
        } else {
            debug.error("请求失败:", error);
        }
    } finally {
        const endTime = Date.now();
        debug.error(`----执行时间：${endTime - startTime}ms-----`);
    }

    if (!res) {
        return {
            status: enums.resStatus.proxyErr,
            result: null,
        };
    }

    let result: any = null;
    let txt: string = "";
    const status = typeof res.status === "number" ? res.status : enums.resStatus.unknownErr;

    try {
        txt = await res.text();
        result = JSON.parse(txt);
    } catch (err) {
        debug.error("callAPI exception:", err);
        if (txt) {
            debug.error("callAPI got TEXT:", txt);
            result = txt;
        }
    }

    return {
        status,
        result,
    };
}


// 访问AI服务器的标准调用，智能在前端访问，不要在后台使用
export async function callAPI2(
    endpoint:string, 
    params:any, 
    funcName: string,
    resultType: string,
    setLoading?:(status:boolean)=>void,
    onSuccess?:(ret:any)=>void,
    onFailed?:(ret:any)=>boolean | void,
){
    let resultName = "作品"; // 但后面完全没用    
    let res:any;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if(setLoading){setLoading(true)}  
    let segment = resultType;
    switch(resultType){
        case "PHOTO":
        case "IMAGE": segment="PHOTO"; resultName="图片"; break;
        case "VIDEO": segment="VIDEO"; resultName="视频"; break;
        case "AUDIO":
        case "MUSIC":
        case "VOICE": segment="VOICE"; resultName="音频"; break;
    }            
            
    try{
        res = await callAPI(endpoint, params);        
        if (res && res.status == 200) {
            //mutate();
            if(res?.result?.generated){
                if(res.result.audit == "P"){
                    // alert("生成的内容不符合社区规定，");
                }
                if(onSuccess){
                    // 唯一成功路径
                    onSuccess(res);
                }
            }else{
                alert(`${funcName}操作执行失败，没有生成任何内容`);
                if(onFailed){ onFailed(res); }
            }
        }else{
            let errorHandled:boolean | void = false;
            if(onFailed){ 
                errorHandled = onFailed(res); 
            }
            if(!errorHandled){
                switch(res.status){
                    case enums.resStatus.inputNSFW:
                        alert("您的输入内容敏感，不符合规范，无法为您处理！");
                        break;
                    case enums.resStatus.tooMuchWaiting:
                        alert("您启动的任务太多了，请等待这些任务执行完之后再启动新任务！");
                        break;
                    case enums.resStatus.serviceLineError:
                        alert("服务发生临时故障，请稍后重试！");
                        break;                        
                    case enums.resStatus.unexpRetryErr:
                    case enums.resStatus.waitForResult:
                    case enums.resStatus.proxyErr:
                        alert("AI服务需要较长时间运行，请稍后点击左下角用户头像到我的空间里查看结果。");    
                        window.location.href = `/dashboard?segment=${segment}&page=1`;  
                        break;
                    case enums.resStatus.unauthErr:
                        alert("您还没有登录，请先点左下角[登录]按钮，极简注册哦！");
                        break;
                    case enums.resStatus.lackCredits:
                        alert(`您的余额已经不足了，请您先充值，再尝试操作哦！`);
                        window.location.href = "/buy-credits";
                        break;
                    case enums.resStatus.NSFW:
                        alert("您生成的内容不适合展示，请避免使用敏感或不雅的信息！");
                        break;
                    case enums.resStatus.unExpErr:
                        if(res?.result){
                            alert(sw.filterWords(JSON.stringify(res?.result)));                        
                        }else{
                            alert("很抱歉，系统无法处理您本次的服务请求，请更换输入内容再尝试。如果重复出现，请和客服人员联系！");
                        }
                        break;
                    default:
                        try{
                            if(res?.result){
                                alert(sw.filterWords(JSON.stringify(res?.result)));
                            }else{
                                alert("您的操作没有返回正确结果，请稍后重试......");
                            }
                        }catch(e){
                            alert("您的操作发生错误，没有返回正确结果，请稍后重试......");
                        }
                }
            }
        }     
    }catch(e:any){
        if(onFailed){ onFailed(res); }
        debug.error(e);
        if (e.name === "AbortError" || e.message?.includes("timeout")) {
            alertAndWait("本次AI服务需要较长时间运行，请稍后点击左下角用户头像到我的空间里查看结果。", () => {
                // 用户关闭后才会执行
                // 添加微小延迟确保用户体验
                setTimeout(() => {
                    window.location.href = `/dashboard?segment=${segment}&page=1`;
                }, 2000);           
            });
            //await alert("AI服务器需要较长时间运行，请稍后点击左下角用户头像到我的空间里查看结果。");    
            //window.location.href = `/dashboard?segment=${segment}&page=1`;              
        }else{
             //alert(e);
             //alert(String(e));
             await alert(`很抱歉，${funcName}操作执行发生意外失败，请点击左下角头像进入我的空间查看生成结果！如果重复发生同样错误，请和系统管理员联系`);
        }
    }finally{
        setTimeout(() => {
            if (typeof setLoading === "function") {
                setLoading(false);
            }
        }, 1000);     
    }
    
    return(res);
}


export async function fetchWithTimeout(url:string, options:any, timeout:number = 30000){ // 默认超时时间为30秒
    const controller = new AbortController(); // 创建一个新的AbortController
    const id = setTimeout(() => controller.abort(), timeout); // 设置超时时间，超时则中断fetch请求

    const response = await fetch(url, {
        ...options,
        signal: controller.signal // 添加signal到fetch选项中
    }).catch(e => {
        if (e.name === 'AbortError' || e.message?.includes("timeout")) {
            e.isTimeout = true;
        }
        throw e;
    });

    clearTimeout(id); // 如果请求完成，清除定时器
    return response;
};
