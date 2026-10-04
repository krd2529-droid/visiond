import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const pageParams=request=>{
  const url=new URL(request.url),rawLimit=url.searchParams.get('limit'),rawCursor=url.searchParams.get('cursor'),limit=Math.min(24,Math.max(1,Number.parseInt(rawLimit,10)||24));
  if(rawCursor!==null&&(!/^\d+$/.test(rawCursor)||!Number.isSafeInteger(Number(rawCursor))||Number(rawCursor)<1))return {error:'เคอร์เซอร์ไม่ถูกต้อง'};
  return {limit,cursor:rawCursor===null?null:Number(rawCursor)};
};

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const page=pageParams(ctx.request);if(page.error)return json({error:page.error},400,{'cache-control':'private, no-store'});
  const balance=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=? AND status='available'").bind(auth.user.id).first();
  const statement=page.cursor
    ?ctx.env.DB.prepare(`SELECT c.id,c.status,c.service_days,c.granted_at,c.consumed_at,o.order_no FROM vpage_credits c JOIN orders o ON o.id=c.order_id WHERE c.user_id=? AND c.id<? ORDER BY c.id DESC LIMIT ?`).bind(auth.user.id,page.cursor,page.limit+1)
    :ctx.env.DB.prepare(`SELECT c.id,c.status,c.service_days,c.granted_at,c.consumed_at,o.order_no FROM vpage_credits c JOIN orders o ON o.id=c.order_id WHERE c.user_id=? ORDER BY c.id DESC LIMIT ?`).bind(auth.user.id,page.limit+1);
  const result=await statement.all(),items=result.results||[],hasMore=items.length>page.limit;if(hasMore)items.pop();
  return json({balance:Number(balance?.count)||0,items,pagination:{limit:page.limit,has_more:hasMore,next_cursor:hasMore&&items.length?String(items.at(-1).id):null}},200,{'cache-control':'private, no-store'});
}
