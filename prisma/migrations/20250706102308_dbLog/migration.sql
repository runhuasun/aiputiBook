-- CreateTable
CREATE TABLE "DbLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target" TEXT,
    "targetId" TEXT,
    "pos" TEXT,
    "content" TEXT,
    CONSTRAINT "DbLog_pkey" PRIMARY KEY ("id")
);

