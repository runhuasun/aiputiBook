-- CreateTable
CREATE TABLE "SysTrace" (
    "id" TEXT NOT NULL,
    "ip" TEXT, --客户端IP
    "userId" TEXT, --操作用户
    "name" TEXT, 
    "email"  TEXT,
    "path" TEXT, --访问路径  
    "operation" TEXT, --具体操作  
    "createTime" TIMESTAMP(3) NOT NULL,
    "desc" TEXT, --操作内容描述
    "website" TEXT, --操作的网站
  
    CONSTRAINT "SysTrace_pkey" PRIMARY KEY ("id")
);
