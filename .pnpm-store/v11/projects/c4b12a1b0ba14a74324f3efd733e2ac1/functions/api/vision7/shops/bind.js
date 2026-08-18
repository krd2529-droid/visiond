import {json} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {hashLicenseKey,licenseEvent,refreshLicenseExpiry} from '../../../_vision7.js';
import {requireVision7User} from '../../../_vision7_auth.js';
import {cleanMetaPageId,cleanPageName,cleanShopName,ensureVEasyShopSchema,ownedShopByLicense,ownedVEasyLicense} from '../../../_veasy_shop.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),shopName=cleanShopName(body.shop_name),pageId=cleanMetaPageId(body.meta_page_id),pageName=cleanPageName(body.meta_page_name);
  if(!body.key||shopName.length<2||!pageId)return json({error:'กรุณากรอกคีย์ ชื่อร้าน และ Facebook Page ID ให้ถูกต้อง',code:'VEASY_BIND_INPUT_INVALID'},400);
  let license=await ownedVEasyLicense(ctx.env,auth.user.id,await hashLicenseKey(body.key));
  if(!license)return json({error:'ไม่พบคีย์ V Easy ในบัญชีนี้',code:'VEASY_LICENSE_NOT_OWNED'},404);
  license=await refreshLicenseExpiry(ctx.env,license);
  if(!['active','trial'].includes(license.status)||!license.program_active)return json({error:'คีย์ V Easy นี้ไม่พร้อมใช้งาน',code:'VEASY_LICENSE_INACTIVE'},403);
  const existing=await ownedShopByLicense(ctx.env,auth.user.id,license.id);
  if(existing){
    if(existing.meta_page_id===pageId)return json({ok:true,already_bound:true,shop:existing},200,{'cache-control':'no-store'});
    return json({error:'คีย์นี้ผูกกับร้านอื่นแล้ว ไม่สามารถนำไปผูกร้านที่สองได้',code:'VEASY_KEY_ALREADY_BOUND',shop_id:existing.id},409);
  }
  if(license.binding_state!=='unbound')return json({error:'สถานะคีย์ไม่อนุญาตให้สร้างร้านใหม่ กรุณาติดต่อ VisionD',code:'VEASY_BINDING_STATE_CONFLICT'},409);
  const pageOwner=await ctx.env.DB.prepare('SELECT id,user_id,license_id FROM veasy_shops WHERE meta_page_id=?').bind(pageId).first();
  if(pageOwner)return json({error:'Facebook Page นี้ถูกผูกกับร้านอื่นแล้ว',code:'VEASY_PAGE_ALREADY_BOUND'},409);
  const id=crypto.randomUUID();
  try{
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(`INSERT INTO veasy_shops(id,user_id,license_id,name,meta_page_id,meta_page_name) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM veasy_shops WHERE license_id=? OR meta_page_id=?)`).bind(id,auth.user.id,license.id,shopName,pageId,pageName,license.id,pageId),
      ctx.env.DB.prepare("UPDATE vision7_licenses SET binding_state='bound',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND binding_state='unbound'").bind(license.id,auth.user.id)
    ]);
  }catch{return json({error:'คีย์หรือ Facebook Page ถูกผูกกับร้านอื่นแล้ว',code:'VEASY_BIND_CONFLICT'},409)}
  const shop=await ownedShopByLicense(ctx.env,auth.user.id,license.id);
  if(!shop)return json({error:'ผูกร้านไม่สำเร็จ กรุณาลองใหม่',code:'VEASY_BIND_NOT_COMMITTED'},409);
  await licenseEvent(ctx.env,license.id,auth.user.id,'veasy_shop_bound',{shop_id:shop.id,meta_page_id:pageId});
  return json({ok:true,already_bound:false,shop},201,{'cache-control':'no-store'});
}
