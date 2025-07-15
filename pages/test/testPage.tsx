 declare global {
  interface Window {
    WeixinJSBridge: any;
  }
}   
import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import * as qr from 'qr-image';
import Link from "next/link";
import prisma from "../../lib/prismadb";
import { Room, User } from "@prisma/client";
import { RoomGeneration } from "../../components/RoomGenerator";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import SquigglyLines from "../../components/SquigglyLines";
import { useEffect, useState } from "react";
import { useDropzone } from 'react-dropzone';
import { useCallback } from 'react';

import Image from "../../components/wrapper/Image";
import {showRoom} from "../../components/Genhis";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import React from 'react';
import { isMobile } from "react-device-detect";
import { Request } from 'express';
// import EventSource from 'eventsource';
import { EventSourcePolyfill as ES } from "event-source-polyfill";
// import { NativeEventSource as ES } from "event-source-polyfill";
// import { EventSource } from "event-source-polyfill";
import TextareaAutosize from "react-textarea-autosize";
import {embeddingText, cosineSimilarity} from "../../utils/embedding";
import cheerio from 'cheerio';
import {parseStructure, parseToSentences} from "../../utils/parser";
import https from 'https';
import Uploader from "../../components/Uploader";

// import {uploadFile} from "../../utils/OSS";
// import {moveToCOS} from "../../utils/COSUtils";
// require('tui-image-editor/dist/tui-image-editor.css');
// const ImageEditor = require('@toast-ui/react-image-editor');
const myTheme = {
  // Theme object to extends default dark theme.
};

function getClientIP(req: Request): string {
    // @ts-ignore
    const ipAddress = req?.headers["x-forwarded-for"]?.split(",")[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection as any)?.socket?.remoteAddress;
    return ipAddress;
}

export function isWeixinBrowser() {
    var ua = navigator.userAgent.toLowerCase();
    return (/micromessenger/.test(ua)) ? true : false;
}    

export async function getServerSideProps(ctx: any) {
    console.error("getServerSideProps");
    /*
    const eventSourceInitDict = { 
    headers: { 
    "Content-Type": "application/json",
    'Transfer-Encoding': 'chunked',
    },
    method: 'POST',    
    body: JSON.stringify({
    "messages": [{"role": "user",
    "content": "hello world",
    "name": "nobody",
    }], 
    "modelId":"12345"
    }),    
    };

    const source = new ES('https://www.aiputi.cn/api/testAPI?date=' + Date.now());
    source.onmessage = (event) => {
        console.error(JSON.stringify(event));
        if(event.data.trim().indexOf('[DONE]') < 0){

         console.log(event.data);
        }else{
          console.error("[DONE]");
          source.close();
        }
    };
 
 */

    return {
        props:{ 
            weixinAppId: process.env.WECHAT_APP_ID,
            clientIP: getClientIP(ctx.req),
        }
    };  
}






export default function testPage({ weixinAppId, clientIP }: { weixinAppId: string, clientIP: string } ) {
    
    const { data: session } = useSession();
    //  const fetcher = (url: string) => fetch(url).then((res) => res.json());
    //  const { data, mutate } = useSWR("/api/remaining", fetcher);
    const [text1, setText1] = useState("");
    const [text2, setText2] = useState("");    
    const [regIn, setRegIn] = useState("");
    const [regOut, setRegOut] = useState("");
    const [regSign, setRegSign] = useState("章,条");
    const [cosSim, setCosSim] = useState(0);
    const [url, setUrl] = useState("");

 
    function testReg(){
        let result = "";        
        let arr: string[][] = parseStructure(regIn, regSign);
        
        if(arr){
            for(const row of arr){
                for(const cell of row){
                    result += cell + "  |  ";
                }
                result += "\n\n";
            }
            setRegOut(result);
        }
    }


    async function compare(){
        const res = await fetch("/api/testAPI", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                cmd: "compareEmb",
                text1: text1,
                text2: text2,
            }),
        });
        
        const result = await res.json();
        setCosSim(result.sim);
    }

    
    async function startWechaty(){
        const res = await fetch("/api/testAPI", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                cmd: "startWechaty",
            }),
        });
        const result = await res.json();
    }
 

    function wechatLogin(){
        window.location.href="https://open.weixin.qq.com/connect/qrconnect?appid=" 
            + weixinAppId 
            + "&redirect_uri=https://aiputi.cn&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect";
    }

    
    async function testESD(){ 
        const url = window.location.protocol + "//" + 
            window.location.hostname + ":" + 
            window.location.port + '/api/testAPI?CMD=testEventSource&date=' + Date.now();
        
        console.log("url:" + url);
        
        const source = new ES(url);
        //    { withCredentials: true }

        source.addEventListener('message', function(event) {
            console.log('New message:', event.data);
            const p = document.querySelector('#pStream');
            if(p){
                if(event.data.indexOf('[DONE]') < 0){
                    p.innerHTML += event.data; 
                }else{
                    source.close();
                }
            }             
        });
        
        source.addEventListener('chunk', function(event) {
            console.log("chunk:" + event);            
        });   
        
        source.addEventListener('error', function(event) {
            console.error('Error occurred:', event);
        });  
/*
        source.onmessage = (e) => {
            console.log(e.data);
            const p = document.querySelector('#pStream');
            if(p){
                if(e.data.trim().indexOf('[DONE]') < 0){
                    p.innerHTML += e.data; 
                }else{
                    source.close();
                }
            }
        };
        source.onopen = () => {
            console.log("eventsource opened");
        };
   */     
    }        

    
/*
    const headers = {
        'Content-Type': 'application/json',
         'Transfer-Encoding': 'chunked',
        //'Content-Type': 'text/event-stream',
        //"Authorization": token,
    };
      
    const options = {  
        hostname: window.location.hostname,  
        path: '/api/testAPI?date=' + Date.now(),  
        port: window.location.port,
        method: 'POST',  
        headers: headers,
    };        
    
    const req_ai = https.request(options, (res_ai) => { 
        // 在这里处理接收到的数据         
        res_ai.on('data', (event) => {  
            console.log("---------------begin-----------------------");
            console.log("-----delta------\n" + event);   
            console.log("----------------end------------------------");    
            
            const p = document.querySelector('#pStream');
            if(p){
                if(event.data.trim().indexOf('[DONE]') < 0){
                    p.innerHTML += event.data; 
                    console.log(event.data);
                }else{
                    console.error("[DONE]");
                }
            }
        });
    });

    req_ai.write("{}");
    req_ai.end();
*/
    // alert('testESD');
 /*
   const eventSourceInitDict:EventSourceInit  = { 
    headers: { 
       "Content-Type": "application/json",
         'Transfer-Encoding': 'chunked',
    
    },
     method: 'POST',    
     body: JSON.stringify({
       "messages": [{"role": "user",
              "content": "hello world",
              "name": "nobody",
              }], 
      "modelId":"12345"
     }),   
   };

   */

/*
    const socket = new WebSocket( "wss://debug.aiputi.cn/api/testAPI" );
    socket.onopen = ()=>{
        console.log("websocket open！");
    }

    socket.onmessage = (event)=>{
        console.log(event.data);
    }

    socket.onerror = (event)=>{
        console.error("websorcket error:" + event);
    }

*/
 


////////////////////////////////////////////////////////////////                                  
// 处理微信支付                                
////////////////////////////////////////////////////////                                  
async function startWeixin() {
    if(!session?.user?.email){
      alert("请先登录AI菩提，再发起微信支付！");
      return;
    }

    let CMD="";
    if(isMobile){
  
     if(window.WeixinJSBridge){
      // alert("微信支付目前只在微信浏览器内支持，其它浏览器请使用支付宝支持！");
      CMD = "NEW_ORDER_JSAPI";
     }else{
      CMD = "NEW_ORDER_H5";
     }
    }else{
      CMD = "NEW_ORDER_PC";
    }
 
    const res = await fetch("/api/wechatPay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
          cmd: CMD,
          money: 1,
          credits: 1,
          openid: session?.user?.email,  // "oizfn6GULmGjzh4bKeiahJjO2NRI", 
          clientIP: clientIP,
      }),
    });
    const result = await res.json();
    if(res.ok){
     if(CMD == "NEW_ORDER_JSAPI"){
      const prepay_id = result.prepay_id;
      openWepay(prepay_id);
     }else if(CMD == "NEW_ORDER_H5"){
      const h5_url = result.h5_url;
      window.location.href = h5_url;
     }else if(CMD == "NEW_ORDER_PC"){
      const code_url = result.code_url;
      showQRCode(code_url);
     }
    }

}    

function showQRCode(code_url:string){
 alert(code_url);
  // 生成二维码图片
  const codeUrl = code_url;
const qrImage = qr.imageSync(codeUrl, { type: 'png', size: 5 });

  // 将二维码图片转成 base64 字符串
  const base64QR = qrImage.toString('base64');
  const dataURI = 'data:image/png;base64,' + base64QR;
 
  // 在浏览器中显示二维码图片
  const img = document.createElement('img');
  img.src = dataURI;
  document.body.appendChild(img); 

}


 
async function openWepay(prepay_id: string){

    const appId = weixinAppId;
    const timestampNow = (Date.parse(new Date().toString()) / 1000).toString();
    const noncestr = "fsafsaewerg7889gh67hegvbsdfge";  
    const packageStr = "prepay_id="+prepay_id;

    const signStr = appId + "\n" + timestampNow + "\n" + noncestr + "\n" + packageStr + "\n";
//    alert(packageStr);
    alert(signStr);
    const paySign = await signature(signStr);
    if(paySign == ""){
      alert("发起微信支付时，数据签名失败！");
      return;
    }else{
      alert(paySign);
    }
  
    window.WeixinJSBridge.invoke('getBrandWCPayRequest', {
        "appId":  appId,     //公众号ID，由商户传入     
        "timeStamp": timestampNow,     //时间戳，自1970年以来的秒数     
        "nonceStr": noncestr,      //随机串     
        "package": packageStr,
        "signType": "RSA",     //微信签名方式：     
        "paySign": paySign //微信签名 
    },
   // @ts-ignore
    function(res) {
        if (res.err_msg == "get_brand_wcpay_request:ok") {
            // 使用以上方式判断前端返回,微信团队郑重提示：
            //res.err_msg将在用户支付成功后返回ok，但并不保证它绝对可靠。
          alert("微信支付成功");
        }
    });
}
 
async function signature(url: string): Promise<string>{
    const res = await fetch("/api/wechatPay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
          cmd: "SIGNATURE",
          url: url,
      }),
    });

    if(res.ok){
      return await res.json();
    }else{
      return "";
    }
}
/*
async function onBridgeReady() {
  openWepay(prepayId);
} 
 

useEffect(() => {


 
  if (typeof window.WeixinJSBridge == "undefined") {
      if (document.addEventListener) {
          document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
      } else if ((document as any).attachEvent) {
          (document as any).attachEvent('WeixinJSBridgeReady', onBridgeReady);
          (document as any).attachEvent('onWeixinJSBridgeReady', onBridgeReady);
      }
  } else {
      onBridgeReady();
  }
   
}, []);

*/

async function uploadToOSS(){
 
     const res = await fetch("/api/testAPI", {
         method: "POST",
         headers: {
             "Content-Type": "application/json",
         },
         body: JSON.stringify({ 
             cmd: "uploadToOSS",
             url: url,
         }),
     });
     
     const result = await res.json();
}


 async function uploadToCOS(){
     const res = await fetch("/api/testAPI", {
         method: "POST",
         headers: {
             "Content-Type": "application/json",
         },
         body: JSON.stringify({ 
             cmd: "uploadToCOS",
             url: url,
         }),
     });
     
     const result = await res.json();
}

    function updateFiles(files:any[]){

        for(const file of files){
            if(url){
                setUrl(url + ";" + file.uploadedUrl);
            }else{
                setUrl(file.uploadedUrl);
            }
        }
        
    }

  return (
    <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
      <Head>
        <title>AI菩提</title>
        <script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
      </Head>
      <Header/>
       
           
       
      <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">
        <h1 className="mx-auto max-w-4xl font-display text-3xl font-bold tracking-normal py-2 text-white mb:50 sm:text-4xl">
          实验功能页
        </h1>   

       {/*       
  <ImageEditor
    includeUI={{
      loadImage: {
        path: 'https://aiputi.oss-cn-beijing.aliyuncs.com/G/2024/5/23/1dQ6d.png',
        name: 'SampleImage',
      },
      theme: myTheme,
      menu: ['shape', 'filter'],
      initMenu: 'filter',
      uiSize: {
        width: '1000px',
        height: '700px',
      },
      menuBarPosition: 'bottom',
    }}
    cssMaxHeight={500}
    cssMaxWidth={700}
    selectionStyle={{
      cornerSize: 20,
      rotatingPointOffset: 70,
    }}
    usageStatistics={true}
  />

 */}      
       <div className="justify-center w-full py-10 space-x-5 flex flex-row" >
        <Uploader setFiles = { (files) => updateFiles(files) }></Uploader>
       </div>

       
         <div className="justify-center w-full py-10 space-x-5 flex flex-row" >
             <TextareaAutosize id="url"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-1/3 text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={url}
                  onChange={(e) => {
                      setUrl(e.target.value);
                    }
                  }
                />    
        </div>
       
         <div className="py-10 space-x-5 flex flex-row" >
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                uploadToOSS();
              }} >
             <span>测试OSS上传文件</span>
          </button> 
        </div>

          
         <div className="py-10 space-x-5 flex flex-row" >
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                uploadToCOS();
              }} >
             <span>测试COS上传文件</span>
          </button> 
        </div>
       
       
       
         <div className="py-10 space-x-5 flex flex-row" >
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                startWechaty();
              }} >
             <span>开始监听个人微信</span>
          </button> 
        </div>
       
         <div className="py-10 space-x-5 flex flex-row w-1/4">
             <TextareaAutosize id="regSign"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-full text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={regSign}
                  onChange={(e) => {
                      setRegSign(e.target.value);
                    }
                  }
                /> 
         </div>
          
         <div className="py-10 space-x-5 flex flex-row w-full">
             <TextareaAutosize id="regIn"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-1/2 text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={regIn}
                  onChange={(e) => {
                      setRegIn(e.target.value);
                    }
                  }
                />                   
             <TextareaAutosize id="regOut"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-1/2 text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={regOut}
                  onChange={(e) => {
                      setRegOut(e.target.value);
                    }
                  }
                /> 
             

        </div>
         <div className="py-10 space-x-5 flex flex-row" >
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                testReg();
              }} >
             <span>测试正则表达式</span>
          </button> 
        </div>

       
         <div className="py-10 space-x-5 flex flex-row w-full">
             <TextareaAutosize id="text1"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-1/3 text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={text1}
                  onChange={(e) => {
                      setText1(e.target.value);
                    }
                  }
                />                   
             <TextareaAutosize id="text2"  
                  style={{ borderRadius: "8px", borderColor:'green'}  }        
                  rows={2} maxRows={10}
                  className="bg-white w-1/3 text-black border border-greean-400 font-medium px-4 py-2 " 
                  value={text2}
                  onChange={(e) => {
                      setText2(e.target.value);
                    }
                  }
                />                   

        </div>
         <div className="py-10 space-x-5 flex flex-row" >
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                compare();
              }} >
             <span>比较相似度</span>
          </button> 
          余玄相似度是：{cosSim}
        </div>
        <div className="py-10 space-x-5" >
          
           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                startWeixin();

              }} >
             <span>微信</span>
          </button>       

           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                testESD();

              }} >
             <span>异步数据</span>
          </button> 

           <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
              onClick={() => {
                wechatLogin();

              }} >
             <span>微信登录</span>
          </button> 

         
          <p id="pStream" className="text-xl text-white fond-bold">
           测试数据在这里：
          </p>         
        </div>
      </main>
      <Footer />
    </div>
  );
}
