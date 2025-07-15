import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";

import { log, error } from "../utils/debug";
import { giveFreeCreditsById } from "./api/creditManager";
import prisma from "../lib/prismadb";
import { compare } from "bcrypt";
import { config } from "../utils/config";
import * as enums from "../utils/enums";
import * as monitor from "../utils/monitor";
import LoginPage from "../components/LoginPage";
import TopFrame from "../components/TopFrame";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    const email = ctx.query.email;
    const cmd = ctx.query.cmd;
    const checkcode = ctx.query.checkcode;

    try {
        if (email && cmd === "CHECKEMAIL" && checkcode) {
            const user = await prisma.user.findUnique({
                where: { email: email! },
                select: {
                    id: true,
                    name: true,
                    credits: true,
                    email: true,
                    emailVerified: true,
                    invitedbycode: true,
                },
            });

            if (user) {
                if (user.emailVerified) {
                    return {
                        props: {
                            emailChecked: "邮箱已经被确认过了，不需要重复确认",
                            config,
                        },
                    };
                }

                if (await compare(email, checkcode)) {
                    await prisma.user.update({
                        where: { email: email },
                        data: { emailVerified: new Date().toISOString() },
                    });
                    await giveFreeCreditsById(
                        user.id,
                        config.freeCredits,
                        enums.creditOperation.NEW_USER
                    );

                    if (
                        user.invitedbycode &&
                        user.invitedbycode !== "" &&
                        user.invitedbycode !== "walkin"
                    ) {
                        log(
                            `${user.invitedbycode} 邀请 ${user.name} 注册，奖励 ${config.inviteBonus} 个积分！`
                        );
                        await giveFreeCreditsById(
                            user.invitedbycode,
                            config.inviteBonus,
                            enums.creditOperation.INVITE_BONUS,
                            user.id
                        );
                    }

                    return {
                        props: {
                            emailChecked:
                                "邮箱被成功确认，我们已经给你的账户免费赠送了" +
                                config.freeCredits +
                                "个" +
                                config.creditName +
                                "，请放心使用！",
                            config,
                        },
                    };
                }

                return {
                    props: {
                        emailChecked: "邮箱确认失败，你发送的确认链接和我们发送的链接不一致！",
                        config,
                    },
                };
            }

            return {
                props: {
                    emailChecked: "用户不存在，请先注册！",
                    config,
                },
            };
        } else {
            return {
                props: {
                    emailChecked:
                        "这是我们的邮箱确认链接，但是被错误的打开，请关闭并忽略。",
                    config,
                },
            };
        }
    } catch (e) {
        error(e);
        return {
            props: {
                emailChecked: "邮箱确认失败，确认过程中发生未知错误！",
                config,
            },
        };
    }
}

export default function checkEmail({
    config,
    emailChecked,
}: {
    config: any;
    emailChecked: string;
}) {
    const [errorState, setError] = useState<string | null>(null);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === "authenticated") {
        return (
            <TopFrame config={config}>
                <main className="flex flex-1 flex-col">
                    <h1 className="mx-auto font-display text-3xl font-bold tracking-normal text-black-100 sm:text-6xl mb-5">
                        <span className="text-blue-600">邮箱确认</span>
                    </h1>
                    <div className="mx-auto max-w-sm space-y-4">
                        {emailChecked}，请返回{" "}
                        <Link
                            href="/"
                            className="font-semibold text-blue-200 underline underline-offset-2 hover:text-gray-100 transition"
                        >
                            主页
                        </Link>
                    </div>
                </main>
            </TopFrame>
        );
    } else {
        return <LoginPage config={config} />;
    }
}
