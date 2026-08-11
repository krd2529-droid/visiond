import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const safeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:null;
const clean=value=>String(value||'').trim().slice(0,80);
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),date=safeDate(url.searchParams.get('date'))||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());
  const type=clean(url.searchParams.get('type')),area=clean(url.searchParams.get('area')),user=clean(url.searchParams.get('user'));
  const where=["date(e.created_at,'+7 hours')=?"],bind=[date];
  if(type){where.push('e.event_type=?');bind.push(type)}
  if(user){where.push("(u.username LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");bind.push(`%${user}%`,`%${user}%`,`%${user}%`)}
  if(area){where.push("(e.path LIKE ? OR json_extract(e.metadata,'$.area')=?)");bind.push(area==='admin'?'/admin%':area==='course'?'%course%':area==='vbot'?'%bots%':'/%',area)}
  const rows=(await ctx.env.DB.prepare(`SELECT e.id,e.event_type,e.path,e.created_at,e.metadata,u.id user_id,u.username,u.name,u.email FROM customer_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC,e.id DESC LIMIT 300`).bind(...bind).all()).results||[];
  const items=rows.map(row=>{let meta={};try{meta=JSON.parse(row.metadata||'{}')}catch{}return {id:row.id,event_type:row.event_type,path:row.path,created_at:row.created_at,user:row.user_id?{id:row.user_id,username:row.username,name:row.name,email:row.email}:null,target:clean(meta.target),area:clean(meta.area)||((row.path||'').startsWith('/admin')?'admin':(row.path||'').includes('course')?'course':(row.path||'').includes('bots')?'vbot':'storefront')};});
  const types=[...new Set(items.map(x=>x.event_type))].sort(),summary={total:items.length,members:items.filter(x=>x.user).length,guests:items.filter(x=>!x.user).length,clicks:items.filter(x=>x.event_type==='ui_click').length};
  return json({date,items,types,summary,limited:items.length===300},200,{'cache-control':'no-store'});
}
