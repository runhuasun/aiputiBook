import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import TextareaAutosize from "react-textarea-autosize";
import { getServerSession } from "next-auth";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { Model, Room } from "@prisma/client";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import Uploader, { mimeTypes } from "../components/Uploader";
import StartButton from "../components/StartButton";
import LoadingButton from "../components/LoadingButton";
import MessageZone from "../components/MessageZone";
import PriceTag from "../components/PriceTag";
import RoomAdminPanel from "../components/RoomAdminPanel";
import Image from "../components/wrapper/Image";
import RadioChoice from "../components/wrapper/RadioChoice";

import { callAPI2 } from "../utils/apiUtils";
import * as debug from "../utils/debug";
import * as du from "../utils/deviceUtils";
import * as monitor from "../utils/monitor";
import downloadPhoto from "../utils/fileUtils";
import { config } from "../utils/config";

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const isLogin = !!session?.user?.email;
    let user;
    let defModel: any;

    if (isLogin) {
        user = await prisma.user.findUnique({
            where: { email: session!.user!.email! }
        });
    }

    const roomId = ctx.query.roomId as string | undefined;
    const room = roomId
        ? await prisma.room.findUnique({ where: { id: roomId } })
        : undefined;

    if (room?.bodystr) {
        try {
            const roomBody = JSON.parse(room.bodystr);
            const voiceCode = roomBody?.params?.params?.speaker;
            if (voiceCode) {
                defModel = await prisma.model.findUnique({ where: { code: voiceCode } });
            }
        } catch (e) {
            debug.error("createVoice getServerSideProps:", e);
        }
    }
    if (ctx.query.modelId) {
        defModel = await prisma.model.findUnique({ where: { id: ctx.query.modelId } });
    }
    if (ctx.query.model) {
        defModel = await prisma.model.findUnique({ where: { code: ctx.query.model } });
    }

    const vModels = await prisma.model.findMany({
        where: {
            func: "voice",
            status: "FINISH",
            OR: [
                { userId: user?.id },
                { access: "PUBLIC" },
            ],
        },
        orderBy: [
            { sysScore: 'desc' },
            { createTime: 'desc' },
            { aiservice: 'asc' },
            { name: 'asc' },
        ],
    });

    if (!defModel && vModels.length > 0) {
        defModel = vModels[0];
    }

    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            user,
            room,
            defModel,
            vModels,
            config
        },
    };
}

const aiServices = [
    "ALIYUN",
    "TENCENT",
    "BAIDU",
    "AZURE",
    "OPENAI",
    "XUNFEI"
];
const aiServiceNames = new Map<string, string>([
    ["ALIYUN", "阿里云"],
    ["TENCENT", "腾讯云"],
    ["BAIDU", "百度云"],
    ["AZURE", "微软云"],
    ["OPENAI", "OPENAI"],
    ["XUNFEI", "科大讯飞"]
]);

const genderNames = new Map([
    [ 'NIU', '爆款' ],
    [ 'FEMALE', '女声' ],
    [ 'MALE', '男声' ],
    [ 'GIRL', '女童' ],
    [ 'BOY', '男童' ],
    [ 'CUSTOM', '定制' ]
]);

export default function createVoice({ user, room, vModels, defModel, config }: {
    user: any; room: Room; vModels: Model[]; defModel: Model; config: any
}) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then(res => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [restoredImage, setRestoredImage] = useState<string | null>(room?.outputImage);
    const [restoredId, setRestoredId] = useState<string | null>(room?.id);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!room?.outputImage);
    const [error, setError] = useState<string | null>(null);

    const [speakerCode, setSpeakerCode] = useState<string>(defModel?.code || "ALIYUN***zhiyuan");
    const [speakerName, setSpeakerName] = useState<string>(defModel?.name || "知媛");
    const [genderFilter, setGenderFilter] = useState<string>(defModel?.theme || "NIU");
    const [showModels, setShowModels] = useState<Model[]>(vModels);

    const [content, setContent] = useState<string>(room?.prompt || "");
    const [sampleVoice, setSampleVoice] = useState<string>(defModel?.desc);
    const [vModelId, setVModelId] = useState<string>(defModel?.id);
    const [vModel, setVModel] = useState<Model>(defModel);
    const [language, setLanguage] = useState("zh");

    const segLength = 100;
    const maxLength = segLength * 10;
    function getPriceUnits() {
        return content.length > 0 ? Math.ceil(content.length / segLength) : 0;
    }

    useEffect(() => {
        const filtered = vModels.filter(m => m.theme === genderFilter);
        setShowModels(filtered.slice(0, du.isMobile() ? 20 : 200));
    }, [genderFilter]);

    const languages = ["zh", "en", "fr", "de"];
    const languageNames = new Map<string, string>([
        ["zh", "中文普通话"],
        ["en", "英语"],
        ["fr", "法语"],
        ["de", "德语"],
    ]);

    async function startTrain() {
        if (!content) return alert("请输入你想要转成音频的内容");
        if (content.length > maxLength) return alert("一次最多可以为500个字符生成语音");

        let body: any;
        if (speakerCode === "CUSTOM") {
            body = {
                cmd: "createVoice",
                priceModel: { price: vModel.price },
                priceUnits: getPriceUnits(),
                params: {
                    func: "xtts",
                    inputText: content,
                    params: {
                        speaker: sampleVoice,
                        text: content,
                        language,
                        cleanup_voice: true
                    }
                }
            };
        } else {
            body = {
                cmd: "createVoice",
                priceUnits: getPriceUnits(),
                priceModel: { price: vModel.price },
                params: {
                    func: "text2voice",
                    inputText: content,
                    params: {
                        speaker: speakerCode,
                        content,
                        aiservice: vModel.aiservice,
                        language: vModel.language,
                        basePrice: vModel.price,
                    }
                }
            };
        }

        await callAPI2(
            "/api/workflowAgent2",
            body,
            "生成音频",
            "VOICE",
            status => setLoading(status),
            res => {
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

                <div className="w-full flex flex-col-reverse sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 items-start justify-between p-2 mt-2">

                    <div className="w-full flex flex-1 flex-col space-y-5 rounded-lg h-[calc(100vh-50px)] overflow-y-auto mr-2 items-center justify-start border border-1 border-gray-300 border-dashed">
                        <div className="page-tab w-full sm:rounded-xl sm:m-4 p-2 sm:p-5 flex flex-row space-x-2 space-x-5 max-w-2xl text-sm items-center justify-center">
                            <RadioChoice values={genderNames} selectedValue={genderFilter} onSelect={e => setGenderFilter(e)} />
                        </div>
                        <div className="w-full p-4 grid grid-flow-row-dense grid-cols-1 gap-5 sm:grid-cols-4">
                            {showModels.map(m => (
                                <div key={m.id} className="w-full flex flex-col space-y-1 items-start justify-center mb-10">
                                    <button
                                        className={`${m.code === speakerCode ? 'button-green-blue' : 'button-main'} px-4 py-1 flex flex-row items-center space-x-1`}
                                        onClick={() => {
                                            window.scrollTo(0, 0);
                                            setSpeakerCode(m.code);
                                            setSpeakerName(m.name);
                                            setSampleVoice(m.desc!);
                                            setVModelId(m.id);
                                            setVModel(m);
                                        }}
                                    >
                                        <Image
                                            src={(m.theme === 'FEMALE' || m.theme === 'GIRL') ? '/icons/woman.png' : '/icons/man.png'} className="w-10"
                                        />
                                        <p className="text-sm">{m.name}</p>
                                    </button>
                                    {speakerCode !== 'CUSTOM' && m.desc && (
                                        <audio controls className="w-full pt-2">
                                            <source src={m.desc} />
                                        </audio>
                                    )}
                                </div>
                            ))}
                        </div>
                        {genderFilter === 'CUSTOM' && (
                            <button
                                className="button-green-blue px-10 py-2"
                                onClick={() => window.open('/createSpeaker', '_self')}
                            >
                                创建我的发音人
                            </button>
                        )}
                    </div>

                    <div className="page-tab px-4 pb-20 rounded-lg space-y-5 w-full min-w-lg max-w-2xl">
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label={`发音人：${speakerName}`} />
                            {speakerCode !== 'CUSTOM' && sampleVoice && (
                                <audio controls className="w-full pt-2">
                                    <source src={sampleVoice} />
                                </audio>
                            )}
                        </div>

                        {speakerCode === 'CUSTOM' && (
                            <>
                                <div className="mt-5 w-full">
                                    <FormLabel number={`${num++}`} label="声音样本" />
                                    {sampleVoice && (
                                        <audio controls className="w-full pt-2">
                                            <source src={sampleVoice} />
                                        </audio>
                                    )}
                                </div>
                                <Uploader
                                    mime={mimeTypes.audio}
                                    setFiles={upfiles => {
                                        if (upfiles.length) setSampleVoice(upfiles[0].uploadedUrl);
                                    }}
                                />
                                <div className="space-y-4 w-full max-w-lg">
                                    <FormLabel number={`${num++}`} label="语言" />
                                    <DropDown
                                        theme={language}
                                        setTheme={setLanguage}
                                        themes={languages}
                                        names={languageNames}
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label={`文字内容（${content.length}/${maxLength}字）`} />
                            <PromptArea
                                initMinRows={10}
                                initMaxRows={30}
                                maxLength={maxLength}
                                hasAdvanceButton={false}
                                userPrompt={content}
                                initPlaceHolder="输入需要转换成音频的文字"
                                onUserPromptChange={e => setContent(e)}
                            />
                        </div>

                           <StartButton model={vModel} units={getPriceUnits()} unitName={`${segLength}字`}
                                config={config}
                                title="开始生成语音"
                                showPrice={true}
                                loading={loading}
                                onStart={() => {
                                    setRestoredImage(null);
                                    setRestoredId(null);
                                    setRestoredLoaded(false);
                                    setError(null);
                                    startTrain();
                                }}
                            />
     
                        {restoredImage && !loading && (
                            <div className="w-full flex flex-col items-center mt-10">
                                <audio controls className="w-full pt-2">
                                    <source src={restoredImage} />
                                </audio>
                                <div className="sm:mt-0 mt-5 space-x-5 flex flex-row items-center justify-center">
                                    <button
                                        onClick={() => downloadPhoto(restoredImage)}
                                        className="button-main rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition"
                                    >
                                        下载音频
                                    </button>
                                    <button
                                        onClick={() => window.open(`/sadTalker?roomId=${restoredId}`, '_blank')}
                                        className="button-main rounded-full text-white font-medium px-8 py-2 mt-8 hover:bg-blue-500/80 transition"
                                    >
                                        生成视频
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <MessageZone message={error} messageType="ERROR" />}

                        <RoomAdminPanel user={user} room={room} />
                    </div>
                </div>
            </main>
        </TopFrame>
    );
}
