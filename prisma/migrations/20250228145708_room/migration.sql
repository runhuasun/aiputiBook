-- AlterTable
ALTER TABLE "Room" ADD COLUMN "preRoomId" TEXT;    -- 生成当前文件的输入文件

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_preRoomId_fkey" FOREIGN KEY ("preRoomId") REFERENCES "Room"("id") ON UPDATE CASCADE;
