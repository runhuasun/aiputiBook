-- AlterTable
ALTER TABLE "Model" ADD COLUMN "usedCredits" Int4 NOT NULL DEFAULT 0,  --训练模型消耗的内部提子数
ADD COLUMN "proId" TEXT;    -- AI服务器的进程Id号唯一识别
