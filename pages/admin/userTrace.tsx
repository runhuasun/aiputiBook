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
    let traceUser = null;
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

    const traceUserId = ctx?.query?.userId;
    if(traceUserId){
        traceUser = await prisma.user.findUnique({
            where: {
                id: traceUserId
            }
        });
    }
    
    return {
        props:{ 
            user,
            traceUser,
            config
        }
    };    
}



export default function userTrace({ user, traceUser, config }: { user:any; traceUser:any, config:any }) {
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [traces, setTraces] = useState<any[]>([]);

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
            const res = await callAPI("/api/adminSysTrace", {
                cmd: "GOTOPAGE", pageSize:mpPageSize, currentPage:page, userId: traceUser.id
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                setMPCurrentPage(page);
                setMPPageCount(res.result.pageCount);
                setTraces(res.result.traces);
            }
        }catch(e){
            console.error(e);
        }
    }

    async function buildSource(){
        try{
            const res = await callAPI("/api/adminSysTrace", {
                cmd: "BUILD_SOURCE"
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                alert("用户来源计算完毕!");
            }
        }catch(e){
            console.error(e);
        }
    }

    
    async function callBackOCPC(cmd:string){
        const c1 = await confirm("这个操作非常危险，会导致OCPC数据错误，你确认要继续操作码？");
        if(!c1){
            return;
        }
        const c2 = await confirm("再次警告：这个操作非常危险，会导致OCPC数据错误，你确认要继续操作码？");
        if(!c2){
            return;
        }
        const c3 = await confirm("又又又又又又又又又又再次警告：这个操作非常危险，会导致OCPC数据错误，你确认要继续操作码？");
        if(!c3){
            return;
        }
        
        try{
            const res = await callAPI("/api/adminSysTrace", {
                cmd: cmd,
                userId: traceUser.id,
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                alert("用户OCPC回调完毕!");
            }
        }catch(e){
            console.error(e);
        }
    }
    
    useEffect(() => {
        onPageChange(1);
    }, []); // 空数组表示只在组件挂载时执行一次    
        
    if(status == "authenticated" && isAdmin()){
        
        return (
            <TopFrame config={config}>
                <main className="w-full flex flex-col">
                    <div className="page-tab w-full flex flex-row">
                        <div className="flex flex-col space-y-3">
                            <FormLabel label="用户ID"/>
                            <FormLabel label={`${traceUser.id}`}/>
                        </div> 

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="电话/微信"/>
                            <FormLabel label={`${traceUser.email}`}/>
                        </div>   

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="用户名"/>
                            <FormLabel label={`${traceUser.name}`}/>
                        </div>   

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="购买点数"/>
                            <FormLabel label={`${traceUser.boughtCredits}`}/>
                        </div>                           

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="剩余点数"/>
                            <FormLabel label={`${traceUser.credits}`}/>
                        </div>                           

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="注册时间"/>
                            <FormLabel label={`${traceUser.createdAt}`}/>
                        </div>   

                        <div className="flex flex-col space-y-3">
                            <FormLabel label="注册来源"/>
                            <FormLabel label={`${traceUser.source}`}/>
                        </div>                          

                    </div>
                    
  {/* 表格滚动容器 */}
<div className="w-full max-w-full overflow-x-auto">
  <table className="table-auto w-full border-collapse border border-slate-400">
    <thead>
      <tr>
        <th className="border p-2 text-left align-top whitespace-normal break-words">创建时间</th>
        <th className="border p-2 text-left align-top whitespace-normal break-words max-w-[200px]">访问路径</th>
        <th className="border p-2 text-left align-top whitespace-normal break-words">操作</th>
        <th className="border p-2 text-left align-top whitespace-normal break-words max-w-[200px]">更多信息</th>
      </tr>
    </thead>
    <tbody>
      {traces.map((p) => (
        <tr key={p.createTime} className={p.userId ? "text-gray-200" : "text-gray-600"}>
          <td className="border p-2 whitespace-normal break-words align-top">{p.createTime}</td>
          <td className="border p-2 whitespace-normal break-words align-top max-w-[200px]">
            <Link href={p.path} target="_blank">{p.path}</Link>
          </td>
          <td className="border p-2 whitespace-normal break-words align-top">{p.operation}</td>
          <td className="border p-2 whitespace-normal break-words align-top max-w-[200px]">{p.desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>


                    <Pagination pageCount={mpPageCount} currentPage={mpCurrentPage} 
                        onPageChange={(page) => {
                            if(onPageChange){
                                onPageChange(page);
                            }
                        }} 
                        />    


                    <div className="mt-96 flex flex-row items-center space-x-10">
                        <button className="button-main px-4 py-2" onClick={()=>{ callBackOCPC("CALL_BACK_OCPC_REG"); }} >
                            手工回调OCPC注册
                        </button>

                        <button className="button-main px-4 py-2" onClick={()=>{ callBackOCPC("CALL_BACK_OCPC_PAY"); }} >
                            手工回调OCPC付款
                        </button>
                        
                    </div>
                </main>
            </TopFrame>
        );
    }else{
        return(<LoginPage config={config}/>);
    }

        
};
