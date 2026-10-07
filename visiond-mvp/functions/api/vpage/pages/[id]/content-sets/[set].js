import {json,requireUser} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {commitVpageMediaSave,failVpageMediaSave,prepareVpageMediaSave,VpageMediaError} from '../../../../../_vpage-media.js';
import {saveRemoteVpageContent,validVpageIdempotencyKey,VpageRemoteError} from '../../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestPut(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const id=String(ctx.params?.id||''),setNo=Number(ctx.params?.set),key=String(ctx.request.headers.get('idempotency-key')||'').trim();if(!/^vpl_[a-f0-9]{32}$/.test(id)||![1,2].includes(setNo)||!validVpageIdempotencyKey(key))return json({error:'คำขอบันทึกไม่ถูกต้อง'},400,headers);
  const local=await ctx.env.DB.prepare("SELECT id,user_id,vpage_id FROM vpage_pages WHERE id=? AND user_id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(id,auth.user.id).first();if(!local?.vpage_id)return json({error:'ไม่พบเซลเพจ'},404,headers);
  let raw='';try{raw=await ctx.request.text()}catch{return json({error:'อ่านข้อมูลไม่สำเร็จ'},400,headers)}if(new TextEncoder().encode(raw).byteLength>131072)return json({error:'ข้อมูลยาวเกินกำหนด'},413,headers);
  let body;try{body=JSON.parse(raw||'{}')}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400,headers)}
  const payload={product_image_url:body.product_image_url,detail_text:body.detail_text,text_size:body.text_size,text_style:body.text_style,youtube_url:body.youtube_url||'',product_items:body.product_items,contact_items:body.contact_items,background_image_url:body.background_image_url,expected_revision:body.expected_revision};
  let operation;try{operation=await prepareVpageMediaSave(ctx.env,{request:ctx.request,ownerId:auth.user.id,pageId:local.id,vpageId:local.vpage_id,setNo,key,payload})}catch(error){const known=error instanceof VpageMediaError;return json({error:known?error.message:'ตรวจสอบรูปไม่สำเร็จ',code:known?error.code:'VPAGE_MEDIA_REFERENCE_FAILED'},known?error.status:500,headers)}
  let remote;try{remote=await saveRemoteVpageContent(ctx.env,{userId:auth.user.id,pageId:local.vpage_id,setNo,key,payload})}catch(error){if(!error?.ambiguous)await failVpageMediaSave(ctx.env,operation.id).catch(()=>{});const known=error instanceof VpageRemoteError;return json({error:known?error.message:'บันทึกชุดเนื้อหาไม่สำเร็จ',code:known?error.code:'VPAGE_EDITOR_SAVE_FAILED'},known?error.status:502,headers)}
  try{await commitVpageMediaSave(ctx.env,operation.id)}catch{return json({error:'บันทึกเนื้อหาแล้ว แต่ยังยืนยันรูปไม่เสร็จ กรุณากดบันทึกซ้ำ',code:'VPAGE_MEDIA_REFERENCE_UNCERTAIN',retryable:true},202,headers)}return json(remote,200,headers);
}
