import * as debug from "./debug";
import prisma from "../lib/prismadb";
import * as fc from "./funcConf";
import * as enums from "./enums";

export async function getRoomBody(roomId:string) {
    let roomBody:any;
    
    if(roomId){
        const room = await prisma.room.findUnique({
            where: {id: roomId},
            select: {id:true, outputImage:true, seed:true, bodystr: true}
        });
        if(room?.bodystr){
            roomBody = jsonOfRoomBody(room);
        }
    }

    return roomBody;
}

export function jsonOfRoomBody(room:any) {
    let roomBody:any;
    if(room?.bodystr){
        try{
            roomBody = JSON.parse(room.bodystr);
            roomBody.output = room.outputImage;
            roomBody.roomId = room.id;
            roomBody.seed = room.seed;
        }catch(err){
            debug.error("ROOM ID:" + room.id);
            debug.error("获取ROOM BODY时发生意外失败：", err);
        }
    }
    return roomBody;
}


export async function getPathNodes(root:any, user?:any){
    const path:any[] = [];
    let pathNode:any = root;
    const isAdmin = user?.actors && user.actors.indexOf("admin")>=0;
    
    while(pathNode){
        let href = fc.getFuncLink(pathNode.func, pathNode.model, pathNode.usedCredits, pathNode.prompt, undefined);
        let title = fc.getFuncTitle(pathNode.func, pathNode.model);
        if(pathNode.func == "lora" || pathNode.func == "takePhoto"){
            const m = await prisma.model.findUnique({
                where: {
                    code: pathNode.model
                },
                select: {
                    name: true,
                    channel: true,
                }
            });
            if(m){
                title = m.name;
                href = `${href}&channel=${m.channel}`;
            }
        }
        if(href && ((pathNode.status == enums.roomStatus.success) || isAdmin)){
            href = `${href}&simRoomId=${pathNode.id}`;                
        }

        if(pathNode.preRoomId){
            pathNode = await prisma.room.findUnique({
                where: {
                    id: pathNode.preRoomId,
                }
            });
            if(href && ((pathNode.status == enums.roomStatus.success) || isAdmin)){
                href = `${href}&roomId=${pathNode.id}`;
            }
        }else{
            pathNode = null;
        }

        path.unshift({href, title});            
    }

    return path;
}

