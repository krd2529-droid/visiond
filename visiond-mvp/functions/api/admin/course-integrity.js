import { json, requireAdmin } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
async function sampleEventCase(env){
  const courses=(await env.DB.prepare(`SELECT c.id course_id,c.review_status,c.active,p.id product_id,p.title,p.status product_status,u.username owner_username,u.vision5_test_account FROM courses c JOIN products p ON p.id=c.product_id JOIN users u ON u.id=c.owner_user_id WHERE c.course_origin='seller_rights' AND p.deleted_at IS NULL AND (lower(u.username)='user1' OR u.vision5_test_account=1) ORDER BY c.id DESC LIMIT 20`).all()).results||[];
  const items=[];
  for(const course of courses){
    const stats=await env.DB.prepare(`SELECT COUNT(*) paid_orders,SUM(CASE WHEN o.slip_key IS NOT NULL OR EXISTS(SELECT 1 FROM order_slip_evidence se WHERE se.order_id=o.id) THEN 1 ELSE 0 END) approved_slips,SUM(CASE WHEN EXISTS(SELECT 1 FROM entitlements e WHERE e.order_id=o.id AND e.product_id=? AND e.active=1) THEN 1 ELSE 0 END) learning_rights FROM orders o WHERE o.seller_course_id=? AND o.status='paid'`).bind(course.product_id,course.course_id).first();
    const invalid=await env.DB.prepare(`SELECT COUNT(*) n FROM entitlements e WHERE e.product_id=? AND e.active=1 AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=e.order_id AND o.seller_course_id=? AND o.status='paid')`).bind(course.product_id,course.course_id).first();
    const paid=Number(stats?.paid_orders)||0,slips=Number(stats?.approved_slips)||0,rights=Number(stats?.learning_rights)||0,invalidRights=Number(invalid?.n)||0,healthy=paid===slips&&slips===rights&&invalidRights===0;
    items.push({...course,paid_orders:paid,approved_slips:slips,learning_rights:rights,invalid_rights:invalidRights,healthy,difference:rights-slips,event_case_ready:healthy&&paid>0&&course.review_status==='approved'&&Number(course.active)===1&&course.product_status==='published',sample_account:true});
  }
  const ready=items.filter(x=>x.event_case_ready).length;
  return {checked_at:new Date().toISOString(),healthy:items.every(x=>x.healthy),issues:items.filter(x=>!x.healthy).length,course_issues:items.filter(x=>!x.healthy).length,system_issues:0,checks:{credit_mismatches:[],unlock_log_mismatches:[],nonpaid_entitlements:[],orphan_orders:[]},items,event_case:{sample:'user1 / Vision 5 test',total:items.length,ready,pending:items.length-ready,complete:items.length>0&&ready===items.length,items}};
}
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireAdmin(ctx); if (auth.error) return auth.error;
  if(new URL(ctx.request.url).searchParams.get('event_case')==='1')return json(await sampleEventCase(ctx.env),200,{'cache-control':'no-store'});
  const rows = await ctx.env.DB.prepare(`
    WITH paid AS (
      SELECT seller_course_id course_id,COUNT(*) paid_orders,
        SUM(CASE WHEN slip_key IS NOT NULL OR EXISTS(SELECT 1 FROM order_slip_evidence se WHERE se.order_id=orders.id) THEN 1 ELSE 0 END) approved_slips
      FROM orders WHERE status='paid' AND seller_course_id IS NOT NULL GROUP BY seller_course_id
    ), rights AS (
      SELECT c.id course_id,
        SUM(CASE WHEN o.status='paid' AND o.seller_course_id=c.id THEN 1 ELSE 0 END) learning_rights,
        SUM(CASE WHEN e.id IS NOT NULL AND NOT (o.status='paid' AND o.seller_course_id=c.id) THEN 1 ELSE 0 END) invalid_rights
      FROM courses c JOIN products p ON p.id=c.product_id
      LEFT JOIN entitlements e ON e.product_id=p.id AND e.active=1
      LEFT JOIN orders o ON o.id=e.order_id
      WHERE c.course_origin='seller_rights' AND p.deleted_at IS NULL GROUP BY c.id
    )
    SELECT c.id course_id,p.title,p.status product_status,c.review_status,c.active,u.username owner_username,u.vision5_test_account,
      COALESCE(paid.paid_orders,0) paid_orders,COALESCE(paid.approved_slips,0) approved_slips,
      COALESCE(rights.learning_rights,0) learning_rights,COALESCE(rights.invalid_rights,0) invalid_rights
    FROM courses c JOIN products p ON p.id=c.product_id JOIN users u ON u.id=c.owner_user_id
    LEFT JOIN paid ON paid.course_id=c.id LEFT JOIN rights ON rights.course_id=c.id
    WHERE c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC
  `).all();
  const items=(rows.results||[]).map(x=>{const paid=Number(x.paid_orders)||0,slips=Number(x.approved_slips)||0,learningRights=Number(x.learning_rights)||0,invalid=Number(x.invalid_rights)||0,healthy=paid===slips&&slips===learningRights&&invalid===0;return {...x,paid_orders:paid,approved_slips:slips,learning_rights:learningRights,invalid_rights:invalid,healthy,difference:learningRights-slips,event_case_ready:healthy&&paid>0&&x.review_status==='approved'&&Number(x.active)===1&&x.product_status==='published',sample_account:String(x.owner_username||'').toLowerCase()==='user1'||Number(x.vision5_test_account)===1}});
  const [creditMismatchRows,unlockMismatchRows,rejectedEntitlementRows,orphanOrderRows]=await Promise.all([
    ctx.env.DB.prepare(`WITH bought AS (SELECT oi.order_id,COUNT(*) purchased_count FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE p.category='resale-rights' GROUP BY oi.order_id),granted AS (SELECT order_id,COUNT(*) credit_count FROM course_right_credits GROUP BY order_id) SELECT o.id order_id,o.order_no,COALESCE(granted.credit_count,0) credit_count,bought.purchased_count FROM bought JOIN orders o ON o.id=bought.order_id LEFT JOIN granted ON granted.order_id=o.id WHERE o.status='paid' AND COALESCE(granted.credit_count,0)<>bought.purchased_count ORDER BY o.id DESC LIMIT 200`).all(),
    ctx.env.DB.prepare(`WITH bought AS (SELECT order_id,product_id,COUNT(*) item_count FROM order_items GROUP BY order_id,product_id),logged AS (SELECT order_id,product_id,COUNT(*) log_count FROM unlock_logs GROUP BY order_id,product_id) SELECT bought.order_id,o.order_no,bought.product_id,bought.item_count,COALESCE(logged.log_count,0) log_count FROM bought JOIN orders o ON o.id=bought.order_id LEFT JOIN logged ON logged.order_id=bought.order_id AND logged.product_id=bought.product_id WHERE o.status='paid' AND COALESCE(logged.log_count,0)<>bought.item_count ORDER BY bought.order_id DESC LIMIT 200`).all(),
    ctx.env.DB.prepare(`SELECT e.id entitlement_id,o.id order_id,o.order_no,p.title,o.status FROM entitlements e JOIN orders o ON o.id=e.order_id JOIN products p ON p.id=e.product_id WHERE e.active=1 AND o.status<>'paid' ORDER BY e.id DESC LIMIT 200`).all(),
    ctx.env.DB.prepare(`SELECT o.id order_id,o.order_no,o.status FROM orders o WHERE NOT EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id) ORDER BY o.id DESC LIMIT 200`).all()
  ]);
  const checks={credit_mismatches:creditMismatchRows.results||[],unlock_log_mismatches:unlockMismatchRows.results||[],nonpaid_entitlements:rejectedEntitlementRows.results||[],orphan_orders:orphanOrderRows.results||[]};
  const systemIssues=Object.values(checks).reduce((sum,list)=>sum+list.length,0),courseIssues=items.filter(x=>!x.healthy).length,sampleItems=items.filter(x=>x.sample_account),sampleReady=sampleItems.filter(x=>x.event_case_ready).length;
  return json({checked_at:new Date().toISOString(),healthy:courseIssues===0&&systemIssues===0,issues:courseIssues+systemIssues,course_issues:courseIssues,system_issues:systemIssues,checks,items,event_case:{sample:'user1 / Vision 5 test',total:sampleItems.length,ready:sampleReady,pending:sampleItems.length-sampleReady,complete:sampleItems.length>0&&sampleReady===sampleItems.length,items:sampleItems}},200,{'cache-control':'no-store'});
}
