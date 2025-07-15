import React from "react";
import { Icon } from '@iconify/react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tip?: string;
    tipPlace?: string;
    tipOffset?: number;
    icon?: string;
};

export default function Button({
    tip,
    tipPlace,
    tipOffset,
    icon,
    children,
    ...props
}: ButtonProps) {
    
    return (
        <button
            {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            data-tooltip-id={tip ? "default-tooltip-id" : undefined}
            data-tooltip-content={tip}
            data-tooltip-place={tipPlace as any}
            data-tooltip-offset={tipOffset}
            >
            {icon && (
                <Icon 
                    icon={icon}
                    className="w-5 h-5 text-gray-400 text-xs hover:text-red-500 transition-colors" 
                    /> 
            )}
            {children}
      </button>
    );

}
