

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,              --动作类型（LIKE, COMMENT, FOLLOW, FAVORITE)
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATED', --CREATED创建 DELETED被删除             
    "fromUserId"  TEXT NOT NULL,          --做出动作的人
    "targetType" TEXT NOT NULL,           --动作类型（USER, IMAGE, PROMPT, MODEL)
    "targetId"   TEXT NOT NULL,   -- 被做动作的对象
    "desc"      TEXT,                     ---备注信息
    
    CONSTRAINT "action_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Prompt_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "User" ADD COLUMN "model" TEXT;    -- 用户的模型
ALTER TABLE "User" ADD COLUMN "desc" TEXT;    -- 用户的自我介绍
ALTER TABLE "User" ADD COLUMN "phone" TEXT;    -- 用户的手机号
ALTER TABLE "User" ADD COLUMN "weixinId" TEXT;    -- 用户的微信unique ID
ALTER TABLE "User" ADD COLUMN "fans" Int4  NOT NULL DEFAULT 0;   -- 粉丝数

ALTER TABLE "Room" ADD COLUMN "aiservice" TEXT;    -- 生成图片的服务器
ALTER TABLE "Room" ADD COLUMN "predicturl" TEXT;    -- 生成图片的请求地址
ALTER TABLE "Room" ADD COLUMN "bodystr" TEXT;    -- 传递给AI服务的参数字符串




