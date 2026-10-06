const encoder=new TextEncoder();
export const RESERVED_SLUGS=new Set(['admin','api','login','support','www','cdn-cgi','health','internal','status']);
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY=/^[A-Za-z0-9._:-]{8,128}$/;
const OWNER=/^[a-f0-9]{64}$/;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...headers}});
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, s-maxage=30, must-revalidate','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff'}});
const hex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const bytes=value=>Uint8Array.from(String(value).match(/.{2}/g)||[],part=>Number.parseInt(part,16));
const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const validSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=50&&SLUG.test(value)&&!RESERVED_SLUGS.has(value);
const pageView=page=>({id:page.id,domain_id:page.domain_id,slug:page.slug,display_name:page.display_name,status:page.status,public_url:`https://${page.hostname}/${page.slug}`,created_at:page.created_at,expires_at:page.expires_at,updated_at:page.updated_at});
const pageSql=`SELECT p.id,p.domain_id,p.owner_ref,p.slug,p.display_name,p.status,p.create_request_hash,p.created_at,p.expires_at,p.updated_at,d.hostname FROM vpage_pages p JOIN vpage_domains d ON d.id=p.domain_id`;

async function authenticate(request,env,rawBody){
  if(request.headers.has('origin'))return {error:json({error:'server-to-server only',code:'VPAGE_BROWSER_FORBIDDEN'},403)};
  const keyId=String(request.headers.get('x-vpage-key-id')||''),timestamp=String(request.headers.get('x-vpage-timestamp')||''),nonce=String(request.headers.get('x-vpage-nonce')||''),ownerRef=String(request.headers.get('x-vpage-owner-ref')||''),signature=String(request.headers.get('x-vpage-signature')||'');
  const secret=String(env.VPAGE_SHARED_SECRET||''),expectedKey=String(env.VPAGE_KEY_ID||'');
  if(secret.length<32||!expectedKey)return {error:json({error:'service unavailable',code:'VPAGE_AUTH_NOT_CONFIGURED'},503)};
  const epoch=Number(timestamp),now=Math.floor(Date.now()/1000);
  if(keyId!==expectedKey||!/^\d{10}$/.test(timestamp)||Math.abs(now-epoch)>300||!/^[A-Za-z0-9_-]{16,96}$/.test(nonce)||!(ownerRef==='system'||OWNER.test(ownerRef))||!/^[a-f0-9]{64}$/.test(signature))return {error:json({error:'unauthorized',code:'VPAGE_SIGNATURE_INVALID'},401)};
  const url=new URL(request.url),digest=await sha256(rawBody),canonical=['vpage-v1',request.method.toUpperCase(),url.pathname+url.search,keyId,timestamp,nonce,ownerRef,digest].join('\n');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,bytes(signature),encoder.encode(canonical)))return {error:json({error:'unauthorized',code:'VPAGE_SIGNATURE_INVALID'},401)};
  try{
    await env.VPAGE_DB.batch([
      env.VPAGE_DB.prepare("DELETE FROM vpage_api_nonces WHERE rowid IN (SELECT rowid FROM vpage_api_nonces WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at LIMIT 24)"),
      env.VPAGE_DB.prepare("INSERT INTO vpage_api_nonces(key_id,nonce,expires_at) VALUES(?,?,datetime('now','+10 minutes'))").bind(keyId,nonce)
    ]);
  }catch{return {error:json({error:'replayed request',code:'VPAGE_REPLAYED_REQUEST'},409)}}
  return {ownerRef};
}

async function parseBody(rawBody){
  if(!rawBody)return {};
  try{return JSON.parse(rawBody)}catch{throw Object.assign(new Error('invalid json'),{status:400,code:'VPAGE_INVALID_JSON'})}
}

async function domains(request,env){
  const url=new URL(request.url),raw=url.searchParams.get('cursor'),cursor=raw===null?0:Number(raw);
  if(raw!==null&&(!/^\d+$/.test(raw)||!Number.isSafeInteger(cursor)||cursor<0))return json({error:'invalid cursor',code:'VPAGE_CURSOR_INVALID'},400);
  const result=await env.VPAGE_DB.prepare('SELECT id,slot,hostname FROM vpage_domains WHERE enabled=1 AND slot>? ORDER BY slot LIMIT 24').bind(cursor).all(),items=result.results||[];
  return json({items,pagination:{limit:24,has_more:false,next_cursor:null}});
}

async function availability(path,env){
  const match=path.match(/^\/api\/v1\/domains\/([^/]+)\/slugs\/([^/]+)\/availability$/);if(!match)return null;
  const domainId=decodeURIComponent(match[1]),slug=decodeURIComponent(match[2]);
  if(!validSlug(slug))return json({error:'invalid slug',code:'VPAGE_SLUG_INVALID'},400);
  const domain=await env.VPAGE_DB.prepare('SELECT id,hostname FROM vpage_domains WHERE id=? AND enabled=1').bind(domainId).first();if(!domain)return json({error:'domain unavailable',code:'VPAGE_DOMAIN_UNAVAILABLE'},404);
  const found=await env.VPAGE_DB.prepare('SELECT id FROM vpage_pages WHERE domain_id=? AND slug=? LIMIT 1').bind(domainId,slug).first();
  return json({domain_id:domain.id,slug,available:!found,public_url:`https://${domain.hostname}/${slug}`});
}

async function createPage(request,env,ownerRef,rawBody){
  if(!OWNER.test(ownerRef))return json({error:'owner required',code:'VPAGE_OWNER_REQUIRED'},400);
  const key=String(request.headers.get('idempotency-key')||'').trim();if(!IDEMPOTENCY.test(key))return json({error:'idempotency key required',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400);
  const body=await parseBody(rawBody),displayName=typeof body.display_name==='string'?body.display_name.trim():'',domainId=String(body.domain_id||''),slug=String(body.slug||'');
  if(displayName.length<1||displayName.length>120||!validSlug(slug)||domainId.length>64)return json({error:'invalid page details',code:'VPAGE_INPUT_INVALID'},400);
  const requestHash=await sha256(JSON.stringify({display_name:displayName,domain_id:domainId,slug,owner_ref:ownerRef}));
  const existing=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.create_idempotency_key=?`).bind(key).first();
  if(existing){if(existing.create_request_hash!==requestHash)return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);return json({item:pageView(existing),replayed:true},200)}
  const domain=await env.VPAGE_DB.prepare('SELECT id,hostname FROM vpage_domains WHERE id=? AND enabled=1').bind(domainId).first();if(!domain)return json({error:'domain unavailable',code:'VPAGE_DOMAIN_UNAVAILABLE'},404);
  const id=`vp_${crypto.randomUUID().replaceAll('-','')}`,createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+30*86400000).toISOString();
  try{await env.VPAGE_DB.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,'active',?,?,?,?,?)").bind(id,domainId,ownerRef,slug,displayName,key,requestHash,createdAt,expiresAt,createdAt).run()}
  catch(error){
    const raced=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.create_idempotency_key=?`).bind(key).first();
    if(raced&&raced.create_request_hash===requestHash)return json({item:pageView(raced),replayed:true},200);
    if(raced)return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
    const slugTaken=await env.VPAGE_DB.prepare('SELECT id FROM vpage_pages WHERE domain_id=? AND slug=? LIMIT 1').bind(domainId,slug).first();
    if(slugTaken)return json({error:'slug unavailable',code:'VPAGE_SLUG_CONFLICT'},409);
    throw error;
  }
  return json({item:{id,domain_id:domainId,slug,display_name:displayName,status:'active',public_url:`https://${domain.hostname}/${slug}`,created_at:createdAt,expires_at:expiresAt,updated_at:createdAt},replayed:false},201);
}

async function readPage(path,env,ownerRef){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})(?:\/status)?$/);if(!match)return null;
  const page=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.id=? AND p.owner_ref=?`).bind(match[1],ownerRef).first();return page?json({item:pageView(page)}):json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
}

async function lifecycle(request,path,env,ownerRef,rawBody){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/(suspend|resume|renew|delete)$/);if(!match)return null;
  const [,id,action]=match,key=String(request.headers.get('idempotency-key')||'').trim();if(!IDEMPOTENCY.test(key))return json({error:'idempotency key required',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400);
  const requestHash=await sha256(JSON.stringify({id,action,body:await parseBody(rawBody)})),prior=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_lifecycle_requests WHERE idempotency_key=?').bind(key).first();
  if(prior&&(prior.page_id!==id||prior.owner_ref!==ownerRef||prior.action!==action||prior.request_hash!==requestHash))return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
  let page=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.id=? AND p.owner_ref=?`).bind(id,ownerRef).first();if(!page)return json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);if(prior)return json({item:pageView(page),replayed:true});
  const now=new Date().toISOString();let status=page.status,expiresAt=page.expires_at;
  if(action==='suspend'&&status==='active')status='suspended';
  if(action==='resume'){if(new Date(expiresAt)<=new Date())return json({error:'page expired',code:'VPAGE_PAGE_EXPIRED'},409);if(status==='suspended')status='active'}
  if(action==='renew'){const base=Math.max(Date.now(),new Date(expiresAt).getTime());expiresAt=new Date(base+30*86400000).toISOString()}
  if(action==='delete')status='deleted';
  try{await env.VPAGE_DB.batch([
    env.VPAGE_DB.prepare('INSERT INTO vpage_lifecycle_requests(idempotency_key,page_id,owner_ref,action,request_hash) VALUES(?,?,?,?,?)').bind(key,id,ownerRef,action,requestHash),
    env.VPAGE_DB.prepare('UPDATE vpage_pages SET status=?,expires_at=?,updated_at=? WHERE id=? AND owner_ref=?').bind(status,expiresAt,now,id,ownerRef)
  ])}catch{return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}
  page={...page,status,expires_at:expiresAt,updated_at:now};
  if(globalThis.caches?.default&&['suspend','resume','delete'].includes(action))await globalThis.caches.default.delete(new Request(`https://${page.hostname}/${page.slug}`)).catch(()=>{});
  return json({item:pageView(page),replayed:false});
}

async function publicPage(request,env){
  const url=new URL(request.url),hostname=url.hostname.toLowerCase().replace(/^www\./,''),slug=decodeURIComponent(url.pathname.slice(1));
  if(url.pathname==='/')return html('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Vpage</title><main><h1>บริการเซลเพจเพื่อธุรกิจออนไลน์</h1><p>Vpage by VisionD</p></main></html>');
  if(!validSlug(slug))return html('<h1>ไม่พบหน้า</h1>',404);
  const page=await env.VPAGE_DB.prepare(`${pageSql} WHERE d.hostname=? AND d.enabled=1 AND p.slug=? AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP`).bind(hostname,slug).first();
  if(!page)return html('<h1>ไม่พบหน้า</h1>',404);
  return html(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.display_name)}</title><style>body{font-family:system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#eefaf8;color:#073b38}main{padding:40px;text-align:center}h1{font-size:clamp(36px,8vw,76px)}</style><main><p>VPAGE</p><h1>${escapeHtml(page.display_name)}</h1><p>เซลเพจกำลังพร้อมให้คุณเริ่มสร้างเนื้อหา</p></main></html>`);
}

export default {async fetch(request,env){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/'))return publicPage(request,env);
    if(!path.startsWith('/api/v1/'))return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
    const rawBody=request.method==='GET'||request.method==='HEAD'?'':await request.text();if(encoder.encode(rawBody).byteLength>16384)return json({error:'payload too large',code:'VPAGE_PAYLOAD_TOO_LARGE'},413);
    const auth=await authenticate(request,env,rawBody);if(auth.error)return auth.error;
    if(request.method==='GET'&&path==='/api/v1/domains')return domains(request,env);
    if(request.method==='GET'){const found=await availability(path,env);if(found)return found;const page=await readPage(path,env,auth.ownerRef);if(page)return page}
    if(request.method==='POST'&&path==='/api/v1/pages')return createPage(request,env,auth.ownerRef,rawBody);
    if(request.method==='POST'){const result=await lifecycle(request,path,env,auth.ownerRef,rawBody);if(result)return result}
    return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
  }catch(error){return json({error:'request failed',code:error?.code||'VPAGE_REQUEST_FAILED'},Number(error?.status)||500)}
}};
