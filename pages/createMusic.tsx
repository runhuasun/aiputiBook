import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";

import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import LoginPage from "../components/LoginPage";
import ComboSelector from "../components/ComboSelector";
import PriceTag from "../components/PriceTag";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import StartButton from "../components/StartButton";
import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import ToolBar from "../components/ToolBar";
import DropDown from "../components/DropDown";
import FlexAudio from "../components/FlexAudio";
import ResultView from "../components/ResultView";

const modelNames = new Map([
    ["musicgen", "Facebook音乐模型"],
    ["lyria-2", "Google音乐模型"],
]);
const models = Array.from(modelNames.keys());

export default function createMusic({
    defVoice,
    defPrompt,
    config,
}: {
    defVoice: string;
    defPrompt: string;
    config: any;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [restoredId, setRestoredId] = useState<string | null>(null);

    const [model, setModel] = useState("lyria-2");
    const [prompt, setPrompt] = useState(defPrompt);
    const [audioFile, setAudioFile] = useState<string | undefined>(defVoice);
    const [musicDuration, setMusicDuration] = useState(5);
    const [audioDuration, setAudioDuration] = useState(0);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { status } = useSession();

    const router = useRouter();
    const title = "音乐生成";
    const [demoRooms, setDemoRooms] = useState<any[]>([]);

    async function generate() {
        if (!prompt) {
            return alert("请先描述一下您希望生成的音乐！");
        }
        if (audioDuration > 3600) {
            return alert("参考乐曲时长超过1小时，系统无法处理，请换一首！");
        }
        const res = await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "createMusic",
                priceUnits: musicDuration,
                params: {
                    model,
                    prompt,
                    input_audio: audioFile,
                    duration: musicDuration,
                },
            },
            title,
            "VOICE",
            (s: boolean) => setLoading(s),
            (res: any) => {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);
            }
        );
    }

    useEffect(() => {
        if (model === "lyria-2") {
            setMusicDuration(30);
        }
    }, [model]);

    let num = 1;

    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} />
                
                <div className="page-container">
                    <div className="page-tab px-4 ml-2 pb-20 rounded-lg space-y-4 w-full max-w-2xl">
                        <div className="space-y-4 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label="作曲大模型"
                            />
                            <DropDown
                                theme={model}
                                // @ts-ignore
                                setTheme={(m) => setModel(m)}
                                themes={models}
                                names={modelNames}
                            />
                        </div>

                        <div className="space-y-4 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label="乐曲描述（种类、乐器、主题等）"
                            />
                            <PromptArea
                                hasAdvanceButton={false}
                                userPrompt={prompt}
                                onUserPromptChange={(up) => setPrompt(up)}
                                hotWords="CREATE_MUSIC"
                            />
                        </div>

                        {model === "musicgen" && (
                            <>
                                <div className="space-y-4 mt-4 w-full">
                                    <div className="flex flex-row items-center space-x-3">
                                        <FormLabel
                                            number={`${num++}`}
                                            label="参考音乐"
                                            onCancel={() =>
                                                setAudioFile(undefined)
                                            }
                                        />
                                        <Link
                                            href="http://www.6002255.com/"
                                            target="_blank"
                                            className="button-green-blue mt-3 px-2"
                                        >
                                            免费MP3下载
                                        </Link>
                                    </div>
                                    {audioFile && (
                                        <FlexAudio
                                            src={audioFile}
                                            key={audioFile}
                                            controls
                                            loading={loading}
                                            onLoading={(s) =>
                                                setLoading(s)
                                            }
                                            onAudioUpdate={(
                                                url,
                                                duration
                                            ) => {
                                                if (url !== audioFile) {
                                                    setAudioFile(url);
                                                }
                                                setAudioDuration(duration);
                                            }}
                                        />
                                    )}
                                    <ComboSelector
                                        onSelect={(f) =>
                                            setAudioFile(f)
                                        }
                                        fileType="VOICE"
                                    />
                                </div>

                                <div className="space-y-4 mt-4 w-full">
                                    <FormLabel
                                        number={`${num++}`}
                                        label={`乐曲时长：${musicDuration}秒`}
                                    />
                                    <input
                                        type="range"
                                        value={musicDuration}
                                        min="5"
                                        max="180"
                                        step="1"
                                        className="slider-dark-green w-full mt-4"
                                        onChange={(e) =>
                                            setMusicDuration(
                                                parseInt(e.target.value)
                                            )
                                        }
                                    />
                                </div>
                            </>
                        )}

                        {model === "lyria-2" && (
                            <FormLabel
                                number={`${num++}`}
                                label={`乐曲时长：${musicDuration}秒`}
                            />
                        )}

                        <StartButton
                            config={config}
                            title="开始创作乐曲"
                            units={musicDuration}
                            unitName="秒乐曲"
                            showPrice={true}
                            loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setError(null);
                                generate();
                            }}
                        />

                        <div className="w-full flex flex-col items-center space-y-2 pt-20">
                            <div className="flex flex-row items-center justify-center">
                                <span>想要创作带词的歌曲？</span>
                                <Link
                                    href="/createSong"
                                    className="underline underline-offset-4"
                                >
                                    智能写歌
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
                        demoRooms={{ func: "createMusic"}}
                    />                        

                </div>
            </main>
        </TopFrame>
    );
}

export async function getServerSideProps(ctx: any) {
    const imgId = ctx.query.roomId;
    let defVoice = ctx.query.voiceURL as string;
    let defPrompt = ctx.query.prompt as string;

    if (imgId) {
        const room = await prisma.room.findUnique({ where: { id: imgId } });
        defVoice = room?.outputImage || defVoice;
        defPrompt = room?.prompt || defPrompt;
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            defVoice,
            defPrompt,
            config,
        },
    };
}
