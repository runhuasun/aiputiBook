const next = require('next');
const { createServer } = require('http');
import * as debug from "./utils/debug";
import {callAPI} from "./utils/apiUtils";
import { config } from "./utils/config";


const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// 定义守护任务（如轮询、定时器等）
export function initDeamonThreads(){
   debug.log("-------------sever.ts invoking deamon thread---------------");
   callAPI(config.website+"/api/deamonThread", {}).then((res) => {
       if(res.status == 200){
           debug.log("从_app.tsx启动守护进程成功");
       }else{
           debug.error("从_app.tsx启动守护进程发生错误：");
           debug.error(res.result);
       }
   });
}

app.prepare().then(() => {
    // 启动守护线程
    initDeamonThreads();
    
    createServer((req:any, res:any) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        handle(req, res, parsedUrl);
    }).listen(3000, () => {
        console.log('Server and daemon started on port 3000');
    });
});
