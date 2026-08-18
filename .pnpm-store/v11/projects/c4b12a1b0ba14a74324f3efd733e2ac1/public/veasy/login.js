const form=document.querySelector('#veasyLoginForm'),button=document.querySelector('#loginSubmit'),state=document.querySelector('#loginState'),success=document.querySelector('#loginSuccess'),owner=document.querySelector('#loginOwner'),returnButton=document.querySelector('#returnToApp'),logoutButton=document.querySelector('#logoutApp');
const params=new URLSearchParams(location.search),android=params.get('client')==='android'&&params.get('package')==='com.visiondonline.veasy';
let returnState='',deviceId='',activationResult=null;
const showError=error=>{state.textContent=error?.message||'เปิดใช้งานไม่สำเร็จ กรุณาลองใหม่';form.hidden=false;success.hidden=true};
const returnToApp=()=>{if(!activationResult)return;window.name=JSON.stringify({type:'veasy-auth-v1',returnState,...activationResult});history.back()};
async function activate(values){
  const response=await fetch('/api/vision7/auth/veasy-activate',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({...values,device_id:deviceId,device_name:'V Easy Android',app_version:'1.0.14'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`เปิดใช้งานไม่สำเร็จ (HTTP ${response.status})`);
  activationResult={accessToken:data.access_token,deviceId:data.device_id,accountScope:data.account_scope_id,shopId:data.shop.id,shopName:data.shop.name,userName:data.user.name||data.user.username,keyMasked:data.license.key_masked,licenseStatus:data.license.status,expiresAt:data.license.expires_at,maxDevices:data.license.max_devices,activeDevices:data.license.active_devices};
  form.reset();form.hidden=true;success.hidden=false;owner.textContent=`${activationResult.shopName} · ${activationResult.userName}`;returnButton.hidden=false;returnToApp();
}
form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity()||button.disabled)return;button.disabled=true;state.textContent='กำลังตรวจบัญชี คีย์ และร้าน…';try{await activate(Object.fromEntries(new FormData(form)))}catch(error){showError(error)}finally{button.disabled=false}};
returnButton.onclick=returnToApp;logoutButton.hidden=true;
if(android){try{const handoff=JSON.parse(window.name||'null');window.name='';if(handoff?.type!=='veasy-activation-request-v1'||handoff.returnState!==params.get('state')||!handoff.deviceId)throw new Error('คำขอจากแอปไม่ถูกต้อง กรุณากลับไปลองใหม่');returnState=handoff.returnState;deviceId=handoff.deviceId;for(const name of ['login','password','key','shop_name'])if(form.elements[name])form.elements[name].value=String(handoff[name]||'');form.requestSubmit()}catch(error){showError(error)}}else document.querySelector('#handoffHelp').textContent='กรุณาเปิดหน้านี้จากแอป V Easy';
