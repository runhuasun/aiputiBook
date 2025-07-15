import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { Room } from "@prisma/client";

import { authOptions } from "../pages/api/auth/[...nextauth]";
import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import { config } from "../utils/config";
import { callAPI2 } from "../utils/apiUtils";

import FormLabel from "../components/FormLabel";
import PromptArea from "../components/PromptArea";
import DropDown from "../components/DropDown";
import StartButton from "../components/StartButton";
import ToolBar from "../components/ToolBar";
import TopFrame from "../components/TopFrame";
import ImageView from "../components/ImageView";

const modelNames = new Map([
    ["flux-canny-pro", "模仿原图的线条"],
    ["flux-depth-pro", "模仿原图的构图"],
]);
const models = Array.from(modelNames.keys());

export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let simRoomBody = null, image = null;
    if (session?.user?.email) {
        const roomId = ctx.query.roomId as string | undefined;
        if (roomId) {
            image = await prisma.room.findUnique({ where: { id: roomId } });
        }
        simRoomBody = await rmu.getRoomBody(ctx.query.simRoomId);
        const user = await prisma.user.findUnique({
            where: { email: session.user.email! },
            select: { id: true },
        });
        monitor.logUserRequest(ctx, session, user);
    } else {
        monitor.logUserRequest(ctx);
    }
    return {
        props: {
            simRoomBody,
            image,
            config,
        },
    };
}

export default function draftFree({
    simRoomBody,
    image,
    config,
}: {
    simRoomBody: any;
    image: Room;
    config: any;
}) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(
        (router.query.roomId as string) || null
    );
    const [originalPhoto, setOriginalPhoto] = useState<string | null>(
        (router.query.imageURL as string) ||
        image?.outputImage ||
        simRoomBody?.params?.imageURL ||
        ""
    );
    const [restoredImage, setRestoredImage] = useState<string | null>(
        simRoomBody?.output || null
    );
    const [restoredId, setRestoredId] = useState<string | null>(
        simRoomBody?.roomId || null
    );
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(
        !!simRoomBody
    );
    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>(simRoomBody?.prompt || "");
    const [promptStrength, setPromptStrength] = useState<number>(
        simRoomBody?.params?.guidance || 25
    );
    const [model, setModel] = useState<string>(
        simRoomBody?.params?.model || "flux-canny-pro"
    );

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { status } = useSession();

    const title = "模仿线条";

    async function generatePhoto(fileUrl: string | null) {
        if (!prompt) {
            return alert("请描绘画面内容！");
        }
        if (!fileUrl) {
            return alert("请先上传一张图片");
        }
        await callAPI2(
            "/api/workflowAgent2",
            {
                cmd: "controlImage",
                preRoomId,
                params: {
                    model,
                    imageURL: fileUrl,
                    prompt,
                    guidance: promptStrength,
                },
            },
            title,
            "IMAGE",
            (s) => setLoading(s),
            (res) => {
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
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} />

                <div className="page-container">
                    <ImageView num={num++} originalPhoto={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        onSelectRoom={(newRoom:any)=>{
                            setPreRoomId(newRoom?.id);
                        }}
                        onSelectImage={(newFile:string)=>{
                            setOriginalPhoto(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                        onContinue={(newFile:string)=>{
                            setOriginalPhoto(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                    />                      

                    <div className="page-tab-edit">
                        <div className="space-y-4 w-full">
                            <FormLabel number={`${num++}`} label="模仿方式" />
                            <DropDown
                                theme={model}
                                setTheme={setModel}
                                themes={models}
                                names={modelNames}
                            />
                        </div>
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel
                                number={`${num++}`}
                                label={`原作忠实度：${promptStrength}`}
                                hint="数值越大，生成结果越忠实于原作，但是会更缺乏创造力，并牺牲画面质量"
                            />
                            <input
                                type="range"
                                value={promptStrength}
                                min="1"
                                max="100"
                                className="slider-dark-green w-full mt-4"
                                onChange={(e) =>
                                    setPromptStrength(Number(e.target.value))
                                }
                            />
                        </div>
                        <div className="space-y-4 w-full max-w-lg mb-5">
                            <FormLabel
                                number={`${num++}`}
                                label="描绘画面内容"
                            />
                            <PromptArea
                                userPrompt={prompt}
                                onUserPromptChange={setPrompt}
                                hotWords="PORTRAIT_ALL"
                                hasAdvanceButton={false}
                            />
                        </div>

                        <StartButton
                            config={config} showPrice={true} loading={loading}
                            title="开始重绘"
                            onStart={() =>
                                generatePhoto(originalPhoto)
                            }
                        />
                    </div>
                </div>
            </main>
        </TopFrame>
    );

}
