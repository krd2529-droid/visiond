const encoder=new TextEncoder();
export const RESERVED_SLUGS=new Set(['admin','api','login','support','www','cdn-cgi','health','internal','status']);
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY=/^[A-Za-z0-9._:-]{8,128}$/;
const OWNER=/^[a-f0-9]{64}$/;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...headers}});
const html=(body,status=200,headers={})=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, s-maxage=30, must-revalidate','content-security-policy':"default-src 'none'; img-src https:; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}});
const hex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const bytes=value=>Uint8Array.from(String(value).match(/.{2}/g)||[],part=>Number.parseInt(part,16));
const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const validSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=50&&SLUG.test(value)&&!RESERVED_SLUGS.has(value);
const pageView=page=>({id:page.id,domain_id:page.domain_id,slug:page.slug,display_name:page.display_name,status:page.status,active_set:Number(page.active_set)||1,public_url:`https://${page.hostname}/${page.slug}`,created_at:page.created_at,expires_at:page.expires_at,updated_at:page.updated_at});
const contentView=(row,productItems=[],contactItems=[])=>({set_no:Number(row.set_no),product_image_url:row.product_image_url||'',detail_text:row.detail_text||'',text_size:row.text_size||'medium',text_style:row.text_style||'normal',youtube_url:row.youtube_url||'',background_image_url:row.background_image_url||'',product_items:productItems.map(item=>({position:Number(item.position),destination_url:item.destination_url,image_url:item.image_url||''})),contact_items:contactItems.map(item=>({position:Number(item.position),contact_type:item.contact_type,destination_url:item.destination_url,image_url:item.image_url||''})),revision:Number(row.revision)||0,updated_at:row.updated_at});
const pageSql=`SELECT p.id,p.domain_id,p.owner_ref,p.slug,p.display_name,p.status,p.active_set,p.public_generation,p.create_request_hash,p.created_at,p.expires_at,p.updated_at,d.hostname FROM vpage_pages p JOIN vpage_domains d ON d.id=p.domain_id`;
const httpsUrl=(value,{hosts=null,required=true,max=2048}={})=>{if(!value)return required?null:'';if(typeof value!=='string'||value.length>max)return null;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.href.length>max)return null;const host=url.hostname.toLowerCase();if(hosts&&!hosts.some(item=>host===item||host.endsWith(`.${item}`)))return null;return url.href}catch{return null}};
const youtubeId=value=>{if(!value)return'';try{const url=new URL(value),host=url.hostname.toLowerCase();let id='';if(host==='youtu.be')id=url.pathname.slice(1);else if(host==='youtube.com'||host.endsWith('.youtube.com'))id=url.pathname==='/watch'?url.searchParams.get('v')||'':url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]||'':url.pathname.startsWith('/embed/')?url.pathname.split('/')[2]||'':'';return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:''}catch{return''}};
const youtubeEmbed=value=>{const id=youtubeId(value);return id?`https://www.youtube-nocookie.com/embed/${id}`:''};
const publicFences=new Map();
const publicCacheDelete=async page=>{const key=`https://${page.hostname}/${page.slug}`;publicFences.set(key,(publicFences.get(key)||0)+1);if(globalThis.caches?.default)await globalThis.caches.default.delete(new Request(key)).catch(()=>{})};
const actorValid=(value,kind)=>/^[a-f0-9]{64}$/.test(String(value||''))&&['owner','boss'].includes(kind);
const completeSetWhere="c.page_id=? AND c.set_no=? AND c.revision>0 AND length(trim(c.product_image_url))>0 AND length(trim(c.detail_text))>0 AND length(trim(c.background_image_url))>0 AND (SELECT COUNT(*) FROM vpage_product_items pi WHERE pi.page_id=c.page_id AND pi.set_no=c.set_no) BETWEEN 1 AND 3 AND (SELECT COUNT(*) FROM vpage_contact_items ci WHERE ci.page_id=c.page_id AND ci.set_no=c.set_no) BETWEEN 1 AND 3";

function normalizeContent(body){
  const productImage=httpsUrl(body.product_image_url),backgroundImage=httpsUrl(body.background_image_url),rawYoutube=typeof body.youtube_url==='string'?body.youtube_url.trim():'',youtubeVideoId=youtubeId(rawYoutube),youtubeUrl=rawYoutube?(youtubeVideoId?`https://www.youtube.com/watch?v=${youtubeVideoId}`:null):'';
  const detail=typeof body.detail_text==='string'?body.detail_text.trim():'',textSize=String(body.text_size||''),textStyle=String(body.text_style||'');
  const rawProducts=Array.isArray(body.product_items)?body.product_items:null,rawContacts=Array.isArray(body.contact_items)?body.contact_items:null;
  if(!rawProducts||rawProducts.length<1||rawProducts.length>3||!rawContacts||rawContacts.length<1||rawContacts.length>3)return null;
  const productItems=rawProducts.map((item,index)=>({position:index+1,destination_url:httpsUrl(item?.destination_url),image_url:httpsUrl(item?.image_url,{required:false})}));
  const contactItems=rawContacts.map((item,index)=>{const contactType=String(item?.contact_type||''),hosts=contactType==='facebook'?['facebook.com','m.me']:contactType==='line'?['line.me']:[];return{position:index+1,contact_type:contactType,destination_url:hosts.length?httpsUrl(item?.destination_url,{hosts}):null,image_url:httpsUrl(item?.image_url,{required:false})}});
  if(!productImage||!backgroundImage||youtubeUrl===null||detail.length<1||detail.length>4000||!['small','medium','large'].includes(textSize)||!['normal','strong','emphasis'].includes(textStyle)||productItems.some(item=>!item.destination_url||item.image_url===null)||contactItems.some(item=>!['facebook','line'].includes(item.contact_type)||!item.destination_url||item.image_url===null))return null;
  return{product_image_url:productImage,detail_text:detail,text_size:textSize,text_style:textStyle,youtube_url:youtubeUrl,product_url:productItems[0].destination_url,contact_url:contactItems[0].destination_url,background_image_url:backgroundImage,product_items:productItems,contact_items:contactItems};
}

async function authorizedPage(env,id,ownerRef){return env.VPAGE_DB.prepare(`${pageSql} WHERE p.id=? AND (?='system' OR p.owner_ref=?) AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP`).bind(id,ownerRef,ownerRef).first()}

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
  try{await env.VPAGE_DB.batch([
    env.VPAGE_DB.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,'active',?,?,?,?,?)").bind(id,domainId,ownerRef,slug,displayName,key,requestHash,createdAt,expiresAt,createdAt),
    env.VPAGE_DB.prepare('INSERT INTO vpage_content_sets(page_id,set_no) VALUES(?,1)').bind(id),
    env.VPAGE_DB.prepare('INSERT INTO vpage_content_sets(page_id,set_no) VALUES(?,2)').bind(id)
  ])}
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

async function readEditor(path,env,ownerRef){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/editor$/);if(!match)return null;
  const page=await authorizedPage(env,match[1],ownerRef);if(!page)return json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
  const [sets,products,contacts,audit]=await Promise.all([
    env.VPAGE_DB.prepare('SELECT set_no,product_image_url,detail_text,text_size,text_style,youtube_url,background_image_url,revision,updated_at FROM vpage_content_sets WHERE page_id=? ORDER BY set_no LIMIT 2').bind(page.id).all(),
    env.VPAGE_DB.prepare('SELECT set_no,position,destination_url,image_url FROM vpage_product_items WHERE page_id=? ORDER BY set_no,position LIMIT 6').bind(page.id).all(),
    env.VPAGE_DB.prepare('SELECT set_no,position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? ORDER BY set_no,position LIMIT 6').bind(page.id).all(),
    env.VPAGE_DB.prepare('SELECT id,idempotency_key,actor_ref,actor_kind,previous_set,next_set,created_at FROM vpage_set_audit WHERE page_id=? ORDER BY created_at DESC,id DESC LIMIT 24').bind(page.id).all()
  ]);
  return json({item:{...pageView(page),content_sets:(sets.results||[]).map(row=>contentView(row,(products.results||[]).filter(item=>Number(item.set_no)===Number(row.set_no)),(contacts.results||[]).filter(item=>Number(item.set_no)===Number(row.set_no)))),audit:audit.results||[]}});
}

async function saveContent(request,path,env,ownerRef,rawBody){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/content-sets\/([12])$/);if(!match)return null;
  const [,id,rawSet]=match,setNo=Number(rawSet),key=String(request.headers.get('idempotency-key')||'').trim();if(!IDEMPOTENCY.test(key))return json({error:'idempotency key required',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400);
  const page=await authorizedPage(env,id,ownerRef);if(!page)return json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
  const body=await parseBody(rawBody),content=normalizeContent(body),expectedRevision=Number(body.expected_revision);if(!content||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return json({error:'invalid content items',code:'VPAGE_CONTENT_ITEMS_INVALID'},400);
  const requestHash=await sha256(JSON.stringify({id,set_no:setNo,expected_revision:expectedRevision,content})),prior=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();
  if(prior&&(prior.page_id!==id||prior.owner_ref!==ownerRef||prior.action!=='save_set'||prior.request_hash!==requestHash))return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
  if(!prior){const guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;try{await env.VPAGE_DB.batch([
      env.VPAGE_DB.prepare('INSERT INTO vpage_editor_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_content_sets WHERE page_id=? AND set_no=? AND revision=?) THEN ? ELSE NULL END)').bind(id,setNo,expectedRevision,guard),
      env.VPAGE_DB.prepare("INSERT INTO vpage_editor_requests(idempotency_key,page_id,owner_ref,action,request_hash) VALUES(?,?,?,'save_set',?)").bind(key,id,ownerRef,requestHash),
      env.VPAGE_DB.prepare('UPDATE vpage_content_sets SET product_image_url=?,detail_text=?,text_size=?,text_style=?,youtube_url=?,product_url=?,contact_url=?,background_image_url=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE page_id=? AND set_no=? AND revision=?').bind(content.product_image_url,content.detail_text,content.text_size,content.text_style,content.youtube_url,content.product_url,content.contact_url,content.background_image_url,id,setNo,expectedRevision),
      env.VPAGE_DB.prepare('DELETE FROM vpage_product_items WHERE page_id=? AND set_no=?').bind(id,setNo),
      ...content.product_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_product_items(page_id,set_no,position,destination_url,image_url) VALUES(?,?,?,?,?)').bind(id,setNo,item.position,item.destination_url,item.image_url)),
      env.VPAGE_DB.prepare('DELETE FROM vpage_contact_items WHERE page_id=? AND set_no=?').bind(id,setNo),
      ...content.contact_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_contact_items(page_id,set_no,position,contact_type,destination_url,image_url) VALUES(?,?,?,?,?,?)').bind(id,setNo,item.position,item.contact_type,item.destination_url,item.image_url)),
      env.VPAGE_DB.prepare('UPDATE vpage_pages SET public_generation=public_generation+1 WHERE id=? AND active_set=?').bind(id,setNo),
      env.VPAGE_DB.prepare('DELETE FROM vpage_editor_guards WHERE token=?').bind(guard)
    ])}catch{const raced=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();if(!raced)return json({error:'content changed; reload before saving',code:'VPAGE_CONTENT_REVISION_CONFLICT'},409);if(raced.page_id!==id||raced.owner_ref!==ownerRef||raced.action!=='save_set'||raced.request_hash!==requestHash)return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}}
  const [row,products,contacts]=await Promise.all([env.VPAGE_DB.prepare('SELECT set_no,product_image_url,detail_text,text_size,text_style,youtube_url,background_image_url,revision,updated_at FROM vpage_content_sets WHERE page_id=? AND set_no=?').bind(id,setNo).first(),env.VPAGE_DB.prepare('SELECT position,destination_url,image_url FROM vpage_product_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(id,setNo).all(),env.VPAGE_DB.prepare('SELECT position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(id,setNo).all()]);if(!row)return json({error:'content set missing',code:'VPAGE_CONTENT_SET_MISSING'},409);
  if(Number(page.active_set)===setNo)await publicCacheDelete(page);
  return json({item:contentView(row,products.results||[],contacts.results||[]),replayed:Boolean(prior)});
}

async function switchSet(request,path,env,ownerRef,rawBody){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/active-set$/);if(!match)return null;
  const id=match[1],key=String(request.headers.get('idempotency-key')||'').trim();if(!IDEMPOTENCY.test(key))return json({error:'idempotency key required',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400);
  const page=await authorizedPage(env,id,ownerRef);if(!page)return json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
  const body=await parseBody(rawBody),nextSet=Number(body.active_set),actorRef=String(body.actor_ref||''),actorKind=String(body.actor_kind||'');
  if(![1,2].includes(nextSet)||!actorValid(actorRef,actorKind)||(ownerRef==='system'&&actorKind!=='boss')||(ownerRef!=='system'&&(actorKind!=='owner'||actorRef!==ownerRef)))return json({error:'invalid switch',code:'VPAGE_SWITCH_INVALID'},400);
  const targetComplete=Number(page.active_set)===nextSet||await env.VPAGE_DB.prepare(`SELECT 1 ready FROM vpage_content_sets c WHERE ${completeSetWhere}`).bind(id,nextSet).first();
  if(!targetComplete)return json({error:'target content set is incomplete',code:'VPAGE_CONTENT_SET_INCOMPLETE'},409);
  const requestHash=await sha256(JSON.stringify({id,active_set:nextSet,actor_ref:actorRef,actor_kind:actorKind})),prior=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();
  if(prior&&(prior.page_id!==id||prior.owner_ref!==ownerRef||prior.action!=='switch_set'||prior.request_hash!==requestHash))return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
  if(!prior){const auditId=`vpa_${crypto.randomUUID().replaceAll('-','')}`,auditAt=new Date().toISOString(),guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;try{await env.VPAGE_DB.batch([
      env.VPAGE_DB.prepare(`INSERT INTO vpage_editor_guards(token) VALUES(CASE WHEN (SELECT active_set FROM vpage_pages WHERE id=?)=? OR EXISTS(SELECT 1 FROM vpage_content_sets c WHERE ${completeSetWhere}) THEN ? ELSE NULL END)`).bind(id,nextSet,id,nextSet,guard),
      env.VPAGE_DB.prepare("INSERT INTO vpage_editor_requests(idempotency_key,page_id,owner_ref,action,request_hash) VALUES(?,?,?,'switch_set',?)").bind(key,id,ownerRef,requestHash),
      env.VPAGE_DB.prepare('INSERT INTO vpage_set_audit(id,page_id,idempotency_key,actor_ref,actor_kind,previous_set,next_set,created_at) SELECT ?,id,?,?,?,active_set,?,? FROM vpage_pages WHERE id=? AND active_set<>?').bind(auditId,key,actorRef,actorKind,nextSet,auditAt,id,nextSet),
      env.VPAGE_DB.prepare('UPDATE vpage_pages SET active_set=?,public_generation=public_generation+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active_set<>?').bind(nextSet,id,nextSet),
      env.VPAGE_DB.prepare('DELETE FROM vpage_editor_guards WHERE token=?').bind(guard)
    ])}catch{const raced=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();if(!raced){const complete=await env.VPAGE_DB.prepare(`SELECT 1 ready FROM vpage_content_sets c WHERE ${completeSetWhere}`).bind(id,nextSet).first();if(!complete)return json({error:'target content set is incomplete',code:'VPAGE_CONTENT_SET_INCOMPLETE'},409);return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}if(raced.page_id!==id||raced.owner_ref!==ownerRef||raced.action!=='switch_set'||raced.request_hash!==requestHash)return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}}
  const current=await authorizedPage(env,id,ownerRef);if(!prior&&Number(page.active_set)!==Number(current.active_set))await publicCacheDelete(current);
  return json({item:pageView(current),changed:Number(page.active_set)!==Number(current.active_set),replayed:Boolean(prior)});
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
    env.VPAGE_DB.prepare('UPDATE vpage_pages SET status=?,expires_at=?,public_generation=public_generation+?,updated_at=? WHERE id=? AND owner_ref=?').bind(status,expiresAt,['suspend','resume','delete'].includes(action)?1:0,now,id,ownerRef)
  ])}catch{return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}
  page={...page,status,expires_at:expiresAt,updated_at:now};
  if(['suspend','resume','delete'].includes(action))await publicCacheDelete(page);
  return json({item:pageView(page),replayed:false});
}

async function publicPage(request,env){
  const url=new URL(request.url),hostname=url.hostname.toLowerCase().replace(/^www\./,''),slug=decodeURIComponent(url.pathname.slice(1));
  if(url.pathname==='/')return html('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Vpage</title><main><h1>บริการเซลเพจเพื่อธุรกิจออนไลน์</h1><p>Vpage by VisionD</p></main></html>');
  if(!validSlug(slug))return html('<h1>ไม่พบหน้า</h1>',404);
  const cache=globalThis.caches?.default,cacheUrl=`https://${hostname}/${slug}`,cacheKey=new Request(cacheUrl),fence=publicFences.get(cacheUrl)||0,route=await env.VPAGE_DB.prepare("SELECT p.id,p.active_set,p.public_generation FROM vpage_pages p JOIN vpage_domains d ON d.id=p.domain_id WHERE d.hostname=? AND d.enabled=1 AND p.slug=? AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP").bind(hostname,slug).first();
  if(!route){if(cache)await cache.delete(cacheKey).catch(()=>{});return html('<h1>ไม่พบหน้า</h1>',404)}
  const generation=String(route.public_generation);if(cache){const cached=await cache.match(cacheKey);if(cached&&cached.headers.get('x-vpage-generation')===generation)return cached;if(cached)await cache.delete(cacheKey).catch(()=>{})}
  const [page,productRows,contactRows]=await Promise.all([env.VPAGE_DB.prepare('SELECT p.id,p.slug,p.display_name,p.active_set,p.public_generation,c.product_image_url,c.detail_text,c.text_size,c.text_style,c.youtube_url,c.background_image_url FROM vpage_pages p JOIN vpage_content_sets c ON c.page_id=p.id AND c.set_no=? WHERE p.id=?').bind(route.active_set,route.id).first(),env.VPAGE_DB.prepare('SELECT position,destination_url,image_url FROM vpage_product_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(route.id,route.active_set).all(),env.VPAGE_DB.prepare('SELECT position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(route.id,route.active_set).all()]);
  if(!page||String(page.public_generation)!==generation)return html('<h1>กรุณาลองใหม่</h1>',503);
  const productItems=(productRows.results||[]).map(item=>({...item,destination_url:httpsUrl(item.destination_url),image_url:httpsUrl(item.image_url,{required:false})})),contactItems=(contactRows.results||[]).map(item=>({...item,destination_url:httpsUrl(item.destination_url,{hosts:item.contact_type==='line'?['line.me']:['facebook.com','m.me']}),image_url:httpsUrl(item.image_url,{required:false})}));
  const size={small:'1rem',medium:'1.2rem',large:'1.55rem'}[page.text_size]||'1.2rem',style={normal:'400',strong:'800',emphasis:'600'}[page.text_style]||'400',youtube=youtubeEmbed(page.youtube_url),background=httpsUrl(page.background_image_url)||'',product=httpsUrl(page.product_image_url)||'';
  if(!page.detail_text||!background||!product||productItems.length<1||contactItems.length<1||productItems.some(item=>!item.destination_url||item.image_url===null)||contactItems.some(item=>!item.destination_url||item.image_url===null))return html(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.display_name)}</title><style>body{font-family:system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#eefaf8;color:#073b38}main{padding:40px;text-align:center}h1{font-size:clamp(36px,8vw,76px)}</style><main><p>VPAGE</p><h1>${escapeHtml(page.display_name)}</h1><p>เซลเพจกำลังพร้อมให้คุณเริ่มสร้างเนื้อหา</p></main></html>`);
  const productLinks=productItems.map((item,index)=>`<a class="item-card" href="${escapeHtml(item.destination_url)}" rel="noopener noreferrer">${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="สินค้า ${index+1} ของ ${escapeHtml(page.display_name)}" loading="lazy">`:''}<span>ดูสินค้า ${index+1}</span></a>`).join(''),contactLinks=contactItems.map((item,index)=>`<a class="item-card" href="${escapeHtml(item.destination_url)}" rel="noopener noreferrer">${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="ช่องทาง ${item.contact_type==='line'?'LINE':'Facebook'} ${index+1} ของ ${escapeHtml(page.display_name)}" loading="lazy">`:''}<span>${item.contact_type==='line'?'LINE':'Facebook'} ${index+1}</span></a>`).join('');
  const response=html(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.display_name)}</title><style>body{font-family:system-ui;margin:0;min-height:100vh;background:#e9f5f3 url('${escapeHtml(background)}') center/cover fixed;color:#073b38}main{box-sizing:border-box;width:min(760px,calc(100% - 28px));margin:32px auto;padding:clamp(24px,6vw,56px);border-radius:28px;background:#fffffff2;box-shadow:0 22px 70px #003d3a38;text-align:center}h1{font-size:clamp(34px,8vw,68px);margin:8px 0 22px}.product{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:22px}.detail{white-space:pre-wrap;font-size:${size};font-weight:${style};font-style:${page.text_style==='emphasis'?'italic':'normal'}}iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:18px}.item-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}.item-card{display:grid;gap:8px;align-content:start;padding:13px;border-radius:16px;background:#08756f;color:#fff;text-decoration:none;font-weight:800}.item-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}</style><main data-active-set="${Number(page.active_set)}"><p>VPAGE</p><h1>${escapeHtml(page.display_name)}</h1><img class="product" src="${escapeHtml(product)}" alt="${escapeHtml(page.display_name)}"><p class="detail">${escapeHtml(page.detail_text)}</p>${youtube?`<section class="video" aria-label="วิดีโอสินค้า"><iframe src="${escapeHtml(youtube)}" title="วิดีโอสินค้า" loading="lazy" allowfullscreen></iframe></section>`:''}<section class="item-list products" aria-label="สินค้า">${productLinks}</section><section class="item-list contacts" aria-label="ช่องทางติดต่อ">${contactLinks}</section></main></html>`,200,{'x-vpage-generation':generation});
  if(cache&&(publicFences.get(cacheUrl)||0)===fence){await cache.put(cacheKey,response.clone()).catch(()=>{});if((publicFences.get(cacheUrl)||0)!==fence)await cache.delete(cacheKey).catch(()=>{})}return response;
}

export default {async fetch(request,env){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/'))return publicPage(request,env);
    if(!path.startsWith('/api/v1/'))return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
    const rawBody=request.method==='GET'||request.method==='HEAD'?'':await request.text();if(encoder.encode(rawBody).byteLength>131072)return json({error:'payload too large',code:'VPAGE_PAYLOAD_TOO_LARGE'},413);
    const auth=await authenticate(request,env,rawBody);if(auth.error)return auth.error;
    if(request.method==='GET'&&path==='/api/v1/domains')return domains(request,env);
    if(request.method==='GET'){const found=await availability(path,env);if(found)return found;const editor=await readEditor(path,env,auth.ownerRef);if(editor)return editor;const page=await readPage(path,env,auth.ownerRef);if(page)return page}
    if(request.method==='POST'&&path==='/api/v1/pages')return createPage(request,env,auth.ownerRef,rawBody);
    if(request.method==='PUT'){const result=await saveContent(request,path,env,auth.ownerRef,rawBody);if(result)return result}
    if(request.method==='POST'){const switched=await switchSet(request,path,env,auth.ownerRef,rawBody);if(switched)return switched;const result=await lifecycle(request,path,env,auth.ownerRef,rawBody);if(result)return result}
    return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
  }catch(error){return json({error:'request failed',code:error?.code||'VPAGE_REQUEST_FAILED'},Number(error?.status)||500)}
}};
