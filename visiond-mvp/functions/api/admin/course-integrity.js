import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const rows=await ctx.env.DB.prepare(`SELECT c.id course_id,p.title,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid') paid_orders,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid' AND (o.slip_key IS NOT NULL OR EXISTS(SELECT 1 FROM order_slip_evidence se WHERE se.order_id=o.id))) approved_slips,
    (SELECT COUNT(*) FROM entitlements e JOIN orders o ON o.id=e.order_id WHERE e.product_id=p.id AND e.active=1 AND o.seller_course_id=c.id AND o.status='paid') learning_rights,
    (SELECT COUNT(*) FROM entitlements e WHERE e.product_id=p.id AND e.active=1 AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=e.order_id AND o.seller_course_id=c.id AND o.status='paid')) invalid_rights
    FROM courses c JOIN products p ON p.id=c.product_id WHERE c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC`).all();
  const items=(rows.results||[]).map(x=>{const paid=Number(x.paid_orders)||0,slips=Number(x.approved_slips)||0,rights=Number(x.learning_rights)||0,invalid=Number(x.invalid_rights)||0;return {...x,paid_orders:paid,approved_slips:slips,learning_rights:rights,invalid_rights:invalid,healthy:paid===slips&&slips===rights&&invalid===0,difference:rights-slips}});
  const [creditMismatchRows,unlockMismatchRows,rejectedEntitlementRows,orphanOrderRows]=await Promise.all([
    ctx.env.DB.prepare(`SELECT o.id order_id,o.order_no,
      (SELECT COUNT(*) FROM course_right_credits cr WHERE cr.order_id=o.id) credit_count,
      (SELECT COUNT(*) FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id AND p.category='resale-rights') purchased_count
      FROM orders o WHERE o.status='paid'
      AND EXISTS(SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id AND p.category='resale-rights')
      AND (SELECT COUNT(*) FROM course_right_credits cr WHERE cr.order_id=o.id)<>(SELECT COUNT(*) FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id AND p.category='resale-rights')`).all(),
    ctx.env.DB.prepare(`SELECT oi.order_id,o.order_no,oi.product_id,COUNT(oi.id) item_count,
      (SELECT COUNT(*) FROM unlock_logs ul WHERE ul.order_id=oi.order_id AND ul.product_id=oi.product_id) log_count
      FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='paid'
      GROUP BY oi.order_id,oi.product_id HAVING log_count<>item_count`).all(),
    ctx.env.DB.prepare(`SELECT e.id entitlement_id,o.id order_id,o.order_no,p.title,o.status
      FROM entitlements e JOIN orders o ON o.id=e.order_id JOIN products p ON p.id=e.product_id
      WHERE e.active=1 AND o.status<>'paid' ORDER BY e.id DESC LIMIT 200`).all(),
    ctx.env.DB.prepare(`SELECT o.id order_id,o.order_no,o.status FROM orders o
      WHERE NOT EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id) ORDER BY o.id DESC LIMIT 200`).all()
  ]);
  const checks={
    credit_mismatches:creditMismatchRows.results||[],
    unlock_log_mismatches:unlockMismatchRows.results||[],
    nonpaid_entitlements:rejectedEntitlementRows.results||[],
    orphan_orders:orphanOrderRows.results||[]
  };
  const systemIssues=Object.values(checks).reduce((sum,list)=>sum+list.length,0),courseIssues=items.filter(x=>!x.healthy).length;
  return json({checked_at:new Date().toISOString(),healthy:courseIssues===0&&systemIssues===0,issues:courseIssues+systemIssues,course_issues:courseIssues,system_issues:systemIssues,checks,items},200,{'cache-control':'no-store'});
}
