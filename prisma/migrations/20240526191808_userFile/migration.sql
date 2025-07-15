-- CreateTable
CREATE TABLE "UserFile" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IMAGE',  --文件类型，IMAGE, 
    "url" TEXT NOT NULL, -- 文件位置
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATED', --CREATED创建  DELETED被删除      
    "access" TEXT NOT NULL DEFAULT 'PRIVATE', --PUBLIC PRIVATE
    "userId"  TEXT NOT NULL,          --拥有文件的人
    "desc"      TEXT,                     ---对文件进行描述
    "score"  Int4 NOT NULL DEFAULT '0',      -- 排序权重    
    CONSTRAINT "UserFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserFile" ADD CONSTRAINT "UserFile_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
