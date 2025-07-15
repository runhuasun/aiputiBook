'use client';
import React, { forwardRef, useRef, useEffect, useState } from 'react';

type ClickHandler = (event?: MouseEvent | React.MouseEvent) => void;

interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  onClick?: ClickHandler;
  onDoubleClick?: ClickHandler;
  useAcc?: boolean;
  lazyHover?: boolean;
}

const Video = forwardRef<HTMLVideoElement, VideoProps>((props, ref) => {
  const {
    src,
    onClick,
    onDoubleClick,
    className = '',
    useAcc = true,
    lazyHover = false,
    poster,
    controls = false,
    autoPlay = false,
    ...rest
  } = props;

  const [hasTouchSupport, setHasTouchSupport] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazyHover);
  const [isHovered, setIsHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const ossDomains = ['aiputi.oss-cn-beijing.aliyuncs.com', 'aiputifile.oss-cn-beijing.aliyuncs.com'];

  // URL 加速处理函数
  const getAcceleratedHost = (host: string) => host.replace('oss-cn-beijing', 'oss-accelerate');
  
  const isAliOSS = (url: string) => {
    try { 
      return ossDomains.some(domain => new URL(url).host.includes(domain)); 
    } catch { 
      return false; 
    }
  };

  const getAcceleratedURL = (url: string) => {
    if (!isAliOSS(url) || !useAcc) return url;
    try { 
      const urlObj = new URL(url); 
      urlObj.host = getAcceleratedHost(urlObj.host); 
      return urlObj.toString(); 
    } catch { 
      return url; 
    }
  };

  // 初始化触摸检测和overlay显示逻辑
  useEffect(() => {
    const touchSupported = 'ontouchstart' in window || 
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 
      (navigator as any).msMaxTouchPoints > 0;
    setHasTouchSupport(touchSupported);
    setShowOverlay(touchSupported && (!!onClick || !!onDoubleClick));
    if (touchSupported && lazyHover) setShouldLoad(true);
  }, [onClick, onDoubleClick, lazyHover]);

  // 处理悬停状态变化
  useEffect(() => {
    if (isHovered && lazyHover && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [isHovered, lazyHover, shouldLoad]);

  // 视频播放控制逻辑
  useEffect(() => {
    const videoElement = internalRef.current;
    if (!videoElement || !shouldLoad) return;

    const handlePlay = async () => {
      if (userPaused) return; // 如果用户手动暂停，不自动播放
      
      if (lazyHover) {
        // lazyHover模式下，悬停时播放
        if (isHovered) {
          try {
            await videoElement.play();
          } catch (e) {
            console.error('Autoplay failed:', e);
          }
        } else {
          videoElement.pause();
        }
      } else if (autoPlay) {
        // 非lazyHover模式，autoPlay为true时播放
        try {
          await videoElement.play();
        } catch (e) {
          console.error('Autoplay failed:', e);
        }
      }
    };

    const handlePause = () => {
      if (videoElement.paused && (controls || !lazyHover)) {
        // 只有在显示控制条或非lazyHover模式时记录用户暂停
        setUserPaused(true);
      }
    };

    const handlePlayEvent = () => {
      setUserPaused(false);
    };

    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('play', handlePlayEvent);

    handlePlay();

    return () => {
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('play', handlePlayEvent);
      if (lazyHover) {
        videoElement.pause();
      }
    };
  }, [shouldLoad, isHovered, lazyHover, autoPlay, userPaused, controls]);

  // 事件处理函数
  const handleClick = (e: React.MouseEvent | MouseEvent) => {
    if (typeof onClick === 'function') {
      onClick(e);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent | MouseEvent) => {
    if (typeof onDoubleClick === 'function') {
      onDoubleClick(e);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    const video = internalRef.current;
    if (video) {
      setUserPaused(video.paused ? false : true);
      if (video.paused) {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
    }
    handleClick(e);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const getFinalSrc = () => {
    if (!src || (lazyHover && !shouldLoad)) return undefined;
    return typeof src === 'string' ? getAcceleratedURL(src) : src;
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={(node) => {
          internalRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        src={getFinalSrc()}
        poster={poster}
        className={className}
        playsInline
        controls={controls}
        {...(!showOverlay ? { 
          onClick: handleClick as React.MouseEventHandler, 
          onDoubleClick: handleDoubleClick as React.MouseEventHandler 
        } : {})}
        {...rest}
      />
      
      {/* 触摸屏覆盖层 */}
      {showOverlay && (
        <div 
          className="absolute inset-0 z-40"
          onClick={handleOverlayClick}
          onDoubleClick={handleDoubleClick}
        />
      )}
    </div>
  );
});

Video.displayName = 'Video';
export default Video;
