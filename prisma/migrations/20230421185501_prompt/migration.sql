
-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,              --用户可以看到的提示词唯一编码
    "name" TEXT NOT NULL,              --用户给自己提示词起的名字，比较好记易懂的
    "func" TEXT NOT NULL,              --提示词适用于哪个功能（eg: SD2.1, DALL-E, chatGPT3.5....)
    "formular" TEXT NOT NULL,           --提示词的公式，是一个带[]的提示词，例如: a girl in [地点], wear a [服装]....
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建模型 ERROR出错  FINISH制作完成  DELETE被删除             
    "access"  TEXT  NOT NULL,         --PUBLIC公开 PRIVATE私有
    "userId"  TEXT NOT NULL,          --模型的拥有者
    "price"   Int4  NOT NULL DEFAULT 0,   -- 提示词每次运行的售价
    "coverImg"  TEXT,                   -- 封面图片
    "runtimes"  INT4 NOT NULL DEFAULT 0,  -- 运行的次数
    "totalIncome" INT4 NOT NULL DEFAULT 0,  --已经转到的钱
    "desc"      TEXT,                     ---描述
    "ownerIncome" INT4 NOT NULL DEFAULT 0,  --作者赚到的钱
    
    CONSTRAINT "prompt_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "Prompt_code_key" ON "Prompt"("code");
CREATE UNIQUE INDEX "Prompt_name_key" ON "Prompt"("name");

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
