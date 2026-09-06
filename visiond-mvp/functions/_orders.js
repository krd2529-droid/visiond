import {ensureVxAccess,vxGrantStatement} from './_vx_access.js';
import {fulfillVision7Order} from './_vision7_orders.js';
import {memberCategories} from './_member_plan.js';
import {ensureVxReferralSchema,referralCommissionStatement} from './_vx_referrals.js';

async function grantFirstOrderGift(env,userId,paidOrderId){
  const existing=await env.DB.prepare("SELECT id FROM orders WHERE user_id=? AND order_origin='first_order_gift' LIMIT 1").bind(userId).first();
  if(existing)return existing.id;
  const customerPaid=await env.DB.prepare("SELECT COUNT(*) count FROM orders WHERE user_id=? AND status='paid' AND COALESCE(order_origin,'customer')<>'first_order_gift'").bind(userId).first();
  if(Number(customerPaid?.count)!==1)return 0;
  const maxSetting=await env.DB.prepare("SELECT value FROM settings WHERE key='first_order_gift_max_price'").first();
  const maxPrice=Math.max(0,Number(maxSetting?.value)||19900);
  const preferred=await env.DB.prepare(`WITH interest AS (
    SELECT p.category,p.family_key,COUNT(*) score,MAX(e.created_at) last_seen
    FROM customer_events e JOIN products p ON p.id=e.product_id
    WHERE e.user_id=? AND e.event_type='product_view' AND p.deleted_at IS NULL
    GROUP BY p.category,p.family_key ORDER BY score DESC,last_seen DESC LIMIT 1
  )
  SELECT p.id,p.title,p.slug,p.category,p.price
  FROM products p
  LEFT JOIN interest i ON 1=1
  WHERE p.status='published' AND p.deleted_at IS NULL AND p.product_kind='product'
    AND p.category NOT IN ('resale-rights','online-course')
    AND p.price<=?
    AND NOT EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id=? AND e.product_id=p.id AND e.active=1)
    AND NOT EXISTS(SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=? AND o.status='paid' AND oi.product_id=p.id)
  ORDER BY CASE WHEN i.category IS NOT NULL AND p.category=i.category THEN 0 ELSE 1 END,
           CASE WHEN i.family_key IS NOT NULL AND p.family_key=i.family_key THEN 0 ELSE 1 END,
           p.price DESC,p.id DESC LIMIT 1`).bind(userId,maxPrice,userId,userId).first();
  if(!preferred)return 0;
  const orderNo=`GIFT-${Date.now()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  let giftOrder;
  try{
    giftOrder=await env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,status,admin_note,sale_price_recorded,order_origin,gift_for_order_id,updated_at)
      VALUES(?,?,0,'paid','ของขวัญเปิดบิลแรกอัตโนมัติ',0,'first_order_gift',?,CURRENT_TIMESTAMP) RETURNING id`).bind(orderNo,userId,paidOrderId).first();
  }catch{return 0}
  if(!giftOrder?.id)return 0;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO order_items(order_id,product_id,product_title,price) VALUES(?,?,?,0)').bind(giftOrder.id,preferred.id,preferred.title),
    env.DB.prepare('INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(userId,preferred.id,giftOrder.id),
    env.DB.prepare(`INSERT INTO customer_events(user_id,event_type,path,product_id,order_id,metadata) VALUES(?,'first_order_gift_granted','/system',?,?,?)`).bind(userId,preferred.id,giftOrder.id,JSON.stringify({source_paid_order_id:paidOrderId,product_slug:preferred.slug,listed_price:Number(preferred.price)||0}))
  ]);
  return giftOrder.id;
}

export async function grantOrder(env, order, actor = {}) {
  await ensureVxReferralSchema(env);
  await ensureVxAccess(env);
  const target = await env.DB.prepare('SELECT name,username,email FROM users WHERE id=?').bind(order.user_id).first();
  const items = (await env.DB.prepare("SELECT oi.id order_item_id,oi.product_id,COALESCE(oi.product_title,p.title,'สินค้าเดิม') title,p.slug,p.product_kind,p.category,p.member_category,p.member_duration_months FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.id").bind(order.id).all()).results||[];
  const actorName = actor.name || actor.username || actor.email || 'VisionD Auto',actorRole = actor.role || 'system',actorId = Number(actor.id) || 0,statements=[],grantIndexes=[];
  for (const item of items) {
    grantIndexes.push(statements.length);
    if(item.product_kind==='vx-access')statements.push(vxGrantStatement(env,order,item.slug));
    else if(item.category==='resale-rights')statements.push(env.DB.prepare(`INSERT OR IGNORE INTO course_right_credits(user_id,product_id,order_id,active,source_order_item_id) SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(order.user_id,item.product_id,order.id,item.order_item_id,order.id));
    else statements.push(env.DB.prepare(`INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(order.user_id,item.product_id,order.id,order.id));
    if(item.product_kind==='member')for(const category of memberCategories(item.member_category)){const months=Math.max(0,Number(item.member_duration_months)||0),expiry=months?`+${months} months`:null;statements.push(expiry?env.DB.prepare(`INSERT INTO category_memberships(user_id,category_slug,order_id,starts_at,expires_at,active,updated_at) SELECT ?,?,?,CURRENT_TIMESTAMP,datetime('now',?),1,CURRENT_TIMESTAMP WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review') ON CONFLICT(user_id,category_slug) DO UPDATE SET order_id=excluded.order_id,starts_at=CURRENT_TIMESTAMP,expires_at=CASE WHEN category_memberships.expires_at LIKE '9999-%' THEN category_memberships.expires_at WHEN category_memberships.expires_at>CURRENT_TIMESTAMP THEN datetime(category_memberships.expires_at,?) ELSE excluded.expires_at END,active=1,updated_at=CURRENT_TIMESTAMP`).bind(order.user_id,category,order.id,expiry,order.id,expiry):env.DB.prepare(`INSERT INTO category_memberships(user_id,category_slug,order_id,starts_at,expires_at,active,updated_at) SELECT ?,?,?,CURRENT_TIMESTAMP,'9999-12-31 23:59:59',1,CURRENT_TIMESTAMP WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review') ON CONFLICT(user_id,category_slug) DO UPDATE SET order_id=excluded.order_id,starts_at=CURRENT_TIMESTAMP,expires_at='9999-12-31 23:59:59',active=1,updated_at=CURRENT_TIMESTAMP`).bind(order.user_id,category,order.id,order.id))}
    statements.push(env.DB.prepare(`INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(actorId,actorName,actorRole,order.user_id,target?.name||target?.username||target?.email||String(order.user_id),item.product_id,item.title,order.id,order.order_no,actor.method||'slip_approval',String(actor.note||'').slice(0,300),order.id));
  }
  statements.push(referralCommissionStatement(env,order));
  const statusIndex=statements.length;statements.push(env.DB.prepare("UPDATE orders SET status='paid',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review'").bind(actor.note || '', order.id));
  const results=await env.DB.batch(statements),claimed=Number(results[statusIndex]?.meta?.changes)||0;
  if(!claimed)return 0;
  if(items.some(item=>item.product_kind==='vision7-key'))await fulfillVision7Order(env,order,actor);
  try{
    const attribution=await env.DB.prepare(`SELECT visitor_key,source,medium,campaign,content,referrer FROM customer_events WHERE user_id=? AND event_type<>'purchase' AND (source<>'' OR campaign<>'' OR content<>'') AND created_at>=datetime('now','-30 days') ORDER BY created_at DESC,id DESC LIMIT 1`).bind(order.user_id).first();
    await env.DB.prepare(`INSERT INTO customer_events(visitor_key,user_id,event_type,path,order_id,source,medium,campaign,content,referrer,metadata) VALUES(?,?,'purchase','/checkout',?,?,?,?,?,?,?)`).bind(attribution?.visitor_key||null,order.user_id,order.id,attribution?.source||'',attribution?.medium||'',attribution?.campaign||'',attribution?.content||'',attribution?.referrer||'',JSON.stringify({total:Number(order.total)||0,attribution_window_days:30})).run();
  }catch{}
  try{await grantFirstOrderGift(env,order.user_id,order.id)}catch(error){console.error('FIRST_ORDER_GIFT_FAILED',error)}
  return grantIndexes.reduce((sum,index)=>sum+(Number(results[index]?.meta?.changes)||0),0);
}
