const $=selector=>document.querySelector(selector);
const access=$('#vaultAccess'),workspace=$('#vaultWorkspace'),form=$('#vaultForm'),list=$('#accountList'),status=$('#vaultStatus'),loadMore=$('#loadMoreAccounts');
const PAGE_SIZE=24,LIST_TTL=30000,requestInflight=new Map(),listCache=new Map(),secretDetails=new Map(),visibleSecrets=new Set(),revealTimers=new Map();
let viewerId=null,items=[],editingId=null,nextCursor=null,secretGeneration=0,editSecretTimer=null;

function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
async function api(path='',options={}){
  const method=String(options.method||'GET').toUpperCase(),key=method==='GET'?method+':'+path:null;
  if(key&&requestInflight.has(key))return requestInflight.get(key);
  const task=(async()=>{
    const response=await fetch('/api/admin/account-vault'+path,{cache:'no-store',credentials:'same-origin',...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'ทำรายการไม่สำเร็จ');
    return data;
  })();
  if(key)requestInflight.set(key,task);
  try{return await task}finally{if(key&&requestInflight.get(key)===task)requestInflight.delete(key)}
}
function resetForm(){
  editingId=null;clearTimeout(editSecretTimer);editSecretTimer=null;form.reset();
  form.elements.password_hint.type='password';$('#togglePasswordHint').textContent='แสดง';
  $('#formTitle').textContent='เพิ่มบัญชีโซเชียล';$('#saveAccount').textContent='บันทึกบัญชีโซเชียล';$('#cancelEdit').hidden=true;
}
function conceal(id){secretDetails.delete(id);visibleSecrets.delete(id);clearTimeout(revealTimers.get(id));revealTimers.delete(id)}
function retainSecret(id,secret){
  secretDetails.set(id,secret);clearTimeout(revealTimers.get(id));
  revealTimers.set(id,setTimeout(()=>{conceal(id);if(editingId===id)resetForm();render();message('ซ่อนข้อมูลให้อัตโนมัติแล้ว')},60000));
}
async function loadSecret(item){
  if(secretDetails.has(item.id))return secretDetails.get(item.id);
  const revision=secretGeneration,secret=await api('/'+item.id);if(revision!==secretGeneration)return null;
  retainSecret(item.id,secret);return secret;
}
function clearPlaintext(){
  secretGeneration++;
  for(const id of [...secretDetails.keys()])conceal(id);
  if(editingId)resetForm();
  else{clearTimeout(editSecretTimer);editSecretTimer=null;form.elements.email.value='';form.elements.phone.value='';form.elements.password_hint.value='';form.elements.password_hint.type='password';$('#togglePasswordHint').textContent='แสดง'}
  render();
}
function invalidateVault(id){listCache.clear();if(id!=null)conceal(Number(id))}
async function reveal(item){
  if(visibleSecrets.has(item.id)){conceal(item.id);render();return}
  try{
    const secret=await loadSecret(item);if(!secret)return;visibleSecrets.add(item.id);
    render();message('แสดงข้อมูลแล้ว ระบบจะซ่อนให้อัตโนมัติใน 60 วินาที');
  }catch(error){message(error.message,true)}
}
async function edit(item){
  try{
    const secret=await loadSecret(item);if(!secret)return;
    editingId=item.id;form.elements.platform.value=item.platform;form.elements.account_name.value=item.account_name;form.elements.login_url.value=item.login_url;
    form.elements.phone.value=secret.phone||'';form.elements.email.value=secret.email||'';form.elements.password_hint.value=secret.password_hint||'';form.elements.note.value=item.note||'';
    $('#formTitle').textContent='แก้ไขบัญชีโซเชียล';$('#saveAccount').textContent='บันทึกการแก้ไข';$('#cancelEdit').hidden=false;
    clearTimeout(editSecretTimer);editSecretTimer=setTimeout(()=>{resetForm();message('ซ่อนข้อมูลแก้ไขให้อัตโนมัติแล้ว')},60000);
    form.scrollIntoView({behavior:'smooth'});form.elements.platform.focus();
  }catch(error){message(error.message,true)}
}
async function copyText(value,success){
  try{
    if(!navigator.clipboard?.writeText)throw new Error('CLIPBOARD_UNAVAILABLE');
    await navigator.clipboard.writeText(value);message(success);
  }catch{message('คัดลอกไม่สำเร็จ กรุณาลองอีกครั้ง',true)}
}
function copyLink(item){return copyText(item.login_url,'คัดลอกลิงก์แล้ว')}
async function copyEmail(item){
  try{const secret=await loadSecret(item);if(!secret)return;if(!secret.email)throw new Error('EMAIL_UNAVAILABLE');await copyText(secret.email,'คัดลอกอีเมลแล้ว')}
  catch{message('คัดลอกอีเมลไม่สำเร็จ กรุณาลองอีกครั้ง',true)}
}
async function remove(item){
  if(!confirm('ลบบัญชี “'+item.account_name+'” ใช่ไหม?'))return;
  try{await api('/'+item.id,{method:'DELETE'});invalidateVault(item.id);items=items.filter(value=>value.id!==item.id);render();message('ลบบัญชีโซเชียลแล้ว')}catch(error){message(error.message,true)}
}
function render(){
  $('#accountCount').textContent='แสดง '+items.length+' รายการ';list.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='ยังไม่มีบัญชีโซเชียล';list.append(empty)}
  for(const item of items){
    const row=document.createElement('article'),secret=visibleSecrets.has(item.id)?secretDetails.get(item.id):null;row.className='account-row';
    const title=document.createElement('h3');title.textContent=item.platform+' · '+item.account_name;
    const link=document.createElement('p');link.className='login-url';link.textContent=item.login_url;
    const details=document.createElement('p');details.className='secret-line';
    details.textContent=secret?'อีเมล: '+(secret.email||'-')+'\nเบอร์: '+(secret.phone||'-')+'\nคำใบ้รหัสผ่าน: '+secret.password_hint:'อีเมล: '+(item.email_masked||'-')+' · เบอร์: '+(item.phone_masked||'-')+' · คำใบ้รหัสผ่าน: '+(item.password_hint_masked||'••••••••');
    const note=document.createElement('small');note.textContent=item.note||'ไม่มีหมายเหตุ';
    const actions=document.createElement('div');actions.className='account-actions';
    const open=document.createElement('a');open.className='vds-btn vds-btn--primary';open.href=item.login_url;open.target='_blank';open.rel='noopener noreferrer';open.textContent='เปิดหน้าเข้าสู่ระบบ';
    const copyLogin=document.createElement('button');copyLogin.type='button';copyLogin.className='vds-btn vds-btn--secondary';copyLogin.textContent='คัดลอกลิงก์';copyLogin.onclick=()=>copyLink(item);
    const copyMail=document.createElement('button');copyMail.type='button';copyMail.className='vds-btn vds-btn--secondary';copyMail.textContent='คัดลอกอีเมล';copyMail.onclick=()=>copyEmail(item);
    const show=document.createElement('button');show.type='button';show.className='vds-btn vds-btn--secondary';show.textContent=secret?'ซ่อนข้อมูล':'แสดงข้อมูล';show.onclick=()=>reveal(item);
    const change=document.createElement('button');change.type='button';change.className='vds-btn vds-btn--secondary';change.textContent='แก้ไข';change.onclick=()=>edit(item);
    const del=document.createElement('button');del.type='button';del.className='vds-btn vds-btn--danger';del.textContent='ลบ';del.onclick=()=>remove(item);
    actions.append(open,copyLogin);if(item.has_email)actions.append(copyMail);actions.append(show,change,del);row.append(title,link,details,note,actions);list.append(row);
  }
  loadMore.hidden=!nextCursor;loadMore.disabled=false;
}
async function load(cursor=null){
  const path='?limit='+PAGE_SIZE+(cursor?'&cursor='+encodeURIComponent(cursor):''),key=viewerId+':'+path,cached=listCache.get(key);
  try{
    const data=cached&&cached.expires>Date.now()?cached.data:await api(path);
    if(!cached||cached.expires<=Date.now())listCache.set(key,{data,expires:Date.now()+LIST_TTL});
    const incoming=data.items||[];items=cursor?[...items,...incoming.filter(item=>!items.some(current=>current.id===item.id))]:incoming;
    nextCursor=data.pagination?.next_cursor||null;render();
    message(data.encryption_ready===false?'ต้องตั้ง ACCOUNT_VAULT_ENCRYPTION_KEY ก่อนบันทึก':'พร้อมใช้งาน',data.encryption_ready===false);$('#saveAccount').disabled=data.encryption_ready===false;
  }catch(error){message(error.message,true);loadMore.disabled=false}
}
async function init(){
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}),data=await response.json().catch(()=>({}));
    if(!response.ok||data.user?.role!=='boss'){access.innerHTML='<h2>เฉพาะ Boss เท่านั้น</h2><p>บัญชีนี้ไม่มีสิทธิ์เปิดบัญชีโซเชียล</p>';return}
    viewerId=Number(data.user.id);access.hidden=true;workspace.hidden=false;await load();
  }catch{access.innerHTML='<h2>ตรวจสอบสิทธิ์ไม่สำเร็จ</h2><p>กรุณาโหลดหน้าใหม่อีกครั้ง</p>'}
}
form.onsubmit=async event=>{
  event.preventDefault();const button=$('#saveAccount'),wasEditing=editingId,id=editingId;button.disabled=true;
  try{
    const body=Object.fromEntries(new FormData(form));if(!body.phone.trim()&&!body.email.trim())throw new Error('กรุณากรอกเบอร์โทรหรืออีเมลอย่างน้อยหนึ่งรายการ');
    const data=wasEditing?await api('/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}):await api('',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    invalidateVault(id??data.item?.id);items=wasEditing?items.map(item=>item.id===id?data.item:item):[data.item,...items.filter(item=>item.id!==data.item.id)];
    resetForm();render();message(wasEditing?'บันทึกการแก้ไขแล้ว':'บันทึกบัญชีโซเชียลแบบเข้ารหัสแล้ว');
  }catch(error){message(error.message,true)}finally{button.disabled=false}
};
$('#cancelEdit').onclick=resetForm;
$('#togglePasswordHint').onclick=()=>{const input=form.elements.password_hint,show=input.type==='password';input.type=show?'text':'password';$('#togglePasswordHint').textContent=show?'ซ่อน':'แสดง'};
loadMore.onclick=async()=>{if(!nextCursor)return;loadMore.disabled=true;await load(nextCursor)};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')clearPlaintext()});
window.addEventListener('pagehide',clearPlaintext);
init();
