import React, { useRef, useState, useEffect } from "react";
import WebFont from "webfontloader";

type TextElement = {
  id: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  letterSpacing: number;
  underline: boolean;
  isDragging: boolean;
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<number | null>(
    null
  );
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

    const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
    
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
    
      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      // 绘制背景图片
      if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    
      // 绘制文字
      textElements.forEach((el) => {
        ctx.font = `${el.fontSize}px ${el.fontFamily}`;
        ctx.fillStyle = el.color;
    
        // 模拟字间距：逐字绘制文字
        let currentX = el.x;
        for (const char of el.text) {
          ctx.fillText(char, currentX, el.y);
          currentX += el.fontSize * 0.6 + el.letterSpacing; // 假设每个字母宽度为 fontSize 的 0.6 倍
        }
    
        // 模拟下划线
        if (el.underline) {
          const textWidth =
            ctx.measureText(el.text).width +
            el.letterSpacing * (el.text.length - 1);
          ctx.fillRect(el.x, el.y + 2, textWidth, 2); // 下划线高度为 2px
        }
      });
    };


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        setImage(img);
        drawCanvas(); // 加载图片后立即绘制
      };
    }
  };

  const addTextElement = () => {
    setTextElements((prev) => {
      const updatedTextElements = [
        ...prev,
        {
          id: Date.now(),
          text: "New Text",
          x: 50,
          y: 50,
          fontSize: 20,
          fontFamily: "Arial",
          color: "black",
          letterSpacing: 0,
          underline: false,
          isDragging: false,
        },
      ];
      drawCanvas(); // 确保更新画布
      return updatedTextElements;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedElement = textElements.find(
      (el) =>
        mouseX >= el.x &&
        mouseX <= el.x + el.text.length * el.fontSize * 0.6 &&
        mouseY <= el.y &&
        mouseY >= el.y - el.fontSize
    );

    if (clickedElement) {
      setSelectedElementId(clickedElement.id);
      setMouseOffset({
        x: mouseX - clickedElement.x,
        y: mouseY - clickedElement.y,
      });
      setTextElements((prev) =>
        prev.map((el) =>
          el.id === clickedElement.id
            ? { ...el, isDragging: true }
            : el
        )
      );
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTextElements((prev) =>
      prev.map((el) =>
        el.isDragging
          ? {
              ...el,
              x: mouseX - mouseOffset.x,
              y: mouseY - mouseOffset.y,
            }
          : el
      )
    );
    drawCanvas(); // 实时更新画布
  };

  const handleMouseUp = () => {
    setTextElements((prev) =>
      prev.map((el) =>
        el.isDragging ? { ...el, isDragging: false } : el
      )
    );
    drawCanvas(); // 确保最终状态正确渲染
  };

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "exported_image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleTextChange = (id: number, field: string, value: any) => {
    setTextElements((prev) =>
      prev.map((el) =>
        el.id === id ? { ...el, [field]: value } : el
      )
    );
      drawCanvas(); // 即时刷新      
  };

    
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 确保在浏览器环境中加载字体
      const WebFont = require("webfontloader");
      WebFont.load({
        google: {
          families: ["Noto Sans SC", "Noto Serif SC"],
        },
      });
    }
  }, []);

    const fontOptions = [
      "Arial",
      "Courier New",
      "Times New Roman",
      "Verdana",
      "Georgia",
      "Noto Sans SC", // 思源黑体
      "Noto Serif SC", // 思源宋体
    ];
    
    return (
        <div className="flex flex-col items-center p-4">
            <div className="mb-4">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="mb-2"
                    />
                <button
                    onClick={addTextElement}
                    className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
                    >
                    Add Text
                </button>
                <button
                    onClick={handleExportImage}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                    >
                    Export Image
                </button>
            </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-gray-300"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      ></canvas>

      {selectedElementId !== null && (
        <div className="mt-4 p-4 bg-gray-500 text-gray-900 rounded shadow w-80">
          <h2 className="text-lg font-bold mb-2">Edit Text</h2>
          <input
            type="text"
            value={
              textElements.find((el) => el.id === selectedElementId)?.text || ""
            }
            onChange={(e) =>
              handleTextChange(selectedElementId, "text", e.target.value)
            }
            className="border p-2 w-full mb-2"
          />
          <div className="mb-2">
            <label className="block mb-1">Font Size:</label>
            <input
              type="number"
              min={10}
              max={100}
              value={
                textElements.find((el) => el.id === selectedElementId)
                  ?.fontSize || 20
              }
              onChange={(e) =>
                handleTextChange(
                  selectedElementId,
                  "fontSize",
                  Number(e.target.value)
                )
              }
              className="border p-2 w-full"
            />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Font Family:</label>
            <select
              value={
                textElements.find((el) => el.id === selectedElementId)
                  ?.fontFamily || "Arial"
              }
              onChange={(e) =>
                handleTextChange(selectedElementId, "fontFamily", e.target.value)
              }
              className="border p-2 w-full"
            >
              {fontOptions.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="block mb-1">Text Color:</label>
            <input
              type="color"
              value={
                textElements.find((el) => el.id === selectedElementId)?.color ||
                "#000000"
              }
              onChange={(e) =>
                handleTextChange(selectedElementId, "color", e.target.value)
              }
              className="w-full"
            />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Letter Spacing:</label>
            <input
              type="number"
              value={
                textElements.find((el) => el.id === selectedElementId)
                  ?.letterSpacing || 0
              }
              onChange={(e) =>
                handleTextChange(
                  selectedElementId,
                  "letterSpacing",
                  Number(e.target.value)
                )
              }
              className="border p-2 w-full"
            />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Underline:</label>
            <input
              type="checkbox"
              checked={
                textElements.find((el) => el.id === selectedElementId)
                  ?.underline || false
              }
              onChange={(e) =>
                handleTextChange(selectedElementId, "underline", e.target.checked)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
