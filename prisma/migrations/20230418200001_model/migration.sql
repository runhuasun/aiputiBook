
-- AlterTable
ALTER TABLE "Model" ADD COLUMN "price" Int4 NOT NULL DEFAULT 10,  --模型对外销售价格
ADD COLUMN "url" TEXT,    -- 模型存储的位置
ADD COLUMN "proMsg" TEXT,    -- 模型AI服务饭返回的信息
ADD COLUMN "coverImg" TEXT,    -- 封面图片的URL
ADD COLUMN "runtimes" Int4 NOT NULL DEFAULT 0;    -- 模型被运行过的次数

