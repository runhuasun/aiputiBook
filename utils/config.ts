//require('dotenv').config();
import * as enums from "./enums";

let ICR = process.env.AIPUTI_INVITE_COMMISSION_RATE ? (parseInt(process.env.AIPUTI_INVITE_COMMISSION_RATE!) / 100) : 0;
if(ICR > 0.5){
    ICR = 0.5;
    throw Error("设置了大于50%的佣金比例，这是个危险行为，请检查配置文件");
}else if(ICR < 0){
    ICR == 0;
}

//！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！
//警告：这个变量的内容会被以明文形式在前台代码中可见，不要放任何【需要保密】的信息在此处
//警告：这个变量的内容会被以明文形式在前台代码中可见，不要放任何【需要保密】的信息在此处
//警告：这个变量的内容会被以明文形式在前台代码中可见，不要放任何【需要保密】的信息在此处
//！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！
export const config = {
    locale: process.env.LOCALE || "zh-CN",
    domainName: process.env.DOMAIN_NAME || "www.niukit.com",
    websiteName: process.env.WEBSITE_NAME || "niukit",
    defaultPage: process.env.DEFAULT_PAGE,
    appName: process.env.AIPUTI_APP_NAME!,
    appSlogan: process.env.AIPUTI_APP_SLOGAN,
    website: process.env.WEBSITE_URL!,
    freeCredits: process.env.AIPUTI_FREE_CREDITS ? parseInt(process.env.AIPUTI_FREE_CREDITS!) : 0, // 新用户注册的一次性免费赠与
    inviteBonus: process.env.AIPUTI_INVITE_BONUS ? parseInt(process.env.AIPUTI_INVITE_BONUS!) : 0, // 邀请注册的一次性奖励
    ICR: ICR, // 邀请用户充值的分成
    creditName: process.env.AIPUTI_CREDIT_NAME!,

    inviteReg: process.env.INVITE_REG,
    wechatLogin: process.env.WECHAT_LOGIN && process.env.WECHAT_LOGIN == 'TRUE',
    emailLogin: process.env.EMAIL_LOGIN && process.env.EMAIL_LOGIN == 'TRUE',
    registerCaptcha: process.env.REGISTER_CAPTCHA == "TRUE",
    weixinAppId: process.env.WECHAT_APP_ID!,
    weixinWebAppId: process.env.WECHAT_WEB_APP_ID!,    

    logo32: process.env.LOGO_32 || "/aiputi/logo/logo_32.jpg",
    logo128: process.env.LOGO_128 || "/aiputi/logo/logo_128.jpg",
    logoPNG: process.env.LOGO_PNG,
    registerBG: process.env.REGISTER_BG || "/bg/register_bg.jpg",
    
    resourceServer: process.env.RESOURCE_SERVER || "https://aiputifile.oss-accelerate.aliyuncs.com",
    RS: "https://aiputifile.oss-accelerate.aliyuncs.com",   
    fileServer: process.env.FILE_SERVER || "https://aiputi.oss-cn-beijing.aliyuncs.com",
    FS: process.env.FILE_SERVER || "https://aiputi.oss-accelerate.aliyuncs.com",    
    ossBucket: process.env.ALI_OSS_BUCKET || "aiputi",
    cosBucket: process.env.TENCENT_COS_BUCKET || "aiputi",
    paymentWatermark: process.env.PAYMENT_WATERMARK,
};


export const defaultImage = {
    
    userCover: config.RS + "/default/user.png",

    roomCreating: config.RS + "/running.gif",
    roomDeleted: config.RS + "/default/deleted.jpg",
    roomMoved: config.RS + "/default/moved.jpg",
    
    modelCover: config.RS + "/default/model.jpg",
    modelComplete: config.RS + "/model_complete.jpg",
    modelFailed: config.RS + "/model_failed.jpg",
    modelRunning: config.RS + "/running.gif",
        
    albumCover: config.RS + "/default/album.jpg",
    
    promptCover: config.RS + "/default/prompt.jpg",

    appCover: config.RS + "/logo/newai_logo_108.png",
    
    bookCover: config.RS + "/default/book.jpg",

    whitePaper: config.RS + "/white_1024.jpg",
}

export const system = enums.system;
