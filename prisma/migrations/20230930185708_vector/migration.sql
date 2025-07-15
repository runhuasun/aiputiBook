
-- 给Vector表添加一个状态字段
ALTER TABLE "Vector" ADD COLUMN "content" TEXT;    
ALTER TABLE "Vector" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'TEXT';    -- 向量内容的类型 TEXT, IMAGE...
