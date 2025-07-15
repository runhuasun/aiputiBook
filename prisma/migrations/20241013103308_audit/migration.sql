-- AlterTable
ALTER TABLE "Room" ADD COLUMN "audit" TEXT;    -- 对照片的审核结果

ALTER TABLE "UserFile" ADD COLUMN "audit" TEXT;    -- 对照片的审核结果

ALTER TABLE "Rawdata" ADD COLUMN "audit" TEXT;    -- 对照片的审核结果

