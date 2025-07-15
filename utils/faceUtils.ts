import * as debug from "./debug";
/*
import * as faceapi from 'face-api.js';

let faceDetectFrontModelsLoaded = false;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 前台人脸识别的函数

// 加载模型
async function loadFrontModels(website:string) {
    const MODEL_URL = `${website}/weights`; // 模型存储的位置，根据您具体放置的位置调整
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    faceDetectFrontModelsLoaded = true;
}

export async function detectFacesInFrontEnd(input: HTMLImageElement) {
    if(!faceDetectFrontModelsLoaded){
        await loadFrontModels("https://debug.aiputi.cn");
    }
    const detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions());
    alert(JSON.stringify(detections));

    return detections;
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 服务器端人脸识别的函数
*/
