-- AlterTable
ALTER TABLE "Room" ADD COLUMN "func" TEXT NOT NULL DEFAULT 'text2img',
ADD COLUMN     "model" TEXT;
