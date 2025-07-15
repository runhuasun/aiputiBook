import React from "react";
import Link from "next/link";

import TopFrame from "../../components/TopFrame";
import Image from "../../components/wrapper/Image";

import { config } from "../../utils/config";
import * as monitor from "../../utils/monitor";


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    return {
        props:{ 
            config
        }
    };    
}

const demos:any[] = [
    {no:1, title:"与心心念念的他/她拍一张合影"},
    {no:2, title:"给远在他乡的闺蜜发一张合影"},
    {no:3, title:"给亲人拍一张期待已久的合影"},
    {no:4, title:"跟我的巨星爱豆拍张亲密合影"},    
];


export default function groupPhoto({ config }: { config:any }) {

    function showDemo(demo:any){
        return (
            <>
                <button 
                    onClick={() => {
                        window.location.href=`/takeGroupPhoto`;
                    }}
                    className=" text-xl sm:text-3xl text-gray-400 "
                    >
                    “{demo.title}”
                </button> 
                <Link className="w-full flex flex-col sm:flex-row items-center justify-center rounded-xl" href="/takeGroupPhoto">
                    <div className="w-full sm:w-1/2 flex flex-row items-center justify-center">
                        <Image alt="图片素材" src={ `${config.RS}/adv/groupPhoto/demo${demo.no}_1.jpg`}
                            className="rounded-full w-1/2 p-2"
                            />
                        <Image alt="图片素材" src={ `${config.RS}/adv/groupPhoto/demo${demo.no}_2.jpg`}
                            className="rounded-full w-1/2 p-2" 
                            />
                    </div>                        
                    <Image alt="图片素材" src={ `${config.RS}/adv/groupPhoto/demo${demo.no}_3.jpg`}
                        className="rounded-full w-full sm:w-1/2 p-2" 
                        />
                </Link>        
            </>
            );
    }
    
    return (
        <TopFrame config={config}>
         
            <main className="w-full flex flex-col space-y-12 items-center">
                <div className="w-full mt-6 flex flex-col items-center">                    
                    <button className="moonlight-text text-center text-3xl  tracking-widest ">
                        无需相遇，也能相聚
                    </button> 
                    <span className="w-full text-center text-base sm:text-xl font-display tracking-wide text-gray-200 mt-4">
                        AI合影让感情的连接成为随时随地的可能
                    </span>  
                </div>  

                <div id="demos" className="w-full grid grid-flow-row-dense grid-cols-1 justify-center gap-8 items-center">
                    {demos.map((demo:any) => (
                        showDemo(demo)
                    ))}
                </div>
                
                <button 
                    onClick={() => {
                        window.location.href=`/takeGroupPhoto`;
                    }}
                    className=" px-8 sm:px-16 py-3 mt-10 mb-15 button-gold text-xl sm:text-3xl  "
                    >
                    现在开始拍摄我们的合影吧！
                </button>  
            </main>
        </TopFrame>
    );


        
};
