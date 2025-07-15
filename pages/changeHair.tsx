import Head from "next/head";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useRouter } from "next/router";
import Link from "next/link";

import { Room } from "@prisma/client";
import prisma from "../lib/prismadb";
import * as monitor from "../utils/monitor";
import * as rmu from "../utils/roomUtils";
import * as fu from "../utils/fileUtils";
import { callAPI2 } from "../utils/apiUtils";
import { config, system } from "../utils/config";

import TopFrame from "../components/TopFrame";
import ToolBar from "../components/ToolBar";
import ImageView from "../components/ImageView";
import AlbumRoomSelector from "../components/AlbumRoomSelector";
import FormLabel from "../components/FormLabel";
import DropDown from "../components/DropDown";
import PromptArea from "../components/PromptArea";
import StartButton from "../components/StartButton";
import Footer from "../components/Footer";
import { extractMaskImage } from "../components/MaskImageEditor";
import HairAssistant from "../components/HairAssistant";
import RadioChoice from "../components/wrapper/RadioChoice";



// 声明性别类型
type GenderType = "female" | "male" | "boy" | "girl";

const genderNames = new Map([
    ["female", "女士发型"],
    ["male", "男士发型"],
    ["girl", "女孩发型"],
    ["boy", "男孩发型"]
]);
const genders:string[] = Array.from(genderNames.keys());

const hairModeNames = new Map([
    ["preDefined", "预设发型"],
    ["AI", "AI设计发型"],
    ["freePrompt", "自由设计"]
]);
const hairModes: string[] = Array.from(hairModeNames.keys());


const hairColorNames = new Map([
    ["none", "颜色不变"],
    ["black", "黑色头发"],
    ["jet black", "乌黑发亮"],
    ["brunette", "深褐色"],
    ["blonde", "金黄色"],
    ["rose gold", "玫瑰金"],
    ["dark brown", "深棕色"],
    ["medium brown", "棕色"],
    ["light brown", "浅棕色"],
    ["ash brown", "灰棕色"],
    ["ash blonde", "淡褐色"],
    ["auburn", "红褐色"],
    ["copper", "红棕色（紫铜色）"],
    ["strawberry blonde", "草莓红（浅红黄色）"],
    ["platinum blonde", "银色（特指染发）"],
    ["blue black", "蓝黑色"],
    ["golden blonde", "金色"],
    ["honey blonde", "蜜金色（深金色）"],
    ["caramel", "焦糖色"],
    ["chestnum", "板栗色"],
    ["mahogany", "红木褐色"],
    ["burgundy", "深红色"],
    ["pink", "粉红色"],
    ["purple", "紫色"],
    ["white", "白发"],
    ["blue", "蓝色"],
    ["red", "红色"],
    ["green", "绿色"],
    ["yellow", "黄色"],
    ["silver", "银发（老人）"],
    ["titanium", "钛金色"],
    ["grey", "花白"],
    ["colorful", "彩色"],
    ]);
const hairColors: string[] = Array.from(hairColorNames.keys());

const hairStyleList = [
    {code:"none",  name:"发型不变", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"straight",  name:"直发", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"wavy",  name:"波浪", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"curly",  name:"卷发", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"bob cut",  name:"波波头", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Lob",  name:"加长波波头", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Angled Bob",  name:"不对称波波头", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"A-Line Bob", name:"内扣波波头（A字）", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Asymmetrical Bob",  name:"斜裁波波头", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Graduated Bob",  name:"阶梯式波波头（内层渐短）", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Inverted Bob",  name:"倒置鲍勃头（内弯）", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"pixie cut",  name:"精灵式", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"layered",  name:"分层剪裁", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"messy bun",  name:"凌乱发髻", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"high ponytail",  name:"高马尾", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"low ponytail",  name:"低马尾", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"braided ponytail",  name:"麻花双马尾辫", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"French braid",  name:"法式发辫", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Dutch braid",  name:"荷兰辫子", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Fishtail braid",  name:"鱼尾辫子", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Space Buns",  name:"两边丸子头", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"top knot",  name:"头顶发髻", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Undercut",  name:"两边剃光的头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Mohawk",  name:"鸡冠头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Crew cut",  name:"标准平头", fit:{female:false, male:true, boy:true, girl:false} },
    {code:"faux hawk",  name:"小莫西干头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Slicked back",  name:"大背头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Side-Parted",  name:"偏分头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Center-Parted",  name:"中偏分", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Blunt Bangs",  name:"齐刘海", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Side-Swept Bangs",  name:"斜刘海（侧分刘海）", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Shag",  name:"蓬乱层次剪（夏克、蓬蓬）", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Layered Shag",  name:"多层蓬松狼尾（层次感碎剪）", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Choppy Layers",  name:"锯齿层次剪", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Razor Cut",  name:"剃刀剪", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Perm",  name:"烫发", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Ombré",  name:"渐变晕染", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Straightened",  name:"离子烫陶瓷烫拉直", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Soft Waves",  name:"柔波浪卷", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Glamorous Waves",  name:"华丽波浪卷", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Hollywood Waves",  name:"好莱坞波浪卷", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Finger Waves",  name:"手指波浪卷", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Tousled",  name:"蓬松微乱卷", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Feathered",  name:"羽状层次发（羽毛剪）", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Pageboy",  name:"童花头（锅盖头）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Pigtails",  name:"双马尾辫", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Pin Curls",  name:"发夹卷（针卷发）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Rollerset",  name:"卷发筒定型", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Twist Out",  name:"扭卷散发（扭转卷）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Bantu Knots",  name:"非洲发髻（班图结）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Dreadlocks",  name:"脏辫（雷鬼头）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Cornrows",  name:"玉米辫（贴头辫）", fit:{female:true, male:true, boy:true, girl:true} }, 
    
    {code:"Box Braids",  name:"盒辫（方形辫）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Crochet Braids",  name:"钩针辫（克罗切辫）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Double Dutch Braids",  name:"双荷兰辫（反手双辫）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"French Fishtail Braid",  name:"法式鱼尾辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Waterfall Braid",  name:"瀑布辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Rope Braid",  name:"绳状辫（麻花辫）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Heart Braid",  name:"心形辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Halo Braid",  name:"光环辫（天使环辫）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Crown Braid",  name:"皇冠辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Braided Crown",  name:"编发皇冠", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Bubble Braid",  name:"泡泡辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Bubble Ponytail",  name:"泡泡马尾", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Ballerina Braids",  name:"芭蕾舞者辫", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Milkmaid Braids",  name:"挤奶女工辫（田园辫）", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Bohemian Braids",  name:"波西米亚辫", fit:{female:true, male:true, boy:true, girl:true} },  
    
    {code:"Flat Twist",  name:"扁平扭辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Crown Twist",  name:"皇冠扭辫", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Twisted Bun",  name:"扭转发髻", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Twisted Half-Updo",  name:"扭转半扎发", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Twist and Pin Updo",  name:"扭转盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    
    {code:"Chignon",  name:"低发髻（法式发髻）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Simple Chignon",  name:"简约发髻", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Messy Chignon",  name:"凌乱发髻", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"French Twist",  name:"法式扭转（经典盘发）", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"French Twist Updo",  name:"法式扭转盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"French Roll",  name:"法式卷筒盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    
    {code:"Updo",  name:"盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Messy Updo",  name:"凌乱盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Knotted Updo",  name:"打结盘发", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Ballerina Bun",  name:"芭蕾舞发髻", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Banana Clip Updo",  name:"香蕉夹盘发", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Beehive",  name:"蜂窝头", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Bouffant",  name:"蓬松高髻", fit:{female:true, male:true, boy:true, girl:true} },  
    
    {code:"Hair Bow",  name:"蝴蝶结发型", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Half-Up Top Knot",  name:"半扎丸子头", fit:{female:true, male:false, boy:false, girl:true} },  
    {code:"Half-Up, Half-Down",  name:"半扎半放", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Messy Bun with a Headband",  name:"发带凌乱丸子头", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Messy Bun with a Scarf",  name:"丝巾凌乱丸子头", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Messy Fishtail Braid",  name:"凌乱鱼尾辫", fit:{female:true, male:true, boy:true, girl:true} },  
    
    {code:"Sideswept Pixie",  name:"侧梳精灵头", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Mohawk Fade",  name:"莫西干渐变头", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Zig-Zag Part",  name:"锯齿分界线", fit:{female:true, male:true, boy:true, girl:true} },  
    {code:"Victory Rolls",  name:"胜利卷发（复古波浪卷）", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Spiky",  name:"刺头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Two pigtails",  name:"小双辫", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Braid",  name:"麻花辫", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Bun",  name:"盘头", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Wave",  name:"大波浪", fit:{female:true, male:false, boy:false, girl:true} },
    {code:"Long",  name:"长发", fit:{female:true, male:true, boy:true, girl:true} },
    {code:"Buzz cut",  name:"寸头", fit:{female:false, male:true, boy:true, girl:false} },
    {code:"Bowl cut",  name:"锅盖头", fit:{female:false, male:true, boy:true, girl:false} },
    {code:"Quiff",  name:"飞机头", fit:{female:false, male:true, boy:true, girl:false} },
    ];


const modelNames = new Map([
    ["flux-kontext-pro", "自动识别发型区域"],
    ["ideogram-v3-quality", "精确控制发型区域"]
]);
const models:string[] = Array.from(modelNames.keys());

    
export default function changeHair({ simRoomBody, defaultImage,  config }: { simRoomBody:any, defaultImage: Room, config:any }) {
    const router = useRouter();
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();

    const [sideBySide, setSideBySide] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [restoredLoaded, setRestoredLoaded] = useState<boolean>(!!simRoomBody);
    const [error, setError] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(simRoomBody?.output);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
   
    const [image, setImage] = useState<string>("");
    const [hairMode, setHairMode] = useState<string>(simRoomBody?.params?.hairMode || "preDefined");
    const [extraPrompt, setExtraPrompt] = useState(simRoomBody?.params?.extraPrompt || "");
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);
    const [func, setFunc] = useState(router.query.func as string || simRoomBody?.params?.func || "flux-kontext-pro");
    const [title, setTitle] = useState<string>(router.query.title as string || "改变发型");
    const[ gender, setGender] = useState<GenderType>(simRoomBody?.params?.gender || "female");
    const [hairColor, setHairColor] = useState<string>(simRoomBody?.params?.hairColor || "none");
    const [hairStyle, setHairStyle] = useState<string>(simRoomBody?.params?.hairStyle || "none");
    const [maskCanvas, setMaskCanvas] = useState<any>();
    const [hairStyles, setHairStyles] = useState<any[]>([]);
    const [hairStyleNames, setHairStyleNames] = useState<Map<string,string>>(new Map());

    const [aiHairTypeStyleNames, setAiHairTypeStyleNames] = useState<Map<string, string>>(new Map());
    const [aiHairTypeStyles, setAiHairTypeStyles] = useState<string[]>([]);    
    const [aiHairTypeStyle, setAiHairTypeStyle] = useState<string>("");
    const [blink, setBlink] = useState<boolean>(false);
    
    useEffect(() => {
        const inputImage = (router.query.imageURL || defaultImage?.outputImage || simRoomBody?.params?.image || "") as string;
        if(inputImage){
            fu.aliyunImageRestrictResize(inputImage).then((result)=>{
                if(result){
                    setImage(result);
                }
            });
        }else{
            setImage("");
        }
    }, []); // 空数组表示只在组件挂载时执行一次
    
    useEffect(() => {
        if(gender){
            const newHairStyles = [];
            const newHairStyleNames = new Map();
            for(const s of hairStyleList){
                if(s.fit[gender] === true){
                    newHairStyles.push(s.code);
                    newHairStyleNames.set(s.code, s.name);
                }
            }
            setHairStyles(newHairStyles);
            setHairStyleNames(newHairStyleNames);
        }
    }, [gender]); 
    
    
    async function generate() {
        setBlink(false);
        
        if(!image){
            return alert("请先选择或上传一张照片！");
        }
        
        let inputText = "Keep the face unchanged. ";
        switch(hairMode){
            case "freePrompt":
                if(!extraPrompt){
                    return alert("请描绘一下新的发型和颜色");
                }
                break;
            case "preDefined":
                if(hairColor === "none" && hairStyle === "none"){
                    if(!extraPrompt){
                        return alert("请您选择改变发色还是改变发型？或者您也可以在补充需求里说明您的要求。");
                    }
                }else{
                    if(hairStyle === "none"){
                        inputText += " Keep the hairstyle unchanged. ";
                    }else{
                        inputText += ` Change the hairstyle to ${hairStyle} of ${gender}.`;
                    }
                    if(hairColor === "none"){
                        inputText += " Keep the hair color unchanged. ";
                    }else{
                        inputText += ` Change the hair color to ${hairColor}.`;            
                    }                    
                }
                break;
            case "AI":
                if(!aiHairTypeStyle){
                    if(!aiHairTypeStyles || aiHairTypeStyle.length == 0){
                        return alert("请先让AI为您设计一个发型吧！");
                    }else{
                        return alert(`AI已经为您设计了${aiHairTypeStyles.length}款新发型，请您先选择一个发型试试吧！`);
                    }
                }else{
                    inputText += ` Change the hair to ${aiHairTypeStyle}.`;                
                }
                break;
        }
        
        if(extraPrompt){
            inputText += ` ${extraPrompt}`;
        }                                             

        // 处理遮罩
        let maskImage:any = "";
        if(func === "ideogram-v3-quality"){
            if(maskCanvas){
                maskImage = extractMaskImage(maskCanvas);
            }        
            if(!maskImage){
                return alert("请先在原始图片上选择一个修改区域");
            }
            const bwt = await fu.isPureBWOrTransparentBase64(maskImage);
            switch(bwt){
                case "B":
                    return alert("您还没有在原始图片上选择一个修改区域");
                case "W":
                    return alert("您不能把所有的区域都涂抹成修改区域！");
            }
        }

        const res = await callAPI2(
            "/api/workflowAgent2", 
            {
                cmd:"changeHair", 
                preRoomId,
                params:{
                    func,
                    image, 
                    maskImage,
                    gender,
                    hairMode,
                    hairColor,
                    hairStyle,
                    aiHairTypeStyles,
                    width:imageWidth,
                    height:imageHeight,     
                    extraPrompt,
                    prompt: inputText,
                }
            },
            title,
            "IMAGE",
            (status:boolean)=>{setLoading(status)},
            (res:any)=>{
               mutate();
               setRestoredImage(res.result?.generated);
               setRestoredId(res.result?.genRoomId);                                      
            },
            (res:any)=>{
                if(res?.result?.indexOf("输入无效")>=0){
                    alert("图片尺寸不符合要求，请用照片裁剪功能，先把照片裁剪成标准16:9，标准9:16，标准4:3，标准3:4，或者标准1:1尺寸，再来尝试");
                    window.open(`/editImage?imageURL=${image}`);
                    return true;
                }else{
                    return false;
                }
            }
        );                    
    }


    let num = 1;

    return (
        <TopFrame config={config}>
            <main>
                <ToolBar config={config} roomId={preRoomId} imageURL={image} restoredImage={restoredImage} restoredId={restoredId} />
                
                <div className="page-container">

                    <ImageView num={num++} originalPhoto={image} restoredImage={restoredImage} restoredId={restoredId} loading={loading} error={error}
                        supportMask={func != "flux-kontext-pro"} needMask={func != "flux-kontext-pro"} params={{initMaskAreas:["hair"]}}
                        onMaskUpdate={(maskCanvas: HTMLCanvasElement)=>{
                            setMaskCanvas(maskCanvas);
                        }}
                        onSelectRoom={(newRoom:any)=>{
                            setPreRoomId(newRoom?.id);
                        }}
                        onSelectImage={(newFile:string)=>{
                            setImage(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                        onContinue={(newFile:string)=>{
                            setImage(newFile);
                            setRestoredImage(null);
                            setError(null); 
                        }}
                    />
                    
                    <div className="page-tab-edit">            

                        <div className="w-full flex flex-col items-center py-5">
                            <RadioChoice values={hairModeNames} selectedValue={hairMode} onSelect={e => setHairMode(e)} />
                        </div>                            

                        <div className="space-y-4 w-full max-w-lg justify-center">
                            <FormLabel number={`${num++}`} label="选择头发识别方式"/>                                
                            <DropDown
                                theme={func}
                                // @ts-ignore
                                setTheme={(newRoom) => setFunc(newRoom)}
                                themes={models}
                                names={modelNames}
                                />
                        </div>     

                        {hairMode === "AI" && (
                        <div className="space-y-4 w-full max-w-lg justify-center">
                            <div className="flex flex-row items-center space-x-3">
                                <FormLabel number={`${num++}`} label={aiHairTypeStyles?.length>0 ? "选择AI刚给您设计的发型" : "让AI为您设计发型："}/>                                
                                <HairAssistant
                                    title={"AI设计发型"}
                                    userImage={image}
                                    user={session?.user}
                                    className={`flex ${aiHairTypeStyles?.length>0 ? "button-main" : "button-green-blue"} text-sm px-3 py-1 mt-3`}
                                    onOpen={() => {
                                        setBlink(false);
                                        if(!image){
                                            alert("请您先上传一张您的照片，然后再让AI为您设计发型。");
                                            return false;
                                        }else{
                                            return true;
                                        }
                                    }}
                                    onOK={(ret) => {
                                        if(ret?.size > 0){
                                            console.log(Array.from(ret.entries()));
                                            const styles = Array.from(ret.keys());
                                            setAiHairTypeStyleNames(ret);
                                            setAiHairTypeStyles(styles);
                                            setAiHairTypeStyle(styles[0]);
                                            setBlink(true);
                                        }
                                    }}
                                />
                            </div>
                            {aiHairTypeStyles?.length>0 && (
                            <DropDown
                                blink={blink}
                                theme={aiHairTypeStyle}
                                // @ts-ignore
                                setTheme={(newRoom) => setAiHairTypeStyle(newRoom)}
                                themes={aiHairTypeStyles}
                                names={aiHairTypeStyleNames}
                                />
                            )}
                        </div>    
                        )}

                        {hairMode === "preDefined" && (
                        <div className="space-y-4 w-full max-w-lg justify-center">
                            <FormLabel number={`${num++}`} label="选择性别"/>                                
                            <DropDown
                                theme={gender}
                                // @ts-ignore
                                setTheme={(newRoom) => setGender(newRoom)}
                                themes={genders}
                                names={genderNames}
                                />
                        </div>
                        )}

                        {hairMode === "preDefined" && (
                        <div className="space-y-4 w-full max-w-lg justify-center">
                            <div className="flex flex-row items-center space-x-3">
                                <FormLabel number={`${num++}`} label="选择头发造型" hint="技巧：如果手工选择头发区域，当选择发型明显会比原发型占用空间更大时，比如短发变成长发，需要涂抹出更多的区域来告诉AI在哪里绘制出更多头发。"/> 
                                <div className="w-20">
                                    <AlbumRoomSelector title="发型相册" className="button-green-blue px-3 py-1 mt-3 text-center"
                                        albumId={["female", "girl"].includes(gender) ? system.album.hairStyleWoman.id : system.album.hairStyleMan.id} 
                                        onSelectRoom={(newRoom) => {
                                            const body = JSON.parse(newRoom.bodystr);
                                            setHairStyle(body?.params?.hairStyle || "none");
                                        }}
                                    />
                                </div>
                            </div>
                            <DropDown
                                theme={hairStyle}
                                // @ts-ignore
                                setTheme={(newRoom) => setHairStyle(newRoom)}
                                themes={hairStyles}
                                names={hairStyleNames}
                                />
                        </div>
                        )}

                        {hairMode === "preDefined" && (
                        <div className="space-y-4 w-full max-w-lg justify-center">
                            <div className="flex flex-row items-center space-x-3">
                                <FormLabel number={`${num++}`} label="选择头发颜色"/>                                
                                <div className="w-20">
                                    <AlbumRoomSelector title="发色相册" className="button-green-blue px-3 py-1 mt-3 text-center"
                                        albumId={system.album.hairColor.id}
                                        onSelectRoom={(newRoom) => {
                                            const body = JSON.parse(newRoom.bodystr);
                                            setHairColor(body?.params?.hairColor || "none");
                                        }}
                                    />                                            
                                </div>
                            </div>                                
                            <DropDown
                                theme={hairColor}
                                // @ts-ignore
                                setTheme={(newRoom) => setHairColor(newRoom)}
                                themes={hairColors}
                                names={hairColorNames}
                                />
                        </div>
                        )}

                        <div className="space-y-4 w-full max-w-lg justify-center">                            
                            <FormLabel number={`${num++}`} label={hairMode === "freePrompt" ? "发型变更要求" : "对发型发色的补充要求（可选）"}/>   
                            <PromptArea initPlaceHolder={hairMode === "freePrompt" ? "例如：把头发变成红色的短发" : "例如：头发尽量短一些，整齐一些"}
                                hotWords="NO_HOTWORDS"
                                hasAdvanceButton={false}
                                userPrompt={extraPrompt}
                                onUserPromptChange={(up) => setExtraPrompt(up) }
                                />                             
                        </div>
                        
                        <StartButton config={config} showPrice={true} loading={loading}
                            onStart={() => {
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);                      
                                generate();
                            }}/>


                        <div className="w-full max-w-lg flex flex-col items-start space-y-2 pt-20">
                            <div className="w-full max-w-lg flex flex-row items-center justify-center tracking-widest">
                                <span>需要更“准确”的匹配发型？</span>
                                <Link href={`/hairDesign?imageURL=${image}`} className="underline underline-offset-2">发型匹配中心</Link>
                            </div>                            
                        </div>                            
                    </div>

                </div>                          
        
            </main>
        </TopFrame>
    );
};

    
      
export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);
    let imgId = ctx?.query?.roomId;
    let defaultImage = null;
    
    if(imgId){
        defaultImage = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                            
            defaultImage,
            config
        },
    };
  
}            
