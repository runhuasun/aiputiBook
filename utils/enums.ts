export const roomStatus = {
    creating: "CREATING", // 对象正在创立中
    
    delete: "DELETE", // 对象删除了
    failed: "FAILED", //  创建对象失败
    success: "SUCCESS", // 创建对象成功
    
    midstep: "MIDSTEP", // 中间步骤中
    midsucc: "MIDSUCC", // 中间步骤成功
    midfail: "MIDFAIL", // 中间步骤失败
}

export const modelStatus = {
    create: "CREATE", // 对象创立
    start: "START", // 开始训练
    finish: "FINISH", // 对象创立结束
    cancel: "CANCEL", // 创立对象中途取消
    running: "RUNNING", // 正在执行对象创建
    fail: "FAIL", // 创建对象失败
    failed: "FAILED", //  创建对象失败
    success: "SUCCESS", // 创建对象成功
    deleted: "DELETED",
}

export const actionStatus = {
    finish: "FINISH", // 对象创立结束
    delete: "DELETE", // 对象删除了
}

export const userFileStatus = {
    created: "CREATED", // 对象创立
    deleted: "DELETED",
}

export const albumStatus = {
    created: "CREATED", // 对象创立
    deleted: "DELETED",
}

/*
1xx (Informational): 表示接收的请求正在处理。
例如: 100 (Continue), 101 (Switching Protocols), 102 (Processing)
2xx (Success): 表示请求已成功被服务器接收、理解、并接受。
例如: 200 (OK), 201 (Created), 204 (No Content)
3xx (Redirection): 表示进一步操作需要完成请求。
例如: 301 (Moved Permanently), 302 (Found), 304 (Not Modified)
4xx (Client Error): 表示客户端似乎有错误。
例如: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
5xx (Server Error): 表示服务器在处理请求的时候发生了错误。
例如: 500 (Internal Server Error), 501 (Not Implemented), 503 (Service Unavailable)
*/
export const resStatus = {
    OK: 200,

    waitForResult: 300, // 等待结果
    constrainOpPaymentDelete: 301, // 需要付费删除

    // 设计者提前预料到的可能错误
    expErr: 400,  // 系统预计到的错误
    unauthErr: 401, // 没有登录 
    connectErr: 404, // 访问链接错误

    inputErr: 411, // 输入参数错误
    inputNSFW: 412, // 输入的内容敏感
    unsupportFormat: 413, // 输入文件格式不支持
    unexpServiceError: 429, // AI服务器返回未知的错误，通常是由于AI服务器不稳定导致，此时应该重试
    noResultErr: 430, // 没有返回期待的结果
    unknownErr: 431, // 未知错误
    unexpRetryErr: 432, // 意料之外的重试，通常是客户端代理引起
    taskNotStart: 433, // 任务没有启动成功，一般是客户端传入参数问题
    invader: 434, // 非法侵入的访问，需要警惕！！！
    unknownCMD: 435, // 未知操作命令       
    NSFW: 437, // not safe for work
    lackCredits: 438, // 没有足够的点数了
    FSE: 439, // 上传文件服务器错误
    taskErr: 440, // 任务执行发生未知原因的失败
    serviceLineError: 442, // 服务线路配置错误
    tooMuchWaiting: 443, // 在等待队列中的任务太多了
    timeout: 444, // 超时错误
    outofUnpaidLimit: 455, // 超过免费用户限制
    paidOnly:456, // 仅限付费用户试用
    
    // 设计者提前不能预期的错误
    unExpErr: 500, // 不知道原因的系统错误
    proxyErr: 502, // 代理错误
}

export const dataType = {
    model: "MODEL",
    image: "IMAGE",
}

export const actionType = {
    favorite: "favorite",
    like: "like",
    subscribe: "subscribe",
    view: "view"
}

export const fileServer = {
    BYTESCALE: "BYTESCALE",
    OSS: "OSS",
    COS: "COS",
    UNKNOWN: "UNKNOWN"
}

export const creditOperation = {
    INIT: "INIT",
    NEW_USER: "NEW_USER", 
    INVITE_BONUS: "INVITE_BONUS", 
    INVITE_COMMISSION: "INVITE_COMMISSION", 
    CLOCK_IN: "CLOCK_IN", 
    TASK_EVALUATE_ROOM: "TASK_EVALUATE_ROOM",
    BOUGHT: "BOUGHT",
    CREATE_ROOM: "CREATE_ROOM", 
    CREATE_MODEL: "CREATE_MODEL",
    CREATE_MODEL_BONUS: "CREATE_MODEL_BONUS",
    CREATE_CHAT_MODEL: "CREATE_CHAT_MODEL",
    CHAT_GPT: "CHAT_GPT",
    MODEL_INCOME: "MODEL_INCOME",
    LONG_TEXT: "LONG_TEXT",
    COMPENSATION: "COMPENSATION",
}


export const system = {
    users: {
        trashId: "cie4mirgjsoigjgmrsiojswoik34",
        rootId: "clgox0y700000kuqik6w6adji",
        notLoginUserId: "not_login_user_id",
    },
    album: {
        pose: {id: "pose_collection_album", name: "女士写真姿态", mediaType:"PHOTO"},
        poseMan: { id: "pose_collection_album_man",  name: "男士写真姿态", mediaType:"PHOTO"},
        ID: {id: "id_template_album", name: "证件照模板", mediaType:"PHOTO"},        
        bg: {id: "bg_collection_album", name: "系统背景", mediaType:"PHOTO"},
        bgTravel: {id: "bg_travel_collection_album", name:"旅行风景", mediaType:"PHOTO"},
        
        motionVideo: {id:"motion_video_album", name:"动作视频模板", mediaType:"VIDEO"},
        danceVideo: {id:"dance_video_album", name:"舞蹈模板", mediaType:"VIDEO"},
        
        template: {id: "template_image_album", name:"模板照片", mediaType:"PHOTO"},


        demoArchDeco: {id: "id_album_demo_arch_deco", name:"样例室内", mediaType:"PHOTO"},
        demoArchDraft: {id: "id_album_demo_arch_draft", name:"样例建筑草图", mediaType:"PHOTO"},
        demoArchGarden: {id: "id_album_demo_arch_garden", name:"样例花园", mediaType:"PHOTO"},
        
        demoPoster: {id: "id_album_demo_poster", name:"样例海报", mediaType:"PHOTO"},
        demoCloth: {id: "id_album_demo_cloth", name:"样例服装", mediaType:"PHOTO"},
        demoProduct: {id: "id_album_demo_product", name:"样例产品", mediaType:"PHOTO"},

        hairWoman: {id: "id_album_woman_hair_collection", name:"女士发型", mediaType:"PHOTO"},
        hairMan: {id:"id_album_man_hair_collection", name:"男士发型", mediaType:"PHOTO"},
        hairBoy: {id:"id_album_boy_hair_collection", name:"男孩发型", mediaType:"PHOTO"},
        hairGirl: {id:"id_album_girl_hair_collection", name:"女孩发型", mediaType:"PHOTO"},
        
        hairStyleWoman: {id:"id_album_hair_style_female", name:"女士发型相册", mediaType:"PHOTO"},
        hairStyleMan: {id: "id_album_hair_style_male", name:"男士发型相册", mediaType:"PHOTO"},
        hairColor: {id:"id_album_hair_color", name:"发色相册", mediaType:"PHOTO"},

        personalWoman: {id:"id_album_personal_woman", name: "女士造型", mediaType:"PHOTO"},
        personalMan: {id:"id_album_personal_man", name:"男士造型", mediaType:"PHOTO"},
        personalGirl: {id:"id_album_personal_girl", name:"女孩造型", mediaType:"PHOTO"},
        personalBoy: { id:"id_album_personal_boy", name:"男孩造型", mediaType:"PHOTO"}
    },
    chatModels: {
        clothKnowlege: {id: "cloth_knowlege_id", code:"cloth_knowlege_model_code", name: "服装识别模型", trainSrv: "openai embedding", aiservice: "QIANWEN", baseModel: "qvq-plus", 
                          proMsg: "不要回答和服装无关的任何问题", desc:"你好！我是您的AI服装造型师。"},
        hairAssistant: {id: "hair_assistant_id", code:"hair_assistant_model_code", name: "发型设计AI助理", trainSrv: "openai embedding", aiservice: "QIANWEN", baseModel: "qvq-plus", 
                          proMsg: "不要回答发型设计无关的任何问题", desc:"你好！我是您的AI发型设计师。发型对于一个人的形象太重要了，让我给您设计一个很棒的新发型吧！"},
        promptAssistant: {id: "prompt_assistant_id", code:"prompt_assistant_model_code", name: "提示词创意AI助理", trainSrv: "openai embedding", aiservice: "QIANWEN", baseModel: "deepseek-r1", 
                          proMsg: "不要回答用户和生成AI提示词无关的任何问题", desc:"你好！我是您的提示词创意AI助理"},
        lyricsAssistant: {id: "lyrics_assistant_id", code: "lyrics_assistant_model_code", name: "歌词创意AI助理", trainSrv: "openai embedding", aiservice: "QIANWEN", baseModel: "deepseek-r1",
                proMsg: "不要回答用户和生成AI提示词无关的任何问题", desc:"你好！我是您的提示词创意AI助理"},
    }
}
