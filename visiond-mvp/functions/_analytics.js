import {claimMaintenanceLease,releaseMaintenanceLease} from './_maintenance.js';
import {purgeExpiredTrash} from './_trash.js';

const RAW_RETENTION_DAYS=90;
const BATCH_SIZE=500;
const MAX_BATCHES=2;
const DEADLINE_MS=5000;

const number=value=>Number(value)||0;

export async function recordPageView(env,{path,productId,visitorKey}){
  const product=Number(productId)||0;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO analytics_daily(day_local,path,product_id,views) VALUES(date('now','+7 hours'),?,?,1) ON CONFLICT(day_local,path,product_id) DO UPDATE SET views=views+1").bind(path,product),
    env.DB.prepare("INSERT INTO analytics_visitors(visitor_key,first_seen_at,last_seen_at) VALUES(?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(visitor_key) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP").bind(visitorKey)
  ]);
}

export async function analyticsStats(env,productId=0){
  const product=Number(productId)||0;
  const productFilter=product?' AND product_id=?':'';
  const bind=statement=>product?statement.bind(product):statement;
  const [aggregate,legacy,unique]=await Promise.all([
    bind(env.DB.prepare(`SELECT COALESCE(SUM(views),0) total,
      COALESCE(SUM(CASE WHEN day_local=date('now','+7 hours') THEN views ELSE 0 END),0) today,
      COALESCE(SUM(CASE WHEN day_local>=date('now','+7 hours','-6 days') THEN views ELSE 0 END),0) last7,
      COALESCE(SUM(CASE WHEN day_local>=date('now','+7 hours','-29 days') THEN views ELSE 0 END),0) last30
      FROM analytics_daily WHERE 1=1${productFilter}`)).first(),
    bind(env.DB.prepare(`SELECT COUNT(*) total,
      COALESCE(SUM(CASE WHEN date(viewed_at,'+7 hours')=date('now','+7 hours') THEN 1 ELSE 0 END),0) today,
      COALESCE(SUM(CASE WHEN date(viewed_at,'+7 hours')>=date('now','+7 hours','-6 days') THEN 1 ELSE 0 END),0) last7,
      COALESCE(SUM(CASE WHEN date(viewed_at,'+7 hours')>=date('now','+7 hours','-29 days') THEN 1 ELSE 0 END),0) last30
      FROM page_views WHERE aggregated_at IS NULL${productFilter}`)).first(),
    product?null:env.DB.prepare("SELECT unique_visitors count FROM analytics_summary WHERE summary_key='site'").first()
  ]);
  return {
    total:number(aggregate?.total)+number(legacy?.total),
    today:number(aggregate?.today)+number(legacy?.today),
    last7:number(aggregate?.last7)+number(legacy?.last7),
    last30:number(aggregate?.last30)+number(legacy?.last30),
    unique:number(unique?.count)
  };
}

export async function topViewedProducts(env,limit=10){
  const safeLimit=Math.min(50,Math.max(1,Number(limit)||10));
  const {results}=await env.DB.prepare(`SELECT p.id,p.slug,p.title,
    COALESCE(a.views,0)+COALESCE(r.views,0) views
    FROM products p
    LEFT JOIN (SELECT product_id,SUM(views) views FROM analytics_daily WHERE product_id>0 GROUP BY product_id) a ON a.product_id=p.id
    LEFT JOIN (SELECT product_id,COUNT(*) views FROM page_views WHERE aggregated_at IS NULL AND product_id IS NOT NULL GROUP BY product_id) r ON r.product_id=p.id
    WHERE p.deleted_at IS NULL AND COALESCE(a.views,0)+COALESCE(r.views,0)>0
    ORDER BY views DESC,p.id DESC LIMIT ?`).bind(safeLimit).all();
  return results||[];
}

// One bounded pass per invocation: aggregate legacy rows first, then remove only
// already-aggregated raw rows older than 90 days. Safe for a daily cron retry.
export async function maintainAnalyticsRetention(env,{batchSize=BATCH_SIZE,maxBatches=MAX_BATCHES,deadlineMs=DEADLINE_MS,now=Date.now}={}){
  batchSize=Math.max(1,Math.min(BATCH_SIZE,Number(batchSize)||BATCH_SIZE));maxBatches=Math.max(1,Math.min(MAX_BATCHES,Number(maxBatches)||MAX_BATCHES));
  deadlineMs=Math.max(100,Math.min(DEADLINE_MS,Number(deadlineMs)||DEADLINE_MS));const startedAt=Number(now());
  let backfilled=0,removed=0,customerEventsRemoved=0,deadlineReached=false;
  for(let batch=0;batch<maxBatches;batch++){
    const pending=await env.DB.prepare(`SELECT COALESCE(MAX(id),0) max_id,COUNT(*) count FROM
      (SELECT id FROM page_views WHERE aggregated_at IS NULL ORDER BY id LIMIT ?)`).bind(batchSize).first(),maxId=number(pending?.max_id),count=number(pending?.count);
    if(maxId){
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO analytics_daily(day_local,path,product_id,views)
          SELECT date(viewed_at,'+7 hours'),path,COALESCE(product_id,0),COUNT(*) FROM page_views
          WHERE aggregated_at IS NULL AND id<=? GROUP BY date(viewed_at,'+7 hours'),path,COALESCE(product_id,0)
          ON CONFLICT(day_local,path,product_id) DO UPDATE SET views=views+excluded.views`).bind(maxId),
        env.DB.prepare(`INSERT INTO analytics_visitors(visitor_key,first_seen_at,last_seen_at)
          SELECT visitor_key,MIN(viewed_at),MAX(viewed_at) FROM page_views WHERE aggregated_at IS NULL AND id<=? GROUP BY visitor_key
          ON CONFLICT(visitor_key) DO UPDATE SET first_seen_at=MIN(first_seen_at,excluded.first_seen_at),last_seen_at=MAX(last_seen_at,excluded.last_seen_at)`).bind(maxId),
        env.DB.prepare('UPDATE page_views SET aggregated_at=CURRENT_TIMESTAMP WHERE aggregated_at IS NULL AND id<=?').bind(maxId)
      ]);backfilled+=count;
    }
    const oldViews=await env.DB.prepare(`DELETE FROM page_views WHERE id IN
      (SELECT id FROM page_views WHERE aggregated_at IS NOT NULL AND viewed_at<datetime('now',?) ORDER BY viewed_at,id LIMIT ?)`).bind(`-${RAW_RETENTION_DAYS} days`,batchSize).run();
    const oldEvents=await env.DB.prepare(`DELETE FROM customer_events WHERE id IN (SELECT id FROM customer_events WHERE created_at<datetime('now',?) ORDER BY created_at,id LIMIT ?)` ).bind(`-${RAW_RETENTION_DAYS} days`,batchSize).run();
    removed+=number(oldViews?.meta?.changes);customerEventsRemoved+=number(oldEvents?.meta?.changes);
    if(count<batchSize&&number(oldViews?.meta?.changes)<batchSize&&number(oldEvents?.meta?.changes)<batchSize)break;
    if(Number(now())-startedAt>=deadlineMs){deadlineReached=true;break}
  }
  const [pending,oldViews,oldEvents]=await Promise.all([
    env.DB.prepare('SELECT 1 FROM page_views WHERE aggregated_at IS NULL LIMIT 1').first(),
    env.DB.prepare("SELECT 1 FROM page_views WHERE aggregated_at IS NOT NULL AND viewed_at<datetime('now',?) LIMIT 1").bind(`-${RAW_RETENTION_DAYS} days`).first(),
    env.DB.prepare("SELECT 1 FROM customer_events WHERE created_at<datetime('now',?) LIMIT 1").bind(`-${RAW_RETENTION_DAYS} days`).first()
  ]);
  return {retention_days:RAW_RETENTION_DAYS,backfilled,removed,customer_events_removed:customerEventsRemoved,deadline_reached:deadlineReached,has_more:Boolean(pending||oldViews||oldEvents)};
}

export async function runAnalyticsMaintenance(env,options={}){
  const leaseOptions={...options,minIntervalMs:options.minIntervalMs??5*60*1000},lease=await claimMaintenanceLease(env.DB,'analytics-retention',leaseOptions);if(!lease)return {busy:true,has_more:true};
  let completed=false;
  try{const retention=await maintainAnalyticsRetention(env,options),trash=await purgeExpiredTrash(env,options);completed=true;return {...retention,trash,has_more:Boolean(retention.has_more||trash.has_more)}}
  finally{await releaseMaintenanceLease(env.DB,'analytics-retention',lease,{...leaseOptions,completed})}
}


export const VISITOR_COOKIE='__Host-vd_vid';
export async function visitorKeyFromRequest(request){
  const cookieHeader=request.headers.get('cookie')||'';
  const match=cookieHeader.match(/(?:^|;\s*)__Host-vd_vid=([^;]+)/);
  const raw=match?decodeURIComponent(match[1]):'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw))return null;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${raw}|visiond-view-v2`));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function claimVisitorHistory(env,request,userId){
  const visitorKey=await visitorKeyFromRequest(request);
  if(!visitorKey||!Number(userId))return {visitor_key:null,claimed:0};
  const result=await env.DB.prepare("UPDATE customer_events SET user_id=? WHERE visitor_key=? AND user_id IS NULL").bind(Number(userId),visitorKey).run();
  return {visitor_key:visitorKey,claimed:Number(result?.meta?.changes)||0};
}
