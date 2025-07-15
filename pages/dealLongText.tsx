import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { CompareSlider } from "../components/CompareSlider";
import DropDown from "../components/DropDown";
import { themeType, themes, themeNames, themeTitleLabels, themeFileLabels } from "../utils/dealLongTextWays";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Task, Application } from "@prisma/client";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import { config } from "../utils/config";
import * as debug from "../utils/debug";
import LoginPage from "../components/LoginPage";
import Uploader, { mimeTypes } from "../components/Uploader";
import * as monitor from "../utils/monitor";
import Image from "../components/wrapper/Image";
import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const appId = ctx.query.appId as string | undefined;

    let userId = "";
    if (session?.user?.email) {
        const u = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (u) userId = u.id;
    }

    const myTasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createTime: "desc" },
    });

    const app = appId
        ? await prisma.application.findUnique({ where: { id: appId } })
        : undefined;

    return {
        props: {
            task: myTasks[0] ?? undefined,
            app,
            config,
        },
    };
}

export default function dealLongText({
    task,
    app,
    config
}: {
    task: Task | undefined;
    app: Application;
    config: any;
}) {
    let defTitle = "";
    let defLen = 500;
    if (task?.params) {
        const p = JSON.parse(task.params);
        defTitle = p.title ?? "";
        defLen = p.length ?? 500;
    }

    const [loading, setLoading] = useState<boolean>(task?.status === "START");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string>(
        task?.output ?? task?.message ?? ""
    );
    const [refFile, setRefFile] = useState<string>("");

    let theme: themeType = (task?.func as themeType) ?? "ABSTRACT";
    function setTheme(v: themeType) { theme = v; }
    let title = defTitle;
    function setTitle(v: string) { title = v; }
    let length = defLen;
    function setLength(v: number) { length = v; }

    const fetcher = (url: string) => fetch(url).then(res => res.json());
    const { data } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const moduleTheme = router.query.moduleTheme as string | undefined;
    if (moduleTheme) {
        setTheme(moduleTheme as themeType);
        setLength(5000);
    }

    if (task?.status === "START") {
        useEffect(() => {
            const iv = setInterval(() => window.location.reload(), 5000);
            return () => clearInterval(iv);
        }, []);
    } else if (task?.status === "ERROR") {
        task.message = "阅读处理发生错误！请重新尝试。";
    }

    const UploadDropZone = () => (
        <Uploader
            mime={mimeTypes.file}
            setFiles={f => { if (f.length) setRefFile(f[0].uploadedUrl); }}
        />
    );

    async function startProcess() {
        try {
            const res = await fetch("/api/longTextPro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cmd: "readAndPro",
                    theme,
                    title,
                    length,
                    fileUrl: refFile || undefined
                })
            });
            if (res.status !== 200) {
                setError((await res.json()) as any);
                setResult("意外错误");
            }
        } catch (e) {
            debug.error(e);
            setError("意外错误");
        }
    }

    async function calcFile() {
        if (length < 50 || length > 5000) {
            alert("输出结果的长度必须在50到5000之间");
            return;
        }
        if (title.length > 200) {
            alert("输出内容的标题最多200个字");
            return;
        }
        setLoading(true);
        await startProcess();
        window.location.reload();
    }

    useEffect(() => {
        if (router.query.success === "true") toast.success("模型训练成功！");
    }, [router.query.success]);

    if (status !== "authenticated") {
        return <LoginPage config={config} />;
    }

    return (
        <TopFrame config={config}>
            <main>
                <h1 className="title-main">
                    {moduleTheme ? themeNames.get(theme) : "长文本阅读写作"}
                </h1>

                <div className="flex flex-col items-center justify-center bg-loraLab min-h-screen">
                    {!moduleTheme && (
                        <div className="space-y-4 w-full max-w-lg">
                            <div className="flex mt-3 items-center space-x-3">
                                <Image src="/number-1-white.svg" width={30} height={30} alt="1 icon" />
                                <p className="text-left font-medium">阅读写作输出内容</p>
                            </div>
                            <DropDown
                                theme={theme}
                                // @ts-ignore
                                setTheme={setTheme}
                                themes={themes}
                                names={themeNames}
                            />
                        </div>
                    )}

                    <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                            <Image
                                src={moduleTheme ? "/number-1-white.svg" : "/number-2-white.svg"}
                                width={30}
                                height={30}
                                alt="2 icon"
                            />
                            <p className="text-left font-medium">
                                {themeTitleLabels.get(theme)}(0-200字)
                            </p>
                        </div>
                        <input
                            type="text"
                            defaultValue={title}
                            className="input-main"
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-4 w-full max-w-lg">
                        <div className="flex mt-3 items-center space-x-3">
                            <Image
                                src={moduleTheme ? "/number-2-white.svg" : "/number-3-white.svg"}
                                width={30}
                                height={30}
                                alt="3 icon"
                            />
                            <p className="text-left font-medium">输出内容的长度(50-5000字)</p>
                        </div>
                        <input
                            type="text"
                            defaultValue={length}
                            className="input-main"
                            onChange={e => setLength(parseInt(e.target.value || "0"))}
                        />
                    </div>

                    <div className="w-full max-w-lg">
                        <div className="flex mt-3 w-96 items-center space-x-3">
                            <Image
                                src={moduleTheme ? "/number-3-white.svg" : "/number-4-white.svg"}
                                width={30}
                                height={30}
                                alt="4 icon"
                            />
                            <p className="text-left">{themeFileLabels.get(theme)}(.txt/Word/excel/Pdf）</p>
                        </div>
                        <UploadDropZone />
                    </div>

                    {!(app?.settlement === "B2A") && (
                        <div className="w-670 items-left text-left">
                            <p className="px-1 text-left font-medium w-full text-gray-200">
                                <span>
                                    按照1000字/2个{config.creditName}收费，不足1000字的部分收取2个{config.creditName}。
                                </span>
                                {data && !loading && (
                                    <>
                                        <span className="text-gray-200">
                                            你还有{data.remainingGenerations}个{config.creditName}。
                                        </span>
                                        <span>
                                            购买{config.creditName}
                                            <Link
                                                href="/buy-credits"
                                                className="font-semibold text-gray-100 underline underline-offset-2 hover:text-red-200 transition"
                                            >
                                                在这里
                                            </Link>
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    )}

                    {loading ? (
                        <button
                            disabled
                            className="button-gold rounded-full text-white font-medium px-4 pt-2 pb-3 mt-8 w-40"
                        >
                            <span className="pt-4">
                                <LoadingDots color="white" style="large" />
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={calcFile}
                            className="button-gold rounded-full text-white font-medium px-16 py-2 mt-8 hover:bg-blue-500/80 transition"
                        >
                            开始
                        </button>
                    )}

                    {error && (
                        <div
                            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]"
                            role="alert"
                        >
                            <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                                阅读文件处理时发生错误
                            </div>
                            <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                                {error}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 w-full sm:w-2/3 mt-8">
                        <div className="flex mt-4 items-center space-x-3">
                            <p className="text-left font-medium hidden sm:block">阅读处理的结果</p>
                        </div>
                        <TextareaAutosize
                            id="iptResult"
                            style={{ borderRadius: "8px", borderColor: "green" }}
                            maxRows={40}
                            className="input-main"
                            value={result}
                            onChange={e => setResult(e.target.value)}
                        />
                    </div>
                </div>
            </main>
        </TopFrame>
    );
}
