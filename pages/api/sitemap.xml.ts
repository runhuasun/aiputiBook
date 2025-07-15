import type { NextApiRequest, NextApiResponse } from "next";
import * as Fetcher from "node-fetch";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import * as global from "../../utils/globalUtils";
import {config} from "../../utils/config";
import * as debug from "../../utils/debug";


  
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
  ){
  
    // 获得参数
    const { submit_sitemap } = req.query;
  
    // 生成sitemap的逻辑...
    const baseURL = config.website;

    // 动态数据，数据在不同网站必须不能重复，防止被作为垃圾数据
    let dynaLinks = "";
    if(config.websiteName === "aiputi"){  
        // 所有书籍
        const books = await prisma.model.findMany({
            where: {
                func: 'chat',
                status: 'FINISH',
                access: 'PUBLIC',
                channel: 'BOOK'
            },
            select: {
                id: true,
                finishTime: true
            }
        });
    
    
        const bookURLs = books.map(book => `
            <url>
                <loc>${baseURL}/books/${book.id}</loc>
                <lastmod>${new Date(book.finishTime).toISOString()}</lastmod>
                <priority>0.9</priority>
            </url>
            `).join('');

        dynaLinks += bookURLs;
        
        if(submit_sitemap == "TRUE"){
            await submitSiteMap(books, baseURL, "book");                
        }
    }

    if(config.websiteName === "haiwan"){  
        // 所有书籍
        const books = await prisma.model.findMany({
            where: {
                func: 'chat',
                status: 'FINISH',
                access: 'PUBLIC',
                channel: 'TRAVEL'
            },
            select: {
                id: true,
                finishTime: true
            }
        });
    
    
        const bookURLs = books.map(book => `
            <url>
                <loc>${baseURL}/books/${book.id}</loc>
                <lastmod>${new Date(book.finishTime).toISOString()}</lastmod>
                <priority>0.9</priority>
            </url>
            `).join('');

        dynaLinks += bookURLs;
        
        if(submit_sitemap == "TRUE"){
            await submitSiteMap(books, baseURL, "book");                
        }
    }
    
    if(config.websiteName === "aixiezhen"){  
        // 所有图片
        const rooms = await prisma.room.findMany({
            where: {
                status: 'SUCCESS',
                access: 'PUBLIC',
                sysScore:  { gt: 3 } // 只显示4分及以上的
            },
            select: {
                id: true,
                updatedAt: true
            }
        });
    
        const roomURLs = rooms.map(room => `
            <url>
                <loc>${baseURL}/images/${room.id}</loc>
                <lastmod>${new Date(room.updatedAt).toISOString()}</lastmod>
                <priority>0.9</priority>
            </url>
            `).join('');

        dynaLinks += roomURLs;
        
        if(submit_sitemap == "TRUE"){
            await submitSiteMap(rooms, baseURL, "images");                
        }

    }

    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${config.website}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>1.0</priority>
    </url>
    {/* 更多的URL */}
    ${dynaLinks}
    </urlset>
  `;

    res.setHeader('Content-Type', 'text/xml');
    res.write(sitemap);
    res.end();
};


async function submitSiteMap(items:any[], baseURL:string, bucket:string){
    let count = 0;
    let L2000 = "";
    
    for(const item of items){
        L2000 += `${baseURL}/${bucket}/${item.id}\n`;
        ++count;
        if(count >= 1900){ // 百度一次最多提交2000行        
            await submitBaiduURLs(baseURL, L2000);
            count = 0;
            L2000 = "";
        }
    }

    if(L2000){
        await submitBaiduURLs(baseURL, L2000);
    }
}

async function submitBaiduURLs(baseURL:string, URLs:string){
    const ret = await fetch(`http://data.zz.baidu.com/urls?site=${baseURL}&token=afNiw2NbdeCejHnH`, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain",
        },
        // 先让code和name取一样的值
        body: URLs,
    });
    debug.log("submit sitemap:" + ret.status);
    const response = await ret.json();
    debug.log(response);
}




