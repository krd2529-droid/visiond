(() => {
 const status=document.getElementById('status'),button=document.getElementById('confirm'),match=document.getElementById('match'),retry=document.getElementById('retry'),login=document.getElementById('login');
 const key='visiond_pair_pending',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
 let pair_id=null,prepared=null,busy=false,confirming=false,done=false,active=true,generation=0,expired=false,accepted=0;
 const controllers=new Set(),acceptUntil=Date.now()+300000;
 const current=(g,id)=>active&&g===generation&&id===pair_id;
 const clearHint=()=>{try{sessionStorage.removeItem(key)}catch{}};
 const render=()=>{const hasRequest=pair_id?.length===36&&uuid.test(pair_id);button.disabled=!done&&(busy||!prepared||!match.checked);match.disabled=busy||!prepared||done;retry.disabled=busy||done||expired||!hasRequest;retry.hidden=done||expired||!hasRequest};
 const request=async(path,body)=>{
  const c=new AbortController();controllers.add(c);let timer;
  try{return await Promise.race([(async()=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:c.signal,...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});let data;try{data=await r.json()}catch{throw new Error('อ่านคำตอบจาก VisionD ไม่สำเร็จ กรุณากดลองใหม่')}if(!r.ok){const e=new Error(r.status===401?'กรุณาเข้าสู่ระบบ VisionD ด้วยบัญชีที่จะผูกเครื่อง':r.status===403?'บัญชีนี้ยังไม่มีสิทธิ์ VX ที่ใช้งานได้':r.status===409?'คำขอนี้หมดอายุหรือใช้กับเซสชันนี้ไม่ได้ ต้องเปิด VisionD Helper แล้วเลือกผูกเครื่องอีกครั้งเพื่อเริ่มคำขอใหม่':'ติดต่อ VisionD ไม่สำเร็จ กรุณาลองใหม่');e.status=r.status;throw e}return data})(),new Promise((_,reject)=>{c.signal.addEventListener('abort',()=>reject(new Error('การเชื่อมต่อหมดเวลา กรุณากดลองใหม่')),{once:true});timer=setTimeout(()=>c.abort(),8000)})])}finally{clearTimeout(timer);controllers.delete(c)}
 };
 const failed=(e,g,id)=>{if(!current(g,id))return;if(e.status===409){pair_id=null;expired=true;prepared=null;clearHint()}status.textContent=e.message;login.hidden=e.status!==401};
 async function prepare(){
  if(busy||done||!active)return;prepared=null;match.checked=false;login.hidden=true;
  if(!uuid.test(pair_id||'')){status.textContent=expired?'คำขอเดิมใช้ไม่ได้แล้ว เปิด VisionD Helper และเลือกผูกเครื่องเพื่อเริ่มคำขอใหม่ ไม่ต้องลองส่งคำขอเดิมซ้ำ':'ไม่พบคำขอผูกเครื่อง เปิด VisionD Helper แล้วเลือกผูกเครื่อง หรือดาวน์โหลดตัวช่วยด้านล่าง';render();return}
  const g=generation,id=pair_id;busy=true;status.textContent='กำลังตรวจบัญชีและคำขอผูกเครื่อง…';render();
  try{await request('/api/auth/me');if(!current(g,id))return;const data=await request('/api/launcher/pair-prepare',{pair_id:id});if(!current(g,id))return;prepared=data;document.getElementById('code').textContent='รหัสยืนยัน: '+data.pair_code;document.getElementById('replace').textContent=data.replace_id?'ยืนยันแล้วจะแทนตัวช่วยเดิม '+data.replace_id:'ผูกตัวช่วยใหม่กับบัญชี VisionD นี้';status.textContent='เทียบรหัสกับหน้าต่าง VisionD Helper แล้วติ๊กช่องรหัสตรงกันเพื่อเปิดปุ่มยืนยัน'}catch(e){failed(e,g,id)}finally{if(active&&g===generation){busy=false;render()}}
 }
 function receiveHash(){
  const hash=location.hash||'';if(!hash)return false;
  history.replaceState(null,'',location.pathname);
  const params=new URLSearchParams(hash.slice(1)),id=params.get('id');
  if([...params.keys()].length!==1||id?.length!==36||!uuid.test(id||''))return false;
  if(done||confirming){status.textContent=done?'ยืนยันคำขอก่อนหน้าแล้ว เปิดหน้าใหม่จาก Helper หากต้องการผูกเครื่องอื่น':'กำลังยืนยันคำขอเดิม โปรดรอผลก่อนเริ่มคำขอใหม่';return true}
  if(id===pair_id)return true;
  if(accepted>=8||Date.now()>acceptUntil){status.textContent='หน้านี้รับคำขอครบหรือเปิดไว้นานแล้ว เปิดหน้าใหม่จาก VisionD Helper';return true}
  generation++;controllers.forEach(c=>c.abort());accepted++;pair_id=id;prepared=null;busy=false;expired=false;match.checked=false;
  document.getElementById('code').textContent='';document.getElementById('replace').textContent='';
  try{sessionStorage.setItem(key,JSON.stringify({id,expires:Date.now()+300000}))}catch{}
  prepare();return true;
 }
 window.addEventListener('hashchange',receiveHash);
 window.addEventListener('pagehide',()=>{active=false;generation++;controllers.forEach(c=>c.abort());busy=false});
 login.addEventListener('click',()=>{try{sessionStorage.setItem('vd_return_to','/launcher-pair')}catch{}location.assign('/login.html')});
 retry.addEventListener('click',prepare);match.addEventListener('change',render);
 button.addEventListener('click',async()=>{
  if(done){window.close();return}if(busy||!prepared||!match.checked||!active)return;
  const g=generation,id=pair_id,approval=prepared;busy=true;confirming=true;render();
  try{const data=await request('/api/launcher/pair-confirm',{pair_id:id,confirm_nonce:approval.confirm_nonce,pair_code:approval.pair_code,replace_id:approval.replace_id});if(!current(g,id))return;try{localStorage.setItem('visiond_launcher_helper',data.helper_id)}catch{}clearHint();done=true;prepared=null;status.textContent='ผูกตัวช่วยแล้ว กลับไปกดเชื่อมที่ช่องที่ต้องการ หากแท็บนี้ไม่ปิดอัตโนมัติ สามารถปิดได้เลย';button.textContent='ปิดแท็บนี้';setTimeout(()=>window.close(),800)}catch(e){if(current(g,id)){prepared=null;failed(e,g,id)}}finally{if(active&&g===generation){busy=false;confirming=false;render()}}
 });
 if(!receiveHash()){
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved?.expires>Date.now()&&saved.id?.length===36&&uuid.test(saved.id))pair_id=saved.id;else if(saved){expired=true;clearHint()}}catch{}
  prepare();
 }
})();
