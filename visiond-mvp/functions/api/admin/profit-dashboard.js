import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),today=new Date().toISOString().slice(0,10),defaultFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10),from=isoDate(url.searchParams.get('from'))||defaultFrom,to=isoDate(url.searchParams.get('to'))||today;
  if(from>to)return json({error:'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'},400);
  const sales=(await ctx.env.DB.prepare(`SELECT date(updated_at,'+7 hours') day,SUM(total) sales,COUNT(*) orders FROM orders WHERE status='paid' AND sale_price_recorded=1 AND date(updated_at,'+7 hours') BETWEEN ? AND ? GROUP BY day`).bind(from,to).all()).results;
  const ads=(await ctx.env.DB.prepare(`SELECT spend_date day,facebook_cost,note,updated_at FROM ad_costs WHERE spend_date BETWEEN ? AND ?`).bind(from,to).all()).results;
  const map=new Map();for(const row of sales)map.set(row.day,{day:row.day,sales:Number(row.sales)||0,orders:Number(row.orders)||0,facebook_cost:0,note:''});for(const row of ads){const item=map.get(row.day)||{day:row.day,sales:0,orders:0,facebook_cost:0,note:''};item.facebook_cost=Number(row.facebook_cost)||0;item.note=row.note||'';map.set(row.day,item)}
  const items=[...map.values()].sort((a,b)=>b.day.localeCompare(a.day)).map(item=>({...item,profit:item.sales-item.facebook_cost,roas:item.facebook_cost>0?item.sales/item.facebook_cost:null}));
  const summary=items.reduce((sum,item)=>({sales:sum.sales+item.sales,facebook_cost:sum.facebook_cost+item.facebook_cost,profit:sum.profit+item.profit,orders:sum.orders+item.orders}),{sales:0,facebook_cost:0,profit:0,orders:0});summary.roas=summary.facebook_cost>0?summary.sales/summary.facebook_cost:null;
  return json({from,to,summary,items});
}

export async function onRequestPut(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),spendDate=isoDate(body.spend_date),cost=Math.round(Number(body.facebook_cost)*100),note=String(body.note||'').slice(0,300);
  if(!spendDate)return json({error:'กรุณาเลือกวันที่'},400);
  if(!Number.isInteger(cost)||cost<0)return json({error:'ค่าแอดต้องเป็นเลขตั้งแต่ 0 บาทขึ้นไป'},400);
  await ctx.env.DB.prepare(`INSERT INTO ad_costs(spend_date,facebook_cost,note,updated_by,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(spend_date) DO UPDATE SET facebook_cost=excluded.facebook_cost,note=excluded.note,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(spendDate,cost,note,auth.user.id).run();
  return json({ok:true,spend_date:spendDate,facebook_cost:cost});
}
