import {log, warn, error} from "../../utils/debug";

export abstract class BaseTTS {
    public maxLength = 100;

    /////////////////////////////////////////////////
    // 语音合成
    //////////////////////////////////////////////////
    public abstract textToVoice(content:string, speaker:string):any;

    /////////////////////////////////////////////////
    // 语音识别
    ////////////////////////////////////////////////// 
    public abstract voiceToText(voiceUrl:string, format:string):any;

} // end of class


