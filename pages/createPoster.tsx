import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";

import { callAPI2 } from "../utils/apiUtils";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import FormLabel from "../components/FormLabel";
import DrawRatioSelector from "../components/DrawRatioSelector";
import StartButton from "../components/StartButton";
import ResultView from "../components/ResultView";

const modelNames = new Map([
    ["gpt-image-1-medium", "GPT Imager-1 大模型"],
    ["byte-general-3.0", "字节3.0大模型"],
    ["ideogram-v3-balanced", "Ideogram3.0大模型"],
    ["wanx-poster-generation-v1", "阿里海报V1大模型"],
]);
const models = Array.from(modelNames.keys());

const loraNames = new Map([
    ["真实场景", "真实场景"],
    ["2D卡通", "2D卡通"],
    ["儿童水彩", "儿童水彩"],
    ["童话油画", "童话油画"],
    ["2D插画1", "2D插画1"],
    ["2D插画2", "2D插画2"],
    ["浩瀚星云", "浩瀚星云"],
    ["浓郁色彩", "浓郁色彩"],
    ["光线粒子", "光线粒子"],
    ["透明玻璃", "透明玻璃"],
    ["剪纸工艺", "剪纸工艺"],
    ["折纸工艺", "折纸工艺"],
    ["中国水墨", "中国水墨"],
    ["中国刺绣", "中国刺绣"],
    ["赛博背景", "赛博背景"],
    ["浅蓝抽象", "浅蓝抽象"],
    ["深蓝抽象", "深蓝抽象"],
    ["抽象点线", "抽象点线"],
]);
const loras = Array.from(loraNames.keys());

export default function createPoster({
    simRoomBody,
    config,
}: {
    simRoomBody: any;
    config: any;
}) {
    const router = useRouter();
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(
        simRoomBody?.output
    );
    const [restoredId, setRestoredId] = useState<string | null>(
        simRoomBody?.roomId
    );
    const [restoredSeed, setRestoredSeed] = useState<string | null>(
        simRoomBody?.seed
    );

    const [model, setModel] = useState<string>(
        (router.query.model ||
            simRoomBody?.params?.model ||
            "gpt-image-1-medium") as string
    );
    const [prompt, setPrompt] = useState<string>(
        (router.query.prompt || simRoomBody?.params?.prompt || "") as string
    );
    const [title, setTitle] = useState<string>(
        (simRoomBody?.params?.title || "") as string
    );
    const [subTitle, setSubTitle] = useState<string>(
        (router.query.subTitle || simRoomBody?.params?.subTitle || "") as string
    );
    const [bodyText, setBodyText] = useState<string>(
        (router.query.bodyText || simRoomBody?.params?.bodyText || "") as string
    );
    const [lora, setLora] = useState<string>(
        (router.query.lora || simRoomBody?.params?.lora || "真实场景") as string
    );
    const [isCreative, setIsCreative] = useState<boolean>(true);

    const [drawRatio, setDrawRatio] = useState<string>(
        (router.query.drawRatio as string) ||
            simRoomBody?.params?.drawRatio ||
            "916"
    );

    async function generatePhoto() {
        setRestoredImage(null);
        setRestoredId(null);
        setRestoredSeed(null);
        setError(null);

        await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "createPoster",
                priceModel: model,
                params: {
                    drawRatio,
                    func: model,
                    prompt,
                    title,
                    subTitle,
                    bodyText,
                    lora,
                    isCreative,
                },
            },
            "提示词实验",
            "IMAGE",
            (s: boolean) => setLoading(s),
            (res: any) => {
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
                <ToolBar config={config} prompt={prompt} />

                <div className="page-container">
                    <div className="page-tab-image-create">
                        {models.length > 1 && (
                            <div className="space-y-3 w-full">
                                <FormLabel
                                    number={`${num++}`}
                                    label="海报制作模型"
                                />
                                <DropDown
                                    theme={model}
                                    // @ts-ignore
                                    setTheme={(m) => setModel(m)}
                                    themes={models}
                                    names={modelNames}
                                />
                            </div>
                        )}

                        {model === "wanx-poster-generation-v1" ? (
                            <div className="space-y-3 w-full">
                                <FormLabel
                                    number={`${num++}`}
                                    label={`海报底图画面描述（${prompt.length} / 10）`}
                                />
                                <PromptArea
                                    hasAdvanceButton={true}
                                    initMinRows={2}
                                    initMaxRows={10}
                                    maxLength={10}
                                    userPrompt={prompt}
                                    onUserPromptChange={(up) => setPrompt(up)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-3 w-full">
                                <FormLabel
                                    number={`${num++}`}
                                    label="海报画面风格描述"
                                />
                                <PromptArea
                                    hasAdvanceButton={true}
                                    initMinRows={4}
                                    initMaxRows={15}
                                    userPrompt={prompt}
                                    hotWords="POSTER_DESIGN"
                                    onUserPromptChange={(up) => setPrompt(up)}
                                />
                            </div>
                        )}

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label={`海报主标题（${title.length} / 30）`}
                            />
                            <PromptArea
                                hasAdvanceButton={false}
                                initMinRows={1}
                                initMaxRows={3}
                                maxLength={30}
                                userPrompt={title}
                                onUserPromptChange={(up) => setTitle(up)}
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label={`海报副标题（可选）[${subTitle.length} / 30]`}
                            />
                            <PromptArea
                                hasAdvanceButton={false}
                                initMinRows={1}
                                initMaxRows={3}
                                maxLength={30}
                                userPrompt={subTitle}
                                onUserPromptChange={(up) => setSubTitle(up)}
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label={`海报内容文字（可选）[${bodyText.length} / 50]`}
                            />
                            <PromptArea
                                hasAdvanceButton={false}
                                initMinRows={2}
                                initMaxRows={5}
                                maxLength={50}
                                userPrompt={bodyText}
                                onUserPromptChange={(up) => setBodyText(up)}
                            />
                        </div>

                        {model === "wanx-poster-generation-v1" && (
                            <div className="space-y-3 w-full">
                                <FormLabel
                                    number={`${num++}`}
                                    label="海报风格"
                                />
                                <DropDown
                                    theme={lora}
                                    // @ts-ignore
                                    setTheme={(m) => setLora(m)}
                                    themes={loras}
                                    names={loraNames}
                                />
                            </div>
                        )}

                        <div className="space-y-3 w-full">
                            <FormLabel
                                number={`${num++}`}
                                label="照片输出比例"
                            />
                            <DrawRatioSelector
                                type="POSTER"
                                defaultRatio={drawRatio}
                                onSelect={(r) => setDrawRatio(r)}
                            />
                        </div>

                        <StartButton
                            config={config}
                            title="开始生成照片"
                            model={model}
                            showPrice={true}
                            loading={loading}
                            onStart={generatePhoto}
                        />
                    </div>

                    <ResultView
                        config={config}
                        loading={loading}
                        error={error}
                        restoredImage={restoredImage}
                        restoredId={restoredId}
                        demoRooms={{ func: "createPoster", model: model }}
                    />
                </div>
            </main>
        </TopFrame>
    );
}

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx.query.simRoomId),
            config,
        },
    };
}
