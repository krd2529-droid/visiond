const RAW_RETENTION_DAYS=90;
const BATCH_SIZE=5000;

const number=value=>Number(value)||0;

export async function recordPageView(env,{path,productId,visitorKey}){
  const product=Number(productId)||0;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO page_views(path,product_id,visitor_key,aggregated_at) VALUES(?,NULLIF(?,0),?,CURRENT_TIMESTAMP)").bind(path,product,visitorKey),
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
    product?null:env.DB.prepare("SELECT COUNT(*) count FROM (SELECT visitor_key FROM analytics_visitors UNION SELECT visitor_key FROM page_views WHERE aggregated_at IS NULL)").first()
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
export async function maintainAnalyticsRetention(env){
  const pending=await env.DB.prepare(`SELECT COALESCE(MAX(id),0) max_id,COUNT(*) count FROM
    (SELECT id FROM page_views WHERE aggregated_at IS NULL ORDER BY id LIMIT ?)`).bind(BATCH_SIZE).first();
  const maxId=number(pending?.max_id),backfilled=number(pending?.count);
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
    ]);
  }
  const removed=await env.DB.prepare(`DELETE FROM page_views WHERE id IN
    (SELECT id FROM page_views WHERE aggregated_at IS NOT NULL AND viewed_at<datetime('now',?) ORDER BY id LIMIT ?)`)
    .bind(`-${RAW_RETENTION_DAYS} days`,BATCH_SIZE).run();
  return {retention_days:RAW_RETENTION_DAYS,backfilled,removed:number(removed?.meta?.changes),more_backfill:backfilled===BATCH_SIZE};
}
