import {currentUser,json} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
import {visitorKeyFromRequest} from '../_analytics.js';
import {applyPromotion,loadPromotion} from '../_promotion.js';

const familyFromTitle=title=>String(title||'').replace(/\s*(?:ชุด\s*ที่|ชุด|set)\s*[-:#]?\s*\d+\s*$/iu,'').trim()||String(title||'').trim();
const seriesFromTitle=title=>{const m=String(title||'').match(/(?:ชุด\s*ที่|ชุด|set)\s*[-:#]?\s*(\d+)\s*$/iu);return m?Number(m[1]):1};
const identityExpr="COALESCE(CAST(user_id AS TEXT),visitor_key)";

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const user=await currentUser(ctx),visitorKey=await visitorKeyFromRequest(ctx.request);
  if(!user?.id&&!visitorKey)return json({items:[],interest:[]});
  const where=user?.id?'user_id=?':'visitor_key=?',identity=user?.id?user.id:visitorKey;
  const {results:signals=[]}=await ctx.env.DB.prepare(`SELECT p.id,p.title,p.category,p.family_key,p.series_no,
    SUM(CASE e.event_type WHEN 'product_view' THEN 1 WHEN 'add_to_cart' THEN 4 WHEN 'checkout_start' THEN 6 ELSE 0 END) score,
    MAX(e.created_at) last_interest
    FROM customer_events e JOIN products p ON p.id=e.product_id
    WHERE e.${where} AND e.created_at>=datetime('now','-30 days') AND e.event_type IN ('product_view','add_to_cart','checkout_start')
    AND p.deleted_at IS NULL AND p.status='published' AND COALESCE(p.product_kind,'product')='product'
    GROUP BY p.id ORDER BY score DESC,last_interest DESC LIMIT 30`).bind(identity).all();
  const familyScores=new Map();
  for(const s of signals){const family=s.family_key||familyFromTitle(s.title),key=family.toLocaleLowerCase('th-TH'),old=familyScores.get(key)||{family,category:s.category,score:0,last_interest:''};old.score+=Number(s.score)||0;if(String(s.last_interest)>old.last_interest)old.last_interest=s.last_interest;familyScores.set(key,old)}
  const interest=[...familyScores.values()].sort((a,b)=>b.score-a.score||String(b.last_interest).localeCompare(String(a.last_interest))).slice(0,5);
  if(!interest.length)return json({items:[],interest:[]});
  const owned=user?.id?(await ctx.env.DB.prepare('SELECT DISTINCT product_id FROM entitlements WHERE user_id=? AND active=1').bind(user.id).all()).results.map(x=>Number(x.product_id)):[];
  const {results:catalog=[]}=await ctx.env.DB.prepare(`SELECT id,slug,title,short_description,price,cover_url,category,family_key,series_no,inventory_origin
    FROM products WHERE status='published' AND deleted_at IS NULL AND COALESCE(product_kind,'product')='product' AND category NOT IN ('resale-rights','online-course') ORDER BY id DESC LIMIT 500`).all();
  const seen=new Set(signals.map(x=>Number(x.id))),ownedSet=new Set(owned),ranked=[];
  for(const p of catalog){if(seen.has(Number(p.id))||ownedSet.has(Number(p.id)))continue;const family=p.family_key||familyFromTitle(p.title),series=Number(p.series_no)||seriesFromTitle(p.title);let score=0,reason='';for(const i of interest){if(family.toLocaleLowerCase('th-TH')===i.family.toLocaleLowerCase('th-TH')){score=Math.max(score,1000+i.score*10+series);reason=`เพราะคุณสนใจ ${i.family}`}else if(p.category===i.category&&score<500+i.score){score=500+i.score;reason=`สินค้าใกล้เคียงในหมวดที่คุณสนใจ`}}if(score)ranked.push({...p,family,series,reason,_score:score})}
  ranked.sort((a,b)=>b._score-a._score||b.series-a.series||b.id-a.id);
  const promotion=await loadPromotion(ctx.env),items=applyPromotion(ranked.slice(0,6),promotion).map(({_score,...x})=>x);
  return json({items,interest:interest.map(x=>({family:x.family,category:x.category,score:x.score}))});
}
