-- AlterTable
ALTER TABLE "Room" ADD COLUMN "price" Int4 NOT NULL DEFAULT '10',         -- 下载的缺省价格

 ADD COLUMN "viewTimes" Int4 NOT NULL DEFAULT '0',      -- 被查看的次数下载的缺省价格

 ADD COLUMN "dealTimes" Int4 NOT NULL DEFAULT '0',      -- 下载大图的次数

 ADD COLUMN "totalIncome" Int4 NOT NULL DEFAULT '0',    -- 总收入

 ADD COLUMN "ownerIncome" Int4 NOT NULL DEFAULT '0',    -- 创作者的收入

 ADD COLUMN "zoomInImage" TEXT ,                     -- 生成的大图

ADD COLUMN "likes" Int4 NOT NULL DEFAULT '0';          -- 点赞数量
