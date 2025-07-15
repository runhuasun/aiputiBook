'use client';

import React, { useState } from 'react';
import Image from './wrapper/Image';

interface MultiStateImageProps {
    image: string;
    mouseOverImage?: string;
    mouseDownImage?: string;
    className?: string;
    alt?: string;
    onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
    onDoubleClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

export default function MultiStateImage({
    image,
    mouseOverImage,
    mouseDownImage,
    className = 'w-full flex flex-col items-center justify-center',
    alt = '图片',
    onClick,
    onDoubleClick,
}: MultiStateImageProps) {
    const [imageSrc, setImageSrc] = useState(image);

    const handleMouseDown = () => {
        if (mouseDownImage) {
            setImageSrc(mouseDownImage);
        }
    };

    const handleMouseOver = () => {
        if (mouseOverImage) {
            setImageSrc(mouseOverImage);
        }
    };

    const handleMouseUp = () => {
        setImageSrc(image);
    };

    return (
        <Image
            alt={alt}
            src={imageSrc}
            className={className}
            onClick={(e) => {
                onClick?.(e);
            }}
            onDoubleClick={(e) => {
                onDoubleClick?.(e);
            }}
            onContextMenu={(e) => {
                e.preventDefault(); // 阻止右键菜单
                return false;
            }}
            onMouseDown={handleMouseDown}
            onMouseOver={handleMouseOver}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
}
