import { Client, type Dispatcher } from 'undici';
import * as debug from './debug';
import * as enums from './enums';
import iconv from 'iconv-lite';
/*
interface ResponseData {
    statusCode: number;
    statusText: string;
    headers: Record<string, string>;
    body: ReadableStream | { arrayBuffer(): Promise<ArrayBuffer> };
}
*/
export async function callAPIinServer(
    url: string,
    params: any,
    method: string = 'POST',
    contentType: string = 'application/json'
) {
    let body: any = params;

    if (!body.timeStamp) {
        body.timeStamp = Date.now();
    }

    let result: any = null;
    let resultType: string | undefined;
    let status = enums.resStatus.unknownErr;
    const startTime = Date.now();

    try {
        const callURL = new URL(url);
        const client = new Client(callURL.origin || 'https://localhost', {
            bodyTimeout: 3600000,
            headersTimeout: 3500000,
        });

        debug.log(`callAPIinServer api url is : ${url}`);

        const clientRes = await client.request({
            path: callURL.pathname + callURL.search,
            method: method as Dispatcher.HttpMethod,
            headers: {
                'Content-Type': contentType,
                Accept: '*/*',
            },
            body: JSON.stringify(body),
        }) as unknown as Dispatcher.ResponseData;

        status = clientRes.statusCode;

        const contentTypeHeader = clientRes.headers['content-type'];
        const responseContentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader || '';
        
        const arrayBuffer = await clientRes.body.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (responseContentType.startsWith('image/') || responseContentType === 'application/octet-stream') {
            result = buffer;
            resultType = responseContentType.startsWith('image/') ? 'IMAGE' : 'BINARY';
        } else {
            const charsetMatch = responseContentType.match(/charset=([^;]+)/i);
            const charset = charsetMatch ? charsetMatch[1].trim().toLowerCase() : 'utf-8';
            const text = iconv.decode(buffer, charset);
        
            try {
                result = JSON.parse(text);
                resultType = 'JSON';
            } catch (err) {
                debug.error('JSON parse error:', err);
                debug.error('raw text:', text);
                result = text;
                if (responseContentType.startsWith('text/')) {
                    resultType = 'TEXT';
                }
            }
        }

        // ❗若返回错误码，打印错误
        if (status < 200 || status >= 300) {
            if(status === 300){
                debug.error("apiServer callAPIinServer get status: 等待结果中，先返回......");
            }else{
                debug.error("apiServer callAPIinServer get Error status:", status, result, clientRes);
            }
         }
        
    } catch (error: any) {
        debug.error('请求失败:', error);
        status = enums.resStatus.unExpErr;
        result = '访问服务器遇到意外失败，请稍后重试';
    } finally {
        const endTime = Date.now();
        debug.log(`----执行时间：${endTime - startTime}ms-----`);
    }

    return {
        status,
        result,
        ...(resultType ? { resultType } : {}),
    };
}
