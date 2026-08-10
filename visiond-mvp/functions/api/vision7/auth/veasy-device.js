import {json,sha256} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {requireVision7User,revokeVision7Session} from '../../../_vision7_auth.js';
import {ensureVision7Schema} from '../../../_vision7_schema.js';
import {licenseEvent} from '../../../_vision7.js';

export async function onRequestDelete(ctx){
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const deviceId=String(ctx.request.headers.get('x-vision7-device-id')||'').trim();if(deviceId.length<8)return json({error:'ไม่พบรหัสเครื่อง',code:'VEASY_DEVICE_ID_REQUIRED'},400);
  const deviceHash=await sha256(deviceId),rows=await ctx.env.DB.prepare(`SELECT d.id,d.license_id FROM vision7_license_devices d JOIN vision7_licenses l ON l.id=d.license_id JOIN vision7_programs p ON p.id=l.program_id WHERE l.user_id=? AND p.platform_type='veasy' AND d.device_hash=? AND d.revoked_at IS NULL`).bind(auth.user.id,deviceHash).all();
  for(const row of rows.results||[]){await ctx.env.DB.prepare('UPDATE vision7_license_devices SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').bind(row.id).run();await licenseEvent(ctx.env,row.license_id,auth.user.id,'device_revoked_in_app',{device_record_id:row.id})}
  await revokeVision7Session(ctx);return json({ok:true,revoked:(rows.results||[]).length},200,{'cache-control':'no-store'});
}
