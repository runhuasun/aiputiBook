// 前台login用的一些工具

export function checkLogin(status:string, keyValues:any){
    if(!window){
        alert("当前浏览器不支持！请使用Chrome, Edge, 360, Safari等主流浏览器");
        return false;
    }
    
    if(status != "authenticated"){
        let currentURL = new URL(window.location.href);
        let params = new URLSearchParams(currentURL.search);

        for(const kv of keyValues){
            if(kv[1]){
                params.set(kv[0], kv[1]);
            }
        }
        currentURL.search = params.toString();
        window.location.href = "/loginChoice?originalUrl=" + encodeURIComponent(currentURL.toString());
    }else{
        return true;
    }
}        
