import { Uploader, UploadWidgetLocale, UploadWidgetConfig } from "uploader";

// Configuration for the uploader
  export const uploader = Uploader({
    apiKey: !!process.env.NEXT_PUBLIC_UPLOAD_API_KEY
      ? process.env.NEXT_PUBLIC_UPLOAD_API_KEY
      : "free",
  });

 export const cnLocale: UploadWidgetLocale = {
    "error!": "错误!",
    "done": "完成",
    "addAnotherFile": "添加另外一个文件...",
    "addAnotherImage": "添加另外一个图片...",
    "cancel": "取消",
    "cancelled!": "取消了",
    "continue": "继续",
    "customValidationFailed": "文件验证失败.",
    "crop": "裁剪",
    "finish": "完成",
    "finishIcon": true,
    "image": "图片",
    "maxFilesReached": "超过最多文件数",
    "maxImagesReached": "超过最多图片数",
    "maxSize": "尺寸不能大于:",
    "next": "下一个",
    "of": "的",
    "orDragDropFile": "", // "也可以拖动文件到这里...",
    "orDragDropFiles": "", // "也可以拖动文件到这里...",
    "orDragDropImage": "", // "也可以拖动一张图片到这里...",
    "orDragDropImages": "", // "也可以拖动多张图片到这里...",
    "pleaseWait": "请稍等...",
    "removed!": "删除了",
    "remove": "删除",
    "skip": "Skip",
    "unsupportedFileType": "不支持的文件类型",
    "uploadFile": "上传文件(<50M)",
    "uploadFiles": "上传文件(<50M)", // We've now chosen to use singular tense for the upload button.
    "uploadImage": "上传图片(<20M)",
    "uploadImages": "上传图片(<20M)", // We've now chosen to use singular tense for the upload button.
//    "validatingFile": "正在验证文件...",
  "cancelInPreviewWindow": "取消（在预览窗口）",
  "processingFile": "正在处理文件",   
  };
  
  export const uploaderOptions:UploadWidgetConfig = {
    locale: cnLocale,
    maxFileSizeBytes: 20485760,
    maxFileCount: 1,
    mimeTypes: ["image/jpeg", "image/png", "image/jpg", "image/webp"], 
    path:{
      fileName: "{UNIQUE_DIGITS_6}{ORIGINAL_FILE_EXT}",
      folderPath: "/U/{UTC_YEAR}/{UTC_MONTH}/{UTC_DAY}",
    },
    editor: { images: { crop: false } },
    tags: ["AIPUTI"],
    styles: {
      colors: {
        primary: "#104535", // Primary buttons & links
        error: "#d23f4d", // Error messages
        shade100: "#bbbbbb", // Standard text
        shade200: "#bbbbbb", // Secondary button text
        shade300: "#bbbbbb", // Secondary button text (hover)
        shade400: "#bbbbbb", // Welcome text
        shade500: "#bbbbbb", // Modal close button
        shade600: "#888888", // Border
        shade700: "#eeeeee", // Progress indicator background
        shade800: "#eeeeee", // File item background
        shade900: "#ffffff", // Various (draggable crop buttons, etc.
      },
    },
//    onValidate: async (file: File): Promise<undefined | string> => {
 //     return data.remainingGenerations === 0
//        ? `您已经没有提子了，请购买`
//        : undefined;
//    },
  };

  export const uploaderAudioOptions = {
    locale: cnLocale,
    maxFileSizeBytes: 20485760,
    maxFileCount: 1,
    mimeTypes: ["audio/mpeg","audio/wav"],
    path:{
      fileName: "{UNIQUE_DIGITS_6}{ORIGINAL_FILE_EXT}",
      folderPath: "/U/{UTC_YEAR}/{UTC_MONTH}/{UTC_DAY}",
    },
    editor: { images: { crop: false } },
    tags: ["AIPUTI"],
    styles: {
      colors: {
        primary: "#104535", // Primary buttons & links
        error: "#d23f4d", // Error messages
        shade100: "#bbbbbb", // Standard text
        shade200: "#bbbbbb", // Secondary button text
        shade300: "#bbbbbb", // Secondary button text (hover)
        shade400: "#bbbbbb", // Welcome text
        shade500: "#bbbbbb", // Modal close button
        shade600: "#888888", // Border
        shade700: "#eeeeee", // Progress indicator background
        shade800: "#eeeeee", // File item background
        shade900: "#ffffff", // Various (draggable crop buttons, etc.
      },
    },
  };

  export const uploaderVideoOptions = {
    locale: cnLocale,
    maxFileSizeBytes: 512000000,
    maxFileCount: 1,
    mimeTypes: ["video/mp4","video/quicktime","video/x-msvideo","video/x-ms-wmv"],
    path:{
      fileName: "{UNIQUE_DIGITS_6}{ORIGINAL_FILE_EXT}",
      folderPath: "/U/{UTC_YEAR}/{UTC_MONTH}/{UTC_DAY}",
    },
    editor: { images: { crop: false } },
    tags: ["AIPUTI"],
    styles: {
      colors: {
        primary: "#104535", // Primary buttons & links
        error: "#d23f4d", // Error messages
        shade100: "#bbbbbb", // Standard text
        shade200: "#bbbbbb", // Secondary button text
        shade300: "#bbbbbb", // Secondary button text (hover)
        shade400: "#bbbbbb", // Welcome text
        shade500: "#bbbbbb", // Modal close button
        shade600: "#888888", // Border
        shade700: "#eeeeee", // Progress indicator background
        shade800: "#eeeeee", // File item background
        shade900: "#ffffff", // Various (draggable crop buttons, etc.
      },
    },
  };
