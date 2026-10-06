import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {checkVpageAvailability,validVpageSlug,VpageRemoteError} from '../../_vpage-provisioning.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),domainId=String(url.searchParams.get('domain_id')||''),slug=String(url.searchParams.get('slug')||'');
  if(!domainId||domainId.length>64||!validVpageSlug(slug))return json({error:'โดเมนหรือ slug ไม่ถูกต้อง',code:'VPAGE_INPUT_INVALID'},400,{'cache-control':'private, no-store'});
  try{return json(await checkVpageAvailability(ctx.env,domainId,slug),200,{'cache-control':'private, no-store'})}
  catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'ตรวจสอบ slug ไม่สำเร็จ',code:known?error.code:'VPAGE_AVAILABILITY_FAILED'},known?error.status:502,{'cache-control':'private, no-store'})}
}
