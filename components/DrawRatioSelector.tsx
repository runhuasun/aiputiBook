import { useEffect, useState, useRef } from "react";
import DropDown from "../components/DropDown";

export type DrawRatioType = 
    "916" |
    "169" |
    "11"  |
    "43"  |
    "34"  |
    "114" ;

const defaultDrawRatioNames = new Map([
    ["916", "9:16 （手机竖屏）"],
    ["169", "16:9 （电视/Pad横屏）"],
    ["11", "1:1 （适合产品图）"],
    ["43", "4:3 （标准横版照片）"],
    ["34", "3:4 （标准竖版照片）"],
    ["114", "1:1.4 （标准证件照）"]    
]);    
const defaultDrawRatios: string[] = Array.from(defaultDrawRatioNames.keys());

const videoRatioNames = new Map([
    ["916", "9:16 （手机竖屏）"],
    ["169", "16:9 （电视/Pad横屏）"],
]);    
const videoRatios: string[] = Array.from(videoRatioNames.keys());

const posterRatioNames = new Map([
    ["916", "9:16 （手机竖屏）"],
    ["169", "16:9 （电视/Pad横屏）"],
]);    
const posterRatios: string[] = Array.from(posterRatioNames.keys());

interface DrawRatioProps {
    onSelect: (ratio: any) => void;
    defaultRatio?: string;
    type?: string;
}

export default function DrawRatioSelector({ onSelect, defaultRatio="916", type="DEFAULT" }: DrawRatioProps) {
    const [drawRatio, setDrawRatio] = useState<any>(defaultRatio);
    const [drawRatioNames, setDrawRatioNames] = useState<any>(defaultDrawRatioNames);
    const [drawRatios, setDrawRatios] = useState<any>(defaultDrawRatios);

    useEffect(() => {
        switch(type){
            case "VIDEO":
                setDrawRatioNames(videoRatioNames);
                setDrawRatios(videoRatios);
                break;
            case "POSTER":
                setDrawRatioNames(posterRatioNames);
                setDrawRatios(posterRatios);
                break;                
        }        
    }, [type]); 
    
    return (
        <div className="w-full">
            <DropDown
                theme={drawRatio}
                setTheme={(newRoom) => onSelect(newRoom)}
                themes={drawRatios}
                names={drawRatioNames}
                />       
        </div>             
    );
}

export function getWidthOfDrawRatio(ratio:string){
    switch(ratio){
        case "916": return 576;
        case "34": return 768;
        case "114": return 736;
            
        case "11":
        case "43":
        case "169": return 1024;
        default: return 1024;
    }
}

export function getHeightOfDrawRatio(ratio:string){
    switch(ratio){
        case "916":
        case "34":
        case "114":
        case "11": return 1024;
            
        case "43": return 768;
        case "169": return 576;
        default: return 1024;
    }
}

export function getSizeOfDrawRatio(ratio:string){
    return {
        width: getWidthOfDrawRatio(ratio),
        height: getHeightOfDrawRatio(ratio)
    }
}













