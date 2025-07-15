import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import { showVDH } from "../components/Genhis";


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);

    let label = ctx.query.label;
    let word = ctx.query.word;
    let channel = (ctx.query.channel as string) || "PUBLIC";

    const userAgent = ctx.req.headers["user-agent"] || "";
    const inWeixin = /MicroMessenger/.test(userAgent);

    const isLogin = (session?.user?.email) ? true : false;

    const user = (isLogin && session?.user?.email)
        ? await prisma.user.findUnique({
              where: { email: session.user.email },
          })
        : undefined;

    const whereTerm: any = {
        access: "PUBLIC",
        status: "SUCCESS",
    };

    if (label && label !== "ALL") {
        whereTerm.label = { contains: label };
    }
    if (channel) {
        whereTerm.channel = channel;
    }
    if (word) {
        whereTerm.OR = [
            { name: { contains: word } },
            { desc: { contains: word } },
            { labels: { contains: word } },
        ];
    }

    let vdhs = await prisma.vDH.findMany({
        where: whereTerm,
        include: {
            pModel: true,
            cModel: true,
            vModel: true,
        },
        orderBy: [
            { score: "desc" },
            { likes: "desc" },
        ],
        take: 100,
    });

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            user,
            vdhs,
            config,
            inWeixin,
        },
    };
}

export default function VDHList({
    user,
    vdhs,
    config,
    inWeixin,
}: {
    user: any;
    vdhs: any[];
    config: any;
    inWeixin: boolean;
}) {
    const [error, setError] = useState<string | null>(null);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [word, setWord] = useState<string>(
        (useRouter().query.word as string) || ""
    );

    const router = useRouter();
    const appId = router.query.appId;
    const windowTitle = (router.query.title as string) || "虚拟数字人";

    async function action(vdh: any, url: string) {
        if (user && vdh) {
            if (inWeixin && appId) {
                const service =
                    "/api/appUserConfig?cmd=UPDATE&msgToWechat=true&appId=" +
                    appId +
                    "&userId=" +
                    user.id +
                    "&key=VDH_ID&value=" +
                    vdh.id;
                const res = await fetch(service, {
                    method: "POST",
                    headers: { "Content-Type": "application/xml" },
                });
                await res.json();
                if (
                    typeof WeixinJSBridge === "object" &&
                    typeof WeixinJSBridge.invoke === "function"
                ) {
                    WeixinJSBridge.invoke("hideToolbar");
                    WeixinJSBridge.invoke("closeWindow", {}, () => {});
                }
            } else {
                window.location.href = url;
            }
        } else {
            window.location.href = url;
        }
    }

    function search() {
        if (word && word.length > 0) {
            const params = new URLSearchParams(window.location.search);
            params.set("word", word);
            params.set("pointer", "0");
            window.location.href =
                "/VDHMarket?" + params.toString();
        } else {
            alert("请先输入你想搜索的内容");
        }
    }

    if (status === "authenticated") {
        return (
            <TopFrame config={config}>
                <main>
                    <div className="hidden w-full pt-5 sm:w-1/2 flex flex-row items-center justify-center mb-6">
                        <input
                            id="iptWord"
                            type="text"
                            value={word}
                            className="input-search flex flex-1 rounded-xl mx-1 sm:mx-0 font-medium px-4 h-10"
                            onChange={(e) => setWord(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                                        search();
                                    }
                                }
                            }}
                        />
                        <button
                            className="flex w-30 h-10 px-6 sm:px-8 mx-1 button-gold rounded-xl items-center"
                            onClick={search}
                        >
                            搜索
                        </button>
                    </div>

                    <div className="items-center w-full sm:pt-2 pt-0 flex sm:flex-row px-3 space-y-0 sm:space-y-3 sm:mb-0 mb-3">
                        <div className="flex flex-row flex-col space-y-0 sm:space-y-10 mt-4 mb-4 pt-1 rounded-xl items-center w-full space-x-2">
                            <div
                                className={
                                    "grid grid-flow-row-dense gap-3 items-center" +
                                    (inWeixin
                                        ? " grid-cols-2 w-full "
                                        : " grid-cols-2 sm:grid-cols-6 ")
                                }
                            >
                                {vdhs.map((m) =>
                                    showVDH(m, action, " rounded-xl ", " text-gray-100 ")
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </TopFrame>
        );
    } else {
        return <LoginPage config={config} />;
    }
}
