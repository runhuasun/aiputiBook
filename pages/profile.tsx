import TextareaAutosize from "react-textarea-autosize";
import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { getServerSession } from "next-auth";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import validator from 'validator';
import { User } from "@prisma/client";

import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { UserData } from "./api/createuser";

import Footer from "../components/Footer";
import UserHeader from "../components/UserHeader";
import BuddhaHeader from "../components/BuddhaHeader";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import ComboSelector from "../components/ComboSelector";
import LoginPage from "../components/LoginPage";
import FormLabel from "../components/FormLabel";
import Image from "../components/wrapper/Image";
import { config, defaultImage } from "../utils/config";
import * as debug from "../utils/debug";
import {callAPI} from "../utils/apiUtils";
import {mimeTypes, getThumbnail} from "../utils/fileUtils";
import * as du from "../utils/dateUtils";
import { getGrade } from "../utils/grade";
import * as monitor from "../utils/monitor";


function isAdmin(user:any){
    return user && user.actors && user.actors.indexOf("admin")>=0;
}

export default function profile({ isCurrentUser, loginUser, profileUser, config }: { isCurrentUser:boolean, loginUser: any, profileUser:any, config: any }) {
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const router = useRouter();
    let app = router.query.app;
    
    const [email, setEmail] = useState( profileUser?.email || "");
    const [password1, setPassword1] = useState("");
    const [password2, setPassword2] = useState("");
    const [username, setUsername] = useState(profileUser?.name || "");
    const [image, setImage] = useState(profileUser?.image || "");

    const [gradeName, setGradeName] = useState(getGrade(profileUser?.grade).name);

    const [desc, setDesc] = useState<any>(profileUser?.desc ? JSON.parse(profileUser.desc) : {});
    const [contactPhone, setContactPhone] = useState<string>(desc.contactPhone || "");
    const [contactEmail, setContactEmail] = useState<string>(desc.contactEmail || "");
    const [contactWechat, setContactWechat] = useState<string>(desc.contactWechat || "");
    const [contactQQ, setContactQQ] = useState<string>(desc.contactQQ || "");
    const [selfIntro, setSelfIntro] = useState<string>(desc.selfIntro || "");    
    
    async function updateUser() {
        if(password1.trim() != "" && password1 != password2){
            alert("如果修改密码请两次输入一样的密码");
            return "密码不一致";
        }else if(username && username.trim() == ""){
            alert("用户名不能为空");
            return "用户名不能为空";
        }
        const res = await callAPI("/api/updateUser", { 
            id: profileUser.id, name: username, email: email, password:password1, image:image, 
            desc: JSON.stringify({ contactPhone, contactEmail, contactWechat, contactQQ, selfIntro })
        });
        if (res.status !== 200) {
            alert(res.result);
            setError(res.result as any);
        } else {
            alert("用户信息修改成功");
            if( session && session.user && session.user.image ){
                session.user.image = image;
            }
            window.location.reload();
        }
    }

    function canChangePassword(){
        return validator.isMobilePhone(profileUser?.email) || validator.isEmail(profileUser?.email);
    }
  
    const handleSignOut = async () => {
        await signOut();
        window.location.href="/";
    //    router.push("/");
    };
      
    let line1 = 1;
    let line2 = 1;
    
    if(status == "authenticated" && profileUser){
     
        return (
            <div className="flex mx-auto flex-col items-center justify-center min-h-screen">

                <Head>
                    <title>修改用户信息</title>
                </Head>
               
                { app && (app == "BUDDHA") ? (
                <BuddhaHeader/>
                ) : (
                <UserHeader config={config}/>
                )}
                
                <main>
                    <div className="w-full flex flex-col sm:flex-row justify-center space-y-5 sm:space-y-0 sm:space-x-5 mt-10">
                        <div className="page-tab w-1/4 px-10 py-10 rounded-xl w-full sm:w-1/4 max-w-lg">
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg ">
                                <FormLabel number={`${line1++}`} label="头像"/>
                                <div className="w-full flex flex-col mt-3 items-center space-x-1">
                                    <Image                     
                                    alt="头像"
                                    src={getThumbnail(image || defaultImage.userCover, 512)}
                                    className="rounded-2xl w-full h-auto"
                                    />
                                    <ComboSelector onSelect = {(file)=> ( setImage(file))} />
                                </div>
                            </div>  
                            
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line1++}`} label="账号"/>
                                <input id="iptEmail" type="email" value = {email ? email : ''} readOnly
                                    className="input-main" 
                                    onChange={(e) => setEmail(e.target.value)} />
                            </div>

                            { canChangePassword() && (
                            <>
                                <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                    <FormLabel number={`${line1++}`} label="设置密码"/>
                                    <input id="iptPassword1" type="password" value = {password1}
                                        className="input-main" 
                                        onChange={(e) => setPassword1(e.target.value)} />
                                </div>
                   
                                <div className="space-y-4 w-full max-w-sm sm:max-w-lg ">
                                    <FormLabel number={`${line1++}`} label="确认密码"/>
                                    <input id="iptPassword2" type="password" value = {password2}
                                        className="input-main" 
                                        onChange={(e) => setPassword2(e.target.value)} />
                                </div>
                            </>
                            )}
                            
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg ">
                                <FormLabel number={`${line1++}`} label="我的邀请码"/>
                                <input id="iptInviteCode" type="text" value = {profileUser.id}  className="input-main bg-gray-300" readOnly />
                            </div>

                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line1++}`} label={`我的${config.creditName}`}/>
                                <input id="iptCredit" type="text" value = {profileUser.credits} readOnly
                                    className="input-main" 
                                    />
                            </div>

                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line1++}`} label="注册时间"/>
                                <input id="iptCreated" type="text" value = {profileUser.createdAt ? du.showDateTime(new Date(profileUser.createdAt)) : ""} readOnly
                                    className="input-main" 
                                    />
                            </div>
                            
                        </div>


                        <div className="page-tab w-1/4 px-10 py-10 rounded-xl  w-full sm:w-1/4 max-w-lg">
                            
                            <div className="mt-5 mb-5 space-y-4 w-full max-w-sm sm:max-w-lg ">
                                <div className="flex flex-col mt-3 items-center space-x-3">
                                    <p className="text-center text-xl font-bold">
                                        以下信息将对外展示
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="用户名"/>
                                <input id="iptUserName" type="username" value = {username ? username : ''}
                                    className="input-main" 
                                    onChange={(e) => setUsername(e.target.value)} />     
                            </div>  

                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="超能等级"/>
                                <input id="iptUserName" type="username" value = {gradeName}
                                    className="input-main" 
                                    onChange={(e) => setUsername(e.target.value)} />     
                            </div>                                
        
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="联系电话"/>
                                <input id="iptPhone" type="tel" value = {contactPhone}
                                    className="input-main" 
                                    onChange={(e) => setContactPhone(e.target.value)} />     
                            </div>  
    
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="联系邮箱"/>
                                <input id="iptEmail" type="text" value = {contactEmail}
                                    className="input-main" 
                                    onChange={(e) => setContactEmail(e.target.value)} />     
                            </div>                          
    
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="联系微信"/>
                                <input id="iptWechat" type="text" value = {contactWechat}
                                    className="input-main" 
                                    onChange={(e) => setContactWechat(e.target.value)} />     
                            </div>  
    
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="联系QQ"/>
                                <input id="iptQQ" type="number" value = {contactQQ}
                                    className="input-main" 
                                    onChange={(e) => setContactQQ(e.target.value)} />     
                            </div>  
    
                            <div className="space-y-4 w-full max-w-sm sm:max-w-lg">
                                <FormLabel number={`${line2++}`} label="自我介绍"/>
                                <TextareaAutosize id="iptIntro"
                                    style={{ borderRadius: "8px"}  }        
                                    minRows={10} maxRows={10}
                                    className="input-main w-full px-4 py-2 " 
                                    value={selfIntro}
                                    placeholder="例如：一只恐龙从校园的森林里路过" 
                                    onChange={(e) => setSelfIntro(e.target.value)} />
                            </div>  
                            
                        </div>

                    </div>
                        
                    <div className="w-full pt-5 mt-10 mb-20 flex flex-row space-x-8 items-center justify-center">
                        <button
                            onClick={() => {
                                window.open("/buy-credits", "_self");
                            }}
                            className=" hidden sm:block rounded-lg button-gold  px-10 py-2 "
                            >
                            <span>购买{config.creditName}</span>
                        </button> 
                        
                        <button
                            onClick={() => {
                                updateUser();
                            }}
                            className=" rounded-lg button-gold  px-10 py-2 "
                            >
                            <span>保存信息</span>
                        </button> 
                        {isCurrentUser && (loginUser.boughtCredits > 0) && (
                        <button
                            className=" rounded-lg button-dark  px-10 py-2  "
                            onClick={handleSignOut}
                        >
                            <span>退出登录 </span>
                        </button>
                        )}
                    </div>

                    {isAdmin(loginUser) && (
                    <div className="page-tab flex flex-row items-center space-x-3 rounded-xl p-4">
                        <button
                            className=" rounded-lg button-dark  px-10 py-2  "
                            onClick={()=>{window.open("/admin/userContent?userId="+profileUser.id, "_blank")}}
                        >
                            <span>查看用户作品</span>
                        </button>
                        <button
                            className=" rounded-lg button-dark  px-10 py-2  "
                            onClick={()=>{window.open("/admin/userTrace?userId="+profileUser.id, "_blank")}}
                        >
                            <span>用户行为轨迹</span>
                        </button>
                        <button
                            className=" rounded-lg button-dark  px-10 py-2  "
                            onClick={()=>{window.open("/userUsage?userId="+profileUser.id, "_blank")}}
                        >
                            <span>用户使用账单</span>
                        </button>
                        <button
                            className=" rounded-lg button-dark  px-10 py-2  "
                            onClick={()=>{window.open("/userPayment?userId="+profileUser.id, "_blank")}}
                        >
                            <span>用户付款记录</span>
                        </button>
                        
                    </div>
                    )}                        
                    
                </main>
                <Footer websiteName={config.websiteName} />
            
            </div>


        );

    }else{
        return(<LoginPage config={config}/> );
    }

  
};



export async function getServerSideProps(ctx: any) {
    
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let profileUser:any;
    let loginUser:any;
    
    if (session?.user?.email) {
        loginUser = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            }
        });
    }
    if(ctx?.query?.userId){
        profileUser = await prisma.user.findUnique({
            where: {
                id: ctx.query.userId!
            }
        });
    }else{
        profileUser = loginUser;
    }

    const isCurrentUser = loginUser && profileUser && (loginUser.id == profileUser.id);

    monitor.logUserRequest(ctx, session, loginUser);
    return {
        props: {
            isCurrentUser,
            profileUser,
            loginUser,
            config
        }
    };
}  
