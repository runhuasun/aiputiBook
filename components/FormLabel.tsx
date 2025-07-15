import { Icon } from '@iconify/react';
import { Tooltip } from 'react-tooltip';
import Button from "./wrapper/Button";

// godd green: "#34d399" 
// gold: #E8BE44
export default function FormLabel({ label, number, hint, onCancel, blink,
                                   isChecker=false, initValue=false, onValueChange }: 
                                  { label:string, number?:string, hint?:string, onCancel?: any, blink?:boolean,
                                   isChecker?:boolean, initValue?:any, onValueChange?:(value:any)=>void}) {
    return (
        <div className="flex flex-row items-center space-x-1 text-sm mt-3 text-gray-300">
            {number && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                width="25"
                height="25"
                x="0"
                y="0"
                viewBox="0 0 512 512"
                xmlSpace="preserve"
              >
                <circle cx="256" cy="256" r="240" fill="transparent" /> {/* 改为透明 */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="350"
                  fontFamily="Arial"
                  fontWeight="bold"
                  fill="#71F71E"
                >
                  {`${number}.`}
                </text>
              </svg>
            )}

          
            <p className={`${number ? " " : " pl-10 "} ${blink ? "blink" : ""} text-left font-medium`}>
                {label}
            </p>

            {hint && (
                <Button onClick={() => alert(hint) } 
                  tip={hint}  tipPlace={"top"}  tipOffset={5}
//                  title="帮助和提示信息"
                  >
                  <Icon 
                    icon={"mdi:help-circle"} 
                    className="w-5 h-5 text-gray-400 text-xs hover:text-red-500 transition-colors"                
                    />
                </Button>                                  
            )}
            
            {isChecker && (
            <input type="checkbox"
                checked={initValue}
                onChange={() => {
                    const newValue = !initValue; 
                    if(typeof onValueChange == "function"){
                        onValueChange(newValue);
                    }
                }}
                className="form-checkbox"
                />
            )}
            
            {onCancel && (
            <Button onClick={() => onCancel() } 
              tip={`取消当前选择的内容`} tipPlace={"top"}  tipOffset={5}
              >
              <Icon 
                icon={"mdi:close-circle"} 
                className="w-5 h-5 text-gray-400 text-xs hover:text-red-500 transition-colors" 
                /> 
            </Button>                                  
            )}

        </div>
    );   
}

            {/*
            暗绿色
            2B7042
                    icon={"mdi:help"} 
                icon={"mdi:close"} 

            亮绿色
            3C9E5D
            )*/}
