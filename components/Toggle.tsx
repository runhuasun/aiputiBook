import { Switch } from "@headlessui/react";
import Button from "./wrapper/Button";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export interface ToggleProps extends React.HTMLAttributes<HTMLDivElement> {
    sideBySide: boolean;
    setSideBySide: (sideBySide: boolean) => void;
    leftText?: string;
    rightText?: string;
    leftHint?: string;
    rightHint?: string;
}

export default function Toggle({
    sideBySide,
    setSideBySide,
    leftText="左右比较",
    rightText="叠加比较",
    leftHint,
    rightHint,
    ...props
}: ToggleProps) {
    
    return (
        <Switch.Group as="div" {...props}>
            <div className="flex items-center">
                <div className={`flex flex-row items-center space-x-1 text-sm mr-3 font-medium ${!sideBySide ? "text-white" : "text-gray-500"}`}>
                    <span>{leftText}</span>
                    {leftHint && (
                    <Button onClick={() => alert(leftHint) } className="ml-1"
                        tip={leftHint}  tipPlace={"top"}  tipOffset={5} icon={"mdi:help-circle"} 
                        />
                    )}
                </div>
                          
                <Switch
                    checked={sideBySide}
                    onChange={setSideBySide}
                    className={classNames(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                    )}
                    style={{
                        background: sideBySide ? "linear-gradient(to right, #71F71E, #43E1ED)" : "#E5E7EB" // gray-200
                            }}
                    >

                    <span
                        aria-hidden="true"
                        className={classNames(
                            sideBySide ? "translate-x-5" : "translate-x-0",
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                        )}
                        />
                </Switch>

                <Switch.Label as="span" className="ml-2 flex flex-row items-center space-x-1">
                    <span
                        className={`text-sm font-medium ${
                            sideBySide ? "text-white" : "text-gray-500"
                        } `}
                        >
                        {rightText}
                    </span>
                    {rightHint && (
                    <Button onClick={() => alert(rightHint) } className="ml-1"
                        tip={rightHint}  tipPlace={"top"}  tipOffset={5} icon={"mdi:help-circle"} 
                        />
                    )}
                </Switch.Label>
            </div>
        </Switch.Group>
    );
}
