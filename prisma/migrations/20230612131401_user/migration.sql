

-- AlterTable
ALTER TABLE "User" ADD COLUMN "actors" TEXT NOT NULL DEFAULT 'user';    -- 用户的角色，多个用|分开
