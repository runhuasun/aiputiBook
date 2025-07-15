
-- 给Vector表添加一个状态字段
ALTER TABLE "Vector" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CREATE';    -- 向量的用途 CREATE, DELETE


-- 把唯一索引加上状态字段
-- 删除原有的唯一索引
DROP  INDEX IF EXISTS  "Vector_modelId_userId_scope_key";

-- 创建新的唯一索引
CREATE UNIQUE INDEX "Vector_modelId_userId_scope_status_key" ON "Vector"("modelId", "userId", "scope", "key", "status");
