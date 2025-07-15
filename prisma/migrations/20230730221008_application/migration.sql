-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,              --应用名称
    "type" TEXT NOT NULL,              --应用类型（WechatService)
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建 ERROR出错  PUBLISH完成  DELETE被删除             
    "userId"  TEXT NOT NULL,          --拥有应用的人
    "config" TEXT NOT NULL,           -- JSON格式的参数表（APP_ID, APP_SECRET.....)
    "settlement" TEXT NOT NULL DEFAULT 'B2A',       -- 结算方式 (B2A B端按用量和AIPUTI结算, C2A2B C端付费给AIPUTI, AIPUTI按比例结算给B)
    "modelId" TEXT NOT NULL,         --应用使用的模型
    "desc"      TEXT,                     ---备注信息
    
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_ModelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
