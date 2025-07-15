// 一个形如：“ a student in a [地点:forrest]，where is a hottest [名词：place] to find a way" 的字符串中，所有[]内的冒号分隔的key:value对，放到一个map中。
export function parseParams(str: string): string[][] {
  const result: string[][] = [];

  if(str){
    let start = -1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '[') {
        start = i;
      } else if (str[i] === ']' && start !== -1) {
        const pairStr = str.substring(start + 1, i);
        const pairArr = pairStr.split(':');
        if (pairArr.length === 2) {
          result.push(pairArr);
        }
        start = -1;
      }
    }
  }
  
  return result;
}

// 用TS写一个程序，把一个形如：“ a student in a [地点:forrest]，where is a hottest [名词：place] to find a way" 的字符串中，所有[]内的冒号分隔的key:value对。
// 从字符串中将所有[key:value]，替换成value

export function replaceKeyValues(str: string): string {
  const keyValues = str.split('[').map(substr => {
    const closingBracketIndex = substr.indexOf(']');
    if (closingBracketIndex > -1) {
      const [key, value] = substr.slice(0, closingBracketIndex).split(':');
      return [key, value];
    }
    return null;
  }).filter(pair => pair !== null) as [string, string][];

  let result = str;
  keyValues.forEach(pair => {
    const [key, value] = pair;
    result = result.replace(`[${key}:${value}]`, value);
  });

  return result;
}

// 有一个形如：“ a student in a [地点:forrest]，where is a hottest [名词：place] to find a way" 的字符串中，所有[]内的冒号分隔的key:value对。
// 输入一个参数A，将字符串中将key=A的哪个[]中的内容，连同[]都替换成A

export function replaceParam(str: string, key: string, replaceValue: string): string {
  const pairs = str.match(/\[(.*?)\]/g); // 提取所有的键值对
  if(pairs != null){
   for (let i = 0; i < pairs.length; i++) {
     const pair = pairs[i].replace(/\[|\]/g, ''); // 去掉方括号
     const [k, v] = pair.split(':'); // 分离键值对
     if (k === key) {
       str = str.replace(`[${pair}]`, replaceValue); // 替换对应的键值对
     }
   }
  }
  return str;
}

// 检查语法，可以纠正的错误去纠正，不能纠正的抛出异常
export function checkSyntax(str: string): string{
 
   // 防止用户误输入
   let result = str.replace(new RegExp("：", 'g'), ':');
   result = result.replace(new RegExp("【", 'g'), '[');
   result = result.replace(new RegExp("】", 'g'), ']'); 
  
  return result;

}
