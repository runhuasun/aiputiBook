
-- CreateTable
CREATE TABLE "VDH" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,  
    "gender" TEXT NOT NULL, --male, female, robot
    "birthday" TIMESTAMP(3) NOT NULL,
    
    "info" TEXT NOT NULL, --一个JSON对象字符串，描述身高、体重、出生日期、毕业学校等等内容
    "desc" TEXT NOT NULL, --对于性格、特点、历史等的描述
    "label" TEXT NOT NULL, --给虚拟人打标签
    
    "score" INTEGER,
    "likes" INTEGER,
    "access" TEXT NOT NULL, --PRIVATE, PUBLIC
    "price" INTEGER,
  
    "pModelId" TEXT NOT NULL, --人物形象模型
    "cModelId" TEXT NOT NULL, --语言知识模型
    "vModelId" TEXT NOT NULL, --语音模型

    "userId" TEXT NOT NULL, --创造者
    "createTime" TIMESTAMP(3) NOT NULL,
    "updateTime"  TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,  --CREATE, SUCCESS, DELETED

    CONSTRAINT "VDH_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VDH" ADD CONSTRAINT "VDH_pModelId_fkey" FOREIGN KEY ("pModelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VDH" ADD CONSTRAINT "VDH_cModelId_fkey" FOREIGN KEY ("cModelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VDH" ADD CONSTRAINT "VDH_vModelId_fkey" FOREIGN KEY ("vModelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VDH" ADD CONSTRAINT "VDH_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "VDH_code_key" ON "VDH"("code");
