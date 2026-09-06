import http from 'node:http';
import{loadSourceAdapter}from'./source-adapter.js';
import{readConfig,readiness,runCollector}from'./collector.js';

const port=Number(process.env.PORT)||8080,config=readConfig();
const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/health')return send(res,200,{service:'visiond-tiktok-commission-collector',...readiness(config)});
  if(req.method!=='POST'||req.url!=='/run')return send(res,404,{error:'not_found'});
  try{const readRows=await loadSourceAdapter(config.adapter),result=await runCollector(config,{readRows});return send(res,result.status,result)}catch(error){return send(res,500,{error:cleanError(error)})}
}).listen(port);

function cleanError(error){return String(error?.message||'collector_failed').replace(/[^A-Z0-9_\-]/gi,'_').slice(0,160)}
