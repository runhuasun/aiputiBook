declare module 'officegen';
declare module 'pptx-parser';
declare module 'pptxtemplater';


declare namespace WeixinJSBridge {
  function invoke(action: string, data?: any, callback?: (res: any) => void): void;
}
