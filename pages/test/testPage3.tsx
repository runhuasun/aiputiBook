import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import prisma from "../../lib/prismadb";
import { Room, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import { useEffect, useState } from "react";
import { useCallback } from 'react';
import React from 'react';
import { Request } from 'express';
import TextareaAutosize from "react-textarea-autosize";

import StartButton from "../../components/StartButton";
import Image from "../../components/wrapper/Image";
import {callAPI} from "../../utils/apiUtils";
import * as tu from "../../utils/textUtils";
import { config } from "../../utils/config";


function generateRandomNumber(n: number) {
    const digits = Array.from({ length: n }, () => Math.floor(Math.random() * 10));
    return digits.join('');
}    

export default function testPage3({ config }: { config:any }) {

   
    const { data: session } = useSession();
    
    useEffect(() => {
    }, []);

    const [value1, setValue1] = useState<string>("");
    const [value2, setValue2] = useState<string>("");
    
    const [prompt, setPrompt] = useState<string>("");
    const [segments, setSegments] = useState<string>("");
    function generateSegments(){
        const segs:string[] = tu.splitToSentences(prompt, 150);
        let result:string = "";
        for(const seg of segs){
            result += seg + "\n---------------\n";
        }
        setSegments(result);
    }

    
    function generateRandomBonus() {
        let randomNumber = Math.random() * 10000;  // 生成一个0到10000的随机数
    
        if (randomNumber < 5000) {  // 30%的概率
            return 0;
        } else if (randomNumber < 9000) {  // 30%的概率
            return 1;
        } else if (randomNumber < 9500) {  // 20%的概率
            return 2;  // 返回2
        } else if (randomNumber < 9800) {  // 10%的概率
            return 3 + Math.floor(Math.random() * 8);  // 返回3到10
        } else if (randomNumber < 9900) { // 5%的概率
            return 11 + Math.floor(Math.random() * 10);  // 返回11到20
        } else if (randomNumber < 9980) { // 3%的概率
            return 21 + Math.floor(Math.random() * 20);  // 返回21到40
        } else if (randomNumber < 9995) { // 1%的概率
            return 41 + Math.floor(Math.random() * 20);  // 返回41到60
        } else if (randomNumber < 9997) { // 0.5%的概率
            return 61 + Math.floor(Math.random() * 40);  // 返回61到100
        } else if (randomNumber < 9998) { // 0.25%的概率
            return 101 + Math.floor(Math.random() * 100);  // 返回101到200
        } else if (randomNumber < 9999) { // 0.1%的概率
            return 201 + Math.floor(Math.random() * 100);  // 返回201到300
        } else if (randomNumber < 9999.5) { // 0.05%的概率
            return 301 + Math.floor(Math.random() * 100);  // 返回301到400
        } else if (randomNumber < 9999.99) { // 0.04%的概率
            return 401 + Math.floor(Math.random() * 100);  // 返回401到500
        } else {  // 0.01%的概率
            return 501 + Math.floor(Math.random() * 499);  // 返回501到999
        }
    }
    
    return (
        <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
            <Head>
                <title>AI菩提</title>
            </Head>
            
            <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">

                
      {/* 水面文字 */}
      <h1 className="relative text-5xl font-bold text-white z-10 moonlight-text">
        玄幻水面效果
      </h1>
                <h1 className="mx-auto max-w-4xl font-display text-3xl font-bold tracking-normal py-2 text-white mb:50 sm:text-4xl">
                    实验功能页3
                </h1>   
                
                <div className="w-full grid grid-flow-row-dense grid-cols-1 sm:grid-cols-4 gap-4 justify-center items-center sm:mt-1 mt-3">

                    <div className="page-tab w-full">
                        <StartButton config={config} title="改过密码的微信用户" onStart={async ()=>{
                            const ret = await callAPI("/api/testAPI", {
                                cmd: "WECHAT_PASSWORD"
                            });
                            alert(JSON.stringify(ret.result));
                        }}/>
                    </div>

                    <div className="page-tab w-full">
                        <StartButton config={config} title="测试prisma" onStart={async ()=>{
                            const ret = await callAPI("/api/testAPI", {
                                cmd: "TEST_PRISMA"
                            });
                            alert(JSON.stringify(ret.result));
                        }}/>
                    </div>                    

                    <div className="page-tab w-full">
                        <StartButton config={config} title="生成随机字符串" onStart={()=>{
                            alert(generateRandomNumber(4));
                            alert(generateRandomNumber(8));
                            alert(generateRandomNumber(16));
                            alert(generateRandomNumber(32));            
                        }}/>
                    </div>

                    <div className="page-tab w-full">
                        <StartButton config={config} title="生成随机字符串" onStart={()=>{
                            alert(generateRandomBonus());
                        }}/>
                    </div>
                    
                </div>

                <div className="page-tab w-full flex flex-row itesm-center">
                    <TextareaAutosize id="iptPrompt"  
                        style={{ borderRadius: "8px", borderColor:'black'}  } 
                        minRows={20} maxRows={50}  maxLength={1000}
                        className="bg-white w-full text-black border font-medium px-4 py-2" 
                        value={prompt}
                        placeholder="带有可选格式的歌词。您可以用换行符来分隔每一行歌词。您可以使用两行换行符在行之间添加暂停。您可以在歌词的开头和结尾使用双散列标记（##）来添加伴奏。最多200个字符。" 
                        onChange={(e) => setPrompt(e.target.value)} />  
                    
                    <StartButton config={config} title="分割字符串100" onStart={()=>{
                        generateSegments();
                    }}/>
                    
                    <TextareaAutosize id="iptSegments"  
                        style={{ borderRadius: "8px", borderColor:'black'}  } 
                        minRows={20} maxRows={50}  maxLength={1000}
                        className="bg-white w-full text-black border font-medium px-4 py-2" 
                        value={segments}
                        placeholder="result" 
                        onChange={(e) => setSegments(e.target.value)} />                      

                </div>

                <div className="page-tab w-full flex flex-row itesm-center">
                    <TextareaAutosize id="value1"  
                        style={{ borderRadius: "8px", borderColor:'black'}  } 
                        minRows={20} maxRows={50}  maxLength={1000}
                        className="bg-white w-full text-black border font-medium px-4 py-2" 
                        value={value1}
                        onChange={(e) => setValue1(e.target.value)} />  
                   
                    <TextareaAutosize id="value2"  
                        style={{ borderRadius: "8px", borderColor:'black'}  } 
                        minRows={20} maxRows={50}  maxLength={1000}
                        className="bg-white w-full text-black border font-medium px-4 py-2" 
                        value={value2}
                        onChange={(e) => setValue2(e.target.value)} />                      
                </div>

                <div className="page-tab w-full flex flex-row itesm-center">
                    <StartButton config={config} title="测试hash" onStart={async ()=>{
                        const res = await callAPI("/api/testAPI", {
                            cmd: "TEST_HASH",
                            value1, value2
                        });
                        alert(res.result.testResult);
                    }}/>
                </div>
            </main>
        </div>
    );
}


export async function getServerSideProps(ctx: any) {
    return {
        props: {
            config
        },
    };
  
}    
