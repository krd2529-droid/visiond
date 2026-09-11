import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
if(!process.argv.includes('--gui-probe'))throw Error('Explicit --gui-probe required; opens disposable local-only Chrome windows');
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const nativeSource=await readFile(new URL('./Launcher.cs',import.meta.url),'utf8');
const root=await mkdtemp(join(tmpdir(),'visiond-tab-probe-'));
const server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html');res.end(req.url==='/landing'?'<title>VisionD local login fixture</title><h1>Local login fixture — no provider</h1>':'<title>VisionD local bootstrap fixture</title><script>location.replace("/landing")</script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(name,profile,withNewWindow){
 const args=['--user-data-dir='+profile,'--no-default-browser-check',...(nativeSource.includes('QuoteArgument("--no-first-run")')?['--no-first-run']:[]),...(withNewWindow?['--new-window']:[]),'--remote-debugging-port=0',origin+'/bootstrap'];
 const child=spawn(chrome,args,{windowsHide:true,stdio:'ignore'});let ws;
 try{
  let port,version;for(let i=0;i<60;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();if(version.webSocketDebuggerUrl)break}catch{}await sleep(250)}
  if(!version?.webSocketDebuggerUrl)throw Error('No test-owned CDP port');
  ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(pending.has(x.id)){pending.get(x.id)(x);pending.delete(x.id)}};const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))});
  await sleep(3000);let targets=await send('Target.getTargets');
  for(const t of targets.result.targetInfos.filter(t=>t.url==='chrome://intro/')){
   const attached=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true}),sessionId=attached.result.sessionId;
   const evalPage=expression=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,sessionId,method:'Runtime.evaluate',params:{expression,returnByValue:true}}))});
   const result=await evalPage(`(()=>{const all=[];function walk(root){for(const el of root.querySelectorAll('*')){if(el.matches('button,cr-button'))all.push({id:el.id,text:el.textContent.trim(),hidden:el.hidden});if(el.shadowRoot)walk(el.shadowRoot)}}walk(document);return all})()`);
   console.log(JSON.stringify({name,introButtons:result.result?.result?.value}));
   if(result.result?.result?.value?.some(b=>b.id==='declineSignInButton'&&b.text==='Stay signed out')){
    await evalPage(`(()=>{function find(root){for(const el of root.querySelectorAll('*')){if(el.id==='declineSignInButton'&&el.textContent.trim()==='Stay signed out'){el.click();return true}if(el.shadowRoot&&find(el.shadowRoot))return true}return false}return find(document)})()`);await sleep(2500);
    const next=await evalPage(`(()=>{const all=[];function walk(root){for(const el of root.querySelectorAll('*')){if(el.matches('button,cr-button'))all.push({id:el.id,text:el.textContent.trim(),hidden:el.hidden});if(el.shadowRoot)walk(el.shadowRoot)}}walk(document);return all})()`);console.log(JSON.stringify({name,nextButtons:next.result?.result?.value}));
   }
  }
  targets=await send('Target.getTargets');
  const pages=targets.result.targetInfos.filter(t=>t.type==='page').map(t=>({id:t.targetId,url:t.url.startsWith(origin)?t.url.replace(origin,'LOCAL'):t.url,title:t.title}));console.log(JSON.stringify({name,profile,pid:child.pid,pages,count:pages.length,singleUseful:pages.length===1&&pages[0].url==='LOCAL/landing'}));
  await send('Browser.close');ws.close();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);
  if(!(pages.length===1&&pages[0].url==='LOCAL/landing'))throw Error('Expected exactly one useful local tab');
 }finally{if(ws?.readyState===1)ws.close();}
}
try{console.log(JSON.stringify({root,scope:'disposable profiles only; no provider/real account/installed helper'}));await probe('candidate-clean-new-window',join(root,'candidate'),true);await probe('candidate-established-new-window',join(root,'candidate'),true)}finally{server.close()}
