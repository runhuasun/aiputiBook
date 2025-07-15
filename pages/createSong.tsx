import { AnimatePresence, motion } from "framer-motion";
import { NextPage } from "next";
import Head from "next/head";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Rings } from "react-loader-spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import TextareaAutosize from "react-textarea-autosize";
import { Toaster, toast } from "react-hot-toast";

import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { ZipData } from "./api/processImage";
import { GenerateResponseData } from "./api/generate";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import LoadingDots from "../components/LoadingDots";
import ResizablePanel from "../components/ResizablePanel";
import Toggle from "../components/Toggle";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import PromptAssistant from "../components/PromptAssistant";
import DropDown from "../components/DropDown";
import ToolBar from "../components/ToolBar";
import FlexAudio from "../components/FlexAudio";
import ResultView from "../components/ResultView";
import PromptArea from "../components/PromptArea";

import { config } from "../utils/config";
import * as debug from "../utils/debug";
import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as ru from "../utils/restUtils";
import * as fc from "../utils/funcConf";
import * as rmu from "../utils/roomUtils";

const refModes = ["SONG", "VOICE"];
const refModeNames = new Map<string, string>([
    ["SONG", "参考歌曲的唱腔和曲调创建新歌曲（推荐）"],
    ["VOICE", "分别参考唱腔和伴奏（适合专业用户）"],
]);

export default function createSong({
    simRoomBody,
    voice,
    prompt,
    config,
}: {
    simRoomBody: any;
    voice: string;
    prompt: string;
    config: any;
}) {
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(
        simRoomBody?.output
    );
    const [restoredId, setRestoredId] = useState<string | null>(
        simRoomBody?.roomId
    );

    const [lyrics, setLyrics] = useState<string>(simRoomBody?.params?.lyrics || prompt);
    const [songFile, setSongFile] = useState<string | undefined>(
        simRoomBody?.params?.song_file || voice
    );
    const [voiceFile, setVoiceFile] = useState<string | undefined>(
        simRoomBody?.params?.voice_file
    );
    const [instrumentalFile, setInstrumentalFile] = useState<string | undefined>(
        simRoomBody?.params?.instrumental_file
    );
    const [songDuration, setSongDuration] = useState<number>(0);
    const [voiceDuration, setVoiceDuration] = useState<number>(0);
    const [instrumentalDuration, setInstrumentalDuration] = useState<number>(0);
    const [refMode, setRefMode] = useState<string>("SONG");

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const router = useRouter();
    const segLength = 100;
    const maxLength = segLength * 10;

    function getPriceUnits() {
        return lyrics?.length
            ? Math.ceil(lyrics.length / segLength)
            : 0;
    }

    async function generate() {
        if (!lyrics) {
            return alert(`请先输入一段${maxLength}字以内的歌词哦！`);
        }
        if (lyrics.length > maxLength) {
            return alert(
                `我每次创作歌曲时，歌词内容不能大于${maxLength}字，请删减一些吧！`
            );
        }
        const params: any = {
            refMode,
            lyrics,
            song_file: songFile,
            voice_file: voiceFile,
            instrumental_file: instrumentalFile,
        };
        if (refMode === "SONG") {
            if (!songFile) {
                return alert("请先给我一段参考音乐吧！");
            }
            if (songDuration < 15) {
                return alert("上传的音乐文件时长需要大于15秒");
            }
            params.voice_file = undefined;
            params.instrumental_file = undefined;
        }
        if (refMode === "VOICE") {
            if (!voiceFile) {
                return alert("请给一段人声让我来模仿唱腔吧！");
            }
            if (!instrumentalFile) {
                return alert("请提供一段伴奏乐曲让我来模仿吧！");
            }
            if (voiceDuration < 15) {
                return alert("上传的声音时长需要大于15秒");
            }
            if (instrumentalDuration < 15) {
                return alert("上传的伴奏时长需要大于15秒");
            }
            params.song_file = undefined;
        }

        await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "createSong",
                priceUnits: getPriceUnits(),
                params,
            },
            "歌曲生成",
            "VOICE",
            (status: boolean) => setLoading(status),
            (res: any) => {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);
            }
        );
    }

    let num = 1;

    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} />
                
                <div className="page-container">
                    <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-4 w-full max-w-2xl">

                        <div className="flex flex-row items-center">
                            <FormLabel
                                number={`${num++}`}
                                label={`您的歌词内容（最多${maxLength}字，已有${
                                    lyrics.length
                                }字）`}
                            />
                            <PromptAssistant
                                userPrompt={lyrics}
                                user={session?.user}
                                promptType="CREATE_LYRIC"
                                className="hidden sm:flex button-green-blue text-sm text-gold-200 px-2 py-1 mt-3"
                                onUserPromptChange={(np) => setLyrics(np)}
                                onOK={(newPrompt) => setLyrics(newPrompt)}
                            />
                        </div>
                        <PromptArea
                            initMinRows={10}
                            initMaxRows={30}
                            maxLength={maxLength}
                            hasAdvanceButton={false}
                            userPrompt={lyrics}
                            initPlaceHolder="带有可选格式的歌词。您可以用换行符来分隔每一行歌词。您可以使用两行换行符在行之间添加暂停。您可以在歌词的开头和结尾使用双散列标记（##）来添加伴奏。"
                            onUserPromptChange={e => setLyrics(e)}
                        />                        

                        <FormLabel number={`${num++}`} label="创作方式" />
                        <DropDown
                            theme={refMode}
                            // @ts-ignore
                            setTheme={(newTheme) => setRefMode(newTheme)}
                            themes={refModes}
                            names={refModeNames}
                        />

                        {refMode === "SONG" && (
                            <div className="space-y-4 mt-4 w-full">
                                <div className="flex flex-row items-center space-x-3">
                                    <FormLabel
                                        number={`${num++}`}
                                        label="模仿的歌曲（必须包含人声）"
                                        hint="将会模仿歌曲的曲调、曲风和人声发音。上传的歌曲必须包含人声哦！"
                                    />
                                </div>
                                {songFile && (
                                    <FlexAudio
                                        src={songFile}
                                        key={songFile}
                                        controls
                                        loading={loading}
                                        onLoading={(status) => setLoading(status)}
                                        onAudioUpdate={(url, duration) => {
                                            if (url !== songFile) setSongFile(url);
                                            setSongDuration(duration);
                                        }}
                                    />
                                )}
                                <ComboSelector
                                    onSelect={(newFile) => setSongFile(newFile)}
                                    fileType="VOICE"
                                    selectorType="SONG"
                                />
                            </div>
                        )}

                        {refMode === "VOICE" && (
                            <>
                                <div className="space-y-4 mt-4 w-full">
                                    <FormLabel
                                        number={`${num++}`}
                                        label="模仿人声(必须是清唱或带人声的歌曲)"
                                        onCancel={() => setVoiceFile(undefined)}
                                    />
                                    {voiceFile && (
                                        <audio
                                            key={voiceFile}
                                            controls
                                            className="w-full pt-2"
                                            onLoadedMetadata={(e) =>
                                                setVoiceDuration(
                                                    (e.target as HTMLAudioElement).duration
                                                )
                                            }
                                        >
                                            <source src={voiceFile} type="audio/mpeg" />
                                            <source src={voiceFile} type="audio/wav" />
                                            <source src={voiceFile} type="audio/ogg" />
                                        </audio>
                                    )}
                                    <ComboSelector
                                        onSelect={(newFile) => setVoiceFile(newFile)}
                                        fileType="VOICE"
                                    />
                                </div>

                                <div className="space-y-4 mt-4 w-full">
                                    <FormLabel
                                        number={`${num++}`}
                                        label="模仿伴奏(可以是纯音乐或歌曲)"
                                        onCancel={() =>
                                            setInstrumentalFile(undefined)
                                        }
                                    />
                                    {instrumentalFile && (
                                        <audio
                                            key={instrumentalFile}
                                            controls
                                            className="w-full pt-2"
                                            onLoadedMetadata={(e) =>
                                                setInstrumentalDuration(
                                                    (e.target as HTMLAudioElement).duration
                                                )
                                            }
                                        >
                                            <source
                                                src={instrumentalFile}
                                                type="audio/mpeg"
                                            />
                                            <source
                                                src={instrumentalFile}
                                                type="audio/wav"
                                            />
                                            <source
                                                src={instrumentalFile}
                                                type="audio/ogg"
                                            />
                                        </audio>
                                    )}
                                    <ComboSelector
                                        onSelect={(newFile) =>
                                            setInstrumentalFile(newFile)
                                        }
                                        fileType="VOICE"
                                    />
                                </div>
                            </>
                        )}

                        <StartButton
                            config={config}
                            title="生成我的歌曲"
                            units={getPriceUnits()}
                            unitName={`${segLength}字`}
                            showPrice={true}
                            loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                                generate();
                            }}
                        />

                        <div className="w-full flex flex-col items-start space-y-2 pt-10">
                            <div className="w-full flex flex-row items-center justify-center">
                                <span>想要一首纯音乐？</span>
                                <Link
                                    href="/createMusic"
                                    className="underline underline-offset-4"
                                >
                                    创作纯音乐
                                </Link>
                            </div>
                        </div>
                        
                    </div>

                    <ResultView
                        config={config}
                        loading={loading}
                        mediaType={"AUDIO"}
                        error={error}
                        restoredImage={restoredImage}
                        restoredId={restoredId}
                        demoRooms={{ func: "createSong"}}
                    />  
                    
                </div>
            </main>
        </TopFrame>
    );
}

export async function getServerSideProps(ctx: any) {
    let imgId = ctx.query.roomId as string;
    let voice = (ctx.query.voiceURL as string) || "";
    let prompt = (ctx.query.prompt as string) || "";

    if (imgId) {
        const room = await prisma.room.findUnique({ where: { id: imgId } });
        voice = room?.outputImage || voice;
        prompt = room?.prompt || prompt;
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx.query.simRoomId),
            voice,
            prompt,
            config,
        },
    };
}
