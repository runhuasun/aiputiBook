// pages/editImage3.tsx
import React, { useRef, useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import prisma from "../lib/prismadb";
import { Room } from '@prisma/client';
import { Icon } from '@iconify/react';
import * as fabric from 'fabric'; // 使用命名空间导入
import {
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid'


import TopFrame from "../components/TopFrame";
import { config, defaultImage } from '../utils/config';
import LoadingRing from '../components/LoadingRing';
import StartButton from '../components/StartButton';
import ToolBar from "../components/ToolBar";
import RulerBox from "../components/RulerBox";
import ComboSelector from "../components/ComboSelector";

import LoadingButton from "../components/LoadingButton";
// https://nhn.github.io/tui.image-editor/latest/ImageEditor
import ImageEditor from '../components/ForwardedImageEditorWrapper';
import type { ForwardedImageEditorHandle } from '../components/ForwardedImageEditor';

import * as ru from "../utils/restUtils";
import { callAPI2, callAPI } from '../utils/apiUtils';
import * as fu from "../utils/fileUtils";
import { jsonOfRoomBody } from "../utils/roomUtils";
import * as monitor from "../utils/monitor";
import * as debug from "../utils/debug";
import {log, warn, error} from "../utils/debug";
import * as rmu from "../utils/roomUtils";
import * as enums from "../utils/enums";

import 'tui-image-editor/dist/tui-image-editor.css';
import 'tui-color-picker/dist/tui-color-picker.css';

const customTheme = {
    'common.backgroundColor': '#111827',
    'common.border': '1px solid #444',
    // 头部
    'header.backgroundImage': 'none',
    'header.backgroundColor': '#1e1e1e',
    'header.border': '0px',
    // 主菜单
    'menu.normalIcon.color': '#8a8a8a',
    'menu.activeIcon.color': '#fff',
    'menu.disabledIcon.color': '#555',
    'menu.hoverIcon.color': '#e9e9e9',
    'menu.backgroundColor': '#1E293B',
    // 子菜单
    'submenu.backgroundColor': '#2e2e2e',
    'submenu.partition.color': '#3c3c3c',
    // 按钮
    'downloadButton.backgroundColor': '#00a9ff',
    'downloadButton.borderColor': '#00a9ff',
};


const zhLocale = {
    'Load': '加载',
    'Download': '下载',
    'Menu': '菜单',
    'Undo': '撤销',
    'Redo': '重做',
    'Reset': '重置',
    'Delete': '删除',
    'DeleteAll': '全部删除',
    'Crop': '裁剪',
    'Flip': '翻转',
    'Rotate': '旋转',
    'Draw': '绘图',
    'Shape': '形状',
    'Icon': '图标',
    'Text': '文字',
    'Mask': '遮罩',
    'Filter': '滤镜',
    'ZoomIn': '放大',
    'ZoomOut': '缩小',
    'Hand': '拖动',
    'History': '历史',
    'Resize': '尺寸',
    'Bold': '粗体',
    'Italic': '斜体',
    'Underline': '下划线',
    'Left': '左对齐',
    'Center': '据中国',
    'Right': '右对齐',
    'Color': '颜色',
    'Text size': '文字大小',
    'Width': '宽度',
    'Height': '高度',
    'Lock Aspect Ratio': '锁定宽高比',
    'Apply': '应用',
    'Cancel': '取消',
    'Custom': '自定义',
    'Square': '方形',
    'Flip X': '左右翻转',
    'Flip Y': '上下翻转',
    'Range': '范围',
    'Free': '自由',
    'Straight': '直线',
    'Rectangle': '矩形',
    'Circle':'圆形',
    'Triangle': '三角形',
    'Fill': '填充',
    'Stroke':'边缘',
    'Arrow':'箭头1',
    'Arrow-2':'箭头2',
    'Arrow-3':'箭头3',    
    'Star-1':'五角星',        
    'Star-2':'多角星',            
    'Polygon':'多边形',            
    'Location':'位置',            
    'Heart':'心形',            
    'Bubble':'气泡',            
    'Custom Icon':'自定义图标',            
    'Load Mask Image': '加载遮罩',            
    'Grayscale':'灰度',            
    'Invert':'反色',            
    'Sepia':'褐色',  
    'Sepia2':'深褐色',            
    'Blur':'模糊',            
    'Sharpen':'尖锐',  
    'Emboss':'浮雕',            
    'Remove White':'祛白',            
    'Distance':'距离',  
    'Brightness':'亮度',            
    'Noise':'噪点',            
    'Pixelate':'像素化',  
    'Color Filter':'颜色滤镜',            
    'Threshold':'阈值',            
    'Tint':'色调',      
    'Multiply':'正片',            
    'Blend':'混合',      
};

const editorFonts = [
  { name: 'ZCOOL KuaiLe', family: "'ZCOOL KuaiLe', cursive" },
  { name: 'Noto Sans SC', family: "'Noto Sans SC', sans-serif" },
  { name: 'Roboto', family: "'Roboto', sans-serif" },
  { name: 'Courier Prime', family: "'Courier Prime', monospace" },
  { name: 'Rubik Mono One', family: "'Rubik Mono One', sans-serif" },
  { name: '微软雅黑', family: '"Microsoft YaHei", sans-serif' },
  { name: '黑体', family: '"SimHei", sans-serif' },
  { name: '宋体', family: '"SimSun", serif' },
];




export default function editImage({ simRoomBody, image,  config }: { simRoomBody:any, image: Room, config:any }) {
    const router = useRouter();
    
    const editorRef = useRef<ForwardedImageEditorHandle>(null);
    const [originalPhoto, setOriginalPhoto] = useState<string | null>((router.query.imageURL || image?.outputImage || simRoomBody?.output || defaultImage.whitePaper)  as string);
    const [restoredImage, setRestoredImage] = useState<string | null>((router.query.imageURL || image?.outputImage || simRoomBody?.output || "")  as string);
    const [restoredId, setRestoredId] = useState<string | null>(simRoomBody?.roomId);
 
    const [loading, setLoading] = useState(false);
    const [isClientReady, setIsClientReady] = useState(false);
    const [preRoomId, setPreRoomId] = useState<string | null>(router?.query?.roomId as string);

    const { status } = useSession();
    const { mutate } = useSWR('/api/remaining', (url) => fetch(url).then((res) => res.json()));


    async function getEditorInstance(){
        console.log('getEditorInstance enter.....');
        let instance = null;
        for(let i=0; i<15; i++){
            instance = editorRef.current?.getInstance?.();
            if(!instance){
                console.log('getEditorInstance: no instance, wait 1 sec');
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }else{
                console.log('getEditorInstance get instance and return');
                break;
            }           
        }
        return instance;
    }

    function applyNewSize(instance: any, delay = 100) {
        setTimeout(() => {
            const container = document.querySelector('.tui-image-editor-container') as HTMLElement;
            if (!container || !instance?.ui?.resizeEditor) return;
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            instance.ui.resizeEditor({
                imageSize: {
                    oldWidth: width,
                    oldHeight: height,
                    newWidth: width,
                    newHeight: height,
                },
                uiSize: {
                    width: width + 'px',
                    height: height + 'px',
                },
            });
            
            instance.ui.alignCenter?.(); // 居中显示
        }, delay); // ⏱ 延迟执行以确保 DOM 完整渲染
    }
    
    
    function enterDrawMenuWithoutBrush(retries = 15) {
        const btn = document.querySelector('.tui-image-editor-button.free') as HTMLElement;
        if (btn) {
            btn.click(); // 模拟点击以关闭激活状态
            console.log('✅ 已取消默认自由绘图模式');
        } else if (retries > 0) {
            console.warn('⏳ .tui-image-editor-button.free 未加载，重试...');
            setTimeout(() => enterDrawMenuWithoutBrush(retries - 1), 300);
        } else {
            console.error('❌ 重试后仍未找到 .tui-image-editor-button.free 按钮');
        }
    }
    
    async function loadJson(room:any){
        console.log('loadJson.....');
        if(isClientReady && room){
            const instance = await getEditorInstance();
            console.log('loadJson：got instance');
            if(instance && room){
                console.log('clear Objects.....');
                await instance.clearObjects(); // 先清空画布                    
                console.log('loadJsonData.....');
                const result = await loadJsonData(room, instance);
                if(result){
                    console.log('apply new size.....');
                    applyNewSize(instance);
                    console.log('✅ 加载JSON完成');
                    return result;
                }else{
                    console.error('❌ 加载JSON失败:');                                            
                }

            }
        }
        return false;
    }

    async function loadImage(photo:string){
        if(isClientReady && photo){
            const instance = await getEditorInstance();
            if(instance){
                try {
                    await instance.clearObjects(); // 先清空画布
                    await instance.loadImageFromURL(photo, 'loaded-from-url');
                    console.log('✅ 强制加载图片完成');
                } catch (err) {
                    toast.error('❌ 强制加载图片失败:');
                }
            }
        }            
    }

    
    
    function jsonOfRoomBody(room:any) {
        let roomBody:any;
        if(room?.bodystr){
            try{
                roomBody = JSON.parse(room.bodystr);
                roomBody.output = room.outputImage;
                roomBody.roomId = room.id;
                roomBody.seed = room.seed;
            }catch(err){
                debug.error("ROOM ID:" + room.id);
                debug.error("获取ROOM BODY时发生意外失败：", err);
            }
        }
        return roomBody;
    }

function normalizePathData(path: any[]): { normalized: any[]; offsetX: number; offsetY: number } {
  let minX = Infinity;
  let minY = Infinity;

  // 遍历所有路径命令找出最小坐标
  for (const command of path) {
    const coords = command.slice(1);
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      if (typeof x === 'number' && x < minX) minX = x;
      if (typeof y === 'number' && y < minY) minY = y;
    }
  }

  // 平移路径到(0,0)起点并保留偏移量
  const normalized = path.map((command) => {
    const [cmd, ...coords] = command;
    const shifted = coords.map((v: number, i: number) => 
      i % 2 === 0 ? v - minX : v - minY
    );
    return [cmd, ...shifted];
  });

  return { normalized, offsetX: minX, offsetY: minY };
}

    // 这个程序是位置正确了！但是选择框比图形大很多，影响选择其它对象
async function loadFromJSON(instance: any, jsonData: any): Promise<void> {
  if (!jsonData?.objects || !instance) return;

  const canvas = instance._graphics?._canvas;
  if (!canvas) return;

  const icons = jsonData.objects.filter((obj: any) => obj.type === 'icon');
  const others = jsonData.objects.filter((obj: any) => obj.type !== 'icon');

  return new Promise<void>((resolve) => {
    // 先加载非图标对象
    canvas.loadFromJSON({ ...jsonData, objects: others }, async () => {
      for (const iconData of icons) {
        try {
          // 步骤1: 归一化路径并获取原始偏移量
          const { normalized, offsetX, offsetY } = normalizePathData(iconData.path);
          
          // 步骤2: 创建临时路径计算实际宽高（必须应用缩放/旋转）
          const tempPath = new fabric.Path(normalized);
          tempPath.set({
            scaleX: iconData.scaleX ?? 1,
            scaleY: iconData.scaleY ?? 1,
            angle: iconData.angle ?? 0,
            flipX: !!iconData.flipX,
            flipY: !!iconData.flipY,
            originX: 'center',
            originY: 'center'
          });
          tempPath.setCoords();
          
          // 步骤3: 计算实际尺寸和位置补偿
          const width = tempPath.width * tempPath.scaleX;
          const height = tempPath.height * tempPath.scaleY;
          const left = (iconData.left || 0) + offsetX * (iconData.scaleX ?? 1) + width / 2;
          const top = (iconData.top || 0) + offsetY * (iconData.scaleY ?? 1) + height / 2;

          // 步骤4: 添加图标并设置属性
          const iconObj = await instance.addIcon('arrow', { 
            left, 
            top,
            originX: 'center',
            originY: 'center',
            fill: iconData.fill || '#000000'
          });

          if (!iconObj) {
            console.warn('⚠️ 无法添加 icon：', iconData);
            continue;
          }

          // 步骤5: 同步所有变换属性
          await instance.setObjectPropertiesQuietly(iconObj.id, {
            path: normalized,
            scaleX: iconData.scaleX ?? 1,
            scaleY: iconData.scaleY ?? 1,
            angle: iconData.angle ?? 0,
            opacity: iconData.opacity ?? 1,
            flipX: !!iconData.flipX,
            flipY: !!iconData.flipY,
            originX: 'center',
            originY: 'center',
            left,
            top,
            width,
            height
          });

        } catch (err) {
          console.warn('❌ 恢复 icon 出错：', err, iconData);
        }
      }

      canvas.renderAll();
      resolve();
    });
  });
}

    
    async function loadJsonData(room:any, instance:any){
        try{
            if(room){
                console.log('start to callAPI get bodystr......');
                const ret = await callAPI("/api/updateRoom", {cmd:"GET_DATA", id:room.id});
                if(ret.status == enums.resStatus.OK){
                    const fullRoom = ret.result;
                    const roomBody = jsonOfRoomBody(fullRoom);
                    console.log(`roomBody is ${roomBody}`);
                    const jsonData = roomBody?.params?.jsonData;
                    if(jsonData && instance){
                        console.log('start to load jsonData to instance....');
                        const canvas = (instance as any)?._graphics?._canvas;
                        if (canvas) {
                            await loadFromJSON(instance, jsonData);
                            return true;
                        }
                    }
                }
            }
        }catch(err){
            debug.error("loadJsonData:", err);
        }
        return false;
    }    
    
    // 初始化的时候：按照router.query.imageURL || image.jsonData 顺序
    // 选择图片时：按照selectedRoom || originalRoom 顺序
useEffect(() => {
  const initImage = async () => {
    console.log('initImage.....');
    const instance = await getEditorInstance();
    if (instance) {
      console.log('initImage:instance is ready');
      let loaded = false;
      if (image) {
        console.log('initImage, image is there');
        await instance.clearObjects();
        loaded = await loadJsonData(image, instance);
        enterDrawMenuWithoutBrush();
        console.log(`initImage loadJsonData result is: ${loaded}`);
        if (loaded) {
          console.log('✅ 加载JSON完成');
        } else {
          console.error('❌ 加载JSON失败:');
        }
      }
      console.log(`step1 loaded is ${loaded}, originalPhoto is ${originalPhoto}`);
      if (!loaded && originalPhoto) {
        console.log('enter load image.....');
        try {
          await instance.clearObjects();
          await instance.loadImageFromURL(originalPhoto, 'loaded-from-url');
          console.log('✅ 强制加载图片完成');
        } catch (err) {
          toast.error('❌ 强制加载图片失败:');
        }
      }
    } else {
      console.log('无法获得画布实例');
    }
  };

  console.log(`enter useEffect [isClientReady]: ${isClientReady}, [originalPhoto]:${originalPhoto}, [image]:${image}`);
  if (isClientReady && (originalPhoto || image)) {
    const timer = setTimeout(() => {
      initImage();
    }, 3000); // ⏱ 延迟 3 秒

    return () => clearTimeout(timer); // 清除副作用
  }
}, [isClientReady]);


    
useEffect(() => {
  if (typeof window !== 'undefined') {
    setIsClientReady(true);
  }

  const timer = setTimeout(() => {
    const helpMenu = document.querySelector('.tui-image-editor-help-menu');

    if (helpMenu && !document.getElementById('layer-control-up')) {
      helpMenu.classList.remove('right');
      helpMenu.classList.add('top');
      (helpMenu as HTMLElement).style.justifyContent = 'center'; // ✅ 居中
      (helpMenu as HTMLElement).style.background = 'transparent'; // ✅ 背景透明

      const instance = editorRef.current?.getInstance?.();
      if (!instance) return;

      const withUIRefresh = (action: (canvas: any, obj: any) => void) => {
        const graphics = (instance as any)?._graphics;
        const obj = graphics?.getActiveObject?.();
        if (graphics && graphics._canvas && obj) {
          action(graphics._canvas, obj);
          graphics._canvas.renderAll();

          const menu = (instance as any).ui?._activeMenu;
          if (menu) {
            const menuBtn = document.querySelector(`.tui-image-editor-button.tie-${menu}`) as HTMLElement;
            menuBtn?.click();
          }
        }
      };

      const actions = [
        {
          id: 'layer-control-up',
          icon: 'ic:round-arrow-upward',
          tooltip: '上移图层',
          handler: () => withUIRefresh((canvas, obj) => canvas.bringForward(obj)),
        },
        {
          id: 'layer-control-down',
          icon: 'ic:round-arrow-downward',
          tooltip: '下移图层',
          handler: () => withUIRefresh((canvas, obj) => canvas.sendBackwards(obj)),
        },
        {
          id: 'layer-control-top',
          icon: 'material-symbols:vertical-align-top-rounded',
          tooltip: '置于顶层',
          handler: () => withUIRefresh((canvas, obj) => canvas.bringToFront(obj)),
        },
        {
          id: 'layer-control-bottom',
          icon: 'material-symbols:vertical-align-bottom-rounded',
          tooltip: '置于底层',
          handler: () => withUIRefresh((canvas, obj) => canvas.sendToBack(obj)),
        },
      ];

      const buttonRefs: { id: string; li: HTMLLIElement; button: HTMLButtonElement }[] = [];

      actions.forEach(({ id, icon, tooltip, handler }) => {
        const li = document.createElement('li');
        li.className = 'tui-image-editor-item help disabled';
        li.setAttribute('tooltip-content', tooltip);
        li.id = id;

        const button = document.createElement('button');
        button.className = 'tie-layer-button p-2 focus:outline-none flex items-center justify-center text-gray-500 transition';
        button.style.background = 'transparent';
        button.style.border = 'none';
        button.style.cursor = 'default';
        button.disabled = true;

        const mountPoint = document.createElement('div');
        button.appendChild(mountPoint);

        import('react-dom/client').then((ReactDOM) => {
          const root = ReactDOM.createRoot(mountPoint);
          root.render(<Icon icon={icon} className="w-5 h-5" />);
        });

        button.addEventListener('click', handler);
        li.appendChild(button);
        helpMenu.appendChild(li);

        buttonRefs.push({ id, li, button });
      });

      const checkInterval = setInterval(() => {
        const instance = editorRef.current?.getInstance?.();
        const graphics = (instance as any)?._graphics;
        const hasActive = !!graphics?.getActiveObject?.();

        buttonRefs.forEach(({ li, button }) => {
          if (hasActive) {
            li.classList.remove('disabled');
            li.classList.add('enabled');
            button.disabled = false;
            button.classList.remove('text-gray-500');
            button.classList.add('text-white', 'hover:bg-gray-700');
            button.style.cursor = 'pointer';
          } else {
            li.classList.remove('enabled');
            li.classList.add('disabled');
            button.disabled = true;
            button.classList.remove('text-white', 'hover:bg-gray-700');
            button.classList.add('text-gray-500');
            button.style.cursor = 'default';
          }
        });
      }, 500);

      return () => clearInterval(checkInterval);
    }
  }, 3000);

  return () => clearTimeout(timer);
}, [originalPhoto]);

  
    
    useEffect(() => {
        const interval = setInterval(() => {
            const textMenuRoot = document.querySelector('.tui-image-editor-menu-text');
            const fontMenu = textMenuRoot?.querySelector('.tui-image-editor-submenu-item');
            if (textMenuRoot && fontMenu && !document.getElementById('custom-font-selector')) {
                const fontSelector = document.createElement('select');
                fontSelector.id = 'custom-font-selector';
                fontSelector.style.margin = '4px 0';
                fontSelector.style.fontSize = '14px';
                fontSelector.style.margin = '4px 0';
                fontSelector.style.fontSize = '14px';
                fontSelector.style.backgroundColor = '#111';
                fontSelector.style.color = '#fff';
                fontSelector.style.border = '1px solid #444';
                fontSelector.style.padding = '4px 8px';
                fontSelector.style.borderRadius = '4px';
                fontSelector.style.width = '220px'; // 推荐安全值    
                
                fontSelector.innerHTML = `
                  <option value="'ZCOOL KuaiLe', cursive">ZCOOL KuaiLe</option>
                  <option value="'Noto Sans SC', sans-serif">Noto Sans SC</option>
                  <option value="'Roboto', sans-serif">Roboto</option>
                  <option value="'Courier Prime', monospace">Courier Prime</option>
                  <option value="'Rubik Mono One', sans-serif">Rubik Mono One</option>
                  <option value="'Open Sans', sans-serif">Open Sans</option>
                  <option value="'Lato', sans-serif">Lato</option>
                  <option value="'Merriweather', serif">Merriweather</option>
                  <option value="'Source Code Pro', monospace">Source Code Pro</option>
                  <option value="'Anton', sans-serif">Anton</option>
                  <option value="'Indie Flower', cursive">Indie Flower</option>
                  <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
                  <option value="'SimHei', sans-serif">黑体</option>
                  <option value="'SimSun', serif">宋体</option>
                  <option value="'FangSong', serif">仿宋</option>
                  <option value="'KaiTi', serif">楷体</option>
                `;
                
                fontSelector.addEventListener('change', async () => {
                    const instance = await getEditorInstance();
                    const graphics = (instance as any)?._graphics;
                    const activeObj = graphics?.getActiveObject?.();
                    
                    if (activeObj?.type === 'i-text') {
                        activeObj.set('fontFamily', fontSelector.value);
                        graphics._canvas.renderAll();
                    }
                });
                
                const container = document.createElement('li');
                container.appendChild(fontSelector);
                fontMenu.appendChild(container);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);



function rgbToHex(rgb: string): string {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return '#000000';
  return (
    '#' +
    result
      .slice(0, 3)
      .map((x) => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}


    
    /*
    tie-color-fill tui-image-editor-button 
    tie-color-stroke tui-image-editor-button 
    tie-icon-color tui-image-editor-button
    tie-filter-tint-color tui-image-editor-button
    tie-filter-multiply-color tui-image-editor-button
    tie-filter-blend-color tui-image-editor-button
    */
    useEffect(() => {

        // 隐藏原有颜色选择器
        const hideDefaultColorPickers = () => {
            const oldPickers = document.querySelectorAll(
                '.color-picker-control, .filter-color-item'
            );
            oldPickers.forEach((el) => {
                (el as HTMLElement).style.display = 'none';
            });
        };
        
        const injectColorPickers = ( targetClass: string, onChange: (color: string) => void ) => {
            const allButtons = document.querySelectorAll<HTMLButtonElement>(`.${targetClass}.tui-image-editor-button`);
            allButtons.forEach((button, index) => {
                const inputId = `color-picker-${targetClass}-${index}`;
                if (!document.getElementById(inputId)) {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.id = inputId;
                    input.style.position = 'absolute';
                    input.style.width = '100%';
                    input.style.height = '100%';
                    input.style.top = '0';
                    input.style.left = '0';
                    input.style.opacity = '0';
                    input.style.cursor = 'pointer';
                    
                    input.addEventListener('input', () => {
                        // ✅ 更新按钮内颜色块的背景色
                        const preview = button.querySelector('.color-picker-value') as HTMLElement;
                        if (preview) {
                            preview.style.backgroundColor = input.value;
                        }                  
                        onChange(input.value);                        
                    });
                    
                    // 👇 新增：让点击按钮本身触发 input.click()
                    button.addEventListener('click', () => {
                        input.click();
                    });
                    
                    button.style.position = 'relative';
                    button.appendChild(input);
                }
            });
        };
   
        async function injectControls(){
            const instance = await getEditorInstance();
            if (!instance) return;
            
            const graphics = (instance as any)?._graphics;
            const canvas = graphics?._canvas;
            
            injectColorPickers('tie-text-color', (color) => {
                const activeObj = graphics?.getActiveObject?.();
                if (activeObj?.type === 'i-text') {
                    activeObj.set('fill', color);
                    canvas?.renderAll?.();
                }
                // ✅ 新增这行：设置默认添加文字颜色
                const originalAddText = instance.addText.bind(instance);
                instance.addText = (text, options = {}) => {
                  const colorBtn = document.querySelector('.tie-text-color .color-picker-value') as HTMLElement;
                  const color = rgbToHex(colorBtn?.style.backgroundColor || 'rgb(0,0,0)');
                  return originalAddText(text, {
                    ...options,
                    styles: { fill: color }
                  });
                };
            });
   
            injectColorPickers('tie-draw-color', (color) => {
              // 1. 设置 brush 默认颜色
              const currentWidth = graphics?.brush?.width || 10;
              instance.setBrush({ color, width: currentWidth });
            
              // 2. 如果当前有激活的绘图对象，也一起设置颜色
              const activeObj = graphics?.getActiveObject?.();
              if (activeObj && activeObj?.type === 'path') {
                activeObj.set('stroke', color);
                graphics._canvas?.renderAll?.();
              }
            });
    
            injectColorPickers('tie-color-fill', (color) => {
              const shapeType = (instance as any)._drawingShape || 'rect';
              instance.setDrawingShape(shapeType, { fill: color });
            
              const activeObj = (instance as any)._graphics?.getActiveObject?.();
              if (activeObj && activeObj.set) {
                activeObj.set('fill', color);
                (instance as any)._graphics._canvas?.renderAll?.();
              }
            });
    
            injectColorPickers('tie-color-stroke', (color) => {
              const shapeType = (instance as any)._drawingShape || 'rect';
              instance.setDrawingShape(shapeType, { stroke: color });
            
              const activeObj = (instance as any)._graphics?.getActiveObject?.();
              if (activeObj && activeObj.set) {
                activeObj.set('stroke', color);
                (instance as any)._graphics._canvas?.renderAll?.();
              }
            });

              // 全局记录当前图标颜色
              let currentIconColor = '#ff0000'; // 默认红色
              (instance as any)._myIconColor = currentIconColor;
            
              // ✅ 1. 注入图标颜色选择器
              injectColorPickers('tie-icon-color', (color) => {
                  console.log(`tie-icon-color:${color}`);
                  const activeObj = graphics?.getActiveObject?.();
                  const canvas = graphics?._canvas;
                  console.log(`activeObj?.type: ${activeObj?.type}`);
                  // 设置当前激活图标颜色
                  if (activeObj?.type === 'icon' || activeObj?.type === 'path' || activeObj?.type === 'group') {
                      instance.changeIconColor(activeObj.id, color);
               //       activeObj.set('fill', color);
               //       if (activeObj._objects) {
                //          activeObj._objects.forEach((obj: any) => obj.set('fill', color));
                //      }
                      canvas?.renderAll?.();
                  }
                  // 设置为接下来插入的默认图标颜色
                  (instance as any)._myIconColor = color;
              });

              // ✅ 2. 替换 addIcon，注入默认颜色
                instance.on('objectAdded', function(event) {
                    console.log("on objectAdded event:", event);
                    if (event.type === 'icon') {  // 直接访问 event.type
                        instance.changeIconColor(event.id, (instance as any)._myIconColor);
                        const button = document.querySelector<HTMLButtonElement>(`.tie-icon-color.tui-image-editor-button`);
                        if(button){
                            const preview = button.querySelector('.color-picker-value') as HTMLElement;
                            if (preview) {
                                preview.style.backgroundColor = (instance as any)._myIconColor;
                            }                               
                        }
                    }
                });

            hideDefaultColorPickers();
        }
        
        injectControls();
    }, []);


    type JSONValue = string | number | boolean | JSONObject | JSONArray | null;
    interface JSONObject {
      [key: string]: JSONValue;
    }
    interface JSONArray extends Array<JSONValue> {}
    
    async function replaceBase64Src(obj: JSONValue, uploadFn: (base64: string) => Promise<string>): Promise<void> {
      async function recurse(value: JSONValue): Promise<void> {
        if (typeof value === "object" && value !== null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              await recurse(item);
            }
          } else {
            for (const key in value) {
              const val = value[key];
    
              if (key === "src" && typeof val === "string" && val.startsWith("data:image/")) {
                const uploadedUrl = await uploadFn(val);
                value[key] = uploadedUrl;
              } else {
                await recurse(val);
              }
            }
          }
        }
      }
    
      await recurse(obj);
    }

    async function downloadImage(){
        const instance = await getEditorInstance();
        if (!instance) throw new Error('无法获取画布实例');
        const dataURL = instance.toDataURL({format:'image/jpeg', quality:0.92});
        if(dataURL){
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = 'niukitEdit.jpg';
            a.click();
        }
    }
    
    const generate = async () => {
        try {
            setLoading(true);
            const instance = await getEditorInstance();
            if (!instance) throw new Error('无法获取画布实例');
            console.log('toDataURL....');
            const dataURL = instance.toDataURL({format:'image/jpeg', quality:0.92});
            console.log('upload......');
            const imageURL = await fu.uploadBase64FileServer(dataURL);
            console.log(`dataURL uploaded to ${imageURL}`);
            console.log('toJson....');
            const canvas = (instance as any)?._graphics?._canvas;
            let jsonData:any = "";
            if (canvas) {
                const json = canvas.toJSON(); // 获取 JSON 描述对象
                if(json){
                    console.log(`canvas JSON is: ${JSON.stringify(json)}`);                    
                    await replaceBase64Src(json, fu.uploadBase64FileServer.bind(fu));
                    jsonData = json;
                    console.log(`base64 converted JSON is: ${JSON.stringify(jsonData)}`);                    
                }
            }               
            
            const res = await callAPI2(
                '/api/workflowAgent2',
                { cmd: 'editImage', params: { imageURL, jsonData } },
                '编辑图片',
                'IMAGE',
                (status:boolean)=>{setLoading(status)},
                (res: any) => {
                    mutate();
                    setRestoredImage(res.result?.generated);
                    setRestoredId(res.result?.genRoomId);                                      
                    toast.success('保存成功!');
                    //if(res?.result?.genRoomId){
                    //    window.open(ru.getImageRest(res.result.genRoomId), "_blank");
                    //}
                }
            );
        } catch (e) {
            console.error(e);
            toast.error('保存失败');
        } finally {
            setLoading(false);
        }
    };

    
    if (typeof window === 'undefined' || status !== 'authenticated') return null;
    
    return (
        <TopFrame config={config}>
            <Head>
                <title>{`图片编辑`}</title>
                <link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Noto+Sans+SC&family=Roboto&display=swap" rel="stylesheet" />                
                <link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Noto+Sans+SC&family=Roboto&family=Courier+Prime&family=Rubik+Mono+One&display=swap" rel="stylesheet" />                                
            </Head>
            <main className="w-full p-4">
                <ToolBar config={config} roomId={preRoomId} imageURL={originalPhoto} restoredImage={restoredImage} restoredId={restoredId} /> 
              
                <RulerBox className="relative w-full h-screen bg-black">
                    {isClientReady && originalPhoto && (
                    <ImageEditor
                        ref={editorRef}
                        includeUI={{
                            loadImage: { path: originalPhoto, name: 'initialImage', headers: { 'Cross-Origin': 'anonymous' } },
                            theme: customTheme,
                            menu: [ "resize", "crop", "flip", "rotate", "draw", "shape", "icon", "text", "mask", "filter",],
                            initMenu: 'draw',
                            uiSize: { width: '100%', height: '100%' },
                            menuBarPosition: 'left',
                            locale: zhLocale,
                            text: {
                                fonts: editorFonts,
                            }
                      }}
                      cssMaxWidth={2048}
                      cssMaxHeight={2048}
                      selectionStyle={{ cornerSize: 20, rotatingPointOffset: 70 }}
                      usageStatistics={false}
                    />
                    )}
                    <div id="uploadView" className="absolute top-7 left-24 flex gap-4 w-full max-w-lg">
                        <ComboSelector showIcon={true} showBorder={false} showDemo={false}
                            onSelect = {async (newFile, inRoom) => { // 这一个总是先执行
                                if(newFile){
                                    setOriginalPhoto(newFile);
                                    setPreRoomId(null);
                                    if(!inRoom){
                                        loadImage(newFile);
                                    }
                                }
                            }}
                            onSelectRoom = {async (newRoom) => { // 这一个总是后执行
                                if(newRoom){
                                    setPreRoomId(newRoom.id);
                                    const ret = await loadJson(newRoom);
                                    if(!ret){
                                        loadImage(newRoom.outputImage);
                                    }
                                }
                            }}                                               
                            />
                    </div>                        
                    <div id="buttonView" className="absolute top-7 right-7 flex gap-4 flex flex-row">
                        <button className="button-main px-5 py-2 flex flex-row gap-2 text-sm"
                            onClick={() => {
                                downloadImage();
                            }}
                            >
                            <ArrowDownTrayIcon className="w-5 h-5 text-inherit" />                            
                            下载
                        </button>
                        {loading ? (
                        <LoadingButton minTime={3} maxTime={5} timeUnit={"秒"} isMini={true}/>
                        ):(                                
                        <StartButton config={config} title="保存"  isMini={true}
                            onStart={() => {
                                generate();
                            }}
                            />
                        )}  
                    </div>          
                </RulerBox>
            </main>
            <Toaster position="top-right" />
        </TopFrame>
    );
    
}

export async function getServerSideProps(ctx: any) {
    let imgId = ctx?.query?.roomId;
    let image = null;
    if(imgId){
        image = await prisma.room.findUnique({
            where: {
                id: imgId,
            },
        });
    }
    monitor.logUserRequest(ctx);
    return {
        props: {
            simRoomBody : await rmu.getRoomBody(ctx?.query?.simRoomId),                                    
            image,
            config
        },
    };
  
}   
