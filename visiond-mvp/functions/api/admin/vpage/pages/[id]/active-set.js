import {json,requireBoss} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {markVpageMediaActiveSetPending,restoreVpageMediaActiveSet,syncVpageMediaActiveSet} from '../../../../../_vpage-media.js';
import {switchRemoteVpageSet,validVpageIdempotencyKey,VpageRemoteError} from '../../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;const id=String(ctx.params?.id||''),key=String(ctx.request.headers.get('idempotency-key')||'').trim(),body=await ctx.request.json().catch(()=>({})),setNo=Number(body.active_set);if(!/^vpl_[a-f0-9]{32}$/.test(id)||![1,2].includes(setNo)||!validVpageIdempotencyKey(key))return json({error:'คำขอสลับชุดไม่ถูกต้อง'},400,headers);
  const local=await ctx.env.DB.prepare("SELECT id,user_id,vpage_id FROM vpage_pages WHERE id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(id).first();if(!local?.vpage_id)return json({error:'ไม่พบเซลเพจ'},404,headers);
  try{await markVpageMediaActiveSetPending(ctx.env,{pageId:local.id,ownerId:local.user_id});const remote=await switchRemoteVpageSet(ctx.env,{userId:auth.user.id,pageId:local.vpage_id,setNo,key,boss:true});try{await syncVpageMediaActiveSet(ctx.env,{pageId:local.id,vpageId:local.vpage_id,ownerId:local.user_id,activeSet:Number(remote?.item?.active_set)||setNo})}catch{return json({error:'สลับชุดแล้ว แต่ยังยืนยันรูปไม่เสร็จ กรุณากดซ้ำ',code:'VPAGE_MEDIA_ACTIVE_SET_UNCERTAIN',retryable:true},202,headers)}return json(remote,200,headers)}catch(error){if(!error?.ambiguous)await restoreVpageMediaActiveSet(ctx.env,{pageId:local.id,ownerId:local.user_id}).catch(()=>{});const known=error instanceof VpageRemoteError;return json({error:known?error.message:'สลับชุดเนื้อหาไม่สำเร็จ',code:known?error.code:'VPAGE_SWITCH_FAILED'},known?error.status:502,headers)}
}
