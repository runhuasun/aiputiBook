import {log, warn, error} from "./debug";

//import * as tf from '@tensorflow/tfjs';
//import * as tfh from '@tensorflow/tfjs-node';
//import * as tfn from '@tensorflow/tfjs-node-gpu';
//import * as use from '@tensorflow-models/universal-sentence-encoder';

import * as Fetcher from "node-fetch";
import {parseToSentences} from "./parser";
import * as faiss from "faiss-node";
import prisma from "../lib/prismadb";
import * as AIS from "../ai/AIService";
import {BaseAIService} from "../ai/llm/BaseAIService";
import { EventEmitter } from 'events';


const embFileCache = new Map();

//////////////////////////////////////////////////////////////////////////
// 把一个字符串向量化
//////////////////////////////////////////////////////////////////////////
export async function embeddingText(sentence:string, rawdataId?:string): Promise< {usedTokens:number, vector:number[], rawdataId:string|undefined} > {
    const ais = AIS.createLLMInstance("OPENAI", "text-embedding-ada-002");  // 第二个参数暂时没用，代理里面需要修改才可以
    let retry = 0; // 每次调用如果失败就重试最多5次
    let result = null;

    do{
        try{
            result = await ais!.embedding(sentence);
        }catch(e){
            error("ais!.embedding(" + sentence + ") error");
            error(e);

            // 每次失败等待3秒再重新尝试
            await new Promise((resolve) => setTimeout(resolve, 3000));    
            error("重试次数：" + retry++);
        }

    }while(!result && retry < 20);

    if(result){
        return {
            usedTokens: result.usedTokens,
            vector: result.vector,
            rawdataId,
            };
    }
    return {
        usedTokens: 0,
        vector: [],
        rawdataId
    };
}


//////////////////////////////////////////////////////////////////////////
// 计算两个向量的相似度距离
//////////////////////////////////////////////////////////////////////////
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  // 首先计算向量的点积
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }

  // 计算向量的模长
  const normA = Math.sqrt(vectorA.reduce((sum, val) => sum + val**2, 0));
  const normB = Math.sqrt(vectorB.reduce((sum, val) => sum + val**2, 0));

  // 计算余弦相似度
  const similarity = dotProduct / (normA * normB);
  return similarity;
}


//////////////////////////////////////////////////////////////////////////
// 向量化搜索
//////////////////////////////////////////////////////////////////////////
export async function embeddingSearch(word:string, url:string, modelId:string, userId?:string, resultSize:number=5, 
                                      resultMax:number=2000, maxDistance?:number, scope:string="MODEL", contentType:string="TEXT"){
    
    log("-------------embeddingSearch----------------");
    log("索引文件：" + url);
    
    let vvResult:{
        id:string, // 向量ID
        key:string, // 向量库的索引编号
        value:string,  // 被向量化的字符值
        distance:number, // COS夹角距离
        content:string,  // 向量对应的真实数据内容
        type:string, // 数据内容的类型，TEXT,IMAGE,VIDEO...
        rawdata?:any // 原始训练文件的数据库对象
    }[] = [];
    
    let index = null;
    try{
        const cache = embFileCache.get(url);
        if(cache){
            index = cache;
        }else{
            index = faiss.IndexFlatL2.read(url);
            embFileCache.set(url, index);
        }
    }catch(e){
        log("索引文件不存在：" + url);
    }
      
    if(index){
        const emb = await embeddingText(word);
        const indexTotal = index.ntotal();
        
        log("索引文件中共有" + indexTotal + "条记录");

        resultSize = indexTotal < resultSize? index.ntotal() : resultSize; // 最大找到的结果集
        const result = indexTotal > 0 ? index.search(emb.vector, resultSize) : undefined;
        
        log("search result:" + JSON.stringify({result}));
        
        if(result){
            // 拼接select中OR语句的串
            const keys:{key:string}[] = [];
            result.labels.forEach((id:number) => (
                keys.push({key:id.toString()})
            ));
            
            const where = (scope == "PRIVATE") ? 
                {
                    modelId: modelId,
                    scope: scope,
                    type: contentType,
                    status: 'CREATE',
                    userId: userId ? userId : null,
                    OR:keys, 
                }              
                :
                {
                    modelId: modelId,
                    type: contentType,
                    scope: scope,
                    status: 'CREATE',                  
                    OR:keys, 
                };
            
            // 从数据库查询到对应的文本
            const vectors = await prisma.vector.findMany({
                where,
                include: {
                    rawdata: true,
                }
            });   
            
            if(vectors && vectors.length>0){
                // 对查询到的文本按照distance进行排序
                // 根据distance对label对应的结果进行排序
                let vvTemp:any[] = [];
                
                vectors.forEach((v) => {
                    const index = result.labels.indexOf(parseInt(v.key));
                    const distance = result.distances[index];  
                    
                    // 距离大于EMB_SEARCH_DISTANCE的内容相关度已经很低了，抛弃掉
                    if(!maxDistance){
                        maxDistance = process.env.EMB_SEARCH_DISTANCE ? parseFloat(process.env.EMB_SEARCH_DISTANCE) : 0.5;
                    }
                    
                    if(distance <= maxDistance){
                        const temp = {
                            id:v.id,
                            key:v.key, 
                            value:v.value,
                            content:v.type=="TEXT" ? v.value : v.content, 
                            type:v.type,
                            distance:distance,
                            rawdata:v.rawdata
                        };
                        vvTemp.push(temp);
                        //log("-----------------temp.content------------");
                        //log(temp.content);
                    }
                });
                
                vvTemp.sort((a,b) => a.distance - b.distance);
                // 删除掉超过最大长度的部分
                let str = "";
                
                for(const r of vvTemp){
                    str += r.content;     
                    if(str.length > resultMax){
                        break;
                    }else{
                        vvResult.push(r);
                    }
                }
            }
        }
    }

    return vvResult;
}


//////////////////////////////////////////////////////////////////////////
// 把一组字符串向量化并且保存在数据库和向量索引中
//////////////////////////////////////////////////////////////////////////
export async function embeddingAndSaveTexts(dtTexts:any[], url:string|null, modelId:string, title?:string, userId?:string, scope:string="MODEL", dimension:number=1536){
    /////////////////////////////////////////////////////////
    // 对每个词计算向量值
    let usedTokens = 0;
    let totalLength = 0;
    let totalLines = dtTexts ? dtTexts.length : 0;
    
    url = (url && url.trim().length > 0) ?  url : ("./chatmodels/" + new Date().toISOString() + ".index");
    
    try{
        let index:any = null;

        try{
            index = faiss.IndexFlatL2.read(url);
        }catch(e){
            error("索引文件不存在:" + url);
        }
        if(!index){
            index = new faiss.IndexFlatL2(dimension);
        }
        let nCurrentText = 0;
        log("------------开始向模型中添加数据-----------------");
        log(url);
        log("模型库中已经存在：" + index.ntotal() + "条数据！");
        let threads = 0;
        const eventEmitter = new EventEmitter();

        for(const dtText of dtTexts){
            
            // 对数据进行分词
            // 这里用了最简单的算法，实际应该更复杂，包括段落、标题等的处理
            let sentences:string[] = parseToSentences(dtText.content!, dtText.fileTitle);
            const num = sentences.length;
            totalLines += (num-1); // 如果被分成多句，会增加总句子数量
            totalLength += dtText.content.length;
            
            let i = 0
            let id = index.ntotal();
        
            // 循环计算向量并存入数据库。
            while(i < num ){
                const sentence = sentences[i];

                const vecExist = await prisma.vector.findMany({
                    where: {
                        modelId: modelId,
                        key: (id + i).toString(),
                        userId: userId ? userId : null,                        
                        scope: scope,
                        rawdataId: dtText.rawdataId!,                        
                        status: "CREATE"
                    }
                });

                let ret = null;
                
                if(vecExist && vecExist.length == 1){
                    
                    const vecVal = vecExist[0].vecVal;

                    // 结果加入向量索引库                  
                    index.add(vecVal);
                    log("向量在数据库中存在，正在把向量存入向量索引的第" + (id+i) + "条记录");                  
                    i++;                     
                    
                    log("小模型中插入记录的进度：" + (((nCurrentText++) / totalLines) * 100).toFixed(2) + "%");                    
                }else{

                    const startTime = new Date().getTime(); // 计算时间的时间戳

                    log("正在运行的线程数:" + threads);
                    while(threads > 100){
                        // 并发线程大于100就等待
                        await new Promise((resolve) => setTimeout(resolve, 100));                      
                    }
                    
                    ++threads;    
                    embeddingText(sentence, dtText.rawdataId).then( async (ret) => {
                        try{
                            const endTime = new Date().getTime();
                            log("本次向量计算共耗时 " + (endTime - startTime) + "毫秒");                    
                            
                            if(ret){
                                // 这里索引文件和内容数据库存在两阶段的事务一致性问题
                                // 我们先插入数据库，如果插入数据库失败，那么一定不会记录索引文件
                                // 如果插入数据库成功，插入索引文件失败，那么将来可以依据数据库记录重建索引文件
                                
                                // 获得向量值
                                const xb = ret.vector;
                                
                                // 结果加入向量索引库                  
                                index.add(xb);                                                            
                                const idx = index.ntotal()-1;
                                
                                // 索引记录存入数据库
                                await prisma.vector.create({
                                    data: {
                                        modelId: modelId,
                                        key: (idx).toString(),    
                                        value: sentence,
                                        userId: userId ? userId : null,
                                        scope:scope,
                                        vecVal:xb,
                                        rawdataId: ret.rawdataId,
                                        content: dtText.fileType=="TEXT" ? undefined : dtText.fileUrl,
                                        type: dtText.fileType,
                                    },
                                });    
                                
                                // log("正在讲向量存入向量库的第" + (id+i) + "条记录");                  
                                usedTokens += ret.usedTokens;
                            }
                        }catch(e){
                            error("执行向量插入时，发生严重错误，请检查程序");
                            error(e);
                        }finally{
                            log("eventEmitter.emit");
                            --threads;                            
                            log("小模型中插入记录的进度：" + (((nCurrentText++)  / totalLines) * 100).toFixed(2) + "%");                                            
                            eventEmitter.emit('threadFinished');          
                        }
                    });
                    
                    // 即使调用成功也每次等100ms再继续，防止服务器TPM过快
                    await new Promise((resolve) => setTimeout(resolve, 1));                      
                    i++;                     
                }
            }

        }


        // await new Promise((resolve) => setTimeout(resolve, 1000));                      

        if(threads > 0){
            log("#######################################################################");
            log("#######################################################################");
            log("#######################################################################");
            log("#######################################################################");
            log("#######################################################################");
            // 等待传递完所有数据
            await new Promise<void>(resolve => {
                eventEmitter.on('threadFinished', () => {
                    if(threads == 0){
                        log("-----------------所有线程都已经结束-----------------------");
                        resolve();                    
                    }else{
                        log('剩余线程数：' + threads);
                    }
                });
            });          
        }else{
            log("........................................................................");
            log("........................................................................");
            log("........................................................................");
            log("........................................................................");
            log("........................................................................");
        }
        
        // 把索引存储到服务器
        log(" 准备向模型中写入数据.......");
        log("向量库中将新增：" + totalLines + "条数据！");        
        await index.write(url); // 存储索引
        embFileCache.delete(url); // 清除全局缓存
        log("------------模型中添加数据完毕-----------------");
        log("向量库中现在有：" + index.ntotal() + "条数据！");
        
    }catch(e){
        error("向量化并保存数据时发生错误：" + e);
    }

    return {url, usedTokens, totalLength, totalLines};
}


//////////////////////////////////////////////////////////////////////////
// 向量删除记录
//////////////////////////////////////////////////////////////////////////
export async function embeddingRemove(modelId:string, keys:number[], url:string, scope:string="MODEL", userId?:string, removeDBData:boolean=true){
    
    log("从索引文件：" + url + "中删除记录");
    try{
        let index = null;
        try{
            index = faiss.IndexFlatL2.read(url);
        }catch(e){
            error("索引文件不存在:" + url);
        }
        if(!index){
            return -1;
        }

        log("索引文件中原来有的记录条数：" + index.ntotal());
        
        // 从index文件中删除
        const nRemoved = index.removeIds( keys );
        
        if(nRemoved == keys.length){
            log("成功从索引文件中删除" + nRemoved + "条记录");
            log("索引文件中还有记录条数：" + index.ntotal());
            // 删除Vector中的数据
            if(removeDBData){
                for(const key of keys){
                    const whereTerm = (scope == "MODEL") ?
                    {
                        modelId: modelId,
                        key: key.toString(),
                        scope: 'MODEL',
                        status: 'CREATE'
                    } :
                    {
                        modelId: modelId,
                        key: key.toString(),
                        userId: userId,
                        scope: 'PRIVATE',
                        status: 'CREATE'                    
                    }                    
        
                    await prisma.vector.updateMany({
                        where: whereTerm,
                        data:{
                            status:'DELETE'
                        }
                    });
                }
            }
            
            // 把索引存储到服务器
            await index.write(url); // 存储索引  
            embFileCache.delete(url); // 清除全局缓存    
            
            // 这里不处理Rawdata和Model的关系，需要额外删除
            // 如果Rawdata对应的Vector已经被完全删除
            // 就删除对应的ModelRawdatas记录
        }else{
            error("无法从索引文件中删除Keys:" + keys.length);
            error("实际从索引文件中删除的记录条数：" + nRemoved);
            return nRemoved;
        }

    }catch(e){
        error("删除向量时发生错误：" + e);
        return keys.length;
    }        
    return keys.length;
}





































/*
// 用tensorflow向量化字符串
export async function embeddingByTensorFlow(sentence:string): Promise< {usedTokens:number, vector:number[]} > {
    // 加载 USE 模型
    const model = await use.load();
    
    // 待向量化的文本列表
    const texts = [ sentence ];
    
    // 向量化文本
    const embeddings = await model.embed(texts);
    
    // 将每个向量转换为 Float32Array 类型，并统一长度为 1536
    const vectors = embeddings.arraySync().map(embedding => {
      embedding = Array.isArray(embedding) ? embedding : [embedding];
      embedding = embedding.slice(0, 1536);
      return new Float32Array(embedding);
    });
    
    // 输出结果，暂时不计算算力消耗量token
    return { usedTokens:0, vector:Array.from(vectors[0]) };
}
*/
