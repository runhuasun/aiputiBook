import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { getServerSession } from "next-auth";
import { useEffect, useState } from "react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // 引入日期选择器的样式文件
import { useRouter } from "next/router";

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



export default function visitorTrace({ user, config }: { user:any; config:any }) {
    const router = useRouter();
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [startDate, setStartDate] = useState<Date|null>(router?.query.startDate ? new Date(router.query.startDate as string) : new Date(Date.now()-8*3600*1000));
    const [endDate, setEndDate] = useState<Date|null>(router?.query.endDate ? new Date(router?.query.endDate as string) : new Date(Date.now()));
    const [ip, setIP] = useState<string>(router?.query?.ip as string || "");
    const [path, setPath] = useState<string>(router?.query?.path as string || "");
    
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
                cmd: "GOTO_TRACE_PAGE", pageSize:mpPageSize, currentPage:page, path, ip, startDate, endDate
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

    async function queryTraces(){
        onPageChange(1);
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

    useEffect(() => {
        onPageChange(1);
    }, []); // 空数组表示只在组件挂载时执行一次    
        
    if(status == "authenticated" && isAdmin()){
        
        return (
            <TopFrame config={config}>
                <main className="w-full flex flex-col">
                    <div className="page-tab w-full flex flex-col items-center px-14">
                        <div className="w-full flex flex-row items-center space-x-5">
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="开始时间"/>
                                <DatePicker
                                    className="text-black"
                                    selected={startDate}
                                    onChange={(newDate)=>setStartDate(newDate)}
                                    placeholderText="开始日期"
  showTimeSelect
  timeFormat="HH:mm"
  timeIntervals={15} // 时间选择间隔（分钟）
  dateFormat="yyyy-MM-dd HH:mm" // 日期和时间的显示格式
  timeCaption="时间" // 时间选择器的标题
                                    />                                 
                            </div> 
    
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="结束时间"/>
                                <DatePicker
                                    className="text-black"                                
                                    selected={endDate}
                                    onChange={(newDate)=>setEndDate(newDate)}
                                    placeholderText="结束日期"
  showTimeSelect
  timeFormat="HH:mm"
  timeIntervals={15} // 时间选择间隔（分钟）
  dateFormat="yyyy-MM-dd HH:mm" // 日期和时间的显示格式
  timeCaption="时间" // 时间选择器的标题                                    
                                    />                                   
                            </div>   
    
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="路径"/>
                                <input id="iptPath" type="text" value={path} className="input-main" 
                                    onChange={(e) => setPath(e.target.value) } />  
                            </div>   
    
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="IP网址"/>
                                <input id="iptIP" type="text" value={ip} className="input-main" 
                                    onChange={(e) => setIP(e.target.value) } />  
                            </div>                           

                            <button className="button-gold px-4 py-2" onClick={()=>{ queryTraces(); }} >
                                查询
                            </button>
                        </div>

                        <div className="w-full flex flex-row items-center space-x-5">
                            <button className="button-main px-4 py-2" onClick={()=>{ buildSource(); }} >
                                更新用户来源数据
                            </button>
                        </div>

                    </div>

                    <table className="table-auto w-full border-collapse border border-slate-400">
                        <thead>
                            <tr>
                                <th className="border border-slate-300">创建时间</th>
                                <th className="border border-slate-300">访问路径</th>
                                <th className="border border-slate-300">IP</th>
                                <th className="border border-slate-300">用户</th>
                                <th className="border border-slate-300">操作</th>                                
                                <th className="border border-slate-300">更多信息</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-3">
                        {traces.map((p) => (
                            <tr className={p.userId ? "text-gray-200" : "text-gray-600"}>
                                <td className="border border-slate-300">{p.createTime}</td>
                                <td className="border border-slate-300">
                                    <Link href={p.path} target="_blank">
                                        {p.path}
                                    </Link>                                        
                                </td>                                                                
                                <td className="border border-slate-300">
                                    <Link href={`/admin/visitorTrace?ip=${p.ip}&startDate=${new Date(Date.now() - 48 * 3600 * 1000)}&endDate=${new Date()}`} target="_blank">
                                        {p.ip}
                                    </Link>                                        
                                </td>
                                <td className="border border-slate-300">
                                    <Link href={`/profile?userId=${p.userId}`} target="_blank">
                                        {p.userId}
                                    </Link>                                     
                                </td>                                
                                <td className="border border-slate-300">{p.operation}</td>                                
                                <td className="border border-slate-300">{p.desc}</td>
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
