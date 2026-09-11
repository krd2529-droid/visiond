import {json,requireUser} from '../../_lib.js';
import {orderCoverage} from '../../_tiktok_order_sync.js';

const headers={'cache-control':'private, no-store'};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ORDER_SCOPE='creator.affiliate_collaboration.read';
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const shift=(day,offset)=>new Date(Date.parse(`${day}T00:00:00Z`)+offset*864e5).toISOString().slice(0,10);

export function partnerCommissionRange(url,now=Date.now()){
  const today=new Date(now+7*3600e3).toISOString().slice(0,10),latest=shift(today,-1);
  const to=clean(url.searchParams.get('to'),10)||latest,from=clean(url.searchParams.get('from'),10)||shift(to,-29);
  if(!DAY.test(from)||!DAY.test(to)||from>to||to>latest)throw new Error('INVALID_RANGE');
  const fromEpoch=Math.floor(Date.parse(`${from}T00:00:00+07:00`)/1000),toExclusive=Math.floor(Date.parse(`${to}T00:00:00+07:00`)/1000)+86400;
  if(!Number.isFinite(fromEpoch)||!Number.isFinite(toExclusive)||toExclusive-fromEpoch>90*86400)throw new Error('INVALID_RANGE');
  return{from,to,fromEpoch,toExclusive};
}

export async function aggregatePartnerCommission(env,connection,range){
  const amount="TRIM(COALESCE(json_extract(o.commission_json,'$.amount'),''))";
  const valid=`${amount}<>'' AND ${amount} NOT GLOB '*[^0-9.]*' AND length(${amount})-length(replace(${amount},'.',''))<=1 AND ${amount} NOT LIKE '.%' AND ${amount} NOT LIKE '%.' AND CAST(${amount} AS REAL)>0`;
  const basis="CASE WHEN json_extract(o.commission_json,'$._visiond_basis') IN ('actual','estimated') THEN json_extract(o.commission_json,'$._visiond_basis') ELSE 'unknown' END";
  const currency="UPPER(COALESCE(NULLIF(TRIM(json_extract(o.commission_json,'$.currency')),''),'UNKNOWN'))";
  const rows=(await env.DB.prepare(`SELECT ${basis} basis,${currency} currency,COUNT(*) orders,SUM(CASE WHEN ${valid} THEN 1 ELSE 0 END) valued_orders,SUM(CASE WHEN ${valid} THEN 0 ELSE 1 END) unavailable_orders,ROUND(SUM(CASE WHEN ${valid} THEN CAST(${amount} AS REAL) ELSE 0 END),2) amount,MAX(o.synced_at) last_synced_at FROM tiktok_shop_affiliate_orders o WHERE o.connection_id=? AND o.create_time>=? AND o.create_time<? AND LOWER(TRIM(COALESCE(o.status,''))) IN ('awaiting payment','to-settle','settled','completed','paid','commission_paid','pending','unpaid','processing','created','shipped','delivered') GROUP BY basis,currency ORDER BY basis,currency`).bind(connection.connection_id,range.fromEpoch,range.toExclusive).all()).results||[];
  const totals=rows.filter(row=>Number(row.valued_orders)>0&&Number(row.amount)>0).map(row=>({basis:row.basis,currency:row.currency,amount:Number(Number(row.amount).toFixed(2)),orders:Number(row.valued_orders)||0}));
  const coverage=rows.reduce((result,row)=>({orders:result.orders+(Number(row.orders)||0),valued_orders:result.valued_orders+(Number(row.valued_orders)||0),unavailable_orders:result.unavailable_orders+(Number(row.unavailable_orders)||0),last_synced_at:String(row.last_synced_at||'')>result.last_synced_at?String(row.last_synced_at):result.last_synced_at}),{orders:0,valued_orders:0,unavailable_orders:0,last_synced_at:''});
  return{status:coverage.orders===0?'no_synced_data':totals.length?'ready':'no_commission_evidence',totals,coverage};
}

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx,{includeCourseOwner:false});
  if(auth.error)return json({error:'กรุณาเข้าสู่ระบบ'},401,headers);
  if(auth.user.role!=='boss')return json({error:'เฉพาะ Boss เท่านั้นที่ดูค่าคอมทดสอบได้'},403,headers);
  let range;try{range=partnerCommissionRange(new URL(ctx.request.url))}catch{return json({error:'เลือกช่วงวันได้ไม่เกิน 90 วันและไม่เกินเมื่อวาน'},400,headers)}
  const channelId=clean(new URL(ctx.request.url).searchParams.get('channel_id'),80);
  if(!channelId)return json({error:'กรุณาเลือกช่อง'},400,headers);
  const connection=await ctx.env.DB.prepare(`SELECT sc.id connection_id,sc.channel_id,sc.scopes FROM tiktok_channels ch JOIN tiktok_shop_creator_connections sc ON sc.channel_id=ch.id AND sc.user_id=ch.created_by WHERE ch.id=? AND ch.created_by=? AND ch.archived_at IS NULL AND sc.user_id=? AND sc.status='active' ORDER BY sc.updated_at DESC LIMIT 1`).bind(channelId,auth.user.id,auth.user.id).first();
  if(!connection)return json({error:'ไม่พบช่อง TikTok Shop ที่เชื่อมและเป็นของ Boss'},404,headers);
  const source={kind:'tiktok_partner_api_order_sync',endpoint:'POST /affiliate_creator/202410/orders/search',scope:ORDER_SCOPE};
  if(!String(connection.scopes||'').split(',').map(value=>value.trim()).includes(ORDER_SCOPE))return json({ok:true,status:'missing_scope',range:{from:range.from,to:range.to},source,sync:{status:'missing_scope',synced_at:null},totals:[],coverage:{orders:0,valued_orders:0,unavailable_orders:0,last_synced_at:null}},200,headers);
  const orderSync=await orderCoverage(ctx.env,{id:connection.connection_id,scopes:connection.scopes},range);
  const result=await aggregatePartnerCommission(ctx.env,connection,range);
  return json({ok:true,...result,range:{from:range.from,to:range.to},source,sync:{status:orderSync.status,synced_at:orderSync.synced_at||null}},200,headers);
}
