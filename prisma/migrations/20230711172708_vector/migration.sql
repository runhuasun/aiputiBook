-- AlterTable
ALTER TABLE "Vector" ADD COLUMN "userId" TEXT;    -- 产生向量的用户
ALTER TABLE "Vector" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'MODEL';    -- 向量的用途 MODEL, PRIVATE, WALL

-- AddForeignKey
ALTER TABLE "Vector" ADD CONSTRAINT "Vector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 删除原有的唯一索引
DROP  INDEX IF EXISTS  "Vector_modelId_key_key";

-- 创建新的唯一索引
CREATE UNIQUE INDEX "Vector_modelId_userId_scope_key" ON "Vector"("modelId", "userId", "scope", "key");


