-- AlterTable
ALTER TABLE "Model" ADD COLUMN "totalIncome" Int4 NOT NULL DEFAULT 0,  --模型累计赚的钱
ADD COLUMN "desc" TEXT,    -- 模型的详细描述
ADD COLUMN "ownerIncome" Int4 NOT NULL DEFAULT 0;    -- 模型给创作者的分成
