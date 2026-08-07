import {json,requireAdmin} from '../../_lib.js';
import {loadPaymentSettings,saveSetting} from '../../_payment.js';
export async function onRequestGet(ctx){const a=await requireAdmin(ctx);if(a.error)return a.error;return json({item:await loadPaymentSettings(ctx.env)},200,{'cache-control':'no-store'})}
export async function onRequestPut(ctx){
  const a=await requireAdmin(ctx);if(a.error)return a.error;
  const form=await ctx.request.formData(),old=await loadPaymentSettings(ctx.env),requestedActive=String(form.get('active_account')||old.active_account);
  if(!['personal','company'].includes(requestedActive))return json({error:'บัญชีรับโอนไม่ถูกต้อง'},400);
  const active=a.user.role==='boss'?requestedActive:old.active_account,values={active_payment_account:active,personal_bank_name:String(form.get('personal_bank_name')||'').trim(),personal_account_name:String(form.get('personal_account_name')||'').trim(),personal_account_number:String(form.get('personal_account_number')||'').trim(),company_bank_name:String(form.get('company_bank_name')||'').trim(),company_account_name:String(form.get('company_account_name')||'').trim(),company_account_number:String(form.get('company_account_number')||'').trim(),accepting_orders:form.get('accepting_orders')==='1'?'1':'0',vision3_auto_verify:a.user.role==='boss'?(form.get('vision3_auto_verify')==='1'?'1':'0'):(old.vision3_auto_verify?'1':'0'),payment_message:String(form.get('payment_message')||'').trim().slice(0,500)};
  if(!values[`${active}_bank_name`]||!values[`${active}_account_name`]||!values[`${active}_account_number`])return json({error:'กรุณากรอกข้อมูลบัญชีที่เลือกให้ครบ'},400);
  for(const [key,value] of Object.entries(values))await saveSetting(ctx.env,key,value);
  const qr=form.get('qr');if(qr&&qr.size){if(typeof qr.arrayBuffer!=='function'||!['image/jpeg','image/png','image/webp'].includes(qr.type))return json({error:'QR ต้องเป็นรูป JPG, PNG หรือ WEBP'},400);if(qr.size>5*1024*1024)return json({error:'รูป QR ต้องมีขนาดไม่เกิน 5 MB'},400);const ext=qr.type==='image/png'?'png':qr.type==='image/webp'?'webp':'jpg',key=`payment-qr-${crypto.randomUUID()}.${ext}`;await ctx.env.FILES.put(key,await qr.arrayBuffer(),{httpMetadata:{contentType:qr.type}});if(old.qr_url?.startsWith('/api/media/payment-qr-'))await ctx.env.FILES.delete(old.qr_url.slice('/api/media/'.length));await saveSetting(ctx.env,'qr_url','/api/media/'+key)}
  return json({item:await loadPaymentSettings(ctx.env)});
}
