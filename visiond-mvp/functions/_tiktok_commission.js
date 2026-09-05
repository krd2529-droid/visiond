const DAY=/^\d{4}-\d{2}-\d{2}$/;
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const shift=(day,offset)=>new Date(Date.parse(`${day}T00:00:00Z`)+offset*864e5).toISOString().slice(0,10);
export function commissionAvailability(now=Date.now()){
  const thaiNow=new Date(now+7*3600e3).toISOString(),today=thaiNow.slice(0,10),ready=Number(thaiNow.slice(11,13))>=12;
  return{ready,today,latestDate:shift(today,-1),nextReadyAt:ready?`${shift(today,1)}T12:00:00+07:00`:`${today}T12:00:00+07:00`};
}
export function commissionRange(url,now=Date.now()){
  const preset=Number(url.searchParams.get('days'));
  const availability=commissionAvailability(now);
  let to=clean(url.searchParams.get('to'),10)||availability.latestDate;
  if(DAY.test(to)&&to>availability.latestDate)to=availability.latestDate;
  let from=clean(url.searchParams.get('from'),10)||(preset===7||preset===30?shift(to,1-preset):to);
  if(!DAY.test(from)||!DAY.test(to)||from>to||to>availability.latestDate)throw new Error('COMMISSION_DATE_RANGE_INVALID');
  const span=Math.floor((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/864e5)+1;
  if(span>366)throw new Error('COMMISSION_DATE_RANGE_TOO_LARGE');
  return {from,to,days:span};
}
export async function aggregateTikTokCommission(env,userId,{channelId='',from,to}){
  const where=`c.user_id=? AND c.status='active' AND (?='' OR c.channel_id=?) AND date(o.create_time,'unixepoch','+7 hours') BETWEEN ? AND ?`;
  const binds=[userId,channelId,channelId,from,to];
  const validStatus="LOWER(TRIM(COALESCE(o.status,''))) IN ('completed','settled','paid','commission_paid','pending','unpaid','processing','created','shipped','delivered')",basis="COALESCE(NULLIF(json_extract(o.commission_json,'$._visiond_basis'),''),'unknown')";
  const rows=(await env.DB.prepare(`SELECT date(o.create_time,'unixepoch','+7 hours') day,c.channel_id,COALESCE(NULLIF(ch.name,''),NULLIF(c.creator_username,''),c.channel_id) channel,UPPER(COALESCE(NULLIF(json_extract(o.commission_json,'$.currency'),''),'UNKNOWN')) currency,${basis} basis,ROUND(SUM(CAST(json_extract(o.commission_json,'$.amount') AS REAL)),2) amount,COUNT(*) orders FROM tiktok_shop_affiliate_orders o JOIN tiktok_shop_creator_connections c ON c.id=o.connection_id LEFT JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE ${where} AND ${validStatus} AND json_type(o.commission_json,'$.amount') IS NOT NULL GROUP BY day,c.channel_id,currency,basis ORDER BY day,c.channel_id,basis`).bind(...binds).all()).results||[];
  const coverage=await env.DB.prepare(`SELECT COUNT(*) orders,MIN(o.create_time) earliest_order_at,MAX(o.create_time) latest_order_at,MAX(c.last_synced_at) last_synced_at FROM tiktok_shop_affiliate_orders o JOIN tiktok_shop_creator_connections c ON c.id=o.connection_id WHERE ${where} AND ${validStatus}`).bind(...binds).first();
  const totals=new Map(),channels=new Map();
  for(const row of rows){const amount=Number(row.amount)||0,keyTotal=`${row.currency}|${row.basis}`;totals.set(keyTotal,(totals.get(keyTotal)||0)+amount);const key=`${row.channel_id}|${row.currency}|${row.basis}`,old=channels.get(key)||{channel_id:row.channel_id,channel:row.channel,currency:row.currency,basis:row.basis,amount:0};old.amount+=amount;channels.set(key,old)}
  return {from,to,series:rows.map(row=>({...row,amount:Number(row.amount)||0,orders:Number(row.orders)||0})),totals:[...totals].map(([key,amount])=>{const[currency,basis]=key.split('|');return{currency,basis,amount:Number(amount.toFixed(2))}}),channels:[...channels.values()].map(row=>({...row,amount:Number(row.amount.toFixed(2))})),coverage:{orders:Number(coverage?.orders)||0,earliest_order_at:coverage?.earliest_order_at||null,latest_order_at:coverage?.latest_order_at||null,last_synced_at:coverage?.last_synced_at||null,note:'ข้อมูลเท่าที่ซิงก์จาก TikTok Shop · ตัดสถานะยกเลิก คืนเงิน และคืนสินค้าแล้ว'}};
}
