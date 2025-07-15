import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import Link from "next/link";
import { Icon } from '@iconify/react';

import Image from "./wrapper/Image";
import Pagination from '../components/Pagination';
import { showModel, showPrompt } from "../components/Genhis";
import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import axios from "axios";
import {base64ToFile, uploadToFS} from "../utils/fileUtils";


interface FileSelectorProps {
    title: string;
    showIcon?: boolean;
    showTitle?: boolean;
    fileType?: string;
    isOpened?: boolean;
    className?: string;
    onSelect: (file: { url: string; width: number; height: number }) => void;    
    onCancel?: () => void; 
    autoCapture?: boolean;
}



export default function CameraCapture({ 
    title = "拍照", 
    showIcon = false,
    showTitle = true,
    fileType = "IMAGE", 
    autoCapture,
    className = "w-full h-auto border border-gray-600 border-dashed px-2 py-4 text-center flex flex-row space-x-1 items-center justify-center",
    onSelect, 
    onCancel, 
    isOpened 
}: FileSelectorProps) {
    const [isOpen, setIsOpen] = useState(isOpened || false);
    const [aspectRatio, setAspectRatio] = useState(16 / 9);
    const [selectedFile, setSelectedFile] = useState<any>();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [count, setCount] = useState(5);
    const streamRef = useRef<MediaStream>();

    const setupCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 16/9 }
                } 
            });
            streamRef.current = stream;

            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            const newAspect = settings.width! / settings.height!;
            setAspectRatio(newAspect);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await new Promise(resolve => {
                    if (videoRef.current) {
                        videoRef.current.onloadedmetadata = resolve;
                    }
                });
            }
        } catch (error) {
            console.error('Camera error:', error);
            alert("无法访问摄像头，请检查权限设置");
            close();
        }
    };

    const open = () => {
        setIsOpen(true);
        setCount(5);
        setupCamera();
        setSelectedFile(undefined);
    };

    const close = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = undefined;
        }
        setIsOpen(false);
    };

    const capturePhoto = async () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const imageFile = base64ToFile(dataUrl, `capture_${Date.now()}.jpg`);
        
        try {
            const uf = await uploadToFS(imageFile, "U");
            const result = { id:uf.id, url:uf.url, width: canvas.width, height: canvas.height };
            setSelectedFile(result);
            onSelect(result);
        } catch (error) {
            console.error('Upload error:', error);
            alert('照片上传失败');
        }
        close();
    };

    useEffect(() => {
        if (autoCapture && isOpen) {
            const timer = setInterval(() => {
                setCount(prev => {
                    if (prev <= 1) {
                        if(isOpen){
                            clearInterval(timer);
                            capturePhoto();
                            return 0;
                        }
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, autoCapture]);

    return (
        <div className="w-full h-3/4-screen">
            <button className={className} onClick={open}>
                {showIcon && (
                    <Icon icon="mdi:camera-iris" className="w-5 h-5 text-inherit text-xs"/>
                )}
                {showTitle && (
                <span>{title}</span>
                )}
            </button>
            <Transition appear show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={close}>
                    <div className="fixed inset-0 bg-black/30 backdrop-blur">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-4xl rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                                    <Dialog.Title className="text-xl font-semibold text-white mb-4">
                                        {title}
                                    </Dialog.Title>

                                    <div className="relative" style={{ paddingTop: `${(1 / aspectRatio) * 100}%` }}>
                                        <video
                                            ref={videoRef}
                                            className="absolute inset-0 w-full h-full object-contain"
                                            autoPlay
                                            playsInline
                                        />
                                        {autoCapture && (
                                        <div className="absolute inset-0 flex items-center justify-center text-9xl text-white z-20">
                                            {count}
                                        </div>
                                        )}                                        
                                    </div>

                                    {selectedFile && (
                                        <div className="relative mt-4" style={{ paddingTop: `${(1 / aspectRatio) * 100}%` }}>
                                            <Image
                                                src={selectedFile.url}
                                                alt="拍摄结果"
                                                className="absolute inset-0 w-full h-full object-contain"
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-6 flex justify-center space-x-4">
                                        <button
                                            className="px-6 py-2 button-gold"
                                            onClick={async ()=>{
                                                await capturePhoto();
                                            }}
                                        >
                                            拍摄
                                        </button>
                                        <button
                                            className="px-6 py-2 button-main"
                                            onClick={close}
                                        >
                                            取消
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}
