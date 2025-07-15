import {log, warn, error} from "../../utils/debug";

export abstract class BaseCVService{
    public abstract modelName: string;
    public abstract predicturl: string;
    
    constructor(){}
    
    public abstract predict(input:any):any;
    public abstract getPredictResult(id:string):any;

}

