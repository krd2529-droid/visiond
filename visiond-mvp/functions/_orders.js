export async function grantOrder(env, order, actor = {}) {
  const target = await env.DB.prepare('SELECT name,username,email FROM users WHERE id=?').bind(order.user_id).first();
  const items = (await env.DB.prepare("SELECT oi.id order_item_id,oi.product_id,COALESCE(oi.product_title,p.title,'สินค้าเดิม') title,p.product_kind,p.category FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.id").bind(order.id).all()).results||[];
  const actorName = actor.name || actor.username || actor.email || 'VisionD Auto',actorRole = actor.role || 'system',actorId = Number(actor.id) || 0,statements=[],grantIndexes=[];
  for (const item of items) {
    grantIndexes.push(statements.length);
    if(item.category==='resale-rights')statements.push(env.DB.prepare(`INSERT OR IGNORE INTO course_right_credits(user_id,product_id,order_id,active,source_order_item_id) SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(order.user_id,item.product_id,order.id,item.order_item_id,order.id));
    else statements.push(env.DB.prepare(`INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(order.user_id,item.product_id,order.id,order.id));
    statements.push(env.DB.prepare(`INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='pending_review')`).bind(actorId,actorName,actorRole,order.user_id,target?.name||target?.username||target?.email||String(order.user_id),item.product_id,item.title,order.id,order.order_no,actor.method||'slip_approval',String(actor.note||'').slice(0,300),order.id));
  }
  const statusIndex=statements.length;statements.push(env.DB.prepare("UPDATE orders SET status='paid',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review'").bind(actor.note || '', order.id));
  const results=await env.DB.batch(statements),claimed=Number(results[statusIndex]?.meta?.changes)||0;
  if(!claimed)return 0;
  return grantIndexes.reduce((sum,index)=>sum+(Number(results[index]?.meta?.changes)||0),0);
}
