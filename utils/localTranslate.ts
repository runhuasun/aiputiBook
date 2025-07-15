import * as gu from "./globalUtils";
import * as debug from "./debug";


export const languageNames = new Map([
    ["zh","中文"],
    ["en","英文"],    
    ["fr", "法语"],
    ["de", "德语"],    
    ["ja", "日语"],    
    ["ru", "俄语"],    
    ["es", "西班牙语"],    
    ["ar", "阿拉伯语"],    
    ["pt", "葡萄牙语"],        
    ["it", "意大利语"],        
    ["kr", "韩语"],        
]);

export const languages = Array.from(languageNames.keys());

/**
 * 百度语言翻译API调用
 * 使用 AK，SK 生成鉴权签名（Access Token）
 * @return string 鉴权签名信息（Access Token）
 */
async function getAccessToken() {

    let res = await fetch('https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=' + process.env.BAIDU_API_KEY + '&client_secret=' + process.env.BAIDU_SECRET_KEY, {
        'method': 'POST',
     });
  
    let token = await res.json();
  
     // @ts-ignore
    return token.access_token;
}


async function translateByBaidu( inputTxt: string, from:string="zh", to:string="en"){
    
    if(inputTxt == null || inputTxt.trim() == ""){
        return "";
    }
    
    let cache = await gu.globalGet("TRANSLATE_CN_EN", inputTxt);
    if(cache){
        return cache;
    }
    
    let token = await getAccessToken();
    let res = await fetch('https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1?access_token=' + token, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            "from": from,
            "to": to,
            "q": inputTxt,
        }),
    });

    let resJson = await res.json();
    let outputTxt = "";
    
    // @ts-ignore
    if(resJson.result && resJson.result.trans_result){
        for(const seg of resJson.result.trans_result){
            outputTxt += seg.dst;
        }
        debug.log(`[from:]${inputTxt}\n[to:]${outputTxt}`);      
    }else{
        debug.error(resJson.error_code + ":" + resJson.error_msg);  
    }

    await gu.globalSet("TRANSLATE_CN_EN", inputTxt, outputTxt);
    
    return outputTxt;
}

 /**
 * 结束百度语言翻译API调用
 */


// 系统预置的单词，防止系统翻译错
const presetWords = new Map([
  ["紫禁城" , "the Forbidden City"],
  ["天安门", "the Tiananmen square"],
  ["长城" , "the Great Wall"],
  ["巴黎铁塔" , "the Eiffel Tower"],
  ["埃菲尔铁塔" , "the Eiffel Tower"],
  ["罗浮宫" , "the Louvre Museum"],
  ["时代广场" , "the Times Square"],
  ["特朗普" , "Donald Trump"],
  ["迈克尔杰克逊", "Michael Jackson"],
  ["迈克尔乔丹", "Michael Jordan"],  
  ["乔丹", "Michael Jordan"],
  ["T恤衫", "T-shirt"],
  ["T恤", "T-shirt"],
  ["T台", "runway"],
  ["丰满", "huge breasts"],
  ["微胖", "Slightly overweight"],
  ["，", ","],
  ["。", "."],
  ["‘", "'"],  
  ["’", "'"],
  ["“", '"'],
  ["”", '"'],  
  ["：", ":"],
  ["！", "!"],  
  ["（", "("],  
  ["）", ")"],
  ["【", "["],    
  ["】", "]"],   
  ["——", "-"],      
  ["《", "<"],   
  ["》", ">"],        
  ]);

function translatePresetWords(input: string){

  presetWords.forEach((value, key) => {
    input = input.replace(new RegExp(key, 'g'), value);
  });
  return input;
}

async function translateMixedString(str: string) {
  let result: string = "";
  let temp: string = "";
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    if (isChineseChar(char)) {
      temp += char;
    } else {
      if (temp.length > 0) {
        result += await translateByBaidu(temp);
        temp = "";
      }
      result += char;
    }
  }
  if (temp.length > 0) {
    result += " " + await translateByBaidu(temp, "zh", "en") + " ";  // 因为中英在一起是没有空格的，如果把中文翻译成英文，那么英文之间也没空格了
  }
  return result;
}

async function translateChineseSegment(str: string): Promise<string> {
    const segments = str.split(/([。！？，、；：‘’“”（）【】—…。,;:'"()\-[\]!?.])/);
    let result = "";

    for (const segment of segments) {
        if (segment.length > 0 && containsChinese(segment)) {
            const translated = await translateByBaidu(segment, "zh", "en");
            result += translated;
        } else {
            result += segment;
        }
    }
    return result;
}

async function translateChineseSegmentExceptQuotation(str: string): Promise<string> {
    const quoteRegex = /(["'])(.*?[^\\])\1/g;
    const quoteMap: string[] = [];
    const marker = "ANeverBeUsedWordOfEnglishAsMarker1QUOTE";

    // 替换所有引号内容为占位符
    const placeholderStr = str.replace(quoteRegex, (match) => {
        const key = `${marker}${quoteMap.length}`;
        quoteMap.push(match);
        return key;
    });

    // 翻译不包含引号内容的部分
    let translated = await translateChineseSegment(placeholderStr);

    // 还原所有占位符
    const restoreRegex = new RegExp(`${marker}(\\d+)`, "g");
    translated = translated.replace(restoreRegex, (_, idx) => quoteMap[parseInt(idx)]);

    return translated;
}



export function isChineseChar(char: string): boolean {
    return /^[\u4e00-\u9fa5]$/.test(char);
}

export function containsEnglish(str: string) {
    const regex = /[a-zA-Z]/; // 匹配任意英文字母
    return regex.test(str);
}

export function containsChinese(str:string) {
    const regex = /[\u4e00-\u9fa5]/; // 匹配中文字符的范围
    return regex.test(str);
}

// 最终外部调用的翻译函数
export async function translate(str: string, from:string="zh", to:string="en"){  
    if(str == null || str.trim() == ""){
        return "";
    }    

    if(from==="zh" && to==="en"){
        let words = translatePresetWords(str);
        return await translateChineseSegmentExceptQuotation(words);    
        // return await translateByBaidu(words, from, to);    
    }else{
        return await translateByBaidu(str, from, to);    
    }
}



