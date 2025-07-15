import React, { useState, useEffect, useCallback } from 'react';

import Image from "./wrapper/Image";

import { Icon } from '@iconify/react';
import * as fu from "../utils/fileUtils";


interface InputImageProps {
    src: string | null | undefined;
    alt?: string;
    className?: string;
    recognizing?: boolean;
    maxSize?: {width?:number; height?:number; mb?:number};
}

export default function InputImage({ src, alt, className, recognizing, maxSize }: InputImageProps) {
    const [showModal, setShowModal] = useState(false);

    alt = alt || "图片";
    className = `${className || "rounded-2xl relative sm:mt-0 mt-2 w-auto max-h-60"} `;

    const closeModal = useCallback(() => setShowModal(false), []);

    // ESC 键关闭
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        if (showModal) {
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showModal, closeModal]);

    
    useEffect(() => {
        if(src && maxSize){
            fu.checkImageConstraint(src, maxSize, true);
        }
    }, [src]);

    
    if (!src) return null;

    return (
        <>
            <div className="w-full flex flex-col items-center relative">
                <Image
                    alt={alt}
                    src={src}
                    className={className}
                    onClick={() => setShowModal(true)}
                    useAcc={false}
                    width={576}
                />
                {recognizing && (
                    <div className="absolute bottom-2 bg-green bg-opacity-60 text-white text-sm px-3 py-1 rounded">
                        正在识别人物...
                    </div>
                )}
            </div>

            {showModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center animate-fade-in"
                    onClick={closeModal}
                >
                    <div
                        className="relative max-w-full max-h-full p-4 animate-zoom-in"
                        onClick={(e) => e.stopPropagation()} // 阻止点击图片本身关闭模态
                    >
                        <Image
                            alt={alt}
                            src={src}
                            className="rounded-lg object-contain max-h-[90vh] max-w-[90vw]"
                        />
                        <button
                            className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-80 transition"
                            onClick={closeModal}
                            aria-label="关闭"
                        >
                            <Icon icon="mdi:close" width={24} height={24} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
