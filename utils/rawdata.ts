import {config} from "./config";

export function getFileIcon(fileUrl:string){
    
    const name = fileUrl.split("/").pop();
    const ext = name!.split(".").pop(); 

    switch(ext){
        case "jpg":
        case "png":
        case "gif":
        case "webp":
        case "jpeg":
            return fileUrl;
        case "pdf":
            return `${config.RS}/icon/pdf.jpg`;
        case "ppt":
        case "pptx":
            return `${config.RS}/icon/ppt.jpg`;
        case "doc":
        case "docx":
            return `${config.RS}/icon/word.jpg`;
        case "xls":
        case "xlsx":
            return `${config.RS}/icon/excel.jpg`;
        case "txt":
            return `${config.RS}/icon/txt.jpg`;
        case "zip":
            return `${config.RS}/icon/zip.jpg`;
        default:
            return `${config.RS}/sd_logo.jpg`;
    }
            
}

export function getFileTypeByMime(mime:string){
    switch(mime){
        case "text/plain":
        case "application/pdf":
        case "application/vnd.ms-powerpoint":
        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        case "application/vnd.ms-excel":
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return "TEXT";
        case "image/jpeg":
        case "image/png":
        case "image/jpg":
        case "image/webp":
            return "IMAGE";
        default:
            return "TEXT";
    }
}


export function getFileType(fileUrl:string){
    
    const name = fileUrl.split("/").pop();
    const ext = name!.split(".").pop(); 

    switch(ext){
        case "jpg":
        case "png":
        case "gif":
        case "webp":
        case "jpeg":
            return "IMAGE";
        case "pdf":
        case "ppt":
        case "pptx":
        case "doc":
        case "docx":
        case "xls":
        case "xlsx":
        case "txt":
            return "TEXT";
        case "zip":
            return "ZIP";
        default:
            return "TEXT";
    }
            
}
