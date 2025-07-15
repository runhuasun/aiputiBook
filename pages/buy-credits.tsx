 declare global {
     interface Window {
         WeixinJSBridge: any;
     }
 }   
import { useSession } from "next-auth/react";
import Script from "next/script";
import Head from "next/head";
import useSWR from "swr";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import { Request } from 'express';
import * as qr from 'qr-image';
import {  User } from "@prisma/client";
import { getServerSession } from "next-auth";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import Image from "../components/wrapper/Image";
import Footer from "../components/Footer";
import UserHeader from "../components/UserHeader";
import BuddhaHeader from "../components/BuddhaHeader";
import DropDown from "../components/DropDown";
import LoginPage from "../components/LoginPage";
import FormLabel from "../components/FormLabel";

import * as monitor from "../utils/monitor";
import { config } from "../utils/config";
import * as enums from "../utils/enums";
import {callAPI} from "../utils/apiUtils";

export function isWeixinBrowser() {
    var ua = navigator.userAgent.toLowerCase();
    return (/micromessenger/.test(ua)) ? true : false;
}    

function getClientIP(req: Request): string {
    // @ts-ignore
    const ipAddress = req?.headers["x-forwarded-for"]?.split(",")[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection as any)?.socket?.remoteAddress;
    
    return ipAddress;
}

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let user = null;
    if (session && session.user  && session.user.email) {
        
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        }); 
    }

    monitor.logUserRequest(ctx, session, user);

    return {
        props:{ 
            user: user,
            weixinAppId: process.env.WECHAT_APP_ID,
            clientIP: getClientIP(ctx.req),
            config,
        }
    };
  
}

export default function buyCredits({ user, weixinAppId, clientIP, config }: { user:User, weixinAppId: string, clientIP: string, config: any } ) {
  

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    /*
    const [invitationQRCode, setInvitationQRCode] = useState<string>();
    async function getInvitationQRCode(){
        try {
            const res = await fetch('/api/signInWechat', {
                method: 'POST',
                body: JSON.stringify({
                    cmd: "GET_INVITATION_QR"
                }),
            });
            const data = await res.json();
            if(res.ok){
                if(data?.QRCode){
                    setInvitationQRCode(data.QRCode);
                }
            }
        } catch (error) {
            console.error(error);
        }        
    }
    useEffect(() => {
        getInvitationQRCode();
    }, []); 
    */
    
    // const [room, setRoom] = useState(user?.grade > 0 ? "99" : "9.9");
    const [room, setRoom] = useState("99"); 
    const router = useRouter();
    let app = router.query.app;

    // 19.9包月 200个提子
    // 49.9包季 600个提子
    // 169包年  2500个提子
    // 399包三年 10000个提子
    const cn = config.creditName || "能量点";
    const pn = config.creditPackName || "能量包";
/*    const roomNames = new Map([
        ["0.01" , `1个${cn}，1分内测勿拍`],
//        ["9.9" , `50个${cn}——9.9元，新手${pn}`],        
        ["99" , `1100个${cn}——99元，青铜${pn}，9折`], // 9折
//        ["299" , `4288个${cn}——299元，黄金${pn}，7折`], // 7折
        ["499" , `7200个${cn}——499元，白金${pn}，7折`], // 7折     
//        ["499" , `7688个${cn}——499元，白金${pn}，6.5折`], // 6.5折
//        ["999" , `16668个${cn}——999元，黑金${pn}，6折`], // 6折
//        ["1999", `36368个${cn}——1999元，钻石${pn}，5.5折`], // 5.5折
        ["1999", `40000个${cn}——1999元，钻石${pn}，5折`], // 5折     
//        ["3999", "79988个" + config.creditName + "——3999元，原神VIP"], // 5折           
//        ["9999" , `200008个${cn}——9999元，天使${pn}`] // 5折
    ]);
    const roomNames = new Map([
        ["9.9" , `100个${cn}——9.9元，尝鲜${pn}，9.9折`],        
        ["99" , `1400个${cn}——99元，青铜VIP${pn}，7折`], 
        ["499" , `8300个${cn}——499元，白金VIP${pn}，6折`],
        ["1999", `40000个${cn}——1999元，钻石VIP${pn}，5折`],
    ]);
*/
 
    const roomNames = new Map([
        ["99" , `1100个${cn}——99元，青铜VIP${pn}，9折`], 
        ["199" , `2850个${cn}——199元，黄金VIP${pn}，7折`],      
        ["499" , `8300个${cn}——499元，白金VIP${pn}，6折`],
        ["1999", `40000个${cn}——1999元，钻石VIP${pn}，5折`],
    ]);
 
    const rooms: string[] = [ "99", "199", "499", "1999"];
//    if(user?.grade == 0){    
//        rooms.unshift("9.9");
//    }
//    if(user?.actors && user.actors.indexOf("admin")>=0){
//        rooms.unshift("0.01");
//    }
  
    function getCreditsByAmount(amount: string){
        const label = roomNames.get(amount);
        if(label){
            const index = label.indexOf("个");
            if(index>0){
                return label.substring(0,index);
            }else{
                return "0";
            }
        }else{
            return "0";
        }
    }
    
    /// 分账提款
  function withdrawMoney(){
      if(data.incomeCredits < 1000){
          alert("每次分账至少要1000个" + config.creditName + "。");
          return;
      }else{
          alert("根据监管得要求，您第一次分账需要联系我们得财务管理人员。请发邮件至div_acc@aiputi.cn，我们将在一个工作日内与您联系处理。感谢您得支持！");
          return;      
      }      
  }

    
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // 处理Alipay
  async function startAlipay(){      
    if(isWeixinBrowser()){          
       alert("微信内不支持支付宝，请使用微信支付，或者点击左下角...，并选择“从浏览器打开”，来完成支付宝支付。");
       return;
    }
                                  
    if(!session?.user?.email){
        alert("购买" + config.creditName + "前，请先登录！");
        window.location.href= config.website + "/loginChoice?originalUrl=/buy-credits";
        return;     
    }else {

      const params = {
        total_amount: room, // 支付金额
        subject: roomNames.get(room), // 付款的产品名称全部描述
        body: getCreditsByAmount(room),  // 购买数量
        email: session?.user?.email,
      };

      try {
        const response = await fetch('/api/alipay', {
          method: 'POST',
          body: JSON.stringify(params),
        });

        const data = await response.json();
        window.location.href = data.url; // 跳转到支付页面
      } catch (error) {
        console.error(error);
      }
    }
  };

                                  
   //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 工具函数：构建微信授权URL
    function buildWechatAuthUrl() {
        const appid = config.weixinAppId; // 公众号AppID从配置读取
        const redirectUri = encodeURIComponent(`${window.location.origin}/buy-credits?pageState=wxPayCallback`); // 回调到当前页面
        const scope = 'snsapi_base'; // 静默授权
        return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=wxpay#wechat_redirect`;
    }

    // 工具函数：用code换取openid
    async function fetchOpenidByCode(code:string) {
        const res = await callAPI(`/api/signInWechat`, {cmd:"GET_USER_INFO", code:code, signInType:"INSIDE"}); // 调用你的后端接口
        if((res.status == enums.resStatus.OK) && res.result.openid){
            return res.result.openid;
        }else{
            throw new Error('OpenID获取失败');
        }
    }

    // 工具函数：从URL获取参数
    function getUrlParam(name:string) {
        const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`);
        const r = window.location.search.substr(1).match(reg);
        return r ? decodeURIComponent(r[2]) : null;
    }

    useEffect(() => {
        const code = getUrlParam("code");
        const pageState = getUrlParam("pageState");
        if(code && pageState==="wxPayCallback" && status==="authenticated"){
            startWechatPay();
        }
    }, [status]); 
 
  // 处理微信支付
    async function startWechatPay(openid?:string){
        
        if(!session?.user?.email){
            alert(`请先登录${config.appName}再发起微信支付！`);
            window.location.href= config.website + "/loginChoice?originalUrl=/buy-credits" + (isWeixinBrowser() ? "&signInWechat=true" : "");
            return;
        }
        
        let CMD="";
        if(isMobile){
            // 同样是判断是否在微信浏览器内
            
            if(window.WeixinJSBridge){
                CMD = "NEW_ORDER_JSAPI";
                if(!openid){
                    // 强制重新获取OpenID
                    const code = getUrlParam('code'); // 从URL参数中尝试获取code
                    if (code) {
                        // 如果有code，说明是授权回调后的页面，用code换openid
                        try {
                            openid = await fetchOpenidByCode(code);
                        } catch (error) {
                            return alert('获取微信身份失败，请重试');
                        }
                    } else {
                        // 没有code，跳转微信授权页
                        const authUrl = buildWechatAuthUrl();
                        window.location.href = authUrl;
                        return; // 终止后续逻辑
                    }
                }
                if(!openid){
                    return alert("为了避免重复支付，您不能在当前页面继续操作。请关闭当前页面，并重新打开支付页面！" );
                }
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
                money: room,
                credits: getCreditsByAmount(room),
                desc: roomNames.get(room),
                openid: openid, 
                clientIP: clientIP,
            }),
        });
   
        const result = await res.json();
        //  alert("res.ok:" + res.ok);
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
        }else{
            alert(result as any);
            return;
        }

  }
                                  

function showQRCode(code_url:string){
    // alert(code_url);
    // 生成二维码图片
    const codeUrl = code_url;
    const qrImage = qr.imageSync(codeUrl, { type: 'png', size: 10 });
    
    // 将二维码图片转成 base64 字符串
    const base64QR = qrImage.toString('base64');
    const dataURI = 'data:image/png;base64,' + base64QR;
    
    // 在浏览器中显示二维码图片
    const div = document.getElementById('divQRCode');
    const img = document.getElementById('imgQRCode') as HTMLImageElement;
    if(img && div){
        img.src = dataURI;
        div.style.display = "flex";
    }
}


 
async function openWepay(prepay_id: string){

    const appId = weixinAppId;
    const timestampNow = (Date.parse(new Date().toString()) / 1000).toString();
    const noncestr = "fsafsaewerg7889gh67hegvbsdfge";  
    const packageStr = "prepay_id="+prepay_id;

//    alert("Prepay_id:" + prepay_id);
    const signStr = appId + "\n" + timestampNow + "\n" + noncestr + "\n" + packageStr + "\n";
//    alert(packageStr);
//    alert(signStr);
    const paySign = await signature(signStr);
//    alert("sig:" + paySign);
    if(paySign == ""){
      alert("发起微信支付时，数据签名失败！");
      return;
    }else{
//      alert(paySign);
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
//        alert("res.err_msg:" + res.err_msg);
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


 let num = 1;
 
        return (
            <div className="w-full flex mx-auto overflow-visible flex-col items-center justify-between py-3 min-h-screen">
                <Head>
                    <title>{"我的" + config.creditName}</title>
                </Head>
                { app && (app == "BUDDHA") ? (
                <BuddhaHeader/>
                ) : (
                <UserHeader config={config}/>
                )}         

                <main className="w-full flex flex-1 flex-row bg-slate-300 items-start">                
                    <div className="hidden sm:block flex flex-col flex-1 min-w-7xl items-center">
                        <Image alt="充值" src={`${config.RS}/bg/payment_bg.jpg`} className="w-full h-auto"/>                                            
                    </div>
                
                    <div className="flex flex-col w-full sm:w-1/2 items-center pt-10">
                        <div className="hidden sm:block mx-auto max-w-4xl px-6 lg:px-8">
                            <div className="mx-auto max-w-4xl text-center">
                                <p className="text-2xl text-gray-700 font-bold tracking-widest">
                                    {"我的" + config.creditName}
                                </p>
                            </div>
                        </div>
                        <p className="mx-auto mt-2 max-w-2xl text-center text-lg leading-8 text-gray-700 mb-2">
                            您现在一共有
                            <span className="font-semibold text-gray-500">
                                {data?.remainingGenerations}{"个" + config.creditName + " "}
                            </span>
                        </p>

                        <div className="page-tab flex flex-col items-center space-y-4 w-full rounded-xl max-w-3xl px-10 py-10">
                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label={`您要购买多少${config.creditName}`}/>
                                <DropDown
                                    theme={room}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setRoom(newRoom)}
                                    themes={rooms}
                                    names={roomNames}
                                    />
                            </div>          
                            
                            <div className="space-y-4 w-full max-w-lg">
                                <FormLabel number={`${num++}`} label={`选择您的支付方式`}/>                                 
                                <div className="flex flex-row space-x-8 sm:space-x-12 pt-2 items-center justify-center pb-10">
                                    <button className="px-4 sm:px-12 py-3 text-sm sm:text-xl button-main flex flex-row items-center justify-center space-x-2"
                                        onClick={() => {
                                            startAlipay();
                                        }} >
                                        <Image src="/zfb.png" alt="alipay" className="h-10 w-10" />
                                        <span>支付宝</span>
                                    </button> 
                                    <button className="px-4 sm:px-12 py-3 text-sm sm:text-xl button-main flex flex-row items-center justify-center space-x-2"
                                        onClick={() => {
                                            startWechatPay();
                                        }} >
                                        <Image src="/wxzf.png" alt="alipay" className="h-10 w-10" />
                                        <span>微信支付</span>
                                    </button> 
                                </div>   
                            
                                  <div id="divQRCode" className="w-full flex flex-col items-center hidden">
                                      <p className="text-lg">请扫描下方二维码进行微信支付</p> 
                                      <Image id="imgQRCode" alt="QR Code" src="" className="w-64 rounded-2xl sm:mt-0 mt-2"/>            
                                  </div>
                            </div>
                        </div>

                        <div className="mt-10 text-center">
                            <h4 className="flex-none leading-6 mt-2 text-xl font-bold tracking-wider text-gray-600">
                                我们的在线服务收费标准：
                            </h4>
                        </div>
                        <ul role="list" className="mt-8 grid grid-cols-1 gap-4 leading-6 text-gray-500 sm:grid-cols-2 sm:gap-6 mb-10">
                            <li className="flex gap-x-3">
                                <svg className="h-6 w-5 flex-none text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                        />
                                </svg>
                                按需付费，无需忍受订阅扣款
                            </li>

                            <li className="flex gap-x-3">
                                <svg className="h-6 w-5 flex-none text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                        />
                                </svg>
                                VIP用户无水印使用千种顶流AI模型
                            </li>                         
                         
                            <li className="flex gap-x-3">
                                <svg className="h-6 w-5 flex-none text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                        />
                                </svg>
                                所有的AI服务用{config.creditName}结算
                            </li>

                            {config.websiteName == "aiputi" && (
                            <li className="flex gap-x-3">
                                <svg className="h-6 w-5 flex-none text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                        />
                                </svg>
                                个人AI助理的收费2个{config.creditName}/千字
                            </li>
                            )}
                    
                                  {config.websiteName == "aiputi" && (
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  每次问答总计不足1千字的按1千字收取
                                </li>
                                  )}
                    
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                    每个功能页面上有服务的具体价格
                                </li>
                               
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  AI服务开始执行后即扣除{config.creditName}
                                </li>
                    
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  如果AI服务执行失败会退还扣除的{config.creditName}
                                </li>
                    
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  购买的{config.creditName}在服务期间长期有效
                                </li>
                               
                                <li className="flex gap-x-3">
                                  <svg
                                    className="h-6 w-5 flex-none text-green-500"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  所有{config.creditName}售出后不可以退款
                                </li>
                              </ul>

                     {/*
                              <div className="mt-10 text-center max-w-3xl px-10">
                                  <h4 className="flex-none leading-6 mt-2 text-xl font-bold tracking-wider text-gray-600">
                                      好友邀请奖励计划
                                  </h4>
                              </div>                     
                              <div className="mt-8 text-center max-w-3xl px-10">
                                  <h4 className="flex-none leading-6 mt-2 mb-6 text-lg font-medium	tracking-tight text-gray-500 text-left">
                                   {config.inviteBonus > 0 && (                                   
                                      <span>每邀请一位朋友注册，他第一次使用时您将立即获得{config.inviteBonus}个{config.creditName}</span>
                                   )}
                                   {config.inviteBonus > 0 && config.ICR <= 0 && (
                                      <span>：</span>
                                   )}
                                   {config.inviteBonus > 0 && config.ICR > 0 && (
                                      <span>。</span>
                                   )}
                                   {config.ICR > 0 && (
                                      <span>您邀请注册的朋友充值，您将按照他充值{config.creditName}数的{Math.round(config.ICR*100)}%获得奖励：</span>
                                    )}                                   
                                  </h4>
                                  {(config.inviteBonus > 0 || config.ICR > 0) && (
                                  <>
                                      <p className="text-gray-500 mb-5 w-full max-w-3xl text-left">
                                          方法一、让您的朋友使用手机号码注册，并输入您的邀请码：
                                          <span className="text-gray-500">{user.id}</span>
                                      </p>   
                                      <p className="text-gray-500 mb-5 w-full max-w-3xl text-left">
                                          方法二、把以下链接发给您的朋友，请他（她）点击链接注册新用户：
                                          <span className="text-gray-500">{`${config.website}/loginChoice?inviteBy=${user.id}`}</span>
                                      </p>   
                                      {invitationQRCode && (
                                      <>
                                          <p className="text-gray-500 mb-5 w-full max-w-3xl text-left">
                                              方法三、把下面二维码发给您的朋友，请他（她）扫码关注我们的服务号：
                                          </p>   
                                          <div className="w-full flex flex-col items-center">
                                              <Image id="invitationQRCode" alt="QR Code" src={invitationQRCode} className="w-64 rounded-2xl sm:mt-0 mt-2"/>            
                                          </div>
                                      </>
                                      )}
                                  </>
                                  )}
                              </div>
                     */}
             
                              <p className="text-gray-500 mt-10">
                                如果您有超过10000元的购买需求，或者是集团企业客户，请联系 Email{" "}
                                <span className="text-gray-500">sales@aiputi.cn</span>
                              </p>       
                        </div>
                </main>
      
               <Footer websiteName={config.websiteName} />
            </div>                
        );
}

                    
                                { /*config.websiteName == "XXXXX" && (
                                <div className="w-full flex flex-col items-center">
                                    
                                   <div className="mt-10 text-center">
                                       <h4 className="flex-none leading-6 mt-10 text-xl font-bold tracking-tight text-white">
                                           购买的{config.creditName}在以下公众号应用中通用：
                                       </h4>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 sm:grid-cols-4 items-center gap-2 mt-5 sm:mt-6 mb-5 pb-4">
                                       
                                       <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
                                           <span className="text-gray-400 text-base px-5">
                                               AI菩提
                                           </span>                       
                                           <div className="flex space-x-2 flex-row ">
                                               <div className="sm:mt-0 mt-1">
                                                   <Image
                                                      alt="Original photo"
                                                      src={`${config.RS}/QR/aiputi.jpg`}
                                                      className="object-cover rounded-2xl"
                                                      width={128}
                                                      height={128}
                                                    />
                                               </div>
                                           </div>
                                       </div>
                                       
                                       <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
                                           <span className="text-gray-400 text-base px-5">
                                               AI凡提(法律咨询)
                                           </span>                      
                                           <div className="flex space-x-2 flex-row ">           
                                               <div className="sm:mt-0 mt-1">
                                                   <Image
                                                       alt="Generated photo"
                                                       width={128}
                                                       height={128}
                                                       src={`${config.RS}/QR/aifanti.jpg`}
                                                       className="object-cover rounded-2xl"
                                                       />
                                               </div>
                                           </div>
                                       </div>
                                       
                                       <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
                                           <span className="text-gray-400 text-base px-5">
                                            海玩旅行助手
                                           </span>                       
                                           <div className="flex space-x-2 flex-row ">
                                               <div className="sm:mt-0 mt-1">
                                                   <Image
                                                      alt="Original photo"
                                                      src={`${config.RS}/QR/haiwan.jpg`}
                                                      className="object-cover rounded-2xl"
                                                      width={128}
                                                      height={128}
                                                    />
                                               </div>
                                           </div>
                                       </div>
                                    
                                       <div className="flex flex-col space-y-5 mt-1 sm:mt-4 mb-8 items-center">
                                           <span className="text-gray-400 text-base px-5">
                                            AI小提(儿童启蒙)
                                           </span>            
                                           <div className="flex space-x-2 flex-row ">           
                                               <div className="sm:mt-0 mt-1">
                                                   <Image
                                                       alt="Generated photo"
                                                       width={128}
                                                       height={128}
                                                       src={`${config.RS}/QR/aixiaoti.jpg`}
                                                       className="object-cover rounded-2xl"
                                                       />
                                               </div>
                                           </div>
                                       </div>         
                                       
                                    </div>
                                </div>

                    

                                
                                ) */}


                           {/*
                            <p className="mx-auto mt-2 max-w-2xl text-center items-center text-lg leading-8 text-gray-500 mb-2">
                              其中销售提示词和模型的收入:
                            </p>
                            <p className="mx-auto flex-col max-w-2xl text-center items-center text-lg leading-8 font-semibold text-gray-400 mb-2">
                                {data?.incomeCredits}{"个" + config.creditName + " "}
                             <button className="items-center justify-center space-x-2 rounded-lg button-dark text-sm px-5 py-2 "
                                onClick={() => {
                                  withdrawMoney();
                    
                                }} >
                               <span>现在分账</span>
                            </button>           
                              
                            </p>
                            <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-gray-500 mb-10">
                            {"更多" + config.creditName + "，请选择下面的购买："}
                            </p>
                            */}                
