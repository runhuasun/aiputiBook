import React, { useEffect, useState } from 'react';
import Link from "next/link";
import Image from "./wrapper/Image";

interface ShareProps {
    name: string;
    title: string;
    text: string;
    url: string;
    className?: string;
    image?: string
}


export default function ShareButton({name, title, text, url, className="button-gold px-8 py-2", image }:ShareProps){

    const share = async () => {
        // Check if the Web Share API is supported
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                // Call navigator.share() method and pass in the data to share
                await navigator.share({
                    title,
                    text,
                    url,
                });
            } catch (e) {
                // If sharing fails, log an error
                console.error("分享失败：" + e);
            }
        } else {
            // If the Web Share API is not supported, show a warning
            alert('请点击左下角浏览器的"..." 按钮，通过浏览器分享。');
        }
    };
    
    if(image){
        return (
            <Link href="#" className={className} 
                onClick={() => {
                    if (typeof navigator !== 'undefined') {
                        share();
                    } else {
                        console.error('navigator is not defined');
                    }
                }}
                >
                <Image src={image} alt={name} className="w-full h-auto rounded-xl"/>
            </Link>
            );
    }else{
        return (
            <button
                onClick={() => {
                    if (typeof navigator !== 'undefined') {
                        share();
                    } else {
                        console.error('navigator is not defined');
                    }
                }}
                className={ className }
                >
                {name}
            </button>
        );
    }
};

