import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react"
import {channelType, channels, channelNames  } from "../utils/channels";
import React from 'react';
import { useRouter } from "next/router";

import Image from "./wrapper/Image";


export default function BuddhaHeader({
  photo,
  email,
}: {
  photo?: string;
  email?: string;
}) {
  
  const { data: session, status } = useSession();

  photo = session?.user?.image || undefined;
  email = session?.user?.email || undefined;
  const router = useRouter();
  let inviteBy = router.query.inviteBy;


  return (
    <div>
    <header className="fixed top-0 left-0 w-full z-50 flex flex-col opacity-80 bg-gray-900 shadow-md text-white xs:flex-row justify-between items-center  pb-3 pt-3 sm:px-4 px-2 gap-2">
      <Link href="/" className="flex space-x-2">
       
        <h1 className="ml-2 tracking-tight text-logo">
    
          AI菩提
        </h1>
      </Link>
      
      <div className="flex items-center space-x-1 sm:text-1xl text-sm">
        <Link
          href="/buddha"
          className=" pr-3 text-title-h sm:pr-4 flex space-x-2 "
        >
          <div>请佛</div>
        </Link>  
        
          
    
      </div>
      {email ? (
          
        <div className="flex items-center space-x-4 sm:text-2xl text-sm">
          <Link
            href="/profile?app=BUDDHA"
            className=" pr-4 flex space-x-2 text-title "
          >
            <div>设置</div>
          </Link>          
        
          <Link
            href="/buy-credits?app=BUDDHA"
            className=" pr-4 flex space-x-2 text-title "
          >
            <div>提子</div>

          </Link>
          
          {photo ? (
            <Link href="/dashboard?app=BUDDHA" className="flex space-x-2">
              <Image
                alt="Profile picture"
                src={photo}
                className="w-10 rounded-full"
                width={32}
                height={28}
              />
             </Link>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white" />
          )}
        </div>
      ) : 
      (
        <Link
          className="flex max-w-fit items-center justify-center space-x-2 rounded-lg button-main px-2 py-1 text-sm shadow-md  font-medium transition"
          href={"/loginChoice?app=BUDDHA" + (inviteBy ? ("&inviteBy=" + inviteBy) : "")}
 
        >
          <p>登录 </p>
        </Link>
      )
      
      }
    </header>
    

</div>      
  );
}



