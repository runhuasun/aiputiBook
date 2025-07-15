import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import Script from "next/script";

import TopFrame from "../../components/TopFrame";
import * as monitor from "../../utils/monitor";
import { config } from "../../utils/config";


export async function getServerSideProps(ctx: any) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    monitor.logUserRequest(ctx, session);    
    return {
        props:{ 
            config
        }
    };    
}


export default function terms({ config }: { config:any }) {


  return (
      <TopFrame config={config}>

      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      <Script src="https://cdn.paritydeals.com/banner.js" />
      <main className="px-10">

           <div className="mb-5 text-center hidden sm:block">
            <h4 className="title-main">
              服务条款
            </h4>
          </div>
 
          <div className="text-gray-200 bg-black p-10 rounded-2xl opacity-70 text-lg text-left items-left">
            <p>我们的服务条款更新版本于2023年1月生效。您可以阅读以下服务条款。 </p>
            <p>欢迎来到{config.appName}！ 通过访问其网站，您同意遵守以下条款和条件并受其约束。 “{config.appName}”是北京明快信息科技有限公司的注册商标。
              除非经我们事先书面许可，否则严禁将{config.appName}商标用于不属于北京明快信息科技有限公司的任何产品或服务。 如有违反，我们将针对侵权行为诉诸于法律。
            </p>
            <p>北京明快信息科技有限公司于此提供资讯和产品。若你使用本网站，即表示你同意遵守以下条约及准则并受其约束。 
              {config.appName}及所属北京明快信息科技有限公司保留随时更改此等条约及准则，以及此网站提及的产品、服务、价格、计划的权利，并有权在任何此等条约及准则被违反的情况下寻求法律上和平衡法则方面的所有补救措施。
            </p>
            
            <h2 id="版权" className="title-main-2" >版权</h2>
            <p>本网站及其所载资料（包括但不限于文字、图表、商标、声音和软件）均为{config.appName}及所属北京明快信息科技有限公司版权所有。
              未经{config.appName}事先书面许可，不得以任何形式或任何手段（包括相片复制、录制或其他电子或机械方法）复制、分发或发送本网站所载内容的任何部分。
              以下除外：
            </p>
            <ol>
              <li>你可以打印或下载到本机硬盘，并且只作个人和非商业用途。</li>
              <li>只有当你说明材料来源为本网站，你才可以将内容复制到第三方以供个人使用。</li>
            </ol>
            <h2 id="赔偿" className="title-main-2">赔偿</h2><p>对于因你违反本条款中任何条文规定而引起的任何及所有责任、成本、要求、诉讼、损害和费用（包括合理的律师费），你特此同意最大程度赔偿北京明快信息科技有限公司。
            </p>
            <h2 id="免责声明" className="title-main-2">免责声明</h2><p>尽管本公司采取了一切措施尽力验证本网站所载资讯的准确性，
            但是本公司或任何第三方均不担保或保证本网站所提供的资讯、材料和软件的准确性、及时性、性能、完整性或适用性可用于任何特定目的。
            你确认已知晓这些资讯和材料可能存在不准确性或错误，且本公司明确声明对上述不准确性或错误免除法律允许下最大范围的责任。
            </p>
            <p>你使用本网站上的所有资讯、材料或软件的同时，所有风险完全自负。确保经由本网站提供的任何产品、服务或资讯符合你的要求是你本人的责任。
            </p>
            <p>本网站某些内容来源于互联网，仅供显示，作者保留所有权利。如果涉及侵权，请以书面形式通知本公司，本公司将毫不迟疑地删除有关内容。
            </p>
            <h2 id="连结至其他网站" className="title-main-2">连结至其他网站</h2>
            <p>本公司的服务可能包含连结至第三方网站或服务，这些网站或服务并非由{config.appName}拥有或控制。
            </p>
            <p>我们无法控制任何第三方网站或服务的内容、隐私政策或惯例，也不承担任何责任。因此，在浏览第三方网站时，你将自负风险并自行承担全部责任。</p>
            <p>我们强烈建议你阅读所访问的第三方网站或服务的条款和准则以及隐私政策。</p>
            <h2 id="下载" className="title-main-2">下载</h2><p>{config.appName}网站提供某些图片和软件。虽然允许自由下载，但你不得复制或再发行。图片和软件授权受中国法律和贵国法律管辖。</p>
            <h2 id="商标" className="title-main-2">商标</h2>
            <p>{config.appName}商标严禁在任何不属于{config.appName}的产品或服务上使用，除非事先获得{config.appName}书面许可。否则将构成违法的商标侵权和不公平竞争行为。</p>
            <h2 id="反馈" className="title-main-2">反馈</h2>
            <p>本公司重视用户的反馈，无论是疑问、期望或评论，并且时刻期待用户给予建议，以助优化本公司的软件。
            如果你选择于此提交评论、意见或反馈，即表示你同意本公司可以全权与无偿地使用你所提交的反馈。
            </p>

        </div>        
                  
        </main> 
    </TopFrame>
  );
}
