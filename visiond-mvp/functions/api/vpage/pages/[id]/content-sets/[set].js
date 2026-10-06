import {json,requireUser} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {saveRemoteVpageContent,validVpageIdempotencyKey,VpageRemoteError} from '../../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestPut(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const id=String(ctx.params?.id||''),setNo=Number(ctx.params?.set),key=String(ctx.request.headers.get('idempotency-key')||'').trim();if(!/^vpl_[a-f0-9]{32}$/.test(id)||![1,2].includes(setNo)||!validVpageIdempotencyKey(key))return json({error:'คำขอบันทึกไม่ถูกต้อง'},400,headers);
  const local=await ctx.env.DB.prepare("SELECT vpage_id FROM vpage_pages WHERE id=? AND user_id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(id,auth.user.id).first();if(!local?.vpage_id)return json({error:'ไม่พบเซลเพจ'},404,headers);
  let raw='';try{raw=await ctx.request.text()}catch{return json({error:'อ่านข้อมูลไม่สำเร็จ'},400,headers)}if(new TextEncoder().encode(raw).byteLength>16384)return json({error:'ข้อมูลยาวเกินกำหนด'},413,headers);
  let body;try{body=JSON.parse(raw||'{}')}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400,headers)}
  const payload={product_image_url:body.product_image_url,detail_text:body.detail_text,text_size:body.text_size,text_style:body.text_style,youtube_url:body.youtube_url||'',product_url:body.product_url,contact_url:body.contact_url,background_image_url:body.background_image_url,expected_revision:body.expected_revision};
  try{return json(await saveRemoteVpageContent(ctx.env,{userId:auth.user.id,pageId:local.vpage_id,setNo,key,payload}),200,headers)}catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'บันทึกชุดเนื้อหาไม่สำเร็จ',code:known?error.code:'VPAGE_EDITOR_SAVE_FAILED'},known?error.status:502,headers)}
}
