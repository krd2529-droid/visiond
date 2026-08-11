import {json,sha256} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {rateLimit,rateLimitIdentity,securityLog,verifyPassword} from '../../../_security.js';
import {ensureVision7AuthSchema,issueVision7AppSession} from '../../../_vision7_auth.js';
import {ensureVision7Schema} from '../../../_vision7_schema.js';
import {hashLicenseKey,licenseEvent,maskedLicense,refreshLicenseExpiry,safeDeviceName,safeVersion} from '../../../_vision7.js';
import {cleanShopName,ensureVEasyShopSchema,ownedShopByLicense} from '../../../_veasy_shop.js';

const noStore={'cache-control':'no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);await ensureVision7AuthSchema(ctx.env);await ensureVEasyShopSchema(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),login=String(body.login||'').trim().toLowerCase(),password=String(body.password||''),keyValue=String(body.key||'').trim(),deviceId=String(body.device_id||'').trim(),shopName=cleanShopName(body.shop_name);
  if(!login||!password||!keyValue||deviceId.length<8||login.length>254||password.length>1024||keyValue.length>200||deviceId.length>200)return json({error:'ข้อมูลเปิดใช้งานไม่ครบหรือยาวเกินกำหนด',code:'VEASY_ACTIVATION_INPUT_INVALID'},400,noStore);
  const limitedResponse=(result,code)=>result.error?json({error:'คำขอเปิดใช้งานมากเกินไป กรุณาลองใหม่ภายหลัง',code},429,{...noStore,'retry-after':result.error.headers.get('retry-after')||'1800'}):null;
  const ipLimited=await rateLimit(ctx.env,ctx.request,'veasy_activate_ip',20,15,30),ipError=limitedResponse(ipLimited,'VEASY_RATE_LIMIT_IP');if(ipError)return ipError;
  const identityLimited=await rateLimitIdentity(ctx.env,ctx.request,'veasy_activate_name',login,8,15,30),identityError=limitedResponse(identityLimited,'VEASY_RATE_LIMIT_LOGIN');if(identityError)return identityError;
  const keyLimited=await rateLimitIdentity(ctx.env,ctx.request,'veasy_activate_key',keyValue,8,15,30),keyError=limitedResponse(keyLimited,'VEASY_RATE_LIMIT_KEY');if(keyError)return keyError;
  const user=await ctx.env.DB.prepare('SELECT id,email,username,name,password_hash FROM users WHERE lower(email)=? OR lower(username)=? ORDER BY CASE WHEN lower(username)=? THEN 0 ELSE 1 END,id LIMIT 1').bind(login,login,login).first();
  if(!user||!await verifyPassword(password,user.password_hash)){await securityLog(ctx.env,ctx.request,'veasy_activation_failed','warning','invalid credentials',user?.id||null);return json({error:'ID หรือรหัสผ่านไม่ถูกต้อง',code:'VEASY_LOGIN_FAILED'},401,noStore)}
  let license=await ctx.env.DB.prepare(`SELECT l.*,p.active program_active,p.platform_type,p.current_version,p.minimum_version,p.force_update FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id WHERE l.key_hash=? AND p.platform_type='veasy'`).bind(await hashLicenseKey(keyValue)).first();
  if(!license){await securityLog(ctx.env,ctx.request,'veasy_activation_failed','warning','unknown or non-V Easy key',user.id);return json({error:'ไม่พบ V Easy Key นี้',code:'VEASY_KEY_NOT_FOUND'},404,noStore)}
  license=await refreshLicenseExpiry(ctx.env,license);if(!['active','trial'].includes(license.status)||!license.program_active)return json({error:'คีย์ V Easy นี้ไม่พร้อมใช้งาน',code:'VEASY_KEY_INACTIVE',status:license.status},403,noStore);
  if(license.binding_state==='bound'&&Number(license.user_id)!==Number(user.id)){await securityLog(ctx.env,ctx.request,'veasy_activation_failed','warning','bound key used by another account',user.id);return json({error:'คีย์นี้ผูกกับบัญชีอื่นแล้ว กรุณาติดต่อ Boss เพื่อรีคีย์',code:'VEASY_KEY_BOUND_TO_OTHER_ACCOUNT'},403,noStore)}
  const deviceHash=await sha256(deviceId),knownDevice=await ctx.env.DB.prepare('SELECT id,revoked_at FROM vision7_license_devices WHERE license_id=? AND device_hash=?').bind(license.id,deviceHash).first(),activeDevices=await ctx.env.DB.prepare('SELECT COUNT(*) total FROM vision7_license_devices WHERE license_id=? AND revoked_at IS NULL').bind(license.id).first();
  if(!knownDevice&&Number(activeDevices?.total)>=Number(license.max_devices||3))return json({error:`ครบ ${license.max_devices||3} เครื่องแล้ว กรุณาปิดเครื่องเก่าก่อน`,code:'VEASY_DEVICE_LIMIT'},409,noStore);
  let shop=await ownedShopByLicense(ctx.env,user.id,license.id);const alreadyBound=Boolean(shop);
  if(!shop){
    if(shopName.length<2)return json({error:'กรุณากรอกชื่อร้านอย่างน้อย 2 ตัวอักษร',code:'VEASY_SHOP_NAME_REQUIRED'},400,noStore);
    if(license.binding_state!=='unbound')return json({error:'สถานะคีย์ไม่อนุญาตให้ผูกร้านใหม่ กรุณาติดต่อ Boss เพื่อรีคีย์',code:'VEASY_BINDING_STATE_CONFLICT'},409,noStore);
    const previousOwnerId=license.user_id,name=shopName,shopId=crypto.randomUUID(),internalPageId=`VEASY-${license.id}`;
    try{await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE vision7_licenses SET user_id=?,binding_state='bound',updated_at=CURRENT_TIMESTAMP WHERE id=? AND binding_state='unbound' AND NOT EXISTS(SELECT 1 FROM veasy_shops WHERE license_id=?)`).bind(user.id,license.id,license.id),
      ctx.env.DB.prepare(`INSERT INTO veasy_shops(id,user_id,license_id,name,meta_page_id,meta_page_name) SELECT ?,?,?,?,?,'' FROM vision7_licenses WHERE id=? AND user_id=? AND binding_state='bound' AND NOT EXISTS(SELECT 1 FROM veasy_shops WHERE license_id=?)`).bind(shopId,user.id,license.id,name,internalPageId,license.id,user.id,license.id),
      ctx.env.DB.prepare(`INSERT INTO vision7_license_events(license_id,actor_user_id,event_type,detail) SELECT ?,?,'veasy_key_claimed_in_app',? WHERE EXISTS(SELECT 1 FROM veasy_shops WHERE id=? AND license_id=? AND user_id=?)`).bind(license.id,user.id,JSON.stringify({previous_owner_id:previousOwnerId,shop_id:shopId}),shopId,license.id,user.id)
    ])}catch{return json({error:'คีย์นี้กำลังถูกผูกกับบัญชีหรือร้านอื่น กรุณาติดต่อ Boss เพื่อรีคีย์',code:'VEASY_BIND_CONFLICT'},409,noStore)}
    shop=await ownedShopByLicense(ctx.env,user.id,license.id);
    if(!shop){const current=await ctx.env.DB.prepare('SELECT user_id,binding_state FROM vision7_licenses WHERE id=?').bind(license.id).first();if(current&&Number(current.user_id)!==Number(user.id))return json({error:'คีย์นี้ผูกกับบัญชีอื่นแล้ว กรุณาติดต่อ Boss เพื่อรีคีย์',code:'VEASY_KEY_BOUND_TO_OTHER_ACCOUNT'},403,noStore);return json({error:'สร้างร้านจากคีย์ไม่สำเร็จ',code:'VEASY_BIND_NOT_COMMITTED'},409,noStore)}
    license.user_id=user.id;license.binding_state='bound';
    await licenseEvent(ctx.env,license.id,user.id,'veasy_shop_bound_in_app',{shop_id:shop.id});
  }
  const saved=await ctx.env.DB.prepare(`INSERT INTO vision7_license_devices(license_id,device_hash,device_name,platform,app_version) SELECT ?,?,?, 'android',? WHERE EXISTS(SELECT 1 FROM vision7_license_devices WHERE license_id=? AND device_hash=? AND revoked_at IS NULL) OR (SELECT COUNT(*) FROM vision7_license_devices WHERE license_id=? AND revoked_at IS NULL)<? ON CONFLICT(license_id,device_hash) DO UPDATE SET device_name=excluded.device_name,platform='android',app_version=excluded.app_version,last_seen_at=CURRENT_TIMESTAMP,revoked_at=NULL`).bind(license.id,deviceHash,safeDeviceName(body.device_name||'V Easy Android'),safeVersion(body.app_version||'1.0.8'),license.id,deviceHash,license.id,Number(license.max_devices||3)).run();
  if(!saved.meta?.changes)return json({error:`ครบ ${license.max_devices||3} เครื่องแล้ว กรุณาปิดเครื่องเก่าก่อน`,code:'VEASY_DEVICE_LIMIT'},409,noStore);
  const session=await issueVision7AppSession(ctx.env,user.id,{deviceId,deviceName:body.device_name||'V Easy Android',appVersion:body.app_version||'1.0.8'}),accountScope=await sha256(`veasy-account-scope-v1:${user.id}`);
  const wasActive=Boolean(knownDevice&&!knownDevice.revoked_at);await licenseEvent(ctx.env,license.id,user.id,wasActive?'checked_in_app':knownDevice?'reactivated_in_app':'activated_in_app',{shop_id:shop.id,app_version:safeVersion(body.app_version||'1.0.8')});await securityLog(ctx.env,ctx.request,'veasy_activation_success','info','generic APK activated',user.id);
  return json({ok:true,idempotent:wasActive,already_bound:alreadyBound,access_token:session.token,expires_in:session.expires_in,device_id:deviceId,account_scope_id:accountScope,user:{id:user.id,username:user.username,name:user.name,email:user.email},license:{id:license.id,key_masked:maskedLicense(license),status:license.status,expires_at:license.expires_at,max_devices:license.max_devices,active_devices:Number(activeDevices?.total||0)+(wasActive?0:1)},shop:{id:shop.id,name:shop.name,status:shop.status}},200,noStore);
}
