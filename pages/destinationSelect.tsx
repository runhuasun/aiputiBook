import { NextPage } from "next";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import prisma from "../lib/prismadb";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Model, User } from "@prisma/client";
import LoginPage from "../components/LoginPage";
import TopFrame from "../components/TopFrame";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";
import { destinations } from "../utils/destinations";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const userAgent = ctx.req.headers['user-agent'] || '';
    const inWeixin = /MicroMessenger/.test(userAgent);

    const isLogin = Boolean(session?.user?.email);
    const user = isLogin
        ? await prisma.user.findUnique({ where: { email: session!.user!.email! } })
        : undefined;

    return {
        props: {
            user,
            config,
            inWeixin
        },
    };
}

export default function destinationSelect({
    user,
    config,
    inWeixin
}: {
    user: User;
    config: any;
    inWeixin: boolean;
}) {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status !== "authenticated") {
        return <LoginPage config={config} />;
    }

    return (
        <TopFrame config={config}>
            <main>
                <div className={inWeixin ? "hidden" : "hidden sm:block sm:pb-5"}>
                    <h1 className="mx-auto max-w-4xl font-display text-3xl text-white sm:text-4xl background-gradient">
                        <span className="relative whitespace-nowrap text-white">
                            全球旅行目的地
                        </span>
                    </h1>
                </div>

                {destinations.map((dest, index) => (
                    <div key={index} className="items-left w-2/3 flex flex-col px-3 sm:mb-0 mb-3">
                        <div className="px-3 cursor-pointer text-left text-gray-400 hover:text-white">
                            {dest.name}
                        </div>
                        <div className={`flex flex-row ${inWeixin ? "grid grid-cols-5" : "grid grid-cols-2 sm:grid-cols-12"} gap-3 py-1`}>
                            {dest.subRegions?.map((subDest: any, subIndex: any) => (
                                <Link
                                    key={subIndex}
                                    href={`/modelMarket?func=chat&word=${encodeURIComponent(subDest.name)}&pointer=0&channel=TRAVEL&title=旅行目的地`}
                                >
                                    {subDest.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </main>
        </TopFrame>
    );
}
