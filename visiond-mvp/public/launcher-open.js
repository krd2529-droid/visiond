(() => {
 const node=document.getElementById('status'),params=new URLSearchParams(location.hash.slice(1));
 history.replaceState(null,'',location.pathname);
 const command_id=params.get('command_id');
 if(params.size!==1||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(command_id||'')){node.textContent='กรุณากดเชื่อมจากหน้า TikTok Analyzer';return}
 let active=true;const controllers=new Set();window.addEventListener('pagehide',()=>{active=false;controllers.forEach(c=>c.abort())});
 const deadline=Date.now()+25000;
 const read=async()=>{
  const controller=new AbortController();controllers.add(controller);let timer;
  const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('คำขอหมดเวลาหรือหน้าถูกปิด')),{once:true}));
  try{return await Promise.race([(async()=>{const r=await fetch('/api/launcher/status?command_id='+command_id,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok)throw new Error('อ่านคำขอไม่ได้');return data})(),aborted,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('ตัวช่วยตอบกลับไม่ทันเวลา'))},Math.max(1,Math.min(5000,deadline-Date.now())))})])}
  finally{clearTimeout(timer);controllers.delete(controller)}
 };
 (async()=>{
  for(let attempt=0;attempt<8&&active&&Date.now()<deadline;attempt++){
   const result=await read();if(!active)return;
   if(result.command_id===command_id&&!result.expired&&['pending','claimed'].includes(result.status)){
    const port=Number(result.port);if(!Number.isInteger(port)||port<49152||port>65535)throw new Error('ข้อมูลตัวช่วยไม่ถูกต้อง');
    location.replace('http://127.0.0.1:'+port+'/launch?command_id='+command_id);return;
   }
   if(result.status!=='waiting')throw new Error('คำขอสิ้นสุดแล้ว กลับไปตรวจสถานะที่ VisionD');
   // Cover both sequential 5s Analyzer requests without increasing the eight-read cap.
   if(attempt<7)await new Promise(resolve=>setTimeout(resolve,Math.min([1000,2000,3000,4000,4000,4000,4000][attempt],Math.max(0,deadline-Date.now()))));
  }
  throw new Error('ไม่พบคำขอจากหน้า Analyzer กรุณากลับไปกดเชื่อมใหม่');
 })().catch(error=>{if(!active)return;node.textContent=error.message+' · หากแท็บนี้ไม่ปิดอัตโนมัติ สามารถปิดได้เลย';setTimeout(()=>window.close(),4000)});
})();
