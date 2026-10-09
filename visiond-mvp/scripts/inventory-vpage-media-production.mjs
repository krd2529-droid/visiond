import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const configuration=readFileSync(new URL('../services/vpage/wrangler.toml',import.meta.url),'utf8');
const databaseId=configuration.match(/database_id\s*=\s*"([0-9a-f-]{36})"/)?.[1];
if(!databaseId)throw new Error('Vpage D1 configuration is missing');
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=accountId&&/^[0-9a-f]{32}$/.test(accountId)?`https://api.cloudflare.com/client/v4/accounts/${accountId}`:null;

export const slotCountsSql=`WITH slots AS (
 SELECT p.status page_status,c.set_no,'hero' slot,c.product_image_url value FROM vpage_content_sets c JOIN vpage_pages p ON p.id=c.page_id
 UNION ALL SELECT p.status,c.set_no,'background',c.background_image_url FROM vpage_content_sets c JOIN vpage_pages p ON p.id=c.page_id
 UNION ALL SELECT p.status,i.set_no,'product',i.image_url FROM vpage_product_items i JOIN vpage_pages p ON p.id=i.page_id
 UNION ALL SELECT p.status,i.set_no,'contact',i.image_url FROM vpage_contact_items i JOIN vpage_pages p ON p.id=i.page_id
) SELECT page_status,set_no,slot,CASE
 WHEN trim(value)='' THEN 'empty'
 WHEN value GLOB 'https://smartlinkpage.com/media/vpm_*' THEN 'vpage_owned'
 WHEN value LIKE 'https://visiondonline.com/api/vpage/media/%' OR value LIKE 'https://www.visiondonline.com/api/vpage/media/%' THEN 'visiond_media'
 WHEN value LIKE 'https://%' THEN 'external_https'
 ELSE 'other_or_invalid' END source_type,COUNT(*) count
FROM slots GROUP BY page_status,set_no,slot,source_type ORDER BY page_status,set_no,slot,source_type`;

export function summarizeInventory({tables,pages,missingSets,slots,media,bucketExists}){
  const allowed=new Set(['vpage_pages','vpage_content_sets','vpage_product_items','vpage_contact_items','vpage_media','vpage_media_refs']);
  if(tables.some(row=>!allowed.has(row.name)))throw new Error('Unexpected schema inventory result');
  const safeCount=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{if(key==='count'){const count=Number(value);if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid aggregate count');return[key,count]}const label=String(value);if(!/^[a-z0-9_:-]{1,40}$/.test(label))throw new Error('Unsafe inventory label');return[key,label]})));
  if([...pages,...missingSets,...slots,...media].some(row=>Object.keys(row).some(key=>!['status','page_status','set_no','slot','source_type','count','state'].includes(key))))throw new Error('Inventory attempted to expose non-aggregate data');
  return{schema_tables:tables.map(row=>row.name).sort(),bucket_exists:Boolean(bucketExists),pages_by_status:safeCount(pages),pages_without_content_sets:safeCount(missingSets),image_slots_by_type:safeCount(slots),media_rows_by_state:safeCount(media)};
}

export const inventoryFailure=(path,status,kind='HTTP')=>{const stage=path.startsWith('/d1/')?'D1':path.startsWith('/r2/')?'R2':'unknown',code=Number.isInteger(status)&&status>=100&&status<=599?status:'unknown';return`Isolated Vpage ${stage} read-only ${kind} failure (HTTP ${code})`};
async function cloudflare(path,options={}){let response;try{response=await fetch(endpoint+path,{...options,headers:{authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(20000)})}catch{throw new Error(inventoryFailure(path,null,'transport'))}if(!response.ok)throw new Error(inventoryFailure(path,response.status));const body=await response.json().catch(()=>null);if(!body?.success)throw new Error(inventoryFailure(path,response.status,'API'));return body}
async function d1(sql){if(!/^\s*(?:SELECT|WITH)\b/i.test(sql)||/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA)\b/i.test(sql))throw new Error('Inventory only permits SELECT');const body=await cloudflare(`/d1/database/${databaseId}/query`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql})});const result=body.result?.[0];if(!result?.success||!Array.isArray(result.results))throw new Error('Isolated Vpage D1 read-only query failed');return result.results}
async function bucketExists(){let cursor='';for(let page=0;page<10;page++){const query=new URLSearchParams({name_contains:'visiond-vpage-media',per_page:'1000'});if(cursor)query.set('cursor',cursor);const body=await cloudflare(`/r2/buckets?${query}`),buckets=body.result?.buckets;if(!Array.isArray(buckets))throw new Error('R2 bucket inventory response is incomplete');if(buckets.some(bucket=>bucket.name==='visiond-vpage-media'))return true;if(!body.result_info||typeof body.result_info!=='object')throw new Error('R2 bucket pagination metadata is missing');const next=body.result_info.cursor;if(next===undefined||next===null||next==='')return false;if(typeof next!=='string')throw new Error('R2 bucket cursor is invalid');cursor=next}throw new Error('R2 bucket inventory exceeded page limit')}
export async function inventory(){if(!endpoint||!token)throw new Error('Isolated Vpage account read-only credentials are missing');const tables=await d1("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vpage_pages','vpage_content_sets','vpage_product_items','vpage_contact_items','vpage_media','vpage_media_refs') ORDER BY name");const names=new Set(tables.map(row=>row.name));if(!['vpage_pages','vpage_content_sets','vpage_product_items','vpage_contact_items'].every(name=>names.has(name)))throw new Error('Vpage content schema is incomplete');const pages=await d1('SELECT status,COUNT(*) count FROM vpage_pages GROUP BY status ORDER BY status');const missingSets=await d1('SELECT p.status,COUNT(*) count FROM vpage_pages p WHERE NOT EXISTS(SELECT 1 FROM vpage_content_sets c WHERE c.page_id=p.id) GROUP BY p.status ORDER BY p.status');const slots=await d1(slotCountsSql);const media=names.has('vpage_media')?await d1('SELECT state,COUNT(*) count FROM vpage_media GROUP BY state ORDER BY state'):[];return summarizeInventory({tables,pages,missingSets,slots,media,bucketExists:await bucketExists()})}
if(process.argv[1]===fileURLToPath(import.meta.url))inventory().then(report=>console.log(JSON.stringify(report))).catch(error=>{console.error(error.message);process.exitCode=1});
