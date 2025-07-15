////////////////////////////////////////////////////////////////////////////
// 这个文件只放前台函数

import {config} from "./config";
import * as debug from "./debug";
import * as enums from "./enums";
import { EventEmitter } from 'events';
import validator from 'validator';
import * as bs from "./bytescale";
import axios from "axios";


type MimeTypes = typeof mimeTypes;
type MimeCategory = keyof MimeTypes;
/**
 * 判断给定的 MIME 类型属于哪一类
 * @param mimeType - 要判断的 MIME 类型
 * @returns 'image', 'audio' 或 'unknown'
 */
function getType(mimeType: string): MimeCategory | 'unknown' {
    for (const category of Object.keys(mimeTypes) as MimeCategory[]) {
        if (mimeType in mimeTypes[category]) {
            return category;
        }
    }
    return 'unknown';
}


// time: 毫秒数
export function getVideoPoster(url: string, time: number = 100): string {
    if (isURL(url) && getFileTypeByURL(url) === "VIDEO") {
        const fileserver = getFileServerOfURL(url);
        switch (fileserver) {
            case enums.fileServer.OSS: // 阿里云 OSS
                if (url.includes("?x-oss-process")) {
                    return `${url}/snapshot,t_${time},f_jpg`;
                } else {
                    return `${url}?x-oss-process=video/snapshot,t_${time},f_jpg`;
                }

            case enums.fileServer.COS: // 腾讯云 COS
                // 腾讯的 snapshot 参数形式：ci-process=video/snapshot&time=10&format=jpg
                if (url.includes("?")) {
                    return `${url}&ci-process=video/snapshot&time=${time / 1000}&format=jpg`;
                } else {
                    return `${url}?ci-process=video/snapshot&time=${time / 1000}&format=jpg`;
                }

            case enums.fileServer.BYTESCALE:
                // Bytescale 使用 thumbnail 参数：https://docs.bytescale.com/video#thumbnails
                return `${url}?thumbnail=${time}ms.jpg`;

            default:
                // 默认策略：附加 poster 标记用于 cache busting，但不真正生成快照
                return `${url}#poster=${time}`;
        }
    }
    return url;
}

export async function captureVideoFrame(videoUrl: string, time = 0.1): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous"; // 若视频支持 CORS
        video.src = videoUrl;
        video.preload = "auto";
        video.muted = true; // 必须静音才能 autoplay

        video.addEventListener("loadeddata", () => {
            // 设置目标时间点
            video.currentTime = time;
        });

        video.addEventListener("seeked", () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject("Canvas 2D context 获取失败");

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 输出 base64 poster
            const dataURL = canvas.toDataURL("image/jpeg", 0.8); // 可调质量
            resolve(dataURL);
        });

        video.addEventListener("error", () => {
            reject("视频加载失败，可能是不支持跨域或 URL 无效");
        });
    });
}



export function getFileTypeByMime(mimeType:string){
    if(mimeType.indexOf("image")>=0){
        return "IMAGE";
    }else if(mimeType.indexOf("audio")>=0){
        return "VOICE";
    }else if(mimeType.indexOf("video")>=0){
        return "VIDEO";
    }else if(getType(mimeType) == "text"){
        return "TEXT";
    }else if(getType(mimeType) == "zip"){
        return "ZIP";
    }
}

export function getFileTypeByURL(url:string){
    url = url.toLowerCase();
    if(url.indexOf(".mp3")>0 || url.indexOf(".wav")>0 || url.indexOf(".ogg")>0){
        return "VOICE";
    }
    if(url.indexOf(".mp4")>0 || url.indexOf(".mpeg")>0){
        return "VIDEO";
    }
    if(url.indexOf(".jpg")>0 || url.indexOf(".png")>0 || url.indexOf(".jpeg")>0 || url.indexOf(".gif")>0 || url.indexOf(".webp")>0){
        return "IMAGE";
    }
    return "UNKONWN";
}

export const mimeTypes = {
    image: {
        'image/jpeg': ['.jpeg', '.jpg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        
        'image/bmp': ['.bmp'],
        'image/gif': ['.gif'],        
        'image/tiff': ['.tif'],
        'image/heic': ['.heic'],
        'image/heif': ['.heif'],
        'image/pjpeg': ['.jfif' ],

        'image/x-canon-cr2': ['.cr2'],
        'image/x-nikon-nef': ['.nef'],
        'image/x-sony-arw': ['.arw'],
        'image/x-adobe-dng': ['.dng'],        
    },
    raw: {
        'image/x-canon-cr2': ['.cr2'],
        'image/x-nikon-nef': ['.nef'],
        'image/x-sony-arw': ['.arw'],
        'image/x-adobe-dng': ['.dng'],
    },
    audio: {
        "audio/mpeg": ['.mp3','.mpga'],
        "audio/wav": ['.wav'],
        "audio/ogg": ['.ogg'],
        "audio/m4a": ['.m4a'],
        "audio/aac": ['.aac'],
    },
    video: {
        "video/mp4": ['.mp4'],
        "video/mpeg": ['.mpeg'],
        "video/x-msvideo": ['.avi'],
        "video/x-ms-asf": [".asf"],
        "video/quicktime": [".mov"],
        "video/x-ms-wmv": [".wmv"],
        "video/x-matroska": [".mkv"],
        "video/x-flv": [".flv"],
        "video/3gpp": [".3gp"],
        "video/vc1": [".vc1"]
    },
    imageAndVideo:{
        'image/jpeg': ['.jpeg', '.jpg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'image/bmp': ['.bmp'],
        "video/mp4": ['.mp4'],
        "video/mpeg": ['.mpeg'],
        "video/x-msvideo": ['.avi'],
        "video/x-ms-asf": [".asf"],
        "video/quicktime": [".mov"],
        "video/x-ms-wmv": [".wmv"],
        "video/x-matroska": [".mkv"],
        "video/x-flv": [".flv"],
        "video/3gpp": [".3gp"],
        "video/vc1": [".vc1"]
    },
    file: {
        "text/plain": ['.txt'], 
        "application/pdf": ['.pdf'],
        "application/vnd.ms-powerpoint": ['.ppt'],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ['.pptx'],
        "application/vnd.ms-excel": ['.xls'],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ['.xlsx'],
        "application/msword": ['.doc'],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ['.docx'],
        'image/jpeg': ['.jpeg', '.jpg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'image/bmp': ['.bmp']    
    },
    text: {
        "text/plain": ['.txt'], 
        "application/pdf": ['.pdf'],
        "application/vnd.ms-powerpoint": ['.ppt'],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ['.pptx'],
        "application/vnd.ms-excel": ['.xls'],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ['.xlsx'],
        "application/msword": ['.doc'],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ['.docx'],
    },
    zip:{
        "application/x-zip-compressed": ['.zip']
    }
}

export const mimes = new Map([
        ["323", "text/h323"],
        ["3g2", "video/3gpp2"],
        ["3gp", "video/3gpp"],
        ["3gp2", "video/3gpp2"],
        ["3gpp", "video/3gpp"],
        ["7z", "application/x-7z-compressed"],
        ["aa", "audio/audible"],
        ["aac", "audio/aac"],
        ["aaf", "application/octet-stream"],
        ["aax", "audio/vnd.audible.aax"],
        ["ac3", "audio/ac3"],
        ["aca", "application/octet-stream"],
        ["accda", "application/msaccess.addin"],
        ["accdb", "application/msaccess"],
        ["accdc", "application/msaccess.cab"],
        ["accde", "application/msaccess"],
        ["accdr", "application/msaccess.runtime"],
        ["accdt", "application/msaccess"],
        ["accdw", "application/msaccess.webapplication"],
        ["accft", "application/msaccess.ftemplate"],
        ["acx", "application/internet-property-stream"],
        ["AddIn", "text/xml"],
        ["ade", "application/msaccess"],
        ["adobebridge", "application/x-bridge-url"],
        ["adp", "application/msaccess"],
        ["ADT", "audio/vnd.dlna.adts"],
        ["ADTS", "audio/aac"],
        ["afm", "application/octet-stream"],
        ["ai", "application/postscript"],
        ["aif", "audio/x-aiff"],
        ["aifc", "audio/aiff"],
        ["aiff", "audio/aiff"],
        ["air", "application/vnd.adobe.air-application-installer-package+zip"],
        ["amc", "application/x-mpeg"],
        ["application", "application/x-ms-application"],
        ["art", "image/x-jg"],
        ["asa", "application/xml"],
        ["asax", "application/xml"],
        ["ascx", "application/xml"],
        ["asd", "application/octet-stream"],
        ["asf", "video/x-ms-asf"],
        ["ashx", "application/xml"],
        ["asi", "application/octet-stream"],
        ["asm", "text/plain"],
        ["asmx", "application/xml"],
        ["aspx", "application/xml"],
        ["asr", "video/x-ms-asf"],
        ["asx", "video/x-ms-asf"],
        ["atom", "application/atom+xml"],
        ["au", "audio/basic"],
        ["avi", "video/x-msvideo"],
        ["axs", "application/olescript"],
        ["bas", "text/plain"],
        ["bcpio", "application/x-bcpio"],
        ["bin", "application/octet-stream"],
        ["bmp", "image/bmp"],
        ["c", "text/plain"],
        ["cab", "application/octet-stream"],
        ["caf", "audio/x-caf"],
        ["calx", "application/vnd.ms-office.calx"],
        ["cat", "application/vnd.ms-pki.seccat"],
        ["cc", "text/plain"],
        ["cd", "text/plain"],
        ["cdda", "audio/aiff"],
        ["cdf", "application/x-cdf"],
        ["cer", "application/x-x509-ca-cert"],
        ["chm", "application/octet-stream"],
        ["class", "application/x-java-applet"],
        ["clp", "application/x-msclip"],
        ["cmx", "image/x-cmx"],
        ["cnf", "text/plain"],
        ["cod", "image/cis-cod"],
        ["config", "application/xml"],
        ["contact", "text/x-ms-contact"],
        ["coverage", "application/xml"],
        ["cpio", "application/x-cpio"],
        ["cpp", "text/plain"],
        ["crd", "application/x-mscardfile"],
        ["crl", "application/pkix-crl"],
        ["crt", "application/x-x509-ca-cert"],
        ["cs", "text/plain"],
        ["csdproj", "text/plain"],
        ["csh", "application/x-csh"],
        ["csproj", "text/plain"],
        ["css", "text/css"],
        ["csv", "text/csv"],
        ["cur", "application/octet-stream"],
        ["cxx", "text/plain"],
        ["dat", "application/octet-stream"],
        ["datasource", "application/xml"],
        ["dbproj", "text/plain"],
        ["dcr", "application/x-director"],
        ["def", "text/plain"],
        ["deploy", "application/octet-stream"],
        ["der", "application/x-x509-ca-cert"],
        ["dgml", "application/xml"],
        ["dib", "image/bmp"],
        ["dif", "video/x-dv"],
        ["dir", "application/x-director"],
        ["disco", "text/xml"],
        ["dll", "application/x-msdownload"],
        ["dll.config", "text/xml"],
        ["dlm", "text/dlm"],
        ["doc", "application/msword"],
        ["docm", "application/vnd.ms-word.document.macroEnabled.12"],
        ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ["dot", "application/msword"],
        ["dotm", "application/vnd.ms-word.template.macroEnabled.12"],
        ["dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template"],
        ["dsp", "application/octet-stream"],
        ["dsw", "text/plain"],
        ["dtd", "text/xml"],
        ["dtsConfig", "text/xml"],
        ["dv", "video/x-dv"],
        ["dvi", "application/x-dvi"],
        ["dwf", "drawing/x-dwf"],
        ["dwp", "application/octet-stream"],
        ["dxr", "application/x-director"],
        ["eml", "message/rfc822"],
        ["emz", "application/octet-stream"],
        ["eot", "application/octet-stream"],
        ["eps", "application/postscript"],
        ["etl", "application/etl"],
        ["etx", "text/x-setext"],
        ["evy", "application/envoy"],
        ["exe", "application/octet-stream"],
        ["exe.config", "text/xml"],
        ["fdf", "application/vnd.fdf"],
        ["fif", "application/fractals"],
        ["filters", "Application/xml"],
        ["fla", "application/octet-stream"],
        ["flr", "x-world/x-vrml"],
        ["flv", "video/x-flv"],
        ["fsscript", "application/fsharp-script"],
        ["fsx", "application/fsharp-script"],
        ["generictest", "application/xml"],
        ["gif", "image/gif"],
        ["group", "text/x-ms-group"],
        ["gsm", "audio/x-gsm"],
        ["gtar", "application/x-gtar"],
        ["gz", "application/x-gzip"],
        ["h", "text/plain"],
        ["hdf", "application/x-hdf"],
        ["hdml", "text/x-hdml"],
        ["hhc", "application/x-oleobject"],
        ["hhk", "application/octet-stream"],
        ["hhp", "application/octet-stream"],
        ["hlp", "application/winhlp"],
        ["hpp", "text/plain"],
        ["hqx", "application/mac-binhex40"],
        ["hta", "application/hta"],
        ["htc", "text/x-component"],
        ["htm", "text/html"],
        ["html", "text/html"],
        ["htt", "text/webviewhtml"],
        ["hxa", "application/xml"],
        ["hxc", "application/xml"],
        ["hxd", "application/octet-stream"],
        ["hxe", "application/xml"],
        ["hxf", "application/xml"],
        ["hxh", "application/octet-stream"],
        ["hxi", "application/octet-stream"],
        ["hxk", "application/xml"],
        ["hxq", "application/octet-stream"],
        ["hxr", "application/octet-stream"],
        ["hxs", "application/octet-stream"],
        ["hxt", "text/html"],
        ["hxv", "application/xml"],
        ["hxw", "application/octet-stream"],
        ["hxx", "text/plain"],
        ["i", "text/plain"],
        ["ico", "image/x-icon"],
        ["ics", "application/octet-stream"],
        ["idl", "text/plain"],
        ["ief", "image/ief"],
        ["iii", "application/x-iphone"],
        ["inc", "text/plain"],
        ["inf", "application/octet-stream"],
        ["inl", "text/plain"],
        ["ins", "application/x-internet-signup"],
        ["ipa", "application/x-itunes-ipa"],
        ["ipg", "application/x-itunes-ipg"],
        ["ipproj", "text/plain"],
        ["ipsw", "application/x-itunes-ipsw"],
        ["iqy", "text/x-ms-iqy"],
        ["isp", "application/x-internet-signup"],
        ["ite", "application/x-itunes-ite"],
        ["itlp", "application/x-itunes-itlp"],
        ["itms", "application/x-itunes-itms"],
        ["itpc", "application/x-itunes-itpc"],
        ["IVF", "video/x-ivf"],
        ["jar", "application/java-archive"],
        ["java", "application/octet-stream"],
        ["jck", "application/liquidmotion"],
        ["jcz", "application/liquidmotion"],
        ["jfif", "image/pjpeg"],
        ["jnlp", "application/x-java-jnlp-file"],
        ["jpb", "application/octet-stream"],
        ["jpe", "image/jpeg"],
        ["jpeg", "image/jpeg"],
        ["jpg", "image/jpeg"],
        ["js", "application/x-javascript"],
        ["json", "application/json"],
        ["jsx", "text/jscript"],
        ["jsxbin", "text/plain"],
        ["latex", "application/x-latex"],
        ["library-ms", "application/windows-library+xml"],
        ["lit", "application/x-ms-reader"],
        ["loadtest", "application/xml"],
        ["lpk", "application/octet-stream"],
        ["lsf", "video/x-la-asf"],
        ["lst", "text/plain"],
        ["lsx", "video/x-la-asf"],
        ["lzh", "application/octet-stream"],
        ["m13", "application/x-msmediaview"],
        ["m14", "application/x-msmediaview"],
        ["m1v", "video/mpeg"],
        ["m2t", "video/vnd.dlna.mpeg-tts"],
        ["m2ts", "video/vnd.dlna.mpeg-tts"],
        ["m2v", "video/mpeg"],
        ["m3u", "audio/x-mpegurl"],
        ["m3u8", "audio/x-mpegurl"],
        ["m4a", "audio/m4a"],
        ["m4b", "audio/m4b"],
        ["m4p", "audio/m4p"],
        ["m4r", "audio/x-m4r"],
        ["m4v", "video/x-m4v"],
        ["mac", "image/x-macpaint"],
        ["mak", "text/plain"],
        ["man", "application/x-troff-man"],
        ["manifest", "application/x-ms-manifest"],
        ["map", "text/plain"],
        ["master", "application/xml"],
        ["mda", "application/msaccess"],
        ["mdb", "application/x-msaccess"],
        ["mde", "application/msaccess"],
        ["mdp", "application/octet-stream"],
        ["me", "application/x-troff-me"],
        ["mfp", "application/x-shockwave-flash"],
        ["mht", "message/rfc822"],
        ["mhtml", "message/rfc822"],
        ["mid", "audio/mid"],
        ["midi", "audio/mid"],
        ["mix", "application/octet-stream"],
        ["mk", "text/plain"],
        ["mmf", "application/x-smaf"],
        ["mno", "text/xml"],
        ["mny", "application/x-msmoney"],
        ["mod", "video/mpeg"],
        ["mov", "video/quicktime"],
        ["movie", "video/x-sgi-movie"],
        ["mp2", "video/mpeg"],
        ["mp2v", "video/mpeg"],
        ["mp3", "audio/mpeg"],
        ["mp4", "video/mp4"],
        ["mp4v", "video/mp4"],
        ["mpa", "video/mpeg"],
        ["mpe", "video/mpeg"],
        ["mpeg", "video/mpeg"],
        ["mkv", "video/x-matroska"],
        ["mpf", "application/vnd.ms-mediapackage"],
        ["mpg", "video/mpeg"],
        ["mpp", "application/vnd.ms-project"],
        ["mpv2", "video/mpeg"],
        ["mqv", "video/quicktime"],
        ["ms", "application/x-troff-ms"],
        ["msi", "application/octet-stream"],
        ["mso", "application/octet-stream"],
        ["mts", "video/vnd.dlna.mpeg-tts"],
        ["mtx", "application/xml"],
        ["mvb", "application/x-msmediaview"],
        ["mvc", "application/x-miva-compiled"],
        ["mxp", "application/x-mmxp"],
        ["nc", "application/x-netcdf"],
        ["nsc", "video/x-ms-asf"],
        ["nws", "message/rfc822"],
        ["ocx", "application/octet-stream"],
        ["oda", "application/oda"],
        ["odc", "text/x-ms-odc"],
        ["odh", "text/plain"],
        ["odl", "text/plain"],
        ["odp", "application/vnd.oasis.opendocument.presentation"],
        ["ods", "application/oleobject"],
        ["odt", "application/vnd.oasis.opendocument.text"],
        ["ogg", "audio/ogg"],
        ["one", "application/onenote"],
        ["onea", "application/onenote"],
        ["onepkg", "application/onenote"],
        ["onetmp", "application/onenote"],
        ["onetoc", "application/onenote"],
        ["onetoc2", "application/onenote"],
        ["orderedtest", "application/xml"],
        ["osdx", "application/opensearchdescription+xml"],
        ["p10", "application/pkcs10"],
        ["p12", "application/x-pkcs12"],
        ["p7b", "application/x-pkcs7-certificates"],
        ["p7c", "application/pkcs7-mime"],
        ["p7m", "application/pkcs7-mime"],
        ["p7r", "application/x-pkcs7-certreqresp"],
        ["p7s", "application/pkcs7-signature"],
        ["pbm", "image/x-portable-bitmap"],
        ["pcast", "application/x-podcast"],
        ["pct", "image/pict"],
        ["pcx", "application/octet-stream"],
        ["pcz", "application/octet-stream"],
        ["pdf", "application/pdf"],
        ["pfb", "application/octet-stream"],
        ["pfm", "application/octet-stream"],
        ["pfx", "application/x-pkcs12"],
        ["pgm", "image/x-portable-graymap"],
        ["pic", "image/pict"],
        ["pict", "image/pict"],
        ["pkgdef", "text/plain"],
        ["pkgundef", "text/plain"],
        ["pko", "application/vnd.ms-pki.pko"],
        ["pls", "audio/scpls"],
        ["pma", "application/x-perfmon"],
        ["pmc", "application/x-perfmon"],
        ["pml", "application/x-perfmon"],
        ["pmr", "application/x-perfmon"],
        ["pmw", "application/x-perfmon"],
        ["png", "image/png"],
        ["pnm", "image/x-portable-anymap"],
        ["pnt", "image/x-macpaint"],
        ["pntg", "image/x-macpaint"],
        ["pnz", "image/png"],
        ["pot", "application/vnd.ms-powerpoint"],
        ["potm", "application/vnd.ms-powerpoint.template.macroEnabled.12"],
        ["potx", "application/vnd.openxmlformats-officedocument.presentationml.template"],
        ["ppa", "application/vnd.ms-powerpoint"],
        ["ppam", "application/vnd.ms-powerpoint.addin.macroEnabled.12"],
        ["ppm", "image/x-portable-pixmap"],
        ["pps", "application/vnd.ms-powerpoint"],
        ["ppsm", "application/vnd.ms-powerpoint.slideshow.macroEnabled.12"],
        ["ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow"],
        ["ppt", "application/vnd.ms-powerpoint"],
        ["pptm", "application/vnd.ms-powerpoint.presentation.macroEnabled.12"],
        ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        ["prf", "application/pics-rules"],
        ["prm", "application/octet-stream"],
        ["prx", "application/octet-stream"],
        ["ps", "application/postscript"],
        ["psc1", "application/PowerShell"],
        ["psd", "application/octet-stream"],
        ["psess", "application/xml"],
        ["psm", "application/octet-stream"],
        ["psp", "application/octet-stream"],
        ["pub", "application/x-mspublisher"],
        ["pwz", "application/vnd.ms-powerpoint"],
        ["qht", "text/x-html-insertion"],
        ["qhtm", "text/x-html-insertion"],
        ["qt", "video/quicktime"],
        ["qti", "image/x-quicktime"],
        ["qtif", "image/x-quicktime"],
        ["qtl", "application/x-quicktimeplayer"],
        ["qxd", "application/octet-stream"],
        ["ra", "audio/x-pn-realaudio"],
        ["ram", "audio/x-pn-realaudio"],
        ["rar", "application/octet-stream"],
        ["ras", "image/x-cmu-raster"],
        ["rat", "application/rat-file"],
        ["rc", "text/plain"],
        ["rc2", "text/plain"],
        ["rct", "text/plain"],
        ["rdlc", "application/xml"],
        ["resx", "application/xml"],
        ["rf", "image/vnd.rn-realflash"],
        ["rgb", "image/x-rgb"],
        ["rgs", "text/plain"],
        ["rm", "application/vnd.rn-realmedia"],
        ["rmi", "audio/mid"],
        ["rmp", "application/vnd.rn-rn_music_package"],
        ["roff", "application/x-troff"],
        ["rpm", "audio/x-pn-realaudio-plugin"],
        ["rqy", "text/x-ms-rqy"],
        ["rtf", "application/rtf"],
        ["rtx", "text/richtext"],
        ["ruleset", "application/xml"],
        ["s", "text/plain"],
        ["safariextz", "application/x-safari-safariextz"],
        ["scd", "application/x-msschedule"],
        ["sct", "text/scriptlet"],
        ["sd2", "audio/x-sd2"],
        ["sdp", "application/sdp"],
        ["sea", "application/octet-stream"],
        ["searchConnector-ms", "application/windows-search-connector+xml"],
        ["setpay", "application/set-payment-initiation"],
        ["setreg", "application/set-registration-initiation"],
        ["settings", "application/xml"],
        ["sgimb", "application/x-sgimb"],
        ["sgml", "text/sgml"],
        ["sh", "application/x-sh"],
        ["shar", "application/x-shar"],
        ["shtml", "text/html"],
        ["sit", "application/x-stuffit"],
        ["sitemap", "application/xml"],
        ["skin", "application/xml"],
        ["sldm", "application/vnd.ms-powerpoint.slide.macroEnabled.12"],
        ["sldx", "application/vnd.openxmlformats-officedocument.presentationml.slide"],
        ["slk", "application/vnd.ms-excel"],
        ["sln", "text/plain"],
        ["slupkg-ms", "application/x-ms-license"],
        ["smd", "audio/x-smd"],
        ["smi", "application/octet-stream"],
        ["smx", "audio/x-smd"],
        ["smz", "audio/x-smd"],
        ["snd", "audio/basic"],
        ["snippet", "application/xml"],
        ["snp", "application/octet-stream"],
        ["sol", "text/plain"],
        ["sor", "text/plain"],
        ["spc", "application/x-pkcs7-certificates"],
        ["spl", "application/futuresplash"],
        ["src", "application/x-wais-source"],
        ["srf", "text/plain"],
        ["SSISDeploymentManifest", "text/xml"],
        ["ssm", "application/streamingmedia"],
        ["sst", "application/vnd.ms-pki.certstore"],
        ["stl", "application/vnd.ms-pki.stl"],
        ["sv4cpio", "application/x-sv4cpio"],
        ["sv4crc", "application/x-sv4crc"],
        ["svc", "application/xml"],
        ["swf", "application/x-shockwave-flash"],
        ["t", "application/x-troff"],
        ["tar", "application/x-tar"],
        ["tcl", "application/x-tcl"],
        ["testrunconfig", "application/xml"],
        ["testsettings", "application/xml"],
        ["tex", "application/x-tex"],
        ["texi", "application/x-texinfo"],
        ["texinfo", "application/x-texinfo"],
        ["tgz", "application/x-compressed"],
        ["thmx", "application/vnd.ms-officetheme"],
        ["thn", "application/octet-stream"],
        ["tif", "image/tiff"],
        ["tiff", "image/tiff"],
        ["tlh", "text/plain"],
        ["tli", "text/plain"],
        ["toc", "application/octet-stream"],
        ["tr", "application/x-troff"],
        ["trm", "application/x-msterminal"],
        ["trx", "application/xml"],
        ["ts", "video/vnd.dlna.mpeg-tts"],
        ["tsv", "text/tab-separated-values"],
        ["ttf", "application/octet-stream"],
        ["tts", "video/vnd.dlna.mpeg-tts"],
        ["txt", "text/plain"],
        ["u32", "application/octet-stream"],
        ["uls", "text/iuls"],
        ["user", "text/plain"],
        ["ustar", "application/x-ustar"],
        ["vb", "text/plain"],
        ["vbdproj", "text/plain"],
        ["vbk", "video/mpeg"],
        ["vbproj", "text/plain"],
        ["vbs", "text/vbscript"],
        ["vc1", "video/vc1"],
        ["vcf", "text/x-vcard"],
        ["vcproj", "Application/xml"],
        ["vcs", "text/plain"],
        ["vcxproj", "Application/xml"],
        ["vddproj", "text/plain"],
        ["vdp", "text/plain"],
        ["vdproj", "text/plain"],
        ["vdx", "application/vnd.ms-visio.viewer"],
        ["vml", "text/xml"],
        ["vscontent", "application/xml"],
        ["vsct", "text/xml"],
        ["vsd", "application/vnd.visio"],
        ["vsi", "application/ms-vsi"],
        ["vsix", "application/vsix"],
        ["vsixlangpack", "text/xml"],
        ["vsixmanifest", "text/xml"],
        ["vsmdi", "application/xml"],
        ["vspscc", "text/plain"],
        ["vss", "application/vnd.visio"],
        ["vsscc", "text/plain"],
        ["vssettings", "text/xml"],
        ["vssscc", "text/plain"],
        ["vst", "application/vnd.visio"],
        ["vstemplate", "text/xml"],
        ["vsto", "application/x-ms-vsto"],
        ["vsw", "application/vnd.visio"],
        ["vsx", "application/vnd.visio"],
        ["vtx", "application/vnd.visio"],
        ["wav", "audio/wav"],
        ["wave", "audio/wav"],
        ["wax", "audio/x-ms-wax"],
        ["wbk", "application/msword"],
        ["wbmp", "image/vnd.wap.wbmp"],
        ["wcm", "application/vnd.ms-works"],
        ["wdb", "application/vnd.ms-works"],
        ["wdp", "image/vnd.ms-photo"],
        ["webarchive", "application/x-safari-webarchive"],
        ["webtest", "application/xml"],
        ["webm", "video/webm‌"],
        ["wiq", "application/xml"],
        ["wiz", "application/msword"],
        ["wks", "application/vnd.ms-works"],
        ["WLMP", "application/wlmoviemaker"],
        ["wlpginstall", "application/x-wlpg-detect"],
        ["wlpginstall3", "application/x-wlpg3-detect"],
        ["wm", "video/x-ms-wm"],
        ["wma", "audio/x-ms-wma"],
        ["wmd", "application/x-ms-wmd"],
        ["wmf", "application/x-msmetafile"],
        ["wml", "text/vnd.wap.wml"],
        ["wmlc", "application/vnd.wap.wmlc"],
        ["wmls", "text/vnd.wap.wmlscript"],
        ["wmlsc", "application/vnd.wap.wmlscriptc"],
        ["wmp", "video/x-ms-wmp"],
        ["wmv", "video/x-ms-wmv"],
        ["wmx", "video/x-ms-wmx"],
        ["wmz", "application/x-ms-wmz"],
        ["wpl", "application/vnd.ms-wpl"],
        ["wps", "application/vnd.ms-works"],
        ["wri", "application/x-mswrite"],
        ["wrl", "x-world/x-vrml"],
        ["wrz", "x-world/x-vrml"],
        ["wsc", "text/scriptlet"],
        ["wsdl", "text/xml"],
        ["wvx", "video/x-ms-wvx"],
        ["x", "application/directx"],
        ["xaf", "x-world/x-vrml"],
        ["xaml", "application/xaml+xml"],
        ["xap", "application/x-silverlight-app"],
        ["xbap", "application/x-ms-xbap"],
        ["xbm", "image/x-xbitmap"],
        ["xdr", "text/plain"],
        ["xht", "application/xhtml+xml"],
        ["xhtml", "application/xhtml+xml"],
        ["xla", "application/vnd.ms-excel"],
        ["xlam", "application/vnd.ms-excel.addin.macroEnabled.12"],
        ["xlc", "application/vnd.ms-excel"],
        ["xld", "application/vnd.ms-excel"],
        ["xlk", "application/vnd.ms-excel"],
        ["xll", "application/vnd.ms-excel"],
        ["xlm", "application/vnd.ms-excel"],
        ["xls", "application/vnd.ms-excel"],
        ["xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
        ["xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
        ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        ["xlt", "application/vnd.ms-excel"],
        ["xltm", "application/vnd.ms-excel.template.macroEnabled.12"],
        ["xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
        ["xlw", "application/vnd.ms-excel"],
        ["xml", "text/xml"],
        ["xmta", "application/xml"],
        ["xof", "x-world/x-vrml"],
        ["XOML", "text/plain"],
        ["xpm", "image/x-xpixmap"],
        ["xps", "application/vnd.ms-xpsdocument"],
        ["xrm-ms", "text/xml"],
        ["xsc", "application/xml"],
        ["xsd", "text/xml"],
        ["xsf", "text/xml"],
        ["xsl", "text/xml"],
        ["xslt", "text/xml"],
        ["xsn", "application/octet-stream"],
        ["xss", "application/xml"],
        ["xtp", "application/octet-stream"],
        ["xwd", "image/x-xwindowdump"],
        ["z", "application/x-compress"],
        ["zip", "application/x-zip-compressed"]
    ]);


export async function getMimeOfURL(url:string){
    const ext = getFileExtFromURL(url);
    debug.log("ext:" + ext);
    let mime:any = null;
    if(ext && ext!="image"){
        mime = getMimeByExt(ext);
        debug.log("getMimeOfURL mime 1:" + mime);        
    }
    if(!mime){
        mime = await getMimeByHeader(url);       
        debug.log("getMimeOfURL mime 2:" + mime);        
    }
    return mime;
}

export function getMimeByExt(ext: string){
    debug.log("getMimeByExt", ext);    
    return mimes.get(ext);
}

export async function getMimeByHeader(url:string){
    debug.log("getMimeByHeader:", url);
    try{
        const response = await fetch(url);
        const mimeType = response.headers.get('Content-Type');
        return mimeType;
    }catch(err){
        debug.error('Exception fetching MIME type:', err);
        return null;
    }
}


export function appendNewToName(name: string) {
    let insertPos = name.indexOf(".");
    let newName = name
        .substring(0, insertPos)
        .concat("-new", name.substring(insertPos));
    return newName;
}


export function getFileExtFromURL(url:string){
    // 从URL中抛弃问号后面的内容
    const fileName = getFileNameFromURL(url);
    if(fileName){
        // 提取文件名中的扩展名部分
        const tmpAry = fileName.split('.');
        if(tmpAry.length > 1){
            return tmpAry.pop();
        }
    }
    return "";    
}

export function getFileNameFromURL(url:string){
    // 创建URL对象
    const urlObj = new URL(url);
    // 获取pathname部分
    const pathname = urlObj.pathname;
    // 分割路径并取最后一个部分作为文件名
    const filename = pathname.split('/').pop();
    return filename;
}

function forceDownload(blobUrl: string, filename: string) {
    let a: any = document.createElement("a");
    a.download = filename;
    a.href = blobUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export default function downloadPhoto(url: string, filename?: string) {
    fetch(url, {
        headers: new Headers({
            Origin: location.origin,
        }),
        mode: "cors",
    }).then((response) => response.blob())
        .then((blob) => {
            let blobUrl = window.URL.createObjectURL(blob);
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename || `${generateRandomString(5)}.${getFileExtFromURL(url)}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
            }, 100); // 延迟100ms
        })
        .catch((e) => debug.error(e));
}

// 生成一个字符串，每一位可以是1-10或者大小写字母
export function generateRandomString(length:number) {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomString = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }
    return randomString;
}

export function randomFileName(mime:string, length:number=6){
    const ext = mime ? "" : mime.split("/").pop();
    return `${generateRandomString(length)}.${ext}`;   
}

export async function getRedirectedUrl(url: string){

    try{
        debug.log("getRedirectedUrl url:" + url);
        const response = await fetch(process.env.UTILS_API_PROXY!, { 
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },            
            body: JSON.stringify({
                cmd: 'REDIRECT',
                params:{
                    url
                }
            })
        });
        // debug.log('getRedirectedUrl result is : ', response);
        if(response && response.status == 200){
            const jsonRes = await response.json();
            if(jsonRes){
                return jsonRes.toString();
            }
        }else{
            return url;
        }
    }catch(e){
        debug.error("client side getRedirectedUrl exception");
        debug.error(e);
    }
    // 无法获得redirect url就返回原来的url
    return url;
}


// 前端获得图片的Icon 32x32
export function getImageIcon( fileUrl: string ){
    if(fileUrl){
        if(fileUrl.indexOf("upcdn.io") > 0){
            return getBSImageIcon(fileUrl);
        }else if(fileUrl.indexOf("aliyuncs.com")>=0){
            return getOSSImageIcon(fileUrl);
        }else if(fileUrl.indexOf("myqcloud.com")>=0){
            return getCOSImageIcon(fileUrl);
        }
    }
    return fileUrl;
}


export function getThumbnail(url:string, size: number=576){
    if(url){
        if(url.indexOf("upcdn.io") > 0){
            return url;
        }else if(url.indexOf("aliyuncs.com")>=0){
            return getOSSThumbnail(url, size);
        }else if(url.indexOf("myqcloud.com")>=0){
            return getCOSThumbnail(url, size);
        }
    }
    return url;
}

/*
export function getImageURL( fileUrl: string, hasWatermark: boolean = true, watermarkPath?: string, qrSize:number=80, qrPos:string="bottom-right" ){
    if(fileUrl.indexOf("upcdn.io")>=0){
        return bytescale.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }else if(fileUrl.indexOf("aliyuncs.com")>=0){
        return oss.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }else if(fileUrl.indexOf("myqcloud.com")>=0){
        return cos.processImage(fileUrl, hasWatermark, watermarkPath, qrSize, qrPos);
    }
    return fileUrl;
}

export function addWatermark(fileUrl:string){
    return fileUrl;
}
*/



export function addWatermark(imageURL:string, config:any, user:any){
    let result = imageURL;
    let text = "试用样张，付费用户水印自动删除";
    if(user){
        const userSign = validator.isMobilePhone(user.email, 'zh-CN') ? user.email : user.name;
        text = `${userSign}作品，付费后水印删除`;
    }
    if(result && (getFileTypeByURL(imageURL)=="IMAGE")){
        if(!user.boughtCredits || user.boughtCredits<=0){
            if(config.paymentWatermark == "TRUE"){
                result = addSimpleMark(result, text);
            }else if(config.paymentWatermark == "FULL"){
                result = addFullMark(result, text);
            }
        }
    }
    return result;
}


// 前端获得图片通过这个函数，提前做打水印等操作
export function addSimpleMark(imageURL: string, text?:string){
    let result = imageURL;
    if(!text){
        text = "试用样张，付费用户水印自动删除";
    }
    if(imageURL && imageURL.indexOf("aliyuncs.com")>=0){
        //获得水印的base64编码
        const base64Url = Buffer.from(text).toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
        result += `?x-oss-process=image/watermark,text_${base64Url},color_FFFFFF,size_30,g_center`;
    }
    return result;
}

// 前端获得图片通过这个函数，提前做打水印等操作
export function addFullMark(imageURL: string, text?:string){
    let result = imageURL;
    if(!text){
        text = "试用样张，付费用户水印自动删除";
    }
    if(imageURL && imageURL.indexOf("aliyuncs.com")>=0){
        //获得水印的base64编码
        const base64Url = Buffer.from(text).toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
        result += `?x-oss-process=image/watermark,text_${base64Url},color_FFFFFF,size_30,g_center,fill_1,t_8/watermark,text_${base64Url},color_FFFFFF,size_30,g_south,y_50`;
    }
    return result;
}


// BYTESCALE
// 前端获得图片的Icon 32x32
export function getBSImageIcon( path: string ){
    return path.replace("/raw/", "/jpg32/");
}

// COS
// 前端获得图片的Icon 32x32
export function getCOSImageIcon( url: string ){
    return `${url}?imageMogr2/thumbnail/32x32!`;
}

export function getCOSThumbnail(url:string, size: number=576){
    if(size > 768){
        size = 768;
    }
    if(size < 8){
        size = 8;
    }
    return `${url}?imageMogr2/thumbnail/${size}x`;
}


// OSS
// 前端获得图片的Icon 32x32
export function getOSSImageIcon( url: string ){
    return `${url}?x-oss-process=image/resize,w_32,h_32`;
}


export async function checkURLExists(url:string) {
    try {
        const response = await fetch(url, {
            method: 'HEAD'
        })
        return response.ok;
    } catch (err) {
        debug.error('Error accessing URL:', err);
        return false;
    }
}
/*
export async function getOSSThumbnail(url:string, size: number=576){
    if(size > 768){
        size = 768;
    }
    if(size < 8){
        size = 8;
    }
    // 判断是否有Thumbnail
    const thumbURL = url.replace("/U/", `/S/${size}`);
    if(await checkURLExists(thumbURL)){
        return thumbURL;
    }else{        
        let newFile:string;
        if(url.indexOf("?")>0){
            if(url.indexOf("x-oss-process=image")>=0){
                newFile = `${url}/resize,w_${size}`;        
            }else{
                // 一般这是异常情况
                return url;
            }
        }else{
            newFile = `${url}?x-oss-process=image/resize,w_${size}`;
        }
        // 为了用户响应速度，异步让后台上传一个Thumbnail文件，本次直接先返回OSS的处理结果
        const thumbPath = getPathOfURL(thumbURL);        
        fetch("/api/uploadService", {
            cmd: "UPLOAD_URL",
            fileURL: url,
            newPath: thumbPath
        }).then((res:any)=>{
            log("new thumbnail uploaded:", res.url);
        });
        return newFile;
    }
    return url;
}
*/

export function getOSSThumbnail(url:string, size: number=576){
    if(size > 768){
        size = 768;
    }
    if(size < 8){
        size = 8;
    }
    if(url.indexOf("?")>0){
        if(url.indexOf("x-oss-process=image")>=0){
            return `${url}/resize,w_${size}`;        
        }else{
            return url;
        }
    }else{
        return `${url}?x-oss-process=image/resize,w_${size}`;
    }
}

// 从URL识别存储服务器
export function getFileServerOfURL(url:string){
    if(url.indexOf("upcdn.io")>=0){
        return enums.fileServer.BYTESCALE;
    }else if(url.indexOf("aliyuncs.com")>=0 && url.indexOf(config.ossBucket)>=0){
        return enums.fileServer.OSS;
    }else if(url.indexOf("myqcloud.com")>=0 && url.indexOf(config.cosBucket)>=0){
        return enums.fileServer.COS;
    }else{
        return enums.fileServer.UNKNOWN;
    }
}

// 判断URL是否在美国存储
export function isInUS(url:string){
    const fs = getFileServerOfURL(url);
    return fs != enums.fileServer.OSS && fs != enums.fileServer.COS;
}


export async function checkImageConstraint(src:string|null|undefined, maxSize:{width?:number; height?:number; mb?:number}|null|undefined, showAlert?:boolean){
    let result = "";
    if(src && maxSize){
        if(maxSize.width || maxSize.height){
            const size = await getImageSize(src);
            if(size){
                if(maxSize.width && (size.width > maxSize.width)){
                    result += `您选择的图片宽度${size.width}像素，超过了系统允许的最大宽度${maxSize.width}像素。` + "\n";
                }
                if(maxSize.height && (size.height > maxSize.height)){
                    result += `您选择的图片高度${size.height}像素，超过了系统允许的最大高度${maxSize.height}像素` + "\n";
                }
            }
        }
        if(maxSize.mb){
            const bytes = await getImageBytes(src);
            if(bytes){
                const mb = bytes/1024/1024;
                if(mb > maxSize.mb){
                    result += `您选择的图片大小${Number(mb.toFixed(2))}像素，超过了系统允许的最大高度${maxSize.mb}像素` + "\n";
                }
            }
        }
    }
    if(showAlert && result && result.trim().length>0){
        alert(result);
    }
    
    return result;
}

// 获得一张图片的尺寸
export async function getImageSize(imgURL:string){
    const result = {width:0, height:0};
    const eventEmitter = new EventEmitter(); 
    const imgObj = new window.Image();
    imgObj.onload = () => {
        result.width = imgObj.width;
        result.height = imgObj.height;
        eventEmitter.emit('loadFinished');  
    }
    
    imgObj.src = imgURL;

    // 等待加载完图片
    await new Promise<void>(resolve => {
        eventEmitter.once('loadFinished', () => {
            resolve();
        });
    });      

    return result;
}

// 获得一张图片的字节数
export async function getImageBytes(imgURL:string){
    let result = 0;
    // 发起一个 HEAD 请求来获取文件大小
    try {
        const response = await fetch(imgURL, { method: 'HEAD' });
        if (response.ok) {
            const size = response.headers.get('content-length');
            if (size) {
                result = parseInt(size, 10);
            } else {
                throw new Error('Content-Length header is missing');
            }
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        debug.error('Error fetching image size:', error);
    }
    return result;
}

export async function resizeImage(url:string, newSize: number=2000){
    const size = await getImageSize(url);
    if(size){
        let dir = "w";
        if(size.width < size.height){
            dir = "h";
        }
        if(url.indexOf("x-oss-process=image")>=0){
            return `${url}/resize,${dir}_${newSize}`;        
        }else{
            return `${url}?x-oss-process=image/resize,${dir}_${newSize}`;
        }
    }
}

export function getBase64Code(url:string){    
    if(url){
        const base64Url = Buffer.from(url).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
        return base64Url;
    }
}


export function needProxy(url:string){
    const hardHosts = [
        "https://img.midjourneyapi.xyz",
        "https://img.theapi.app"
    ];
    for(const host of hardHosts){
        if(url.indexOf(host)>=0){
            return true;
        }
    }
}

export async function aliyunImageRestrictResize(imageURL:string, autoResize:boolean=true, size?:any){
    let result = imageURL;

    if(!size){
        size = await getImageSize(imageURL);
    }
    if(size.width<128 || size.height<128){
        return alert (`您的图片的宽${size.width}像素，高${size.height}。这个尺寸太小，系统无法进行正确的处理。请换一张宽高大于128 X 128像素的图片试试！`);
    }
    const bytes = await getImageBytes(imageURL);
    if(bytes && bytes > 20000000){
        return alert(`图片大小不能超过20M字节，请换一张小一点的照片试试`);
    }
    if(autoResize && (size.width>2000 || size.height>2000)){
        // alert(`上传图片的宽${size.width}像素，高${size.height}。这个尺寸太大了，系统无法进行正确的处理，将自动帮您把图片做缩小处理`);  
        const fileServer = getFileServerOfURL(imageURL);
        switch(fileServer){
            case enums.fileServer.BYTESCALE:
                result = await bs.resizeImageTo2000(imageURL);
                break;
            case enums.fileServer.OSS:
                result = await resizeImage(imageURL, 2000) || imageURL;                        
                break;
        }
        //const confirmed = await confirm(`上传图片的宽${size.width}像素，高${size.height}。这个尺寸太大了，系统无法进行正确的处理。将自动帮您把图片做缩小处理`);
        //if(confirmed){
        //    uploadedImageURL = await fu.resizeImage(uploadedImageURL);
       // }else{
        //    alert("好的，请您到照片编辑功能把照片裁剪到宽高小于2047 X 2047像素");
        //    window.open(`/editImage?imageURL=${uploadedImageURL}`, "_blank");
        ///    return;
        //}
    }

    return result;
}

// 判断一个对象是否是base64图片字符串
export function isBase64Image(obj:string){
    // debug.log("---isBase64Image---");
    if(obj && typeof obj == "string"){
        // 正则表达式检测是否base64编码
        const base64Pattern = /^(data:image\/[a-zA-Z]+;base64,)[^\s]+$/;
        return base64Pattern.test(obj);       
    }else{
        return false;
    }
}

// 把base64类型的图片字符串，转换成一个buffer
export function converBase64ToBuffer(base64Str:string){
    // 移除base64图片字符串前面的数据部分（如果有）
    // 这一部分不是图片数据本身，而是一个标识符，指示数据类型和编码方式
    const matches = base64Str.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    // debug.log("---converBase64ToBuffer---", matches, matches?.length);
    if (matches?.length !== 3) {
        return new Error('Invalid input string');
    }
    
    // 从base64字符串中解码得到图片的buffer
    return Buffer.from(matches[2], 'base64');
}

// 从一个base64字符串中解析出mime
export function getMimeFromBase64(base64String:string) {
    // 正则表达式匹配base64格式字符串中的MIME类型
    const mimePattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/;
    
    // 使用正则表达式提取MIME类型
    const mimeMatch = base64String.match(mimePattern);
    // debug.log("---getMimeFromBase64---", mimeMatch, mimeMatch?.length);

    // 检查是否成功提取MIME类型
    if (mimeMatch && mimeMatch.length > 1) {
        // 返回MIME类型字符串
        return mimeMatch[1];
    } else {
        // 如果不匹配，可能不是有效的base64图片数据或格式有误，返回undefined或抛出错误
        return undefined; // 或者 throw new Error('Invalid base64 string');
    }
}


/**
 * 替换当前URL中的域名并跳转到新的URL
 * @param newDomain 目标域名，例如 'www.newdomain.com' 或 'https://www.newdomain.com'
 */
export function redirectToNewDomain(newDomain: string): void {
    // 获取当前页面的协议（http或https）
    const currentProtocol = window.location.protocol;

    // 处理目标域名，确保包含协议
    let targetOrigin: string;
    if (newDomain.startsWith('http://') || newDomain.startsWith('https://')) {
        targetOrigin = newDomain;
    } else {
        targetOrigin = `${currentProtocol}//${newDomain}`;
    }

    // 创建 URL 对象以便解析
    try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(targetOrigin);

        // 如果目标域名未指定协议，默认使用当前协议
        if (!targetUrl.protocol) {
            targetUrl.protocol = currentProtocol;
        }

        // 构建新的URL，保留路径和查询参数
        const newUrl = new URL(currentUrl.pathname + currentUrl.search, targetUrl.origin);

        // 输出新的URL（可选，用于调试）
        debug.log('New URL:', newUrl.toString());

        // 判断当前域名是否已经是目标域名
        if (currentUrl.hostname === newUrl.hostname) {
            debug.log('当前域名已是目标域名，无需跳转。');
            return;
        }

        // 执行跳转
        // 方法一：使用 window.location.href，会在浏览器历史中添加一条新记录
        // window.location.href = newUrl.toString();

        // 方法二：使用 window.location.replace，不会在浏览器历史中添加新记录
        if(currentUrl?.hostname?.toLowerCase()?.indexOf("chaonengzxg") >=0 ||
           currentUrl?.hostname?.toLowerCase()?.indexOf("aimoteku") >=0){
            alert("我们的品牌“超能照相馆”已经升级为“NIUKIT”啦，域名同步升级为WWW.NIUKIT.COM，请更新您的收藏哦！");
        }
        window.location.replace(newUrl.toString());
    } catch (error) {
        debug.error('URL 解析错误:', error);
    }
}


export function addParamToURL(url: string, key: string, value:string|undefined|null) {
    try{
        if(url){
            const inputURL = isURL(url);
            const dummyDomain = "https://www.niukit.com";
            const urlObj = inputURL ? new URL(url) : new URL(url, dummyDomain); // 这里域名这是为了满足要求，实际可以是任何合法域名
            if(key && value){
                urlObj.searchParams.append(key, value);
            }    
            return inputURL ? urlObj.toString() : (urlObj.pathname + urlObj.search + urlObj.hash);
        }
    }catch(err:any){
        debug.error("addParamToURL:", err);
    }
    return url;
}

export function getParamOfURL(url: string, key: string) {
    try{
        if(url){
            const inputURL = isURL(url);
            const dummyDomain = "https://www.niukit.com";
            const urlObj = inputURL ? new URL(url) : new URL(url, dummyDomain); // 这里域名这是为了满足要求，实际可以是任何合法域名
            if(key){
                return urlObj.searchParams.get(key);
            }    
        }
    }catch(err:any){
        debug.error("get ParamToURL:", err);
    }
}

// 判断一个字符串是否是URL
export function isURL(str:string) {
    try {
        new URL(str);
        return true;
    } catch (err) {
        return false;
    }
}


// 从一个URL中删除域名，截取Path部分
export function getPathOfURL(urlString:string){
    try {
        const myUrl = new URL(urlString, "https://www.niukit.com");
        return myUrl.pathname;
    } catch (error) {
        return undefined;
    }
}

export function safeWindowOpen(url:string, target:string){
    if (typeof window !== "undefined" && url && target) {
        window.open(url, target);
    }
}


// 主要用于判断遮罩是不是空的
export function isPureBWOrTransparentBase64(imageSource: HTMLCanvasElement | string): Promise<'W' | 'B' | 'A' | 'N'> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                resolve('N');
                return;
            }
            
            // Draw the image onto the canvas
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let isWhite = true;
            let isBlack = true;
            let isAlpha = true;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                
                // Check if not pure white
                if (r !== 255 || g !== 255 || b !== 255 || a !== 255) {
                    isWhite = false;
                }
                
                // Check if not pure black
                if (r !== 0 || g !== 0 || b !== 0 || a !== 255) {
                    isBlack = false;
                }
                
                // Check if not completely transparent (alpha=0)
                if (a !== 0) {
                    isAlpha = false;
                }
                
                // Early exit if none of the conditions are met
                if (!isWhite && !isBlack && !isAlpha) {
                    break;
                }
            }
            
            if (isWhite) {
                resolve('W');
            } else if (isBlack) {
                resolve('B');
            } else if (isAlpha) {
                resolve('A');
            } else {
                resolve('N');
            }
        };
        
        img.onerror = () => {
            resolve('N');
        };
        
        if (typeof imageSource === 'string') {
            img.src = imageSource;
        } else {
            img.src = imageSource.toDataURL('image/png');
        }
    });
}

export async function uploadBase64FileServer(dataURL: string, mime:string="image/png", root:string="T") {
    const ext = mime.split("/").pop() || "png";
    const imageFile = base64ToFile(dataURL, `newFile_${Date.now()}.${ext}`, mime);
    const uf = await uploadToFS(imageFile, root);
    return uf?.url;
}

export function base64ToFile(dataURI: string, filename: string, mime:string="image/png") {
    const base64Marker = ';base64,';
    const base64Index = dataURI.indexOf(base64Marker) + base64Marker.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }

    return new File([array], filename, { type: mime });
}

export async function uploadToFS(file: File, root: string = "T") {
    const response = await fetch('/api/uploadService', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            cmd: "GetOSSSignature",
            fileName: file.name,
            fileType: file.type,
            root: root || "T"
        })
    });

    if (response.status === 200) {
        const result = await response.json();
        const ret = await axios.put(result.signatureUrl.replace(/\+/g, '%2B'), file, {
            headers: { 'Content-Type': file.type }
        });

        if (ret.status === 200) {
            if(root === "U"){
                let mediaType = "FILE";
                if(file.type.startsWith('image/')){
                    mediaType = 'IMAGE';
                }else if(file.type.startsWith('audio/')){
                    mediaType = "AUDIO";
                }else if(file.type.startsWith('video/')){
                    mediaType = "VIDEO"
                }                
                const ufres = await fetch("/api/userFileManager", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        url: result.url, 
                        type: mediaType,
                        cmd: "ADDFILE"
                    }),        
                });
                const uf = await ufres.json();
                if(ufres.status == 200){
                    return {id:uf.id, url: result.url}
                }else{
                    return {url: result.url}
                }                
            }else{
                return {url: result.url}
            }
        }              
    }
    throw new Error('Upload failed');
}


export async function cutRectFromImage(
  imageURL: string,
  rect: { top: number; left: number; width: number; height: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 避免跨域问题（前提：目标服务器允许）

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("无法获取画布上下文");

      ctx.drawImage(
        img,
        rect.left, rect.top, rect.width, rect.height, // 源图像裁剪区域
        0, 0, rect.width, rect.height                 // 放到新画布上
      );

      // 输出 Blob，可用于上传或预览
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject("裁剪失败：无法生成 Blob");
        }
      }, "image/png");
    };

    img.onerror = (e) => reject("加载图像失败: " + imageURL);
    img.src = imageURL;
  });
}

export async function putImagesOnImage(
  baseImageUrl: string,
  images: { imageURL: string; x: number; y: number; width: number; height: number }[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const baseImage = new Image();
    baseImage.crossOrigin = "anonymous";

    baseImage.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context 获取失败");

      ctx.drawImage(baseImage, 0, 0); // 绘制底图

      // 加载并绘制每张 overlay 图片
      await Promise.all(
        images.map(({ imageURL, x, y, width, height }) => {
          return new Promise<void>((resolveOverlay, rejectOverlay) => {
            const overlayImage = new Image();
            overlayImage.crossOrigin = "anonymous";
            overlayImage.onload = () => {
              ctx.drawImage(overlayImage, x, y, width, height);
              resolveOverlay();
            };
            overlayImage.onerror = () => rejectOverlay(`图像加载失败: ${imageURL}`);
            overlayImage.src = imageURL;
          });
        })
      );

      // 导出 Blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject("导出失败：无法生成 Blob");
        }
      }, "image/png");
    };

    baseImage.onerror = () => reject(`底图加载失败: ${baseImageUrl}`);
    baseImage.src = baseImageUrl;
  });
}


// 调整区域为正方形，但是不要超过范围
export function makeSquareRect(
  rect: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
) {
  let { x, y, width, height } = rect;

  // 以中心点为基础
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // 用最大边长作为正方形边
  let size = Math.max(width, height);

  // 限制不能比图像尺寸还大
  size = Math.min(size, imageWidth, imageHeight);

  // 尝试以中心点扩展
  let newX = Math.round(centerX - size / 2);
  let newY = Math.round(centerY - size / 2);

  // 修正越界
  newX = Math.max(0, Math.min(newX, imageWidth - size));
  newY = Math.max(0, Math.min(newY, imageHeight - size));

  return {
    x: newX,
    y: newY,
    width: size,
    height: size,
  };
}


// 放大区域，但是不要超过范围
export function scaleUpRect(
    rect: { x: number; y: number; width: number; height: number },
    scale: number,
    imageWidth: number,
    imageHeight: number
): { x: number; y: number; width: number; height: number } {
    // 计算放大后的尺寸
    const newWidth = rect.width * scale;
    const newHeight = rect.height * scale;

    // 计算原矩形中心点
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    // 计算新左上角坐标
    let newX = centerX - newWidth / 2;
    let newY = centerY - newHeight / 2;

    // 限制不超出边界
    newX = Math.max(0, Math.min(newX, imageWidth - newWidth));
    newY = Math.max(0, Math.min(newY, imageHeight - newHeight));

    return {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight)
    };
}
