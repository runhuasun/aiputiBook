import {log, warn, error} from "./debug";

export const hotSigns:string[] = [
    "部分",
    "篇",
    "编",
    "分编",
    "章",
    "节",
    "条",
    "回",
    "天",
    "讲",
    "册",
    "卷",
    "课",
    "小课",
    "单元",
    "CHAPTER 1",
    "一、",
    "1.",    
    "1.1.",
    "1.1.1.",
    "1",     
    "1.1",     
    "1.1.1",    
    "A.",
    "a.",
    "(1)",
    "(一)",
    "(A)",
   ];

export function getRegexOfSign(sign:string){
    const regType1 =  /^(部分|篇|编|分编|章|节|条|回|天|讲|册|卷|课|小课)$/;
    const regType2 = /^(一|二|三|四|五|六|七|八|九|十|百|千|万|零)+([、.．]|\s).*$/;
    const regType3 = /^\d+(?:\.\d+)*[、.．]?.*$/;

    const regType4 = /^[A-Za-z]+[.、．].*$/;
    const regType5 = /^[\(\（][A-Za-z0-9一二三四五六七八九十]+[\)\）].*$/;
    const regType6 = /^(CHAPTER|Chapter)\s\d+.*$/;
    
    if(regType1.test(sign)){ 

        log("type1:" + sign);
        return new RegExp(`第([\\u4e00-\\u9fa5零〇一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾0-9]+)${sign}`);
        
    }else if(regType2.test(sign)){

        log("type2:" + sign);     
        const reg = new RegExp(regType2);
        return reg;
        
    }else if(regType3.test(sign)){
        // 匹配 1.|1.1.|1.1.1...最后一个.也可以换成、
        const regexG = /\d+[\.、．]/g;
        const matches = sign.match(regexG);
        const count = matches ? matches.length : 0;

        log("count:" + count);
        let regexString = "^";
        for (let i = 1; i <= count; i++) {
          regexString += "\\d+[.、．]";
        }
        regexString += ".*$";
        const regex = new RegExp(regexString);
        log("type3:" + regex);     
        return regex;

    }else if(regType4.test(sign)){

        log("type4:" + sign);     
        return new RegExp(regType4);

    }else if(regType5.test(sign)){

        log("type5:" + sign);     
        return new RegExp(regType5);
        
    }else if(regType6.test(sign)){

        log("type6:" + sign);     
        return new RegExp(regType6);
        
    }else{

        log("unknow type:" + sign);     
        return new RegExp(sign);

    }

}



export function parseStructure(text:string, levelSigns:string): string[][]{

    log("-------------开始解析以下文章的全文结构--------------");
    log(text.substring(0, 20) + "......");
    log("文章共" + text.length + "字");
    log(text.substring(text.length-20, 20));
    log("-------------全文结束---------------");
    
    
    // @前言@摘要@章|回|节$结论$参考文献
    let signs = levelSigns.split("@"); // @来定义头部字节标识
    // log(signs.length);
    let treeSigns = signs.pop(); // 弹出最后一条记录是树状结构
    // log(treeSigns);

    if(signs.length > 1){ signs.shift() }; // 第一个串是空串
    const headSigns:string[] = signs; // 剩余是一个头部标识数组
    log("头部标识是：" + headSigns);
    signs = treeSigns ? treeSigns.split("$") : []; // $来定义尾部标识
    // log(signs.length);
    treeSigns = signs.shift(); // 弹出头部一条记录是树状结构
    log("树状结构标识是：" + treeSigns);
    let tailSigns = signs; // 剩余的是尾部结构标识数组
    log("尾部标识是：" + tailSigns);
    
    const tree = treeSigns ? getTreeFromText(text, treeSigns) : {"title":text, children:[]};

    let arr: string[][] = [];
    if(tree){
        if(headSigns && headSigns.length>0){
            const heads = parseHeadTail(tree.title, headSigns);
            arr = arr.concat(heads);
        }else{
            arr = arr.concat([[tree.title]]);
        }
        
        for(const sub of tree.children){
            const t = treeToArray(sub);
            arr = arr.concat(t);
        }
        
        const lastRow = arr.length-1;
        if(lastRow >= 0){
            const lastCol = arr[lastRow].length-1;
            if(lastCol >= 0){
                const lastCell = arr[lastRow][lastCol];
                const tails = parseHeadTail(lastCell, tailSigns);
                if(tails && tails.length>0){
                    arr[lastRow][lastCol] = tails[0][0];
                    tails.shift();
                    arr = arr.concat(tails);
                }
            }
        }
    }

    return arr;
 }

function parseHeadTail(text:string, signs:string[]):string[][]{
   // 如果有前文和结尾标识符，就单独作为一行
    // $表示结尾，@表示开头
    let hts:string[][] = [];
    
    if(text && text.length>0 && signs && signs.length>0){
        const lines = text.split("\n");
        let sign = signs.shift();
        log("parseHeadTail find sign:" + sign);
        let currentSeg = 0;
        hts.push([""]);
        for(let line of lines){
            line = line.trimStart() + "\n";
            if(sign && line.startsWith(sign)){
                log("found sign" + sign + "at " + line);
                // 新起一段
                hts.push([line]);
                currentSeg++;                 

                // 接下来就去寻找下一个符号
                sign = signs.shift();                
            }else{
                hts[currentSeg][0] += line;
            }
        }
    }

    return hts;
    
}


function treeToArray(root: TreeNode): string[][] {
  const result: string[][] = [];
  const stack: { node: TreeNode; titles: string[] }[] = [{ node: root, titles: [] }];

  while (stack.length > 0) {
    const { node, titles } = stack.pop()!;
    titles.push(node.title);

    if (node.children.length === 0) {
      result.push(titles.slice());
    } else {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], titles: titles.slice() });
      }
    }
  }

  return result;
}

/*
function treeToArray(node: TreeNode): any[][] {
  const arr: any[][] = [[node.title]];

  function traverse(node: TreeNode, path: any[] = []) {
    const currentPath = [...path, node.title];

    if (node.children && node.children.length === 0) {
      arr.push(currentPath);
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((child: TreeNode) => {
        traverse(child, currentPath);
      });
    }
  }

  traverse(node);
  return arr;
}
*/

export interface TreeNode {
  title: string;
  children: TreeNode[];
}
 
 export function getTreeFromText(text: string, structure:string): TreeNode{

    // root是第0级，后面是1、2、3....级
    const root: TreeNode = { title: '', children: [] }; // 根节点
    const rootReg = /./s;
     
    const levelNames: string[] = structure.split("|");
    const level: number = levelNames.length;
  
    let currentLevelNodes: (TreeNode | null)[] = [root]; 
    let levelRegexes = [rootReg];
     
    for(let i=1; i<=level; i++){
        currentLevelNodes.push(null);
        levelRegexes.push( getRegexOfSign(levelNames[i-1]) );
    }  
     const lines = text.trim().split('\n');
     // log("getTreeFromText lines count:" + lines);
  
     lines.forEach(line => {
        // log("getTreeFromText line content:" + line);
         let currentLevel = level;
         let foundMatch = false;
      
         for(currentLevel; currentLevel>=1; currentLevel--){
             // log("getTreeFromText regex:" + levelRegexes[currentLevel]);             
             if(line.trim().match(levelRegexes[currentLevel])){
                 // log("getTreeFromText BINGGO MATCH:" + line);              
                 foundMatch = true;
                 const title = line;
                 const newNode: TreeNode = {title: title, children:[]};
                 let parentNode = currentLevelNodes[currentLevel-1]

                 // 如果父节点不存在就逐级找到最后一个父节点
                 let pLevel = currentLevel -1;
                 while(!parentNode){            
                     pLevel -= 1;
                     parentNode = currentLevelNodes[pLevel];
                     if(parentNode){
                         while(pLevel++<(currentLevel-1)){
                             const newMidNode: TreeNode = { title: "", children: [] };
                             parentNode.children.push(newMidNode);
                             parentNode = newMidNode;
                         }
                     }
                 }
                 parentNode.children.push(newNode);
                 currentLevelNodes[currentLevel] = newNode;
                 
                 for(let i=currentLevel+1; i<=level; i++){
                     currentLevelNodes[i] = null;
                 }

                 break;
             }
         }
         
         // 说明这一行不是某个章节
         if(!foundMatch){
             currentLevel = level;
             while(currentLevel >= 0){
                const node = currentLevelNodes[currentLevel];
                 if(node){
                     node.title = node.title + "\n" + line;  
                     break;
                 }
                 currentLevel--;
             }
         }
     });   
   
     log(JSON.stringify(root, null, 2)); // 输出树状结构
     return root;
} 
    



/////////////////////////////////////////////////////////
// 用字符来标识分段，并还原这个字符
//
export function splitBySigns(text:string, signs:string[]):string[]{
    let result:string[] = [text];
    for(const sign of signs){
        let children:string[] = [];
        while(result.length > 0){
            const parent = result.pop();
            if(parent){
                children = children.concat(splitBySign(parent, sign));
            }
        }
        result = children;
    }
    return result;
}

// abc.def => 'abc', 'def'
// abc.    => 'abc', ''
// abc    => 'abc'
// .abc    => '', 'abc'
export function splitBySign(text:string, sign:string):string[]{
    let segs = text.split(sign);
    let result = [];
    let len = segs.length;

    if(len == 1){
        result = [text];
    }else{
        for(let i=0; i<len; i++){
            if(i == len-1){
                // 最后一个字符串如果不是空就压入，如果空就忽略
                if(segs[i] != ""){
                    result.push(segs[i]);
                }
            }else{
                result.push(segs[i] + sign);
            }
        }
    }
    return result;
}

/////////////////////////////////////////////////////////    
// 对数据进行分成用于向量化的句子
// 这里用了最简单的算法，实际应该更复杂，包括段落、标题等的处理
export function parseToSentences(dtText:string, title?:string, len?:number):string[]{
    let sentences:string[] = [];
    log("------------------开始进行分句---------------------");
    
    // 先按段落分开
    let segs = splitBySign(dtText, "\n");
   
    let sentence = "";
    const maxLen = len ? len : 1000; // 每一段最大长度

    /*
    let fakeTitle = false;
    if(!title || title.length==0){
        fakeTitle = true;
        title = (segs.length>1 && segs[0].length<50) ? segs[0] : undefined; // 假设一般文章第一段都是标题。如果不是，那么大部分文章也是总分总结构。
    }
    */
    
    log("文章的title是：" + title);        

    for(let seg of segs){
        // log("sentecne:" + sentence.length);
        // log("seg:" + seg.length);
     
        if( (seg.length + sentence.length)< maxLen ){
            // 短句子尽量合并
            sentence += seg;
        }else{
            // 此时目前拼成的sentence加上当前段落已经大于最大限制长度

            if(sentence.length > 0 && sentence.length < 100 ){
                // 如果目前拼成的sentence是个短句，就拼到下面段落里，即使超一点也无所谓                
                seg = sentence + seg;
            }else if(sentence.length >= 100){
                // 如果此前是个长句子，那么就单独成一段，不和下面拼在一起
                sentences.push(sentence);
                log("A:" + sentence.length);
            }

            // 把当前句子置为空。按照之前逻辑此时也应该位空
            sentence = "";        
            
            // 现在开始处理段落的内容
            // 首先把句子按结尾符号分开
            const temps = splitBySigns(seg, ["。", "！", "：", "？", ".", "!", "?", ":"]);
            for(const t of temps){
                 if((sentence.length + t.length)<maxLen){
                   // 整个段落小于maxLen字就拼在一起                     
                   sentence += "\n" + t;
                 }else{
                   // 如果sentecen+t大于最大长度了，就把当前句子压入队列
                   sentences.push(sentence);
                   log("B:" + sentence.length);                     
                   // 让t成为当前段子                
                   sentence = t;
                 }
            }

        }
    }
    
    if(sentence.length > 0){
        sentences.push(sentence);
        log("C:" + sentence.length);                        
    }

    // 打印分段结果
    // log("------------------开始打印分句结果---------------------");
    log("分句结果：一共有" + dtText.length + "个字，被分成了" + sentences.length + "条记录：");
    let no = 1;
    let result:string[] = [];
    
    for(const s of sentences) {
        // 如果是取第一行做假的title，那么不在第一段加title
//        if(title && (!fakeTitle || (fakeTitle && no++>1))){
        if(title){
            result.push(title + "\n" + s);
        }else{
            result.push(s);
        }
       // console.error("【第" + no++ + "条记录】：" + s.length)
    };
    //log("------------------结束打印分句结果---------------------");

    return result;
}
