import * as Upload from "upload-js-full";
import {zipFiles, deleteFiles} from "../../utils/bytescale";
import { UploadWidgetResult } from "uploader";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import path from 'path'
import * as Fetcher from "node-fetch";

export type ZipData = {
  zipFile: string | null;
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    inputFiles: UploadWidgetResult[];
  };
}

// @ts-ignore
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ZipData | string>
) {
  const { inputFiles } = req.body;

  try {

      const zipFile = await zipFiles(inputFiles);
    
      // 如果照片压缩成功就删除刚才上传的照片
      deleteFiles(inputFiles);      
    
      res.status(200).json(
        {
          zipFile: zipFile ?? null,
        }
      );
    
  }catch(error){
  
     console.error(error);
     res.status(500).json("上传图片压缩预处理失败，您的提子已经被退回，如果需要请和管理员联系！");
  }
}

  

