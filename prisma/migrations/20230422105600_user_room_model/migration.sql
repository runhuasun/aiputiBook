-- AlterTable
ALTER TABLE "Room" ADD COLUMN "callbacked" TEXT NOT NULL DEFAULT 'N';    -- AI服务器是否回调过，状态N, Y

-- AlterTable
ALTER TABLE "Model" ADD COLUMN "callbacked" TEXT NOT NULL DEFAULT 'N';    -- AI服务器是否回调过，状态N, Y

-- AlterTable
ALTER TABLE "User" ADD COLUMN "incomeCredits" Int4 NOT NULL DEFAULT 0;    -- 用户卖模型和提示词的收入

