import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {listVpageDomains,VpageRemoteError} from '../../_vpage-provisioning.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  try{return json({items:await listVpageDomains(ctx.env)},200,{'cache-control':'private, no-store'})}
  catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'โหลดโดเมนไม่สำเร็จ',code:known?error.code:'VPAGE_DOMAIN_LOAD_FAILED'},known?error.status:502,{'cache-control':'private, no-store'})}
}
