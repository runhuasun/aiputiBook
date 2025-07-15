import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";

import { authOptions } from "../api/auth/[...nextauth]";
import prisma from "../../lib/prismadb";

import TopFrame from "../../components/TopFrame";

import { Testimonials } from "../../components/Testimonials";
import LoginPage from "../../components/LoginPage";
import FormLabel from "../../components/FormLabel";
import Pagination from '../../components/Pagination';
import Image from "../../components/wrapper/Image";

import { config } from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import * as du from "../../utils/dateUtils";


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let user = null;
    if(session?.user?.email) {
        // Get user from DB
        user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                email: true,
                actors: true
            }
        });
    }    

    return {
        props:{ 
            user,
            config
        }
    };    
}



export default function Cashier({ user, config }: { user:any; config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [purchases, setPurchases] = useState<any[]>([]);
    const [daySum, setDaySum] = useState<number>(0);
    const [weekSum, setWeekSum] = useState<number>(0);    
    const [monthSum, setMonthSum] = useState<number>(0);
    const [yearSum, setYearSum] = useState<number>(0);   
    const [allSum, setAllSum] = useState<number>(0);

    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const mpPageSize = 50;
    const mpRowSize = 8;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>();
    
    function isAdmin(){
        return user && user.actors && user.actors.indexOf("admin")>=0;
    }

    async function onPageChange(page:number){
        try{
            const res = await callAPI("/api/purchaseManager", {
                cmd: "GOTOPAGE", pageSize:mpPageSize, currentPage:page, queryAll: true
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                setMPCurrentPage(page);
                setMPPageCount(res.result.pageCount);
                setPurchases(res.result.data);
            }
        }catch(e){
            console.error(e);
        }
    }

    async function loadSum(){
        try{
            const res = await callAPI("/api/purchaseManager", {
                cmd: "SUM", queryAll: true
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                setDaySum(res.result.daySum);
                setWeekSum(res.result.weekSum);
                setMonthSum(res.result.monthSum);
                setYearSum(res.result.yearSum);
                setAllSum(res.result.allSum);                
            }
        }catch(e){
            console.error(e);
        }
    }
        
    useEffect(() => {
        onPageChange(1);
        loadSum();

        // 设置定时器，每60000毫秒（1分钟）执行一次
        const intervalId = setInterval(() => {
            onPageChange(1);
            loadSum();
        }, 600000); // 指定间隔时间为600000毫秒，即10分钟
        
    }, []); // 空数组表示只在组件挂载时执行一次    
        
    if(status == "authenticated" && isAdmin()){
        
        return (
            <TopFrame config={config}>
                <main className="w-full flex flex-col">
                    <div className="page-tab w-full flex flex-row">
                        <div className="w-1/4 flex flex-col space-y-3">
                            <FormLabel label="今日收银金额"/>
                            <FormLabel label={`${daySum.toFixed(2)}`}/>
                        </div> 

                        <div className="w-1/4 flex flex-col space-y-3">
                            <FormLabel label="本周收银金额"/>
                            <FormLabel label={`${weekSum.toFixed(2)}`}/>
                        </div>   

                        <div className="w-1/4 flex flex-col space-y-3">
                            <FormLabel label="本月收银金额"/>
                            <FormLabel label={`${monthSum.toFixed(2)}`}/>
                        </div>   

                        <div className="w-1/4 flex flex-col space-y-3">
                            <FormLabel label="本年收银金额"/>
                            <FormLabel label={`${yearSum.toFixed(2)}`}/>
                        </div>                           

                        <div className="w-1/4 flex flex-col space-y-3">
                            <FormLabel label="累计收银金额"/>
                            <FormLabel label={`${allSum.toFixed(2)}`}/>
                        </div>                           
                        
                    </div>

                    <table className="table-auto w-full">
                        <thead>
                            <tr>
                                <th className="hidden sm:block">ID</th>
                                <th>用户</th>
                                <th className="hidden sm:block">创建时间</th>
                                <th>完成时间</th>                                
                                <th>付款金额</th>
                                <th>充值点数</th>
                                <th>支付方式</th>                                
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-3">
                        {purchases.map((p) => (
                            <tr className={p.status == "PAID" ? "text-gray-200" : "text-gray-600"}>
                                <td className="hidden sm:block">{p.id}</td>
                                <td><Link href={`/profile?userId=${p.userId}`} target="_blank">{p.userId}</Link> </td>
                                <td className="hidden sm:block">{p.createdAt}</td>
                                <td>{p.updatedAt}</td>
                                <td>{p.payMoney}</td>
                                <td>{p.creditAmount}</td>                                
                                <td>{p.payMethod}</td>                                
                                <td>{p.status}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    <Pagination pageCount={mpPageCount} currentPage={mpCurrentPage} 
                        onPageChange={(page) => {
                            if(onPageChange){
                                onPageChange(page);
                            }
                        }} 
                        />    
                    
                </main>
            </TopFrame>
        );
    }else{
        return(<LoginPage config={config}/>);
    }

        
};
