export type themeType =
  "ABSTRACT"
  | "SPEECH"
  | "PAPER"
  | "REWRITE"
  | "ANALOG"  
  | "CHECK_CONTRACT"
  | "EXPERIENCE"
  | "DRAFT_CONTRACT"
  | "DRAFT_PLAINT"
  | "ANALYSIS_CASE"
  
;

export const themes: themeType[] = [
  "ABSTRACT",
  "EXPERIENCE",
  "SPEECH",
  "REWRITE",
  "PAPER",
  "ANALOG",
  "CHECK_CONTRACT",
  "DRAFT_CONTRACT",
  "DRAFT_PLAINT",
  "ANALYSIS_CASE"
];

export const themeNames = new Map();
themeNames.set("ABSTRACT","阅读文件写摘要");
themeNames.set("EXPERIENCE","阅读文件写心得体会");
themeNames.set("SPEECH","根据文件内容写演讲稿");
themeNames.set("REWRITE","将文件内容改写成新文章");
themeNames.set("PAPER","根据文件内容素材写论文");
themeNames.set("ANALOG","模仿原文风格写文章");
themeNames.set("CHECK_CONTRACT","审阅合同");
themeNames.set("DRAFT_CONTRACT", "草拟合同");
themeNames.set("DRAFT_PLAINT", "草拟诉状");
themeNames.set("ANALYSIS_CASE", "案情分析");


export const themeTitleLabels = new Map();
themeTitleLabels.set("ABSTRACT","内容摘要的标题");
themeTitleLabels.set("EXPERIENCE","心得体会的标题");
themeTitleLabels.set("SPEECH","演讲的题目");
themeTitleLabels.set("REWRITE","新文章的标题");
themeTitleLabels.set("PAPER","论文的题目");
themeTitleLabels.set("ANALOG","新文章的标题");
themeTitleLabels.set("CHECK_CONTRACT","合同审阅要点");
themeTitleLabels.set("DRAFT_CONTRACT", "合同关键内容要点");
themeTitleLabels.set("DRAFT_PLAINT", "主要诉讼请求");
themeTitleLabels.set("ANALYSIS_CASE", "案情分析要点");

export const themeFileLabels = new Map();
themeFileLabels.set("ABSTRACT","上传阅读内容");
themeFileLabels.set("EXPERIENCE","上传学习内容");
themeFileLabels.set("SPEECH","上传素材内容");
themeFileLabels.set("REWRITE","上传原文内容");
themeFileLabels.set("PAPER","上传素材内容");
themeFileLabels.set("ANALOG","上传原文内容");
themeFileLabels.set("CHECK_CONTRACT","上传合同");
themeFileLabels.set("DRAFT_CONTRACT", "上传样例合同");
themeFileLabels.set("DRAFT_PLAINT", "上传诉讼相关材料");
themeFileLabels.set("ANALYSIS_CASE", "上传案情材料");


const defaultPrompt = "以${title}为主题，把用户输入的内容进行修改。有以下4点要求：" +
  "1.修改后的字数大约${len}字。2.原文的每一个要点都表达出来。3. 原文举的每一个例子都要体现。4.和原文的段落数量保持一样"; 
const prompts = new Map();
let method = "READ";
prompts.set(method+"-ABSTRACT", {content:defaultPrompt});
prompts.set(method+"-EXPERIENCE", {content:defaultPrompt});
prompts.set(method+"-SPEECH", {content:defaultPrompt});
prompts.set(method+"-REWRITE", {content:defaultPrompt});
prompts.set(method+"-PAPER", {content:defaultPrompt});
prompts.set(method+"-ANALOG", {content:defaultPrompt});
prompts.set(method+"-CHECK_CONTRACT",{model:"AIPUTI v1.02", content:"以${title}为要点，审阅合同：第一、把合同的概要内容总结出来。第二、找到不利于任何一方的问题，并逐一列出来明细。第三、找到不符合法律的问题，并逐一列出来"});
prompts.set(method+"-DRAFT_CONTRACT",{model:"AIPUTI v1.02", content:"以写${title}为目的，总结出内容的相关要点"});
prompts.set(method+"-DRAFT_PLAINT",{model:"AIPUTI v1.02", content:"以写${title}为目的，总结出内容的相关要点"});
prompts.set(method+"-ANALYSIS_CASE",{model:"def_model_", content:"以${title}为案情分析的要点，总结分析案情内容"});

method = "PROCESS";
prompts.set(method+"-ABSTRACT", {content:"以${title}为主题，根据用户给出的内容，写一篇尽可能详细的摘要。有以下3点要求：" + 
          "1.摘要的字数大约${len}字。2.摘要的内容要总结原文的所有要点。3. 摘要要总结出原文的核心观点，并用一、二、三...的格式列出。"});
prompts.set(method+"-EXPERIENCE", {content:"以${title}为主题，根据用户给出的内容，写一篇尽可能详细的学习心得体会。有以下3点要求：" + 
          "1.摘要的字数大约${len}字。2.针对原文的所有要点，写出自己的心得。3. 心得体会要结合当前社会中的实际情况进行举例说明"});
prompts.set(method+"-SPEECH", {content:"以${title}为主题，把用户内容修改成一篇第一人称讲述的稿件。尽可能详细，并有以下4点要求：" + 
               "1.演讲稿长度大约${len}字，全文不少于${segments]个段落。2. 可以引用原文的地方尽量引用原文。" + 
               "3.用户内容的每一个要点都表达出来。4. 用户内容中举的每一个例子都要体现。"});
prompts.set(method+"-REWRITE", {content:"以${title}为主题，把用户内容修改成一篇新文章。尽可能详细，并保留原文核心内容。并有以下4点要求：" + 
               "1.新文章的长度一定要大于${len}字，全文不少于${segments]个段落。2. 可以引用原文的地方尽量引用原文。" + 
               "3.用户内容的每一个要点都表达出来。4. 用户内容中举的每一个例子都要体现。"});
prompts.set(method+"-PAPER",  {content:"以${title}为主题，根据用户输入的内容写一篇尽可能详细的论文。有以下5点要求：" +
               "1.论文的字数大约${len}字。2.论文要围绕主题抓住原文的要掉。3. 论文必须有摘要，关键词，内容，此外如果有引用也列出来。" + 
               "4.论文内容除了列提纲，还要对提纲的每一项都展开详细写。5.论文的每一个论点都要举一个生动的案例来辅助说明。例子尽量从用户输入的内容中找。"});
prompts.set(method+"-ANALOG", {content:"以${title}为主题，模仿用户给出的内容写一篇尽可能详细的新文章。有以下3点要求：" + 
              "1.文章的字数大约${len}字。2.文章的写作风格必须和用户给出的内容一致。3. 文章的说话语气必须和用户给出的内容一致。"});
prompts.set(method+"-CHECK_CONTRACT",{model:"AIPUTI v1.02", content:"审阅合同：第一、把合同的概要内容总结出来。第二、找到不利于任何一方的问题，并逐一列出来明细。第三、找到不符合法律的问题，并逐一列出来"});
prompts.set(method+"-DRAFT_CONTRACT",{model:"AIPUTI v1.02", content:"写一份尽可能详细的合同，以${title}为内容要点。建议至少有以下章节：各方详细信息；关键名词解释；合同标的；合同条款；价款或报酬；履约期限、地点、方式；违约责任；争议解决方法；解除合同的情形；双方签字盖章处。"});
prompts.set(method+"-DRAFT_PLAINT",{model:"AIPUTI v1.02", content:"写一份尽可能详细的诉讼状，以${title}为主要诉讼请求。"});
prompts.set(method+"-ANALYSIS_CASE",{model:"AIPUTI v1.02", content:"写一份尽可能详细的案情材料分析，以${title}为分析要点。"});

export function getPrompt(theme:string, method:string, params:any){
    let prompt = prompts.get(method + "-" + theme);

    if(prompt){
        return {model:prompt.model, content:replaceParams(prompt.content, params)};
    }else{
        return prompt;
    }
}

function replaceParams(text:string, params:any){
    let result = text;
    
    for (const key in params) {
        if (params.hasOwnProperty(key)) {
          const value = params[key];
          if(value){
            result = result.replace('${' + key + '}', value);
          }
      }
    }    

    return result;
}
