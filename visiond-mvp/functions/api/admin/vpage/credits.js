import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),rawCursor=url.searchParams.get('cursor'),rawUserId=url.searchParams.get('user_id'),limit=Math.min(24,Math.max(1,Number.parseInt(url.searchParams.get('limit'),10)||24));
  if(rawCursor!==null&&(!/^\d+$/.test(rawCursor)||!Number.isSafeInteger(Number(rawCursor))||Number(rawCursor)<1))return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  if(rawUserId!==null&&(!/^\d+$/.test(rawUserId)||!Number.isSafeInteger(Number(rawUserId))||Number(rawUserId)<1))return json({error:'รหัสลูกค้าไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  const cursor=rawCursor===null?null:Number(rawCursor),userId=rawUserId===null?null:Number(rawUserId),where=['1=1'],args=[];
  if(userId){where.push('c.user_id=?');args.push(userId)}
  if(cursor){where.push('c.id<?');args.push(cursor)}
  args.push(limit+1);
  const result=await ctx.env.DB.prepare(`SELECT c.id,c.user_id,c.status,c.service_days,c.granted_at,c.consumed_at,o.order_no,u.name customer_name,u.email customer_email FROM vpage_credits c JOIN orders o ON o.id=c.order_id JOIN users u ON u.id=c.user_id WHERE ${where.join(' AND ')} ORDER BY c.id DESC LIMIT ?`).bind(...args).all(),items=result.results||[],hasMore=items.length>limit;if(hasMore)items.pop();
  return json({items,pagination:{limit,has_more:hasMore,next_cursor:hasMore&&items.length?String(items.at(-1).id):null}},200,{'cache-control':'private, no-store'});
}
