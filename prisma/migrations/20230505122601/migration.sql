-- AlterTable
ALTER TABLE "Model" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'PUBLIC';        -- 模型的主频道，缺省是公共频道

ALTER TABLE "Prompt" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'PUBLIC';        -- 提示词的主频道，缺省是在公共频道
