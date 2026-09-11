import {activeTikTokShopToken,tikTokShopRequest,prepareTikTokOrderWrite} from './_tiktok_shop_api.js';

export const ORDER_SCOPE='creator.affiliate_collaboration.read';
export const canReadOrders=connection=>String(connection?.scopes||'').split(',').map(x=>x.trim()).includes(ORDER_SCOPE);
export const ORDER_SCHEMA=`CREATE TABLE IF NOT EXISTS tiktok_shop_order_coverage (
 connection_id TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'never', page_token TEXT NOT NULL DEFAULT '',
 request_id TEXT NOT NULL DEFAULT '', lease_id TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0,
 pages INTEGER NOT NULL DEFAULT 0, synced_at TEXT, error_code TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(connection_id,date_from,date_to))`;
const key=(connection,range)=>[connection.id,range.from,range.to];
export async function orderCoverage(env,connection,range){
 if(!connection)return {status:'unavailable',can_read_orders:false};
 if(!canReadOrders(connection))return {status:'missing_scope',can_read_orders:false};
 let row;try{row=await env.DB.prepare('SELECT status,synced_at,error_code,lease_until,pages FROM tiktok_shop_order_coverage WHERE connection_id=? AND date_from=? AND date_to=?').bind(...key(connection,range)).first()}catch{return {status:'unavailable',can_read_orders:false,error_code:'coverage_unavailable'}}
 return {status:row?.status==='running'&&row.lease_until<=Date.now()?'failed':row?.status||'never',revision:row?.pages||0,can_read_orders:true,synced_at:row?.synced_at||null,error_code:row?.error_code||'',busy:row?.status==='running'&&row.lease_until>Date.now()};
}
export function validateOrderRange(range,now=Date.now()){
 const today=new Date(now+25200000).toISOString().slice(0,10),oldest=Math.floor(Date.parse(`${today}T00:00:00+07:00`)/1000)-90*86400;
 if(!Number.isFinite(range.fromEpoch)||!Number.isFinite(range.toExclusive))return false;
 return /^\d{4}-\d{2}-\d{2}$/.test(range.from)&&/^\d{4}-\d{2}-\d{2}$/.test(range.to)&&new Date((range.fromEpoch+25200)*1000).toISOString().slice(0,10)===range.from&&new Date((range.toExclusive-86400+25200)*1000).toISOString().slice(0,10)===range.to&&range.fromEpoch>=oldest&&range.toExclusive<=Math.floor(now/1000)&&range.toExclusive>range.fromEpoch&&range.toExclusive-range.fromEpoch<=90*86400;
}
// One explicit action acquires at most 24 provider orders. The opaque provider cursor stays server-side.
export async function syncOrderPage(env,connection,range,requestId,{fetchImpl=fetch,clock=Date.now,stillAuthorized=async()=>true,expectedRevision}={}){
 const now=clock();
 if(!canReadOrders(connection))return {status:'missing_scope'};
 if(!validateOrderRange(range,now))return {status:'invalid_range'};
 if(!/^[a-f0-9-]{36}$/i.test(requestId||''))return {status:'invalid_request'};
 const keys=key(connection,range),db=env.DB;
 await db.prepare('INSERT OR IGNORE INTO tiktok_shop_order_coverage(connection_id,date_from,date_to) VALUES(?,?,?)').bind(...keys).run();
 const prior=await db.prepare('SELECT * FROM tiktok_shop_order_coverage WHERE connection_id=? AND date_from=? AND date_to=?').bind(...keys).first();
 if(prior.request_id===requestId)return orderCoverage(env,connection,range);
 if(!Number.isInteger(expectedRevision)||expectedRevision!==prior.pages)return orderCoverage(env,connection,range);
 const lease=crypto.randomUUID();
 const acquired=await db.prepare(`UPDATE tiktok_shop_order_coverage SET status='running',lease_id=?,lease_until=?,request_id=?,error_code='',page_token=CASE WHEN status='complete' THEN '' ELSE page_token END,pages=pages+1 WHERE connection_id=? AND date_from=? AND date_to=? AND request_id=? AND (status<>'running' OR lease_until<?)`).bind(lease,now+90000,requestId,...keys,prior.request_id,now).run();
 if(!acquired.meta?.changes)return {status:'running',busy:true};
 const cursor=prior.status==='complete'?'':prior.page_token;
 try{
  const {config,access}=await activeTikTokShopToken(env,connection,fetchImpl);
  const live=await db.prepare("SELECT scopes FROM tiktok_shop_creator_connections WHERE id=? AND user_id=? AND channel_id=? AND status='active'").bind(connection.id,connection.user_id,connection.channel_id).first();
  if(!canReadOrders(live)||!await stillAuthorized())throw new Error('ORDER_ACCESS_CHANGED');
  const data=await tikTokShopRequest(config,access,{path:'/affiliate_creator/202410/orders/search',method:'POST',query:{page_size:'24',...(cursor?{page_token:cursor}:{})},body:{create_time_ge:range.fromEpoch,create_time_lt:range.toExclusive}},fetchImpl);
  if(!Array.isArray(data.orders)||data.orders.length>24)throw new Error('INVALID_ORDER_PAGE');
  const next=String(data.next_page_token||'');
  if(next.length>4000||(next&&next===cursor))throw new Error('INVALID_ORDER_CURSOR');
  const writes=data.orders.map(order=>{
   const id=String(order.order_id||order.id||''),created=Number(order.create_time);
   if(!id||id.length>100||!Number.isFinite(created)||created<range.fromEpoch||created>=range.toExclusive)throw new Error('INVALID_ORDER_PAGE');
   return prepareTikTokOrderWrite(env,connection.id,order);
  });
  if(!await stillAuthorized())throw new Error('ORDER_ACCESS_CHANGED');
  // NOT NULL assertion is in the same atomic D1 batch as every order and completion checkpoint.
  const guard=db.prepare(`INSERT INTO tiktok_shop_order_coverage(connection_id,date_from,date_to,status) VALUES(?,?,?,(SELECT CASE WHEN lease_id=? AND lease_until>? AND EXISTS(SELECT 1 FROM tiktok_shop_creator_connections WHERE id=? AND user_id=? AND channel_id=? AND status='active' AND scopes=?) THEN 'running' ELSE NULL END FROM tiktok_shop_order_coverage WHERE connection_id=? AND date_from=? AND date_to=?)) ON CONFLICT(connection_id,date_from,date_to) DO UPDATE SET status=excluded.status`).bind(...keys,lease,clock(),connection.id,connection.user_id,connection.channel_id,live.scopes,...keys);
  await db.batch([guard,...writes,db.prepare(`UPDATE tiktok_shop_order_coverage SET status=?,page_token=?,synced_at=CURRENT_TIMESTAMP,lease_until=0,error_code='' WHERE connection_id=? AND date_from=? AND date_to=? AND lease_id=?`).bind(next?'partial':'complete',next,...keys,lease)]);
  return orderCoverage(env,connection,range);
 }catch(error){
  await db.prepare("UPDATE tiktok_shop_order_coverage SET status='failed',error_code='provider_or_write_failed',lease_until=0 WHERE connection_id=? AND date_from=? AND date_to=? AND lease_id=?").bind(...keys,lease).run();
  return {status:'failed',can_read_orders:true,error_code:'provider_or_write_failed'};
 }
}
