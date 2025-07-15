import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ComboSelector from "../components/ComboSelector";
import FormLabel from "../components/FormLabel";
import DrawRatioSelector from "../components/DrawRatioSelector";
import PromptArea from "../components/PromptArea";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";
import InputImage from "../components/InputImage";
import ResultView from "../components/ResultView";
import Footer from "../components/Footer";

import { themeType, themes, themeNames } from "../utils/adInpaintTypes";
import { callAPI2 } from "../utils/apiUtils";
import * as rmu from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import { config, system } from "../utils/config";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody: await rmu.getRoomBody(ctx?.query?.simRoomId),
            config,
        },
    };
}

export default function AdInpaint({
    simRoomBody,
    config,
}: {
    simRoomBody: any;
    config: any;
}) {
    const router = useRouter();
    const title = "通用产品图制作";

    const [preRoomId, setPreRoomId] = useState<string | null>(
        (router.query.roomId as string) || null
    );
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(
        (router.query.imageURL as string) || simRoomBody?.params?.imageUrl
    );
    const [restoredImage, setRestoredImage] = useState<string | null>(
        simRoomBody?.output
    );
    const [restoredId, setRestoredId] = useState<string | null>(
        simRoomBody?.roomId
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<string>(
        simRoomBody?.params?.theme || "Original"
    );
    const [prompt, setPrompt] = useState<string>(
        simRoomBody?.params?.inputText || ""
    );
    const [drawRatio, setDrawRatio] = useState<string>(
        (router.query.drawRatio as string) ||
            simRoomBody?.params?.drawRatio ||
            "916"
    );

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { mutate } = useSWR("/api/remaining", fetcher);

    async function generate() {
        if (!originalPhoto) {
            alert("请先上传一张广告图片");
            return;
        }

        await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "adInpaint",
                params: {
                    func: "adInpaint",
                    drawRatio,
                    imageUrl: originalPhoto,
                    theme,
                    room: "",
                    inputText: prompt,
                },
            },
            "广告生成",
            "IMAGE",
            (s: boolean) => setLoading(s),
            (res: any) => {
                mutate();
                setRestoredImage(res.result.generated);
                setRestoredId(res.result.genRoomId);
            }
        );
    }

    let step = 1;
    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} />

                <div className="page-container">
                    <div className="page-tab-image-create">
                        <div className="flex items-center space-x-3">
                            <FormLabel
                                number={`${step++}`}
                                label="产品图片(必须无背景！)"
                            />
                            <button
                                className="button-green-blue text-xs px-2 py-1 mt-3"
                                onClick={() =>
                                    window.open(
                                        "/removeBG" +
                                            (originalPhoto
                                                ? `?imageURL=${originalPhoto}&method=AUTO`
                                                : ""),
                                        "_blank"
                                    )
                                }
                            >
                                抠图工具
                            </button>
                        </div>
                        <InputImage src={originalPhoto} />
                        <ComboSelector
                            selectorType="TEMPLATE" albumId={system.album.demoProduct.id} albumName="样例"                                                    
                            onSelectRoom={(newRoom) =>
                                setPreRoomId(newRoom?.id)
                            }
                            onSelect={(file) => setOriginalPhoto(file)}
                            showDemo={false}
                        />

                        <FormLabel
                            number={`${step++}`}
                            label="产品在广告画面中的占比"
                        />
                        <DropDown
                            theme={theme}
                            setTheme={(t) => setTheme(t)}
                            themes={themes}
                            names={themeNames}
                        />

                        <FormLabel number={`${step++}`} label="画面输出比例" />
                        <DrawRatioSelector
                            defaultRatio={drawRatio}
                            onSelect={(r) => setDrawRatio(r)}
                        />

                        <FormLabel
                            number={`${step++}`}
                            label="描绘产品广告画面"
                        />
                        <PromptArea
                            hotWords="NO_HOTWORDS"
                            hasAdvanceButton={false}
                            userPrompt={prompt}
                            readOnly={false}
                            onUserPromptChange={(t) => setPrompt(t)}
                        />

                        <StartButton
                            config={config}
                            title="开始生成"
                            showPrice
                            loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setError(null);
                                generate();
                            }}
                        />
                    </div>

                    <ResultView
                        config={config}
                        loading={loading}
                        error={error}
                        restoredImage={restoredImage}
                        restoredId={restoredId}
                        demoRooms={{ func: "adInpaint" }}
                    />
                </div>
            </main>
            <Footer />
        </TopFrame>
    );
}
