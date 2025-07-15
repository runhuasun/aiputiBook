//import fs from 'fs';
// import path from 'path';
/*
interface Config {
  sensitiveWords: string[]
}

//const configPath = path.resolve(process.cwd(), 'sensitive.json');
//const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
//const sensitiveWords = config.sensitiveWords;
*/

const sensitiveWords: string[] = [
  "共产党",
  "习近平",
  "毛泽东",
  "周恩来",
  "邓小平",
  "温家宝",
  "胡锦涛",
  "江泽民",
  "李克强",
  "李强",  
  "八路",
  "志愿军",
  "新四军",
  "解放军",
  "自杀",
  "裸体",
  "nude",
  "做爱",
  "交配",
  "操逼",
  "性交",
  "肛交",
  "裸体",
  "赤裸",
  "阴毛",
  "阴道",
  "阴蒂",
  "阴唇",
  "全裸",
  "阴茎",
  "鸡巴",
  "鸡鸡",
  "龟头",
  "白虎",
  "阴户",
  "乳房",
  "乳头",
  "乳尖",
  "乳晕",
  "口交",
];


export function hasSensitiveWord(text: string) {
    for (let i = 0; i < sensitiveWords.length; i++) {
        if (text.includes(sensitiveWords[i])) {
            return sensitiveWords[i];
        }
    }
}

export function maskSensitiveWord(text:string) {
    sensitiveWords.forEach(phrase => {
        // 构建正则表达式，\s* 表示匹配任意数量的空格
        const regex = new RegExp(phrase.split('').join('\\s*'), 'gi');
        text = text.replace(regex, (match) => 'X'.repeat(match.length));
    });
    return text;
}

export function filterWords(msg:string){
    for(let i=0; i<replacement.length; i++){
        const w = replacement[i];
        const pattern = new RegExp(w[0], "g");
        msg = msg.replace(pattern, w[1]);
    }
    return msg;
}  

const replacement = [
    ["习近平总书记", "总书记"],
    ["习总书记","总书记"],  
    ["习近平","总书记"],
    ["文心一言","AI菩提"],
    ["马蜂窝","海玩"],
    ["马峰窝","海玩"],    
    ["蚂蜂窝","海玩"],  
    ["穷游","海玩"],  
    ["ERNIE Bot","AIPUTI"],
    ["科大讯飞研发的认知智能大模型，我的名字叫讯飞星火认知大模型","AI菩提"],
    ["达摩院","AI菩提"],
    ["通义千问","AI菩提"],
    ["GPT是“Generative Pre-trained Transformer”的缩写", "AI是“Artificial Intelligence”的缩写"],
    ["ChatGPT","AI菩提"],
    ["GPT-4","AI小模型2.0"],
    ["GPT-3","AI小模型1.0"],
    ["GPT","AI小模型"],
    ["OPENAI","AI菩提"],
    ["OpenAI","AI菩提"],
    ["AliYun", "AI服务器"],
    ["阿里云", "AI服务器"],
    ["ALIYUN", "AI服务器"],
    ["百度", "AIPUTI"],
    ["百度公司", "AIPUTI"],  
    ];
