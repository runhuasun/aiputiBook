import { getServerSession } from "next-auth";
import prisma from "../lib/prismadb";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import * as debug from "./debug";
import { config } from "./config";
import type { NextApiRequest, NextApiResponse } from "next";

export async function logUserRequest(ctx:any, session?:any, user?:any, desc?:any){
    return await logApiRequest(ctx.req, ctx.res, session, user);
}


export async function logApiRequest(req:NextApiRequest, res: NextApiResponse, session?:any, user?:any, operation?:any){
    try{
        let path = req?.url as string;
        const ip = getClientIP(req);  
        const userAgent = req.headers['user-agent'];
        const desc:any = userAgent ? {userAgent} : {};
        
        if(!session){
            session = await getServerSession(req, res, authOptions);    
        }
    
        // debug.log(`IP: ${ip}, User: ${user?.name || session?.user?.name }[${user?.eamil || session?.user?.email}], Page: ${path}, User-Agent: ${userAgent}`);
        if(path){
            const query = path.split('?')[1];
            path = path.split('?')[0];        
            const params = new URLSearchParams(query);
            const width = params.get("screenWidth");
            const height = params.get("screenHeight");
            if(width && height){
                desc.screen = {width, height};
                params.delete("screenWidth");
                params.delete("screenHeight");
            }
            const newQuery = params.toString();
            if(newQuery){
                path = `${path}?${newQuery}`;
            }
        }
        await prisma.sysTrace.create({
            data:{
                ip: ip as string,
                userId: user?.id || session?.user?.id,
                name: user?.name || session?.user?.name,
                email: user?.email || session?.user?.email,
                path: path,
                website: config.websiteName,
                operation: operation ? JSON.stringify(operation) : undefined,
                desc: desc ? JSON.stringify(desc) : undefined,
            }
        });
    }catch(err){
        debug.error("monitor.logApiRequest:", err);
    }
}

function getClientIP(req:any) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || null;
}
