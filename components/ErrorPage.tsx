import TopFrame from "../components/TopFrame";

export default function ErrorPage({ config, pageName, errMsg }: { config:any, pageName?:string, errMsg?: string}) {
    const title = "系统发生错误";
    const desc = "错误页面";
    const icon = config.logo32;
    
    return (
        <TopFrame config={config}>
            <h1 className="title-main text-red hidden sm:block">
                <p>{title}</p>
            </h1>
            <main>
                <h1 className="title-main">
                    {pageName && (
                    <p>你访问的<span className="title-light">“{pageName}”</span> 不存在！</p>
                    )}
                    {errMsg && (
                    <p>{errMsg}</p>
                    )}
                </h1>
            </main>
      </TopFrame>
    );
    
}


