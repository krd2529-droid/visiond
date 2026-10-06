import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {readRemoteVpageEditor,VpageRemoteError} from '../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const id=String(ctx.params?.id||'');if(!/^vpl_[a-f0-9]{32}$/.test(id))return json({error:'รหัสเซลเพจไม่ถูกต้อง'},400,headers);
  const local=await ctx.env.DB.prepare("SELECT id,vpage_id,display_name,slug,public_url FROM vpage_pages WHERE id=? AND user_id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(id,auth.user.id).first();if(!local?.vpage_id)return json({error:'ไม่พบเซลเพจ'},404,headers);
  try{const remote=await readRemoteVpageEditor(ctx.env,{userId:auth.user.id,pageId:local.vpage_id});return json({item:{...remote.item,local_id:local.id,display_name:local.display_name,slug:local.slug,public_url:local.public_url}},200,headers)}catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'โหลดตัวแก้ไขไม่สำเร็จ',code:known?error.code:'VPAGE_EDITOR_LOAD_FAILED'},known?error.status:502,headers)}
}
