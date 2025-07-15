import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { getServerSession } from "next-auth";
import { Model, User, Talk } from "@prisma/client";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks';
import remarkSmartypants from 'remark-smartypants';
import remarkRehype from 'remark-rehype';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import prisma from "../../lib/prismadb";
import { authOptions } from "../api/auth/[...nextauth]";
import * as am from "../api/actionManager";

import LoadingDots from "../../components/LoadingDots";
import LoginPage from "../../components/LoginPage";
import Image from "../../components/wrapper/Image";
import TopFrame from "../../components/TopFrame";

import { config, defaultImage } from "../../utils/config";
import {isWeixinBrowser} from "../../utils/wechatUtils";
import * as debug from "../../utils/debug";
import {callAPI} from "../../utils/apiUtils";
import * as monitor from "../../utils/monitor";


const RichText = ({ markdownContent }: { markdownContent: string }) => {
    return ( 
        <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, rehypeKatex ]} 
            rehypePlugins={[rehypeRaw]}
            className="px-2 w-full overflow-auto text-truncate" 
            children={markdownContent} />
    );
};


export async function getServerSideProps(ctx: any) {
    const bookId = ctx?.query?.bookId!;
    let user = null;
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
  
    // 找到当前用户
    if (session && session.user  && session.user.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
        });
    }
    monitor.logUserRequest(ctx, session, user);

    // 从数据库里找到对应的模型
    const book:any = await prisma.model.findUnique({
        where: {
            id: bookId,
        },
        include: {
            modelRawdatas: {
              where: {
                NOT: {
                  status: "DELETE"
                }
              },   
              take: 1,
              include: {
                  rawdata: true
              },
                orderBy: {
                    createTime: 'desc',
                }                  
            }
        }
    });  
    if(user && book && await am.isFavoriteBook(user.id, book.id)){
        book.isFavorite = true;
    }

    let talks = await prisma.talk.findMany({
        where: {
            status: "SUCCESS",
            model: book!.code,
            // userId: user!.id,
            inputMsg: {
                not: {
                    contains: "#MEDIA#CHAT#"
                }
            }            
        },
        orderBy: {
            createdAt: 'desc',
        },    
        take: 100
    });
    
    return {
        props: {
            book,
            config,
            user,
            talks
        },
    };
}  



export default function showBook({ book, config, user, talks }: { book: any, config: any, user: User, talks:Talk[] }) {
  
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState<boolean>(book && book.isFavorite);
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const appId = router.query.appId;     


    async function addFavorite() {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const res = await callAPI(`/api/actionManager?cmd=ADDFAVORITEBOOK&userId=${user.id}&bookId=${book.id}`, {});
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            mutate();
            book.isFavorite = true;
            setIsFavorite(true);
        }
        setTimeout(() => {
            setLoading(false);
        }, 1300);
    }

    async function removeFavorite() {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const res = await callAPI(`/api/actionManager?cmd=REMOVEFAVORITEBOOK&userId=${user.id}&bookId=${book.id}`, {});
        if (res.status !== 200) {
            setError(res.result as any);
        } else {
            mutate();
            book.isFavorite = false;
            setIsFavorite(false);
        }
        setTimeout(() => {
            setLoading(false);
        }, 1300);
    }


    async function readBook(book:any){

        if(status == "authenticated"){
            // 记录用户行为
            callAPI(`/api/actionManager?cmd=READBOOK&userId=${user.id}&bookId=${book.id}`, {}); 
            
            if(isWeixinBrowser() && appId){
                // 修改用户当前应用的当前默认模型
                const service = "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" + appId +
                    "&userId=" + user.id + "&key=CHAT_MODEL_ID" + "&value=" + book.id;
              
                const res = await callAPI(service, {});    
                // 关闭当前窗口，回到微信对话界面
                if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
                    WeixinJSBridge.invoke('hideToolbar');                    
                    WeixinJSBridge.invoke('closeWindow', {}, function(res) {});
                    return;
                }
            }
        }
        window.location.href = `/chatbot?model=${book.id}`;
    }
    
    return (
        <TopFrame config={config}>
            <main>
                <h1 className="title-main hidden sm:block">
                    { book.name }
                </h1>
                <div className="w-full max-w-lg items-center justify-center px-5 ">
                  <Image
                    src={ book.coverImg }
                    width={768}
                    height={1024}
                    alt="cover image"
                    className="w-full max-w-768px rounded-xl"
                  />
                </div>                          
                <div className="w-full max-w-lg space-x-8 flex flex-row justify-center">
                    {status == "authenticated" && (
                    <>
                        {book.isFavorite ? (
                        <button
                            onClick={() => {
                                removeFavorite();
                            }}
                            className=" px-4 py-2 mt-8 button-main"
                            >
                            取消收藏
                        </button>                                             
                        ):(
                        <button
                            onClick={() => {
                                addFavorite();
                            }}
                            className=" px-4 py-2 mt-8 button-dark"
                            >
                            添加收藏
                        </button>   
                        )}
                    </>                        
                    )}
                        
                    <button
                        onClick={() => {
                            readBook(book);
                        }}
                        className=" px-4 py-2 mt-8 button-gold"
                        >
                        对话交流
                    </button> 

                    {status == "authenticated" && book?.channel=="BOOK" && book?.modelRawdatas && book.modelRawdatas[0]?.rawdata?.url && (
                        <button
                            onClick={() => {
                                window.location.href = book.modelRawdatas[0].rawdata.url;
                            }}
                            className=" px-4 py-2 mt-8 button-main"
                            >
                            参考链接
                        </button>                         
                    )}
                </div>    

                <div className="w-full max-w-lg mt-10 mb-5 align-center items-center">
                    ---精彩问答---
                </div>
                <div className="w-full sm:w-2/3 grid grid-flow-row-dense grid-cols-1 gap-1 pr-3 ">
                    {talks && talks.map((m:any) => {
                        const question = JSON.parse(m.inputMsg)?.content || m.inputMsg;
                        const answer = JSON.parse(m.outputMsg)?.content || m.outputMsg;
                        if(question && question.length>6){
                            return (
                                <div className=" w-full flex flex-col ">
                                    <div className=" text-msg-user relative group inline-block p-2 rounded-xl text-left flex flex-row mb-4 w-full mx-2 my-1 ">
                                        <RichText markdownContent={"问：" + question } />
                                    </div>
                                    <div className=" text-msg-assistant relative group inline-block p-2 rounded-xl text-left flex flex-row mb-4 w-full mx-2 my-1 ">
                                        <RichText markdownContent={"答：" + answer } />
                                    </div>
                                </div>
                            );
                        }
                    })}  
                </div>                     
            </main>
        </TopFrame>
    );
    
};
