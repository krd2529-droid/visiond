import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;
const text=(v,n=160)=>String(v||'').trim().slice(0,n);
const num=v=>Number(v)||0;
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const u=new URL(ctx.request.url),today=new Date().toISOString().slice(0,10),from=date(u.searchParams.get('from'))||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=date(u.searchParams.get('to'))||today;if(from>to)return json({error:'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'},400);
  const spend=(await ctx.env.DB.prepare(`SELECT id,spend_date,platform,campaign,adset,creative,cost,note FROM ad_campaign_costs WHERE spend_date BETWEEN ? AND ? ORDER BY spend_date DESC,id DESC`).bind(from,to).all()).results||[];
  const attributed=(await ctx.env.DB.prepare(`SELECT COALESCE(NULLIF(e.source,''),'direct') source,COALESCE(e.campaign,'') campaign,COALESCE(e.content,'') creative,COUNT(DISTINCT o.id) orders,COUNT(DISTINCT o.user_id) buyers,COALESCE(SUM(o.total),0) revenue FROM customer_events e JOIN orders o ON o.id=e.order_id AND o.status='paid' WHERE e.event_type='purchase' AND date(e.created_at,'+7 hours') BETWEEN ? AND ? GROUP BY source,campaign,creative ORDER BY revenue DESC`).bind(from,to).all()).results||[];
  const normSource=v=>{const x=String(v||'').toLowerCase().trim();if(['facebook','fb','meta','facebook.com','m.facebook.com','l.facebook.com'].includes(x))return 'facebook';if(['tiktok','tiktok.com'].includes(x))return 'tiktok';if(['google','google.com'].includes(x))return 'google';return x||'direct'};
  const key=(source,campaign,creative)=>`${normSource(source)}\n${campaign||''}\n${creative||''}`,perf=new Map();
  for(const r of attributed)perf.set(key(r.source,r.campaign,r.creative),{source:r.source,campaign:r.campaign,creative:r.creative,orders:num(r.orders),buyers:num(r.buyers),revenue:num(r.revenue),spend:0});
  for(const r of spend){const source=normSource(r.platform||'facebook'),k=key(source,r.campaign,r.creative),x=perf.get(k)||{source,campaign:r.campaign,creative:r.creative,orders:0,buyers:0,revenue:0,spend:0};x.spend+=num(r.cost);perf.set(k,x)}
  const performance=[...perf.values()].map(x=>({...x,profit:x.revenue-x.spend,roas:x.spend>0?x.revenue/x.spend:null})).sort((a,b)=>b.revenue-a.revenue||b.spend-a.spend);
  const summary=performance.reduce((a,x)=>({spend:a.spend+x.spend,revenue:a.revenue+x.revenue,orders:a.orders+x.orders,buyers:a.buyers+x.buyers}),{spend:0,revenue:0,orders:0,buyers:0});summary.profit=summary.revenue-summary.spend;summary.roas=summary.spend?summary.revenue/summary.spend:null;return json({from,to,summary,performance,spend});
}
export async function onRequestPut(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const b=await ctx.request.json().catch(()=>({})),spendDate=date(b.spend_date),platform=text(b.platform||'facebook',40).toLowerCase(),campaign=text(b.campaign),adset=text(b.adset),creative=text(b.creative),cost=Math.round(Number(b.cost)*100),note=text(b.note,300);
  if(!spendDate)return json({error:'กรุณาเลือกวันที่'},400);if(!campaign)return json({error:'กรุณากรอก Campaign ให้ตรงกับ utm_campaign'},400);if(!Number.isInteger(cost)||cost<0)return json({error:'ค่าแอดต้องเป็นเลขตั้งแต่ 0 บาทขึ้นไป'},400);
  await ctx.env.DB.prepare(`INSERT INTO ad_campaign_costs(spend_date,platform,campaign,adset,creative,cost,note,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(spend_date,platform,campaign,adset,creative) DO UPDATE SET cost=excluded.cost,note=excluded.note,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(spendDate,platform,campaign,adset,creative,cost,note,auth.user.id).run();return json({ok:true});
}
export async function onRequestDelete(ctx){await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const id=Number(new URL(ctx.request.url).searchParams.get('id'))||0;if(!id)return json({error:'ไม่พบรายการ'},400);const r=await ctx.env.DB.prepare('DELETE FROM ad_campaign_costs WHERE id=?').bind(id).run();return json({ok:true,deleted:num(r?.meta?.changes)});}
