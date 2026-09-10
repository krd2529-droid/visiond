import {cookie,json,sha256,requireUser} from './_lib.js';
import {requireVxUser} from './_vx_access.js';
import {rateLimit,requestIp} from './_security.js';
import {issueHandoff,handoffLiveSql} from './_tiktok_handoff.js';
import {canonicalTikTokProfileSlot as uuid} from './_tiktok_oauth.js';
import {launcherRandom,launcherHex,sealLauncher,openLauncher,helperAAD,commandAAD,launcherCanonical,launcherMac,equalLauncherMac} from './_browser_launcher_crypto.js';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const reply=(body,status=200)=>json(body,status,headers);
const fail=(status=400,code='LAUNCHER_REQUEST_INVALID')=>reply({error:code},status);
const session=r=>cookie(r,'vd_session');
const exact=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).sort().join(',')===[...keys].sort().join(',');
const origin=r=>r.headers.get('origin')===new URL(r.url).origin&&['same-origin',null].includes(r.headers.get('sec-fetch-site'));
const secretFor=(env,h)=>openLauncher(env,h.secret_cipher,helperAAD(h));
async function allowPairCode(env,request,userId){
 // Each increment is atomic: simultaneous guesses cannot reuse a stale hits value.
 for(const key of ['launcher_code:ip:'+await sha256(requestIp(request)),'launcher_code:user:'+await sha256(String(userId))]){
  const row=await env.DB.prepare("INSERT INTO security_rate_limits(rate_key,hits,window_start,blocked_until) VALUES(?,1,CURRENT_TIMESTAMP,NULL) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN window_start<=datetime('now','-5 minutes') THEN 1 ELSE hits+1 END,window_start=CASE WHEN window_start<=datetime('now','-5 minutes') THEN CURRENT_TIMESTAMP ELSE window_start END RETURNING hits").bind(key).first();
  if(!row||row.hits>10)return false;
 }
 return true;
}
const pairLive=`EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.id=? AND s.expires_at>CURRENT_TIMESTAMP AND ((?='admin' AND u.role IN ('boss','admin')) OR (?='paid' AND EXISTS(SELECT 1 FROM vx_access_grants g JOIN orders o ON o.id=g.order_id WHERE g.order_id=? AND g.user_id=u.id AND o.status='paid' AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP)) OR (?='review' AND u.role='user' AND COALESCE(u.is_test_user,0)=0 AND EXISTS(SELECT 1 FROM vx_review_access_grants g WHERE g.id=? AND g.user_id=u.id AND g.scope='tiktok_app_review' AND g.revoked_at IS NULL AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP))))`;
const pairLiveArgs=(request,auth)=>{const source=auth.vx.admin?'admin':auth.vx.access_source;return[session(request),auth.user.id,source,source,auth.vx.order_id||null,source,auth.vx.id||null]};
const liveView=`EXISTS(SELECT 1 FROM sessions s WHERE s.id=c.session_id AND s.user_id=c.user_id AND s.expires_at>CURRENT_TIMESTAMP) AND EXISTS(SELECT 1 FROM tiktok_channels ch WHERE ch.id=c.channel_id AND ch.created_by=c.user_id AND ch.archived_at IS NULL)
 AND EXISTS(SELECT 1 FROM users u WHERE u.id=c.user_id AND ((c.access_source='admin' AND u.role IN ('boss','admin')) OR (c.access_source='paid' AND EXISTS(SELECT 1 FROM vx_access_grants g JOIN orders o ON o.id=g.order_id WHERE g.order_id=c.access_id AND g.user_id=u.id AND o.status='paid' AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP)) OR (c.access_source='review' AND u.role='user' AND COALESCE(u.is_test_user,0)=0 AND EXISTS(SELECT 1 FROM vx_review_access_grants g WHERE g.id=c.access_id AND g.user_id=u.id AND g.revoked_at IS NULL AND g.scope='tiktok_app_review' AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP))))
 AND NOT EXISTS(SELECT 1 FROM tiktok_browser_profile_bindings b WHERE b.channel_id=c.channel_id AND (b.user_id<>c.user_id OR b.slot_id<>c.slot_id OR b.profile_kind<>c.profile_kind))`;
const liveCommand=`EXISTS(SELECT 1 FROM browser_launcher_helpers h WHERE h.id=c.helper_id AND h.user_id=c.user_id AND h.key_version=c.key_version AND h.status='active') AND ((c.intent='view' AND ${liveView}) OR (c.intent='oauth' AND EXISTS(SELECT 1 FROM tiktok_oauth_handoffs f WHERE f.id=c.handoff_id AND f.user_id=c.user_id AND f.session_id=c.session_id AND f.status IN ('issued','redeemed','processing','complete') AND f.expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql})))`;
export async function launcherIssue(ctx){
 if(!origin(ctx.request))return fail(403);
 const auth=await requireVxUser(ctx);if(auth.error)return auth.error;
 const body=await ctx.request.json().catch(()=>null);
 if(!exact(body,['helper_id','command_id','provider','intent','channel_id'])||!uuid(body.helper_id)||!uuid(body.command_id)||!['new','reconnect','view'].includes(body.intent))return fail();
 const requestHash=await sha256(JSON.stringify([body.helper_id,body.provider,body.intent,body.channel_id]));
 if(await ctx.env.DB.prepare('SELECT id FROM browser_launcher_cancelled WHERE id=?').bind(body.command_id).first())return fail(409,'LAUNCHER_COMMAND_CANCELLED');
 const old=await ctx.env.DB.prepare('SELECT id,status,request_hash FROM browser_launcher_commands WHERE id=? AND user_id=? AND session_id=?').bind(body.command_id,auth.user.id,session(ctx.request)).first();
 if(old)return old.request_hash===requestHash?reply({command_id:old.id,status:old.status}):fail(409,'LAUNCHER_REQUEST_CONFLICT');
 const helper=await ctx.env.DB.prepare("SELECT id,key_version,port FROM browser_launcher_helpers WHERE id=? AND user_id=? AND status='active'").bind(body.helper_id,auth.user.id).first();if(!helper)return fail(409,'LAUNCHER_PAIRING_REQUIRED');
 if(body.intent==='view'){
  if(!uuid(body.channel_id))return fail();
  const channel=await ctx.env.DB.prepare('SELECT ch.id,b.slot_id,b.profile_kind,b.user_id FROM tiktok_channels ch LEFT JOIN tiktok_browser_profile_bindings b ON b.channel_id=ch.id WHERE ch.id=? AND ch.created_by=? AND ch.archived_at IS NULL').bind(body.channel_id,auth.user.id).first();if(!channel||channel.user_id!=null&&Number(channel.user_id)!==Number(auth.user.id))return fail(404);
  const source=auth.vx.admin?'admin':auth.vx.access_source;
  await ctx.env.DB.batch([ctx.env.DB.prepare("INSERT INTO browser_launcher_commands(id,helper_id,key_version,user_id,session_id,request_hash,intent,ticket_cipher,channel_id,slot_id,profile_kind,access_source,access_id,expires_at) VALUES(?,?,?,?,?,?,'view','',?,?,?,?,?,datetime('now','+2 minutes'))").bind(body.command_id,helper.id,helper.key_version,auth.user.id,session(ctx.request),requestHash,channel.id,channel.slot_id||channel.id,channel.profile_kind||'channel',source,auth.vx.order_id||auth.vx.id||null),ctx.env.DB.prepare(`INSERT INTO browser_launcher_guard(id) VALUES((SELECT c.id FROM browser_launcher_commands c WHERE c.id=? AND ${liveCommand}))`).bind(body.command_id),ctx.env.DB.prepare('DELETE FROM browser_launcher_guard WHERE id=?').bind(body.command_id)]);
  return reply({command_id:body.command_id,port:helper.port,status:'pending'});
 }
 const handoffRequest=new Request(ctx.request.url,{method:'POST',headers:ctx.request.headers,body:JSON.stringify({provider:body.provider,intent:body.intent==='view'?'reconnect':body.intent,channel_id:body.channel_id})});
 let handoffResponse;try{handoffResponse=await issueHandoff({...ctx,request:handoffRequest})}catch(e){if(String(e.message).includes('LAUNCHER_COMMAND_BUSY'))return fail(409,'LAUNCHER_COMMAND_BUSY');throw e}
 if(!handoffResponse.ok)return handoffResponse;
 const flow=await handoffResponse.json(),command={id:body.command_id,user_id:auth.user.id,helper_id:helper.id,key_version:helper.key_version};
 const cipher=await sealLauncher(ctx.env,flow.ticket,commandAAD(command));
 const statements=[ctx.env.DB.prepare(`INSERT INTO browser_launcher_commands(id,helper_id,key_version,user_id,session_id,request_hash,handoff_id,intent,ticket_cipher,expires_at)
 SELECT ?,?,?,?,?,?,?,?,?,datetime('now','+2 minutes') WHERE EXISTS(SELECT 1 FROM browser_launcher_helpers h WHERE h.id=? AND h.user_id=? AND h.key_version=? AND h.status='active') AND EXISTS(SELECT 1 FROM tiktok_oauth_handoffs f WHERE f.id=? AND f.status='issued' AND ${handoffLiveSql})`).bind(command.id,helper.id,helper.key_version,auth.user.id,session(ctx.request),requestHash,flow.id,'oauth',cipher,helper.id,auth.user.id,helper.key_version,flow.id),
 ctx.env.DB.prepare("DELETE FROM browser_launcher_commands WHERE id IN (SELECT id FROM browser_launcher_commands WHERE expires_at<datetime('now','-1 day') ORDER BY expires_at,id LIMIT 24)"),
 ctx.env.DB.prepare("DELETE FROM browser_launcher_nonces WHERE id IN (SELECT id FROM browser_launcher_nonces WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,id LIMIT 24)")];
 const result=await ctx.env.DB.batch(statements);if(result[0].meta?.changes!==1)return fail(409);
 return reply({command_id:command.id,port:helper.port,status:'pending'});
}
async function userContext(ctx){if(!origin(ctx.request))return {error:fail(403)};return requireVxUser(ctx)}
export async function launcherRoute(ctx){
 const action=ctx.params.action,request=ctx.request,url=new URL(request.url);
 if(request.method==='GET'){
  const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  if(action==='helpers'){
   const after=url.searchParams.get('after')||'';if(after&&!uuid(after))return fail();
   const rows=await ctx.env.DB.prepare("SELECT id,port,key_version,created_at FROM browser_launcher_helpers WHERE user_id=? AND status='active' AND id>? ORDER BY id LIMIT 25").bind(auth.user.id,after).all(),items=(rows.results||[]).slice(0,24),has_more=(rows.results||[]).length>24;return reply({items,has_more,next_cursor:has_more?items.at(-1).id:null});
  }
  if(action==='status'){
   const id=url.searchParams.get('command_id');if(!uuid(id))return fail();
   const row=await ctx.env.DB.prepare(`SELECT c.id command_id,h.port,c.status,c.expires_at,c.intent,f.id handoff_id,f.slot_id,f.status oauth_status,CASE WHEN f.provider IN ('tiktok','shop') THEN f.provider ELSE NULL END oauth_provider,CASE WHEN f.continuation IN ('shop','') THEN f.continuation ELSE NULL END oauth_continuation,CASE WHEN f.status='complete' THEN b.channel_id ELSE '' END channel_id,
    CASE WHEN c.expires_at<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END expired
    FROM browser_launcher_commands c JOIN browser_launcher_helpers h ON h.id=c.helper_id AND h.user_id=c.user_id AND h.status='active' LEFT JOIN tiktok_oauth_handoffs f ON f.id=c.handoff_id LEFT JOIN tiktok_browser_profile_bindings b ON b.slot_id=f.slot_id AND b.user_id=c.user_id
    WHERE c.id=? AND c.user_id=? AND c.session_id=?`).bind(id,auth.user.id,session(request)).first();
   return reply(row||{status:'waiting',oauth_provider:null,oauth_continuation:null});
  }
  return fail(404);
 }
 if(request.method!=='POST'||request.headers.get('content-type')?.split(';')[0]!=='application/json')return fail(405);
 const raw=await request.text();if(raw.length>4096)return fail(413);let body;try{body=JSON.parse(raw)}catch{return fail()}
 if(action==='cancel'){
  const auth=await userContext(ctx);if(auth.error)return auth.error;
  if(!exact(body,['command_id'])||!uuid(body.command_id))return fail();
  // A tombstone also cancels a slow bootstrap that has not inserted its command yet.
  // Insert and claim serialize in SQLite; an acknowledged/ambiguous launch is never cancelled.
  await ctx.env.DB.batch([
   ctx.env.DB.prepare(`INSERT INTO browser_launcher_guard(id) VALUES((SELECT ? WHERE NOT EXISTS(SELECT 1 FROM browser_launcher_commands c WHERE c.id=? AND (c.user_id<>? OR c.session_id<>? OR (c.status NOT IN ('pending','failed','cancelled') AND c.expires_at>CURRENT_TIMESTAMP)))))`).bind(body.command_id,body.command_id,auth.user.id,session(request)),
   ctx.env.DB.prepare('INSERT INTO browser_launcher_cancelled(id,user_id,session_id) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.command_id,auth.user.id,session(request)),
   ctx.env.DB.prepare("UPDATE browser_launcher_commands SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND session_id=?").bind(body.command_id,auth.user.id,session(request)),
   ctx.env.DB.prepare("DELETE FROM browser_launcher_cancelled WHERE id IN (SELECT id FROM browser_launcher_cancelled WHERE created_at<datetime('now','-1 day') ORDER BY created_at,id LIMIT 24)"),
   ctx.env.DB.prepare('DELETE FROM browser_launcher_guard WHERE id=?').bind(body.command_id)
  ]);
  return reply({status:'cancelled'});
 }
 if(action==='pair-stage'){
  const replaces=body?.replaces_helper_id||'';
  const code=body?.pair_code,modern=typeof code==='string'&&code.length===12&&/^[A-F0-9]{12}$/.test(code);
  if(request.headers.has('origin')||!exact(body,['helper_id','owner_hash','port','secret','pair_code',...(Object.hasOwn(body||{},'replaces_helper_id')?['replaces_helper_id']:[])])||!uuid(body.helper_id)||!launcherHex(body.owner_hash)||!launcherHex(body.secret)||(!modern&&!(typeof code==='string'&&code.length===8&&/^[A-F0-9]{8}$/.test(code)))||!Number.isInteger(body.port)||body.port<49152||body.port>65535||Object.hasOwn(body||{},'replaces_helper_id')&&(!modern||!uuid(replaces)||replaces===body.helper_id))return fail();
  const limited=await rateLimit(ctx.env,request,'launcher_pair',5,10,10);if(limited.error)return limited.error;
  const existing=await ctx.env.DB.prepare('SELECT * FROM browser_launcher_helpers WHERE id=?').bind(body.helper_id).first();
  if(existing){
   if(existing.owner_hash!==body.owner_hash||existing.port!==body.port||!equalLauncherMac(await secretFor(ctx.env,existing),body.secret)||existing.status==='revoked')return fail(409);
   if(existing.status==='active')return reply({pair_id:existing.id,paired:true});
   if((existing.replaces_helper_id||'')!==replaces)return fail(409);
   if(existing.pair_code===code){
    if(modern&&Date.parse(existing.expires_at.replace(' ','T')+'Z')<=Date.now())return fail(409);
    if(modern||Date.parse(existing.expires_at.replace(' ','T')+'Z')>Date.now())return reply({pair_id:existing.id,paired:false});
   }else if(!modern)return fail(409);
   const cipher=await sealLauncher(ctx.env,body.secret,helperAAD({id:existing.id,user_id:0,key_version:existing.key_version}));
   const changed=await ctx.env.DB.prepare("UPDATE browser_launcher_helpers SET user_id=NULL,session_id=NULL,confirm_nonce=NULL,secret_cipher=?,pair_code=?,status='staged',expires_at=datetime('now','+5 minutes') WHERE id=? AND status=? AND pair_code=? AND expires_at=? AND COALESCE(user_id,0)=? AND COALESCE(session_id,'')=? AND COALESCE(confirm_nonce,'')=?").bind(cipher,code,existing.id,existing.status,existing.pair_code,existing.expires_at,existing.user_id||0,existing.session_id||'',existing.confirm_nonce||'').run();
   return changed.meta?.changes===1?reply({pair_id:existing.id,paired:false}):fail(409);
  }
  if(replaces&&!await ctx.env.DB.prepare("SELECT id FROM browser_launcher_helpers WHERE id=? AND owner_hash=? AND status='active'").bind(replaces,body.owner_hash).first())return fail(409);
  const h={id:body.helper_id,user_id:0,key_version:1},cipher=await sealLauncher(ctx.env,body.secret,helperAAD(h));
  await ctx.env.DB.batch([ctx.env.DB.prepare("DELETE FROM browser_launcher_helpers WHERE id IN (SELECT id FROM browser_launcher_helpers WHERE status IN ('staged','prepared') AND expires_at<=CURRENT_TIMESTAMP ORDER BY status,expires_at,id LIMIT 24)"),
   ctx.env.DB.prepare("INSERT INTO browser_launcher_helpers(id,owner_hash,port,secret_cipher,pair_code,status,expires_at,replaces_helper_id) VALUES(?,?,?,?,?,'staged',datetime('now','+5 minutes'),?)").bind(h.id,body.owner_hash,body.port,cipher,code,replaces||null)]);
  return reply({pair_id:h.id,paired:false});
 }
 if(['pair-prepare','pair-prepare-code','pair-confirm'].includes(action)){
  const auth=await userContext(ctx);if(auth.error)return auth.error;
  let h;
  if(action==='pair-prepare-code'){
   if(!exact(body,['pair_code'])||typeof body.pair_code!=='string'||body.pair_code.length!==12||!/^[A-F0-9]{12}$/.test(body.pair_code))return fail();
   if(!await allowPairCode(ctx.env,request,auth.user.id))return fail(429,'LAUNCHER_TRY_LATER');
   const rows=await ctx.env.DB.prepare("SELECT * FROM browser_launcher_helpers WHERE pair_code=? AND status IN ('staged','prepared') AND expires_at>CURRENT_TIMESTAMP ORDER BY status,expires_at,id LIMIT 2").bind(body.pair_code).all();
   if(rows.results?.length!==1)return fail(409);h=rows.results[0];
  }else{
   if(!uuid(body?.pair_id))return fail();
   h=await ctx.env.DB.prepare("SELECT * FROM browser_launcher_helpers WHERE id=? AND status IN ('staged','prepared') AND expires_at>CURRENT_TIMESTAMP").bind(body.pair_id).first();if(!h)return fail(409);
  }
  if(action!=='pair-confirm'){
   if(h.replaces_helper_id&&!await ctx.env.DB.prepare("SELECT id FROM browser_launcher_helpers WHERE id=? AND user_id=? AND owner_hash=? AND status='active'").bind(h.replaces_helper_id,auth.user.id,h.owner_hash).first())return fail(409);
   if(action==='pair-prepare'&&(!exact(body,['pair_id'])||h.pair_code.length!==8))return fail(409);
   if(h.status==='prepared'&&(Number(h.user_id)!==Number(auth.user.id)||h.session_id!==session(request)))return fail(409);
   const nonce=h.confirm_nonce||launcherRandom(),secret=await secretFor(ctx.env,h),bound={...h,user_id:auth.user.id},cipher=await sealLauncher(ctx.env,secret,helperAAD(bound));
   const result=await ctx.env.DB.prepare(`UPDATE browser_launcher_helpers SET user_id=?,session_id=?,confirm_nonce=?,secret_cipher=?,status='prepared' WHERE id=? AND pair_code=? AND expires_at=? AND expires_at>CURRENT_TIMESTAMP AND COALESCE(confirm_nonce,'')=? AND (status='staged' OR (status='prepared' AND user_id=? AND session_id=?)) AND (replaces_helper_id IS NULL OR EXISTS(SELECT 1 FROM browser_launcher_helpers old WHERE old.id=browser_launcher_helpers.replaces_helper_id AND old.user_id=? AND old.owner_hash=browser_launcher_helpers.owner_hash AND old.status='active')) AND ${pairLive}`).bind(auth.user.id,session(request),nonce,cipher,h.id,h.pair_code,h.expires_at,h.confirm_nonce||'',auth.user.id,session(request),auth.user.id,...pairLiveArgs(request,auth)).run();if(result.meta?.changes!==1)return fail(409);
   const prior=await ctx.env.DB.prepare("SELECT id,created_at FROM browser_launcher_helpers WHERE user_id=? AND owner_hash=? AND status='active' ORDER BY id LIMIT 1").bind(auth.user.id,h.owner_hash).first();
   return reply({pair_id:h.id,pair_code:h.pair_code,confirm_nonce:nonce,replace_id:prior?.id||'',port:h.port});
  }
  if(!exact(body,['pair_id','confirm_nonce','pair_code','replace_id'])||body.confirm_nonce!==h.confirm_nonce||body.pair_code!==h.pair_code||h.status!=='prepared'||Number(h.user_id)!==Number(auth.user.id)||h.session_id!==session(request)||body.replace_id&&!uuid(body.replace_id))return fail(409);
  const guard=ctx.env.DB.prepare(`INSERT INTO browser_launcher_guard(id) VALUES((SELECT id FROM browser_launcher_helpers WHERE id=? AND status='prepared' AND user_id=? AND session_id=? AND confirm_nonce=? AND pair_code=? AND expires_at=? AND expires_at>CURRENT_TIMESTAMP AND (replaces_helper_id IS NULL OR replaces_helper_id=?) AND ${pairLive} AND NOT EXISTS(SELECT 1 FROM browser_launcher_helpers old WHERE old.user_id=? AND old.owner_hash=? AND old.status='active' AND old.id<>?) AND (?='' OR EXISTS(SELECT 1 FROM browser_launcher_helpers old WHERE old.id=? AND old.user_id=? AND old.owner_hash=? AND old.status='active'))))`).bind(h.id,auth.user.id,session(request),body.confirm_nonce,body.pair_code,h.expires_at,body.replace_id,...pairLiveArgs(request,auth),auth.user.id,h.owner_hash,body.replace_id,body.replace_id,body.replace_id,auth.user.id,h.owner_hash);
  await ctx.env.DB.batch([guard,ctx.env.DB.prepare("UPDATE browser_launcher_helpers SET status='revoked' WHERE id=? AND user_id=? AND owner_hash=? AND status='active'").bind(body.replace_id,auth.user.id,h.owner_hash),ctx.env.DB.prepare("UPDATE browser_launcher_helpers SET status='active',confirm_nonce=NULL WHERE id=?").bind(h.id),ctx.env.DB.prepare('DELETE FROM browser_launcher_guard WHERE id=?').bind(h.id)]);
  return reply({paired:true,helper_id:h.id,port:h.port});
 }
 if(action==='challenge'){
  if(request.headers.has('origin')||!exact(body,['helper_id','command_id','purpose'])||!uuid(body.helper_id)||!uuid(body.command_id)||!['claim','status','pair-state'].includes(body.purpose))return fail();
  const c=body.purpose==='pair-state'&&body.helper_id===body.command_id?await ctx.env.DB.prepare("SELECT id FROM browser_launcher_helpers WHERE id=? AND (status='active' OR (status IN ('staged','prepared') AND expires_at>CURRENT_TIMESTAMP))").bind(body.helper_id).first():await ctx.env.DB.prepare(`SELECT c.id FROM browser_launcher_commands c WHERE c.id=? AND c.helper_id=? AND c.expires_at>CURRENT_TIMESTAMP AND ${liveCommand}`).bind(body.command_id,body.helper_id).first();if(!c)return fail(409);
  const nonce=launcherRandom();await ctx.env.DB.prepare("INSERT INTO browser_launcher_nonces(id,helper_id,command_id,purpose,expires_at) VALUES(?,?,?,?,datetime('now','+60 seconds')) ON CONFLICT(helper_id,command_id,purpose) DO UPDATE SET id=excluded.id,expires_at=excluded.expires_at,used_hash=NULL WHERE browser_launcher_nonces.expires_at<=CURRENT_TIMESTAMP").bind(nonce,body.helper_id,c.id,body.purpose).run();
  const n=await ctx.env.DB.prepare('SELECT id,expires_at FROM browser_launcher_nonces WHERE helper_id=? AND command_id=? AND purpose=?').bind(body.helper_id,c.id,body.purpose).first();return reply({nonce:n.id,expires_at:n.expires_at});
 }
 if(action==='claim'||action==='status'||action==='pair-state'){
  if(request.headers.has('origin')||!exact(body,['helper_id','key_version','command_id','nonce','expires_at','payload','mac'])||body.key_version!==1||!uuid(body.helper_id)||!uuid(body.command_id)||!launcherHex(body.nonce)||!launcherHex(body.mac)||typeof body.payload!=='string'||!['','process_started','failed','unknown'].includes(body.payload)||action==='claim'&&body.payload!=='')return fail();
  const n=await ctx.env.DB.prepare('SELECT * FROM browser_launcher_nonces WHERE id=? AND helper_id=? AND command_id=? AND purpose=? AND expires_at=? AND expires_at>CURRENT_TIMESTAMP').bind(body.nonce,body.helper_id,body.command_id,action,body.expires_at).first();if(!n)return fail(409);
  const h=await ctx.env.DB.prepare("SELECT * FROM browser_launcher_helpers WHERE id=? AND (status='active' OR (?='pair-state' AND status IN ('staged','prepared') AND expires_at>CURRENT_TIMESTAMP))").bind(body.helper_id,action).first();if(!h)return fail(409);
  const digest=await sha256(body.payload),canonical=launcherCanonical(action,h.id,body.key_version,body.command_id,n.id,n.expires_at,digest),mac=await launcherMac(await secretFor(ctx.env,h),canonical);if(h.key_version!==body.key_version||!equalLauncherMac(mac,body.mac))return fail(403);
  const requestHash=await sha256(canonical);if(n.used_hash&&n.used_hash!==requestHash)return fail(409);
  if(action==='pair-state'){
   if(body.command_id!==h.id||body.payload!=='')return fail();
   const used=await ctx.env.DB.prepare('UPDATE browser_launcher_nonces SET used_hash=? WHERE id=? AND expires_at>CURRENT_TIMESTAMP AND (used_hash IS NULL OR used_hash=?)').bind(requestHash,n.id,requestHash).run();if(used.meta?.changes!==1)return fail(409);return reply({paired:h.status==='active',replaces_helper_id:h.replaces_helper_id||'',helper_id:h.id});
  }
  let c=await ctx.env.DB.prepare(`SELECT c.*,COALESCE(f.slot_id,c.slot_id) resolved_slot,COALESCE(f.profile_kind,c.profile_kind) resolved_kind,f.status oauth_status FROM browser_launcher_commands c LEFT JOIN tiktok_oauth_handoffs f ON f.id=c.handoff_id WHERE c.id=? AND c.helper_id=? AND c.key_version=? AND c.expires_at>CURRENT_TIMESTAMP AND ${liveCommand}`).bind(body.command_id,h.id,h.key_version).first();if(!c)return fail(409);
  if(action==='claim'&&!['pending','claimed'].includes(c.status))return reply({status:c.status});
  if(action==='status'&&(!['claimed','process_started','failed','unknown'].includes(c.status)||!body.payload||c.status!=='claimed'&&c.status!==body.payload))return fail(409);
  const ticket=action==='claim'&&c.intent==='oauth'?await openLauncher(ctx.env,c.ticket_cipher,commandAAD(c)):'';
  const guard=ctx.env.DB.prepare(`INSERT INTO browser_launcher_guard(id) VALUES((SELECT c.id FROM browser_launcher_commands c WHERE c.id=? AND c.helper_id=? AND c.status=? AND c.expires_at>CURRENT_TIMESTAMP AND ${liveCommand} AND EXISTS(SELECT 1 FROM browser_launcher_nonces n WHERE n.id=? AND n.expires_at>CURRENT_TIMESTAMP AND (n.used_hash IS NULL OR n.used_hash=?))))`).bind(c.id,h.id,c.status,n.id,requestHash);
  await ctx.env.DB.batch([guard,ctx.env.DB.prepare('UPDATE browser_launcher_nonces SET used_hash=? WHERE id=?').bind(requestHash,n.id),ctx.env.DB.prepare("UPDATE browser_launcher_commands SET status=?,claimed_at=COALESCE(claimed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(action==='claim'?'claimed':body.payload,c.id),ctx.env.DB.prepare('DELETE FROM browser_launcher_guard WHERE id=?').bind(c.id)]);
  return action==='claim'?reply({id:c.handoff_id||c.id,slot_id:c.resolved_slot,profile_kind:c.resolved_kind,ticket,intent:c.intent,expires_at:c.expires_at,status:'claimed'}):reply({status:body.payload});
 }
 return fail(404);
}
