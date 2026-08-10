import {issueLicense,licenseEvent} from './_vision7.js';
import {ensureVision7KeyCenterSchema,bindingStateForProgram} from './_vision7_key_center.js';

const sqlDate=date=>date.toISOString().replace('T',' ').slice(0,19);
const addDays=(value,days)=>{const base=value&&Date.parse(String(value).replace(' ','T')+'Z')>Date.now()?new Date(String(value).replace(' ','T')+'Z'):new Date();base.setUTCDate(base.getUTCDate()+Number(days));return sqlDate(base)};

export async function fulfillVision7Order(env,order,actor={}){
  await ensureVision7KeyCenterSchema(env);
  const items=(await env.DB.prepare(`SELECT oi.id order_item_id,oi.vision7_renew_license_id,q.id plan_id,q.program_id,q.plan_code,q.duration_days,p.max_devices,p.platform_type FROM order_items oi JOIN vision7_plans q ON q.product_id=oi.product_id JOIN vision7_programs p ON p.id=q.program_id WHERE oi.order_id=? ORDER BY oi.id`).bind(order.id).all()).results||[];
  const output=[];
  for(const item of items){
    const done=await env.DB.prepare('SELECT license_id,action FROM vision7_order_fulfillments WHERE order_item_id=?').bind(item.order_item_id).first();
    if(done){output.push({...done,existing:true});continue}
    if(item.vision7_renew_license_id){
      const license=await env.DB.prepare(`SELECT id,user_id,program_id,plan_id,status,expires_at FROM vision7_licenses WHERE id=? AND user_id=? AND program_id=? AND plan_id=?`).bind(item.vision7_renew_license_id,order.user_id,item.program_id,item.plan_id).first();
      if(!license)throw new Error('VISION7_RENEW_LICENSE_INVALID');
      const days=Number(item.duration_days);if(!days)throw new Error('VISION7_LIFETIME_RENEW_NOT_REQUIRED');
      const expiresAt=addDays(license.expires_at,days);
      const claimed=await env.DB.prepare(`INSERT INTO vision7_order_fulfillments(order_item_id,order_id,license_id,action) SELECT ?,?,?,'renewed' WHERE NOT EXISTS(SELECT 1 FROM vision7_order_fulfillments WHERE order_item_id=?)`).bind(item.order_item_id,order.id,license.id,item.order_item_id).run();
      if(claimed.meta?.changes){await env.DB.prepare(`UPDATE vision7_licenses SET status='active',expires_at=?,renewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(expiresAt,license.id).run();await licenseEvent(env,license.id,actor.id||null,'renewed',{order_id:order.id,order_item_id:item.order_item_id,duration_days:days,expires_at:expiresAt})}
      output.push({license_id:license.id,action:'renewed',expires_at:expiresAt});continue;
    }
    const expiresAt=item.duration_days?addDays(null,item.duration_days):null;
    const issued=await issueLicense(env,{userId:order.user_id,programId:item.program_id,planId:item.plan_id,orderId:order.id,status:'active',maxDevices:item.max_devices||3,source:'paid_order',createdBy:actor.id||null,expiresAt});
    const bindingState=bindingStateForProgram(item.platform_type);await env.DB.prepare('UPDATE vision7_licenses SET binding_state=? WHERE id=?').bind(bindingState,issued.id).run();
    try{await env.DB.prepare(`INSERT INTO vision7_order_fulfillments(order_item_id,order_id,license_id,action) VALUES(?,?,?,'issued')`).bind(item.order_item_id,order.id,issued.id).run()}catch(error){await env.DB.prepare('DELETE FROM vision7_licenses WHERE id=?').bind(issued.id).run();const winner=await env.DB.prepare('SELECT license_id,action FROM vision7_order_fulfillments WHERE order_item_id=?').bind(item.order_item_id).first();if(winner){output.push({...winner,existing:true});continue}throw error}
    output.push({license_id:issued.id,action:'issued',key:issued.key,expires_at:expiresAt});
  }
  return output;
}
