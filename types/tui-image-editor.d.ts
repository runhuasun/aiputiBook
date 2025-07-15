// types/tui-image-editor.d.ts
declare module 'tui-image-editor' {
  export default class TuiImageEditor {
    loadImageFromURL(url: string, imageName: string): Promise<void>;
    clearObjects(): void;
    getCanvas(): HTMLCanvasElement;
    toDataURL(type?: string, quality?: number): string;
    getCanvasSize(): { width: number; height: number };
    setDrawingShape(shape: 'rect' | 'circle' | 'triangle'): void;
    setColor(color: string): void;
    setBrushWidth(width: number): void;
    undo(): void;
    redo(): void;
  }
}

