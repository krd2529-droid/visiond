(() => {
 const status=document.getElementById('status'),button=document.getElementById('confirm'),match=document.getElementById('match'),retry=document.getElementById('retry'),login=document.getElementById('login');
 const key='visiond_pair_pending',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
 let pair_id=new URLSearchParams(location.hash.slice(1)).get('id'),prepared=null,busy=false,done=false,active=true;
 const controllers=new Set();
 try{if(uuid.test(pair_id||''))sessionStorage.setItem(key,JSON.stringify({id:pair_id,expires:Date.now()+300000}));else{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved?.expires>Date.now()&&uuid.test(saved.id))pair_id=saved.id}}catch{}
 history.replaceState(null,'',location.pathname);
 window.addEventListener('pagehide',()=>{active=false;controllers.forEach(c=>c.abort())});
 const render=()=>{button.disabled=!done&&(busy||!prepared||!match.checked);match.disabled=busy||!prepared||done;retry.disabled=busy;retry.hidden=done};
 const request=async(path,body)=>{
  const c=new AbortController();controllers.add(c);let timer;
  try{return await Promise.race([(async()=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:c.signal,...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});let data;try{data=await r.json()}catch{throw new Error('อ่านคำตอบจาก VisionD ไม่สำเร็จ กรุณากดลองใหม่')}if(!r.ok){const e=new Error(r.status===401?'กรุณาเข้าสู่ระบบ VisionD ด้วยบัญชีที่จะผูกเครื่อง':r.status===403?'บัญชีนี้ยังไม่มีสิทธิ์ VX ที่ใช้งานได้':r.status===409?'คำขอหมดอายุหรือถูกผูกกับเซสชันอื่น เปิด VisionD Helper แล้วเลือกผูกเครื่องอีกครั้ง':'ติดต่อ VisionD ไม่สำเร็จ กรุณาลองใหม่');e.status=r.status;throw e}return data})(),new Promise((_,reject)=>{c.signal.addEventListener('abort',()=>reject(new Error('การเชื่อมต่อหมดเวลา กรุณากดลองใหม่')),{once:true});timer=setTimeout(()=>c.abort(),8000)})])}finally{clearTimeout(timer);controllers.delete(c)}
 };
 const failed=e=>{if(e.status===409){pair_id=null;try{sessionStorage.removeItem(key)}catch{}}if(!active)return;status.textContent=e.message;login.hidden=e.status!==401;render()};
 async function prepare(){
  if(busy||done)return;prepared=null;match.checked=false;login.hidden=true;
  if(!uuid.test(pair_id||'')){status.textContent='ไม่พบคำขอผูกเครื่อง เปิด VisionD Helper แล้วเลือกผูกเครื่อง หรือดาวน์โหลดตัวช่วยด้านล่าง';render();return}
  busy=true;status.textContent='กำลังตรวจบัญชีและคำขอผูกเครื่อง…';render();
  try{await request('/api/auth/me');const data=await request('/api/launcher/pair-prepare',{pair_id});if(!active)return;prepared=data;document.getElementById('code').textContent='รหัสยืนยัน: '+data.pair_code;document.getElementById('replace').textContent=data.replace_id?'ยืนยันแล้วจะแทนตัวช่วยเดิม '+data.replace_id:'ผูกตัวช่วยใหม่กับบัญชี VisionD นี้';status.textContent='เทียบรหัสกับหน้าต่าง VisionD Helper แล้วติ๊กช่องรหัสตรงกันเพื่อเปิดปุ่มยืนยัน'}catch(e){failed(e)}finally{busy=false;render()}
 }
 login.addEventListener('click',()=>{try{sessionStorage.setItem('vd_return_to','/launcher-pair.html')}catch{}location.assign('/login.html')});
 retry.addEventListener('click',prepare);match.addEventListener('change',render);
 button.addEventListener('click',async()=>{
  if(done){window.close();return}if(busy||!prepared||!match.checked)return;busy=true;render();
  try{const data=await request('/api/launcher/pair-confirm',{pair_id,confirm_nonce:prepared.confirm_nonce,pair_code:prepared.pair_code,replace_id:prepared.replace_id});if(!active)return;try{localStorage.setItem('visiond_launcher_helper',data.helper_id)}catch{}try{sessionStorage.removeItem(key)}catch{}done=true;prepared=null;status.textContent='ผูกตัวช่วยแล้ว กลับไปกดเชื่อมที่ช่องที่ต้องการ หากแท็บนี้ไม่ปิดอัตโนมัติ สามารถปิดได้เลย';button.textContent='ปิดแท็บนี้';setTimeout(()=>window.close(),800)}catch(e){prepared=null;failed(e)}finally{busy=false;render()}
 });
 prepare();
})();
