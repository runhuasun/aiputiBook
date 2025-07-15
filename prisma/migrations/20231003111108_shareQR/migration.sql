-- CreateTable
CREATE TABLE "ShareQR" (
    "id" TEXT NOT NULL,
    "userId"  TEXT NOT NULL,          --分享QR的人
    "message" TEXT NOT NULL DEFAULT '',   --QR携带消息
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "expireTime" TIMESTAMP(3) NOT NULL,   --过期时间

     CONSTRAINT "ShareQR_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShareQR" ADD CONSTRAINT "ShareQR_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
