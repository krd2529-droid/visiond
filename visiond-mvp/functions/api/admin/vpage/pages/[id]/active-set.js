import {json,requireBoss} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {switchRemoteVpageSet,validVpageIdempotencyKey,VpageRemoteError} from '../../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;const id=String(ctx.params?.id||''),key=String(ctx.request.headers.get('idempotency-key')||'').trim(),body=await ctx.request.json().catch(()=>({})),setNo=Number(body.active_set);if(!/^vpl_[a-f0-9]{32}$/.test(id)||![1,2].includes(setNo)||!validVpageIdempotencyKey(key))return json({error:'คำขอสลับชุดไม่ถูกต้อง'},400,headers);
  const local=await ctx.env.DB.prepare("SELECT vpage_id FROM vpage_pages WHERE id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(id).first();if(!local?.vpage_id)return json({error:'ไม่พบเซลเพจ'},404,headers);
  try{return json(await switchRemoteVpageSet(ctx.env,{userId:auth.user.id,pageId:local.vpage_id,setNo,key,boss:true}),200,headers)}catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'สลับชุดเนื้อหาไม่สำเร็จ',code:known?error.code:'VPAGE_SWITCH_FAILED'},known?error.status:502,headers)}
}
