import {json,requireUser} from '../../_lib.js';
import {validateOrderRange} from '../../_tiktok_order_sync.js';

const headers={'cache-control':'private, no-store'};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ORDER_SCOPE='creator.affiliate_collaboration.read';
const MAX_CHANNELS=24;
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const shift=(day,offset)=>new Date(Date.parse(`${day}T00:00:00Z`)+offset*864e5).toISOString().slice(0,10);
const hasOrderScope=connection=>String(connection?.scopes||'').split(',').map(value=>value.trim()).includes(ORDER_SCOPE);

export function partnerCommissionRange(url,now=Date.now()){
  const today=new Date(now+7*3600e3).toISOString().slice(0,10),latest=shift(today,-1);
  const to=clean(url.searchParams.get('to'),10)||latest,from=clean(url.searchParams.get('from'),10)||shift(to,-29);
  if(!DAY.test(from)||!DAY.test(to)||from>to||to>latest)throw new Error('INVALID_RANGE');
  const fromEpoch=Math.floor(Date.parse(`${from}T00:00:00+07:00`)/1000),toExclusive=Math.floor(Date.parse(`${to}T00:00:00+07:00`)/1000)+86400;
  const range={from,to,fromEpoch,toExclusive};
  if(!validateOrderRange(range,now))throw new Error('INVALID_RANGE');
  return range;
}

export async function discoverPartnerCommissionConnections(env,userId,scope,channelId,range){
  const selected=scope==='selected'?' AND ch.id=?':'',binds=[userId,...(scope==='selected'?[channelId]:[]),range.from,range.to];
  const sql=`WITH ranked AS (
    SELECT sc.id connection_id,sc.channel_id,sc.scopes,sc.updated_at,
      COALESCE(NULLIF(ch.name,''),NULLIF(sc.creator_username,''),sc.channel_id) channel_name,
      ROW_NUMBER() OVER (PARTITION BY sc.channel_id ORDER BY sc.updated_at DESC,sc.id DESC) connection_rank
    FROM tiktok_shop_creator_connections sc
    JOIN tiktok_channels ch ON ch.id=sc.channel_id AND ch.created_by=sc.user_id
    WHERE sc.user_id=? AND sc.status='active' AND ch.archived_at IS NULL${selected}
  )
  SELECT r.connection_id,r.channel_id,r.channel_name,r.scopes,
    COALESCE(c.status,'never') sync_status,c.synced_at,c.error_code,c.lease_until,c.pages
  FROM ranked r
  LEFT JOIN tiktok_shop_order_coverage c ON c.connection_id=r.connection_id AND c.date_from=? AND c.date_to=?
  WHERE r.connection_rank=1
  ORDER BY r.channel_name,r.channel_id
  LIMIT 25`;
  return{sql,rows:(await env.DB.prepare(sql).bind(...binds).all()).results||[]};
}

export async function aggregatePartnerCommissions(env,connections,range){
  const eligible=connections.filter(hasOrderScope),ids=eligible.length?eligible.map(row=>row.connection_id):[''];
  const placeholders=ids.map(()=>'?').join(','),amount="TRIM(COALESCE(json_extract(o.commission_json,'$.amount'),''))";
  const valid=`${amount}<>'' AND ${amount} NOT GLOB '*[^0-9.]*' AND length(${amount})-length(replace(${amount},'.',''))<=1 AND ${amount} NOT LIKE '.%' AND ${amount} NOT LIKE '%.' AND CAST(${amount} AS REAL)>0`;
  const basis="CASE WHEN json_extract(o.commission_json,'$._visiond_basis') IN ('actual','estimated') THEN json_extract(o.commission_json,'$._visiond_basis') ELSE 'unknown' END";
  const currency="UPPER(COALESCE(NULLIF(TRIM(json_extract(o.commission_json,'$.currency')),''),'UNKNOWN'))";
  const sql=`SELECT o.connection_id,${basis} basis,${currency} currency,COUNT(*) orders,SUM(CASE WHEN ${valid} THEN 1 ELSE 0 END) valued_orders,SUM(CASE WHEN ${valid} THEN 0 ELSE 1 END) unavailable_orders,ROUND(SUM(CASE WHEN ${valid} THEN CAST(${amount} AS REAL) ELSE 0 END),2) amount,MAX(o.synced_at) last_synced_at FROM tiktok_shop_affiliate_orders o WHERE o.connection_id IN (${placeholders}) AND o.create_time>=? AND o.create_time<? AND LOWER(TRIM(COALESCE(o.status,''))) IN ('awaiting payment','to-settle','settled','completed','paid','commission_paid','pending','unpaid','processing','created','shipped','delivered') GROUP BY o.connection_id,basis,currency ORDER BY o.connection_id,basis,currency`;
  return{sql,rows:(await env.DB.prepare(sql).bind(...ids,range.fromEpoch,range.toExclusive).all()).results||[]};
}

const totalsFromRows=rows=>[...rows.reduce((groups,row)=>{
  if(Number(row.valued_orders)<=0||Number(row.amount)<=0)return groups;
  const key=`${row.basis}\n${row.currency}`,current=groups.get(key)||{basis:row.basis,currency:row.currency,amount:0,orders:0};
  current.amount+=Number(row.amount)||0;current.orders+=Number(row.valued_orders)||0;groups.set(key,current);return groups;
},new Map()).values()].map(row=>({...row,amount:Number(row.amount.toFixed(2))})).sort((a,b)=>a.basis.localeCompare(b.basis)||a.currency.localeCompare(b.currency));
const coverageFromRows=rows=>rows.reduce((result,row)=>({orders:result.orders+(Number(row.orders)||0),valued_orders:result.valued_orders+(Number(row.valued_orders)||0),unavailable_orders:result.unavailable_orders+(Number(row.unavailable_orders)||0),last_synced_at:String(row.last_synced_at||'')>result.last_synced_at?String(row.last_synced_at):result.last_synced_at}),{orders:0,valued_orders:0,unavailable_orders:0,last_synced_at:''});
const syncStatus=row=>row.sync_status==='running'&&Number(row.lease_until)<=Date.now()?'failed':row.sync_status||'never';

export function buildPartnerCommissionResult(connections,aggregateRows,scope,range){
  const byConnection=new Map();for(const row of aggregateRows){const key=String(row.connection_id),list=byConnection.get(key)||[];list.push(row);byConnection.set(key,list)}
  const channels=connections.map(connection=>{
    const rows=byConnection.get(String(connection.connection_id))||[],totals=totalsFromRows(rows),coverage=coverageFromRows(rows),sync={status:syncStatus(connection),synced_at:connection.synced_at||null,error_code:connection.error_code||''};
    const status=!hasOrderScope(connection)?'missing_scope':sync.status!=='complete'?'no_exact_sync':coverage.orders===0?'complete_no_orders':totals.length?'ready':'no_commission_evidence';
    return{channel_id:connection.channel_id,channel_name:connection.channel_name,status,complete:status==='ready'||status==='complete_no_orders'||status==='no_commission_evidence',sync,totals,coverage};
  });
  const totals=totalsFromRows(aggregateRows),coverage=coverageFromRows(aggregateRows),complete=channels.length>0&&channels.every(channel=>channel.complete),incomplete_channels=channels.filter(channel=>!channel.complete).map(channel=>({channel_id:channel.channel_id,channel_name:channel.channel_name,status:channel.status}));
  let status=channels.length===0?'no_channels':!complete?'partial':coverage.orders===0?'no_synced_data':totals.length?'ready':'no_commission_evidence';
  if(scope==='selected'&&channels[0])status=channels[0].status==='missing_scope'?'missing_scope':channels[0].status==='no_exact_sync'?'partial':coverage.orders===0?'no_synced_data':totals.length?'ready':'no_commission_evidence';
  return{status,complete,scope,range:{from:range.from,to:range.to},totals,coverage,channels,incomplete_channels,sync:scope==='selected'&&channels[0]?channels[0].sync:{status:complete?'complete':'partial',synced_at:coverage.last_synced_at||null}};
}

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx,{includeCourseOwner:false});
  if(auth.error)return json({error:'กรุณาเข้าสู่ระบบ'},401,headers);
  if(auth.user.role!=='boss')return json({error:'เฉพาะ Boss เท่านั้นที่ดูค่าคอมทดสอบได้'},403,headers);
  const url=new URL(ctx.request.url),scope=clean(url.searchParams.get('scope'),12)||'selected';
  if(!['selected','all'].includes(scope))return json({error:'ขอบเขตช่องไม่ถูกต้อง'},400,headers);
  let range;try{range=partnerCommissionRange(url)}catch{return json({error:'เลือกช่วงวันที่ซิงก์ได้ย้อนหลังไม่เกิน 90 วันและไม่เกินเมื่อวาน'},400,headers)}
  const channelId=clean(url.searchParams.get('channel_id'),80);
  if(scope==='selected'&&!channelId)return json({error:'กรุณาเลือกช่อง'},400,headers);
  const discovered=await discoverPartnerCommissionConnections(ctx.env,auth.user.id,scope,channelId,range),connections=discovered.rows;
  if(scope==='all'&&connections.length>MAX_CHANNELS)return json({error:'มีช่องที่เชื่อมมากกว่า 24 ช่อง กรุณาใช้ขอบเขตช่องที่เลือก',code:'CHANNEL_SCOPE_TOO_LARGE'},409,headers);
  if(scope==='selected'&&!connections.length)return json({error:'ไม่พบช่อง TikTok Shop ที่เชื่อมและเป็นของ Boss'},404,headers);
  const aggregated=await aggregatePartnerCommissions(ctx.env,connections,range),result=buildPartnerCommissionResult(connections,aggregated.rows,scope,range);
  const source={kind:'tiktok_partner_api_order_sync',endpoint:'POST /affiliate_creator/202410/orders/search',scope:ORDER_SCOPE};
  return json({ok:true,...result,source},200,headers);
}
