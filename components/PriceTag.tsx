import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";

import { useSession } from "next-auth/react"
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import {getPricePack, getFuncByURL} from "../utils/funcConf";


export default function PriceTag({config, funcCode, model, units, unitName, refreshTime}: 
                               { config:any, funcCode?: string, model?:any, units?:number, unitName?:string, refreshTime?:number}) {

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    const [price, setPrice] = useState(99999);
    const [unitPrice, setUnitPrice] = useState(99999);
    const [discountPrice, setDiscountPrice] = useState(99999);
      
    const router = useRouter();
    const currentURL = router.asPath;    
  
    useEffect(() => {
        //alert("funcCode：" + funcCode);
        // 如果不给funcCode，默认根据URL获得当前功能
        if(!funcCode){
            const func = getFuncByURL(currentURL);
            //alert(JSON.stringify(func));
            funcCode = func?.code;
        }

        if(!funcCode){
            setPrice(99999);
        }else{
            const pp = getPricePack(config, funcCode, model, units);  
            setPrice(pp.price);
        }
        // 如果给了unitName，说明这个价格是需要根据单位计算的价格
        if(unitName){
            if(!funcCode){
                setUnitPrice(99999);
            }else{
                // 查询出每单位价格
                const up = getPricePack(config, funcCode, model, 1);    
                setUnitPrice(up.price);
            }
        }
    }, [units, model, funcCode]);

    useEffect(() => {
        // 如果传入了用户，并且是个新用户，有可能给出的是优惠价格      
      //  if(data?.usedCredits==0){
      //      const p = funcCode ? getPriceByFuncCode(config, funcCode, model, units, data) : 99999;  
     //       setDiscountPrice(p);
     //   }else{
            setDiscountPrice(99999);
     //   }              
    }, [data?.remainingGenerations]);

    useEffect(() => {
        mutate();
    }, [refreshTime]);
  
    const hasUnitNameAndUnits:boolean = !!(unitName && units);
    const hasUnitNameAndNoUnits:boolean = !!(unitName && !!!units);
    const hasDiscount:boolean = false; // discountPrice < price;
      
    // 运行这个功能需要10个提子每M视频内容
    // 运行这个功能需要100个提子(10M视频内容)
    // ${units}${unitName}，
    return (
        <div className="w-full flex flex-col items-center space-y-2">
            <p className="text-gray-200 mt-5 text-sm text-center">
                { hasUnitNameAndUnits && (
                <span>
                {`运行需要${price}个${config.creditName}（${unitPrice}个${config.creditName}每${unitName}）`}
                </span>                  
                )}              
              
                { hasUnitNameAndNoUnits && (
                <span className={(hasDiscount ? " text-gray-40 line-through decoration-red-300 " : "")}>
                  {`运行本功能需要${unitPrice}个${config.creditName}每${unitName}`}
                </span>
                )}

                { !unitName && (
                <span className={(hasDiscount ? "line-through decoration-red-300" : "")}>
                {`运行本功能需要${price}个${config.creditName}`}
                </span>
                )}
            </p>
            {hasDiscount && (
            <p className="text-orange-400 mt-2 text-sm text-center">
                {`首单用户，本次运行优惠价格${discountPrice}个${config.creditName}。`}
            </p>
            )}
            {((!hasDiscount && data?.remainingGenerations < price) || (hasDiscount && data?.remainingGenerations < discountPrice)) && (
            <p className="text-sm text-center">
                您还有<span className="font-semibold text-gray-100"> {data?.remainingGenerations} </span> 个{ config.creditName + "，" }
                购买{ config.creditName }：
                <Link
                    href="/buy-credits"
                    className="font-semibold blink underline underline-offset-2 hover:text-gray-200 transition"
                    >
                    点这里
                </Link>
            </p>
            )}
          
        </div>
    );
   
}
