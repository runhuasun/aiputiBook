import Head from "next/head";
import Header from "../components/Header";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Footer from "../components/Footer";
import prisma from "../lib/prismadb";
import { Room, User } from "@prisma/client";
import { RoomGeneration } from "../components/RoomGenerator";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";

import Image from "../components/wrapper/Image";
import SquigglyLines from "../components/SquigglyLines";
import { useEffect, useState } from "react";
import {showRoom} from "../components/Genhis";
import { Testimonials } from "../components/Testimonials";
import { useRouter } from "next/router";
import React from 'react';
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";





export default function index( { config }: {config: any} ) {
    
    const { data: session } = useSession();
    const router = useRouter();
    const preWord = router.query.word as string;
    const [word, setWord] = useState<string>(preWord ? preWord : "");
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const imageUrls = [
        [`${config.RS}/aimoteku/index/model1.jpg`, '虚拟数字人', 'M24030703，气质女模，2024', '/lora?price=2&model=M24030703'],
        [`${config.RS}/aimoteku/index/model2.jpg`, '虚拟数字人', 'M24030508，青春女模，2024', '/lora?price=2&model=M24030508'],
        [`${config.RS}/aimoteku/index/model4.jpg`, '虚拟数字人', 'M24030512，汽车模特，2024', '/lora?price=2&model=M24030512'],
        [`${config.RS}/aimoteku/index/model3.jpg`, '虚拟数字人', 'M24030502，运动女模，2024', '/lora?price=2&model=M24030502'],
        [`${config.RS}/aimoteku/index/model5.jpg`, '虚拟数字人', 'M24030509，时装女模，2024', '/lora?price=2&model=M24030509'],
    ]; // 图片数组
    
    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentIndex((currentIndex + 1) % imageUrls.length);
        }, 5000);
        return () => clearInterval(intervalId);
    }, [currentIndex, imageUrls.length]);

    
    return (
        <div className="flex mx-auto w-full flex-col items-center justify-center min-h-screen">
            
            <Header config={config} noMargin={true} />      
            <Link className="relative w-full text-left items-left text-white text-3xl sm:block hidden" href={imageUrls[currentIndex][3]}>
                <Image
                    alt="AI作品"
                    src={imageUrls[currentIndex][0]}
                    className=" object-cover w-full shadow-dark-corners"
                    loading="lazy"
                    />
                <div className="absolute inset-0 bg-gradient-to-tr from-black to-transparent mix-blend-multiply dark-corners"></div>

                <div className="absolute bottom-0 left-0 mb-40 space-y-5" >
                    <p className="px-10 text-5xl text-left  font-display font-bold">
                        “{imageUrls[currentIndex][1]}”
                    </p>
                    <p className="px-10 mt-2 text-1xl text-left  font-display ">
                        —— {imageUrls[currentIndex][2]}
                    </p>    
                </div>
            </Link>

            <button 
                onClick={() => {
                    window.location.href="/modelMarket?func=lora&channel=FASHION&title=AI模特库";
                }}
                className=" px-10 py-4 mt-8 mb-20 button-gold text-xl  "
                >
                选择你心仪的AI模特...
            </button>              
    
            <main className="mt-10 sm:mt-0 sm:bg-gray-100">
                <span className="text-xl sm:text-4xl font-display font-bold tracking-normal text-gray-500 mt-10 sm:mt-20 mb-0">
                    “用AI数字人，更科技、更时尚、更经济”
                </span>
                
                <Testimonials websiteName={config.websiteName} />
                
            </main>
            <Footer websiteName={config.websiteName} />
        </div>
    );
}




export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
    return {
        props: {
            config
        },
    };
}

