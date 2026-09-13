(() => {
 const status=document.getElementById('status'),actions=document.getElementById('launcher-actions'),dispatch=document.getElementById('launcher-dispatch'),setup=document.getElementById('launcher-setup'),params=new URLSearchParams(location.hash.slice(1));
 history.replaceState(null,'',location.pathname);
 const command_id=params.get('command_id'),validCommand=params.size===1&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(command_id||'');
 let active=true,port=0,checking=false;
 const controllers=new Set();
 const refocus=()=>{try{window.focus()}catch{}};
 window.addEventListener('pagehide',()=>{active=false;controllers.forEach(controller=>controller.abort())});
 const showActions=(state='not-running',retry=false,label='')=>{actions.hidden=false;setup.hidden=false;setup.href='/launcher-setup?state='+state;dispatch.hidden=!retry;dispatch.disabled=false;dispatch.textContent=label||(retry?'ลองเปิดคำขอเดิมอีกครั้ง':'เปิด Helper เครื่องนี้')};
 const message=(text,type='')=>{status.textContent=text;status.dataset.type=type};
 if(!validCommand){message('กรุณากดเชื่อมจากหน้า TikTok Analyzer','error');showActions('new',false);return}
 const read=async(deadline)=>{
  const controller=new AbortController();controllers.add(controller);let timer;
  const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('คำขอหมดเวลาหรือหน้าถูกปิด')),{once:true}));
  try{return await Promise.race([(async()=>{const response=await fetch('/api/launcher/status?command_id='+command_id,{credentials:'same-origin',cache:'no-store',signal:controller.signal}),data=await response.json();if(!response.ok)throw new Error('อ่านคำขอไม่ได้');return data})(),aborted,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('ตัวช่วยตอบกลับไม่ทันเวลา'))},Math.max(1,Math.min(5000,deadline-Date.now())))})])}
  finally{clearTimeout(timer);controllers.delete(controller)}
 };
 const classify=result=>{
  if(result.command_id&&result.command_id!==command_id)throw new Error('คำตอบไม่ตรงกับคำขอเดิม');
  if(result.error_code==='HELPER_UPDATE_REQUIRED')return {terminal:true,state:'outdated',text:'Helper เครื่องนี้เป็นรุ่นเก่า ต้องดาวน์โหลดและติดตั้งอัปเดตก่อน โปรไฟล์และการผูกเดิมยังคงอยู่'};
  if(result.oauth_status==='complete'||result.status==='process_started')return {success:true,text:result.oauth_status==='complete'?'บันทึกการอนุญาตแล้ว กลับไปตรวจช่องใน TikTok Analyzer':'Helper ยืนยันว่าเริ่ม Chrome ประจำช่องแล้ว'};
  if(result.expired)return {terminal:true,state:'not-running',text:'คำขอเดิมหมดอายุแล้ว กลับ TikTok Analyzer เพื่อเริ่มคำขอใหม่'};
  if(result.status==='unknown')return {terminal:true,state:'repair',text:'ผลการเปิดยังไม่แน่นอน ตรวจหน้าต่าง Chrome เดิมก่อน และอย่าเปิดคำขอซ้ำ'};
  if(['failed','cancelled'].includes(result.status))return {terminal:true,state:'repair',text:'คำขอเปิดสิ้นสุดแล้ว ยังไม่มีหลักฐานว่า Helper เครื่องนี้พร้อม'};
  return {};
 };
 const settle=result=>{
  const outcome=classify(result);
  if(outcome.success){refocus();message(outcome.text,'success');actions.hidden=false;dispatch.hidden=true;setup.hidden=true;setTimeout(()=>window.close(),1600);return true}
  if(outcome.terminal){refocus();message(outcome.text,'error');setup.hidden=false;showActions(outcome.state,false);return true}
  return false;
 };
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const poll=async({stopOnPending})=>{
  const deadline=Date.now()+25000;
  for(let attempt=0;attempt<8&&active&&Date.now()<deadline;attempt++){
   const result=await read(deadline);if(!active)return null;if(settle(result))return {terminal:true};
   if(result.command_id===command_id&&!result.expired&&['pending','claimed'].includes(result.status)){
    const candidate=Number(result.port);if(!Number.isInteger(candidate)||candidate<49152||candidate>65535)throw new Error('ข้อมูลตัวช่วยไม่ถูกต้อง');
    port=candidate;if(stopOnPending)return {pending:true};
   }else if(result.status!=='waiting')throw new Error('คำขอสิ้นสุดแล้ว กลับไปตรวจสถานะที่ VisionD');
   if(attempt<7)await wait(Math.min([1000,2000,3000,4000,4000,4000,4000][attempt],Math.max(0,deadline-Date.now())));
  }
  return null;
 };
 const openLocal=()=>{
  try{window.open('http://127.0.0.1:'+port+'/launch?command_id='+command_id,'_blank','noopener,noreferrer,popup,width=460,height=260');refocus();return true}catch{return false}
 };
 const runDispatch=async()=>{
  if(!active||checking||!port)return;
  if(!openLocal()){message('เบราว์เซอร์ไม่อนุญาตหน้าต่างตรวจ Helper กรุณาอนุญาตป๊อปอัปสำหรับ VisionD แล้วลองคำขอเดิมอีกครั้ง','error');showActions('not-running',true);return}
  checking=true;dispatch.disabled=true;dispatch.textContent='กำลังรอ Helper…';message('ส่งรหัสคำขอเดิมไปยัง Helper แล้ว กำลังรอการยืนยันจากเครื่องนี้');
  try{const result=await poll({stopOnPending:false});if(!active||result?.terminal)return;if(!result){message('Helper ที่ผูกกับบัญชียังไม่ตอบจากเครื่องนี้ อาจยังไม่ได้ติดตั้ง หยุดทำงาน หรืออยู่คนละเครื่อง','error');showActions('not-running',true)}}
  catch(error){if(active){message(error.message,'error');showActions('not-running',true)}}
  finally{checking=false;refocus()}
 };
 dispatch.addEventListener('click',runDispatch);
 (async()=>{
  try{const result=await poll({stopOnPending:true});if(!active||result?.terminal)return;if(result?.pending){message('พบคำขอแล้ว กด “เปิด Helper เครื่องนี้” เพื่อเปิด Chrome ประจำช่อง หากเครื่องนี้ยังไม่มีตัวช่วยให้ติดตั้งหรือซ่อมก่อน');showActions('not-running',true,'เปิด Helper เครื่องนี้')}else{message('ไม่พบคำขอจากหน้า Analyzer กรุณากลับไปกดเชื่อมใหม่ หรือเตรียม Helper เครื่องนี้ก่อน','error');showActions('new',false)}}
  catch(error){if(active){message(error.message,'error');showActions('not-running',false)}}
 })();
})();
