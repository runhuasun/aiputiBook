import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import React from 'react';
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import { Toaster, toast } from "react-hot-toast";
import { Room } from "@prisma/client";
import { getServerSession } from "next-auth";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { CompareSlider } from "../components/CompareSlider";
import LoadingDots from "../components/LoadingDots";
import LoadingRing from "../components/LoadingRing";
import Toggle from "../components/Toggle";
import { showRoom, publicRoom, showModel } from "../components/Genhis";
import LoginPage from "../components/LoginPage";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import DropDown from "../components/DropDown";
import AlbumSelector from "../components/AlbumSelector";
import ModelSelector from "../components/ModelSelector";
import ToolBar from "../components/ToolBar";
import TopFrame from "../components/TopFrame";
import Image from "../components/wrapper/Image";

import { config } from "../utils/config";
import * as monitor from "../utils/monitor";
import { callAPI2, callAPI } from "../utils/apiUtils";
import downloadPhoto from "../utils/fileUtils";
import * as ru from "../utils/restUtils";

const sources = ["TEXT", "AUDIO"];
const sourceNames = new Map([
    ["TEXT", "用文字内容驱动数字人"],
    ["AUDIO", "用音频内容驱动数字人"],
]);
const ratios = ["16:9", "9:16"];
const ratioNames = new Map([
    ["16:9", "16:9 适合在电脑和电视上播放"],
    ["9:16", "9:16 适合在手机和平板上播放"],
]);
const models = ["STANDARD", "PRO", "PRO_PLUS"];
const modelNames = new Map([
    ["STANDARD", "标准版，速度快价格低，适合简单画面"],
    ["PRO", "专业版，效果好价格高，适合复杂画面"],
    ["PRO_PLUS", "专业加强版，速度更快，画面细节更丰富"],
]);

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let roomId = ctx.query.roomId as string | undefined;
    let image = ctx.query.imageURL as string | undefined;
    let video = ctx.query.videoURL as string | undefined;

    if (roomId) {
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { outputImage: true },
        });
        if (room?.outputImage) image = room.outputImage;
    }

    monitor.logUserRequest(ctx);
    return { props: { image, video, config } };
}

export default function createVideo({
    image,
    video,
    config,
}: {
    image: string;
    video: string;
    config: any;
}) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { status = "authenticated" } = useSession();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
   
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [imageURL, setImageURL] = useState(image || "");
    const [videoURL, setVideoURL] = useState(video || "");
    const [aiAudio, setAiAudio] = useState(true);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [ratio, setRatio] = useState("9:16");
    const [duration, setDuration] = useState("5");
    const [priceUnits, setPriceUnits] = useState(5);
    const [model, setModel] = useState("STANDARD");
    const [source, setSource] = useState("TEXT");
    const [currentTime, setCurrentTime] = useState(0);
    const [totalTime, setTotalTime] = useState(0);

    useEffect(() => { setPriceUnits(parseInt(duration)); }, [duration]);
    useEffect(() => {
        if (imageURL) setSource("PHOTO");
        if (videoURL) setSource("VIDEO");
    }, []);

    const handleTimeUpdate = (e: any) => setCurrentTime(e.target.currentTime);
    const handleLoadedMetadata = () => {
        const v = videoRef.current;
        if (v) {
            v.currentTime = v.duration;
            setTotalTime(v.duration);
            setCurrentTime(v.duration);
        }
    };

    async function generate() {
        if (!prompt) return alert("请先简单描述一下视频画面的内容。");
        setLoading(true);
        const res = await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "createVideo",
                priceUnits,
                params: {
                    source,
                    prompt,
                    imageURL,
                    videoURL,
                    aiAudio,
                    currentTime,
                    totalTime,
                    ratio,
                    duration: parseInt(duration),
                    model,
                },
            },
            "生成视频",
            "VIDEO",
            setLoading,
            (res: any) => {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);
            }
        );
        setLoading(false);
    }

    const [demoRooms, setDemoRooms] = useState<any[]>([]);
    async function loadDemoRooms() {
        const res = await callAPI("/api/updateRoom", {
            cmd: "GOTOPAGE",
            pageSize: 6,
            currentPage: 1,
            type: "VIDEO",
            showBest: true,
        });
        if (res.status === 200) setDemoRooms(res.result.rooms);
    }
    useEffect(() => { loadDemoRooms(); }, []);

    let num = 1;
    if (status === "authenticated" || status === "unauthenticated") {
        return (
            <TopFrame config={config}>
                <ToolBar config={config} />
                <main>
                    <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-4 w-full max-w-xl">
                        <FormLabel number={`${num++}`} label="驱动数字人的方式" />
                        <DropDown
                            theme={source}
                            setTheme={setSource as any}
                            themes={sources}
                            names={sourceNames}
                        />

                        <FormLabel number={`${num++}`} label="选择数字人" />
                        {imageURL && (
                            <Image
                                alt="图片素材"
                                src={imageURL}
                                className="rounded-2xl"
                                width={512}
                                height={512}
                            />
                        )}
                        <ModelSelector
                            onSelect={(m) => setImageURL(m?.coverImg || "")}
                            title="数字人仓库"
                            modelType="LORA"
                            channel="FASHION"
                        />

                        <FormLabel number={`${num++}`} label="背景视频" />
                        {videoURL && (
                            <video
                                ref={videoRef}
                                src={videoURL}
                                poster={videoURL}
                                controls
                                onPause={handleTimeUpdate}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                width={512}
                                height={512}
                            />
                        )}
                        <ComboSelector
                            selectorType="GENERAL"
                            onSelect={(f) => setVideoURL(f)}
                            fileType="VIDEO"
                        />

                        <FormLabel number={`${num++}`} label="数字人播报的内容" />
                        <PromptArea
                            userPrompt={prompt}
                            onUserPromptChange={setPrompt}
                            hotWords="EMPTY"
                            hasAdvanceButton={false}
                        />

                        <FormLabel number={`${num++}`} label="画面比例" />
                        <DropDown
                            theme={ratio}
                            setTheme={setRatio as any}
                            themes={ratios}
                            names={ratioNames}
                        />

                        <FormLabel number={`${num++}`} label="选择画面生成引擎" />
                        <DropDown
                            theme={model}
                            setTheme={setModel as any}
                            themes={models}
                            names={modelNames}
                        />

                        <div className="flex flex-col space-y-2 items-center">
                            {loading ? (
                                <LoadingButton />
                            ) : (
                                <StartButton
                                    config={config}
                                    title="开始执行任务"
                                    onStart={generate}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col w-full rounded-lg min-h-[calc(100vh-180px)] mr-2 items-center justify-center border border-gray-300">
                        {error && <MessageZone message={error} messageType="ERROR" />}
                        {loading && !error && !restoredImage && <LoadingRing />}

                        {!restoredImage && !loading && !error && (
                            <ComboSelector
                                selectorType="GENERAL"
                                onSelect={(f) => setRestoredImage(f)}
                                fileType="VIDEO"
                            />
                        )}

                        {restoredImage && (
                            <video
                                src={restoredImage}
                                poster={imageURL}
                                controls
                                width={512}
                                height={512}
                            />
                        )}

                        {restoredImage && restoredId && (
                            <div className="flex space-x-3 text-base">
                                <button
                                    onClick={() =>
                                        window.open(
                                            `/createVideo?videoURL=${restoredImage}`,
                                            "_blank"
                                        )
                                    }
                                    className="button-gold text-sm rounded-full px-3 py-2"
                                >
                                    视频续拍
                                </button>
                                <button
                                    onClick={() =>
                                        window.open(
                                            `/videoMixAudio?videoURL=${restoredImage}`,
                                            "_blank"
                                        )
                                    }
                                    className="button-main text-sm rounded-full px-3 py-2"
                                >
                                    视频配乐
                                </button>
                                <button
                                    onClick={() =>
                                        window.open(
                                            `/videoRetalk?videoURL=${restoredImage}`,
                                            "_blank"
                                        )
                                    }
                                    className="button-main text-sm rounded-full px-3 py-2"
                                >
                                    人物配音
                                </button>
                                <button
                                    onClick={() =>
                                        window.open(
                                            `/videoMixAIAudio?videoURL=${restoredImage}`,
                                            "_blank"
                                        )
                                    }
                                    className="button-main text-sm rounded-full px-3 py-2"
                                >
                                    智能音效
                                </button>
                                <button
                                    onClick={() =>
                                        window.open(
                                            `/faceswapVideo?videoUrl=${restoredImage}`,
                                            "_blank"
                                        )
                                    }
                                    className="button-main text-sm rounded-full px-3 py-2"
                                >
                                    视频换脸
                                </button>
                                <button
                                    onClick={() => downloadPhoto(restoredImage)}
                                    className="button-main text-sm rounded-full px-3 py-2"
                                >
                                    下载视频
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </TopFrame>
        );
    } else {
        return <LoginPage config={config} />;
    }
}
