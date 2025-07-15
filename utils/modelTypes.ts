// price: credits
// cost: 人民币元
export const imageModels = [
    {code:"flux-merged", name:"黑森林Flux-Dev（免费）", score:4.0, price:0, cost:0, unpaidLimit:50, notVIPLimit:100, show:true },
    {code:"imagen-4-fast", name:"谷歌imagen-4-fast（超真实）", score:4.5, price:3, cost:0.146, show:true },
    {code:"phoenix-1.0", name:"leonardoai/phoenix-1.0", score:4.2, price:6, cost:0.3, show:true },
    {code:"byte-general-3.0", name:"字节豆包专业高清版3.0（汉字）", score:4.5, price:4, show:true },
    {code:"gpt-image-1-medium", name:"GPT Image 1 中质（汉字）", score:4.3, price:15, cost:0.66, show:true }, // OPENAI收 $0.07 
    
    {code:"flux-pro-ultra", name:"flux-ultra超清超细腻", score:4.8, price:10, cost:5, show:true },
    {code:"flux-dev-ultra-fast", name:"flux-dev超快版", score:4.5, price:1, cost:0.04, show:true }, // 0.005USD
    {code:"imagen-4-ultra", name:"谷歌imagen-4-ultra", score:4.9, price:9, cost:0.438, show:true }, // $0.06
    {code:"imagen-4", name:"谷歌imagen-4模型", score:4.9, price:6, cost:0.292, show:true }, // 0.04
    {code:"hidream-i1-dev", name:"hidream-l1-dev", score:4.2, price:2, cost:0.09, show:true },
    {code:"flux-schnell", name:"flux-schnell又好又快", score:4.0, price:1, cost:0.022, show:true }, // 0.003USD
   
    {code:"midjourney-imagine", name:"MidJourney V7", score:4.0, price:20, cost:0.9, show:true },
    {code:"gpt-image-1-high", name:"GPT Image 1 高质（汉字）", score:4.5, price:36, cost:1.8, show:true }, // OPENAI收 $0.19 SEG收 25%    
    {code:"gpt-image-1-low", name:"GPT Image 1 普质（汉字）", score:4.0, price:5, cost:0.2, show:true }, // OPENAI收 $0.02 
    
    {code:"wanx2.1-t2i-plus", name:"阿里通义万象2.1P（汉字）", score:4.0, price:4, cost:0.2, show:true },
    {code:"hidream-l1-fast", name:"Pruna hidream-l1-fast", score:4.1, price:2, cost:0.03, show:true }, // 
    
    {code:"ideogram-v3-quality", name:"ideogram v3高质（汉字）", score:4.5, price:15, cost:0.657, show:true }, // $0.09
    {code:"ideogram-v3-balanced", name:"ideogram v3平衡（汉字）", score:4.4, price:9, cost:0.438, show:true }, // $0.06
    {code:"ideogram-v3-turbo", name:"ideogram v3快速（汉字）", score:4.3, price:5, cost:0.219, show:true }, // $0.03

    {code:"jimeng_general_2.1", name:"即梦V2.1（汉字）", price:4, score:4.4, cost:0.25, show:true },
    
    {code:"sana-sprint-1.6b", name:"英伟达sana-sprint-1.6b", score:2.5, price:1, cost:0.01, show:true },  
    {code:"flux.1-juiced", name:"Pruna flux.1-juiced ", score:3.8, price:1, cost:0.03, show:true },  // 偶尔用一次的时候特别贵


    {code:"imagen-3", name:"谷歌imagen-3模型", score:4.9, price:8, cost:4, show:true },
    {code:"byte-general-2.1", name:"字节豆包专业高清版2.1", score:4.5, price:4, show:true },
  
    {code:"imagen-3-fast", name:"谷歌imagen-3-fast模型", score:4.6, price:5, cost:2, show:true },

    {code:"minimax-image-01", name:"minimax-image-01", score:3.8, price:2, cost:1, show:true },
  
    {code:"recraft-v3", name:"RecraftV3红熊猫", score:4.2, price:10, cost:3, show:true },
    {code:"sd3.5", name:"StableDiffusion 3.5", score:3.9, price:10, cost:5, show:true },
  
    {code:"kolors", name:"Kolors中国风（汉字）", score:4.0, price:2, show:true },
    {code:"flux-pro", name:"flux-pro极强专业表现", score:4.2, price:8, cost:4, show:true },  
  //  {code:"hidream-l1-full", name:"Pruna hidream-l1-full", price:6, cost:0.25, show:true },
    {code:"sana", name:"英伟达sana模型", score:3.0, price:1, cost:0.02, show:true },  

    {code:"hyper-flux-8step", name:"hyper-flux闪电", score:3.0, price:2, cost:0.4, show:true },
    {code:"flux-dev", name:"flux-dev加强表现", score:4.0, price:4, cost:0.1875, show:true },
    
    {code:"flux-dev-realism", name:"flux-dev全真世界版", score:4.1, price:4, show:true },
    {code:"flux-cinestill", name:"flux-cinestill实景模型", score:4.2, price:4, show:true },

    {code:"sd3.5-turbo", name:"StableDiffusion 3.5T", score:3.8, price:8, show:true },
  
//    {code:"wanx-v1", name:"阿里云通义万象V1", price:2, show:true },
    {code:"hidream-i1-full", name:"hidream-l1-full", score:4.5, price:4, cost:0.18, show:true },
    
    {code:"wanx2.1-t2i-turbo", name:"阿里通义万象2.1T（汉字）", score:3.9, price:3, cost:0.14, show:true },
    {code:"wanx2.0-t2i-turbo", name:"阿里通义万象2.0T", score:3.9, price:1, cost:0.04, show:true },    
    
    {code:"DALL-E", name:"OPEN AI DALL-E", score:2.5, price:8, show:true },

    {code:"luma-photon", name:"luma photon", score:4.0, price:4, show:true },

  
    {code:"sdxl", name:"Stable Diffusion XL版", score:3.5, price:2, show:true },
    {code:"sd3", name:"Stable Diffusion 3.0版", score:3.8, price:4, show:true },
    {code:"laion", name:"SDXL 超能优化版", score:3.5, price:4, show:true },
    
    {code:"epicrealismxl", name:"SDXL 闪电仿真版", score:3.0, price:2, show:true },
    {code:"sdxl-lighting", name:"SDXL 闪电版", score:3.2, price:2, show:true },
    {code:"epicrealism-v7", name:"epicrealism-v7超现实", score:3.2, price:4, show:true },
    {code:"ipAdapter", name:"ipAdapter风格模拟", score:3.0, price:4, show:true },
    {code:"proteus", name:"proteus超级仿真", score:3.8, price:4, show:true },
    {code:"aura-flow", name:"aura-flow-v0.2", score:3.9, price:4, show:true },
    {code:"realistic", name:"全真世界(realistic)", score:3.2, price:4, show:true },
    {code:"dreamshaper", name:"Dream Shaper", score:3.5, price:4, show:true },
    {code:"luma-photon-flash", name:"luma photon-flash", score:3.5, price:2, show:true },


    {code:"byte-anime_v1.3.1", name:"字节豆包风格化模型", score:3.9, price:4, show:true },
 
    {code:"anything_V4", name:"anything_V4清新漫画", price:4, show:false },
    {code:"barbie", name:"芭比娃娃电影风格", price:4, show:false },
    {code:"ghibli", name:"ghibli吉卜力风格", price:4, show:false },
    {code:"emoji", name:"emoji表情符号", price:4, show:false },
    {code:"appIcon", name:"可爱应用图标", price:4, show:false },
    {code:"van-gogh", name:"梵高风格油画", price:8, show:false },
    {code:"Monet", name:"莫奈风格油画", price:8, show:false },
    {code:"Leonardo-da-Vinci", name:"达芬奇油画风", price:8, show:false },
    {code:"revAnimated", name:"英雄联盟风格模型", price:4, show:false },


    {code:"flux-half-illustration", name:"flux-half-illustration虚实之间", price:4, show:false },
    {code:"flux-ft-watercolor", name:"水彩风格微调", price:4, rid:"846d1eb37059ed2ed268ff8dd4aa1531487fcdc3425a7a44c2a0a10723ef8383", show:false },
    {code:"flux-ft-black-light", name:"暗黑光影风格", price:4, rid:"d0d48e298dcb51118c3f903817c833bba063936637a33ac52a8ffd6a94859af7", "trigger":"BLKLGHT", show:false },
    {code:"flux-ft-comic", name:"美式扁平漫画风", price:4, rid:"b02e16758db6ee6d8ff6f75cb5cfb73119cecff157439a87f0bd598d72525599", "trigger":"GNRCDE", show:false },
    {code:"flux-ft-latentpop", name:"丝网印刷风格", price:4, rid:"c5e4432e01d30a523f9ebf1af1ad9f7ce82adc6709ec3061a817d53ff3bb06cc", "trigger":"LNTP", show:false },

    {code:"flux-ft-softserve-anime", name:"SoftServe漫画风格", price:4, rid:"9e35b00131765c22d260dce4106d6688e83e67d4416955ca137cb27c94ed81c9", "trigger":"sftsrv style illustration TOK", show:false },
    {code:"flux-ft-animation2k", name:"21世纪初动画风格", price:4, rid:"7faf97cc1a7a52c818dd408caf4a604b62c6c5a980b0c048bb09357379b00d9d", "trigger":"TOK", show:false },
    {code:"flux-ft-rssmurryflux", name:"美式动画片风格", price:4, rid:"cab0a128ac82fee3cc62ca7e957abe2bed0f18418268bf7ad42602bf5973d816", "trigger":"RSMRY", show:false },
    {code:"flux-ft-nihon", name:"日本风格绘画", price:4, rid:"f6db42ebb5ab496aeec5bf7a7ef2f6ea8e25785c80a952494fc915ccbe9e3d8b", "trigger":"TOK", show:false },
    {code:"flux-ft-ghibsky-illustration", name:"Ghibsky吉卜力美学", price:4, rid:"a9f94946fa0377091ac0bcfe61b0d62ad9a85224e4b421b677d4747914b908c0", "trigger":"GHIBSKY", show:false },
    {code:"flux-ft-plastic3d", name:"3D塑料卡通画", price:4, rid:"b8048bcf367adb3ecd9ac8721bdd2851849b4f9dcc134170bee99102042cabb3", "trigger":"plastic3d style", show:false },
    {code:"flux-ft-retro_linedrawing", name:"素描绘画风格", price:4, rid:"760e978194957cd641e14a216a4e94c59ddd69351ed588083d92a0074099f4ec", "trigger":"TOK", show:false },
    {code:"flux-ft-aesthetic-anime", name:"Aesthetic漫画风格", price:4, rid:"2c3677b83922a0ac99493467805fb0259f55c4f4f7b1988b1dd1d92f083a8304", "trigger":"syntheticanim", show:false },
    {code:"flux-ft-enna-sketch-style", name:"线稿风格绘画", price:4, rid:"d71246ed8256f5b5edf98b5cd181d0b6a1391f1825a108800fab58fadf6982f2", "trigger":"sketch illustration", show:false },

    {code:"flux-ft-dreamscape", name:"dreamscape", price:4, rid:"b761fa16918356ee07f31fad9b0d41d8919b9ff08f999e2d298a5a35b672f47e", "trigger":"TOK", show:false },

  
    {code:"aisha-ai-dvine-v3.1", name:"宝藏猎人漫画风", price:4, rid:"a1e4571923fa94010fd012c36bd790622a2ad8835ff26a690a2fe5fabc9520f3", show:false },
    {code:"aisha-ai-ntr-mix-v13", name:"动漫模型华丽的死亡", price:4, rid:"c94cbcb9a2dec5c74bb25264799b75e5a507cf306e82eff1597b47c7e7e29b13", show:false },
    {code:"aisha-ai-animagine-xl-4.0", name:"最强二次元风格", price:4, rid:"057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5", show:false },


  //////////////////////////////////////////
  // 淘汰模型
  //////////////////////////////////////////
    {code:"poi", name:"旅行风景画面专用模型", price:4, show:false },  
    {code:"LCM", name:"快速模型(LCM)", price:4, show:false },  
    {code:"designer", name:"AI菩提设计师专用模型(控制力强)", price:4, show:false },
    {code:"cartoon", name:"可爱卡通风格模型", price:4, show:false },
    {code:"MidJourney-V4", name:"MidJourney V4 风格模型", price:4, show:false },
    {code:"text2img_sd2.1", name:"Stable Diffusion 2.1标准版", price:2, show:false },
    {code:"playground-v2", name:"playground-v2", price:4, show:false },
    {code:"analog", name:"人物肖像照片模型", price:4, show:false },
    {code:"hasdx", name:"普通人物照片模型", price:4, show:false },
  
 ];

export const roomNames = new Map<string, string>();
export const roomMap = new Map<string, any>();
export const rooms: string[] = [];
for(const m of imageModels){
    if(m.show){
        rooms.push(m.code);
        roomNames.set(m.code, m.name);
    }
    roomMap.set(m.code, m);  
}
export const imageModelMap = roomMap;
export function getImageModelByCode(code:string){
    return imageModelMap.get(code);
}

export function supportRefImg(room:string){
    return room!='sdxl-lighting' 
        && room!='midjourney-imagine'
        && room!='flux.1-juiced'
        && room!='sana'
        && room!='sana-sprint-1.6b'
        && room!='hidream-l1-fast'
        && room!='hidream-i1-full'
        && room!='anything_V4' 
        && room!="epicrealismxl" 
        && room!='sd3'      
        && room!='laion'
        && room!='epicrealism-v7'
        && room!="aura-flow"
        && room!="flux-merged"      
        && room!="flux-dev-realism"
        && room!="flux-cinestill"
        && room!="hyper-flux-8step"
        && room!="recraft-v3"
        && room!="gpt-image-1"
        && room!="sd3.5-turbo"
        && room!="DALL-E"
        && room!="phoenix-1.0"
        && (room.indexOf("wanx2")<0)
        && (room.indexOf("imagen-")<0)
        && (room.indexOf("jimeng_general_")<0)
        &&(room.indexOf("byte-general-")<0)        
}



// cost: 人民币元
// price: credits
export const videoModels = [
    // REPLICATE
    {code:"luma-ray-flash-2-540p", name:"luma ray flash2 540p（极简超快）", score:4.0, startImage:true, endImage:true, maxLen:9, price:5, cost:0.25, show:true }, // USD 0.033/S RMB 0.25/S       
    
    {code:"doubao-seedance-1-0-lite", name:"SeeDance1.0 Lite 720P", score:4.5, startImage:true, endImage:true, maxLen:10, price:5, cost:0.21, show:true },     
    {code:"kling-v2.1-standard", name:"Kling2.1标准版（画面优秀）", score:4.4, startImage:true, mustImage:true, minLen:5, maxLen:10, price:8, cost:0.4, show:true }, // USD 0.05/S RMB 0.365/S  
    {code:"google-veo-3-fast", name:"Google veo3快速版", score:4.8, hasAudio:true, startImage:false, minLen:8, maxLen:8, price:60, cost:2.92, show:true }, // USD 0.4/S RMB 2.92/S      
    
    {code:"google-veo-3", name:"Google veo3视频（极棒）", score:5, hasAudio:true, startImage:false, minLen:8, maxLen:8, price:100, cost:5.476, show:true }, // USD 0.75/S RMB 5.475/S      
    
    {code:"minimax-hailuo-02-standard", name:"MiniMax海螺02基础版", score:4.0, startImage:true, minLen:6, mmaxLen:10, price:7, cost:0.3285, show:true }, // USD 0.045/S RMB 0.3285/S    
    {code:"minimax-hailuo-02-pro", name:"MiniMax 海螺02专业版", score:4.0, startImage:true, minLen:6, mmaxLen:6, price:12, cost:0.584, show:true }, // USD 0.08/S RMB 0.584/S    
    
    {code:"doubao-seedance-pro", name:"SeeDance1.0 Pro 1080P", score:4.7, startImage:true, endImage:false, maxLen:10, price:15, cost:0.74, show:true }, 
    
    {code:"framepack-720p", name:"framepack 720P", score:3.8, startImage:true, endImage:true, mustImage:true, maxLen:75, price:5, cost:0.25, show:true }, // USD 0.0333/S RMB 0.25/S            
    {code:"motion-2.0-480p", name:"motion-2.0 480p", score:3.8, startImage:true, endImage:false, mustImage:false, maxLen:5, price:9, cost:0.45, show:true }, // USD 0.06/S RMB 0.45/S            
    
    {code:"vidu-q1", name:"vidu q1", score:3.3, startImage:true, endImage:true, maxLen:9, price:15, cost:0.75, show:true }, // USD 0.1/S RMB 0.75/S            
    {code:"magi-distilled", name:"Magi蒸馏模型720P", score:3.2, startImage:true, endImage:false, maxLen:9, price:12, cost:0.6, show:true }, // USD 0.08/S RMB 0.6/S            
    
    {code:"pixverse-v4.5-1080p", name:"pixverse v4.5 图生视频1080p", score:4.2, startImage:true, endImage:true, maxLen:8, price:36, cost:1.8, show:true }, // USD 0.24/S RMB 1.8/S    
    
    {code:"skyreels-i2v", name:"skyreels图生视频", score:3.0, startImage:true, endImage:false, mustImage:true, maxLen:4, price:12, cost:6, show:true }, // USD 0.075/S RMB 0.5625/S  
    
    {code:"google-veo-2", name:"Google veo2视频（画面超好）", score:4.6, startImage:true, maxLen:8, price:75, cost:37.5, show:true }, // USD 0.5/S RMB 3.75/S  
    
    {code:"jimeng_vgfm_l20", name:"Jimeng-图生视频S2.0Pro", score:3.8, startImage:true, endImage:false, maxLen:5, price:12, cost:6.5, show:true }, // USD 0.09/S RMB 0.65/S  
    
    {code:"kling-v2.1-master", name:"Kling 2.1大师版（效果超棒）", score:4.7, startImage:true, minLen:5, maxLen:10, price:40, cost:2.1, show:true }, // USD 0.28/S RMB 2.1/S  
    {code:"kling-v1.6-standard", name:"Kling 1.6 standard 720P（画面稳定）", score:4.0, startImage:true, maxLen:10, price:10, cost:5, show:true }, // USD 0.056/S RMB 0.42/S  
    
    {code:"wan-2.1-i2v-480p", name:"WanX 2.1图生视频480p", score:3.8, startImage:true, maxLen:5, price:14, cost:7, show:true }, // USD 0.09/S RMB 0.675/S
    {code:"hunyuan-video", name:"Hunyuan 720P", score:3.9, startImage:true, maxLen:5, price:12, cost:6, show:true }, // USD 0.08/S RMB 0.6/S
    {code:"minimax-video-01", name:"MiniMax Video-01", score:4.0, startImage:true, refImage:true, maxLen:5, price:16, cost:8, show:true }, // USD 0.1/S RMB 0.75/S    
    {code:"pixverse-v3.5-720p", name:"pixverse v3.5 图生视频720p", score:3.9, startImage:true, maxLen:8, price:12, cost:6, show:true }, // USD 0.08/S RMB 0.6/S        
    {code:"pika-v2.2-1080p", name:"PIKA v2.2 1080p", score:3.7, startImage:true, maxLen:5, price:14, cost:7, show:true }, // USD 0.09/S RMB 0.675/S
    
    
    {code:"kling-v1.6-pro", name:"Kling 1.6 pro 1080P", score:4.2, startImage:true, maxLen:10, price:16, cost:8, show:true }, // USD 0.098/S RMB 0.75/S
    {code:"kling-v2-master", name:"Kling 2.0大师版（画面超棒）", score:4.5, startImage:true, maxLen:5, price:40, cost:21, show:true }, // USD 0.28/S RMB 2.1/S  
    
    
    {code:"wan-2.1-t2v-480p", name:"WanX 2.1文生视频480p", score:3.8, startImage:false, maxLen:5, price:12, cost:6, show:true }, // USD 0.07/S RMB 0.525/S
    {code:"wan-2.1-i2v-720p", name:"WanX 2.1图生视频720p", score:4.0, startImage:true, maxLen:5, price:40, cost:19, show:true }, // USD 0.25/S RMB 1.875/S
    {code:"wan-2.1-t2v-720p", name:"WanX 2.1文生视频720p", score:4.0, startImage:false, maxLen:5, price:36, cost:18, show:true }, // USD 0.24/S RMB 1.8/S
    
    {code:"minimax-video-01-director", name:"MiniMax Video-01-director", score:4.0, startImage:true, maxLen:5, price:16, cost:8, show:true }, // USD 0.1/S RMB 0.75/S      
    {code:"minimax-video-01-live", name:"MiniMax Video-01-live", score:4.0, startImage:true, price:16, cost:8, show:true }, // USD 0.1/S RMB 0.75/S      
    
    {code:"luma-ray-2-540p", name:"luma ray2 540p", score:3.5, startImage:true, endImage:true, maxLen:9, price:16, cost:8, show:true }, // USD 0.1/S RMB 0.75/S        
    {code:"luma-ray-flash-2-720p", name:"luma ray flash2 720p", score:3.6, startImage:true, endImage:true, maxLen:9, price:10, cost:5, show:true }, // USD 0.06/S RMB 0.45/S        
    {code:"luma-ray-2-720p", name:"luma ray2 720p", score:3.8, startImage:true, endImage:true, maxLen:9, price:30, cost:14, show:true }, // USD 0.18/S RMB 1.35/S        
    
    //FAL
    {code:"magi", name:"Magi 720P", score:3.2, startImage:true, endImage:false, maxLen:9, price:30, cost:15, show:true }, // USD 0.2/S RMB 1.5/S                    
    
    {code:"pixverse-v3.5-540p", name:"pixverse v3.5 图生视频540p", score:3.3, startImage:true, maxLen:8, price:12, cost:6, show:false }, // USD 0.06/S RMB 0.45/S        
    {code:"pixverse-v3.5-1080p", name:"pixverse v3.5 图生视频1080p", score:3.5, startImage:true, maxLen:8, price:24, cost:12, show:true }, // USD 0.16/S RMB 1.2/S        
    {code:"pixverse-v4-1080p", name:"pixverse v4 图生视频1080p", score:3.8, startImage:true, maxLen:5, price:36, cost:18, show:true }, // USD 0.24/S RMB 1.8/S        
    
    {code:"hunyuan-video-pro", name:"Hunyuan文生图PRO", score:4.0, startImage:false, maxLen:5, price:24, cost:12, show:true }, // USD 0.16/S RMB 1.2/S
    
    {code:"pika-v2.2-720p", name:"PIKA v2.2 720p", score:3.5, startImage:true, maxLen:5, price:6, cost:3, show:true }, // USD 0.04/S RMB 0.3/S  
    {code:"ltx-video-v097", name:"ltx-video-v097", score:2.5, startImage:true, endImage:true, mustImage:false, maxLen:4, price:7, cost:0.375, show:true }, // USD 0.05/S RMB 0.375/S               
];
export const videoModelNames = new Map<string, string>();
export const videoModelMap = new Map<string, any>();
export const videoModelCodes: string[] = [];
for(const m of videoModels){
    if(m.show){
        videoModelCodes.push(m.code);
        videoModelNames.set(m.code, m.name);
    }
    videoModelMap.set(m.code, m);  
}
export function getVideoModelByCode(code:string){
    return videoModelMap.get(code);
}

// needMask说明必须有maskImage
// supportMask说明原生支持mask
export const inpaintModels = [
    {code:"flux-fill-pro", name:"专业局部重绘引擎（更好的修复细节）", supportMask:true, needMask:true, price:15, hotWords:"REPAIRE"},
    {code:"flux-fill-dev", name:"高级局部重绘引擎（擅长修复细节）", supportMask:true, needMask:true, price:10, hotWords:"REPAIRE"},    
    {code:"flux-dev-inpaint", name:"FLUX通用局部重绘引擎", supportMask:true, needMask:true, price:5, hotWords:"REPAIRE"},
    {code:"ideogram-v3-turbo", name:"IDEOGRAM-V3重绘引擎（擅长画面调整）", supportMask:true, needMask:true, price:5, cost:0.219, hotWords:"REPAIRE"},
    {code:"byte-inpainting-edit", name:"豆包图像涂抹编辑引擎", supportMask:true, needMask:true, price:4, cost:0.2, hotWords:"REPAIRE"},        

    {code:"omnigen-v2", name:"omnigen-v2编辑引擎（善于P人）", supportMask:false, needMask:false, price:20, cost:10, hotWords:"FREE_EDIT"},        
    
    {code:"flux-kontext-max", name:"flux-kontext-max指令编辑引擎", supportMask:false, needMask:false, price:10, cost:0.6, hotWords:"FREE_EDIT"},    
    {code:"flux-kontext-pro", name:"flux-kontext-pro指令编辑引擎", supportMask:false, needMask:false, price:6, cost:0.3, hotWords:"FREE_EDIT"},    
    
    {code:"wanx2.1-imageedit", name:"万相通用图像编辑（支持加汉字）", supportMask:true, needMask:true, price:2, cost:0, hotWords:"FREE_EDIT"},   
    {code:"gemini-flash-edit", name:"谷歌Gemini指令编辑引擎（性价比）", supportMask:false, needMask:false, price:4, cost:0.075, hotWords:"FREE_EDIT"},
    {code:"step1x-edit", name:"Step1X-Edit指令编辑引擎（新）", supportMask:false, needMask:false, price:5, cost:0.2, hotWords:"FREE_EDIT"},
    {code:"hidream-e1-full", name:"hidream-e1-full指令编辑引擎（新）", supportMask:false, needMask:false, price:10, cost:0.45, hotWords:"FREE_EDIT"},
    {code:"byte-edit_v2.0", name:"豆包图像指令编辑引擎", supportMask:false, needMask:false, price:4, cost:0.2, hotWords:"FREE_EDIT"},        
    {code:"bagel-editing", name:"bagel图像编辑开源引擎", supportMask:false, needMask:false, price:10, cost:0.56, hotWords:"FREE_EDIT"},      
    {code:"gpt-image-1-edit-high", name:"OpenAI GPT指令编辑引擎（土豪专享）", supportMask:true, needMask:false, price:32, cost:1.6, hotWords:"FREE_EDIT"},    
    {code:"gpt-image-1-edit-medium", name:"OpenAI GPT指令编辑引擎（中等质量）", supportMask:true, needMask:false, price:8, cost:0.375, hotWords:"FREE_EDIT"},    
    {code:"gpt-image-1-edit-low", name:"OpenAI GPT指令编辑引擎（普通质量）", supportMask:true, needMask:false, price:4, cost:0.1, hotWords:"FREE_EDIT"},  // openai:0.01 seg:25% 
    
//    ["inpaint", "模拟现实感重绘引擎"],
//    ["sd-inpaint", "SD标准重绘引擎"],
//    ["sdxl-inpaint", "SDXL重绘引擎"],    
    ];
export const inpaintModelNames = new Map<string, string>();
export const inpaintModelMap = new Map<string, any>();
export const inpaintModelCodes: string[] = [];

export const maskInpaintModelNames = new Map<string, string>();
export const maskInpaintModelMap = new Map<string, any>();
export const maskInpaintModelCodes: string[] = [];

export const magicInpaintModelNames = new Map<string, string>();
export const magicInpaintModelMap = new Map<string, any>();
export const magicInpaintModelCodes: string[] = [];

for(const m of inpaintModels){
    inpaintModelCodes.push(m.code);
    inpaintModelNames.set(m.code, m.name);
    inpaintModelMap.set(m.code, m);  

    if(m.supportMask){
        maskInpaintModelCodes.push(m.code);
        maskInpaintModelNames.set(m.code, m.name);
        magicInpaintModelMap.set(m.code, m);  
    }
    if(!m.needMask){
        magicInpaintModelCodes.push(m.code);
        magicInpaintModelNames.set(m.code, m.name);
        magicInpaintModelMap.set(m.code, m);          
    }
}
export function getInpaintModelByCode(code:string){
    return inpaintModelMap.get(code);
}


