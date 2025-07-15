-- CreateTable
CREATE TABLE "Rawdata" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,              --数据集名称
    "type" TEXT NOT NULL,              --数据集类型(TEXT, IMAGE, VOICE, VIDEO)
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建  DELETE被删除             
    "userId"  TEXT NOT NULL,          --拥有数据集的人
    "url" TEXT NOT NULL,           -- 数据集存储的URL
    "desc"      TEXT,                     ---对数据信息进行描述
    
    CONSTRAINT "Rawdata_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rawdata" ADD CONSTRAINT "Rawdata_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- modify vector table
ALTER TABLE "Vector" ADD COLUMN "rawdataId" TEXT;    -- 产生向量的数据集

-- CreateTable
CREATE TABLE "ModelRawdatas" (
    "id" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "status" TEXT NOT NULL DEFAULT 'CREATE', --CREATE创建 PUBLISH发布可用 DELETE被删除             
    "modelId"  TEXT NOT NULL,          
    "rawdataId"  TEXT NOT NULL,          
    
    CONSTRAINT "ModelRawdatas_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ModelRawdatas" ADD CONSTRAINT "ModelRawdatas_ModelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelRawdatas" ADD CONSTRAINT "ModelRawdatas_RawdataId_fkey" FOREIGN KEY ("rawdataId") REFERENCES "Rawdata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "ModelRawdatas_modelId_rawdataId_key" ON "ModelRawdatas"("modelId", "rawdataId");

