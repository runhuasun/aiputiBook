import {log, warn, error} from "../../utils/debug";
import {config} from "../../utils/config";
import {BaseCVService} from "./BaseCVService";

export class SdapiCVService extends BaseCVService{
    public modelName: string = "";
    public predicturl: string = "https://stablediffusionapi.com/api/v3/dreambooth";

    constructor(func:string){
        super();
    }
    
    public async predict(input:any){
        return;
    }
    
    public async getPredictResult(predictId:string){
        return;
    }    
}
