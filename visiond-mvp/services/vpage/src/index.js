import {brandLogoSvg,homepageHtml} from './homepage.js';
import {demoHtml} from './demo.js';

const encoder=new TextEncoder();
export const RESERVED_SLUGS=new Set(['admin','api','login','support','www','cdn-cgi','health','internal','status','demo']);
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY=/^[A-Za-z0-9._:-]{8,128}$/;
const OWNER=/^[a-f0-9]{64}$/;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...headers}});
const html=(body,status=200,headers={})=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, s-maxage=30, must-revalidate','content-security-policy':"default-src 'none'; img-src https:; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}});
const hex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const bytes=value=>Uint8Array.from(String(value).match(/.{2}/g)||[],part=>Number.parseInt(part,16));
const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',value instanceof Uint8Array?value:encoder.encode(value)));
async function boundedBody(request,limit,expected){
  const reader=request.body?.getReader?.();if(!reader)throw Object.assign(new Error('missing body'),{status:400,code:'VPAGE_BODY_MISSING'});
  const chunks=[];let size=0;try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw Object.assign(new Error('payload too large'),{status:413,code:'VPAGE_PAYLOAD_TOO_LARGE'})}chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}
  if(size!==expected)throw Object.assign(new Error('length mismatch'),{status:400,code:'VPAGE_BODY_LENGTH_MISMATCH'});
  const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength}return output;
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const validSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=50&&SLUG.test(value)&&!RESERVED_SLUGS.has(value);
const pageView=page=>({id:page.id,domain_id:page.domain_id,slug:page.slug,display_name:page.display_name,status:page.status,active_set:Number(page.active_set)||1,public_url:`https://${page.hostname}/${page.slug}`,created_at:page.created_at,expires_at:page.expires_at,updated_at:page.updated_at});
const contentView=(row,productItems=[],contactItems=[])=>({set_no:Number(row.set_no),product_image_url:row.product_image_url||'',detail_text:row.detail_text||'',text_size:row.text_size||'medium',text_style:row.text_style||'normal',text_font:row.text_font||'system',text_color:row.text_color||'#073b38',youtube_url:row.youtube_url||'',background_image_url:row.background_image_url||'',background_color:row.background_color||'#e9f5f3',product_items:productItems.map(item=>({position:Number(item.position),destination_url:item.destination_url,image_url:item.image_url||''})),contact_items:contactItems.map(item=>({position:Number(item.position),contact_type:item.contact_type,destination_url:item.destination_url,image_url:item.image_url||''})),revision:Number(row.revision)||0,updated_at:row.updated_at});
const pageSql=`SELECT p.id,p.domain_id,p.owner_ref,p.slug,p.display_name,p.status,p.active_set,p.public_generation,p.create_request_hash,p.created_at,p.expires_at,p.updated_at,d.hostname FROM vpage_pages p JOIN vpage_domains d ON d.id=p.domain_id`;
const httpsUrl=(value,{hosts=null,required=true,max=2048}={})=>{if(!value)return required?null:'';if(typeof value!=='string'||value.length>max)return null;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.href.length>max)return null;const host=url.hostname.toLowerCase();if(hosts&&!hosts.some(item=>host===item||host.endsWith(`.${item}`)))return null;return url.href}catch{return null}};
const safeDestinationHref=value=>{if(typeof value!=='string')return'';let text=value.trim();if(!text||text.length>2048||/[\s\\\u0000-\u001f\u007f]/.test(text))return'';if(!/^https?:\/\//i.test(text)){if(/^[a-z][a-z0-9+.-]*:/i.test(text)||text.startsWith('//'))return'';const host=text.split(/[/?#]/)[0];if(!host.includes('.')||host.includes('@'))return'';text='https://'+text}try{const url=new URL(text);return ['http:','https:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password&&url.href.length<=2048?url.href:''}catch{return''}};
const youtubeId=value=>{if(!value)return'';try{const url=new URL(value),host=url.hostname.toLowerCase();let id='';if(host==='youtu.be')id=url.pathname.slice(1);else if(host==='youtube.com'||host.endsWith('.youtube.com'))id=url.pathname==='/watch'?url.searchParams.get('v')||'':url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]||'':url.pathname.startsWith('/embed/')?url.pathname.split('/')[2]||'':'';return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:''}catch{return''}};
const canonicalYoutube=value=>{if(!value)return'';if(typeof value!=='string'||value!==value.trim())return null;try{const url=new URL(value),id=url.hostname==='www.youtube.com'&&url.pathname==='/watch'?url.searchParams.get('v')||'':'';if(!/^[A-Za-z0-9_-]{6,20}$/.test(id))return null;const canonical=`https://www.youtube.com/watch?v=${id}`;return !url.username&&!url.password&&url.href===canonical&&value===canonical?canonical:null}catch{return null}};
const youtubeEmbed=value=>{const id=youtubeId(value);return id?`https://www.youtube-nocookie.com/embed/${id}`:''};
const publicFences=new Map();
const publicCacheDelete=async page=>{const key=`https://${page.hostname}/${page.slug}`;publicFences.set(key,(publicFences.get(key)||0)+1);if(globalThis.caches?.default)await globalThis.caches.default.delete(new Request(key)).catch(()=>{})};
const actorValid=(value,kind)=>/^[a-f0-9]{64}$/.test(String(value||''))&&['owner','boss'].includes(kind);
const completeSetWhere="c.page_id=? AND c.set_no=? AND c.revision>0 AND length(trim(c.product_image_url))>0 AND length(trim(c.detail_text))>0 AND (length(trim(c.background_image_url))>0 OR length(trim(coalesce(c.background_color,'')))>0) AND (SELECT COUNT(*) FROM vpage_product_items pi WHERE pi.page_id=c.page_id AND pi.set_no=c.set_no) BETWEEN 1 AND 3 AND (SELECT COUNT(*) FROM vpage_contact_items ci WHERE ci.page_id=c.page_id AND ci.set_no=c.set_no) BETWEEN 1 AND 3";
const color=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():null;
const fontFamilies={system:'system-ui',sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'ui-monospace, monospace'};

const destinationText=value=>typeof value==='string'&&value.length>=1&&value.length<=2048?value:null;
function normalizeContent(body,{canonicalYoutubeOnly=false}={}){
  const productImage=httpsUrl(body.product_image_url),backgroundImage=httpsUrl(body.background_image_url,{required:false}),backgroundColor=body.background_color===undefined?undefined:color(body.background_color),textFont=body.text_font===undefined?undefined:String(body.text_font),textColor=body.text_color===undefined?undefined:color(body.text_color),rawYoutube=typeof body.youtube_url==='string'?body.youtube_url.trim():'',youtubeVideoId=youtubeId(rawYoutube),youtubeUrl=canonicalYoutubeOnly?canonicalYoutube(body.youtube_url):rawYoutube?(youtubeVideoId?`https://www.youtube.com/watch?v=${youtubeVideoId}`:null):'';
  const detail=typeof body.detail_text==='string'?body.detail_text.trim():'',textSize=String(body.text_size||''),textStyle=String(body.text_style||'');
  const rawProducts=Array.isArray(body.product_items)?body.product_items:null,rawContacts=Array.isArray(body.contact_items)?body.contact_items:null;
  if(!rawProducts||rawProducts.length<1||rawProducts.length>3||!rawContacts||rawContacts.length<1||rawContacts.length>3)return null;
  const productItems=rawProducts.map((item,index)=>({position:index+1,destination_url:destinationText(item?.destination_url),image_url:httpsUrl(item?.image_url,{required:false})}));
  const contactItems=rawContacts.map((item,index)=>{const contactType=String(item?.contact_type||'');return{position:index+1,contact_type:contactType,destination_url:destinationText(item?.destination_url),image_url:httpsUrl(item?.image_url,{required:false})}});
  if(!productImage||backgroundImage===null||!backgroundImage&&!backgroundColor||backgroundColor===null||textFont!==undefined&&!Object.hasOwn(fontFamilies,textFont)||textColor===null||youtubeUrl===null||detail.length<1||detail.length>4000||!['small','medium','large'].includes(textSize)||!['normal','strong','emphasis'].includes(textStyle)||productItems.some(item=>!item.destination_url||item.image_url===null)||contactItems.some(item=>!['facebook','line'].includes(item.contact_type)||!item.destination_url||item.image_url===null))return null;
  return{product_image_url:productImage,detail_text:detail,text_size:textSize,text_style:textStyle,youtube_url:youtubeUrl,product_url:productItems[0].destination_url,contact_url:contactItems[0].destination_url,background_image_url:backgroundImage,...(backgroundColor!==undefined?{background_color:backgroundColor}:{}),...(textFont!==undefined?{text_font:textFont}:{}),...(textColor!==undefined?{text_color:textColor}:{}),product_items:productItems,contact_items:contactItems};
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

const mediaUrl=id=>`https://smartlinkpage.com/media/${id}`;
function contentMediaRefs(content,setNo){
  const slots=[['hero',content.product_image_url]];if(content.background_image_url)slots.push(['background',content.background_image_url]);
  for(const [index,item] of content.product_items.entries())if(item.image_url)slots.push([`product:${index+1}`,item.image_url]);
  for(const [index,item] of content.contact_items.entries())if(item.image_url)slots.push([`contact:${index+1}`,item.image_url]);
  return slots.map(([slot,url])=>{const match=String(url).match(/^https:\/\/smartlinkpage\.com\/media\/(vpm_[a-f0-9]{32})$/);return{setNo,slot,url,id:match?.[1]||null}});
}
async function verifyContentMedia(env,ownerRef,contentSets,{requireOwned=false}={}){
  // New pages use owned uploads; existing-page edits retain HTTPS compatibility.
  const refs=contentSets.flatMap(item=>contentMediaRefs(item,item.set_no));
  if(requireOwned&&refs.some(item=>!item.id))return null;
  const owned=refs.filter(item=>item.id),ids=[...new Set(owned.map(item=>item.id))];if(!ids.length)return [];
  if(!env.VPAGE_MEDIA)return null;
  const marks=ids.map(()=>'?').join(','),rows=(await env.VPAGE_DB.prepare(`SELECT id,object_key,content_hash,file_size,mime_type FROM vpage_media WHERE owner_ref=? AND state='ready' AND id IN (${marks}) LIMIT 16`).bind(ownerRef,...ids).all()).results||[];
  if(rows.length!==ids.length)return null;
  for(const row of rows){const object=await env.VPAGE_MEDIA.head(row.object_key);if(!object||Number(object.size)!==Number(row.file_size)||object.customMetadata?.sha256!==row.content_hash||object.httpMetadata?.contentType!==row.mime_type)return null}
  return owned;
}
async function ingestMedia(request,env,ownerRef,path,body){
  const match=path.match(/^\/api\/v1\/media\/(vpm_[a-f0-9]{32})$/);
  if(!match||!OWNER.test(ownerRef))return json({error:'invalid media request',code:'VPAGE_MEDIA_INVALID'},400);
  if(!env.VPAGE_MEDIA)return json({error:'media storage unavailable',code:'VPAGE_MEDIA_STORAGE_MISSING'},503);
  const id=match[1],size=body.byteLength,hash=await sha256(body),mime=request.headers.get('content-type'),width=Number(request.headers.get('x-vpage-image-width')),height=Number(request.headers.get('x-vpage-image-height'));
  if(size<1||size>5*1024*1024||mime!=='image/webp'||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>16_777_216)return json({error:'invalid media',code:'VPAGE_MEDIA_INVALID'},422);
  const key=`media/${id}.webp`,existing=await env.VPAGE_DB.prepare('SELECT owner_ref,object_key,content_hash,file_size,width,height,state FROM vpage_media WHERE id=?').bind(id).first();
  if(existing&&(existing.owner_ref!==ownerRef||existing.content_hash!==hash||Number(existing.file_size)!==size||Number(existing.width)!==width||Number(existing.height)!==height||existing.state==='deleted'||existing.state==='deleting'))return json({error:'media conflict',code:'VPAGE_MEDIA_CONFLICT'},409);
  if(!existing){try{await env.VPAGE_DB.prepare("INSERT INTO vpage_media(id,owner_ref,object_key,content_hash,mime_type,file_size,width,height,state) VALUES(?,?,?,?,'image/webp',?,?,?,'pending')").bind(id,ownerRef,key,hash,size,width,height).run()}catch{return json({error:'media in progress',code:'VPAGE_MEDIA_IN_PROGRESS'},409)}}
  const matches=obj=>obj&&Number(obj.size)===size&&obj.customMetadata?.sha256===hash&&obj.httpMetadata?.contentType==='image/webp';
  let stored=await env.VPAGE_MEDIA.head(key);if(!matches(stored)){await env.VPAGE_MEDIA.put(key,body,{httpMetadata:{contentType:'image/webp'},customMetadata:{sha256:hash}});stored=await env.VPAGE_MEDIA.head(key)}
  if(!matches(stored))return json({error:'media storage uncertain',code:'VPAGE_MEDIA_STORAGE_UNCERTAIN'},502);
  await env.VPAGE_DB.prepare("UPDATE vpage_media SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_ref=? AND state='pending'").bind(id,ownerRef).run();
  return json({item:{id,url:mediaUrl(id),width,height,file_size:size,content_hash:hash}},existing?200:201);
}

async function deleteMedia(env,ownerRef,path){
  const match=path.match(/^\/api\/v1\/media\/(vpm_[a-f0-9]{32})$/);if(!match||!OWNER.test(ownerRef))return json({error:'invalid media request',code:'VPAGE_MEDIA_INVALID'},400);
  const id=match[1],row=await env.VPAGE_DB.prepare('SELECT id,object_key,state FROM vpage_media WHERE id=? AND owner_ref=?').bind(id,ownerRef).first();if(!row)return json({error:'not found',code:'VPAGE_MEDIA_NOT_FOUND'},404);
  if(row.state==='deleted')return json({ok:true,id,replayed:true});
  const used=await env.VPAGE_DB.prepare('SELECT 1 used FROM vpage_media_refs INDEXED BY idx_vpage_media_refs_media WHERE media_id=? LIMIT 1').bind(id).first();if(used)return json({error:'media in use',code:'VPAGE_MEDIA_IN_USE'},409);
  if(row.state==='ready'||row.state==='pending')try{await env.VPAGE_DB.prepare("UPDATE vpage_media SET state='deleting',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_ref=? AND state IN ('ready','pending')").bind(id,ownerRef).run()}catch{return json({error:'media in use',code:'VPAGE_MEDIA_IN_USE'},409)}
  try{await env.VPAGE_MEDIA.delete(row.object_key);await env.VPAGE_DB.prepare("UPDATE vpage_media SET state='deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_ref=? AND state='deleting'").bind(id,ownerRef).run();return json({ok:true,id,replayed:false})}catch{return json({error:'delete uncertain',code:'VPAGE_MEDIA_DELETE_UNCERTAIN'},502)}
}

async function publicMedia(request,env,path){
  const match=path.match(/^\/media\/(vpm_[a-f0-9]{32})$/);if(!match)return null;
  const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  if(!['GET','HEAD'].includes(request.method)||!env.VPAGE_MEDIA)return missing();
  const row=await env.VPAGE_DB.prepare("SELECT m.object_key,m.content_hash,m.file_size,m.mime_type FROM vpage_media m JOIN vpage_media_refs r INDEXED BY idx_vpage_media_refs_media ON r.media_id=m.id JOIN vpage_pages p ON p.id=r.page_id AND p.active_set=r.set_no WHERE m.id=? AND m.state='ready' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").bind(match[1]).first();
  if(!row)return missing();const obj=request.method==='HEAD'?await env.VPAGE_MEDIA.head(row.object_key):await env.VPAGE_MEDIA.get(row.object_key);
  if(!obj||Number(obj.size)!==Number(row.file_size)||obj.customMetadata?.sha256!==row.content_hash||obj.httpMetadata?.contentType!==row.mime_type)return missing();
  return new Response(request.method==='HEAD'?null:obj.body,{headers:{'content-type':row.mime_type,'content-length':String(row.file_size),'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'}});
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
  const body=await parseBody(rawBody),displayName=typeof body.display_name==='string'?body.display_name.trim():'',domainId=String(body.domain_id||''),slug=String(body.slug||''),activeSet=Number(body.active_set),rawSets=Array.isArray(body.content_sets)?body.content_sets:null,contentSets=rawSets?.length===2&&rawSets.every((item,index)=>Number(item?.set_no)===index+1)?rawSets.map((item,index)=>{const content=normalizeContent(item,{canonicalYoutubeOnly:true});return content?{set_no:index+1,...content}:null}):null;
  if(displayName.length<1||displayName.length>120||!validSlug(slug)||domainId.length>64||![1,2].includes(activeSet)||!contentSets?.every(Boolean))return json({error:'invalid page details or content',code:'VPAGE_INPUT_INVALID'},400);
  const contentDigest=await sha256(JSON.stringify({active_set:activeSet,content_sets:contentSets})),requestHash=await sha256(JSON.stringify({display_name:displayName,domain_id:domainId,slug,owner_ref:ownerRef,active_set:activeSet,content_sets:contentSets}));
  const existing=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.create_idempotency_key=?`).bind(key).first();
  if(existing){if(existing.create_request_hash!==requestHash)return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);return json({item:pageView(existing),content_digest:contentDigest,replayed:true},200)}
  const mediaRefs=await verifyContentMedia(env,ownerRef,contentSets,{requireOwned:true});if(!mediaRefs)return json({error:'Vpage media unavailable',code:'VPAGE_MEDIA_NOT_READY'},409);
  const domain=await env.VPAGE_DB.prepare('SELECT id,hostname FROM vpage_domains WHERE id=? AND enabled=1').bind(domainId).first();if(!domain)return json({error:'domain unavailable',code:'VPAGE_DOMAIN_UNAVAILABLE'},404);
  const id=`vp_${crypto.randomUUID().replaceAll('-','')}`,createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+30*86400000).toISOString();
  try{await env.VPAGE_DB.batch([
    env.VPAGE_DB.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,active_set,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,'active',?,?,?,?,?,?)").bind(id,domainId,ownerRef,slug,displayName,activeSet,key,requestHash,createdAt,expiresAt,createdAt),
    ...contentSets.flatMap(content=>[
      env.VPAGE_DB.prepare('INSERT INTO vpage_content_sets(page_id,set_no,product_image_url,detail_text,text_size,text_style,text_font,text_color,youtube_url,product_url,contact_url,background_image_url,background_color,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)').bind(id,content.set_no,content.product_image_url,content.detail_text,content.text_size,content.text_style,content.text_font||'system',content.text_color||'#073b38',content.youtube_url,content.product_url,content.contact_url,content.background_image_url,content.background_color||null,createdAt),
      ...content.product_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_product_items(page_id,set_no,position,destination_url,image_url) VALUES(?,?,?,?,?)').bind(id,content.set_no,item.position,item.destination_url,item.image_url)),
      ...content.contact_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_contact_items(page_id,set_no,position,contact_type,destination_url,image_url) VALUES(?,?,?,?,?,?)').bind(id,content.set_no,item.position,item.contact_type,item.destination_url,item.image_url))
    ]),
    ...mediaRefs.map(ref=>env.VPAGE_DB.prepare('INSERT INTO vpage_media_refs(page_id,set_no,slot_key,media_id) VALUES(?,?,?,?)').bind(id,ref.setNo,ref.slot,ref.id))
  ])}
  catch(error){
    const raced=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.create_idempotency_key=?`).bind(key).first();
    if(raced&&raced.create_request_hash===requestHash)return json({item:pageView(raced),content_digest:contentDigest,replayed:true},200);
    if(raced)return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
    const slugTaken=await env.VPAGE_DB.prepare('SELECT id FROM vpage_pages WHERE domain_id=? AND slug=? LIMIT 1').bind(domainId,slug).first();
    if(slugTaken)return json({error:'slug unavailable',code:'VPAGE_SLUG_CONFLICT'},409);
    throw error;
  }
  return json({item:{id,domain_id:domainId,slug,display_name:displayName,status:'active',active_set:activeSet,public_url:`https://${domain.hostname}/${slug}`,created_at:createdAt,expires_at:expiresAt,updated_at:createdAt},content_digest:contentDigest,replayed:false},201);
}

async function readPage(path,env,ownerRef){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})(?:\/status)?$/);if(!match)return null;
  const page=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.id=? AND p.owner_ref=?`).bind(match[1],ownerRef).first();return page?json({item:pageView(page)}):json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
}

async function readEditor(path,env,ownerRef){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/editor$/);if(!match)return null;
  const page=await authorizedPage(env,match[1],ownerRef);if(!page)return json({error:'not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
  const [sets,products,contacts,audit]=await Promise.all([
    env.VPAGE_DB.prepare('SELECT set_no,product_image_url,detail_text,text_size,text_style,text_font,text_color,youtube_url,background_image_url,background_color,revision,updated_at FROM vpage_content_sets WHERE page_id=? ORDER BY set_no LIMIT 2').bind(page.id).all(),
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
  const mediaRefs=await verifyContentMedia(env,page.owner_ref,[{...content,set_no:setNo}]);if(!mediaRefs)return json({error:'Vpage media unavailable',code:'VPAGE_MEDIA_NOT_READY'},409);
  const requestHash=await sha256(JSON.stringify({id,set_no:setNo,expected_revision:expectedRevision,content})),prior=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();
  if(prior&&(prior.page_id!==id||prior.owner_ref!==ownerRef||prior.action!=='save_set'||prior.request_hash!==requestHash))return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);
  if(!prior){const guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;try{await env.VPAGE_DB.batch([
      env.VPAGE_DB.prepare('INSERT INTO vpage_editor_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_content_sets WHERE page_id=? AND set_no=? AND revision=?) THEN ? ELSE NULL END)').bind(id,setNo,expectedRevision,guard),
      env.VPAGE_DB.prepare("INSERT INTO vpage_editor_requests(idempotency_key,page_id,owner_ref,action,request_hash) VALUES(?,?,?,'save_set',?)").bind(key,id,ownerRef,requestHash),
      env.VPAGE_DB.prepare('UPDATE vpage_content_sets SET product_image_url=?,detail_text=?,text_size=?,text_style=?,text_font=?,text_color=?,youtube_url=?,product_url=?,contact_url=?,background_image_url=?,background_color=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE page_id=? AND set_no=? AND revision=?').bind(content.product_image_url,content.detail_text,content.text_size,content.text_style,content.text_font||'system',content.text_color||'#073b38',content.youtube_url,content.product_url,content.contact_url,content.background_image_url,content.background_color||null,id,setNo,expectedRevision),
      env.VPAGE_DB.prepare('DELETE FROM vpage_product_items WHERE page_id=? AND set_no=?').bind(id,setNo),
      ...content.product_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_product_items(page_id,set_no,position,destination_url,image_url) VALUES(?,?,?,?,?)').bind(id,setNo,item.position,item.destination_url,item.image_url)),
      env.VPAGE_DB.prepare('DELETE FROM vpage_contact_items WHERE page_id=? AND set_no=?').bind(id,setNo),
      ...content.contact_items.map(item=>env.VPAGE_DB.prepare('INSERT INTO vpage_contact_items(page_id,set_no,position,contact_type,destination_url,image_url) VALUES(?,?,?,?,?,?)').bind(id,setNo,item.position,item.contact_type,item.destination_url,item.image_url)),
      env.VPAGE_DB.prepare('DELETE FROM vpage_media_refs WHERE page_id=? AND set_no=?').bind(id,setNo),
      ...mediaRefs.map(ref=>env.VPAGE_DB.prepare('INSERT INTO vpage_media_refs(page_id,set_no,slot_key,media_id) VALUES(?,?,?,?)').bind(id,setNo,ref.slot,ref.id)),
      env.VPAGE_DB.prepare('UPDATE vpage_pages SET public_generation=public_generation+1 WHERE id=? AND active_set=?').bind(id,setNo),
      env.VPAGE_DB.prepare('DELETE FROM vpage_editor_guards WHERE token=?').bind(guard)
    ])}catch{const raced=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,action,request_hash FROM vpage_editor_requests WHERE idempotency_key=?').bind(key).first();if(!raced)return json({error:'content changed; reload before saving',code:'VPAGE_CONTENT_REVISION_CONFLICT'},409);if(raced.page_id!==id||raced.owner_ref!==ownerRef||raced.action!=='save_set'||raced.request_hash!==requestHash)return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}}
  const [row,products,contacts]=await Promise.all([env.VPAGE_DB.prepare('SELECT set_no,product_image_url,detail_text,text_size,text_style,text_font,text_color,youtube_url,background_image_url,background_color,revision,updated_at FROM vpage_content_sets WHERE page_id=? AND set_no=?').bind(id,setNo).first(),env.VPAGE_DB.prepare('SELECT position,destination_url,image_url FROM vpage_product_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(id,setNo).all(),env.VPAGE_DB.prepare('SELECT position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(id,setNo).all()]);if(!row)return json({error:'content set missing',code:'VPAGE_CONTENT_SET_MISSING'},409);
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
  const guard=`vg_${crypto.randomUUID().replaceAll('-','')}`;
  try{await env.VPAGE_DB.batch([
    ...(action==='renew'?[env.VPAGE_DB.prepare("INSERT INTO vpage_compensation_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_pages WHERE id=? AND owner_ref=? AND expires_at=?) THEN ? ELSE NULL END)").bind(id,ownerRef,page.expires_at,guard)]:[]),
    env.VPAGE_DB.prepare('INSERT INTO vpage_lifecycle_requests(idempotency_key,page_id,owner_ref,action,request_hash) VALUES(?,?,?,?,?)').bind(key,id,ownerRef,action,requestHash),
    env.VPAGE_DB.prepare('UPDATE vpage_pages SET status=?,expires_at=?,public_generation=public_generation+?,updated_at=? WHERE id=? AND owner_ref=?').bind(status,expiresAt,['suspend','resume','delete'].includes(action)?1:0,now,id,ownerRef),
    ...(action==='renew'?[env.VPAGE_DB.prepare('DELETE FROM vpage_compensation_guards WHERE token=?').bind(guard)]:[])
  ])}catch{return json({error:'request in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}
  page={...page,status,expires_at:expiresAt,updated_at:now};
  if(['suspend','resume','delete'].includes(action))await publicCacheDelete(page);
  return json({item:pageView(page),replayed:false});
}

async function compensate(request,path,env,ownerRef,rawBody){
  const match=path.match(/^\/api\/v1\/pages\/(vp_[a-f0-9]{32})\/compensate$/);if(!match)return null;
  if(ownerRef!=='system')return json({error:'boss operation only',code:'VPAGE_BOSS_REQUIRED'},403);
  const id=match[1],key=String(request.headers.get('idempotency-key')||'').trim(),body=await parseBody(rawBody);
  if(!IDEMPOTENCY.test(key)||!body||typeof body!=='object'||Array.isArray(body)||!OWNER.test(body.owner_ref)||!OWNER.test(body.actor_ref)||!Number.isInteger(body.days)||body.days<1||body.days>365||typeof body.expected_expiry!=='string'||!Number.isFinite(Date.parse(body.expected_expiry))||new Date(body.expected_expiry).toISOString()!==body.expected_expiry)return json({error:'invalid compensation request',code:'VPAGE_COMPENSATION_INVALID'},400);
  const prior=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,actor_ref,days,before_expires_at,after_expires_at FROM vpage_compensation_requests WHERE idempotency_key=?').bind(key).first();
  if(prior){if(prior.page_id!==id||prior.owner_ref!==body.owner_ref||prior.actor_ref!==body.actor_ref||Number(prior.days)!==body.days||prior.before_expires_at!==body.expected_expiry)return json({error:'idempotency conflict',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409);return json({item:{id,expires_at:prior.after_expires_at},before_expires_at:prior.before_expires_at,replayed:true})}
  const page=await env.VPAGE_DB.prepare(`${pageSql} WHERE p.id=? AND p.owner_ref=? AND p.status='active'`).bind(id,body.owner_ref).first();
  if(!page)return json({error:'page not found',code:'VPAGE_PAGE_NOT_FOUND'},404);
  if(page.expires_at!==body.expected_expiry)return json({error:'expiry changed',code:'VPAGE_EXPIRY_CONFLICT'},409);
  const base=Math.max(Date.now(),Date.parse(page.expires_at)),after=new Date(base+body.days*86400000).toISOString(),guard=`vcg_${crypto.randomUUID().replaceAll('-','')}`;
  try{await env.VPAGE_DB.batch([
    env.VPAGE_DB.prepare("INSERT INTO vpage_compensation_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_pages WHERE id=? AND owner_ref=? AND status='active' AND expires_at=?) THEN ? ELSE NULL END)").bind(id,body.owner_ref,page.expires_at,guard),
    env.VPAGE_DB.prepare('INSERT INTO vpage_compensation_requests(idempotency_key,page_id,owner_ref,actor_ref,days,before_expires_at,after_expires_at) VALUES(?,?,?,?,?,?,?)').bind(key,id,body.owner_ref,body.actor_ref,body.days,page.expires_at,after),
    env.VPAGE_DB.prepare("UPDATE vpage_pages SET expires_at=?,updated_at=? WHERE id=? AND owner_ref=? AND status='active' AND expires_at=?").bind(after,new Date().toISOString(),id,body.owner_ref,page.expires_at),
    env.VPAGE_DB.prepare('DELETE FROM vpage_compensation_guards WHERE token=?').bind(guard)
  ])}catch{const raced=await env.VPAGE_DB.prepare('SELECT page_id,owner_ref,actor_ref,days,before_expires_at,after_expires_at FROM vpage_compensation_requests WHERE idempotency_key=?').bind(key).first();if(raced&&raced.page_id===id&&raced.owner_ref===body.owner_ref&&raced.actor_ref===body.actor_ref&&Number(raced.days)===body.days&&raced.before_expires_at===body.expected_expiry)return json({item:{id,expires_at:raced.after_expires_at},before_expires_at:raced.before_expires_at,replayed:true});return json({error:'compensation in progress',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},409)}
  await publicCacheDelete(page);return json({item:{id,expires_at:after},before_expires_at:page.expires_at,replayed:false});
}

async function publicPage(request,env){
  const url=new URL(request.url),hostname=url.hostname.toLowerCase().replace(/^www\./,''),slug=decodeURIComponent(url.pathname.slice(1));
  if(url.pathname==='/')return html(homepageHtml,200,{'content-security-policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'permissions-policy':'camera=(), microphone=(), geolocation=()','cross-origin-opener-policy':'same-origin'});
  if(url.pathname==='/demo')return html(demoHtml,200,{'content-security-policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'permissions-policy':'camera=(), microphone=(), geolocation=()','cross-origin-opener-policy':'same-origin'});
  if(url.pathname==='/smartlinkpage-logo.svg')return new Response(brandLogoSvg,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=604800, immutable','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  if(!validSlug(slug))return html('<h1>ไม่พบหน้า</h1>',404);
  const cache=globalThis.caches?.default,cacheUrl=`https://${hostname}/${slug}`,cacheKey=new Request(cacheUrl),fence=publicFences.get(cacheUrl)||0,route=await env.VPAGE_DB.prepare("SELECT p.id,p.active_set,p.public_generation FROM vpage_pages p JOIN vpage_domains d ON d.id=p.domain_id WHERE d.hostname=? AND d.enabled=1 AND p.slug=? AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP").bind(hostname,slug).first();
  if(!route){if(cache)await cache.delete(cacheKey).catch(()=>{});return html('<h1>ไม่พบหน้า</h1>',404)}
  const generation=String(route.public_generation);if(cache){const cached=await cache.match(cacheKey);if(cached&&cached.headers.get('x-vpage-generation')===generation)return cached;if(cached)await cache.delete(cacheKey).catch(()=>{})}
  const [page,productRows,contactRows]=await Promise.all([env.VPAGE_DB.prepare('SELECT p.id,p.slug,p.display_name,p.active_set,p.public_generation,c.product_image_url,c.detail_text,c.text_size,c.text_style,c.text_font,c.text_color,c.youtube_url,c.background_image_url,c.background_color FROM vpage_pages p JOIN vpage_content_sets c ON c.page_id=p.id AND c.set_no=? WHERE p.id=?').bind(route.active_set,route.id).first(),env.VPAGE_DB.prepare('SELECT position,destination_url,image_url FROM vpage_product_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(route.id,route.active_set).all(),env.VPAGE_DB.prepare('SELECT position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').bind(route.id,route.active_set).all()]);
  if(!page||String(page.public_generation)!==generation)return html('<h1>กรุณาลองใหม่</h1>',503);
  const productItems=(productRows.results||[]).map(item=>({...item,destination_url:safeDestinationHref(item.destination_url),image_url:httpsUrl(item.image_url,{required:false})})),contactItems=(contactRows.results||[]).map(item=>({...item,destination_url:safeDestinationHref(item.destination_url),image_url:httpsUrl(item.image_url,{required:false})}));
  const size={small:'1rem',medium:'1.2rem',large:'1.55rem'}[page.text_size]||'1.2rem',style={normal:'400',strong:'800',emphasis:'600'}[page.text_style]||'400',youtube=youtubeEmbed(page.youtube_url),background=httpsUrl(page.background_image_url)||'',backgroundColor=color(page.background_color)||'#e9f5f3',textColor=color(page.text_color)||'#073b38',font=fontFamilies[page.text_font]||fontFamilies.system,product=httpsUrl(page.product_image_url)||'';
  const rgb=[1,3,5].map(index=>Number.parseInt(textColor.slice(index,index+2),16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4),lightText=1.05/(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]+.05)<4.5,panelColor=lightText?'#000':'#fffffff2';
  if(!page.detail_text||!background&&!color(page.background_color)||!product||productItems.length<1||contactItems.length<1||productItems.some(item=>item.image_url===null)||contactItems.some(item=>item.image_url===null))return html(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.display_name)}</title><style>body{font-family:system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#eefaf8;color:#073b38}main{padding:40px;text-align:center}h1{font-size:clamp(36px,8vw,76px)}</style><main><p>VPAGE</p><h1>${escapeHtml(page.display_name)}</h1><p>เซลเพจกำลังพร้อมให้คุณเริ่มสร้างเนื้อหา</p></main></html>`);
  const nonce=crypto.randomUUID().replaceAll('-','');
  const shareScript=`<style>.item-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px;min-width:0}.item-row .item-card{min-width:0}.share-link{padding:10px;border:1px solid #08756f;border-radius:10px;background:#fff;color:#075e59;font:inherit;font-weight:800;cursor:pointer}.item-row [role=status]{grid-column:1/-1;color:#075e59}.item-row [role=status]:empty{display:none}</style><script nonce="${nonce}">document.addEventListener('click',async event=>{const button=event.target.closest('[data-share-url]');if(!button)return;const url=button.dataset.shareUrl,status=button.parentElement.querySelector('[role="status"]');try{if(navigator.share){await navigator.share({url});status.textContent='แชร์ลิงก์แล้ว';return}}catch(error){if(error.name==='AbortError'){status.textContent='ยกเลิกการแชร์';return}}try{await navigator.clipboard.writeText(url);status.textContent='คัดลอกลิงก์แล้ว'}catch{const field=document.createElement('textarea');field.value=url;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();let copied=false;try{copied=Boolean(document.execCommand?.('copy'))}catch{}finally{field.remove()}status.textContent=copied?'คัดลอกลิงก์แล้ว':'คัดลอกไม่ได้ กรุณาเปิดลิงก์เพื่อคัดลอก'}});</script>`;
  const linkCard=(item,label,imageAlt)=>!item.destination_url?'':`<div class="item-row"><a class="item-card" href="${escapeHtml(item.destination_url)}" rel="noopener noreferrer">${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(imageAlt)}" loading="lazy">`:''}<span>${escapeHtml(label)}</span></a><button type="button" class="share-link" data-share-url="${escapeHtml(item.destination_url)}" aria-label="แชร์ลิงก์${escapeHtml(label)}">แชร์</button><small role="status" aria-live="polite"></small></div>`;
  const productLinks=productItems.map((item,index)=>linkCard(item,`ดูสินค้า ${index+1}`,`สินค้า ${index+1} ของ ${page.display_name}`)).join(''),contactLinks=contactItems.map((item,index)=>linkCard(item,`${item.contact_type==='line'?'LINE':'Facebook'} ${index+1}`,`ช่องทาง ${item.contact_type==='line'?'LINE':'Facebook'} ${index+1} ของ ${page.display_name}`)).join('')+shareScript;
  const response=html(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.display_name)}</title><style>body{font-family:${font};margin:0;min-height:100vh;background:${backgroundColor}${background?` url('${escapeHtml(background)}') center/cover fixed`:''};color:${textColor}}main{box-sizing:border-box;width:min(760px,calc(100% - 28px));margin:32px auto;padding:clamp(24px,6vw,56px);border-radius:28px;background:${panelColor};box-shadow:0 22px 70px #003d3a38;text-align:center}h1{font-size:clamp(34px,8vw,68px);margin:8px 0 22px}.product{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:22px}.detail{white-space:pre-wrap;font-size:${size};font-weight:${style};font-style:${page.text_style==='emphasis'?'italic':'normal'}}iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:18px}.item-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}.item-card{display:grid;gap:8px;align-content:start;padding:13px;border-radius:16px;background:#08756f;color:#fff;text-decoration:none;font-weight:800}.item-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}</style><main data-active-set="${Number(page.active_set)}"><p>VPAGE</p><h1>${escapeHtml(page.display_name)}</h1><img class="product" src="${escapeHtml(product)}" alt="${escapeHtml(page.display_name)}"><p class="detail">${escapeHtml(page.detail_text)}</p>${youtube?`<section class="video" aria-label="วิดีโอสินค้า"><iframe src="${escapeHtml(youtube)}" title="วิดีโอสินค้า" loading="lazy" allowfullscreen></iframe></section>`:''}<section class="item-list products" aria-label="สินค้า">${productLinks}</section><section class="item-list contacts" aria-label="ช่องทางติดต่อ">${contactLinks}</section></main></html>`,200,{'x-vpage-generation':generation});
  response.headers.set('content-security-policy',`default-src 'none'; img-src https:; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  if(cache&&(publicFences.get(cacheUrl)||0)===fence){await cache.put(cacheKey,response.clone()).catch(()=>{});if((publicFences.get(cacheUrl)||0)!==fence)await cache.delete(cacheKey).catch(()=>{})}return response;
}

export default {async fetch(request,env){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/'))return await publicMedia(request,env,path)||publicPage(request,env);
    if(!path.startsWith('/api/v1/'))return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
    const binaryMedia=request.method==='PUT'&&/^\/api\/v1\/media\/vpm_[a-f0-9]{32}$/.test(path),declaredLength=Number(request.headers.get('content-length'));
    if(binaryMedia&&(!Number.isSafeInteger(declaredLength)||declaredLength<1||declaredLength>5*1024*1024))return json({error:'invalid media length',code:'VPAGE_MEDIA_LENGTH_INVALID'},413);
    const rawBody=request.method==='GET'||request.method==='HEAD'?'':binaryMedia?await boundedBody(request,5*1024*1024,declaredLength):await request.text();if((binaryMedia?rawBody.byteLength:encoder.encode(rawBody).byteLength)>(binaryMedia?5*1024*1024:131072))return json({error:'payload too large',code:'VPAGE_PAYLOAD_TOO_LARGE'},413);
    const auth=await authenticate(request,env,rawBody);if(auth.error)return auth.error;
    if(binaryMedia)return ingestMedia(request,env,auth.ownerRef,path,rawBody);
    if(request.method==='DELETE'&&/^\/api\/v1\/media\/vpm_[a-f0-9]{32}$/.test(path))return deleteMedia(env,auth.ownerRef,path);
    if(request.method==='GET'&&path==='/api/v1/domains')return domains(request,env);
    if(request.method==='GET'){const found=await availability(path,env);if(found)return found;const editor=await readEditor(path,env,auth.ownerRef);if(editor)return editor;const page=await readPage(path,env,auth.ownerRef);if(page)return page}
    if(request.method==='POST'&&path==='/api/v1/pages')return createPage(request,env,auth.ownerRef,rawBody);
    if(request.method==='PUT'){const result=await saveContent(request,path,env,auth.ownerRef,rawBody);if(result)return result}
    if(request.method==='POST'){const switched=await switchSet(request,path,env,auth.ownerRef,rawBody);if(switched)return switched;const compensated=await compensate(request,path,env,auth.ownerRef,rawBody);if(compensated)return compensated;const result=await lifecycle(request,path,env,auth.ownerRef,rawBody);if(result)return result}
    return json({error:'not found',code:'VPAGE_NOT_FOUND'},404);
  }catch(error){return json({error:'request failed',code:error?.code||'VPAGE_REQUEST_FAILED'},Number(error?.status)||500)}
}};
