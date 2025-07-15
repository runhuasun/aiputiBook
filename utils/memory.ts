import {embeddingAndSaveTexts, embeddingSearch} from "./embedding";

// 记住一组句子
export async function remember(words:string[], modelId:string, userId:string, scope:string="PRIVATE"){
    const fileUrl = "./memory/" + modelId + "&&&" + (scope=="PRIVATE" ? userId : scope) + ".mem";
    const dtTexts = [];
    for(const word of words){
        dtTexts.push({
            content: word
        });
    }
    return await embeddingAndSaveTexts(dtTexts, fileUrl, modelId, undefined, userId, scope);
}

// 根据提供的线索，回忆起来resultSize条内容
export async function recall(hint:string, modelId:string, userId:string, resultSize:number=2, resultMax:number=2000, scope:string="PRIVATE"){
    const fileUrl = "./memory/" + modelId + "&&&" + (scope=="PRIVATE" ? userId : scope) + ".mem";

    const maxDistance = process.env.EMB_MEMORY_DISTANCE ? parseFloat(process.env.EMB_MEMORY_DISTANCE) : 0.4;
    
    return await embeddingSearch(hint, fileUrl, modelId, userId, resultSize, resultMax, maxDistance, scope);
}
