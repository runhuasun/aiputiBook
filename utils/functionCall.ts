import {log,warn,error} from "./debug";
/*
如果用户说出某部法某一条，希望查询该条款的内容，请按照以下格式输出内容：
$$$FunctionCall$$${
"functionName": "queryLawItem",
"functionParams": { 
"lawName": "法典的名称",
"lawItem": "哪一条"}
}
其中"法典的名称"替换成你识别出来用户想查询的法典。
"哪一条"替换成你识别出来用户想查询的具体条款并转换成阿拉伯数字。
*/
export const functionCallPrefix = "FunctionCall";
const functionMap: { [key: string]: (params: any) => any } = {
    queryLawItem
}

export function queryLawItem(params:any){
    log("enter queryLawItem");
    log("params:" + JSON.stringify(params));
    return("查询" + params.lawName + "第" + params.lawItem + "条的详细内容...");
}

export async function runFunctionCall(callStr:string){
    log("star to run function:\n" + callStr);
    try{
        const func = JSON.parse(callStr.substring(functionCallPrefix.length));
        log("func.name:" + func.functionName);
        log("func.params:" + JSON.stringify(func.functionParams));
        
        try{
            const result = functionMap[func.functionName].apply(null, [func.functionParams]);
            log(result.toString());
            return result;
        }catch(e){
            error("run Function Call exception:" + e);
            throw new Error("动态执行函数失败");
        }
    }catch(e){
        error("parse Function Call String exception:" + e);
        throw new Error("不是一个合法的函数调用字符串");
    }
}


