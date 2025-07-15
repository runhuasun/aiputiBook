-- AlterTable
ALTER TABLE "Room" ADD COLUMN "sysScore" Int4 NOT NULL DEFAULT '0';         -- 系统对质量的打分


ALTER TABLE "Model" ADD COLUMN "sysScore" Int4 NOT NULL DEFAULT '0',         -- 系统对质量的打分
                    ADD COLUMN "likes" Int4 NOT NULL DEFAULT '0';

ALTER TABLE "Prompt" ADD COLUMN "sysScore" Int4 NOT NULL DEFAULT '0',         -- 系统对质量的打分
                    ADD COLUMN "likes" Int4 NOT NULL DEFAULT '0';
