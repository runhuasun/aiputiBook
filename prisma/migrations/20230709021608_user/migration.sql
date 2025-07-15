
CREATE UNIQUE INDEX "user_phone_index" ON "User"("phone") WHERE "phone" IS NOT NULL;
CREATE UNIQUE INDEX "user_weixinId_index" ON "User"("weixinId") WHERE "weixinId" IS NOT NULL;
