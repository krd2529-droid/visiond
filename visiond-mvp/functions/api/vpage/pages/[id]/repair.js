import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {reconcileVpageProvisioning} from '../index.js';

const headers={'cache-control':'private, no-store'};

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const id=String(ctx.params?.id||'');if(!/^vpl_[a-f0-9]{32}$/.test(id))return json({error:'รหัสเซลเพจไม่ถูกต้อง',code:'VPAGE_PAGE_INVALID'},400,headers);
  let raw='';try{raw=await ctx.request.text()}catch{return json({error:'อ่านข้อมูลไม่สำเร็จ',code:'VPAGE_REPAIR_BODY_FORBIDDEN'},400,headers)}
  if(raw)return json({error:'การตรวจสอบซ้ำใช้ข้อมูลเดิมบนเซิร์ฟเวอร์เท่านั้น',code:'VPAGE_REPAIR_BODY_FORBIDDEN'},400,headers);
  const local=await ctx.env.DB.prepare('SELECT * FROM vpage_pages WHERE id=? AND user_id=?').bind(id,auth.user.id).first();if(!local)return json({error:'ไม่พบเซลเพจ',code:'VPAGE_PAGE_NOT_FOUND'},404,headers);
  return reconcileVpageProvisioning(ctx,auth.user.id,local,{successStatus:200});
}
