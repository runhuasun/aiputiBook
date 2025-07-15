import LoadingDots from "./LoadingDots";

export default function LoadingButton(
    {minTime=30, maxTime=60, timeUnit="秒", isMini=false,
     title, titleClass="px-2 py-1 text-white text-sm",
     className}: 
    { minTime?:number, maxTime?:number, timeUnit?:string, title?:string, titleClass?:string, className?:string, isMini?:boolean}) {
    
    const mainClass = className || 
        ( isMini ?
        "button-gold rounded-full flex flex-col items-center text-white font-medium px-10 py-2"
         :
         "button-gold rounded-full flex flex-col items-center text-white font-medium px-2 pt-2 pb-3 w-100"
         );
    return (
      <div>
          <button disabled className={mainClass}>
              <span className="pt-1">
                  <LoadingDots color="white" style="large" />
              </span>
              {!isMini && title && (
              <span  className={titleClass}>
                  {title}
              </span>                    
              )}
              {!isMini && !title && (
              <span  className="px-2 py-1 text-white text-sm">
                  {`服务器大概需要${minTime}-${maxTime}${timeUnit}处理，请耐心等待。`}
              </span>                    
              )}
          </button>
      </div>                      
    );
}
