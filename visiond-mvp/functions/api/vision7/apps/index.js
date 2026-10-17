import {json} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {ensureVision7Schema} from '../../../_vision7_schema.js';

// Keep this expression identical to migration 0139 so SQLite can use its indexed keyset.
export const catalogGroupSql="CASE WHEN p.platform_type IN ('windows','mac') THEN 'desktop' WHEN p.platform_type='web' THEN 'web' WHEN p.platform_type IN ('android','veasy') THEN 'mobile' ELSE 'other' END";
const offersSql=`(SELECT json_group_array(json_object('id',q.id,'code',q.plan_code,'name',q.name,'duration_days',q.duration_days,'price',q.offer_price,'product_id',q.product_id,'product_slug',x.slug)) FROM vision7_plans q JOIN products x ON x.id=q.product_id WHERE q.program_id=p.id AND q.active=1 AND q.plan_code IN ('monthly','yearly','lifetime') AND q.offer_price>0 AND x.status='published' AND x.product_kind='vision7-key') offers`;
const released="EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.status='published')";
const integer=value=>/^\d{1,12}$/.test(String(value||''))?Number(value):null;
const cursorEncode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function cursorDecode(value){try{if(!/^[A-Za-z0-9_-]{1,800}$/.test(value))return null;const json=new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0)));return JSON.parse(json)}catch{return null}}

export function catalogPageQuery({category='all',q='',cursorId=null,cursorName='',limit=24}={}){
  const args=[],where=['p.active=1'],shortSearch=Boolean(q)&&[...q].length<3,fullSearch=Boolean(q)&&!shortSearch;
  if(category!=='all'){where.push(`${catalogGroupSql}=?`);args.push(category)}
  if(shortSearch){
    where.push('p.app_name COLLATE NOCASE>=?','p.app_name COLLATE NOCASE<?');args.push(q,`${q}\uffff`);
    if(cursorId!==null){where.push('(p.app_name COLLATE NOCASE>? OR (p.app_name COLLATE NOCASE=? AND p.id<?))');args.push(cursorName,cursorName,cursorId)}
  }else if(fullSearch){
    where.push('p.id IN (SELECT rowid FROM vision7_program_search WHERE vision7_program_search MATCH ?)');args.push(`"${q.replaceAll('"','""')}"`);
    if(cursorId!==null){where.push('p.id<?');args.push(cursorId)}
  }else if(cursorId!==null){where.push('p.id<?');args.push(cursorId)}
  where.push(released);
  const sql=`SELECT p.id,p.code,p.app_name name,p.app_description description,p.cover_url,p.platform_type,p.current_version,${offersSql} FROM vision7_programs p WHERE ${where.join(' AND ')} ORDER BY ${shortSearch?'p.app_name COLLATE NOCASE ASC,p.id DESC':'p.id DESC'} LIMIT ?`;
  args.push(limit+1);return{sql,args};
}

export async function onRequestGet(ctx){
  const params=new URL(ctx.request.url).searchParams,category=params.get('category')||'all',q=(params.get('q')||'').trim().replace(/\s+/gu,' '),limit=params.has('limit')?integer(params.get('limit')):24,cursor=params.has('cursor')?cursorDecode(params.get('cursor')):null,cursorId=cursor?.id??null,cursorName=cursor?.name||'';
  if(!['all','desktop','web','mobile','other'].includes(category)||q.length>80||/[\u0000-\u001f\u007f]/u.test(q)||!limit||limit>24||(params.has('cursor')&&(!cursor||cursor.category!==category||cursor.q!==q||!integer(cursorId)||Boolean(q)&&[...q].length<3&&(!cursorName||cursorName.length>200))))return json({error:'ตัวกรองรายการไม่ถูกต้อง'},400,{'cache-control':'no-store'});
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);
  const {sql,args}=catalogPageQuery({category,q,cursorId,cursorName,limit}),rows=await ctx.env.DB.prepare(sql).bind(...args).all(),results=rows.results||[],items=results.slice(0,limit),last=items.at(-1),hasMore=results.length>limit;
  const other=cursorId===null?await ctx.env.DB.prepare(`SELECT 1 found FROM vision7_programs p WHERE p.active=1 AND ${catalogGroupSql}='other' AND ${released} LIMIT 1`).first():null;
  return json({items,has_more:hasMore,next_cursor:hasMore?cursorEncode({category,q,id:last.id,...(q&&[...q].length<3?{name:last.name||''}:{})}):null,has_other:cursorId===null?Boolean(other):undefined,search_note:q&&[...q].length<3?'คำค้นหา 1–2 ตัวอักษรค้นเฉพาะต้นชื่อเครื่องมือ':null},200,{'cache-control':'public, max-age=30'});
}
