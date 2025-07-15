-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,              --相册名称
    "type" TEXT NOT NULL DEFAULT 'PHOTO',  --预留字段，默认PHOTO
    "coverImg" TEXT NOT NULL,    --相册封面图片
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,   --更新时间
    "status" TEXT NOT NULL DEFAULT 'CREATED', --CREATED创建  DELETED被删除      
    "access" TEXT NOT NULL DEFAULT 'PRIVATE', --PUBLIC PRIVATE
    "userId"  TEXT NOT NULL,          --拥有相册的人
    "desc"      TEXT,                     ---对相册进行描述
    
    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_UserId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "AlbumRoom" (
    "id" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL,  --创建时间
    "updateTime" TIMESTAMP(3) NOT NULL,  --修改时间
    "status" TEXT NOT NULL DEFAULT 'CREATED', --CREATE创建 DELETED被删除             
    "albumId"  TEXT NOT NULL,          
    "roomId"  TEXT NOT NULL,          
    
    CONSTRAINT "AlbumRoom_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AlbumRoom" ADD CONSTRAINT "AlbumRoom_AlbumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumRoom" ADD CONSTRAINT "AlbumRoom_RoomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "AlbumRoom_albumId_roomId_key" ON "AlbumRoom"("albumId", "roomId");
