import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Link from "next/link";
import Head from "next/head";
import React, { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import FormLabel from "../components/FormLabel";

import Image from "../components/wrapper/Image";

import { hasSensitiveWord } from "../utils/sensitiveWords";
import { parseParams, replaceKeyValues, checkSyntax } from "../utils/formularTools";
import { Toaster, toast } from "react-hot-toast";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";

import { callAPI } from "../utils/apiUtils";

export default function createPromptApp({
    image,
    userId,
    sysPrompts,
    config
}: {
    image: Room;
    userId: string;
    sysPrompts: string;
    config: any;
}) {
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [photoName, setPhotoName] = useState<string | null>(null);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [prompt, setPrompt] = useState(
        `${image?.prompt || ""}${sysPrompts ? ", " + sysPrompts : ""}`
    );

    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [price, setPrice] = useState("4");

    const router = useRouter();

    async function createApp() {
        if (!name) {
            alert("需要给提示词创意起个名字，他是唯一标识");
            return;
        }
        const nPrice = parseInt(price);
        if (isNaN(nPrice) || nPrice < 4 || nPrice > 10000) {
            alert("模型价格必须是一个介于4到10000的整数！");
            return;
        }

        if (hasSensitiveWord(name)) {
            alert("输入创意名称中有敏感词，请修改！");
            return;
        }
        if (hasSensitiveWord(desc)) {
            alert("输入的描述中有敏感词，请修改！");
            return;
        }

        if (!prompt.trim()) {
            alert("提示词不能为空，请修改！");
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        setLoading(true);

        const res = await callAPI("/api/createPrompt", {
            id: "",
            code: name,
            name,
            func: image.func,
            coverImg: image.outputImage,
            formular: checkSyntax(prompt.trim()),
            price,
            access: "PRIVATE",
            desc: desc.trim(),
            cmd: "CREATE",
            initRoomId: image.id
        });

        if (res.status !== 200) {
            setError(res.result);
        } else {
            mutate();
            window.location.href = "/dashboard?segment=PROMPT";
        }

        setTimeout(() => {
            setLoading(false);
        }, 1300);
    }

    let num = 1;

    if (status === "authenticated") {
        return (
            <TopFrame config={config}>
                <main>
                    <div className="space-y-4 w-4/5 mb-5 items-center text-center">
                        <FormLabel number={`${num++}`} label="创意的提示词" />

                        <TextareaAutosize
                            id="iptPrompt"
                            value={prompt}
                            style={{ borderRadius: "8px" }}
                            className="bg-white rounded-full w-full text-black border font-medium px-4 py-2 hover:bg-gray-100 transition sm:mt-0 mt-2 h-16"
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                        <p className="text-white text-center items-center bg-black opacity-60 w-full sm:px-2 px-1 sm:py-2 py-1">
                            如果觉得图片生成的不错，可以把它做成创意，其他人就可以生成和你一样的图片，你也能获得
                            {config.creditName}收入。提示词中让其它人填空的地方，可以用[标签:范例]来设置最多三个参数。例如：
                            一只[什么动物:恐龙]，从[什么地方:校园的森林]里路过。
                        </p>
                    </div>

                    <div className="flex sm:space-x-4 sm:flex-row flex-col pt-5">
                        <div className="sm:mt-0 mt-8 flex flex-1">
                            <h2 className="mb-1 font-medium text-lg">
                                生成效果（作为创意封面）
                            </h2>
                            <Image
                                alt="restored photo"
                                src={image?.outputImage}
                                className="rounded-2xl relative sm:mt-0 mt-2"
                                width={512}
                                height={512}
                            />
                        </div>
                        <div className="sm:mt-0 mt-8 flex flex-col space-y-5 max-w-lg">
                            <FormLabel
                                number={`${num++}`}
                                label="创意名称(唯一标识必填)"
                            />
                            <input
                                id="appName"
                                type="text"
                                value={name}
                                className="input-main w-full"
                                onChange={(e) => setName(e.target.value)}
                            />

                            <FormLabel number={`${num++}`} label="创意简介(可选)" />
                            <input
                                id="appDesc"
                                type="text"
                                value={desc}
                                className="input-main w-full"
                                onChange={(e) => setDesc(e.target.value)}
                            />

                            <button
                                onClick={createApp}
                                className="button-main rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-blue-500/80 transition"
                            >
                                保存创意
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-8 max-w-[575px]"
                            role="alert"
                        >
                            <div className="bg-red-500 text-white font-bold rounded-t px-4 py-2">
                                服务发生错误，请稍后重新尝试...
                            </div>
                            <div className="border border-t-0 border-red-400 rounded-b bg-red-100 px-4 py-3 text-red-700">
                                {error}
                            </div>
                        </div>
                    )}
                </main>
            </TopFrame>
        );
    } else {
        return <LoginPage config={config} />;
    }
}

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let user: any;
    let image: Room | null = null;
    const imageId = ctx.query.roomId as string;
    const sysPrompts = (ctx.query.sysPrompts as string) || "";

    if (session?.user?.email) {
        user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, credits: true, name: true }
        });
    }

    if (imageId) {
        image = await prisma.room.findUnique({ where: { id: imageId } });
    }

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            image,
            userId: user?.id || "",
            sysPrompts,
            config
        }
    };
}
