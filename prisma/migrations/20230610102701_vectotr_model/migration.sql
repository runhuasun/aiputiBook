
-- CreateTable
CREATE TABLE "Vector" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,


    CONSTRAINT "Vector_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vector" ADD CONSTRAINT "Vector_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- CreateIndex
CREATE UNIQUE INDEX "Vector_modelId_key_key" ON "Vector"("modelId", "key");


-- AlterTable
ALTER TABLE "Model" 
ADD COLUMN "usedTokens" Int4 NOT NULL DEFAULT 0,  --使用的token
ADD COLUMN "datasets" TEXT;    -- 训练的数据集文件

