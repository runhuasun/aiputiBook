
export function containsReadableCharacters(text:string) {
    // 此正则表达式试图匹配汉字，基本的拉丁字母（包括英文字符）以及扩展的拉丁字母（覆盖了大部分西欧语言字符，如重音符、变音符等）
    // \u4e00-\u9fff 匹配汉字
    // a-zA-Z 匹配基本英文字符
    // \u00C0-\u00FF 匹配大部分西欧语言的特殊字符
    // 可以按需扩展来覆盖更多的字符区间
    const regex = /[\u4e00-\u9fff\u00C0-\u00FF\w]/;

    return regex.test(text);
}


// 删除表情符号
export function removeEmojis(text: string): string {
    // 定义一个正则表达式，用来匹配表情符号
    const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u2B55\u23cf\u23e9\u231a\u3030\u200d\u2700-\u27bf]+/g;

    // 使用replace()函数将匹配的表情符号替换为空字符串
    return text.replace(emojiPattern, '');
}

// 删除特殊符号
export function removeSpecials(text: string): string {
    // 定义一个正则表达式，用来匹配星号(*)
    const asteriskPattern = /\*/g;
  
    // 使用replace()函数将匹配的星号替换为空字符串
    return text.replace(asteriskPattern, '');
}

// 把一个字符串分割成每一个最多maxLen的字符串数组。要求同一个段落如果长度不大于maxLen不能被分到两个子串。如果连续的N个段落加起来长度小于100，那么就把N个段落拼在一起成为一个字串。
// 如果单一段落大于100，那么要保证一句完整的话不要被分割到两个不同字串。
// 输入一个字符串。首先把字符串分段放到一个数组s。如果数组s中某一段的长度大于100，
// 就用。！；.!分句子放到数组s。如果s中某个句子长度大于100，就用，、,分句子放到数组s。
// 如果数组s中仍然存在长度大于100的句子，就按照每100个字符分成一句，放到数组s中
export function splitToSentences(text: string, maxLen: number = 100): string[] {
    // 1. 按段落分割文本，保留 \n 并添加到前一个段落
    const paragraphs = text.split(/\n+/).map(paragraph => paragraph.trim());

    // 用于存储最终的段落
    let result: string[] = [];

    // 2. 轮询每个段落，处理长段落，按标点符号分割
    paragraphs.forEach(paragraph => {
        // 如果段落长度大于 maxLen，按标点符号继续分割
        if (paragraph.length > maxLen) {
            // 使用正则表达式将段落按标点符号分割，并保留标点符号
            const sentences = paragraph.split(/([。！？；;，,\.!?\n])/).reduce<string[]>((acc, part, index, array) => {
                // 如果是句子部分（偶数索引），拼接标点符号
                if (index % 2 === 0) {
                    const sentence = part + (array[index + 1] || "");
                    acc.push(sentence);
                }
                return acc;
            }, []);

            // 将分割后的句子添加到结果数组中
            sentences.forEach(sentence => {
                result.push(sentence);
            });
        } else {
            // 否则直接将段落加入结果
            result.push(paragraph);
        }
    });

    // 3. 合并段落，确保长度不超过 maxLen，计算 \n 和标点符号
    const optimizedResult: string[] = [];
    let currentParagraph = "";

    result.forEach(paragraph => {
        // 如果当前段落和下一段合并后长度小于 maxLen，进行合并
        if ((currentParagraph + (currentParagraph ? '\n' : '') + paragraph).length <= maxLen) {
            currentParagraph += (currentParagraph ? '\n' : '') + paragraph;
        } else {
            // 否则保存当前段落，开始新的段落
            if (currentParagraph) {
                optimizedResult.push(currentParagraph.trim());
            }
            currentParagraph = paragraph;
        }
    });

    // 添加最后一个段落
    if (currentParagraph) {
        optimizedResult.push(currentParagraph.trim());
    }

    return optimizedResult;
}

/*
export function splitToSegments(content:string, maxLen:number=100){
    let result:string[] = [];
    let curSeg:string = "";

    if(content.length < maxLen){
        result = [content];
    }else{
        let segs:string[] = segments(content);
        for(const i=0; i<segs.length; i++){
            if(!curSeg){
                curSeg += segs[i];
                if(curSeg>maxLen){
                    const sens = sentences(text);
                    
            }
            
        }
    }
    return result;
}

function segments(text:string){
    return text.split(/\n+/);
}

function sentences(text:string){
    const punctuationRegex = /([。！？.!?])/g; // 捕获句号、问号、感叹号
    return sentence.split(punctuationRegex);
}
/*
    let segs:string[] = [];
 
    if(!content){
      return [];
    }
      
    if(content.length>maxLen){
        segs = content.split("\n");
    }else{
        segs = [content]; 
        return segs;
    }

    let findLong = false;
    let sens1:string[] = [];
    for(let s of segs){
        s = s.trim();
        if(s.length > maxLen){
            findLong = true;
            sens1 = sens1.concat(s.split(/[。！；.!]/));
        }else if(s.length > 0){
            sens1.push(s);
        }
    }

    let sens2:string[] = [];
    if(findLong){
        findLong = false;
        for(let s of sens1){
            s = s.trim();
            if(s.length > maxLen){
                findLong = true;
                sens2 = sens2.concat(s.split(/[，、,]/));
            }else if(s.length > 0){
                sens2.push(s);
            }
        }
    }else{
        return sens1;
    }

    let sens3:string[] = [];
    if(findLong){
        findLong = false;
        for(let s of sens2){
            s = s.trim();
            if(s.length > maxLen){
                sens3 = sens3.concat(s.match(new RegExp(`.{1,${maxLen}}`, 'g')) || []);
            }else if(s.length > 0){
                sens3.push(s);
            }
        }
    }else{
        return sens2;
    }

    return sens3;
}
*/
