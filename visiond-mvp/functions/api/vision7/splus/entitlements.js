import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { requireVision7User } from '../../../_vision7_auth.js';
import { decryptVision7Key, vision7LicenseEncryptionConfigured } from '../../../_vision7_license_crypto.js';
import { splusReadySql } from '../../../_splus.js';

export const splusPaidPageSql=`SELECT o.id order_id,oi.id order_item_id,q.plan_code,oi.price,i.machine_id,i.key_ciphertext,i.issued_at
  FROM orders o INDEXED BY idx_orders_user_id CROSS JOIN order_items oi INDEXED BY idx_splus_order_items_order_id_desc
  JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code IN ('accounts30','accounts50','accounts100')
  JOIN vision7_programs p ON p.id=q.program_id AND p.code='splus'
  LEFT JOIN splus_issues i ON i.order_item_id=oi.id
  WHERE o.user_id=? AND o.status='paid' AND oi.order_id=o.id AND
    ((q.plan_code='accounts30' AND oi.price=99000) OR (q.plan_code='accounts50' AND oi.price=149000) OR (q.plan_code='accounts100' AND oi.price=249000))
    AND (? IS NULL OR o.id<? OR (o.id=? AND oi.id<?)) ORDER BY o.id DESC,oi.id DESC LIMIT 25`;
export const splusOwnerPageSql=`SELECT id,machine_id,key_ciphertext FROM splus_owner_grants INDEXED BY idx_splus_owner_recipient
  WHERE recipient_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 25`;

const noStore={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const raw=new URL(ctx.request.url).searchParams.get('cursor');
  const parts=raw&&/^([1-9]\d*):([1-9]\d*)$/.exec(raw);
  const orderId=parts?Number(parts[1]):null,itemId=parts?Number(parts[2]):null;
  if(raw!==null&&(!Number.isSafeInteger(orderId)||!Number.isSafeInteger(itemId)||orderId<=0||itemId<=0))return json({error:'cursor ไม่ถูกต้อง'},400,noStore);
  const ownerRaw=new URL(ctx.request.url).searchParams.get('owner_cursor');
  const ownerCursor=ownerRaw&&/^[1-9]\d*$/.test(ownerRaw)?Number(ownerRaw):null;
  if(ownerRaw!==null&&(!Number.isSafeInteger(ownerCursor)||ownerCursor<=0||raw!==null))return json({error:'cursor ไม่ถูกต้อง'},400,noStore);
  const ownerPage=async()=>{
    const rows=(await ctx.env.DB.prepare(splusOwnerPageSql).bind(auth.user.id,ownerCursor,ownerCursor).all()).results||[];
    const owner=[];for(const row of rows.slice(0,24)){let key=null;if(row.key_ciphertext&&vision7LicenseEncryptionConfigured(ctx.env))try{key=await decryptVision7Key(ctx.env,row.key_ciphertext)}catch{}owner.push({id:row.id,machine_id:row.machine_id,key})}
    return {owner,owner_next_cursor:rows.length>24?rows[23].id:null};
  };
  if(ownerRaw!==null)return json(await ownerPage(),200,noStore);
  const ready=Boolean(await ctx.env.DB.prepare(splusReadySql).first());
  const rows=(await ctx.env.DB.prepare(splusPaidPageSql).bind(auth.user.id,orderId,orderId,orderId,itemId).all()).results||[];
  const paid=[];
  for(const row of rows.slice(0,24)){
    let key=null;
    if(row.key_ciphertext&&vision7LicenseEncryptionConfigured(ctx.env)){
      try{key=await decryptVision7Key(ctx.env,row.key_ciphertext)}catch{}
    }
    paid.push({order_item_id:row.order_item_id,plan_code:row.plan_code,price:row.price,machine_id:row.machine_id,key,issued_at:row.issued_at});
  }
  const nextCursor=rows.length>24?`${rows[23].order_id}:${rows[23].order_item_id}`:null;
  if(raw!==null)return json({paid,next_cursor:nextCursor},200,noStore);
  const trial=await ctx.env.DB.prepare('SELECT id,machine_id,expires_at,key_ciphertext FROM splus_trials WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  const ownerResult=await ownerPage();
  let trialKey=null;if(trial?.key_ciphertext&&vision7LicenseEncryptionConfigured(ctx.env))try{trialKey=await decryptVision7Key(ctx.env,trial.key_ciphertext)}catch{}
  const release=ready?await ctx.env.DB.prepare("SELECT id,version,file_name,file_size,sha256 FROM vision7_releases WHERE program_id=(SELECT id FROM vision7_programs WHERE code='splus') AND status='published' ORDER BY published_at DESC,id DESC LIMIT 1").first():null;
  return json({ready,paid,next_cursor:nextCursor,
    trial:trial?{id:trial.id,machine_id:trial.machine_id,expires_at:trial.expires_at,key:trialKey}:null,...ownerResult,
    release:release?{...release,download_url:`/api/vision7/releases/${release.id}/download`}:null},200,noStore);
}
