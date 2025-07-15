

export const LLMs = [
//    {"code":"CHATGPT35", name:"chatGPT 3.5", "aiservice":"OPENAI", "baseModel":"gpt-3.5-turbo-16k", "basePrice": 1}, // USD 0.001-0.002
//    {"code":"CHATGPT35 1106", name:"chatGPT 3.5 1106", "aiservice":"OPENAI", "baseModel":"gpt-3.5-turbo-1106", "basePrice": 1}, // USD 0.001-0.002

    {"code":"DeepSeekR1", name:"DeepSeek-R1", "aiservice":"QIANWEN", "baseModel":"deepseek-r1", "basePrice": 1}, // RMB 0.004 IN 0.016 OUT 
    {"code":"DeepSeekV3", name:"DeepSeek-V3", "aiservice":"QIANWEN", "baseModel":"deepseek-v3", "basePrice": 1}, // RMB 0.002 IN 0.008 OUT 
    
    {"code":"CHATGPT35 0125", name:"chatGPT 3.5 Turbo 0125", "aiservice":"OPENAI", "baseModel":"gpt-3.5-turbo-0125", "basePrice": 1}, // USD 0.0005-0.0015    
    {"code":"CHATGPT40 1106", name:"chatGPT 4.0 Turbo 1106", "aiservice":"OPENAI", "baseModel":"gpt-4-1106-preview", "basePrice": 6}, // USD 0.01-0.03
    {"code":"CHATGPT40 2024-04-09", name:"chatGPT 4.0 Turbo 2024-04-09", "aiservice":"OPENAI", "baseModel":"gpt-4-turbo-2024-04-09", "basePrice": 6}, // USD 0.01-0.03  128k  
    {"code":"CHATGPT40", name:"chatGPT 4.0", "aiservice":"OPENAI", "baseModel":"gpt-4", "basePrice": 10}, // USD 0.03-0.06       
    {"code":"CHATGP4o", name:"chatGPT 4o", "aiservice":"OPENAI", "baseModel":"gpt-4o", "basePrice": 3}, // USD 0.005-0.015    
    {"code":"gpt-4o-search-preview", name:"gpt-4o-search-preview", "aiservice":"OPENAI", "baseModel":"gpt-4o-search-preview", "basePrice": 2}, // IN:USD 0.0025 OUT:0.01
    
    {"code":"AIPUTI7B", name:"AI菩提7B模型", "aiservice":"BAIDUAI", "baseModel":"Qianfan-Chinese-Llama-2-7B", "basePrice": 1}, // RMB 0.006
  
    {"code":"BAIDUAI", name:"百度文心一言Lite", "aiservice":"BAIDUAI", "baseModel":"ERNIE-Bot-turbo", "basePrice": 1}, // RMB 0.008
    {"code":"ERNIE-Speed-128K", name:"百度文心一言128K高速", "aiservice":"BAIDUAI", "baseModel":"ERNIE-Speed-128K", "basePrice": 1}, // 免费      
    {"code":"ERNIE-Character-8K", name:"百度文心一言角色扮演", "aiservice":"BAIDUAI", "baseModel":"ERNIE-Character-8K-0321", "basePrice": 1}, // RMB 0.004 / 0.008       
    {"code":"BAIDUAI4", name:"百度文心一言4.0", "aiservice":"BAIDUAI", "baseModel":"ERNIE-Bot-4", "basePrice": 8}, // RMB 0.12       
    
    {"code":"Mixtral-8x7B", name:"Mixtral-8x7B（开源）", "aiservice":"BAIDUAI", "baseModel":"Mixtral-8x7B", "basePrice": 3}, // RMB 0.035
    {"code":"Meta-Llama-3-70B-Instruct", name:"Llama3-70B羊驼三代（开源）", "aiservice":"BAIDUAI", "baseModel":"Meta-Llama-3-70B-Instruct", "basePrice": 3}, // RMB 0.035
    {"code":"Meta-Llama-3-8B-Instruct", name:"Llama3-8B羊驼三代（开源）", "aiservice":"BAIDUAI", "baseModel":"Meta-Llama-3-8B-Instruct", "basePrice": 1}, // RMB 0.004

    {"code":"LLAMA2", name:"Llama2-70B羊驼二代（开源）", "aiservice":"BAIDUAI", "baseModel":"Llama-2-70B-Chat", "basePrice": 1}, // RMB 0.006
    
    {"code":"GLM6B32K", name:"智谱ChatGLM2-6B-32K（开源）", "aiservice":"BAIDUAI", "baseModel":"ChatGLM2-6B-32K", "basePrice": 1}, // RMB 0.006

    
    {"code":"GLM3-6B", name:"智谱ChatGLM3-6B（开源）", "aiservice":"QIANWEN", "baseModel":"chatglm3-6b", "basePrice": 1}, // RMB 0.006 // 限时免费
    {"code":"GLM-3-Turbo", name:"智谱GLM-3-Turbo", "aiservice":"GLM", "baseModel":"GLM-3-Turbo", "basePrice": 1}, // RMB 0.001
    {"code":"GLM-4", name:"智谱GLM-4", "aiservice":"GLM", "baseModel":"GLM-3-Turbo", "basePrice": 10}, // RMB 0.1/K Tokens    
    
    {"code":"XUNFEI", name:"讯飞星火模型", "aiservice":"XUNFEI", "baseModel":"Spark V3.0", "basePrice": 2}, // RMB 0.036

    {"code":"qvq-plus", name:"通义千问多模态推理模型Plus", "aiservice":"QIANWEN", "baseModel":"qvq-plus", "basePrice": 1}, // RMB 0.002/0.005
    {"code":"qvq-max", name:"通义千问多模态推理模型Max", "aiservice":"QIANWEN", "baseModel":"qvq-max", "basePrice": 1}, // RMB 0.008/0.032
    
    {"code":"qwen-turbo", name:"通义千问模型", "aiservice":"QIANWEN", "baseModel":"qwen-turbo", "basePrice": 1}, // RMB 0.002/0.006
    {"code":"qwen-long", name:"通义千问长文模型", "aiservice":"QIANWEN", "baseModel":"qwen-long", "basePrice": 1}, // RMB 0.0005/0.002    
    {"code":"qwen-72b-chat", name:"通义千问72B（开源）", "aiservice":"QIANWEN", "baseModel":"qwen-72b-chat", "basePrice": 1} // 限时免费
  ];

export const LLMCodes: string[] = [];
for(const s of LLMs){
    LLMCodes.push(s.code);
};

export const LLMNames = new Map();
for(const s of LLMs){
    LLMNames.set(s.code, s.name);
};

export function getLLMByCode(code:string){
    for(const s of LLMs){
        if(s.code == code){
            return s;
        }
    }
}

export function getLLMByBaseModel(aiservice:string, baseModel:string){
    for(const s of LLMs){
        if(s.aiservice==aiservice && s.baseModel==baseModel){
            return s;
        }
    }
}


export function getLLMNameByCode(code:string){
    for(const s of LLMs){
        if(s.code == code){
            return s.name;
        }
    }    
}

