import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import useSWR from "swr";
import Script from "next/script";
import Link from "next/link";

import TopFrame from "../../components/TopFrame";
import Image from "../../components/wrapper/Image";

import { authOptions } from "../../pages/api/auth/[...nextauth]";
import { config } from "../../utils/config";
import * as monitor from "../../utils/monitor";




export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    monitor.logUserRequest(ctx, session);    
    return {
        props:{ 
            config
        }
    };    
}




export default function aboutus({ config }: { config:any }) {  
    
    return (
        <TopFrame config={config}>
            <Script src="https://js.stripe.com/v3/pricing-table.js" />
            <Script src="https://cdn.paritydeals.com/banner.js" />
            <main>
                <div className="relative w-full pt-10 flex flex-col items-center">
                    <Image alt="office" src={"/bg/aboutus.jpg"} className="w-full h-auto"/> 

                    <div className="absolute w-full top-10 left-0 flex flex-col items-center">
                        <div className="items-center flex flex-col w-full mx-2 sm:w-3/4 mt-1 sm:mt-5 mb-10 bg-black opacity-90 px-10 py-5 rounded-2xl">
                            <div className="text-center hidden sm:block">
                                <h4 className="title-main tracking-widest">
                                    关于我们
                                </h4>
                            </div>
                            
                            <div className="items-center flex flex-col w-full mt-2 tracking-wide">
                                <p className="text-white text-lg mb-5 text-left items-left w-full">
                                    北京明快信息科技有限公司，是一家专注于全新一代人工智能技术研发和应用的高科技公司。公司旗下有Niukit AI和AI菩提-速读两款产品。
                                </p>
                                <p className="text-white text-lg mb-5 text-left items-left w-full">
                                    Niukit AI(<Link href="https://www.niukit.com">www.niukit.com</Link>)是照片、视频和音频AI生成及处理套件，广泛应用于AI写真、电商产品包装、短视频制作、广告设计等业务领域。  
                                </p>
                                <p className="text-white text-lg mb-5 text-left items-left w-full">
                                    AI菩提(<Link href="https://www.aiputi.cn">www.aiputi.cn</Link>)是AI书籍辅助阅读网站。
                                    “菩提”一词是梵文Bodhi的音译，意思是觉悟、智慧，用以指人忽如睡醒，豁然开悟，突入彻悟途径，顿悟真理，达到超凡脱俗的境界。
                                    在AI菩提，博大精深的中国文化，和尖端的现代AI技术，将会结合在一起。为世界文明的进步推波助澜！
                                </p>
                                <p className="text-white text-lg mb-5 text-left items-left w-full">
                                    中国公司地址：北京市平谷区平谷府前西街40号205
                                </p>
                                <p className="text-white text-lg mb-5 text-left items-left w-full">
                                    美国公司地址：480 S REDLANDS AVE PERRIS CA 92570
                                </p>
                                
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative w-full flex flex-col items-center">
                    <div className="w-full">
                        <Image alt="office" src={"/bg/office.jpg"} className="w-full"/> 
                    </div>
                    <div className="absolute w-full top-10 left-0 flex flex-col items-center">
                        <div className="items-center flex flex-col w-full mx-2 sm:w-3/4 mt-1 sm:mt-5 mb-10 bg-black opacity-90 px-10 py-5 rounded-2xl">
                            <div className="text-center hidden sm:block">
                                <h4 className="title-main tracking-widest">
                                    联系我们
                                </h4>
                            </div>
                            <ul
                              role="list"
                              className="mt-2 grid grid-cols-1 gap-4 leading-6 text-gray-200 sm:grid-cols-2 sm:gap-6 mb-10 tracking-wide text-2xl"
                            >
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                商务合作：bd@aiputi.cn
                              </li>
                
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                AI技术合作：dev@aiputi.cn
                              </li>
                
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                投资机构：investor@aiputi.cn
                              </li>
                
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                提出建议：pm@aiputi.cn
                              </li>
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                版权问题：lawyer@aiputi.cn
                              </li>
                              <li className="flex gap-x-3">
                                <svg
                                  className="h-6 w-5 flex-none text-main"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                使用帮助：support@aiputi.cn
                              </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main> 
        </TopFrame>
    );
}
