'use client';

import React, {
  forwardRef,
  useRef,
  useState,
  useLayoutEffect,
  ImgHTMLAttributes,
  MutableRefObject,
} from 'react';

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height'> {
  src: string;
  useAcc?: boolean;
  quality?: number;
  webp?: boolean;
  sizes?: string;
  width?: number | string;
  height?: number | string;
  onLoadingComplete?: (img: HTMLImageElement) => void;
}

const Image = forwardRef<HTMLImageElement, SmartImageProps>((props, ref) => {
  const {
    src,
    useAcc = true,
    quality = 85,
    webp = true,
    sizes = '100vw',
    width,
    height,
    onLoadingComplete,
    onLoad,
    onError,
    className,
    ...rest
  } = props;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [finalSrc, setFinalSrc] = useState<string>(src);
  const [srcSet, setSrcSet] = useState<string>();
  const [hasError, setHasError] = useState(false);

  // 支持多个OSS域名
  const ossDomains = [
    'aiputi.oss-cn-beijing.aliyuncs.com',
    'aiputifile.oss-cn-beijing.aliyuncs.com'
  ];
  
  const getAcceleratedHost = (host: string) => 
    host.replace('oss-cn-beijing', 'oss-accelerate');

  const isAliOSS = (url: string) => 
    ossDomains.some(domain => url.includes(domain));

  const getAcceleratedURL = (url: string) => {
    if (!isAliOSS(url) || !useAcc) return url;
    
    try {
      const urlObj = new URL(url);
      const acceleratedHost = getAcceleratedHost(urlObj.host);
      urlObj.host = acceleratedHost;
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  const widths = [256, 576, 1024];

  const getNearestWidth = (target: number) =>
    widths.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );

  const buildAliSrcSet = (baseURL: string) => {
    try {
      const url = new URL(baseURL);
      const originQuery = url.searchParams.get('x-oss-process');
      let processParts: string[] = [];

      if (originQuery) {
        const parts = originQuery.split('/');
        const filtered = parts.filter((p) => !/^resize,?/.test(p));
        processParts.push(...filtered);
      }

      const cleanBase = `${url.origin}${url.pathname}`;
      
      return widths
        .map((w) => {
          const parts = [
            ...processParts,
            `resize,w_${w}`,
            `quality,q_${quality}`,
            ...(webp ? ['format,webp'] : []),
          ];
          return `${cleanBase}?x-oss-process=${parts.join('/')} ${w}w`;
        })
        .join(', ');
    } catch {
      return '';
    }
  };

  useLayoutEffect(() => {
    if (!src) return;

    let parsedWidth: number | undefined = undefined;
    if (typeof width === 'string') parsedWidth = parseInt(width);
    else if (typeof width === 'number') parsedWidth = width;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1080;
    const targetWidth = parsedWidth ?? vw;
    const actualWidth = targetWidth * dpr;

    const maxW = Math.max(...widths);
    const needOriginal = actualWidth > maxW;

    const accelerated = getAcceleratedURL(src);

    if (!isAliOSS(src)) {
      setFinalSrc(src);
      return;
    }

    const nearest = getNearestWidth(actualWidth);

    try {
      const url = new URL(accelerated);
      const originQuery = url.searchParams.get('x-oss-process');
      let processParts: string[] = [];

      if (originQuery) {
        const parts = originQuery.split('/');
        const filtered = parts.filter((p) => !/^resize,?/.test(p));
        processParts.push(...filtered);
      }

      processParts.push(`resize,w_${nearest}`, `quality,q_${quality}`);
      if (webp) processParts.push('format,webp');
      url.searchParams.set('x-oss-process', processParts.join('/'));

      setFinalSrc(url.toString());
      setSrcSet(buildAliSrcSet(accelerated));
    } catch {
      setFinalSrc(src);
      setSrcSet(undefined);
    }
  }, [src, width, height, quality, webp, useAcc]);

  return (
    <img
      ref={(node) => {
        if (node) imgRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object' && 'current' in ref) {
          (ref as MutableRefObject<HTMLImageElement | null>).current = node;
        }
      }}
      src={finalSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      loading="lazy"
      decoding="async"
      className={className}
      onLoad={(e) => {
        onLoad?.(e);
        onLoadingComplete?.(e.currentTarget);
      }}
      onError={(e) => {
        if (!hasError && finalSrc !== src) {
          (e.target as HTMLImageElement).src = src;
          setHasError(true);
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
});

Image.displayName = 'Image';
export default Image;
