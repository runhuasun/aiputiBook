
-- CreateTable
CREATE TABLE "Talk" (
    "id" TEXT NOT NULL,
    "replicateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputMsg" TEXT NOT NULL,
    "outputMsg" TEXT NOT NULL,

    "aiservice"   TEXT,
    "predicturl"  TEXT,
    "bodystr"     TEXT,
  
    "promptId" TEXT, -- 对应得提示词应用
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    "func"        TEXT NOT NULL DEFAULT 'chat', -- 对应得功能
    "model"       TEXT NOT NULL DEFAULT 'gpt-3.5-turbo', -- 对应得功能
    "usedCredits"   Int4  NOT NULL DEFAULT 0,   -- 消耗得提子
    "usedTokens"    Int4  NOT NULL DEFAULT 0,   -- 消耗得tokens
    "access"        TEXT NOT NULL DEFAULT 'PRIVATE', -- 对应得功能
    "status"        TEXT NOT NULL DEFAULT 'CREATING', -- 对应得功能

    CONSTRAINT "Talk_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Talk" ADD CONSTRAINT "Talk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
