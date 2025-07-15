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
import DropDown from "../../components/DropDown";
import Image from "../../components/wrapper/Image";

import { config } from "../../utils/config";
import {callAPI} from "../../utils/apiUtils";
import * as du from "../../utils/dateUtils";
import * as debug from "../../utils/debug";


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

const orderByFields: string[] = [
    "source",
    "createdAt"
];
const orderByFieldNames = new Map([
    ["source", "source"],
    ["createdAt", "createdAt"]
    ]);

export default function userManager({ user, config }: { user:any; config:any }) {
    const router = useRouter();
    
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    // 获取当前时间
    const now = new Date();
    // 创建前一天的时间
    const startTime = new Date(now);
    startTime.setHours(0, 0, 1, 1);    
    
    const [startDate, setStartDate] = useState<Date|null>(router?.query.startDate ? new Date(router.query.startDate as string) : startTime);
    const [endDate, setEndDate] = useState<Date|null>(router?.query.endDate ? new Date(router?.query.endDate as string) : now);
    const [userId, setUserId] = useState<string>("");
    const [userName, setUserName] = useState<string>("");
    const [userInvitedByCode, setUserInvitedByCode] = useState<string>("");    
    const [userSource, setUserSource] = useState<string>("");
    const [orderBy, setOrderBy] = useState<string>("createdAt");
    
    const [users, setUsers] = useState<any[]>([]);
  
    const [mpPageCount, setMPPageCount] = useState<number>(0);
    const [mpRowCount, setMPRowCount] = useState<number>(0);    
    const mpPageSize = 200;
    const mpRowSize = 8;    
    const [mpCurrentPage, setMPCurrentPage] = useState<number>(1);
    const [mps, setMPs] = useState<any[]>();
    
    function isAdmin(){
        return user && user.actors && user.actors.indexOf("admin")>=0;
    }
 
    async function onPageChange(page:number){
        try{
            const res = await callAPI("/api/queryUsers", {
                cmd: "GOTOPAGE", pageSize:mpPageSize, currentPage:page, startDate, endDate, 
                id: userId,
                name: userName, 
                source: userSource,
                invitedbycode: userInvitedByCode,
                orderBy,
            });

            if(res.status != 200){
                alert(JSON.stringify(res.result as any));
            }else{
                setMPCurrentPage(page);
                setMPPageCount(res.result.pageCount);
                setMPRowCount(res.result.rowCount);
                setUsers(res.result.users);
            }
        }catch(e){
            alert(e);
        }
    }

    async function queryUsers(){
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
            alert(e);
        }
    }

    useEffect(() => {
        onPageChange(1);
    }, []); // 空数组表示只在组件挂载时执行一次    

    let row = 0;
    
    if(status == "authenticated" && isAdmin()){
        
        return (
            <TopFrame config={config}>
                <main className="w-full flex flex-col text-xs">
                    <div className="page-tab w-full flex flex-col items-center px-14">
                        <div className="w-full flex flex-row flex-wrap flex-wrap items-center space-x-5">
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="最早时间"/>
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
                                <FormLabel label="最晚时间"/>
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
                                <FormLabel label="id"/>
                                <input id="ipUserId" type="text" value={userId} className="input-main" 
                                    onChange={(e) => setUserId(e.target.value) } />  
                            </div>                           
                          
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="来源(source)"/>
                                <input id="ipUserSource" type="text" value={userSource} className="input-main" 
                                    onChange={(e) => setUserSource(e.target.value) } />  
                            </div>   
    
                            <div className="flex flex-col space-y-3">
                                <FormLabel label="名字(name)"/>
                                <input id="ipUserName" type="text" value={userName} className="input-main" 
                                    onChange={(e) => setUserName(e.target.value) } />  
                            </div>                           

                            <div className="flex flex-col space-y-3">
                                <FormLabel label="InvitedByCode"/>
                                <input id="ipInvitedByCode" type="text" value={userInvitedByCode} className="input-main" 
                                    onChange={(e) => setUserInvitedByCode(e.target.value) } />  
                            </div>                           

                            <div className="flex flex-col space-y-3">
                                <FormLabel label="排序方式"/>
                                <DropDown
                                    theme={orderBy}
                                    // @ts-ignore
                                    setTheme={(newRoom) => setOrderBy(newRoom)}
                                    themes={orderByFields}
                                    names={orderByFieldNames}
                                    />
                            </div>
                            
                            <button className="button-gold px-4 py-2" onClick={()=>{ queryUsers(); }} >
                                查询
                            </button>
                        </div>

                        <div className="w-full flex flex-row items-center space-x-5">
                            <button className="button-main px-4 py-2" onClick={()=>{ buildSource(); }} >
                                更新用户来源数据
                            </button>
                        </div>

                    </div>
                    
                    <div className="w-full overflow-x-auto rounded-lg scrollbar-thin">
                      <table className="table-fixed w-full border-collapse border border-slate-400">
                        <colgroup> {/* 添加列宽定义 */}
                          <col className="w-12" />  {/* No列 */}
                          <col className="w-52" /> {/* id列 */}
                          <col className="w-40 invisible sm:visible"/> {/* name列 */}
                          <col className="w-52 invisible sm:visible" /> {/* email列 */}
                          <col className="w-20" />  {/* credits列 */}
                          <col className="w-28" />  {/* boughtCredits列 */}
                          <col className="min-w-[300px]" /> {/* source列 */}
                          <col className="w-40 invisible sm:visible" /> {/* createdAt列 */}
                          <col className="w-52 invisible sm:visible" /> {/* invitedbycode列 */}
                        </colgroup>
                    
                        {/* 完整的表头部分 */}
                        <thead className="bg-slate-800"> {/* 添加表头背景色 */}
                          <tr>
                            <th className="p-2 border border-slate-600">No</th>
                            <th className="p-2 border border-slate-600">id</th>
                            <th className="p-2 border border-slate-600 hidden sm:table-cell">name</th>
                            <th className="p-2 border border-slate-600 hidden sm:table-cell">email</th>
                            <th className="p-2 border border-slate-600">credits</th>
                            <th className="p-2 border border-slate-600">boughtCredits</th>
                            <th className="p-2 border border-slate-600">source</th>
                            <th className="p-2 border border-slate-600 hidden sm:table-cell">createdAt</th>
                            <th className="p-2 border border-slate-600 hidden sm:table-cell">invitedbycode</th>
                          </tr>
                        </thead>
                          
                        {/* 保持原有thead结构不变 */}
                        <tbody className="divide-y divide-slate-400"> {/* 改用分割线 */}
                          {users.map((p, index) => (
                            <tr 
                              key={p.id} 
                              className={`${index % 2 ? 'bg-slate-800' : 'bg-slate-900'} hover:bg-slate-700`}
                            >
                              {/* 所有单元格添加通用样式 */}
                              <td className="p-2 border border-slate-600 whitespace-nowrap">{mpRowCount-mpPageSize*(mpCurrentPage-1) -index}</td>
                              <td className="p-2 border border-slate-600 break-words max-w-[200px]">
                                <Link href={`/profile?userId=${p.id}`} target="_blank"
                                  className="text-blue-400 hover:text-blue-300 truncate block"
                                >
                                  {p.id}
                                </Link>
                              </td>
                              <td className="p-2 border border-slate-600 break-words max-w-[120px] hidden sm:table-cell">
                                {p.name}
                              </td>
                              <td className="p-2 border border-slate-600 break-words max-w-[120px] hidden sm:table-cell">
                                {p.email}
                              </td>
                              <td className="p-2 border border-slate-600 text-right">{p.credits}</td>
                              <td className="p-2 border border-slate-600 text-right">{p.boughtCredits}</td>
                              <td className="p-2 border border-slate-600 break-words max-w-[500px]">
                                {/* 保持原有逻辑，添加截断样式 */}
                                {(!p.source || p.source === "no source") ? (
                                  <span className="text-gray-400">{p.source}</span>
                                ) : (
                                  <Link href={p.source} target="_blank"
                                    className="text-blue-400 hover:text-blue-300 break-all"
                                  >
                                    {p.source}
                                  </Link>
                                )}
                              </td>
                              <td className="p-2 border border-slate-600 break-words max-w-[120px] hidden sm:table-cell">
                                {p?.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}
                              </td>
                              <td className="p-2 border border-slate-600 break-words max-w-[120px] hidden sm:table-cell">
                                {p.invitedbycode === "walkin" ? (
                                  <span className="text-green-400">{p.invitedbycode}</span>
                                ) : (
                                  <Link href={`/profile?userId=${p.invitedbycode}`} target="_blank"
                                    className="text-blue-400 hover:text-blue-300 break-all"
                                  >
                                    {p.invitedbycode}
                                  </Link>
                                )}
                              </td>
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

                </main>
            </TopFrame>
        );
    }else{
        return(<LoginPage config={config}/>);
    }

};
