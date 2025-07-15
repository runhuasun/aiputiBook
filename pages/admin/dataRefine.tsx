import { useState } from "react";
import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import * as qr from 'qr-image';
import Link from "next/link";
import prisma from "../../lib/prismadb";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import React from 'react';
import { Request } from 'express';
import cheerio from 'cheerio';
import TextareaAutosize from "react-textarea-autosize";
import { config } from "../../utils/config";
import Image from "../../components/wrapper/Image";

export async function getServerSideProps(ctx: any) {
    return {
        props:{ 
            config
        }
    };    
}


export default function dataRefine({ config }: { config:any }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [inputText, setInputText] = useState("");
    const [outputText, setOutputText] = useState("");
    const [startNum, setStartNum] = useState("1");
    
    function refineDataXuexiqiangguo(){
        const lines = inputText.split("\n");
        let output = "";
        let num = startNum ? parseInt(startNum) : 1;
        
        for(const line of lines){
            if(line.startsWith("VW")){
                output += num + ".\n";
                num++
            }else{
                output += line + "\n";
            }
        }
        setStartNum(num.toString());
        setOutputText(output);        
    }
    

    function removeRawdata(){
        
    }

    async function clearBodyStr(){
        const res = await fetch("/api/updateRoom", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cmd:"REMOVE_BASE64_FROM_BODYSTR" }),
        });
        let response = (await res.json());
        if (res.status !== 200) {
            alert(response as any);
        } else {
            alert(`BODYSTR更新成功`);
        }
    }
    
    
    return (
        <div className="flex mx-auto w-full  flex-col items-center justify-center min-h-screen">
            <Head>
                <title>数据管理</title>
            </Head>
            
            <Header config={config} title="数据管理"/>
           
            <main className="flex flex-1 w-full flex-col items-center justify-center text-center sm:px-4 px-0 py-6 background-gradient">
                
                <div className="w-full flex flex-row">
                    <div className="py-10 space-x-5 flex flex-row w-1/2">
                        输入内容
                        <TextareaAutosize id="inputText" 
                            style={{ borderRadius: "8px", borderColor:'green'}  }        
                            rows={2} maxRows={10}
                            className="bg-white w-full text-black border border-greean-400 font-medium px-4 py-2 " 
                            value={inputText}
                            onChange={(e) => {
                                setInputText(e.target.value);
                            }}
                            /> 
                    </div>
                    
                    <div className="py-10 space-x-5 flex flex-row w-1/2">
                        输出内容                
                        <TextareaAutosize id="outputText" 
                            style={{ borderRadius: "8px", borderColor:'green'}  }        
                            rows={2} maxRows={10}
                            className="bg-white w-full text-black border border-greean-400 font-medium px-4 py-2 " 
                            value={outputText}
                            onChange={(e) => {
                                setOutputText(e.target.value);
                            }}
                            /> 
                    </div>
                </div>
                
                <div className="w-full flex flex-row">
                    起始数字                
                    <TextareaAutosize id="startNum" 
                        style={{ borderRadius: "8px", borderColor:'green'}  }        
                        rows={2} maxRows={10}
                        className="bg-white w-1/4 text-black border border-greean-400 font-medium px-4 py-2 " 
                        value={startNum}
                        onChange={(e) => {
                            setStartNum(e.target.value);
                        } }
                        /> 
                </div>
                
                <div className="py-10 space-x-5 flex flex-row" >
                    <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                        onClick={() => {
                            refineDataXuexiqiangguo();
                        }} >
                        <span>精炼数据</span>
                    </button> 
                </div>

                <div className="py-10 space-x-5 flex flex-row" >
                    <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                        onClick={() => {
                            clearBodyStr();
                        }} >
                        <span>清理BODYSTR</span>
                    </button> 
                </div>


                <div className="py-10 space-x-5 flex flex-row" >
                    <button className="bg-blue-500 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                        onClick={async () => {
                            const res = await fetch("/api/updateRoom", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ cmd:"COPY_THUMBNAIL" }),
                            });
                            let response = (await res.json());
                            if (res.status !== 200) {
                                alert(response as any);
                            } else {
                                alert(`COPY_THUMBNAIL更新成功`);
                            }
                        }} >
                        <span>数据误删除COPY_THUMBNAIL</span>
                    </button> 
                </div>
                
                
            </main>
        </div>
    );
}
