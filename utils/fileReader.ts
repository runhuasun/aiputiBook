import * as Fetcher from "node-fetch";
import {log, warn, error} from "./debug";
import * as fs from 'fs';
import * as mime from 'mime-types';
import * as mammoth from 'mammoth';
import WordExtractor from "word-extractor"; 
import xlsx from "node-xlsx";
import PDFParser from "pdf2json";
import { EventEmitter } from 'events';
import {parseStructure, parseToSentences} from "./parser";
// import parse from 'pptx-parser'  // 找不到模块
// import PptxTemplater from 'pptxtemplater'; // 找不到模块，不能用
// import * as pptxgen from 'pptxgenjs'; // 只能生成PPT，没有读取函数
// import * as pptxtojson from 'pptxtojson' // 不能在后台用
// import PPTX from "nodejs-pptx"; // 内部结构不好用
// import officegen from 'officegen'; // 只能创建
// import Extractor from 'extract-text-from-ppt'; // npm找不到这个模块
import v8 from "v8";


///////////////////////////////////////////////////////////
// 读取dataset中的文本
///////////////////////////////////////////////////////////
export async function readFile(datasetUrl:string, levelSigns?:string): Promise< string[] > {
  
    log("start reading file:" + datasetUrl);
    const dtRet = await fetch(datasetUrl);
    let dtText = "";


    //const maxHeapSize = 4096;
    //v8.setFlagsFromString(`--max-old-space-size=${maxHeapSize}`);

    const heapStatistics = v8.getHeapStatistics();
    
    console.log('Heap Statistics:');
    console.log('-------------------------------------');
    console.log('Total Heap Size      :', heapStatistics.total_available_size / (1024 * 1024), 'MB');
    console.log('Used Heap Size       :', heapStatistics.used_heap_size / (1024 * 1024), 'MB');
    console.log('Heap Size Limit      :', heapStatistics.heap_size_limit / (1024 * 1024), 'MB');
    console.log('Available Heap Size  :', heapStatistics.total_available_size / (1024 * 1024), 'MB');
  
    if(dtRet.ok){
      const mimeType = dtRet.headers.get('content-type');
      log("file mimeType:" + mimeType);
      if(mimeType == "text/plain"){
        // 读取普通文件
        
        dtText = await dtRet.text();
        
      }else if(mimeType == "application/vnd.ms-powerpoint" || mimeType == "application/vnd.openxmlformats-officedocument.presentationml.presentation"){
        // 读取PPT文件
        const content = Buffer.from(await dtRet.arrayBuffer());

        log("PPT JSON\n");
        return [];

      }else if(mimeType == "application/vnd.ms-excel" || mimeType == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"){
        // 读取Excel
        const content = Buffer.from(await dtRet.arrayBuffer());
        const sheets = xlsx.parse(content);
        const data = sheets[0].data;

        let sections:string[] = [];
        let titles:string[] = [];
        let row = 0;
        let col = 0;
          
        // 按行、列读取数据
        data.forEach(rowData => {
            dtText = "";
            for(const cell of rowData){
                // 如果设置了标题，并且标题还未设置好  
                if(row==0){
                    if(cell && cell.trim()!=""){
                        titles.push(cell+":");
                    }else{
                        titles.push("");
                    }
                }else{
                    if(cell){
                        const delta = (titles.length!=0 && titles[col]) ? titles[col]+cell : cell;
                        dtText += delta + "\n";
                    }
                }
                col++;              
            }
          
            if(dtText != ""){
                sections.push(dtText);
            }
            row++;
            col = 0;
        });

        log("读取到" + sections.length + "条记录");
        return sections;
        
      }else if(mimeType == "application/msword" || mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
          // 读取Word
          if (mimeType === 'application/msword') {
              // 处理doc文件
              log("开始读取word文件");
              const content = Buffer.from(await dtRet.arrayBuffer());
              log("word文件被读入内存buffer");
              log('Used Heap Size       :' + heapStatistics.used_heap_size / (1024 * 1024) + 'MB');

              const extractor = new WordExtractor();
              log("开始提取word中的内容");
              const extracted = await extractor.extract(content);
              log("word中内容被提取完毕");
              log('Used Heap Size       :' + heapStatistics.used_heap_size / (1024 * 1024) + 'MB');
              
              log("开始提取word内容中的文本");          
              dtText = extracted.getBody();
              log("word中的文本被提取完毕");
              log('Used Heap Size       :' + heapStatistics.used_heap_size / (1024 * 1024) + 'MB');
              
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              // 处理docx文件
              log("开始读取word文件");
              const content = Buffer.from(await dtRet.arrayBuffer());
              log("word文件被读入内存buffer");
              log('Used Heap Size       :' + heapStatistics.used_heap_size / (1024 * 1024) + 'MB');

              log("开始提取word中的内容");              
              dtText = (await mammoth.extractRawText({ buffer: content })).value;   

            /*
              const result = await mammoth.extractRawText({ buffer: content });
              result.messages.forEach((message) => {                  
                  log("message:" + JSON.stringify(message));
              });

              const html = await mammoth.convertToHtml({ buffer: content });
              log("HTML:" + html.value);
*/
                                      
             
              log("word中内容被提取完毕");
              log('Used Heap Size       :' + heapStatistics.used_heap_size / (1024 * 1024) + 'MB');              
        }        

      }else if(mimeType == "application/pdf"){
          // 读取PDF
          const eventEmitter = new EventEmitter();
  
          const pdfParser = new PDFParser();
          pdfParser.on("readable", meta => log("PDF Metadata" + meta.toString()) );
          pdfParser.on("data", page => {
              if(page){
                  // log(JSON.stringify(page));                
                  page.Texts.forEach(text => {
                      try{
                          // let i = 0;
                          for(const r of text.R){
                              const acc = decodeURIComponent(r.T);
                              // log(i++ + ":" + acc);
                              // if(i>0){
                              //  error(acc);
                              // }
                            
                              dtText += acc;
                          }
                      }catch(e){
                          error("pdf parser decode error:\n" + e);
                      }
                  });
              }
        });
          
        pdfParser.on("pdfParser_dataReady", pdfData => {
            eventEmitter.emit('parserFinished');                 
        });
          
       
        pdfParser.on("pdfParser_dataError", errData => {
            error("pdfParser_dataError:\n");
            record("pdf parse failed:" + datasetUrl);
            error( errData.toString() );
            eventEmitter.emit('parserFinished');     
        });

        await pdfParser.parseBuffer(Buffer.from(await dtRet.arrayBuffer()));

        // 等待线程parser的完成信号
        await new Promise<void>(resolve => {
          eventEmitter.once('parserFinished', () => {
            log('Thread parser finished');
            resolve();
          });
        });              
 
      }else{
        error(mimeType + "是不支持的文件类型");
      }
      
  
    }

    log(levelSigns);  
    if(levelSigns && levelSigns.trim() != ""){
      const data = parseStructure(dtText, levelSigns);
        let sections:string[] = [];
        data.forEach(row => {
            dtText = "";
            row.forEach(cell => {
              dtText += cell + " ";
            });
            if(dtText.trim()!=""){
              sections.push(dtText);
            }
        });  

      log("读取到" + sections.length + "条记录");
      return sections;
    }else{
      log("读取到1条记录");
       return [dtText];
    }
}


export function record(content:any){
    const fileName = "./tmp/records.tmp";
    fs.appendFile(fileName, content.toString() + "\n", (err)=>{
        if(err){
            error("写入临时记录失败!");
            error(err);
        }
    });
}


