-- CreateTable
CREATE TABLE "CreditItem" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL, 
    "operation" TEXT NOT NULL, --INIT, NEW_USER, INVITE_BONUS, INVITE_COMMISSION, CLOCK_IN, ROOM_USE, MODEL_USE
    "objectId" TEXT, --操作对象的ID，比如被邀请的用户ID，ROOMID, MODELID等
    "desc" TEXT, --操作内容描述
  
    CONSTRAINT "CreditItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CreditItem" ADD CONSTRAINT "CreditItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
