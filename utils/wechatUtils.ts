import crypto from "crypto-js";
// import wx from "wx-jssdk-ts";
import type { NextApiRequest, NextApiResponse } from "next";
// var wx = require('weixin-js-sdk-ts');
// import wx from "weixin-sdk-js";
// import wx from "weixin-js-sdk-ts";
import jsrsasign from "jsrsasign";

// 全局变量定义
export let access_token : string;
export let access_tokenExpTime : number;

export let jsapi_ticket : string ;
export let jsapi_ticketExpTime : number;

export let noncestr: string = "Wm3WZYTPz0wzccnW";


export function isWeixinBrowser() {
    var ua = navigator.userAgent.toLowerCase();
    return (/micromessenger/.test(ua)) ? true : false;
}  



export async function configWX(url:string){
    console.error("----configWX-----");
    const res = await fetch("/api/wechat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cmd:"SIGNATURE", url:url}),
    });

    const sig = await res.json();
    
    console.error(res);
//    alert("config");
//    alert(wx);
//    console.error(wx);
/*   import("weixin-js-sdk-ts").then((wx)=>{
     wx.config({
       debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
       appId: process.env.WECHAT_APP_ID ? process.env.WECHAT_APP_ID : "", // 必填，公众号的唯一标识
       timestamp: sig.timestamp, // 必填，生成签名的时间戳
       nonceStr: sig.noncestr, // 必填，生成签名的随机串
       signature: sig.signature,// 必填，签名
       jsApiList: [
             'updateAppMessageShareData',
             'updateTimelineShareData',
             'onMenuShareAppMessage',
             'chooseWXPay'
             ] ,// 必填，需要使用的JS接口列表
       openTagList: [
            'wx-open-launch-app'
        ],
    });

//  });
*/    

}

export async function getUnionID(openid: string){
    const token = await getAccessToken();
    const url =  "https://api.weixin.qq.com/cgi-bin/user/info?access_token=" + token + "&openid=" + openid + "&lang=zh_CN";
    console.log("getUnionID url:" + url);

    const result = await fetch(
        url, 
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },            
        });
    const ret = await result.json();
    console.log("getUnionID ret" + JSON.stringify(ret));
    return ret.unionid;
}

export async function getAccessToken(){
    console.error("-----get getAccessToken------");

    const now = Date.parse(new Date().toString());    

    if(!access_token || !access_tokenExpTime  || (now>=access_tokenExpTime)){
        const result1 = await fetch("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + 
            process.env.WECHAT_APP_ID + "&secret=" + process.env.WECHAT_APP_SECRET  , {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
         });
  // {"access_token":"ACCESS_TOKEN","expires_in":7200}
        const ret1 = await result1.json();
        access_token = ret1.access_token;
        access_tokenExpTime = now + ret1.expires_in * 1000;
   }
    return access_token;
}

export async function getSapiTicket(){
    console.error("-----get getSapiTicket------");

    const now = Date.parse(new Date().toString());    

    if(!jsapi_ticket || !jsapi_ticketExpTime || (now>=jsapi_ticketExpTime)){

        const accessToken = await getAccessToken();
        const result = await fetch("https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token="+accessToken+"&type=jsapi"  , {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
         });
        const ret = await result.json();
        jsapi_ticket = ret.ticket;
        jsapi_ticketExpTime = now + ret.expires_in * 1000;
   }

    return jsapi_ticket;
}



export async function getSignature( signStr:string ) {
    
    let rsa = new jsrsasign.RSAKey() 
    // SHA256withRSA私钥
    const k = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3UhNw172uVPWy
16WAgph0GzEg/YrPwdBdx2MLGEaNWiZSSOYsMXTade1dTljksb4uJ62EA8aIv+fF
6qUouwevj04iERc4Y2SLizomMupqnhO/ym4FOq//+pNUcG3qkE6fouA81X5GaJXm
hx1TGJtUcGKPfEWgGZhB06tQSM8Pjh+EM56K28s2iTWDGIT7mPoFmybh1HjFFOVG
aHFPlygIbBcSD9TXpRtXEnNuIa8L2JUdd1yTIMDPL4apSjg8fjbWX4JYYVqYi+lf
K2fTwz8u/TzddyUHRozzReT+XiTJCZcg3n/BUjETFS0G+abos3zCM2/cTXi0LYzx
JzUYMLytAgMBAAECggEADuAkH7YB+FGAloCVN3ZhdJp4RBsO1oj9pX52dQIFR5cX
IPo1Y0SoHMoQ9s9Su0wJCKnDlMDRrWsVHaRKvqFeoEpapr0IS1UVZZVopIzhJMGr
DJcakmYOvhDRP7rX0H7hQmbvF0CjvIbkEw7HvGR0xkdQWCBXbgRlrIHGlv8xfiuB
Db0LSRMqawOhH1PZiGAiAQPitEtYKgCgnLr/G0YfL1R6QyHPIhXExEFp74I9+cNr
U2i5cGuCUuPW1xY3NJUIGOt4o94I3Dtkm9ehDw1Wknj9VmfK1FYwHh0EihO5hGj+
1t4mzfcXtKU5JJbRGgqfoWZa43LV+dA9f50gkLc4AQKBgQDb6fFLATXRjEKeuhD8
9IE5Ul/k+jWZnQCZUbRgQY7jlox/BiIk0rnTgamMO2IjjzLjMjdtUPUX6G7gvXjk
pKB2fQzsMUNasCz071S9iiPQc6fPt9xL6uP0G0/SWfn/+ZM3XkjQvkrmxWewzLn+
TX5sLziGOcWMMynoHyb4swkhrQKBgQDVZvBYcSwc/XTkPfV8drGVtJWsw2sNf0SZ
GsBl3JVKcLv9u9Ke+7q3Ui0CfxZQqVlLiW4bTFSKprh6Q2D1G3cWbDav/KBrb6Cr
4YeswgvDFFCGfy8mtCooL2wTpgPi81lVqFmGwzOwj98T+AMdipCLIiT4woIUI4Th
YqzBXGdnAQKBgFeFGTSCfMqyiWjmIBCrtin78JIOSfqikzRxYdnU/Wrx5WRAKqKB
Atd8CN/4WixQty3YNFrbF0+2fzoN7ekA46OETPpK+MVEy/+GqDDuoyY4gRaX06Kb
DrF9lRzgFjCbQM2ORmhc8y44bfXc5ECi0qd3e4VfxJDxY8Ivc7ESf5XZAoGBAKVS
/lhGNPqwkOJR7eDiw2lLYblaG5F1S1uhkfRYE4B8HefQnrd0JY7oJt6MPml3CSqv
6ZFUbRqNVtXBZVf+UyAX7bYhbNZOwJboPgfkvOAA2PGZjpnZcd93/a6rKs+j302x
AsqYZ28dxqDdvuwf8SMY7LObXNLlQYiqvVN/lswBAoGBANZd2oKBP6dhfftfjlci
Kdi3NP6G+IP61LEFcAwyQolog0lof9wPBl7gooyIRiGiz4cns3aZ3Tc1Ub4oqoIo
nrL5TJOSgOXNm3zKcBpeucdtYTwbYGYnvkeKxbLR4wJ5bMMOx0yDj9+LjZyuscXv
XGZ1MBimDxvmhqtCs5UJWJAO
-----END PRIVATE KEY-----` 
     // 将私钥 转成16进制
    // @ts-ignore
    rsa = jsrsasign.KEYUTIL.getKey(k);
    // 采用SHA256withRSA进行加密
    const sig = new jsrsasign.KJUR.crypto.Signature({
      alg: 'SHA256withRSA'
    }) ;
    // 算法初始化
    sig.init(rsa) ;

   // 对输入字串进行加密
    sig.updateString(signStr);
   // 加密后的16进制转成base64，这就是签名了
    const signature = jsrsasign.hextob64(sig.sign());

    console.error("SIGNATURE:" + signature);
       
    return signature;
}
