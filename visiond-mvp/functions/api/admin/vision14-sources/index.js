import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {V14_RIGHTS,V14_RIGHT_LABELS,canSellWithRights,ensureVision14Schema} from '../../../_vision14.js';

const headers={'cache-control':'private, no-store'};
const clean=(value,max=180)=>String(value||'').trim().slice(0,max);

async function authorize(ctx){
  await ensureDatabase(ctx.env);
  await ensureVision14Schema(ctx.env);
  return requireBoss(ctx);
}

export async function onRequestGet(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  const items=(await ctx.env.DB.prepare(`SELECT s.id,s.title,s.original_file_name,s.mime_type,s.file_size,s.rights_status,s.rights_note,s.processing_status,s.sale_eligible,s.created_at,s.updated_at,u.name created_by_name FROM vision14_sources s LEFT JOIN users u ON u.id=s.created_by ORDER BY s.created_at DESC LIMIT 200`).all()).results||[];
  return json({items,rights:V14_RIGHTS.map(value=>({value,label:V14_RIGHT_LABELS[value]}))},200,headers);
}

export async function onRequestPost(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อม R2 FILES'},503,headers);
  const form=await ctx.request.formData(),file=form.get('file'),title=clean(form.get('title')),rights=clean(form.get('rights_status'),40),note=clean(form.get('rights_note'),500);
  if(!title)return json({error:'กรุณากรอกชื่อเอกสาร'},400,headers);
  if(!V14_RIGHTS.includes(rights))return json({error:'สถานะสิทธิ์ไม่ถูกต้อง'},400,headers);
  if(!file||typeof file.arrayBuffer!=='function'||!file.size||file.size>100*1024*1024||!(file.type==='application/pdf'||String(file.name||'').toLowerCase().endsWith('.pdf')))return json({error:'รับเฉพาะ PDF ขนาดไม่เกิน 100 MB'},400,headers);
  if(rights==='licensed'&&!note)return json({error:'สิทธิ์แบบได้รับอนุญาตต้องมีหมายเหตุหรือหลักฐานอ้างอิง'},400,headers);
  const id=`v14_${crypto.randomUUID().replaceAll('-','')}`,key=`vision14/source/${id}.pdf`,eligible=canSellWithRights(rights)?1:0;
  await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:'application/pdf'},customMetadata:{sourceId:id}});
  try{
    await ctx.env.DB.prepare(`INSERT INTO vision14_sources(id,title,original_file_name,object_key,mime_type,file_size,rights_status,rights_note,sale_eligible,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,title,clean(file.name,240),key,'application/pdf',file.size,rights,note,eligible,auth.user.id).run();
  }catch(error){await ctx.env.FILES.delete(key);throw error}
  return json({ok:true,id,sale_eligible:Boolean(eligible),message:eligible?'รับเข้าคลังแล้ว · สิทธิ์ผ่านด่านขายเบื้องต้น':'รับเข้าคลังอ้างอิงแล้ว · ห้ามส่งไปขาย'},201,headers);
}
