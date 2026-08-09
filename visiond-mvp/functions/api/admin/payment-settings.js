import {json,requireAdmin} from '../../_lib.js';
import {ensureSettings,loadPaymentSettings} from '../../_payment.js';

const QR_TYPES=new Map([
  ['image/jpeg','jpg'],
  ['image/png','png'],
  ['image/webp','webp']
]);
const QR_MAX_BYTES=5*1024*1024;

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  return json({item:await loadPaymentSettings(ctx.env)},200,{'cache-control':'no-store'});
}

export async function onRequestPut(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData(),old=await loadPaymentSettings(ctx.env);

  // Validate the complete request before writing either D1 or R2.
  const requestedActive=String(form.get('active_account')||old.active_account);
  if(!['personal','company'].includes(requestedActive))return json({error:'บัญชีรับโอนไม่ถูกต้อง'},400);
  const active=auth.user.role==='boss'?requestedActive:old.active_account;
  const text=(name,max)=>String(form.get(name)||'').trim().slice(0,max);
  const profiles={
    personal:{bank_name:text('personal_bank_name',100),account_name:text('personal_account_name',150),account_number:text('personal_account_number',50)},
    company:{bank_name:text('company_bank_name',100),account_name:text('company_account_name',150),account_number:text('company_account_number',50)}
  };
  const invalidProfile=Object.values(profiles).some(profile=>!profile.bank_name||!profile.account_name||!profile.account_number);
  if(invalidProfile)return json({error:'กรุณากรอกข้อมูลบัญชีส่วนตัวและบัญชีบริษัทให้ครบก่อนบันทึก'},400);
  const accepting=String(form.get('accepting_orders')??'0');
  if(!['0','1'].includes(accepting))return json({error:'สถานะรับคำสั่งซื้อไม่ถูกต้อง'},400);
  const requestedAutoVerify=String(form.get('vision3_auto_verify')??(old.vision3_auto_verify?'1':'0'));
  if(!['0','1'].includes(requestedAutoVerify))return json({error:'สถานะตรวจสลิปอัตโนมัติไม่ถูกต้อง'},400);
  const rawMessage=String(form.get('payment_message')||'').trim();
  if(rawMessage.length>500)return json({error:'ข้อความหลังส่งสลิปต้องไม่เกิน 500 ตัวอักษร'},400);

  const qr=form.get('qr'),qrProvided=qr!==null&&qr!=='';
  if(qrProvided&&(!qr||typeof qr!=='object'||!Number.isFinite(Number(qr.size))||Number(qr.size)<0))return json({error:'QR ต้องเป็นรูป JPG, PNG หรือ WEBP'},400);
  const hasQr=qrProvided&&Number(qr.size)>0;
  if(hasQr&&(!qr||typeof qr.arrayBuffer!=='function'||!QR_TYPES.has(qr.type)))return json({error:'QR ต้องเป็นรูป JPG, PNG หรือ WEBP'},400);
  if(hasQr&&(!Number.isFinite(Number(qr.size))||Number(qr.size)>QR_MAX_BYTES))return json({error:'รูป QR ต้องมีขนาดไม่เกิน 5 MB'},400);

  const values={
    active_payment_account:active,
    personal_bank_name:profiles.personal.bank_name,
    personal_account_name:profiles.personal.account_name,
    personal_account_number:profiles.personal.account_number,
    company_bank_name:profiles.company.bank_name,
    company_account_name:profiles.company.account_name,
    company_account_number:profiles.company.account_number,
    accepting_orders:accepting,
    vision3_auto_verify:auth.user.role==='boss'?requestedAutoVerify:(old.vision3_auto_verify?'1':'0'),
    payment_message:rawMessage
  };

  let newQrKey='';
  if(hasQr){
    newQrKey=`payment-qr-${crypto.randomUUID()}.${QR_TYPES.get(qr.type)}`;
    try{
      await ctx.env.FILES.put(newQrKey,await qr.arrayBuffer(),{httpMetadata:{contentType:qr.type}});
    }catch{
      return json({error:'อัปโหลดรูป QR ไม่สำเร็จ กรุณาลองใหม่'},500);
    }
    values.qr_url='/api/media/'+newQrKey;
  }

  try{
    await ensureSettings(ctx.env);
    const statements=Object.entries(values).map(([key,value])=>ctx.env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,String(value??'')));
    await ctx.env.DB.batch(statements);
  }catch{
    if(newQrKey)await ctx.env.FILES.delete(newQrKey).catch(()=>{});
    return json({error:'บันทึกการตั้งค่าชำระเงินไม่สำเร็จ กรุณาลองใหม่'},500);
  }

  // The committed setting already points at the new object. Old media cleanup is
  // deliberately best effort and can no longer leave the database without a QR.
  if(newQrKey&&old.qr_url?.startsWith('/api/media/payment-qr-')){
    const oldQrKey=old.qr_url.slice('/api/media/'.length);
    if(oldQrKey!==newQrKey)await ctx.env.FILES.delete(oldQrKey).catch(()=>{});
  }
  return json({item:await loadPaymentSettings(ctx.env)});
}
