import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import React from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import Image from "../components/wrapper/Image";
import LoginPage from "../components/LoginPage";
import FileSelector from "../components/FileSelector";
import Pagination from "../components/Pagination";
import TopFrame from "../components/TopFrame";

import { config, defaultImage } from "../utils/config";
import * as ru from "../utils/restUtils";
import * as monitor from "../utils/monitor";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);

    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let albumId = ctx.query.albumId as string | undefined;
    let myRoomsPage = parseInt(ctx.query.myRoomsPage as string || "1");
    let albumRoomsPage = parseInt(ctx.query.albumRoomsPage as string || "1");

    let myRoomsStart = (myRoomsPage - 1) * 18;
    let albumRoomsStart = (albumRoomsPage - 1) * 18;

    let myRoomsCount = 0;
    let albumRoomsCount = 0;

    const isLogin = Boolean(session?.user?.email);
    let user;

    if (isLogin) {
        user = await prisma.user.findUnique({
            where: { email: session!.user!.email! },
        });
    }

    let album: any, albumRooms: any[] = [], myRooms: any[] = [];

    if (albumId && user) {
        album = await prisma.album.findUnique({ where: { id: albumId } });

        const roomsInAlbum = await prisma.albumRoom.findMany({
            where: {
                albumId,
                status: { notIn: ["DELETE", "FAILED", "DELETED", "CREATING"] },
            },
            select: { roomId: true },
        });
        const roomIdsInAlbum = roomsInAlbum.map((r) => r.roomId);

        const commonWhere = {
            userId: user.id,
            status: { notIn: ["DELETE", "FAILED", "DELETED", "CREATING"] },
        };

        myRoomsCount = await prisma.room.count({
            where: { ...commonWhere, id: { notIn: roomIdsInAlbum } },
        });
        myRooms = await prisma.room.findMany({
            where: { ...commonWhere, id: { notIn: roomIdsInAlbum } },
            take: 18,
            skip: myRoomsStart,
            orderBy: { createdAt: "desc" },
        });

        albumRoomsCount = await prisma.room.count({
            where: { ...commonWhere, id: { in: roomIdsInAlbum } },
        });
        albumRooms = await prisma.room.findMany({
            where: { ...commonWhere, id: { in: roomIdsInAlbum } },
            take: 18,
            skip: albumRoomsStart,
            orderBy: { createdAt: "desc" },
        });
    }

    return {
        props: {
            myRoomsCount,
            myRooms,
            albumRoomsCount,
            albumRooms,
            album,
            config,
            user: user ?? null,
        },
    };
}

export default function showAlbum({
    user,
    myRooms,
    myRoomsCount,
    albumRooms,
    albumRoomsCount,
    album,
    config,
}: {
    user: any;
    myRooms: any[];
    myRoomsCount: number;
    albumRooms: any[];
    albumRoomsCount: number;
    album: any;
    config: any;
}) {
    const router = useRouter();
    const { data, mutate } = useSWR("/api/remaining", (url) =>
        fetch(url).then((res) => res.json())
    );
    const { status } = useSession();

    const [currentMyRoomsPage, setCurrentMyRoomsPage] = useState(
        parseInt((router.query.myRoomsPage as string) || "1")
    );
    const [currentAlbumRoomsPage, setCurrentAlbumRoomsPage] = useState(
        parseInt((router.query.albumRoomsPage as string) || "1")
    );
    const [isMyRoomsOpened, setIsMyRoomsOpened] = useState(
        Boolean(router.query.myRoomsOpened)
    );

    const totalMyRoomsPages = Math.ceil(myRoomsCount / 18);
    const totalAlbumRoomsPages = Math.ceil(albumRoomsCount / 18);

    async function addRoomToAlbum(roomId: string) {
        const res = await fetch("/api/albumManager", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cmd: "ADDROOM", id: album.id, roomId }),
        });
        const response = await res.json();
        if (res.status !== 200) {
            // handle error
        } else {
            const url = new URL(window.location.href);
            url.searchParams.delete("myRoomsOpened");
            window.location.href = url.toString();
        }
    }

    async function removeRoomFromAlbum(roomId: string) {
        const res = await fetch("/api/albumManager", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cmd: "REMOVEROOM", id: album.id, roomId }),
        });
        const response = await res.json();
        if (res.status !== 200) {
            // handle error
        } else {
            window.location.reload();
        }
    }

    function renderRoom(img: any, type: string) {
        return (
            <div
                key={img.id}
                className="group masonry-item border-gray-200 text-center flex-col relative inline-block"
            >
                <div className="relative w-full text-xs">
                    <Link href={ru.getImageRest(img.id)} target="_blank">
                        <Image
                            alt="AI作品"
                            width={512}
                            height={512}
                            src={img.outputImage}
                            className="object-cover w-full"
                            loading="lazy"
                        />
                    </Link>
                    {type === "ALBUM" && (
                        <button
                            onClick={() => removeRoomFromAlbum(img.id)}
                            className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500"
                        >
                            <span className="sr-only">移除</span>
                            <svg
                                className="w-6 h-6 fill-current"
                                viewBox="0 0 20 20"
                            >
                                <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (status === "authenticated") {
        return (
            <TopFrame config={config}>
                <main>
                    <h1 className="hidden sm:block title-main">
                        <span className="title-light">“{album.name}”</span>
                    </h1>
                    {user.id !== album.userId && (
                        <div className="hidden sm:block">
                            <Link
                                className="text-center items-center text-lg flex flex-row mt-1"
                                href={"/userPage?userId=" + user.id}
                            >
                                <Image
                                    src={user.image || defaultImage.userCover}
                                    alt="作者"
                                    className="w-6 h-6 rounded-full"
                                    width={20}
                                    height={20}
                                />
                                <p className="text-white text-left px-2 py-1">
                                    {user.name}
                                </p>
                            </Link>
                        </div>
                    )}
                    <p className="text-center text-sm text-black-300 mt-1">
                        {album.desc}
                    </p>

                    <div className="grid w-full grid-flow-row-dense grid-cols-1 gap-1 sm:grid-cols-6">
                        {albumRooms.map((img) => renderRoom(img, "ALBUM"))}
                    </div>
                    <Pagination
                        pageCount={totalAlbumRoomsPages}
                        currentPage={currentAlbumRoomsPage}
                        onPageChange={(newPage) => {
                            setCurrentAlbumRoomsPage(newPage);
                            const url = new URL(window.location.href);
                            url.searchParams.set(
                                "albumRoomsPage",
                                newPage.toString()
                            );
                            window.location.href = url.toString();
                        }}
                    />

                    <FileSelector
                        title="添加图片到相册"
                        files={myRooms}
                        fileType="IMAGE"
                        pageCount={Math.ceil(myRoomsCount / 18)}
                        pageSize={18}
                        currentPage={currentMyRoomsPage}
                        isOpened={isMyRoomsOpened}
                        onSelect={(file) => {
                            if (file) {
                                addRoomToAlbum(file.id);
                                setIsMyRoomsOpened(false);
                            }
                        }}
                        onPageChange={(newPage) => {
                            setCurrentMyRoomsPage(newPage);
                            const url = new URL(window.location.href);
                            url.searchParams.set(
                                "myRoomsPage",
                                newPage.toString()
                            );
                            url.searchParams.set("myRoomsOpened", "true");
                            window.location.href = url.toString();
                        }}
                    />
                </main>
            </TopFrame>
        );
    } else {
        return <LoginPage config={config} />;
    }
}
