import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import TopFrame from "../../components/TopFrame";
import Image from "../../components/wrapper/Image";
import LoadingRing from "../../components/LoadingRing";

import { callAPI } from "../../utils/apiUtils";
import * as monitor from "../../utils/monitor";
import { config } from "../../utils/config";


export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    return {
        props:{ 
            config
        }
    };    
}


export default function invitationPlan({ config }: { config:any }) {
    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, mutate } = useSWR("/api/remaining", fetcher);
    const { data: session, status } = useSession();
    
    const [invitationQRCode, setInvitationQRCode] = useState<string>();
    async function getInvitationQRCode(){
        try {
            const res = await callAPI('/api/signInWechat', {
                cmd: "GET_INVITATION_QR"
            });
            if(res?.status == 200){
                if(res.result){
                    setInvitationQRCode(res.result);
                }
            }
        } catch (error) {
            console.error(error);
        }        
    }
    useEffect(() => {
        getInvitationQRCode();
    }, []); 
   
    return (
        <TopFrame config={config}>
            <main className="w-full flex flex-col space-y-12 items-center">
                <div className="w-full text-center max-w-3xl px-10">
                    <Image id="invitationBanner" alt="QR Code" src={`${config.RS}/adv/invitation/invitationBanner.jpg`} className="w-full rounded-2xl sm:mt-0 mt-2"/>            
                </div>                     
                <div className="mt-8 text-center max-w-3xl px-10">
                    <h4 className="flex-none leading-6 mt-2 mb-6 text-lg font-medium	tracking-tight text-gray-300 text-left">
                        {config.inviteBonus > 0 && (    
                        <>
                            <span>每邀请一位朋友注册，在他首次使用时，您就将立即获得</span><span className="font-black">{config.inviteBonus}个{config.creditName}</span>
                        </>
                        )}
                        {config.inviteBonus > 0 && config.ICR <= 0 && (
                        <span>：</span>
                        )}
                        {config.inviteBonus > 0 && config.ICR > 0 && (
                        <span>。</span>
                        )}
                        {config.ICR > 0 && (
                        <>
                            <span>您邀请注册的朋友充值，您将按照他充值{config.creditName}数的</span><span className="font-black">{Math.round(config.ICR*100)}%</span><span>获得奖励：</span>
                        </>
                        )}                                   
                    </h4>
                    {(config.inviteBonus > 0 || config.ICR > 0) && (
                    <>
                        <p className="text-gray-300 mb-5 w-full max-w-3xl text-left">
                            方法一、让您的朋友使用手机号码注册，并输入您的邀请码：
                            <span className="text-gray-300">{data?.currentUserId}</span>
                        </p>   
                        <p className="text-gray-300 mb-5 w-full max-w-3xl text-left">
                            方法二、把以下链接发给您的朋友，请他（她）点击链接注册新用户：
                            <span className="text-gray-300">{`${config.website}/loginChoice?inviteBy=${data?.currentUserId}`}</span>
                        </p>   
                        {invitationQRCode ? (
                        <>
                            <p className="text-gray-300 mb-5 w-full max-w-3xl text-left">
                                方法三、把下面二维码发给您的朋友，请他（她）扫码关注我们的服务号：
                            </p>   
                            <div className="w-full flex flex-col items-center">
                                <Image id="invitationQRCode" alt="QR Code" src={invitationQRCode} className="w-64 rounded-2xl sm:mt-0 mt-2"/>            
                            </div>
                        </>
                        ) : (
                            <div className="w-full flex flex-col items-center">
                                <LoadingRing/>
                            </div>
                        ) }
                    </>
                    )}
                </div>
            </main>
        </TopFrame>
    );
            
}
