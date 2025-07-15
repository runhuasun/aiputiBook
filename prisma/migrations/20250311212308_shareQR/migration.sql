-- AlterTable
ALTER TABLE "ShareQR" ADD COLUMN "appId" TEXT NOT NULL DEFAULT 'aiputi00001';    -- 生成当前文件的输入文件

-- AddForeignKey
ALTER TABLE "ShareQR" ADD CONSTRAINT "ShareQR_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
