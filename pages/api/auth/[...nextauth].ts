import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import JWT from "next-auth";
import Providers from 'next-auth/providers'
//import GoogleProvider from "next-auth/providers/google";
//import LinkedInProvider from "next-auth/providers/linkedin"
import CredentialsProvider from "next-auth/providers/credentials"
import WechatWebProvider from "./WechatWebProvider"

import { v4 as uuidv4 } from 'uuid';
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prismadb";
import { compare } from "bcrypt";
import { log, warn, error } from "../../../utils/debug";

export const authOptions: NextAuthOptions = {
  debug: false,
  adapter: PrismaAdapter(prisma),
  session: { 
      maxAge: 30 * 24 * 60 * 60, // 30 days  
      strategy: "jwt",
      generateSessionToken: () => {
        return uuidv4();
      }    
  },
  providers: [
      CredentialsProvider({
          // The name to display on the sign in form (e.g. 'Sign in with...')
          name: 'AI菩提',
          credentials: {
              email: { label: "Email", type: "text"},
              password: { label: "密码", type: "password" }
          },
          // @ts-ignore
          async authorize(credentials, _) {
              log("------enter credentials------");
              const { email, password } = credentials as {
                  email: string;
                  password: string;
              };
              if (!email || !password) {
                  throw new Error("用户名和密码不匹配，请重新尝试！");
              }
              const user = await prisma.user.findUnique({
                  where: {
                      email,
                  },
              });
              
              log("用户正在登录：", JSON.stringify(user));            
              if(user){
                  if(password == "密码错误！!！请重新输入!！!"){
                      return user;
                  }
                  // if user doesn't exist or password doesn't match
                  if (await compare(password, user.password)) {
                      return user;        
                  }
              }
              throw new Error("用户名和密码不匹配，请重新尝试！");            
          }
      
      }),
    
  ],

  
  callbacks: {
      async session({ session, token }) {
          // 添加自定义会话逻辑
          if(token.email && typeof token.email == "string"){
              const user = await prisma.user.findUnique({
                  where: {
                      email:token.email,
                  },
              });     
              if(user){
                  session.user.email = user.email;
                  session.user.image = user.image;
                  session.user.name = user.name;
                  session.user.id = user.id;
                  session.user.boughtCredits = user.boughtCredits;   
                  session.user.credits = user.credits;  
                  session.user.usedCredits = user.usedCredits;
                  session.user.fans = user.fans;   
                  session.user.grade = user.grade;             
                  session.user.actors = user.actors;                
              }
          }
          return session;          
      }
  }

  
};



export default NextAuth({
    ...authOptions,
    logger: {
        error(code, metadata) {
            console.error("Auth Error:", code, metadata)
        },
        warn(code) {
            console.warn(code)
        },
        debug(code, metadata) {
            console.debug(code, metadata)
        }
    },
});
