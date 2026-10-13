import {json,requireAdmin} from '../../../../_lib.js';
import {stockStore} from '../../../../_stock.js';
import {draftData,saveDraft} from '../../../../_toys_center_drafts.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const store=stockStore(ctx.request.url);if(!store)return json({error:'ร้านไม่ถูกต้อง'},400,headers);
  const url=new URL(ctx.request.url),raw=url.searchParams.get('cursor');let cursor=null;
  if(raw){try{cursor=JSON.parse(atob(raw));if(typeof cursor[0]!=='string'||!Number.isSafeInteger(cursor[1])||cursor[1]<1)throw Error()}catch{return json({error:'cursor ไม่ถูกต้อง'},400,headers)}}
  const rows=(await ctx.env.DB.prepare(`SELECT * FROM toys_center_form_drafts WHERE store_id=?${cursor?' AND (updated_at<? OR (updated_at=? AND id<?))':''} ORDER BY updated_at DESC,id DESC LIMIT 25`).bind(store.id,...(cursor?[cursor[0],cursor[0],cursor[1]]:[])).all()).results||[];
  const last=rows[23];return json({items:rows.slice(0,24).map(draftData),next_cursor:rows.length>24?btoa(JSON.stringify([last.updated_at,last.id])):null},200,headers);
}
export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData(),store=stockStore(ctx.request.url,{defaultStore:String(form.get('store_id')||'toys-center')});
  if(!store||String(form.get('store_id')||store.id)!==store.id)return json({error:'ร้านไม่ถูกต้อง'},400,headers);
  try{const id=await saveDraft(ctx,form,store,auth.user);return json({ok:true,id,message:'บันทึกร่างแล้ว กลับมาแก้ไขได้จากรายการร่าง'},201,headers)}catch(error){return json({error:String(error.message||error)},400,headers)}
}
