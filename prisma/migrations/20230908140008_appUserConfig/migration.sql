-- CreateTable
CREATE TABLE "AppUserConfig" (
    "id" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建 ERROR出错  PUBLISH完成  DELETE被删除             
    "userId"  TEXT NOT NULL,          --配置的用户
    "appId"  TEXT NOT NULL,          --配置的应用
    "config" TEXT NOT NULL,           -- JSON格式的参数表（APP_ID, APP_SECRET.....)
    
    CONSTRAINT "AppUserConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AppUserConfig" ADD CONSTRAINT "AppUserConfig_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppUserConfig" ADD CONSTRAINT "AppUserConfig_ApplId_fkey" FOREIGN KEY ("appId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

