import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import TextareaAutosize from "react-textarea-autosize";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Toaster, toast } from "react-hot-toast";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";

import TopFrame from "../components/TopFrame";
import DropDown from "../components/DropDown";
import PromptArea, { defaultHotWords } from "../components/PromptArea";
import ComboSelector from "../components/ComboSelector";
import Toggle from "../components/Toggle";
import FormLabel from "../components/FormLabel";
import StartButton from "../components/StartButton";
import PromptSelector from "../components/PromptSelector";
import LoadingRing from "../components/LoadingRing";
import PromptAssistant from "../components/PromptAssistant";
import DrawRatioSelector from "../components/DrawRatioSelector";
import ToolBar from "../components/ToolBar";
import ResultView from "../components/ResultView";
import InputImage from "../components/InputImage";
import Image from "../components/wrapper/Image";

import { parseParams, replaceKeyValues, checkSyntax } from "../utils/formularTools";
import { callAPI2 } from "../utils/apiUtils";
import { config } from "../utils/config";
import * as monitor from "../utils/monitor";
import * as lu from "../utils/loginUtils";
import * as rmu from "../utils/roomUtils";
import { rooms, roomNames, imageModels, supportRefImg } from "../utils/modelTypes";
import { maskSensitiveWord } from "../utils/sensitiveWords";

const selectedImageModels = [
    { code: "flux-merged", name: "快速创意模型（免费）" },
    { code: "imagen-4", name: "高仿真创意模型（超级真实自然）" },
    { code: "flux-pro-ultra", name: "超高清创意模型（细节极度丰富）" },
    { code: "byte-general-3.0", name: "中国元素创意（可输出汉字）" }
];
const selectedModels: string[] = [];
const selectedModelNames = new Map<string, string>();
for (const m of selectedImageModels) {
    selectedModels.push(m.code);
    selectedModelNames.set(m.code, m.name);
}

const allModels: string[] = rooms;
const allModelNames = new Map<string, string>();
for (const m of imageModels) {
    if (m.show) {
        allModelNames.set(m.code, `${m.name} — [⚡${m.price} / ⭐${m.score}]`);
    }
}

export default function createPrompt({
    simRoomBody,
    user,
    hasCreation,
    config
}: {
    simRoomBody: any;
    user: any;
    hasCreation: boolean;
    config: any;
}) {
    const router = useRouter();

    const [models, setModels] = useState<string[]>(selectedModels);
    const [modelNames, setModelNames] = useState<Map<string, string>>(selectedModelNames);
    const [sysType, setSysType] = useState<string>("PRO");

    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
    const [restoredSeed, setRestoredSeed] = useState<string | null>(simRoomBody?.seed);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    let title = (router.query.title as string) || "AI创意摄影";
    const [seed, setSeed] = useState<string>(
        (router.query.seed as string) || simRoomBody?.params?.seed || ""
    );
    const [room, setRoom] = useState<string>(
        (router.query.func as string) || simRoomBody?.params?.func || "flux-merged"
    );
    const [prompt, setPrompt] = useState<string>(
        ((router.query.prompt as string) ||
        simRoomBody?.params?.inputText ||
        "").replace(". []", "")
    );
    const [sysPrompts, setSysPrompts] = useState<string>("");
    const [drawRatio, setDrawRatio] = useState<string>(
        (router.query.drawRatio as string) || simRoomBody?.params?.drawRatio || "916"
    );
    const [refImage, setRefImage] = useState<string>(
        (router.query.imageURL as string) ||
        (router.query.refImage as string) ||
        simRoomBody?.params?.imageUrl ||
        ""
    );
    const [showMore, setShowMore] = useState<boolean>(!!refImage);

    useEffect(() => {
        if (sysType === "PRO") {
            setModelNames(allModelNames);
            setModels(allModels);
            setShowMore(true);
        } else {
            setModelNames(selectedModelNames);
            setModels(selectedModels);
            if (!selectedModels.includes(room)) {
                setRoom("flux-merged");
            }
        }
    }, [sysType]);

    function isPositiveInteger(str: string): boolean {
        return /^\d+$/.test(str);
    }

    async function generatePhoto() {
        if (
            !lu.checkLogin(
                status,
                [
                    ["prompt", prompt],
                    ["seed", seed],
                    ["drawRatio", drawRatio],
                    ["refImage", refImage],
                    ["func", room]
                ]
            )
        ) {
            return;
        }

        let input = "";
        if ((!prompt || prompt.length < 5) && !refImage) {
            const OK = await confirm(
                "过于简洁的画面描述，会让生成的结果单调乏味，无法发挥出AI应有的潜能。" +
                "请尽量清楚的描绘人物特征、动作、画面背景等信息。画面描述的越详尽，生成的效果越好。" +
                "您也可以使用[DeepSeek创意]功能AI辅助创意，或者选择我们提供的[参考创意]来试试。\n" +
                "如果您还是想坚持用现在的描述，请选择[确定]。"
            );
            if (!OK) {
                return;
            }
        }
        if ((!prompt || prompt.length === 0) && !refImage) {
            input =
                "一位中国美女，穿浅蓝色的旗袍，丰满，白皙，长发，微笑，站在泳池中。美式的别墅，阳光灿烂，周围有棕榈树和玫瑰花。";
        } else {
            input = checkSyntax(prompt);
            setPrompt(input);
            input = replaceKeyValues(input);
            input = maskSensitiveWord(input);
        }

        if (seed && seed.trim() !== "" && !isPositiveInteger(seed)) {
            alert(
                "图片种子必须是一个正整数，如果不知道用什么种子，可以不输入，系统会随机产生"
            );
            return;
        }

        setRestoredImage(null);
        setRestoredId(null);
        setRestoredSeed(null);
        setError(null);

        const inputText = input + (sysPrompts ? `. [${sysPrompts}]` : "");

        await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "createPrompt",
                params: {
                    func: room,
                    imageUrl: refImage,
                    drawRatio,
                    theme: "",
                    realText: inputText,
                    inputText,
                    seed: seed || String(Math.floor(Math.random() * 100000)),
                    waitResultRetryTimes: 50
                }
            },
            "提示词实验",
            "IMAGE",
            (s) => setLoading(s),
            (res) => {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);
                setRestoredSeed(res.result.seed);
            }
        );
    }

    let num = 1;

    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} imageURL={refImage} prompt={prompt} />

                <div className="page-container">
                    <div className="page-tab-image-create">
                        <Toggle
                            className="hidden flex flex-col items-center mt-4"
                            sideBySide={sysType === "PRO"}
                            leftText="优选模型"
                            rightText="模型超市"
                            setSideBySide={(v) =>
                                setSysType(v ? "PRO" : "CAMERIST")
                            }
                        />

                        <div className="space-y-3 w-full">
                            <div className="w-full flex flex-row space-x-3 ">
                                <FormLabel
                                    number={`${num++}`}
                                    label="图片生成模型"
                                />
                                <button
                                    className="button-main text-xs px-2 py-1 mt-3"
                                    onClick={() => {
                                        window.open(
                                            "/pModelList",
                                            "_blank"
                                        );
                                    }}
                                >
                                    大模型集市
                                </button>
                            </div>
                            <DropDown
                                theme={room}
                                // @ts-ignore
                                setTheme={(m) => setRoom(m)}
                                themes={models}
                                names={modelNames}
                            />
                        </div>

                        {supportRefImg(room) && (
                            <div className="space-y-3 w-full">
                                <FormLabel
                                    number={`${num++}`}
                                    label="模仿照片（可选）"
                                    onCancel={() => setRefImage("")}
                                    hint="注意：模型并不是为您提供的人物生成照片。对于很多文生图模型，模仿照片只是一个参考，模型更多会优先遵从您的提示词要求生成图片，并尽可能参考模仿图片的构图和风格。如果想要给提供的人物生成照片，请使用图片工具-拍摄写真功能"
                                />
                                <InputImage src={refImage} />
                                <ComboSelector
                                    onSelect={(f) => setRefImage(f)}
                                    showDemo={false}
                                    showIcon={true}
                                />
                            </div>
                        )}

                        <div className="space-y-3 w-full">
                            <div className="w-full flex flex-row space-x-3 ">
                                <FormLabel
                                    number={`${num++}`}
                                    label="创意画面描述"
                                />
                                <PromptSelector
                                    onSelect={(pf) => {
                                        setPrompt(pf.formular);
                                    }}
                                />
                                {status === "authenticated" && (
                                    <PromptAssistant
                                        userPrompt={prompt}
                                        user={user}
                                        model={room}
                                        onUserPromptChange={setPrompt}
                                        onOK={setPrompt}
                                    />
                                )}
                            </div>
                            <PromptArea
                                initMinRows={5}
                                initMaxRows={20}
                                initPlaceHolder="请尽量详细的描绘您想要生成的画面..."                                
                                userPrompt={prompt}
                                onSysPromptChange={setSysPrompts}
                                onUserPromptChange={setPrompt}
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label="照片输出比例"
                            />
                            <DrawRatioSelector
                                defaultRatio={drawRatio}
                                onSelect={setDrawRatio}
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label="照片种子（可选）"
                                hint="种子深刻影响AI生成照片的随机性，如果您提供相同的种子，AI会倾向于生成非常相似的照片，请谨慎使用。如果不能确定用途，请不要填写，或者填0，让AI充分随机生成结果。"
                            />
                            <input
                                id="iptSeed"
                                type="text"
                                value={seed}
                                className="input-main"
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^\d*$/.test(v) && v.length <= 8) {
                                        setSeed(v);
                                    }
                                }}
                            />
                        </div>

                        <StartButton
                            config={config}
                            title="开始生成照片"
                            model={room}
                            showPrice={true}
                            loading={loading}
                            onStart={generatePhoto}
                        />

                        <div className="w-full flex flex-col items-center space-y-6 pt-5 text-gray-400">
                            <Link
                                className="text-base underline underline-offset-4"
                                href="/styleMarket"
                            >
                                生成独特艺术风格的图片...
                            </Link>
                            <Link
                                className="text-base underline underline-offset-4"
                                href="/superCamera"
                            >
                                为真实人物拍摄肖像大片...
                            </Link>
                        </div>
                    </div>

                    <ResultView
                        config={config}
                        loading={loading}
                        error={error}
                        restoredImage={restoredImage}
                        restoredId={restoredId}
                        restoredSeed={restoredSeed}
                        demoRooms={{ func: "createPrompt", model: room }}
                    />
                </div>
            </main>
        </TopFrame>
    );
}

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(
        ctx.req,
        ctx.res,
        authOptions
    );
    let user: any;
    if (session?.user?.email) {
        user = await prisma.user.findUnique({
            where: { email: session.user.email! },
            select: { id: true, credits: true, name: true, actors: true }
        });
    }
    monitor.logUserRequest(ctx, session, user);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx.query.simRoomId),
            user,
            hasCreation: false,
            config
        }
    };
}
