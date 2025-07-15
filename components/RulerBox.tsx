import React, { useRef, useEffect } from "react";
import clsx from "clsx";

export default function RulerBox({
  children,
  className
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const step = 5;
  const shortLen = 6;
  const longLen = 12;

  const drawRuler = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 1;

    // 顶部
    for (let x = 0; x <= width; x += step) {
      const len = x % (step * 10) === 0 ? longLen : shortLen;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, len);
      ctx.stroke();
    }

    // 底部
    for (let x = 0; x <= width; x += step) {
      const len = x % (step * 10) === 0 ? longLen : shortLen;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height);
      ctx.lineTo(x + 0.5, height - len);
      ctx.stroke();
    }

    // 左边
    for (let y = 0; y <= height; y += step) {
      const len = y % (step * 10) === 0 ? longLen : shortLen;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(len, y + 0.5);
      ctx.stroke();
    }

    // 右边
    for (let y = 0; y <= height; y += step) {
      const len = y % (step * 10) === 0 ? longLen : shortLen;
      ctx.beginPath();
      ctx.moveTo(width, y + 0.5);
      ctx.lineTo(width - len, y + 0.5);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      drawRuler();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={clsx("relative p-5", className)}>
      {/* Canvas 标尺层 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
      />

      {/* 四角折角装饰 */}
      <div className="absolute top-px left-px w-3 h-3 border-t-2 border-l-2 border-white z-20" />
      <div className="absolute top-px right-px w-3 h-3 border-t-2 border-r-2 border-white z-20" />
      <div className="absolute bottom-px left-px w-3 h-3 border-b-2 border-l-2 border-white z-20" />
      <div className="absolute bottom-px right-px w-3 h-3 border-b-2 border-r-2 border-white z-20" />

      {/* 内容层 */}
      <div className="w-full h-full z-0 flex flex-col items-center justify-start">
        {children}
      </div>
    </div>
  );
}
