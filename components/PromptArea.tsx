import { useEffect, useState } from "react";
import SysPrompts from "./SysPrompts";
import TextareaAutosize from "react-textarea-autosize";
import * as sw from "../utils/sensitiveWords";

export const posterDesignHotWords:string[] = [
    "618购物节的促销海报",
    "双11购物节的促销海报",
    "科技感风格",
    "热烈的风格",
    "中国古典风格",
    "唐朝的风格",
    "明朝的风格",
    "活泼卡通风格",    
    "油画风格",
    ];

export const adInHandHotWords:string[] = [
    "女模特手里拎着一只包",
    "女模特手里拿着一个易拉罐",
    "女模特手里拿着一瓶苹果大小的香水",
    "女模特站在汽车前面",
    "女模特手里拿着一瓶洗发水，站在超市的货架旁边",
    "男模特戴着耳机",
    "男模特坐在沙发上",
    ];
export const hairDescHotWords:string[] = [
    "黑色", "红色", "白色", "粉色", "灰色",
    "中分头", "偏分头", "直发", "卷发", "波波头", "马尾辫", "小双辫", "麻花辫", "大波浪", "长发" 
];

export const faceDetailHotWords:string[] = [
    "修复面部瑕疵",
    "让皮肤自然",
    "眼睛清澈",
    "眼睛更大",
    "红嘴唇",
    "粉色嘴唇",
    "微笑",
    "大笑",
    "愤怒",
    "哭泣",
    "忧郁",
    "张开嘴",
    "闭上嘴",
    "白色牙齿"
];

export const recolorHotWords:string[] = [
        "把照片改成彩色的",
        "持人物和画面不变",
        "衣服染成军绿色",
        "把肩章染成红色",
        "把五角星染成红色",
        "上衣染成军蓝色",
        "下衣染成军蓝色",
        "把围巾染成红色",
        "把后面的房子染成红色"
];

export const freeEditHotWords:string[] = [
    "让皮肤变得白嫩",
    "删除画面中的水印",
        "把衣服换成白衬衣",
        "把画面改成真实的照片，构图和人物相貌保持不变",
        "把画面中人物改成穿白色运动衣",
        "把头发换成金色",
        "给人物戴上眼镜",
        "摘掉人物的眼镜",
        "让人物戴白金钻石项链",
        "把人物皮肤换成非洲黑人的颜色",
        "把人物皮肤换成欧洲白人的颜色",
        "给人物戴上帽子",
        "把中间的男人换成一个美国白人",
        "把左侧男的头发变成红色",
        "把照片变成彩色照片"
];

export const musicHotWords:string[] = [
        "流行音乐", "古典音乐", "重金属音乐", "摇滚乐", "电子音乐", "爵士乐", "蓝调", 
        "乡村音乐", "拉丁音乐", "轻音乐", "圆舞曲", "小夜曲", 
        "钢琴", "电子琴", "小提琴", "架子鼓", "吉他", "小号", "手风琴",
        "欢乐", "忧伤", "庆祝", "安静", "冥想",        
        ];

export const putModelHotWords:string[] = [
        "站着一位女士", "坐着一位女士", "站着一位男士", "坐着一位男士",
        "穿职业套装", "穿连衣裙", "穿运动装"
        ];
export const audioHotWords:string[] = [
        "轻柔的背景音乐",
        "快节奏流行音乐",
        "爵士乐", "钢琴曲", "小提琴协奏曲",
        "海浪的声音",
        "轻柔的风声",
        "汽车的轰鸣声",
        "高跟鞋走路的声音",
        "水龙头流水的声音",
        "闹钟滴答滴答声",
        "喧闹的大街上嘈杂声",
        "狗叫","猫叫","鸟叫",
        ];
export const lyricHotWords:string[] = [
        "歌颂祖国",
        "歌颂爱情",
        "歌颂友谊",        
        "抒发心中的壮志",
        "思念家乡",
        "想念爱人",
        "努力奋斗",
        "美丽的风景",
        ];
export const backgroundHotWords:string[] = [
        "在豪华的办公室里",
        "在繁华的大街上",
        "在一片原始树林里",
        "在海边的沙滩上",
        "在一片竹林里",
        "在一栋美式别墅的客厅",
        "在长城上",
        "在纽约时代广场",
        "背后是自由女神像",
        "背后是巴黎艾菲尔铁塔",
        "远处是富士山",
        "在非洲大草原，角马正在大迁徙",
        "背后是金字塔和狮身人面像",
        "白色背景",
        "红色背景",
        "黑色背景",
        "灰色背景",
        "棕色背景",
        "蓝色背景",  
    ];

export const groupHotWords:string[] = [
        "在豪华的办公室里",
        "在繁华的大街上",
        "在一片原始树林里",
        "在海边的沙滩上",
        "在一片竹林里",
        "在一栋美式别墅的客厅",
        "在长城上",
        "在纽约时代广场",
        "背后是自由女神像",
        "背后是巴黎艾菲尔铁塔",
        "远处是富士山",
        "在非洲大草原，角马正在大迁徙",
        "背后是金字塔和狮身人面像",
        "白色背景",
        "红色背景",
        "黑色背景",
        "灰色背景",
        "棕色背景",
        "蓝色背景",  
    ];

export const characterHotWords:string[] = [
        "一位女士",
        "一位男士",
        "一个男孩",
        "一个女孩",
        "中国人",
        "美国人",
        "北欧人",
        "阿拉伯人",
        "东南亚人",
        "印度人",
        "非洲黑人",
    ];

export const userDescHotWords:string[] = [
       "很瘦",
       "苗条",
       "微胖",
       "丰满",  
       "很胖",
       "非常胖",

       "圆脸",
       "长脸",
       "方脸",
       "瘦脸",
       "椭圆脸型",
       "宽脸",
       
        "长发",
        "短发",
        "披肩发",
        "卷发",
        "大背头",
        "盘头",
        "马尾辫",
        "偏分头",
        "平头",
       
       "戴黑框眼镜",
       "戴金丝边眼镜",
];

export const portraitHotWords:string[] = [
       
       "微笑",
       "大笑",
       "端庄",         
       "表情严肃",
        
       "戴帽子",
       "戴棒球帽",

       "戴耳环",
       "戴戒指",
       "戴项链",
       "系领带",
       "系围巾",
      
        "在豪华的办公室里",
        "在繁华的大街上",
        "在一片原始树林里",
        "在海边的沙滩上",
        "在一片竹林里",
        "在一栋美式别墅的客厅",
        "在长城上",
        "在纽约时代广场",
        "背后是自由女神像",
        "背后是巴黎艾菲尔铁塔",
        "远处是富士山",
        "在非洲大草原，角马正在大迁徙",
        "背后是金字塔和狮身人面像",
      "在海边散步",
      "在喝咖啡",
      "在跑步",
      "在跳舞",
      "在巴黎街头散步",
      "在纽约时代广场",
      "站在舞台中央",
];

export const defaultHotWords:string[] = [
       "戴帽子",
       "戴棒球帽",

       "戴耳环",
       "戴戒指",
       "戴项链",
       "系领带",
       "系围巾",
       
       "微笑",
       "大笑",
       "端庄",         
       "表情严肃",
       
       "穿白色连衣裙",
       "穿黑色晚礼服", 
       "穿红色旗袍",
       "穿深色西装",
       "穿职业套装",
       "穿白衬衣",
       "穿牛仔裤",
       "穿A字裙",
       "穿运动衣",
       "穿套头衫",
       "穿连帽衫",
        "比基尼泳衣",
       
      "黑色背景",
      "灰色背景",
      "红色背景",
      "蓝色背景",
    
      "在海边散步",
      "在喝咖啡",
      "在跑步",
      "在跳舞",
      "在巴黎街头散步",
      "在纽约时代广场",
      "站在舞台中央",
];

export const repaireHotWords:string[] = [
        "手",
        "脚",
        "腿",
        "脚",
        "眼睛",
        "胸部",
        "胳膊",
        "皮肤",
        "头部",
        "头发",
        "上衣",
        "裙子",
        "删除水印",
        "删除人"
    ];

export const clothHotWords:string[] = [
  //  "一位美女",
  //  "一位帅哥",
  //  "一位大叔",
  //  "一位大婶",
  //  "一个小女孩",
  //  "一个小男孩",
    "穿白色连衣裙",    
    "穿黑色晚礼服",
    "穿红色旗袍",
    "穿深色西装",
    "穿职业套装",
    "穿白衬衣",
    "穿牛仔裤",
    "穿A字裙",
    "穿运动衣",
    "穿套头衫",
    "穿连帽衫",
    "穿比基尼泳衣",
];

export const clothDescHotWords:string[] = [
    "T恤衫",
    "白色连衣裙",    
    "黑色晚礼服",
    "红色旗袍",
    "深色西装",
    "职业套装",
    "白衬衣",
    "牛仔裤",
    "A字裙",
    "运动衣",
    "套头衫",
    "连帽衫",
    "比基尼泳衣",
];


interface PromptAreaProps {
    userPrompt?: string;
    onSysPromptChange?: (prompt: string) => void;
    onUserPromptChange: (prompt: string) => void;
    hotWords?: string | string[];
    imageType?: string;
    hasAdvanceButton?: boolean;
    showAdvance?: boolean;
    defaultUserPrompt?: string;
    readOnly?: boolean;
    initMinRows?: number;
    initMaxRows?: number;
    maxLength?: number;
    initPlaceHolder?: string;
}


export default function PromptArea({ onSysPromptChange, onUserPromptChange, imageType="PORTRAIT", userPrompt, initMinRows, initMaxRows, maxLength, initPlaceHolder,
                                    hotWords="NO_HOTWORDS", defaultUserPrompt="", showAdvance=false, hasAdvanceButton=true, readOnly=false}: PromptAreaProps) {
    
    // const [userPrompt, setUserPrompt] = useState<string>(defaultUserPrompt);
    const [showMoreWords, setShowMoreWords] = useState<boolean>(showAdvance);
    const [placeHolder, setPlaceHolder] = useState<string>(initPlaceHolder || "例如：一只恐龙从校园的森林里路过");     
    const [initHotWords, setInitHotWords] = useState<string[]|null>([]);
    const [minRows, setMinRows] = useState<number>(initMaxRows || 1);
    const [maxRows, setMaxRows] = useState<number>(initMaxRows || 15);
        
  useEffect(() => {
    switch(hotWords){
        case "POSTER_DESIGN":
            setInitHotWords(posterDesignHotWords);
            setPlaceHolder(initPlaceHolder || "例如：618购物街的促销活动");
            setMinRows(initMinRows || 5);
            setMaxRows(initMaxRows || 15);
            break;
            
        case "AD_IN_HAND":
            setInitHotWords(adInHandHotWords);
            setPlaceHolder(initPlaceHolder || "例如：女模特手里拿着一瓶苹果大小的香水");
            setMinRows(initMinRows || 3);
            setMaxRows(initMaxRows || 5);
            break;
            
        case "FACE_DETAIL":            
            setInitHotWords(faceDetailHotWords);
            setPlaceHolder(initPlaceHolder || "例如：修复面部瑕疵，眼神清澈，红嘴唇");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 5);
            break;
            
        case "FREE_EDIT":            
            setInitHotWords(freeEditHotWords);
            setPlaceHolder(initPlaceHolder || "例如：把人物的皮肤换成欧洲白人的颜色");
            setMinRows(initMinRows ||5);
            setMaxRows(initMaxRows || 10);
            break;

        case "RECOLOR":            
            setInitHotWords(recolorHotWords);
            setPlaceHolder(initPlaceHolder || "例如：把照片改成彩色的，保持人物和画面不变");
            setMinRows(initMinRows ||5);
            setMaxRows(initMaxRows || 10);
            break;            
        
          case "CREATE_MUSIC":
            setInitHotWords(musicHotWords);
            setPlaceHolder(initPlaceHolder || "例如：一首古典音乐，表现战争场面，史诗级的进攻。钢琴 , 小提琴 , 忧伤 , 安静");
            setMinRows(initMinRows ||5);
            setMaxRows(initMaxRows || 10);
            break;
                
        case "PUT_MODEL":                
            setInitHotWords(putModelHotWords);
            setPlaceHolder(initPlaceHolder || "例如：站着一位美女，穿黑色晚礼服");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 10);
            break;
            
        case "AUDIO":
            setInitHotWords(audioHotWords);
            setPlaceHolder(initPlaceHolder || "例如：轻柔的背景音乐，小鸟的叫声");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 10);
            break;
            
        case "NO_HOTWORDS":
            setInitHotWords(null);
            setPlaceHolder(initPlaceHolder || "");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 10);
            break;

        case "HAIR_DESC": 
            setInitHotWords(hairDescHotWords);
            setPlaceHolder(initPlaceHolder || "例如：黑色大波浪");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 10);
            break;
            
        case "USER_DESC": 
            setInitHotWords(characterHotWords.concat(userDescHotWords));
            setPlaceHolder(initPlaceHolder || "例如：丰满，短发，戴黑框眼镜");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 5);
            break;
    
       case "LYRIC_ASSISTANT":
            setInitHotWords(lyricHotWords);   
            setPlaceHolder(initPlaceHolder || "在这里输入您的创意内容");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 5);
            break;
                   
        case "PROMPT_ASSISTANT":
            setInitHotWords(characterHotWords.concat(userDescHotWords.concat(defaultHotWords)));   
            setPlaceHolder(initPlaceHolder || "在这里输入您的创意内容");
            setMinRows(initMinRows ||3);
            setMaxRows(initMaxRows || 5);
            break;
                    
        case "PHOTO_DESC":
            setInitHotWords(defaultHotWords);
            setPlaceHolder(initPlaceHolder || "例如：戴棒球帽，穿牛字裤，在纽约时代广场");
            setMinRows(initMinRows ||5);
            setMaxRows(initMaxRows || 15);
            break;

        case "PORTRAIT":
            setInitHotWords(portraitHotWords);
            setPlaceHolder(initPlaceHolder || "例如：微笑，站在纽约时代广场");
            setMinRows(initMinRows ||5);
            setMaxRows(initMaxRows || 15);
            break;
            
        case "PORTRAIT_ALL":
                setInitHotWords(characterHotWords.concat(userDescHotWords.concat(defaultHotWords)));   
                setPlaceHolder(initPlaceHolder || "例如：一位，女士，中国人，丰满，短发，穿牛字裤");
                setMinRows(initMinRows ||5);
                setMaxRows(initMaxRows || 20);
                break;
                
            case "REPAIRE":
                setInitHotWords(repaireHotWords);
                setPlaceHolder(initPlaceHolder || "例如：一只手");
                setMinRows(initMinRows ||3);
                setMaxRows(initMaxRows || 5);
                break;

            case "CLOTH":
                setInitHotWords(clothHotWords);
                setPlaceHolder(initPlaceHolder || "例如：一位美女，穿白色比基尼泳衣");
                setMinRows(initMinRows || 4);
                setMaxRows(initMaxRows || 10);
                break;

            case "CLOTH_DESC":
                setInitHotWords(clothDescHotWords);
                setPlaceHolder(initPlaceHolder || "例如：白色连衣裙，纯棉材质");
                setMinRows(initMinRows || 4);
                setMaxRows(initMaxRows || 15);
                break;                    
            
            case "MODEL_DESC":
                setInitHotWords(characterHotWords.concat(userDescHotWords));   
                setPlaceHolder(initPlaceHolder || "例如：一位女士，中国人，短发，戴项链");
                setMinRows(initMinRows ||5);
                setMaxRows(initMaxRows || 20);
                break;
                    
            case "BG":
                setInitHotWords(backgroundHotWords);
                setPlaceHolder(initPlaceHolder || "例如：一望无际的大草原");
                setMinRows(initMinRows ||3);
                setMaxRows(initMaxRows || 5);
                break;
                        
            case "GROUP":
                setInitHotWords(groupHotWords);
                setPlaceHolder(initPlaceHolder || "例如：结婚登记用的合照，红色背景");
                setMinRows(initMinRows ||3);
                setMaxRows(initMaxRows || 5);
                break;

            case "EMPTY":
                setInitHotWords([]);
                setPlaceHolder(initPlaceHolder || "");
                setMinRows(initMinRows ||6);
                setMaxRows(initMaxRows || 10);
                break;
                        
            default:
                setInitHotWords(userDescHotWords.concat(defaultHotWords));
                setPlaceHolder(initPlaceHolder || "例如：短发，戴黑框眼镜，穿牛字裤，在纽约时代广场");
                setMinRows(initMinRows ||3);
                setMaxRows(initMaxRows || 10);
        }
    }, [hotWords]); 
  
  
    return (
        <div className="relative group inline-block w-full" tabIndex={0}>
            
            <TextareaAutosize id="iptPrompt"  
                minRows={minRows} maxRows={maxRows} maxLength={maxLength}
                className="w-full bg-slate-800 text-gray-100 border border-gray-600 focus:ring-1 focus:border-gray-500 focus:ring-gray-500 rounded-lg font-medium px-4 py-2 " 
                value={userPrompt}
                placeholder={placeHolder}
                readOnly = { readOnly }
                onChange={(e) => {
                    // setUserPrompt(e.target.value);
                    onUserPromptChange(sw.maskSensitiveWord(e.target.value));
                }} 
                />
            
            <button onClick={(e:any) => {
                userPrompt = "";
                e.stopPropagation();
                onUserPromptChange("");
                }}
                className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500">
                <span className="sr-only">删除</span>
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                    <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
                </svg>
            </button>                        
            
            <div className="hidden group-focus-within:flex w-full flex-wrap text-left gap-2 px-2 py-1 ">
                { initHotWords && initHotWords.length>0 && (                
                <span className="text-white font-medium">热门：</span>
                )}
                { initHotWords && initHotWords.map((word) => (
                <button className="button-gray px-1 mb-1"   
                    onClick={(e:any) => {
                        e.stopPropagation();                        
                        const newPrompt = userPrompt ? (`${userPrompt} , ${word}`) : word;
                        // setUserPrompt( newPrompt );
                        onUserPromptChange( newPrompt );
                    }} 
                    >
                    {word}
                </button>
                ))}   
                { hasAdvanceButton && (
                <button className="button-main px-3 mb-1"   
                  onClick={(e:any) => {
                      e.stopPropagation();                      
                      showMoreWords ? setShowMoreWords(false) : setShowMoreWords(true);
                  }} 
                  >
                  {"高级..."}
                </button>               
                )}
            </div>
    
            {showMoreWords && (
            <SysPrompts
                   appendPrompts={(prompts) => {
                       if(typeof onSysPromptChange == "function"){
                           onSysPromptChange(prompts);
                       }
                   }}
                   showMoreWords={(isShow) => setShowMoreWords(isShow)}
              />          
            )}
        
        </div>
    
    );
 
}


  
    
