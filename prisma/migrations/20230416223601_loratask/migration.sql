
-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,              --用户可以看到的模型唯一编码
    "name" TEXT NOT NULL,              --用户给自己模型起的名字，比较好记易懂的
    "func" TEXT NOT NULL,              --模型适用于哪个功能
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "finishTime" TIMESTAMP(3) NOT NULL,   --训练完成时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建模型 START开始训练  ERROR训练出错  FINISH训练完成  DELETE模型被删除             
    "trainSrv" TEXT NOT NULL,           --由哪个服务在训练
    "access"  TEXT  NOT NULL,         --PUBLIC公开 PRIVATE私有
    "userId"  TEXT NOT NULL,          --模型的拥有者
    
    CONSTRAINT "model_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "Model_code_key" ON "Model"("code");
CREATE UNIQUE INDEX "Model_name_key" ON "Model"("name");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
