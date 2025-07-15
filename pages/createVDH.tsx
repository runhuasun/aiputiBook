import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import TextareaAutosize from "react-textarea-autosize";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import { Model, VDH } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import DropDown from "../components/DropDown";
import { showModel } from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import FileSelector from "../components/FileSelector";
import Image from "../components/wrapper/Image";
import Title from  "../components/Title";

import * as debug from "../utils/debug";
import { config } from "../utils/config";
import { channelType, channels, channelNames } from "../utils/channels";
import * as monitor from "../utils/monitor";

export default function createVDH({ cModels, pModels, vModels, vdh, config, user }: { cModels: Model[]; pModels: Model[]; vModels: Model[]; vdh: any; config: any; user: any }) {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [id, setId] = useState<string>(vdh ? vdh.id : "");
    const [code, setCode] = useState<string>(vdh ? vdh.code : "");
    const [name, setName] = useState<string>(vdh ? vdh.name : "");
    const [gender, setGender] = useState<string>(vdh ? vdh.gender : "");
    const [birthday, setBirthday] = useState<Date>(vdh ? vdh.birthday : new Date("2000-01-01"));
    const [info, setInfo] = useState<string>(vdh ? vdh.info : "");
    const [desc, setDesc] = useState<string>(vdh ? vdh.desc : "");
    const [label, setLabel] = useState<string>(vdh ? vdh.label : "");
    const [pModelId, setPModelId] = useState<string>(vdh ? vdh.pModelId : "");
    const [cModelId, setCModelId] = useState<string>(vdh ? vdh.cModelId : "");
    const [vModelId, setVModelId] = useState<string>(vdh ? vdh.vModelId : "");
    const [channel, setChannel] = useState<string>(vdh?.channel as channelType || "PUBLIC");
    const [score, setScore] = useState<number>(vdh?.score || 0);
    const [access, setAccess] = useState<string>(vdh?.access || "PRIVATE");

    const fetcher = (url: string) => fetch(url).then(res => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    function setupVDH() {
        return {
            id,
            code,
            name,
            gender,
            birthday,
            info,
            desc,
            label,
            pModelId,
            cModelId,
            vModelId,
            channel,
            score,
            access,
            userId: vdh.userId,
            status: "SUCCESS",
        };
    }

    function checkFields() {
        if (!name || name.length < 1 || name.length > 20) {
            alert("请给应用起一个3 - 20个字的名字吧！");
            return false;
        } else if (!pModelId) {
            alert("请先选择图片模型");
            return false;
        } else if (!cModelId) {
            alert("请先选择对话模型");
            return false;
        } else if (!vModelId) {
            alert("请先选择语音模型");
            return false;
        }
        if (info) {
            try {
                JSON.parse(info);
            } catch {
                alert("配置虚拟数字人的信息需要符合JSON规则，请检查并修改");
                return false;
            }
        }
        return true;
    }

    async function createVDH() {
        if (!checkFields()) return;
        try {
            setLoading(true);
            const res = await fetch("/api/vdhManager", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cmd: "CREATE", vdh: setupVDH() }),
            });
            if (res.status !== 200) {
                setError(await res.json() as any);
            } else {
                const result = await res.json();
                setId(result.id);
                alert("虚拟数字人创建成功！");
                mutate();
            }
        } finally {
            setLoading(false);
        }
    }

    async function updateVDH() {
        if (!checkFields()) return;
        try {
            setLoading(true);
            const res = await fetch("/api/vdhManager", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cmd: "UPDATE", vdh: setupVDH() }),
            });
            if (res.status !== 200) {
                setError(await res.json() as any);
            } else {
                alert("虚拟数字人更新成功！");
                mutate();
            }
        } finally {
            setLoading(false);
        }
    }

    if (status !== "authenticated") {
        return <LoginPage config={config} />;
    }

    return (
        <TopFrame config={config}>
            <main>
                <Title title={`${id ? "更新" : "创建"}虚拟数字人`}/>
                <div className="flex flex-col space-y-4 mt-4 w-full max-w-lg">
                    {/* ...all the form fields stay exactly the same... */}
                    {loading ? (
                        <button disabled className="button-gold rounded-full text-white font-medium px-4 py-2 w-40">
                            <LoadingDots color="white" style="large" />
                        </button>
                    ) : (
                        <button
                            onClick={() => (id ? updateVDH() : createVDH())}
                            className="button-gold rounded-full text-white font-medium px-8 py-2 hover:bg-blue-500/80 transition"
                        >
                            {id ? "更新虚拟数字人" : "创建虚拟数字人"}
                        </button>
                    )}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mt-4">
                            <div className="font-bold">{id ? "更新应用时发生错误" : "创建应用时发生错误"}</div>
                            <div>{error}</div>
                        </div>
                    )}
                </div>
            </main>
        </TopFrame>
    );
}

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const user = session?.user?.email
        ? await prisma.user.findUnique({ where: { email: session.user.email! } })
        : null;
    const userId = user?.id || "";
    const vdhId = ctx.query.vdhId as string | undefined;
    const vdhChannel = (ctx.query.channel as string) || "PUBLIC";

    const vdh = vdhId
        ? await prisma.vDH.findUnique({
              where: { id: vdhId },
              include: { pModel: true, cModel: true, vModel: true },
          })
        : {
              id: "",
              code: "",
              name: "",
              gender: "FEMALE",
              birthday: new Date("2000-01-01"),
              info: "",
              desc: "",
              label: "",
              access: "PUBLIC",
              userId,
              score: 0,
              channel: vdhChannel,
          };

    const [cModels, pModels, vModels] = await Promise.all([
        prisma.model.findMany({
            where: { func: "chat", channel: "FASHION", userId, status: "FINISH" },
            orderBy: { createTime: 'desc' },
        }),
        prisma.model.findMany({
            where: { func: "lora", channel: "FASHION", userId, status: "FINISH" },
            orderBy: { createTime: 'desc' },
        }),
        prisma.model.findMany({
            where: { func: "voice", status: "FINISH" },
            orderBy: [{ theme: 'asc' }, { name: 'asc' }, { createTime: 'desc' }],
        }),
    ]);

    return {
        props: { cModels, pModels, vModels, vdh, config, user },
    };
}
