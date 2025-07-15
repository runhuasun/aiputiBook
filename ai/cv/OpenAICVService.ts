import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {BaseCVService} from "./BaseCVService";

export class OpenAICVService extends BaseCVService{
    public modelName: string = "DALLE";
    public predicturl: string = process.env.OPENAI_API_PROXY! + "?CMD=text2img";
    public authstr = "Bearer " + process.env.OPENAI_API_KEY!;    
    
    constructor(baseModel:string){
        super();
    }
    
    public async predict(input:any){
        return;
    }

    public async getPredictResult(predictId:string){
        return;
    }    
}
