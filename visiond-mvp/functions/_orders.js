export async function grantOrder(env, order, actor = {}) {
  const target = await env.DB.prepare('SELECT name,username,email FROM users WHERE id=?').bind(order.user_id).first();
  const items = (await env.DB.prepare('SELECT p.id product_id,p.title,p.product_kind,p.category FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?').bind(order.id).all()).results;
  const actorName = actor.name || actor.username || actor.email || 'VisionD Auto';
  const actorRole = actor.role || 'system';
  const actorId = Number(actor.id) || 0;
  const statements = [env.DB.prepare("UPDATE orders SET status='paid',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review'").bind(actor.note || '', order.id)];
  for (const item of items) {
    if(item.category==='resale-rights'){
      statements.push(env.DB.prepare('INSERT INTO course_right_credits(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(order.user_id,item.product_id,order.id));
    }else statements.push(env.DB.prepare('INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id) VALUES(?,?,?)').bind(order.user_id,item.product_id,order.id));
    statements.push(env.DB.prepare('INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(actorId,actorName,actorRole,order.user_id,target?.name||target?.username||target?.email||String(order.user_id),item.product_id,item.title,order.id,order.order_no,actor.method||'slip_approval',String(actor.note||'').slice(0,300)));
  }
  await env.DB.batch(statements);
  return items.length;
}
