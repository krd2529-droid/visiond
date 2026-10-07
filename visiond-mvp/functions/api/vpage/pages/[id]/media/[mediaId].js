import {json,requireUser} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {privateMediaHeaders,validVpageMediaId} from '../../../../../_vpage-media.js';

export async function onRequestDelete(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const pageId=String(ctx.params?.id||''),mediaId=String(ctx.params?.mediaId||'');if(!/^vpl_[a-f0-9]{32}$/.test(pageId)||!validVpageMediaId(mediaId))return json({error:'ไม่พบรูป'},404,privateMediaHeaders);
  const row=await ctx.env.DB.prepare("SELECT m.id,m.object_key,m.state FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id WHERE m.id=? AND m.page_id=? AND m.owner_id=? AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").bind(mediaId,pageId,auth.user.id).first();if(!row)return json({error:'ไม่พบรูป'},404,privateMediaHeaders);
  if(row.state==='deleted')return json({ok:true,id:mediaId,replayed:true},200,privateMediaHeaders);
  if(!ctx.env.FILES)return json({error:'คลังรูปยังไม่พร้อม',code:'VPAGE_MEDIA_STORAGE_NOT_CONFIGURED'},503,privateMediaHeaders);
  const used=await ctx.env.DB.prepare("SELECT 1 used FROM vpage_media_refs WHERE media_id=? LIMIT 1").bind(mediaId).first()||await ctx.env.DB.prepare("SELECT 1 used FROM vpage_media_pending_refs WHERE media_id=? LIMIT 1").bind(mediaId).first();if(used)return json({error:'รูปนี้ยังถูกใช้ในเซลเพจ',code:'VPAGE_MEDIA_IN_USE'},409,privateMediaHeaders);
  const changed=await ctx.env.DB.prepare("UPDATE vpage_media SET state='deleting',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state IN ('pending','ready')").bind(mediaId,auth.user.id).run();if(!Number(changed.meta?.changes)&&row.state!=='deleting')return json({error:'ลบรูปไม่ได้'},409,privateMediaHeaders);
  try{await ctx.env.FILES.delete(row.object_key);await ctx.env.DB.batch([ctx.env.DB.prepare("UPDATE vpage_media SET state='deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='deleting'").bind(mediaId),ctx.env.DB.prepare("DELETE FROM vpage_media WHERE id IN (SELECT id FROM vpage_media WHERE owner_id=? AND page_id=? AND state='deleted' ORDER BY updated_at DESC,id DESC LIMIT 8 OFFSET 24)").bind(auth.user.id,pageId)]);return json({ok:true,id:mediaId,replayed:false},200,privateMediaHeaders)}catch{await ctx.env.DB.prepare("UPDATE vpage_media SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='deleting'").bind(mediaId).run();return json({error:'ลบรูปจากคลังไม่สำเร็จ',code:'VPAGE_MEDIA_DELETE_FAILED'},502,privateMediaHeaders)}
}
