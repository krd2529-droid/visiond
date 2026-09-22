import {json,requireAdmin} from './_lib.js';
import {validateToyImageBuffer} from './_toys_center.js';

export const LIVE_PACKAGE_FORMAT='visiond.live-package';
export const LIVE_PACKAGE_SCHEMA_VERSION=1;
export const LIVE_MAX_SCENES=24;
export const LIVE_MAX_CONTAINER_BYTES=32*1024*1024;
export const LIVE_PRIVATE_HEADERS={'cache-control':'private, no-store'};

const AVATAR_PRESETS=new Set(['visiond-default','presenter-placeholder','none']);
const OUTPUT_PROFILES=new Set(['landscape-1080p','portrait-1080p','square-1080p']);
const TRANSITIONS=new Set(['cut','fade']);
const FORBIDDEN_KEY=/(?:^|_)(?:password|passcode|cookie|authorization|access_?token|refresh_?token|stream_?key|client_?secret|api_?key|session)(?:$|_)/i;
const SECRET_ASSIGNMENT=/(?:password|passcode|cookie|authorization|access[\s_-]*token|refresh[\s_-]*token|stream[\s_-]*key|client[\s_-]*secret|api[\s_-]*key)\s*["']?\s*[:=]\s*["']?[^\s"',;]{4,}/i;
const BEARER_SECRET=/\bbearer\s+[a-z0-9._~+\/-]{12,}/i;
const IDENTIFIER=/^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const SHOW_ID=/^live_[a-f0-9]{32}$/;
const VERSION_ID=/^livev_[a-f0-9]{32}$/;
const encoder=new TextEncoder();
const LIVE_CONTAINER_MAGIC=encoder.encode('VISIONDLIVE/1\n');
const LIVE_MAX_ENVELOPE_BYTES=1024*1024;

class LiveInputError extends Error{
  constructor(message,status=400,code='LIVE_INPUT_INVALID'){super(message);this.status=status;this.code=code}
}

const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const cleanLine=(value,max)=>{
  if(typeof value!=='string')throw new LiveInputError('ข้อมูลข้อความไม่ถูกต้อง');
  const output=value.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  if(!output||output.length>max)throw new LiveInputError('ข้อมูลข้อความยาวหรือสั้นเกินกำหนด');
  return output;
};
const cleanOptional=(value,max)=>{
  if(value===undefined||value===null||value==='')return'';
  if(typeof value!=='string')throw new LiveInputError('ข้อมูลข้อความไม่ถูกต้อง');
  const output=value.normalize('NFKC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  if(output.length>max)throw new LiveInputError('ข้อมูลข้อความยาวเกินกำหนด');
  return output;
};
const positiveInt=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const exactKeys=(value,allowed,path)=>{
  if(!isObject(value))throw new LiveInputError(`${path} ต้องเป็น object`);
  for(const key of Object.keys(value))if(!allowed.has(key))throw new LiveInputError(`${path}.${key} ไม่ใช่ฟิลด์ที่รองรับ`);
};
const scanSecrets=(value,path='request')=>{
  if(Array.isArray(value)){value.forEach((item,index)=>scanSecrets(item,`${path}[${index}]`));return}
  if(isObject(value)){for(const [key,child] of Object.entries(value)){if(FORBIDDEN_KEY.test(key))throw new LiveInputError(`ไม่รับข้อมูลลับใน ${path}.${key}`,400,'LIVE_SECRET_REJECTED');scanSecrets(child,`${path}.${key}`)}return}
  if(typeof value==='string'&&(SECRET_ASSIGNMENT.test(value)||BEARER_SECRET.test(value)))throw new LiveInputError(`ไม่รับข้อมูลลับใน ${path}`,400,'LIVE_SECRET_REJECTED');
};
const scanSecretBytes=(bytes,path='asset')=>{
  let carry='';
  for(let offset=0;offset<bytes.byteLength;offset+=16384){
    const end=Math.min(bytes.byteLength,offset+16384);let text=carry;
    for(let index=offset;index<end;index++){const byte=bytes[index];text+=byte>=32&&byte<=126?String.fromCharCode(byte):' '}
    if(SECRET_ASSIGNMENT.test(text)||BEARER_SECRET.test(text))throw new LiveInputError(`ไม่รับข้อมูลลับใน ${path}`,400,'LIVE_SECRET_REJECTED');
    carry=text.slice(-256);
  }
};
const stable=value=>Array.isArray(value)?value.map(stable):isObject(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const canonicalLiveJson=value=>JSON.stringify(stable(value));
export async function liveSha256(value){const bytes=typeof value==='string'?encoder.encode(value):value instanceof Uint8Array?value:new Uint8Array(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}

const encodeText=value=>{const bytes=encoder.encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const decodeText=value=>{const encoded=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),binary=atob(encoded+'='.repeat((4-encoded.length%4)%4));return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)))};
export const encodeLiveCursor=value=>encodeText(JSON.stringify(value));
export function decodeLiveCursor(value){if(!value)return null;try{return JSON.parse(decodeText(value))}catch{return null}}
export function livePrefixUpperBound(prefix){const points=Array.from(String(prefix));for(let index=points.length-1;index>=0;index--){const point=points[index].codePointAt(0);if(point<0x10ffff)return points.slice(0,index).join('')+String.fromCodePoint(point+1)}return null}

export function privateLiveResponse(response){const headers=new Headers(response.headers);headers.set('cache-control','private, no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
export const liveJson=(data,status=200,headers={})=>json(data,status,{...LIVE_PRIVATE_HEADERS,...headers});
async function liveAdmin(ctx){const auth=await requireAdmin(ctx,{includeCourseOwner:false});return auth.error?{error:privateLiveResponse(auth.error)}:auth}

async function bodyJson(request,max=400000){
  const length=Number(request.headers.get('content-length')||0);if(length>max)throw new LiveInputError('ข้อมูลรายการไลฟ์ใหญ่เกินกำหนด',413,'LIVE_BODY_TOO_LARGE');
  const raw=await request.text();if(raw.length>max)throw new LiveInputError('ข้อมูลรายการไลฟ์ใหญ่เกินกำหนด',413,'LIVE_BODY_TOO_LARGE');
  let body;try{body=JSON.parse(raw)}catch{throw new LiveInputError('JSON ไม่ถูกต้อง')}
  scanSecrets(body);return body;
}
function idempotencyKey(request){const key=String(request.headers.get('idempotency-key')||'').trim();if(!IDENTIFIER.test(key))throw new LiveInputError('ต้องส่ง Idempotency-Key ความยาว 8–128 ตัวอักษร',400,'LIVE_IDEMPOTENCY_REQUIRED');return key}
function parseLimit(params){if(!params.has('limit'))return 24;const value=Number(params.get('limit'));if(!Number.isInteger(value)||value<1)return null;return Math.min(24,value)}
function routeId(value,pattern,label){const id=String(value||'');if(!pattern.test(id))throw new LiveInputError(`${label} ไม่ถูกต้อง`);return id}

function showPayload(body,{updating=false}={}){
  exactKeys(body,new Set(['title','description','avatar_preset','output_profile','scenes',...(updating?['expected_revision']:[])]),'show');
  const title=cleanLine(body.title,160),description=cleanOptional(body.description,2000),avatarPreset=String(body.avatar_preset||'visiond-default'),outputProfile=String(body.output_profile||'landscape-1080p');
  if(!AVATAR_PRESETS.has(avatarPreset))throw new LiveInputError('avatar_preset ไม่ถูกต้อง');
  if(!OUTPUT_PROFILES.has(outputProfile))throw new LiveInputError('output_profile ไม่ถูกต้อง');
  if(!Array.isArray(body.scenes)||body.scenes.length>LIVE_MAX_SCENES)throw new LiveInputError(`ฉากต้องเป็นรายการไม่เกิน ${LIVE_MAX_SCENES} ฉาก`);
  const seen=new Set(),scenes=body.scenes.map((scene,index)=>{
    exactKeys(scene,new Set(['product_id','script','cue']),`show.scenes[${index}]`);
    exactKeys(scene.cue,new Set(['label','duration_seconds','transition']),`show.scenes[${index}].cue`);
    const productId=positiveInt(scene.product_id);if(!productId)throw new LiveInputError(`product_id ฉาก ${index+1} ไม่ถูกต้อง`);
    if(seen.has(productId))throw new LiveInputError('สินค้าเดียวกันใช้ซ้ำในรายการไลฟ์ไม่ได้',409,'LIVE_DUPLICATE_PRODUCT');seen.add(productId);
    const duration=Number(scene.cue.duration_seconds),transition=String(scene.cue.transition||'cut');
    if(!Number.isInteger(duration)||duration<5||duration>3600)throw new LiveInputError(`ระยะเวลาฉาก ${index+1} ต้องอยู่ระหว่าง 5–3600 วินาที`);
    if(!TRANSITIONS.has(transition))throw new LiveInputError(`transition ฉาก ${index+1} ไม่ถูกต้อง`);
    return{product_id:productId,script:cleanOptional(scene.script,12000),cue:{label:cleanOptional(scene.cue.label,120),duration_seconds:duration,transition}};
  });
  const expectedRevision=updating?positiveInt(body.expected_revision):null;if(updating&&!expectedRevision)throw new LiveInputError('expected_revision ไม่ถูกต้อง');
  return{title,description,avatar_preset:avatarPreset,output_profile:outputProfile,scenes,...(updating?{expected_revision:expectedRevision}:{})};
}
function versionPayload(body){exactKeys(body,new Set(['expected_revision']),'version');const expectedRevision=positiveInt(body.expected_revision);if(!expectedRevision)throw new LiveInputError('expected_revision ไม่ถูกต้อง');return{expected_revision:expectedRevision}}

function normalizeToyQuery(value){return String(value||'').trim().normalize('NFKC').toLocaleLowerCase('th-TH').replace(/\s+/g,' ').slice(0,200)}
function productCursor(raw,query){if(!raw)return null;const value=decodeLiveCursor(raw);if(!Array.isArray(value)||value[0]!==query)return null;if(query){return typeof value[1]==='string'&&value[1].length<=200&&normalizeToyQuery(value[1]).startsWith(query)&&positiveInt(value[2])?{title:value[1],id:Number(value[2])}:null}return typeof value[1]==='string'&&value[1].length<=40&&positiveInt(value[2])?{at:value[1],id:Number(value[2])}:null}
function showCursor(raw){if(!raw)return null;const value=decodeLiveCursor(raw);return Array.isArray(value)&&value.length===2&&typeof value[0]==='string'&&value[0].length<=40&&SHOW_ID.test(String(value[1]))?{at:value[0],id:String(value[1])}:null}
function versionCursor(raw){if(!raw)return null;const value=decodeLiveCursor(raw);return Array.isArray(value)&&value.length===1&&positiveInt(value[0])?Number(value[0]):null}

async function availableProducts(env,ids){
  if(!ids.length)return new Map();const marks=ids.map(()=>'?').join(',');
  const rows=(await env.DB.prepare(`SELECT id,meta_id,title,price_cents,currency,quantity,image_1_key FROM toys_center_products WHERE id IN (${marks}) AND status='published' AND availability='in stock' AND quantity>0`).bind(...ids).all()).results||[];
  if(rows.length!==ids.length)throw new LiveInputError('มีสินค้าที่ไม่พร้อมขาย ถูกลบ หรือหมดสต็อก กรุณาเลือกใหม่',409,'LIVE_PRODUCT_UNAVAILABLE');
  return new Map(rows.map(row=>[Number(row.id),row]));
}
async function normalizedCoverSources(env,ids,products){
  if(!ids.length)return new Map();const marks=ids.map(()=>'?').join(','),gallery=(await env.DB.prepare(`SELECT id,product_id,position,image_key FROM toys_center_product_images WHERE product_id IN (${marks}) ORDER BY product_id,position`).bind(...ids).all()).results||[],byProduct=new Map(ids.map(id=>[id,[]]));for(const image of gallery)byProduct.get(Number(image.product_id))?.push(image);
  const sources=new Map();for(const id of ids){const product=products.get(id),images=byProduct.get(id)||[],source=images.find(image=>image.image_key===product.image_1_key)||images.find(image=>Number(image.position)===0);if(!source)throw new LiveInputError(`สินค้า ${id} ไม่มีรูปหลักในคลัง`,409,'LIVE_ASSET_MISSING');sources.set(id,source)}return sources;
}
async function snapshotSceneProducts(ctx,scenes){
  const ids=scenes.map(scene=>scene.product_id),products=await availableProducts(ctx.env,ids);if(!ids.length)return products;if(!ctx.env.FILES)throw new LiveInputError('ยังไม่ได้เชื่อม R2 FILES',503,'LIVE_STORAGE_REQUIRED');const sources=await normalizedCoverSources(ctx.env,ids,products);
  ids.forEach(id=>{const product=products.get(id),source=sources.get(id);scanSecrets({meta_id:product.meta_id,title:product.title,currency:product.currency,cover:{image_key:source.image_key}},`catalog.${id}`)});
  await Promise.all(ids.map(async id=>{const product=products.get(id),source=sources.get(id),object=await ctx.env.FILES.head(source.image_key);if(!object)throw new LiveInputError(`รูปหลักของสินค้า ${id} หายจาก R2`,409,'LIVE_ASSET_MISSING');const mime=String(object.httpMetadata?.contentType||'').split(';')[0].toLowerCase(),size=Number(object.size),etag=r2Etag(object);if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Number.isSafeInteger(size)||size<1||size>5*1024*1024||!etag)throw new LiveInputError(`รูปหลักของสินค้า ${id} ไม่ถูกต้อง`,409,'LIVE_ASSET_INVALID');product.cover={id:Number(source.id),position:Number(source.position),image_key:source.image_key,mime_type:mime,file_size:size,etag}}));return products;
}
function sceneStatements(env,showId,scenes,products,{gateToken='',gateRevision=0}={}){
  return scenes.map((scene,position)=>{
    const product=products.get(scene.product_id),cover=product.cover,id=`lives_${crypto.randomUUID().replaceAll('-','')}`,values=[id,showId,position,product.id,product.meta_id,product.title,product.price_cents,product.currency,product.quantity,cover.id,cover.position,cover.image_key,cover.mime_type,cover.file_size,cover.etag,scene.script,scene.cue.label,scene.cue.duration_seconds,scene.cue.transition];
    if(!gateToken)return env.DB.prepare('INSERT INTO live_show_scenes(id,show_id,position,product_id,product_meta_id_snapshot,product_title_snapshot,product_price_snapshot,product_currency_snapshot,product_stock_snapshot,product_cover_image_id_snapshot,product_cover_position_snapshot,product_cover_key_snapshot,product_cover_mime_snapshot,product_cover_size_snapshot,product_cover_etag_snapshot,script,cue_label,cue_duration_seconds,cue_transition) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values);
    return env.DB.prepare('INSERT INTO live_show_scenes(id,show_id,position,product_id,product_meta_id_snapshot,product_title_snapshot,product_price_snapshot,product_currency_snapshot,product_stock_snapshot,product_cover_image_id_snapshot,product_cover_position_snapshot,product_cover_key_snapshot,product_cover_mime_snapshot,product_cover_size_snapshot,product_cover_etag_snapshot,script,cue_label,cue_duration_seconds,cue_transition) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM live_shows WHERE id=? AND revision=? AND last_mutation_key=?)').bind(...values,showId,gateRevision,gateToken);
  });
}
async function detail(env,id){
  const show=await env.DB.prepare('SELECT id,title,description,avatar_preset,output_profile,scene_count,revision,created_by,updated_by,created_at,updated_at FROM live_shows WHERE id=?').bind(id).first();if(!show)return null;
  const scenes=(await env.DB.prepare(`SELECT s.position,s.product_id,s.product_meta_id_snapshot,s.product_title_snapshot,s.product_price_snapshot,s.product_currency_snapshot,s.product_stock_snapshot,s.script,s.cue_label,s.cue_duration_seconds,s.cue_transition,p.status product_status,p.availability product_availability,p.quantity product_stock_current FROM live_show_scenes s LEFT JOIN toys_center_products p ON p.id=s.product_id WHERE s.show_id=? ORDER BY s.position`).bind(id).all()).results||[];
  return{...show,revision:Number(show.revision),scene_count:Number(show.scene_count),scenes:scenes.map(row=>({position:Number(row.position),product_id:Number(row.product_id),product:{meta_id:row.product_meta_id_snapshot,title:row.product_title_snapshot,price_minor:Number(row.product_price_snapshot),currency:row.product_currency_snapshot,stock_saved:Number(row.product_stock_snapshot),stock_current:row.product_stock_current==null?null:Number(row.product_stock_current),available:row.product_status==='published'&&row.product_availability==='in stock'&&Number(row.product_stock_current)>0},script:row.script,cue:{label:row.cue_label,duration_seconds:Number(row.cue_duration_seconds),transition:row.cue_transition}}))};
}
function schemaError(error){return/no such table:\s*(?:live_|toys_center)|no such column/i.test(String(error?.message||error))}
function uniqueError(error){return/unique constraint/i.test(String(error?.message||error))}
function inputResponse(error){return error instanceof LiveInputError?liveJson({error:error.message,code:error.code},error.status):null}
function serverFailure(error){if(schemaError(error))return liveJson({error:'ต้องติดตั้ง migration 0112 ก่อนเปิด Live Center',code:'LIVE_CENTER_SCHEMA_REQUIRED'},503);console.error('LIVE_CENTER_FAILURE',String(error?.message||error).slice(0,300));return liveJson({error:'Live Center ทำงานไม่สำเร็จ',code:'LIVE_CENTER_FAILED'},500)}

export async function listLiveProducts(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{
    const url=new URL(ctx.request.url),query=normalizeToyQuery(url.searchParams.get('q')),limit=parseLimit(url.searchParams);if(!limit)return liveJson({error:'limit ไม่ถูกต้อง'},400);
    const raw=url.searchParams.get('cursor'),cursor=productCursor(raw,query);if(raw&&!cursor)return liveJson({error:'cursor ไม่ถูกต้อง'},400);
    let sql,args;
    if(query){const upper=livePrefixUpperBound(query);if(!upper)return liveJson({viewer_id:auth.user.id,items:[],pagination:{limit,has_more:false,next_cursor:null}},200);const range=cursor?'p.title COLLATE NOCASE>=? AND p.title COLLATE NOCASE<? AND (p.title COLLATE NOCASE,p.id)>(?,?)':'p.title COLLATE NOCASE>=? AND p.title COLLATE NOCASE<?';sql=`SELECT p.id,p.meta_id,p.title,p.price_cents,p.currency,p.quantity,p.updated_at,i.id image_id,i.position image_position FROM toys_center_products AS p INDEXED BY idx_toys_center_live_title LEFT JOIN toys_center_product_images i ON i.id=COALESCE((SELECT selected.id FROM toys_center_product_images selected WHERE selected.product_id=p.id AND selected.image_key=p.image_1_key ORDER BY selected.position LIMIT 1),(SELECT fallback.id FROM toys_center_product_images fallback WHERE fallback.product_id=p.id AND fallback.position=0 LIMIT 1)) WHERE p.status='published' AND p.availability='in stock' AND p.quantity>0 AND ${range} ORDER BY p.title COLLATE NOCASE ASC,p.id ASC LIMIT ?`;args=cursor?[query,upper,cursor.title,cursor.id,limit+1]:[query,upper,limit+1]}
    else{const anchor=cursor?[cursor.at,cursor.id]:['9999-12-31T23:59:59.999Z',Number.MAX_SAFE_INTEGER];sql=`SELECT p.id,p.meta_id,p.title,p.price_cents,p.currency,p.quantity,p.updated_at,i.id image_id,i.position image_position FROM toys_center_products AS p INDEXED BY idx_toys_center_live_inventory LEFT JOIN toys_center_product_images i ON i.id=COALESCE((SELECT selected.id FROM toys_center_product_images selected WHERE selected.product_id=p.id AND selected.image_key=p.image_1_key ORDER BY selected.position LIMIT 1),(SELECT fallback.id FROM toys_center_product_images fallback WHERE fallback.product_id=p.id AND fallback.position=0 LIMIT 1)) WHERE p.status='published' AND p.availability='in stock' AND p.quantity>0 AND (p.updated_at,p.id)<(?,?) ORDER BY p.updated_at DESC,p.id DESC LIMIT ?`;args=[anchor[0],anchor[1],limit+1]}
    const rows=(await ctx.env.DB.prepare(sql).bind(...args).all()).results||[],hasMore=rows.length>limit,page=rows.slice(0,limit),last=page.at(-1),next=hasMore&&last?encodeLiveCursor(query?[query,String(last.title),Number(last.id)]:['',String(last.updated_at),Number(last.id)]):null,origin=url.origin;
    return liveJson({viewer_id:auth.user.id,items:page.map(row=>({id:Number(row.id),meta_id:row.meta_id,title:row.title,price_minor:Number(row.price_cents),currency:row.currency,stock:Number(row.quantity),image_url:row.image_id?`${origin}/api/toys-center/gallery/${row.id}/${row.image_position}?v=${row.image_id}`:''})),pagination:{limit,has_more:hasMore,next_cursor:next}});
  }catch(error){return inputResponse(error)||serverFailure(error)}
}

export async function listLiveShows(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{const url=new URL(ctx.request.url),limit=parseLimit(url.searchParams);if(!limit)return liveJson({error:'limit ไม่ถูกต้อง'},400);const raw=url.searchParams.get('cursor'),cursor=showCursor(raw);if(raw&&!cursor)return liveJson({error:'cursor ไม่ถูกต้อง'},400);const anchor=cursor?[cursor.at,cursor.id]:['9999-12-31T23:59:59.999Z','~'],args=[anchor[0],anchor[1],limit+1],rows=(await ctx.env.DB.prepare('SELECT id,title,description,avatar_preset,output_profile,scene_count,revision,created_at,updated_at FROM live_shows WHERE (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT ?').bind(...args).all()).results||[],hasMore=rows.length>limit,page=rows.slice(0,limit),last=page.at(-1);return liveJson({viewer_id:auth.user.id,items:page.map(row=>({...row,scene_count:Number(row.scene_count),revision:Number(row.revision)})),pagination:{limit,has_more:hasMore,next_cursor:hasMore&&last?encodeLiveCursor([last.updated_at,last.id]):null}})}catch(error){return inputResponse(error)||serverFailure(error)}
}

export async function createLiveShow(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{
    const key=idempotencyKey(ctx.request),payload=showPayload(await bodyJson(ctx.request)),requestHash=await liveSha256(canonicalLiveJson(payload)),existing=await ctx.env.DB.prepare('SELECT id,create_request_hash FROM live_shows WHERE created_by=? AND create_idempotency_key=?').bind(auth.user.id,key).first();
    if(existing){if(existing.create_request_hash!==requestHash)return liveJson({error:'Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว',code:'LIVE_IDEMPOTENCY_CONFLICT'},409);return liveJson({viewer_id:auth.user.id,ok:true,replayed:true,item:await detail(ctx.env,existing.id)},200)}
    const products=await snapshotSceneProducts(ctx,payload.scenes),id=`live_${crypto.randomUUID().replaceAll('-','')}`,mutation=`mut_${crypto.randomUUID().replaceAll('-','')}`,now=new Date().toISOString(),statements=[ctx.env.DB.prepare('INSERT INTO live_shows(id,title,description,avatar_preset,output_profile,scene_count,revision,create_idempotency_key,create_request_hash,last_mutation_key,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?,?)').bind(id,payload.title,payload.description,payload.avatar_preset,payload.output_profile,payload.scenes.length,key,requestHash,mutation,auth.user.id,auth.user.id,now,now),...sceneStatements(ctx.env,id,payload.scenes,products)];
    try{await ctx.env.DB.batch(statements)}catch(error){if(!uniqueError(error))throw error;const raced=await ctx.env.DB.prepare('SELECT id,create_request_hash FROM live_shows WHERE created_by=? AND create_idempotency_key=?').bind(auth.user.id,key).first();if(!raced||raced.create_request_hash!==requestHash)return liveJson({error:'Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว',code:'LIVE_IDEMPOTENCY_CONFLICT'},409);return liveJson({viewer_id:auth.user.id,ok:true,replayed:true,item:await detail(ctx.env,raced.id)},200)}
    return liveJson({viewer_id:auth.user.id,ok:true,item:await detail(ctx.env,id)},201);
  }catch(error){return inputResponse(error)||serverFailure(error)}
}

export async function getLiveShow(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{const id=routeId(ctx.params.id,SHOW_ID,'show id'),item=await detail(ctx.env,id);return item?liveJson({viewer_id:auth.user.id,item}):liveJson({error:'ไม่พบรายการไลฟ์'},404)}catch(error){return inputResponse(error)||serverFailure(error)}
}

export async function updateLiveShow(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{
    const id=routeId(ctx.params.id,SHOW_ID,'show id'),payload=showPayload(await bodyJson(ctx.request),{updating:true}),current=await ctx.env.DB.prepare('SELECT revision FROM live_shows WHERE id=?').bind(id).first();if(!current)return liveJson({error:'ไม่พบรายการไลฟ์'},404);if(Number(current.revision)!==payload.expected_revision)return liveJson({error:'รายการนี้ถูกแก้จากอีกหน้าต่าง กรุณาโหลดใหม่',code:'LIVE_STALE_REVISION',current_revision:Number(current.revision)},409);const products=await snapshotSceneProducts(ctx,payload.scenes),token=`mut_${crypto.randomUUID().replaceAll('-','')}`,nextRevision=payload.expected_revision+1,now=new Date().toISOString(),statements=[ctx.env.DB.prepare('UPDATE live_shows SET title=?,description=?,avatar_preset=?,output_profile=?,scene_count=?,revision=revision+1,last_mutation_key=?,updated_by=?,updated_at=? WHERE id=? AND revision=?').bind(payload.title,payload.description,payload.avatar_preset,payload.output_profile,payload.scenes.length,token,auth.user.id,now,id,payload.expected_revision),ctx.env.DB.prepare('DELETE FROM live_show_scenes WHERE show_id=? AND EXISTS(SELECT 1 FROM live_shows WHERE id=? AND revision=? AND last_mutation_key=?)').bind(id,id,nextRevision,token),...sceneStatements(ctx.env,id,payload.scenes,products,{gateToken:token,gateRevision:nextRevision})],results=await ctx.env.DB.batch(statements);
    if(!Number(results[0]?.meta?.changes)){const current=await ctx.env.DB.prepare('SELECT revision FROM live_shows WHERE id=?').bind(id).first();return current?liveJson({error:'รายการนี้ถูกแก้จากอีกหน้าต่าง กรุณาโหลดใหม่',code:'LIVE_STALE_REVISION',current_revision:Number(current.revision)},409):liveJson({error:'ไม่พบรายการไลฟ์'},404)}
    return liveJson({viewer_id:auth.user.id,ok:true,item:await detail(ctx.env,id)});
  }catch(error){return inputResponse(error)||serverFailure(error)}
}

function publicVersion(row){return{id:row.id,show_id:row.show_id,version_number:Number(row.version_number),show_revision:Number(row.show_revision),schema_version:Number(row.schema_version),package_sha256:row.package_sha256,manifest_sha256:row.manifest_sha256,package_size:Number(row.package_size),asset_count:Number(row.asset_count),created_by:Number(row.created_by),created_at:row.created_at,download_url:`/api/admin/live-center/shows/${row.show_id}/versions/${row.id}/package`}}
export async function listLiveVersions(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{const showId=routeId(ctx.params.id,SHOW_ID,'show id'),show=await ctx.env.DB.prepare('SELECT id FROM live_shows WHERE id=?').bind(showId).first();if(!show)return liveJson({error:'ไม่พบรายการไลฟ์'},404);const url=new URL(ctx.request.url),limit=parseLimit(url.searchParams);if(!limit)return liveJson({error:'limit ไม่ถูกต้อง'},400);const raw=url.searchParams.get('cursor'),cursor=versionCursor(raw);if(raw&&!cursor)return liveJson({error:'cursor ไม่ถูกต้อง'},400);const seek=cursor?' AND version_number<?':'',args=cursor?[showId,cursor,limit+1]:[showId,limit+1],rows=(await ctx.env.DB.prepare(`SELECT id,show_id,version_number,show_revision,schema_version,package_sha256,manifest_sha256,package_size,asset_count,created_by,created_at FROM live_show_versions WHERE show_id=?${seek} ORDER BY version_number DESC LIMIT ?`).bind(...args).all()).results||[],hasMore=rows.length>limit,page=rows.slice(0,limit),last=page.at(-1);return liveJson({viewer_id:auth.user.id,items:page.map(publicVersion),pagination:{limit,has_more:hasMore,next_cursor:hasMore&&last?encodeLiveCursor([Number(last.version_number)]):null}})}catch(error){return inputResponse(error)||serverFailure(error)}
}

function r2Etag(object){return String(object?.httpEtag||object?.etag||'').replace(/^W\//,'').replace(/^"|"$/g,'')||null}
async function cleanupLiveObjects(ctx,keys,{attempts=3,defer=true}={}){
  let pending=[...new Set(keys.filter(Boolean))];
  for(let attempt=0;pending.length&&attempt<attempts;attempt++){
    const results=await Promise.allSettled(pending.map(key=>ctx.env.FILES?.delete(key))),retry=[];
    results.forEach((result,index)=>{if(result.status==='rejected')retry.push(pending[index])});pending=retry;
  }
  if(pending.length){
    console.error('LIVE_CENTER_R2_ORPHAN',pending.join(',').slice(0,1000));
    if(defer&&typeof ctx.waitUntil==='function')ctx.waitUntil(cleanupLiveObjects(ctx,pending,{attempts:3,defer:false}));
  }
  return pending;
}
async function packageSources(ctx,scenes){
  if(!ctx.env.FILES)throw new LiveInputError('ยังไม่ได้เชื่อม R2 FILES',503,'LIVE_STORAGE_REQUIRED');
  const ids=scenes.map(scene=>Number(scene.product_id)),products=await availableProducts(ctx.env,ids);let sources;try{sources=await normalizedCoverSources(ctx.env,ids,products)}catch(error){if(error?.code==='LIVE_ASSET_MISSING')throw new LiveInputError('รูปหลักสินค้าเปลี่ยนหรือถูกลบหลังบันทึกร่าง กรุณาบันทึกรายการใหม่',409,'LIVE_PRODUCT_CHANGED');throw error}const output=[];
  for(let scenePosition=0;scenePosition<scenes.length;scenePosition++){
    const scene=scenes[scenePosition],product=products.get(Number(scene.product_id)),source=sources.get(Number(scene.product_id));
    if(product.meta_id!==scene.product_meta_id_snapshot||product.title!==scene.product_title_snapshot||Number(product.price_cents)!==Number(scene.product_price_snapshot)||product.currency!==scene.product_currency_snapshot||Number(product.quantity)!==Number(scene.product_stock_snapshot)||Number(source.id)!==Number(scene.product_cover_image_id_snapshot)||Number(source.position)!==Number(scene.product_cover_position_snapshot)||source.image_key!==scene.product_cover_key_snapshot)throw new LiveInputError(`ข้อมูลหรือรูปหลักของสินค้า ${scene.product_id} เปลี่ยนหลังบันทึกร่าง กรุณาบันทึกรายการใหม่`,409,'LIVE_PRODUCT_CHANGED');
    const object=await ctx.env.FILES.head(source.image_key),mime=String(object?.httpMetadata?.contentType||'').split(';')[0].toLowerCase(),size=Number(object?.size),etag=r2Etag(object);if(!object||mime!==scene.product_cover_mime_snapshot||size!==Number(scene.product_cover_size_snapshot)||etag!==scene.product_cover_etag_snapshot)throw new LiveInputError(`ไฟล์รูปหลักของสินค้า ${scene.product_id} เปลี่ยนหรือหายหลังบันทึกร่าง กรุณาบันทึกรายการใหม่`,409,'LIVE_PRODUCT_CHANGED');
    output.push({scene,scenePosition,product,source});
  }
  return output;
}
const imageExtension=mime=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime]||'img');
async function copyVersionAssets(ctx,{showId,versionId,sources,createdAt}){
  const copied=[],createdKeys=[],prepared=[];let totalBytes=0;
  try{
    for(const item of sources){
      const object=await ctx.env.FILES.get(item.source.image_key);if(!object)throw new LiveInputError(`รูปสินค้า ${item.product.id}/${item.source.position} หายจาก R2`,409,'LIVE_ASSET_MISSING');
      const mime=String(object.httpMetadata?.contentType||'').split(';')[0].toLowerCase(),size=Number(object.size),etag=r2Etag(object);if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Number.isSafeInteger(size)||size<1||size>5*1024*1024)throw new LiveInputError(`รูปสินค้า ${item.product.id}/${item.source.position} ไม่ถูกต้อง`,409,'LIVE_ASSET_INVALID');if(mime!==item.scene.product_cover_mime_snapshot||size!==Number(item.scene.product_cover_size_snapshot)||etag!==item.scene.product_cover_etag_snapshot)throw new LiveInputError(`ไฟล์รูปหลักของสินค้า ${item.product.id} เปลี่ยนระหว่างสร้างเวอร์ชัน กรุณาบันทึกร่างใหม่`,409,'LIVE_PRODUCT_CHANGED');totalBytes+=size;if(totalBytes>LIVE_MAX_CONTAINER_BYTES-LIVE_MAX_ENVELOPE_BYTES-LIVE_CONTAINER_MAGIC.byteLength-4)throw new LiveInputError('ไฟล์ .visiondlive จะเกิน 32 MiB กรุณาลดจำนวนฉากหรือบีบอัดรูป',413,'LIVE_PACKAGE_TOO_LARGE');
      const buffer=object.body instanceof ArrayBuffer?object.body:ArrayBuffer.isView(object.body)?object.body.buffer.slice(object.body.byteOffset,object.body.byteOffset+object.body.byteLength):await new Response(object.body).arrayBuffer();let validated;try{validated=validateToyImageBuffer(buffer,mime,'Live Center')}catch{throw new LiveInputError(`ชนิดหรือข้อมูลรูปสินค้า ${item.product.id} ไม่ถูกต้อง`,409,'LIVE_ASSET_INVALID')}const bytes=new Uint8Array(validated.buffer);if(bytes.byteLength!==size)throw new LiveInputError(`ขนาดรูปสินค้า ${item.product.id} ไม่ตรงกับ R2`,409,'LIVE_ASSET_INVALID');scanSecretBytes(bytes,`catalog asset ${item.product.id}`);prepared.push({item,mime,size,etag,bytes,sha256:await liveSha256(bytes)});
    }
    for(const {item,mime,size,etag,bytes,sha256} of prepared){
      const assetId=`livea_${crypto.randomUUID().replaceAll('-','')}`,objectKey=`live-center/assets/${versionId}/${assetId}-${sha256.slice(0,16)}.${imageExtension(mime)}`;createdKeys.push(objectKey);const stored=await ctx.env.FILES.put(objectKey,bytes,{httpMetadata:{contentType:mime},customMetadata:{showId,versionId,assetId,sha256}}),verified=stored||await ctx.env.FILES.head(objectKey);
      if(!verified||Number(verified.size)!==size||verified.customMetadata?.sha256!==sha256)throw new LiveInputError(`คัดลอกรูปสินค้า ${item.product.id} ไม่สำเร็จ`,503,'LIVE_ASSET_COPY_FAILED');
      copied.push({...item,id:assetId,showId,versionId,object_key:objectKey,mime_type:mime,file_size:size,sha256,etag:r2Etag(verified)||etag,bytes,created_at:createdAt});
    }
    return copied;
  }catch(error){await cleanupLiveObjects(ctx,createdKeys);throw error}
}
function packageScenes(copied){return copied.map(asset=>({position:asset.scenePosition,product:{id:Number(asset.scene.product_id),meta_id:asset.scene.product_meta_id_snapshot,title:asset.scene.product_title_snapshot,price_minor:Number(asset.scene.product_price_snapshot),currency:asset.scene.product_currency_snapshot,stock:Number(asset.scene.product_stock_snapshot)},script:asset.scene.script,cue:{label:asset.scene.cue_label,duration_seconds:Number(asset.scene.cue_duration_seconds),transition:asset.scene.cue_transition},assets:[{id:asset.id,position:Number(asset.source.position),reference:`visiondlive://assets/${asset.id}`,mime_type:asset.mime_type,size:asset.file_size,integrity:{sha256:asset.sha256,etag:asset.etag},primary:true}]}))}

export async function buildLivePackage({show,versionId,versionNumber,createdAt,scenes,assets=[]}){
  let offset=0;const embeddedAssets=assets.map(asset=>{const descriptor={id:asset.id,reference:`visiondlive://assets/${asset.id}`,offset,length:asset.bytes.byteLength,mime_type:asset.mime_type,sha256:asset.sha256};offset+=asset.bytes.byteLength;return descriptor}),manifest={show:{id:show.id,title:show.title,description:show.description,revision:Number(show.revision),avatar:{preset:show.avatar_preset},output:{profile:show.output_profile}},version:{id:versionId,number:versionNumber},scenes,embedded_assets:embeddedAssets,runtime:{local_cache:{required:true,cache_key:`${show.id}:v${versionNumber}`,preload_assets:true},adapters:{facebook:'placeholder',tiktok:'later',shopee:'later'},livestream_launch:false},created:{at:createdAt}};scanSecrets(manifest,'package.manifest');const manifestSha256=await liveSha256(canonicalLiveJson(manifest)),envelope={format:LIVE_PACKAGE_FORMAT,schema_version:LIVE_PACKAGE_SCHEMA_VERSION,manifest,integrity:{algorithm:'sha256',manifest_sha256:manifestSha256}};scanSecrets(envelope,'package');const envelopeBytes=encoder.encode(canonicalLiveJson(envelope)),prefixBytes=LIVE_CONTAINER_MAGIC.byteLength+4,totalBytes=prefixBytes+envelopeBytes.byteLength+offset;if(envelopeBytes.byteLength>LIVE_MAX_ENVELOPE_BYTES||totalBytes>LIVE_MAX_CONTAINER_BYTES)throw new LiveInputError('ไฟล์ .visiondlive จะเกิน 32 MiB กรุณาลดข้อมูลหรือบีบอัดรูป',413,'LIVE_PACKAGE_TOO_LARGE');const bytes=new Uint8Array(totalBytes);bytes.set(LIVE_CONTAINER_MAGIC,0);new DataView(bytes.buffer).setUint32(LIVE_CONTAINER_MAGIC.byteLength,envelopeBytes.byteLength,false);bytes.set(envelopeBytes,prefixBytes);let payloadOffset=prefixBytes+envelopeBytes.byteLength;for(const asset of assets){bytes.set(asset.bytes,payloadOffset);payloadOffset+=asset.bytes.byteLength}const packageSha256=await liveSha256(bytes);return{envelope,bytes,manifestSha256,packageSha256}}

async function existingVersion(env,showId,key){return env.DB.prepare('SELECT id,show_id,version_number,show_revision,schema_version,idempotency_key,request_hash,package_object_key,package_sha256,manifest_sha256,package_size,asset_count,created_by,created_at FROM live_show_versions WHERE show_id=? AND idempotency_key=?').bind(showId,key).first()}
async function verifyCommittedVersion(ctx,row,expectedAssetCount=null){
  if(!ctx.env.FILES)throw new LiveInputError('ยังไม่ได้เชื่อม R2 FILES',503,'LIVE_STORAGE_REQUIRED');
  const [object,assetResult]=await Promise.all([ctx.env.FILES.head(row.package_object_key),ctx.env.DB.prepare('SELECT object_key,file_size,sha256 FROM live_show_version_assets WHERE version_id=? ORDER BY scene_position').bind(row.id).all()]),assets=assetResult.results||[];
  if(!object||Number(object.size)!==Number(row.package_size)||object.customMetadata?.packageSha256!==row.package_sha256)throw new LiveInputError('สถานะไฟล์แพ็กเกจหลังบันทึกไม่แน่นอน กรุณาตรวจสอบก่อนลองใหม่',503,'LIVE_VERSION_RECONCILE_FAILED');
  const assetCount=Number(row.asset_count);if(!Number.isSafeInteger(assetCount)||assetCount<1||assetCount>LIVE_MAX_SCENES||(expectedAssetCount!==null&&assetCount!==expectedAssetCount)||assets.length!==assetCount)throw new LiveInputError('จำนวน asset ของเวอร์ชันหลังบันทึกไม่ครบ',503,'LIVE_VERSION_RECONCILE_FAILED');
  const stored=await Promise.all(assets.map(asset=>ctx.env.FILES.head(asset.object_key)));
  if(stored.some((object,index)=>!object||Number(object.size)!==Number(assets[index].file_size)||object.customMetadata?.sha256!==assets[index].sha256))throw new LiveInputError('asset ของเวอร์ชันหลังบันทึกไม่ครบ',503,'LIVE_VERSION_RECONCILE_FAILED');
}
const LIVE_SCENE_SNAPSHOT_MATCH=`p.status='published' AND p.availability='in stock' AND p.quantity>0 AND p.meta_id=sc.product_meta_id_snapshot AND p.title=sc.product_title_snapshot AND p.price_cents=sc.product_price_snapshot AND p.currency=sc.product_currency_snapshot AND p.quantity=sc.product_stock_snapshot AND EXISTS(SELECT 1 FROM toys_center_product_images ci WHERE ci.id=sc.product_cover_image_id_snapshot AND ci.product_id=p.id AND ci.position=sc.product_cover_position_snapshot AND ci.image_key=sc.product_cover_key_snapshot) AND COALESCE((SELECT selected.id FROM toys_center_product_images selected WHERE selected.product_id=p.id AND selected.image_key=p.image_1_key ORDER BY selected.position LIMIT 1),(SELECT fallback.id FROM toys_center_product_images fallback WHERE fallback.product_id=p.id AND fallback.position=0 LIMIT 1))=sc.product_cover_image_id_snapshot`;
async function versionGateState(env,showId){
  return env.DB.prepare(`SELECT s.revision,s.scene_count,(SELECT COUNT(*) FROM live_show_scenes sc JOIN toys_center_products p ON p.id=sc.product_id WHERE sc.show_id=s.id AND p.status='published' AND p.availability='in stock' AND p.quantity>0) eligible_count,(SELECT COUNT(*) FROM live_show_scenes sc JOIN toys_center_products p ON p.id=sc.product_id WHERE sc.show_id=s.id AND ${LIVE_SCENE_SNAPSHOT_MATCH}) snapshot_match_count FROM live_shows s WHERE s.id=?`).bind(showId).first();
}
async function reconcileVersionLater(ctx,{showId,key,requestHash,versionId,pendingKey,pendingAssets,expectedAssetCount}){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const committed=await existingVersion(ctx.env,showId,key);
      if(!committed){await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);return}
      if(committed.request_hash===requestHash){
        try{await verifyCommittedVersion(ctx,committed,expectedAssetCount)}catch(error){console.error('LIVE_VERSION_DEFERRED_VERIFY_FAILED',showId,versionId,String(error?.message||error).slice(0,200));return}
        if(committed.id!==versionId)await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);
        return;
      }
      if(committed.id!==versionId)await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);
      return;
    }catch(error){if(attempt===2)console.error('LIVE_VERSION_RECONCILE_UNCERTAIN',showId,versionId,pendingKey,requestHash.slice(0,16),String(error?.message||error).slice(0,200))}
  }
}
export async function createLiveVersion(ctx){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  let pendingKey='',pendingAssets=[];
  try{
    const showId=routeId(ctx.params.id,SHOW_ID,'show id'),key=idempotencyKey(ctx.request),payload=versionPayload(await bodyJson(ctx.request,20000)),requestHash=await liveSha256(canonicalLiveJson({show_id:showId,...payload})),replay=await existingVersion(ctx.env,showId,key);
    if(replay){if(replay.request_hash!==requestHash)return liveJson({error:'Idempotency-Key นี้ถูกใช้กับ revision อื่นแล้ว',code:'LIVE_IDEMPOTENCY_CONFLICT'},409);await verifyCommittedVersion(ctx,replay);return liveJson({viewer_id:auth.user.id,ok:true,replayed:true,item:publicVersion(replay)},200)}
    const show=await ctx.env.DB.prepare('SELECT id,title,description,avatar_preset,output_profile,scene_count,revision FROM live_shows WHERE id=?').bind(showId).first();if(!show)return liveJson({error:'ไม่พบรายการไลฟ์'},404);if(Number(show.revision)!==payload.expected_revision)return liveJson({error:'รายการถูกแก้หลังหน้าจอนี้ กรุณาโหลดใหม่',code:'LIVE_STALE_REVISION',current_revision:Number(show.revision)},409);
    const scenes=(await ctx.env.DB.prepare('SELECT position,product_id,product_meta_id_snapshot,product_title_snapshot,product_price_snapshot,product_currency_snapshot,product_stock_snapshot,product_cover_image_id_snapshot,product_cover_position_snapshot,product_cover_key_snapshot,product_cover_mime_snapshot,product_cover_size_snapshot,product_cover_etag_snapshot,script,cue_label,cue_duration_seconds,cue_transition FROM live_show_scenes WHERE show_id=? ORDER BY position').bind(showId).all()).results||[];if(!scenes.length)return liveJson({error:'เพิ่มสินค้าอย่างน้อย 1 ฉากก่อนสร้างเวอร์ชัน',code:'LIVE_EMPTY_SHOW'},422);
    const sources=await packageSources(ctx,scenes);
    for(let attempt=0;attempt<4;attempt++){
      const next=await ctx.env.DB.prepare('SELECT COALESCE(MAX(version_number),0)+1 next_version FROM live_show_versions WHERE show_id=?').bind(showId).first(),versionNumber=Number(next?.next_version||1),versionId=`livev_${crypto.randomUUID().replaceAll('-','')}`,createdAt=new Date().toISOString();pendingAssets=await copyVersionAssets(ctx,{showId,versionId,sources,createdAt});const built=await buildLivePackage({show,versionId,versionNumber,createdAt,scenes:packageScenes(pendingAssets),assets:pendingAssets});pendingKey=`live-center/packages/${showId}/${versionId}.visiondlive`;
      const storedPackage=await ctx.env.FILES.put(pendingKey,built.bytes,{httpMetadata:{contentType:'application/vnd.visiond.live'},customMetadata:{packageSha256:built.packageSha256,manifestSha256:built.manifestSha256,showId,versionId}}),verifiedPackage=storedPackage||await ctx.env.FILES.head(pendingKey);if(!verifiedPackage||Number(verifiedPackage.size)!==built.bytes.byteLength||verifiedPackage.customMetadata?.packageSha256!==built.packageSha256)throw new LiveInputError('ตรวจสอบไฟล์แพ็กเกจใน R2 ไม่สำเร็จ',503,'LIVE_PACKAGE_COPY_FAILED');
      try{
        const statements=[ctx.env.DB.prepare(`INSERT INTO live_show_versions(id,show_id,version_number,show_revision,schema_version,idempotency_key,request_hash,package_object_key,package_sha256,manifest_sha256,package_size,asset_count,created_by,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM live_shows s WHERE s.id=? AND s.revision=? AND s.scene_count=? AND (SELECT COUNT(*) FROM live_show_scenes sc JOIN toys_center_products p ON p.id=sc.product_id WHERE sc.show_id=s.id AND ${LIVE_SCENE_SNAPSHOT_MATCH})=?`).bind(versionId,showId,versionNumber,payload.expected_revision,LIVE_PACKAGE_SCHEMA_VERSION,key,requestHash,pendingKey,built.packageSha256,built.manifestSha256,built.bytes.byteLength,pendingAssets.length,auth.user.id,createdAt,showId,payload.expected_revision,pendingAssets.length,pendingAssets.length),...pendingAssets.map(asset=>ctx.env.DB.prepare('INSERT INTO live_show_version_assets(id,show_id,version_id,scene_position,product_id_snapshot,source_image_id,source_position,object_key,mime_type,file_size,sha256,etag,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(asset.id,showId,versionId,asset.scenePosition,asset.scene.product_id,asset.source.id,asset.source.position,asset.object_key,asset.mime_type,asset.file_size,asset.sha256,asset.etag,createdAt))],results=await ctx.env.DB.batch(statements);
        if(results.length!==statements.length||results.some(result=>Number(result?.meta?.changes)!==1))throw new Error('LIVE_VERSION_BATCH_INCOMPLETE');
        const row=await existingVersion(ctx.env,showId,key);if(!row||row.id!==versionId||row.package_object_key!==pendingKey||row.request_hash!==requestHash)throw new Error('LIVE_VERSION_COMMIT_MISMATCH');await verifyCommittedVersion(ctx,row,pendingAssets.length);pendingKey='';pendingAssets=[];return liveJson({viewer_id:auth.user.id,ok:true,item:publicVersion(row)},201);
      }catch(error){
        let committed;
        try{committed=await existingVersion(ctx.env,showId,key)}catch(reconcileError){console.error('LIVE_VERSION_RECONCILE_UNCERTAIN',showId,versionId,pendingKey,requestHash.slice(0,16),String(reconcileError?.message||reconcileError).slice(0,200));if(typeof ctx.waitUntil==='function')ctx.waitUntil(reconcileVersionLater(ctx,{showId,key,requestHash,versionId,pendingKey,pendingAssets:[...pendingAssets],expectedAssetCount:scenes.length}));pendingKey='';pendingAssets=[];return liveJson({error:'ยืนยันสถานะการบันทึกเวอร์ชันไม่ได้ กรุณาตรวจสอบรายการก่อนลองใหม่',code:'LIVE_VERSION_RECONCILE_UNCERTAIN'},503)}
        if(committed){
          if(committed.request_hash!==requestHash){if(committed.id!==versionId)await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);pendingKey='';pendingAssets=[];return liveJson({error:'Idempotency-Key นี้ถูกใช้กับ revision อื่นแล้ว',code:'LIVE_IDEMPOTENCY_CONFLICT'},409)}
          try{await verifyCommittedVersion(ctx,committed,scenes.length)}catch(reconcileError){console.error('LIVE_VERSION_RECONCILE_FAILED',String(reconcileError?.message||reconcileError).slice(0,300));pendingKey='';pendingAssets=[];return inputResponse(reconcileError)||liveJson({error:'ยืนยันไฟล์ของเวอร์ชันไม่ได้ กรุณาตรวจสอบก่อนลองใหม่',code:'LIVE_VERSION_RECONCILE_FAILED'},503)}
          if(committed.id!==versionId)await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);pendingKey='';pendingAssets=[];return liveJson({viewer_id:auth.user.id,ok:true,replayed:true,item:publicVersion(committed)},200);
        }
        await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);pendingKey='';pendingAssets=[];
        const gate=await versionGateState(ctx.env,showId);if(!gate)return liveJson({error:'ไม่พบรายการไลฟ์'},404);if(Number(gate.revision)!==payload.expected_revision)return liveJson({error:'รายการถูกแก้ระหว่างสร้างเวอร์ชัน กรุณาลองใหม่',code:'LIVE_STALE_REVISION',current_revision:Number(gate.revision)},409);if(Number(gate.scene_count)!==scenes.length||Number(gate.eligible_count)!==scenes.length)return liveJson({error:'มีสินค้าที่ไม่พร้อมขาย ถูกลบ หรือหมดสต็อก กรุณาเลือกใหม่',code:'LIVE_PRODUCT_UNAVAILABLE'},409);if(Number(gate.snapshot_match_count)!==scenes.length)return liveJson({error:'ข้อมูลหรือรูปหลักสินค้าเปลี่ยนระหว่างสร้างเวอร์ชัน กรุณาบันทึกร่างใหม่',code:'LIVE_PRODUCT_CHANGED'},409);if(!uniqueError(error))throw error;
      }
    }
    return liveJson({error:'มีการสร้างเวอร์ชันพร้อมกัน กรุณาลองใหม่',code:'LIVE_VERSION_BUSY'},409);
  }catch(error){await cleanupLiveObjects(ctx,[pendingKey,...pendingAssets.map(asset=>asset.object_key)]);return inputResponse(error)||serverFailure(error)}
}

const packageEtag=sha=>`"sha256-${sha}"`;
const etagMatches=(header,etag)=>String(header||'').split(',').map(value=>value.trim()).some(value=>value==='*'||value===etag||value===`W/${etag}`);
export async function downloadLivePackage(ctx,{head=false}={}){
  const auth=await liveAdmin(ctx);if(auth.error)return auth.error;
  try{
    const showId=routeId(ctx.params.id,SHOW_ID,'show id'),versionId=routeId(ctx.params.versionId,VERSION_ID,'version id'),row=await ctx.env.DB.prepare('SELECT id,show_id,version_number,package_object_key,package_sha256,package_size FROM live_show_versions WHERE id=? AND show_id=?').bind(versionId,showId).first();if(!row)return liveJson({error:'ไม่พบแพ็กเกจเวอร์ชันนี้'},404);const etag=packageEtag(row.package_sha256),headers={...LIVE_PRIVATE_HEADERS,'content-type':'application/vnd.visiond.live','content-disposition':`attachment; filename="visiond-live-${showId}-v${row.version_number}.visiondlive"`,'x-content-type-options':'nosniff','x-content-sha256':row.package_sha256,etag};if(etagMatches(ctx.request.headers.get('if-none-match'),etag))return new Response(null,{status:304,headers});if(!ctx.env.FILES)return liveJson({error:'ยังไม่ได้เชื่อม R2 FILES'},503);const object=head?await ctx.env.FILES.head(row.package_object_key):await ctx.env.FILES.get(row.package_object_key);if(!object)return liveJson({error:'ไฟล์แพ็กเกจหายจาก R2',code:'LIVE_PACKAGE_MISSING'},409);if(Number(object.size)!==Number(row.package_size)||object.customMetadata?.packageSha256!==row.package_sha256)return liveJson({error:'ไฟล์แพ็กเกจไม่ตรงกับ metadata',code:'LIVE_PACKAGE_INTEGRITY'},409);headers['content-length']=String(row.package_size);return new Response(head?null:object.body,{headers});
  }catch(error){return inputResponse(error)||serverFailure(error)}
}
