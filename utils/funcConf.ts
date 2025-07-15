import { rooms, roomNames, imageModels, videoModels, videoModelNames, videoModelMap,  videoModelCodes} from "../utils/modelTypes";
import * as mt from "../utils/modelTypes";
import {getFileNameFromURL} from "./fileUtils";
import * as debug from "./debug";

function appendParamToPath(path:string, key:string, value:string){
    if(path.indexOf("?")>=0){
        path += '&';
    }else{
        path += '?';
    }
    path += `${key}=${value}`;
    return path;
}


export function getCreateLink(func: string, model: string){
    if( func == "lora" ){
        return "/createLoRA";
    }else if( rooms.includes(func) ){
        return "/createPrompt";
    }

    for(const f of AIFuncs){
        if(f.code == func){
            return appendParamToPath(f.url, "title", f.name);
        }
    }

    return "#"    
}

export function getRoomFuncLink(room: any){
    if(room && room.func && room.id){
        return `/${room.func}?roomId=${room.id}`;
    }else{
        return "#";
    }
}

// prompt是给imageDetail调用createPrompt函数时，给出当前的prompt
export function getFuncLink(func: string, model: string, price: number, prompt?:string|null, seed?:string|null){
    // const ps = prompt? ("&prompt=" + prompt) : "") + (seed? ("&seed=" + seed) : "");
    const ps = "";
    // if( func == "faceswap" && model != "no model" ){
    if( func == "lora" ){
        return "/lora?model="+ model + ps;
    }else if( rooms.includes(func) && model == "no model"){
        return "/createPrompt?title=创意实验室&func=" + func + ps;
    }else if( rooms.includes(func) && model !== "no model"){
        return "/runPromptApp?prompt="+model;
    }else if( model && model != "no model" && func != "zoomIn" && func != "faceswap"){
        if(model.indexOf("M")==0){
            return "/lora?model=" + model + ps;        
        }else{
            return "/takePhoto?model=" + model + ps;        
        }
    }
    
    //else if( (func == "zoomIn") && model == "no model" ){
    //    return "/createPrompt?title=创意实验室" + ps;
    //}

    for(const f of AIFuncs){
        if(f.code == func){
            let url = f.url;
            url = appendParamToPath(url, "title", f.name);
     //       if(prompt){
     //           url = appendParamToPath(url, "prompt", prompt);
     //       }
            if(seed){
                url = appendParamToPath(url, "seed", seed);
            }
            return url;
        }
    }

    return "#"
}


export function getFuncTitle(func: string, model: string){
    // if( func == "faceswap" && model != "no model" ){
    //if( (func == "faceswap" || func == "zoomIn") && model == "no model" ){
    //    return "创意实验室";
    //}else if( rooms.includes(func as roomType) && model == "no model"){
    //    return "创意实验室";
    //}else 
        
    if( rooms.includes(func) && model !== "no model"){
        return model;
    }else if( model && model != "no model" && func != "zoomIn" && func != "faceswap"){
        return model;
    // }else if( func == "lora" ){
    //    return model;
    }

    switch(func){
        case "flux-dev-inpaint": 
        case "sd-inpaint":
        case "sdxl-inpaint":
        case "inpaint":    
            func = "inpaint"
    }
    
    for(const f of AIFuncs){
        if(f.code == func){
            return f.name;
        }
    }

    if(func === "userUpload"){
        return "相册上传文件";
    }
    
    return "神秘的AI应用";
}


// 内部函数
// 根据code查功能
export function getAIFuncByCode(code:string, rename?:string, funcs?:any[]){
    if(!funcs){
        funcs = AIFuncs;
    }
    const func = funcs.find(item => item.code === code);
    if(func && rename){
        func.name = rename;
        func.url = appendParamToPath(func.url, "title", rename);
    }
    return func;
}

// 查找并删除记录的函数
function deleteAIFuncByCodes(codes:string[], funcs?:any[]) {
    if(!funcs){
        funcs = AIFuncs;
    }
    for(const code of codes){
        const index:number = funcs.findIndex(item => item.code === code);
        if (index !== -1) {
            funcs.splice(index, 1);
        }
    }
    return funcs;
}


// 对外函数
export function getFuncByURL(url:string){
    url = decodeURIComponent(url);
    //alert("url: " + url);
    for(const f of AIFuncs){
        //alert("F: " + JSON.stringify(f));
        if(url.indexOf(f.url)>=0){
            //alert("f:" + JSON.stringify(f));
            return f;
        }
    }
}
    
export function getFuncByCode(config:any, code:string){
//    if(config.websiteName == "aixiezhen"){
//        return getAIFuncByCode(code, undefined, aixiezhenTools);
//    }else{
        return getAIFuncByCode(code, undefined, AIFuncs);
 //   }
}

export function getImageModelPrice(model:string){
    for(const m of imageModels){
        if(m.code == model){
            return m.price;
        }
    }
    return 10;
}

export function getLoraModelPrice(model:any){
    if(model?.price > 0){
        return model.price
    }else{
        return 10;
    }
}


/*
// 控制所有模块价格的主函数，修改一定要小心！！！！
*/
export function getPricePack(config:any, code:string, model?:any, units?:number, user?:any){
    switch(code){
        case "recognizeFace":
        case "segmentBody":
        case "segmentHair":
        case "detectFace":
        case "auditImage":
            return {price:0, unpaidLimit:0};

        case "dream":
        case "deco":
        case "draft":
        case "garden":
            return {price:4, unpaidLimit:0};

        case "faceTidyup":
        case "faceMakeup":
        case "faceFilter":
        case "enhanceFace":
        case "faceBeauty":
        case "segmentBody":
        case "segmentHair":
        case "retouchSkin":
        case "liquifyFace":            
        case "decoratePhoto":
            return {price:getFuncByCode(config, "decoratePhoto")?.price, unpaidLimit:0};

        case "flux-dev-inpaint": 
        case "sd-inpaint":
        case "sdxl-inpaint":
        case "inpaint":{
            const m = mt.inpaintModelMap.get(model); 
            // 可能有淘汰模型查不出来
            return {price: m?.price || 10, unpaidLimit:0};
        }
        case "changeLanguage":{
            const m = mt.inpaintModelMap.get(model); 
            // 可能有淘汰模型查不出来
            return {price: (m?.price || 10)+2, unpaidLimit:0};
        }
        case "outpaint":{
            let price = 10;
            switch(model){
                case "ideogram-v3-reframe": price=4; break;
                case "focus": price = 5; break;                    
                case "flux-fill-dev": price = 6; break;
                case "flux-fill-pro": price = 8; break;
                case "combo": price = 10; break;
                case "seg-beyond": price = 20; break;
                case "wanx2.1-imageedit": price = 4; break;
                case "byte-outpainting": price =4; break;
                default: price = 10;
            }
            return {price, unpaidLimit:0};
        }
        case "createPrompt":
            const m = mt.imageModelMap.get(model);
            return {price: m.price, unpaidLimit:m.unpaidLimit||0, notVIPLimit:m.notVIPLimit||0};

        case "createPoster":
            let price = getFuncByCode(config, "createPoster")?.price;
            switch(model){
                case "gpt-image-1-medium":
                case "byte-general-3.0":
                case "ideogram-v3-balanced":
                    const m = mt.imageModelMap.get(model);                    
                    price =  m.price + 5;
            }
            return {price, unpaidLimit:0};

        case "superCamera":{
            let price = 10;
            switch(model){
                case "minimax-image-01": price = 8; break;
                case "flux-pulid": price = 10; break;
                case "flux-kontext-pro": price = 6; break;
                default: {
                    const m = mt.imageModelMap.get(model);                    
                    const mPrice = m.price;
                    const fPrice = getFuncByCode(config, "superCamera")?.price || 5;
                    price = mPrice + fPrice;
                }
            }
            return {price, unpaidLimit:0};
        }
        case "takePhoto":
            let scale = 1;
            switch(model.inference){
                case "stylePortrait": scale = 1; break;
                case "normalPortrait": scale = 1.4; break;
                case "performancePortrait": scale = 1.6; break;
                case "beatifulPortrait": scale = 2; break;
            }
            return {price:Math.ceil(getLoraModelPrice(model.modelCode) * (scale)), unpaidLimit:0}; 
            // getFuncByCode(config, "takePhoto").price + getLoraModelPrice(model);
            
        case "lora":
            return {price:getLoraModelPrice(model), unpaidLimit:2};

        case "omni-zero-fal": 
        case "facefusion": {
            return {price:10, unpaidLimit:2};
        }
        case "changeExpression":{
            let price = 2;
            switch(model){
                case "expression-editor": price = 2; break;
                case "flux-kontext-pro": price = 6; break;
                case "live-portrait-image": price = 4; break;
            }
            return {price, unpaidLimit:5};            
        }
        case "changePerson":{
            let price = 10;
            switch(model){
                case "model": price = 10; break;
                case "prompt": price = 20; break;
            }
            return {price, unpaidLimit:1};
        }
                    
        case "takeIDPhoto": {
            let price = 10;
            switch(model){
                case "faceswap": price = 4; break;
                case "facefusion": 
                default:
                    price = 10;  
            }
            return {price, unpaidLimit:2}
        }
        case "zoomInVideo":{
            const {func, upscale} = model;
            let price = 10;
            switch(func){
                case "byte-video_upscale":
                    price = 2;
                    break;
                default:
                    price = getFuncByCode(config, "zoomInVideo")?.price;
            }
            price = Math.round(price * (upscale - 1) * (units || 1));
            return {price, unpaidLimit:1}
        }
        case "faceswapVideo": {
            let price = 4;
            switch(model){
                case "faceswapFilter": price = 6; break;  // cost:0.3                                      
                case "faceswapVideoHD": price = 5; break;                     
                case "faceswapVideo": 
                default: price = 4; break;
            }
            return {price:Math.round(price * (units || 1)), unpaidLimit:2};
        }
        case "hairDesign": {
            let price = 2;
            switch(model){
                case "faceswapV4_S": price = 30; break;
                case "faceswap": 
                default:
                    break;
            }
            return {price, unpaidLimit:0};
        }            
        case "faceswap": {
            let price = 4;
            let unpaidLimit = 0;
            let notVIPLimit = 0;
            switch(model){
                case "byte-faceswap": price = 4; unpaidLimit = 5; notVIPLimit = 10; break;  
                case "faceswapGPT": price = 10; unpaidLimit = 2; notVIPLimit = 5; break; 
                case "faceswapHD": price = 6; unpaidLimit = 5; notVIPLimit = 10; break;
                case "facefusion": price = 10; unpaidLimit = 2; break;
                case "faceswapV4_S": price = 20; unpaidLimit = 2; notVIPLimit = 5; break;
                case "faceswapV4_Q": price = 40; unpaidLimit = 2; notVIPLimit = 5; break;                    
                case "faceswap": notVIPLimit = 20; break; 
                default:
                    break;
            }
            return {price, unpaidLimit, notVIPLimit};
        }
        case "changeBG": {
            let price = 20;
            let unpaidLimit = 0;
            switch(model){
                case "byte-bgpaint": price=4; break;
                case "ideogram-v3-bg-turbo": price = 4; break;
                case "gpt-image-1-edit-medium": price = 8; unpaidLimit=2; break;
                case "flux-kontext-pro": price = 6; unpaidLimit=5; break;
                case "iclight-v2": price = 20; unpaidLimit=3; break;
                case "auto": price = 4; unpaidLimit=3; break;
                case "hard": price = 1; unpaidLimit=10; break;
            }
            return {price, unpaidLimit}
        }
        case "createVideo":
        case "img2video":{
            let price = Math.round((getFuncByCode(config, "createVideo")?.price || 0 ) * (units || 1));
            switch(model){
                case "PRO_PLUS2":
                    price =price * 5;
                    break;
                case "PRO_PLUS":
                    price = price * 2;
                    break;
                case "DYNAMIC":
                    price = price * 2;
                    break;
                case "ANIMATION":
                    price = price * 2;
                    break;
                case "PRO":
                    price = price * 2;
                    break;
                case "QUICK":
                    price = price * 0.5;
                    break;
                case "SIMPLE":
                    price = price * 1;
                default: {
                    const m = videoModelMap.get(model);
                    if(m?.price){
                        price = m.price * (units || 1);
                    }
                }
            }
            return {price, unpaidLimit:1};
        }
        case "recolorImage": {
            let price = getFuncByCode(config, "recolorImage")?.price || 4;                                   
            switch(model){
                case "flux-kontext-pro": price = 6; break;
                case "flux-kontext-max": price = 10; break; // 0.08
                default: 
            }
            return {price, unpaidLimit:4};                                               
        }
        case "videoRetalk":{
            let price = getFuncByCode(config, "videoRetalk")?.price || 1;                                   
            switch(model){
                case "kling-lip-sync": price = 2; break;
                case "videoretalk": price = 2; break; // 0.08
                default: 
            }
            return {price:Math.round(price * (units || 1)), unpaidLimit:1};                                               
        }
        case "sadTalker":{
            let price = getFuncByCode(config, "sadTalker")?.price || 1;                                   
            switch(model){
                case "memo": price = price*4;
                case "v-express": price = price*2;
                case "emo-v1": price = 1; 
                case "liveportrait": price = 1; // 0.02/s
                case "sonic": price = 3;
                default: 
            }
            return {price:Math.round(price * (units || 1)), unpaidLimit:1};                                               
        }
        case "createVoice":
            return {price:Math.round((model?.price || 1) * (units || 0)), unpaidLimit:3};
            
        default: {    
            const func = getFuncByCode(config, code);
            if(func){
                // return (model && model.price && func.price<=model.price) ? model.price : func.price;
                debug.log(`code:${code} ${model?.name || "no model input"}, ${model?.price || 0} func.price:${func.price} `);
                const unitPrice = func.price; // 以模型价格为准
                if(units && units>0){
                    return {price:Math.round(unitPrice * units), unpaidLimit:0};
                }else{
                    return {price:unitPrice, unpaidLimit:0};
                }
            }
        }
    }
    return {price:0, unpaidLimit:-1};
}
    
// 全部AI工具
// price:点
// cost: 元
export const AIFuncs: any[] = [

    { code: "viralPic", name: "网红打卡", price: 4, url: "/wechat/viralPic", demos: ["viralPic_in.jpg", "viralPic_out.jpg"], icon: "mdi:camera-enhance" },
    
  { code: "cropImage", name: "照片裁剪",  shortName: "裁剪", hint:"对照片任意裁剪和放大缩小", price: 0, cost: 0, url: "/cropImage", demos: ["cropImage_in.jpg", "cropImage_out.jpg"], icon: "heroicons:scissors" },
  { code: "editImage", name: "绘图编辑", shortName: "绘图", hint:"基础的绘图和编辑功能", price: 0, url: "/editImage", demos: ["editImage_in.jpg", "editImage_out.jpg"], icon: "mdi:draw-pen" },
  
    { code: "createPoster", name: "海报设计", hint:"按照要求AI生成海报", price: 10, url: "/createPoster", demos: ["createPoster_in.jpg", "createPoster_out.jpg"], icon: "mdi:post-outline" },
    { code: "autoCaption", name: "智能排版标题文字", hint:"把标题文字AI排版到图片上", shortName:"标题", price: 10, url: "/autoCaption", demos: ["autoCaption_in.jpg", "autoCaption_out.jpg"], icon: "mdi:subtitles-outline" },

  // COST stylePortrait:0.09元 normal:0.04元 beautiful&performance:0.13元 
  { code: "takePhoto", name: "套系写真相机", hint:"选择写真套系来拍摄写真", price: 10, cost: 0.13, url: "/takePhoto", demos: ["takePhoto_in.jpg", "takePhoto_out.jpg", "takePhoto_index.jpg"], icon: "heroicons:camera" },
  { code: "takeGroupPhoto", name: "多人合影相机", midName:"多人合影",  hint:"提供单人照片，AI合成双人或三人合影", price: 20, cost: 1, url: "/takeGroupPhoto", demos: ["takeGroupPhoto_in.jpg", "takeGroupPhoto_out.jpg", "takeGroupPhoto_index.jpg"], icon: "heroicons:user-group" },
  { code: "superCamera", name: "极简肖像相机", hint:"提供形象照拍摄任意创意肖像照", price: 5, cost: 3, url: "/superCamera", demos: ["superCamera_in.jpg", "superCamera_out.jpg", "superCamera_index.jpg"], icon: "heroicons:sparkles" },
  { code: "stylePortrait", name: "风格模拟相机", hint:"模拟样片的风格效果生成您的照片", price: 4, cost: 2, url: "/stylePortrait", demos: ["stylePortrait_in.jpg", "stylePortrait_out.jpg", "stylePortrait_index.jpg"], icon: "heroicons:photo" },
  { code: "takeIDPhoto", name: "证件照相机", shortName:"证件照片", hint:"提供头像，让AI生成标准证件照", price: 4, cost: 2, url: "/takeIDPhoto", demos: ["takeIDPhoto_in.jpg", "takeIDPhoto_out.jpg", "takeIDPhoto_index.jpg"], icon: "heroicons:identification" },
  { code: "poseAndFace", name: "姿态学习相机", hint:"模拟样片的人物姿态生成新照片", price: 4, cost: 2, url: "/poseAndFace", demos: ["poseAndFace_in.jpg", "poseAndFace_out.jpg", "poseAndFace_index.jpg"], icon: "heroicons:arrow-trending-up" },

  { code: "face2Photo", name: "人物肖像相机", price: 4, cost: 3, url: "/face2Photo", demos: ["face2Photo_in.jpg", "face2Photo_out.jpg"], icon: "heroicons:face-smile" },

  { code: "createLoRA", name: "训练照片小模型",  hint:"只需提供8-10张照片，就可以训练一个您的专属小模型", shortName: "训练模型", price: 100, cost: 150, url: "/createLoRA", demos: ["model_in.jpg", "model_out.jpg"], icon: "heroicons:cube" },

  { code: "createPrompt", name: "生成图片", shortName: "生成图片", hint:"热门文生图大模型都在这里", price: 0, url: "/createPrompt", demos: ["createPrompt_in.jpg", "createPrompt_out.jpg"], icon: "heroicons:light-bulb" },

  { code: "changePerson", name: "替换模特", shortName: "模特", hint:"不只是换脸，而是替换整个人物，包括皮肤", price: 10, cost: 2, url: "/changePerson", demos: ["changePerson_in.jpg", "changePerson_out.jpg"], icon: "mdi:account-convert" },

  { code: "changeCloth", name: "替换服装虚拟试衣", midName:"更换服装", shortName: "服装", price: 10, cost: 0.1, url: "/changeCloth", demos: ["changeCloth_in.jpg", "changeCloth_out.jpg"], icon: "mdi:hanger" },
  { code: "changeHair", name: "改变发型", shortName: "发型", hint:"任意改变照片中人物的发型", price: 10, cost: 0.1, url: "/changeHair", demos: ["changeHair_in.jpg", "changeHair_out.jpg"], icon: "mdi:hair-dryer" },
  { code: "inpaintGemini", name: "谷歌Gemini编辑器", price: 4, cost: 0.2, url: "/inpaintGemini", demos: ["inpaintGemini_in.jpg", "inpaintGemini_out.jpg"], isNew: true, icon: "heroicons:pencil-square" },
  { code: "inpaintGPT", name: "chatGPT图片编辑器", price: 40, cost: 2.6, url: "/inpaintGPT", demos: ["inpaintGPT_in.jpg", "inpaintGPT_out.jpg"], isNew: true, icon: "heroicons:chat-bubble-left-ellipsis" },
  { code: "inpaint", name: "图片魔改", shortName: "魔改", hint:"可以对话发指令让AI修改图片，也可以涂抹修改", price: 4, cost: 0.2, url: "/inpaint", demos: ["inpaint_in.jpg", "inpaint_out.jpg"], icon: "mdi:auto-fix" },

  { code: "putModelInReal", name: "分身入景", price: 10, cost: 3, url: "/putModelInReal", demos: ["putModelInReal_in.jpg", "putModelInReal_out.jpg"], icon: "heroicons:rectangle-stack" },

  { code: "changeStyle", name: "改变画面风格", midName:"画风模拟", shortName: "风格", hint:"让您的照片模仿样片的画风，试试用您喜欢的油画、漫画做样片", price: 10, cost: 1, url: "/changeStyle", demos: ["changeStyle_in.jpg", "changeStyle_out.jpg"], icon: "heroicons:swatch" },
  { code: "simStyle", name: "模仿画面风格", shortName: "模仿风格", hint:"模仿样片的画风来绘图，比如变成特定风格的油画、漫画等风格", price: 10, cost: 1, url: "/simStyle", demos: ["changeStyle_in.jpg", "changeStyle_out.jpg"], icon: "heroicons:swatch" },

  { code: "outpaint", name: "扩展内容", shortName: "扩图", hint:"让AI想象并扩展画面的内容", price: 10, cost: 3, url: "/outpaint", demos: ["outpaint_in.jpg", "outpaint_out.jpg"], icon: "heroicons:arrows-pointing-out" },

  { code: "changeBG", name: "替换场景背景", midName:"更换场景", shortName: "背景", hint:"不仅仅是换背景，而是让人物或前景物体完全融入新场景", price: 2, url: "/changeBG", demos: ["changebg_in.jpg", "changebg_out.jpg"], icon: "heroicons:globe-alt" },
  { code: "removeBG", name: "抠图删背景", midName:"扣图扣印",  shortName: "抠图", price: 1, cost: 0.4, url: "/removeBG", demos: ["removeBG_in.jpg", "removeBG_out.jpg"], icon: "mdi:eraser-variant" },
  { code: "removeObject", name: "涂抹删除水印文字人物", midName:"局部消除", shortName: "消除", price: 6, cost: 0.3, url: "/removeObject", demos: ["removeObject_in.jpg", "removeObject_out.jpg"], icon: "heroicons:trash" },

  { code: "simImage", name: "智能重绘",  shortName: "重绘", price: 4, url: "/simImage", demos: ["simImage_in.jpg", "simImage_out.jpg"], icon: "heroicons:arrow-path" },
  { code: "recolorImage", name: "老照片修复上色", midName:"修复上色", shortName: "上色", price: 4, maxWorkers: 1, url: "/recolorImage", demos: ["recolorImage_in.jpg", "recolorImage_out.jpg"], icon: "heroicons:eye-dropper" },

  { code: "simVoice", resultType: "VOICE", name: "模仿声音", hint:"模仿您提供的人声样本生成文本的发音", price: 2, cost: 0.1, url: "/simVoice", demos: ["simVoice_in.mp4", "simVoice_out.mp4"], icon: "heroicons:microphone" },
  { code: "createSpeaker", resultType: "VOICE", name: "克隆声音",  hint:"克隆您提供的任意人声", price: 10, cost: 0.01, url: "/createSpeaker", demos: ["createSpeaker_in.jpg", "createSpeaker_out.mp4"], icon: "heroicons:user-plus" },
  { code: "createVoice", resultType: "VOICE", name: "生成语音", price: 1, url: "/createVoice", demos: ["createVoice_in.jpg", "createVoice_out.jpg"], icon: "heroicons:megaphone" },
  { code: "createMusic", resultType: "VOICE", name: "创作纯音乐", hint:"创建一首纯音乐，不包含人声", price: 1, url: "/createMusic", demos: ["createMusic_in.jpg", "createMusic_out.mp4"], icon: "heroicons:musical-note" },
  { code: "createSong", resultType: "VOICE", name: "创作歌曲", hint:"模仿样本歌曲，创建新的歌曲", price: 10, url: "/createSong", demos: ["createSong_in.jpg", "createSong_out.mp4"], icon: "heroicons:musical-note" },

  { code: "createVideo", resultType: "VIDEO", name: "生成视频", hint:"所有主流热门视频生成模型都在这里！", price: 10, cost: 3, url: "/createVideo", demos: ["createVideo_in.jpg", "createVideo_out.mp4"], icon: "heroicons:film" },
  { code: "sadTalker", resultType: "VIDEO", name: "照片说话唱歌", midName:"照片说话", hint:"提供一张照片，让他按照你的要求说话或者歌唱", price: 10, url: "/sadTalker", demos: ["video_in.jpg", "sadTalker_out.mp4"], poster:"video_in.jpg", icon: "mdi:account-voice" },
  { code: "portraitVideo", resultType: "VIDEO", name: "表情视频模仿", midName:"表情模仿", hint:"提供一张人物照片，让他模仿视频里的表情动作", price: 10, url: "/portraitVideo", demos: ["portraitVideo_in.jpg", "portraitVideo_out.mp4"], poster:"portraitVideo_in.jpg", icon: "mdi:emoticon-happy" },
  { code: "videoMimic", resultType: "VIDEO", name: "动作视频模仿", midName:"动作模仿", hint:"提供一张人物照片，让他模仿视频离的跳舞等动作", price: 10, cost: 0.3, maxWorkers: 1, url: "/videoMimic", demos: ["videoMimic_in.mp4", "videoMimic_out.mp4"], poster:"videoMimic.jpg", icon: "mdi:motion-play" },
  { code: "videoMatting", resultType: "VIDEO", name: "视频绿幕", price: 4, url: "/videoMatting", demos: ["videoMatting_in.mp4", "videoMatting_out.mp4"], icon: "heroicons:video-camera-slash" },

  { code: "controlImage", name: "模仿重绘",  shortName: "模仿绘图", hint:"按照模板照片的细节线条或者大致构图，生成新的图片", price: 10, url: "/controlImage", demos: ["controlImage_in.jpg", "controlImage_out.jpg"], icon: "heroicons:document-duplicate" },

  { code: "deco", name: "室内装修", hint:"提供您现有的房间照片，甚至是毛坯房照片，生成各种风格装修效果图", price: 10, url: "/arch/deco", demos: ["deco_in.jpg", "deco_out.jpg"], icon: "heroicons:home-modern" },
  { code: "garden", name: "花园改造", hint:"提供您现有的花园照片，生成各种风格花园改造效果图", price: 10, url: "/arch/garden", demos: ["garden_in.jpg", "garden_out.jpg"], icon: "heroicons:leaf" },
  { code: "draft", name: "草图渲染", hint:"提供您绘制的建筑线稿草图，就可以渲染出实景效果图", price: 10, url: "/arch/draft", demos: ["draft_in.jpg", "draft_out.jpg"], icon: "heroicons:pencil" },

  { code: "lora", name: "图片小模型", price: 5, cost: 2, url: "/lora", demos: ["model_in.jpg", "model_out.jpg"], icon: "heroicons:cube-transparent" },
  { code: "runPromptApp", name: "提示词应用", price: 4, url: "/runPromptApp", demos: ["createPrompt_in.jpg", "createPrompt_out.jpg"], icon: "heroicons:command-line" },

  { code: "simulateColorTone", name: "色彩色调", shortName: "调色", hint:"模仿样片的画面风格，调整您照片的色彩色调", price: 0, cost: 0.01, url: "/simulateColorTone", demos: ["simulateColorTone_in.jpg", "simulateColorTone_out.jpg"], icon: "mdi:palette" },
  { code: "decoratePhoto", name: "美颜美型", shortName: "美颜", hint:"各种美白、磨皮、瘦脸、大眼等美颜功能", price: 0, cost: 0, url: "/decoratePhoto", demos: ["decoratePhoto_in.jpg", "decoratePhoto_out.jpg"], icon: "mdi:face-man-shimmer" },
  { code: "changeBCS", name: "明暗对比", shortName: "调光", hint:"调整照片的明暗度、对比度、锐度、色温", price: 0, cost: 0.1, url: "/changeBCS", demos: ["changeBCS_in.jpg", "changeBCS_out.jpg"], icon: "heroicons:sun" },
  { code: "changeExpression", name: "修复调整面部表情", midName:"调整表情", shortName: "表情", hint:"修复或调整人物面部表情", price: 2, cost: 0.1, url: "/changeExpression", demos: ["changeExpression_in.jpg", "changeExpression_out.jpg"], icon: "heroicons:face-frown" },

  { code: "photo2cartoon", name: "吉卜力画风转换", midName:"漫画风格", shortName: "漫画", hint:"把您的照片转换成预设的风格，比如吉卜力漫画、日漫、港漫、铅笔画等", price: 2, url: "/photo2cartoon", demos: ["photo2cartoon_in.jpg", "photo2cartoon_out.jpg"], icon: "ri:brush-line" },
  { code: "video2cartoon", resultType: "VIDEO", name: "视频动漫", price: 2, url: "/video2cartoon", demos: ["video2cartoon_in.mp4", "video2cartoon_out.mp4"], poster:"video2cartoon.jpg", icon: "heroicons:film" },

  { code: "voiceTranslate", resultType: "VOICE", name: "语音变换语言", price: 1, url: "/voiceTranslate", demos: ["voiceTranslate_in.jpg", "voiceTranslate_out.jpg"], icon: "heroicons:language" },
  { code: "videoRetalk", resultType: "VIDEO", name: "视频配音对口型", hint:"让视频中的人物按照你提供的配音说话，并且保持唇形同步", price: 10, cost: 0.25, url: "/videoRetalk", demos: ["videoRetalk_in.mp4", "videoRetalk_out.mp4"], poster:"videoRetalk.jpg", icon: "heroicons:speaker-wave" },

  { code: "hairDesign", name: "发型匹配", price: 4, cost: 1, url: "/hairDesign", demos: ["hairDesign_in.jpg", "hairDesign_out.jpg"], icon: "heroicons:scissors" },
  { code: "personalDesign", name: "个人形象匹配设计", shortName: "形象匹配", price: 4, cost: 1, url: "/personalDesign", demos: ["personalDesign_in.jpg", "personalDesign_out.jpg"], icon: "mdi:account-tie-hat" },

  { code: "faceswapVideo", resultType: "VIDEO", name: "视频换脸", price: 4, cost: 1, url: "/faceswapVideo", demos: ["faceswapVideo_in.mp4", "faceswapVideo_out.mp4"], poster:"faceswapVideo.jpg", icon: "mdi:account-sync" },
  { code: "faceswap", name: "照片换脸", shortName: "换脸", hint:"支持原始照片中有多个人物，可以选择换脸目标人物", price: 4, cost: 1, url: "/faceswap", demos: ["faceswap_in.jpg", "faceswap_out.jpg"], icon: "mdi:face-recognition" },
  { code: "zoomInVideo", resultType: "VIDEO", name: "视频高清放大", shortName:"高清放大", hint:"把模糊的视频放大成高清视频", price: 10, cost: 0.4, url: "/zoomInVideo", demos: ["zoomInVideo_in.mp4", "zoomInVideo_out.mp4"], poster:"zoomInVideo.jpg", icon: "heroicons:magnifying-glass-plus" },
  { code: "zoomIn", name: "无损放大", shortName: "放大", hint:"把照片放大尺寸，同时保持或增加画面分辨率。", price: 1, cost: 0.3, url: "/zoomIn", demos: ["zoomIn_in.jpg", "zoomIn_out.jpg"], icon: "heroicons:magnifying-glass-plus" },
  { code: "repairImage", name: "修复照片", shortName: "修复", hint:"修复照片上的瑕疵、褶皱、破损等", price: 1, cost: 0.3, url: "/repairImage", demos: ["repairImage_in.jpg", "repairImage_out.jpg"], icon: "mdi:wrench-outline" },    
  { code: "videoMixAudio", resultType: "VIDEO", name: "配音配乐", hint:"把音频素材和视频合并", price: 0, cost: 0.01, url: "/videoMixAudio", demos: ["videoMixAudio_in.mp4", "videoMixAudio_out.mp4"], icon: "heroicons:speaker-wave" },
  { code: "videoMixAIAudio", resultType: "VIDEO", name: "智能音效", hint:"AI根据视频画面自动生成合适的声音和音效", price: 1, cost: 0.01, url: "/videoMixAIAudio", demos: ["videoMixAIAudio_in.mp4", "videoMixAIAudio_out.mp4"], icon: "heroicons:speaker-x-mark" },
  { code: "videoConcat", resultType: "VIDEO", name: "视频裁剪拼接", price: 0, cost: 0.01, url: "/videoConcat", demos: ["videoConcat_in.mp4", "videoConcat_out.mp4"], icon: "heroicons:queue-list" },
  { code: "videoTranslate", resultType: "VIDEO", name: "视频翻译", hint:"把视频中人物说的话翻译成另外一种语言说出来，并且保持嘴唇同步", price: 10, cost: 0.3, maxWorkers: 1, url: "/videoTranslate", demos: ["videoTranslate_in.mp4", "videoTranslate_out.mp4"], poster:"videoTranslate.jpg", icon: "heroicons:language" },

  { code: "videoTrim", resultType: "VIDEO", name: "视频裁剪", price: 0, cost: 0.01, url: "/videoConcat", demos: ["videoConcat_in.mp4", "videoConcat_out.mp4"], icon: "heroicons:clock" },
  { code: "audioTrim", resultType: "VOICE", name: "音频裁剪", price: 0, cost: 0.01, url: "/videoConcat", demos: ["videoConcat_in.mp4", "videoConcat_out.mp4"], icon: "heroicons:clock" },

  { code: "adInHand", name: "产品使用展示", hint:"用AI让真人模特使用您的产品", price: 8, url: "/adInHand", demos: ["adInHand_in.jpg", "adInHand_out.jpg"], icon: "mdi:account-eye-outline" },    
  { code: "adInpaint", name: "产品摆放展示", hint:"把产品摆放到任意场景", price: 10, url: "/adInpaint", demos: ["adInpaint_in.jpg", "adInpaint_out.jpg"], icon: "heroicons:shopping-bag" },
  { code: "adCloth", name: "服装试穿展示", hint:"把提供的服装穿到任意模特身上", price: 40, cost: 3.2, url: "/adCloth", demos: ["adCloth_in.jpg", "adCloth_out.jpg"], icon: "mdi:tshirt-crew" },
  { code: "changeLanguage", name: "图文翻译重绘", midName:"图文翻译", shortName:"翻译", hint:"翻译海报或设计图上的文字，并参考原图自动进行合理的排版", price: 10, cost: 3.2, url: "/changeLanguage", demos: ["changeLanguage_in.jpg", "changeLanguage_out.jpg"], icon: "mdi:google-translate" },    
];

// default
export const defaultTools:any[] = AIFuncs; // deleteAIFuncByCodes(["lora", "runPromptApp"]);



// videoTools
export const videoTools:any[] = [
    getAIFuncByCode("createVideo"),
    getAIFuncByCode("sadTalker"),    
    getAIFuncByCode("portraitVideo"),    
    getAIFuncByCode("videoMimic"),    
    getAIFuncByCode("videoTranslate"),        

    getAIFuncByCode("video2cartoon"),        
    getAIFuncByCode("videoRetalk"),
    getAIFuncByCode("faceswapVideo"),
    getAIFuncByCode("zoomInVideo"),
    getAIFuncByCode("videoConcat"),        
    getAIFuncByCode("videoMatting"),

    getAIFuncByCode("videoMixAudio"),
    getAIFuncByCode("videoMixAIAudio"),        
];

export const createVideoTools:any[] = [
    getAIFuncByCode("createVideo"),
    getAIFuncByCode("sadTalker"),    
    getAIFuncByCode("portraitVideo"),    
    getAIFuncByCode("videoMimic"),    
];    
export const editVideoTools:any[] = [
    getAIFuncByCode("videoRetalk"),
    getAIFuncByCode("videoTranslate"),   
    getAIFuncByCode("faceswapVideo"),
    getAIFuncByCode("zoomInVideo"),
    getAIFuncByCode("video2cartoon"),        
    getAIFuncByCode("videoConcat"),        
    getAIFuncByCode("videoMatting"),
    getAIFuncByCode("videoMixAudio"),
    getAIFuncByCode("videoMixAIAudio"),  
];    


// audioTools
export const audioTools:any[] = [
    getAIFuncByCode("createVoice"),    
    getAIFuncByCode("simVoice"),    
    getAIFuncByCode("createSpeaker"),    
    getAIFuncByCode("createSong"),    
    getAIFuncByCode("createMusic"),    
//    getAIFuncByCode("voiceTranslate"),    

];

// aixiezhen工具
export const aiTools:any[] = [
//    getAIFuncByCode("superCamera"),    
    getAIFuncByCode("faceswap"),
    getAIFuncByCode("changePerson"),
    getAIFuncByCode("outpaint"),
    getAIFuncByCode("recolorImage"),
    getAIFuncByCode("removeBG"),

    getAIFuncByCode("inpaintGemini"),    
    getAIFuncByCode("changeBG"),
    getAIFuncByCode("changeHair"),
    getAIFuncByCode("changeExpression"),    
    getAIFuncByCode("changeCloth"),    
    getAIFuncByCode("inpaint"),    

    getAIFuncByCode("removeObject"),      
    getAIFuncByCode("changeStyle"),
    getAIFuncByCode("changeBCS"),
    getAIFuncByCode("simulateColorTone"),
    getAIFuncByCode("photo2cartoon"),
    
    getAIFuncByCode("decoratePhoto"),
//    getAIFuncByCode("simImage"),
    getAIFuncByCode("zoomIn"),
    getAIFuncByCode("editImage"),
     getAIFuncByCode("draftFree"),
    
  //  getAIFuncByCode("face2Photo"),
  //  getAIFuncByCode("takeIDPhoto"),
  
];


export const imageTools:any[] = [
//    getAIFuncByCode("superCamera"),    
    getAIFuncByCode("createPrompt"), 
    getAIFuncByCode("inpaint"),   

    getAIFuncByCode("faceswap"),
//    getAIFuncByCode("inpaintGemini"),    
//    getAIFuncByCode("inpaintGPT"),    
    getAIFuncByCode("changeBG"),
    getAIFuncByCode("changeExpression"),    
    getAIFuncByCode("zoomIn"),
    getAIFuncByCode("hairDesign"),
   
    getAIFuncByCode("removeObject"),      
    getAIFuncByCode("changePerson"),
    getAIFuncByCode("outpaint"),
    getAIFuncByCode("recolorImage"),
    getAIFuncByCode("removeBG"),

    getAIFuncByCode("changeHair"),
    getAIFuncByCode("changeCloth"),    

    getAIFuncByCode("changeStyle"),
    getAIFuncByCode("changeBCS"),
    getAIFuncByCode("simulateColorTone"),
    getAIFuncByCode("photo2cartoon"),

    getAIFuncByCode("decoratePhoto"),
//    getAIFuncByCode("simImage"),
    getAIFuncByCode("editImage"),
    getAIFuncByCode("controlImage"),

     getAIFuncByCode("deco"),
     getAIFuncByCode("garden"),
     getAIFuncByCode("draft"),

     getAIFuncByCode("adInpaint"),
     getAIFuncByCode("adCloth"),

    
  //  getAIFuncByCode("face2Photo"),
  //  getAIFuncByCode("takeIDPhoto"),
  
];

// aixiezhen工具
export const indexTools:any[] = [
    getAIFuncByCode("createPrompt"), 
    getAIFuncByCode("inpaint"),    
    getAIFuncByCode("faceswap"),    
    getAIFuncByCode("changeBG"),
    getAIFuncByCode("photo2cartoon"),    
    getAIFuncByCode("changeExpression"),    

    getAIFuncByCode("adInHand"),    
    getAIFuncByCode("changeLanguage"),    
    getAIFuncByCode("changeCloth"),
    getAIFuncByCode("outpaint"),    
    getAIFuncByCode("recolorImage"),
    getAIFuncByCode("removeBG"),
    
    getAIFuncByCode("changeHair"),    
    getAIFuncByCode("createSong"),        
    getAIFuncByCode("createSpeaker"),
    getAIFuncByCode("superCamera"), 
    getAIFuncByCode("takePhoto"),    
    getAIFuncByCode("takeGroupPhoto"),
];

export const highTools:any[] = [
    getAIFuncByCode("faceswapVideo"),
    getAIFuncByCode("portraitVideo"),    
    getAIFuncByCode("videoMimic"),    
    getAIFuncByCode("videoTranslate"),        
    getAIFuncByCode("sadTalker"),
    getAIFuncByCode("video2cartoon"),        
    getAIFuncByCode("videoRetalk"),
    getAIFuncByCode("zoomInVideo"),
];

export const imageDetailTools:any[] = [
    getAIFuncByCode("inpaint"),   
    getAIFuncByCode("removeObject"),      
    getAIFuncByCode("outpaint"),
    getAIFuncByCode("zoomIn"),
    getAIFuncByCode("removeBG"),
    getAIFuncByCode("faceswap"),
    getAIFuncByCode("decoratePhoto"),
    getAIFuncByCode("changeExpression"),    
    getAIFuncByCode("changePerson"),    
    getAIFuncByCode("changeHair"),
    getAIFuncByCode("changeCloth"),    
    getAIFuncByCode("changeBG"),
    getAIFuncByCode("photo2cartoon"),
    getAIFuncByCode("changeStyle"),
    getAIFuncByCode("repairImage"),    
    getAIFuncByCode("recolorImage"),
    getAIFuncByCode("changeBCS"),
    getAIFuncByCode("simulateColorTone"),
    getAIFuncByCode("changeLanguage"),
    getAIFuncByCode("editImage"),
    getAIFuncByCode("cropImage"),

    getAIFuncByCode("takeGroupPhoto"),
    getAIFuncByCode("createVideo"),
    getAIFuncByCode("sadTalker"),
    getAIFuncByCode("videoMimic"),
    getAIFuncByCode("portraitVideo"),
    
];



////////////////////////////////////////////////////////////////////////////////////////////////////
// 工具条
////////////////////////////////////////////////////////////////////////////////////////////////////

export const editTools:any[] = [
    getAIFuncByCode("inpaint"),   
    getAIFuncByCode("removeObject"),      
    getAIFuncByCode("outpaint"),
    getAIFuncByCode("zoomIn"),
    getAIFuncByCode("removeBG"),
    getAIFuncByCode("faceswap"),
    getAIFuncByCode("decoratePhoto"),
    getAIFuncByCode("changeExpression"),    
    getAIFuncByCode("changePerson"),    
    getAIFuncByCode("changeHair"),
    getAIFuncByCode("changeCloth"),    
    getAIFuncByCode("changeBG"),
    getAIFuncByCode("photo2cartoon"),
    getAIFuncByCode("changeStyle"),
    getAIFuncByCode("repairImage"),    
    getAIFuncByCode("recolorImage"),
    getAIFuncByCode("changeBCS"),
    getAIFuncByCode("simulateColorTone"),
   
    getAIFuncByCode("changeLanguage"),
    
//    getAIFuncByCode("autoCaption"),
    getAIFuncByCode("editImage"),
    getAIFuncByCode("cropImage"),    
];

export const createImageTools:any[] = [
    getAIFuncByCode("createPrompt"),   
  { code: "lora_COMIC", name: "动漫次元", hint:"各种主题画风的动画、漫画、二次元画面模型，精确还原画风", price: 5, cost: 2, url: "/lora?channel=COMIC&modelSelect=TRUE", icon: "heroicons:sparkles" },
  { code: "lora_DRAW", name: "西方艺术", hint:"西方艺术风格模型，精准复现油画、雕塑、建筑等艺术风格", price: 5, cost: 2, url: "/lora?channel=DRAW&modelSelect=TRUE", icon: "heroicons:paint-brush" },
  { code: "lora_ART", name: "东方美学", hint:"东方美学模型，表现国画、刺绣、剪纸、陶瓷等非遗艺术内容", price: 5, cost: 2, url: "/lora?channel=ART&modelSelect=TRUE", icon: "heroicons:academic-cap" },
  { code: "lora_FASHION", name: "数字人物", hint:"用同一人物图片训练的专属人物模型，精确保持人物的一致性。结合视频模型和语音模型，可以生成数字人物的完美视频", price: 5, cost: 2, url: "/lora?channel=FASHION&modelSelect=TRUE", icon: "heroicons:user-circle" },    
    getAIFuncByCode("createPoster"),    
    getAIFuncByCode("controlImage"),
    getAIFuncByCode("simStyle"),    
];

export const portraitTools:any[] = [
    getAIFuncByCode("superCamera"), 
    getAIFuncByCode("takePhoto"),    
    getAIFuncByCode("takeIDPhoto"),
    getAIFuncByCode("takeGroupPhoto"),
    getAIFuncByCode("stylePortrait"),
    getAIFuncByCode("poseAndFace"), 
];

const ecChangePerson =  JSON.parse(JSON.stringify(getAIFuncByCode("changePerson")));
ecChangePerson.name = "产品图换模特";    
const ecChangeBG =  JSON.parse(JSON.stringify(getAIFuncByCode("changeBG")));
ecChangeBG.name = "产品换背景";    
export const ecTools:any[] = [
    getAIFuncByCode("adInHand"), 
    getAIFuncByCode("adInpaint"), 
    getAIFuncByCode("adCloth"),   
    getAIFuncByCode("changeLanguage"),
    ecChangePerson,
    ecChangeBG,
    getAIFuncByCode("createPoster"),    
];

export const archTools:any[] = [
     getAIFuncByCode("deco"),
     getAIFuncByCode("garden"),
     getAIFuncByCode("draft"),   
];

// cameraList
export const cameraList:any[] = [
    getAIFuncByCode("superCamera"), 
    getAIFuncByCode("takePhoto"),    
    getAIFuncByCode("takeIDPhoto"),
    getAIFuncByCode("takeGroupPhoto"),
    getAIFuncByCode("stylePortrait"),
    getAIFuncByCode("poseAndFace"), 
];

const personalChangeHair =  JSON.parse(JSON.stringify(getAIFuncByCode("changeHair")));
personalChangeHair.shortName = "发型设计";    
const personalChangeCloth =  JSON.parse(JSON.stringify(getAIFuncByCode("changeCloth")));
personalChangeCloth.shortName = "服装搭配";    
const personalTakeIDPhoto =  JSON.parse(JSON.stringify(getAIFuncByCode("takeIDPhoto")));
personalTakeIDPhoto.shortName = "证件照片";    
const personalSuperCamera =  JSON.parse(JSON.stringify(getAIFuncByCode("superCamera")));
personalSuperCamera.shortName = "职业形象照";   
export const personalTools:any[] = [
    getAIFuncByCode("hairDesign"),
    personalChangeHair,
    getAIFuncByCode("personalDesign"),
    personalChangeCloth,
    personalTakeIDPhoto,
    personalSuperCamera    
];



export const toolBars = new Map([
    ["createImageTools", {tools: createImageTools, title:"创作工具", barText:"shortName"}],
    ["editTools", {tools: editTools, title:"编辑工具", barText:"shortName"}],
    ["portraitTools", {tools: portraitTools, title:"人物写真", barText:"shortName"}],
    ["personalTools", {tools: personalTools, title:"形象中心", barText:"shortName"}],
    ["ecTools", {tools: ecTools, title:"电商工具", barText:"name"}],
    ["archTools", {tools: archTools, title:"建筑装修", barText:"shortName"}],
    
    ["createVideoTools", {tools: createVideoTools, title:"视频创作", barText:"shortName"}],
    ["editVideoTools", {tools: editVideoTools, title:"视频编辑", barText:"shortName"}],
    ["audioTools", {tools: audioTools, title:"音频创作", barText:"shortName"}]    
]);


export function inTools(code: string, tools: any[]) {
    for (const t of tools) {
        if (code === t.code || code === t.url) {
            return t;
        }
    }
    return null; // 明确无匹配时返回 null
}


export function getToolBar(url: string, code?: string | null) {
    debug.log(`url: ${url}, code: ${code}`);
    let result:any = null;
    
    const currentURL = new URL(url, "https://www.niukti.com");
    const path = currentURL.pathname;
    const params = new URLSearchParams(currentURL.search);
    const channel = params.get("channel");

    const normalizedPath = path === "/lora"
        ? `${path}?channel=${channel}&modelSelect=TRUE`
        : path;

    debug.log(`normalizedPath: ${normalizedPath}`);

    // 如果 code 有效，则仅查找对应的 toolbar
    if (code && toolBars.has(code)) {
        const entry = toolBars.get(code)!;
        const currentTool = inTools(normalizedPath, entry.tools);
        if (currentTool) {
            result = { ...entry, currentTool };
            debug.log("result (from code):", JSON.stringify(result));
            return result;
        } else {
            debug.log("result: null (code matched, but no tool found)");
            return null;
        }
    }

    // 否则遍历所有 toolbar 查找匹配的 tool
    toolBars.forEach((entry, key) => {
        if (result) return; // 已找到，跳过
        const currentTool = inTools(normalizedPath, entry.tools);
        if (currentTool) {
            result = { ...entry, currentTool };
        }
    });

    if(!result){
        debug.log("result: null");
    }
    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////



export const privateTools:any[] = [
    getAIFuncByCode("runPromptApp"),    
   { code: "createLoRA", name: "制作虚拟分身", price: 199, url: "/createLoRA?title=虚拟分身&channel=FASHION", demos:["model_in.jpg", "model_out.jpg"] },    
];

export const aixiezhenTools = imageTools.concat(videoTools).concat(cameraList).concat(privateTools);
