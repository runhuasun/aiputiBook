-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "func" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL,
    "updateTime" TIMESTAMP(3) NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATE',  -- CREATE START FINISH ERROR
    "usedCredits" Int4 NOT NULL DEFAULT 0,  --消耗的提子数
    "usedTokens"  Int4 NOT NULL DEFAULT 0,  --消耗的token数

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

