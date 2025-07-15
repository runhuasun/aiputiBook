import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import { Testimonials } from "../components/Testimonials";
import LoginPage from "../components/LoginPage";
import FormLabel from "../components/FormLabel";
import Pagination from '../components/Pagination';
import Image from "../components/wrapper/Image";

import { config } from "../utils/config";
import {callAPI} from "../utils/apiUtils";
import * as du from "../utils/dateUtils";
import * as monitor from "../utils/monitor";


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    
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



export default function userPayment({ user, config }: { user:any; config:any }) {
    const router = useRouter();

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [purchases, setPurchases] = useState<any[]>([]);

    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const mpPageSize = 50;
    const mpRowSize = 8;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>();
    
    async function onPageChange(page:number){
        try{
            const res = await callAPI("/api/purchaseManager", {
                cmd: "GOTOPAGE", pageSize:mpPageSize, currentPage:page, userId:router.query.userId as string
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

    useEffect(() => {
        onPageChange(1);
    }, []); // 空数组表示只在组件挂载时执行一次  
    
    if(status == "authenticated"){
        return (
            <TopFrame config={config}>
                <main className="w-full flex flex-col">
                     <table className="table-auto w-full">
                        <thead>
                            <tr>
                                <th >付款单号</th>
                                <th >创建时间</th>
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
                                <td >{p.id}</td>
                                <td >{p.createdAt}</td>
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
