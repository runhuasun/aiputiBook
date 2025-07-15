import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prismadb";
import {log, warn, error} from "../../utils/debug";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    log("check remaining...."); 
    // Check if user is logged in
    const session = await getServerSession(req, res, authOptions);
    if (session && session.user && session.user.email) {
        // Query the database by email to get the number of generations left
        const user = await prisma.user.findUnique({
            where: {
                email: session.user.email!,
            },
            select: {
                id: true,
                credits: true,
                emailVerified: true,
                boughtCredits: true,
                usedCredits: true,
                incomeCredits: true,
                image: true,
                model: true,
                actors: true,
            },         
        });
  
        if(user){   
            return res.status(200).json({ 
                image:user.image, 
                emailVerified:user.emailVerified, 
                currentUserId:user.id, 
                remainingGenerations: user.credits, 
                credits: user.credits,
                boughtCredits: user.boughtCredits,  
                incomeCredits: user.incomeCredits,
                usedCredits: user.usedCredits,
                actors: user.actors,
            });
        }
    }
    
    return res.status(400).json({ 
        image:"", 
        emailVerified:null, 
        currentUserId:"", 
        remainingGenerations: 0, 
        credits: 0,
        boughtCredits: 0,  
        incomeCredits: 0,
        usedCredits: 0,
        actors: "",
    });
  
}
