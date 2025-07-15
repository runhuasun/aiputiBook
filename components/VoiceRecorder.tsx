import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Icon } from '@iconify/react';

import {config} from "../utils/config";
import {uploadToFS} from "../utils/fileUtils";

interface VoiceRecorderProps {
  title: string;
  showIcon?: boolean;
  showTitle?: boolean;
  fileType?: string;
  isOpened?: boolean;
  className?: string;
  onSelect: (file: any) => void;
  onCancel?: () => void;
  autoCapture?: boolean;
  maxTime?: number; // 最大录音时长（秒）
}


export default function VoiceRecorder({
  title = "录音",
  showIcon = false,
  showTitle = true,
  fileType = "AUDIO",
  autoCapture,
  className = "w-full h-auto border border-gray-600 border-dashed px-2 py-4 text-center flex flex-row space-x-1 items-center justify-center",
  onSelect,
  onCancel,
  isOpened,
  maxTime = 600, // 默认10分钟
}: VoiceRecorderProps) {
  const [isOpen, setIsOpen] = useState(isOpened || false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); // 是否正在保存
  const [recordTime, setRecordTime] = useState(0); // 录音时长（秒）
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null); // 录音计时器
  const [ffmpeg, setFfmpeg] = useState<any>(null);

  useEffect(() => {
      // 仅在客户端加载 FFmpeg
      if (typeof window !== 'undefined') {
          const loadFFmpeg = async () => {
              const { FFmpeg } = await import('@ffmpeg/ffmpeg');
              const instance = new FFmpeg();
              await instance.load({
                  coreURL: config.RS + "/lib/ffmpeg/ffmpeg-core.js",
                  wasmURL: config.RS + "/lib/ffmpeg/ffmpeg-core.wasm"
              });
              setFfmpeg(instance);
          };
          loadFFmpeg();
      }
  }, []);  
  
  // 打开录音界面
  function open() {
    setIsOpen(true);
  }

  // 关闭录音界面
  function close() {
    setIsOpen(false);
    stopRecording();
  }

  // 开始录音
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);

      // 开始绘制波形
      drawWaveform();

      // 开始计时
      setRecordTime(0);
      timerRef.current = setInterval(() => {
        setRecordTime((prevTime) => {
          if (prevTime >= maxTime) {
            // 超过最大时长，停止录音
            stopRecording();
            alert(`录音已超过${maxTime}秒，自动停止。`);
            return prevTime;
          }
          return prevTime + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('无法访问麦克风:', error);
      alert('无法访问麦克风，请检查权限设置。');
      close();
    }
  }

  // 停止录音
  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }

  // 绘制波形
  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 255, 0)';
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }

    
    async function convertToMP3(audioBlob: Blob): Promise<Blob> {
        // 如果 FFmpeg 未加载，则加载它
        if (!ffmpeg.loaded) {
            await ffmpeg.load();
        }
    
        // 定义输入和输出文件名
        const inputName = 'input.wav';
        const outputName = 'output.mp3';
        
        // 将音频 Blob 写入 FFmpeg 文件系统
        await ffmpeg.writeFile(inputName, await fetchFile(audioBlob));
        
        // 运行 FFmpeg 命令，将 WAV 转换为 MP3
        await ffmpeg.exec(['-i', inputName, '-b:a', '192k', outputName]);
        
        // 读取转换后的 MP3 文件
        const mp3Data = await ffmpeg.readFile(outputName);
        
        // 将 Uint8Array 转换为 Blob
        return new Blob([mp3Data], { type: 'audio/mp3' });
    }
  
    // 选择录音文件
    async function select() {
        try{
            if (audioBlob) {
                setIsSaving(true); // 开始保存
                const mp3Blob = await convertToMP3(audioBlob); // 转换为 MP3
                const mp3File = new File([mp3Blob], 'recording.mp3', { type: 'audio/mp3' });
                
                const audioURL = await uploadToFS(mp3File, "U");
                if (audioURL) {
                    onSelect(audioURL);
                }
                setIsSaving(false); // 保存完成
            }
        }catch(e){
            console.error('录音上传失败:', e);
            alert('录音上传文件服务器失败，请重试');          
        }finally{
            close();
        }
    }

    // 取消录音
    function cancel() {
        close();
        if (onCancel) {
            onCancel();
        }
    }
 
  // 格式化录音时间
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    if (isOpened) {
      open();
    }
  }, [isOpened]);

  return (
    <div className="w-full h-3/4-screen">
      <button className={className} onClick={open}>
          {showIcon && (
              <Icon icon="heroicons:microphone" className="w-5 h-5 text-inherit text-xs"/>
          )}
          {showTitle && (
          <span>{title}</span>
          )}
      </button>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10 focus:outline-none" onClose={cancel}>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                className="w-full flex justify-center"
                enter="ease-out duration-300"
                enterFrom="opacity-0 transform-[scale(95%)]"
                enterTo="opacity-100 transform-[scale(100%)]"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 transform-[scale(100%)]"
                leaveTo="opacity-0 transform-[scale(95%)]"
              >
                <Dialog.Panel className="w-full sm:w-4/5 rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                  <Dialog.Title as="h3" className="text-base/7 font-medium text-white">
                    {title}
                  </Dialog.Title>
                  <div className="mt-2 text-sm/6 text-white/50 flex flex-col items-center">
                    <canvas
                      ref={canvasRef}
                      width="800"
                      height="200"
                      className="w-full h-32 bg-black"
                    />
                    {/* 开始/停止录音按钮 */}                    
                    <button className="p-4 rounded-full bg-gray-700 mt-3"
                      onClick={isRecording ? stopRecording : startRecording} 
                      disabled={isSaving}
                      >
                      {isRecording ? (
                        <svg width="50" height="50"><rect width="50" height="50" fill="red" /></svg>
                      ) : (
                        <svg width="50" height="50"><circle cx="25" cy="25" r="20" fill="red" /></svg>
                      )}
                    </button>                    
                    <div className="mt-2 text-white">
                      {isRecording ? `正在录音中 ${formatTime(recordTime)}` : '录音已停止'}
                    </div>
                  </div>
                  <div className="mt-4 space-x-8 flex flex-row justify-center w-full">
                    {/* 确定按钮 */}
                    <button
                      className={(!audioBlob || isSaving || isRecording) ? "px-8 py-2 mt-8 button-dark" : "px-8 py-2 mt-8 button-gold"}
                      onClick={select}
                      disabled={!audioBlob || isSaving || isRecording}
                    >
                      {isSaving ? '正在保存当前音频...' : '确定'}
                    </button>
                    {/* 取消按钮 */}
                    <button
                      className="px-8 py-2 mt-8 button-main"
                      onClick={cancel}
                      disabled={isSaving}
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
