import {sha256} from './_lib.js';
import {encryptChannelValue,decryptChannelValue} from './_channel_crypto.js';

const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const integer=value=>Math.max(0,Number(value)||0);
const redirectDefault='https://visiondonline.com/api/tiktok/callback';
const scopes=['user.info.basic','user.info.profile','user.info.stats','video.list'];
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const canonicalTikTokProfileSlot=value=>{
  const slot=typeof value==='string'?value:'';
  return uuidPattern.test(slot)&&slot!=='00000000-0000-0000-0000-000000000000'?slot:'';
};

export function tikTokOAuthConfig(env={}){
  const clientKey=clean(env.TIKTOK_CLIENT_KEY,200),clientSecret=clean(env.TIKTOK_CLIENT_SECRET,500),redirectUri=clean(env.TIKTOK_REDIRECT_URI,1000)||redirectDefault;
  return {clientKey,clientSecret,redirectUri,configured:Boolean(clientKey&&clientSecret),scopes:[...scopes]};
}

export async function createTikTokState(env,userId,channelId='',profileSlotId=''){
  const state=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),stateHash=await sha256(state);
  const slot=canonicalTikTokProfileSlot(profileSlotId),savedChannelId=slot?`profile:${clean(channelId,72)}`:clean(channelId,80),statements=[env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash IN (SELECT state_hash FROM tiktok_oauth_states WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,state_hash LIMIT 24)")];
  if(slot){
    statements.push(
      env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash IN (SELECT state_hash FROM tiktok_oauth_profile_slots WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,state_hash LIMIT 24)"),
      env.DB.prepare("DELETE FROM tiktok_oauth_profile_slots WHERE state_hash IN (SELECT state_hash FROM tiktok_oauth_profile_slots WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,state_hash LIMIT 24)"),
      env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash IN (SELECT state_hash FROM tiktok_oauth_profile_slots WHERE slot_id=? AND expires_at<=CURRENT_TIMESTAMP)").bind(slot),
      env.DB.prepare("DELETE FROM tiktok_oauth_profile_slots WHERE slot_id=? AND expires_at<=CURRENT_TIMESTAMP").bind(slot),
      env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash IN (SELECT state_hash FROM tiktok_oauth_profile_slots WHERE user_id=? AND slot_id=?)").bind(userId,slot),
      env.DB.prepare("DELETE FROM tiktok_oauth_profile_slots WHERE user_id=? AND slot_id=?").bind(userId,slot)
    );
  }
  statements.push(env.DB.prepare("INSERT INTO tiktok_oauth_states(state_hash,user_id,channel_id,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))").bind(stateHash,userId,savedChannelId));
  if(slot)statements.push(env.DB.prepare("INSERT INTO tiktok_oauth_profile_slots(state_hash,slot_id,user_id,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))").bind(stateHash,slot,userId));
  await env.DB.batch(statements);
  return state;
}

export async function consumeTikTokState(env,state,userId){
  const stateHash=await sha256(clean(state,200)),row=await env.DB.prepare("SELECT s.state_hash,s.user_id,s.channel_id,COALESCE(p.slot_id,'') profile_slot_id FROM tiktok_oauth_states s LEFT JOIN tiktok_oauth_profile_slots p ON p.state_hash=s.state_hash AND p.user_id=s.user_id AND p.expires_at>CURRENT_TIMESTAMP WHERE s.state_hash=? AND s.user_id=? AND s.expires_at>CURRENT_TIMESTAMP").bind(stateHash,userId).first();
  if(!row)return null;
  const [deleted]=await env.DB.batch([
    env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash=? AND user_id=? AND expires_at>CURRENT_TIMESTAMP").bind(stateHash,userId),
    env.DB.prepare("DELETE FROM tiktok_oauth_profile_slots WHERE state_hash=? AND user_id=?").bind(stateHash,userId)
  ]);
  if(deleted.meta?.changes!==1)return null;
  const profileRequired=String(row.channel_id||'').startsWith('profile:');
  if(profileRequired&&!canonicalTikTokProfileSlot(row.profile_slot_id))return null;
  return{...row,channel_id:profileRequired?String(row.channel_id).slice(8):row.channel_id,profile_slot_id:profileRequired?row.profile_slot_id:''};
}

export function tikTokAuthorizeUrl(config,state){
  const url=new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.search=new URLSearchParams({client_key:config.clientKey,scope:config.scopes.join(','),response_type:'code',redirect_uri:config.redirectUri,state,disable_auto_auth:'1'}).toString();
  return url.href;
}

async function tokenRequest(config,fields,fetchImpl=fetch){
  const response=await fetchImpl('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:config.clientKey,client_secret:config.clientSecret,...fields})});
  const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.access_token)throw new Error(`TIKTOK_TOKEN_${response.status}_${clean(payload.error||payload.error_description||'FAILED',120)}`);return payload;
}
export const exchangeTikTokCode=(config,code,fetchImpl=fetch)=>tokenRequest(config,{code,grant_type:'authorization_code',redirect_uri:config.redirectUri},fetchImpl);
export const refreshTikTokToken=(config,refreshToken,fetchImpl=fetch)=>tokenRequest(config,{refresh_token:refreshToken,grant_type:'refresh_token'},fetchImpl);

async function apiJson(url,token,options={},fetchImpl=fetch){
  const response=await fetchImpl(url,{...options,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(options.headers||{})}}),payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.error?.code&&payload.error.code!=='ok')throw new Error(`TIKTOK_API_${response.status}_${clean(payload.error?.code||'FAILED',100)}`);return payload.data||{};
}

export async function fetchTikTokProfile(token,fetchImpl=fetch){
  const fields='open_id,union_id,avatar_url,display_name,profile_deep_link,bio_description,is_verified,follower_count,following_count,likes_count,video_count';
  const data=await apiJson(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`,token,{},fetchImpl);return data.user||{};
}

export async function fetchTikTokVideos(token,fetchImpl=fetch,maxVideos=100){
  const fields='id,title,video_description,duration,cover_image_url,embed_link,create_time,like_count,comment_count,share_count,view_count',videos=[];let cursor=0,hasMore=true;
  while(hasMore&&videos.length<maxVideos){const data=await apiJson(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`,token,{method:'POST',body:JSON.stringify({max_count:Math.min(20,maxVideos-videos.length),cursor})},fetchImpl);videos.push(...(Array.isArray(data.videos)?data.videos:[]));hasMore=Boolean(data.has_more);cursor=integer(data.cursor);if(!cursor&&hasMore)break}
  return videos.slice(0,maxVideos);
}

const isoAfter=seconds=>new Date(Date.now()+integer(seconds)*1000).toISOString();
export async function prepareTikTokConnection(env,userId,channelId,token,profile){
  const openId=clean(profile.open_id,200),requestedChannelId=clean(channelId,80);
  const existing=await env.DB.prepare(`SELECT c.id,c.channel_id,c.status,COALESCE(ch.name,'') channel_name FROM tiktok_connections c LEFT JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.open_id=?`).bind(userId,openId).first();
  if(existing?.status==='active'&&existing.channel_id&&existing.channel_id!==requestedChannelId){const error=new Error('TIKTOK_ACCOUNT_ALREADY_LINKED');error.code='TIKTOK_ACCOUNT_ALREADY_LINKED';error.channelName=clean(existing.channel_name,120)||'ช่องอื่น';throw error}
  const occupied=requestedChannelId?await env.DB.prepare(`SELECT c.id,COALESCE(c.display_name,'') account_name FROM tiktok_connections c WHERE c.user_id=? AND c.channel_id=? AND c.status='active' AND c.open_id<>? LIMIT 1`).bind(userId,requestedChannelId,openId).first():null;
  if(occupied){const error=new Error('TIKTOK_CHANNEL_ALREADY_LINKED');error.code='TIKTOK_CHANNEL_ALREADY_LINKED';error.accountName=clean(occupied.account_name,120)||'บัญชี TikTok อื่น';throw error}
  const id=existing?.id||crypto.randomUUID();
  const access=await encryptChannelValue(env,token.access_token),refresh=await encryptChannelValue(env,token.refresh_token);
  const statement=env.DB.prepare(`INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,union_id,display_name,avatar_url,profile_url,bio,is_verified,follower_count,following_count,likes_count,video_count,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status,last_synced_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP
    WHERE EXISTS(SELECT 1 FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL)
    ON CONFLICT(user_id,open_id) DO UPDATE SET channel_id=excluded.channel_id,union_id=excluded.union_id,display_name=excluded.display_name,avatar_url=excluded.avatar_url,profile_url=excluded.profile_url,bio=excluded.bio,is_verified=excluded.is_verified,follower_count=excluded.follower_count,following_count=excluded.following_count,likes_count=excluded.likes_count,video_count=excluded.video_count,access_token_ciphertext=excluded.access_token_ciphertext,refresh_token_ciphertext=excluded.refresh_token_ciphertext,scopes=excluded.scopes,access_expires_at=excluded.access_expires_at,refresh_expires_at=excluded.refresh_expires_at,status='active',last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(id,userId,requestedChannelId,openId,clean(profile.union_id,200),clean(profile.display_name,200),clean(profile.avatar_url),clean(profile.profile_deep_link),clean(profile.bio_description,2000),profile.is_verified?1:0,integer(profile.follower_count),integer(profile.following_count),integer(profile.likes_count),integer(profile.video_count),access,refresh,clean(token.scope,500),isoAfter(token.expires_in),isoAfter(token.refresh_expires_in),requestedChannelId,userId);
  return{id,openId,statement};
}

export async function saveTikTokConnection(env,userId,channelId,token,profile){
  const prepared=await prepareTikTokConnection(env,userId,channelId,token,profile);
  await prepared.statement.run();
  return prepared.id;
}

export function tikTokProfileBindingStatement(env,{slotId,userId,channelId,openId}){
  return env.DB.prepare(`INSERT INTO tiktok_browser_profile_bindings(slot_id,user_id,channel_id,provider_open_id)
    VALUES(?,?,?,?) ON CONFLICT(slot_id) DO UPDATE SET user_id=excluded.user_id,channel_id=excluded.channel_id,provider_open_id=excluded.provider_open_id`)
    .bind(slotId,userId,channelId,openId);
}

async function activeToken(env,connection,fetchImpl=fetch){
  if(Date.parse(connection.access_expires_at)>Date.now()+60000)return decryptChannelValue(env,connection.access_token_ciphertext);
  const config=tikTokOAuthConfig(env),refresh=await decryptChannelValue(env,connection.refresh_token_ciphertext),token=await refreshTikTokToken(config,refresh,fetchImpl),accessCipher=await encryptChannelValue(env,token.access_token),refreshCipher=await encryptChannelValue(env,token.refresh_token||refresh);
  await env.DB.prepare("UPDATE tiktok_connections SET access_token_ciphertext=?,refresh_token_ciphertext=?,scopes=?,access_expires_at=?,refresh_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(accessCipher,refreshCipher,clean(token.scope||connection.scopes,500),isoAfter(token.expires_in),token.refresh_expires_in?isoAfter(token.refresh_expires_in):connection.refresh_expires_at,connection.id).run();return token.access_token;
}

export async function syncTikTokConnection(env,connection,fetchImpl=fetch){
  const token=await activeToken(env,connection,fetchImpl),[profile,videos]=await Promise.all([fetchTikTokProfile(token,fetchImpl),fetchTikTokVideos(token,fetchImpl)]),statements=[];
  statements.push(env.DB.prepare("UPDATE tiktok_connections SET display_name=?,avatar_url=?,profile_url=?,bio=?,is_verified=?,follower_count=?,following_count=?,likes_count=?,video_count=?,last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(profile.display_name,200),clean(profile.avatar_url),clean(profile.profile_deep_link),clean(profile.bio_description,2000),profile.is_verified?1:0,integer(profile.follower_count),integer(profile.following_count),integer(profile.likes_count),integer(profile.video_count),connection.id));
  for(const item of videos)statements.push(env.DB.prepare(`INSERT INTO tiktok_connection_videos(connection_id,video_id,title,description,create_time,duration,cover_url,embed_link,view_count,like_count,comment_count,share_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,video_id) DO UPDATE SET title=excluded.title,description=excluded.description,create_time=excluded.create_time,duration=excluded.duration,cover_url=excluded.cover_url,embed_link=excluded.embed_link,view_count=excluded.view_count,like_count=excluded.like_count,comment_count=excluded.comment_count,share_count=excluded.share_count,synced_at=CURRENT_TIMESTAMP`).bind(connection.id,clean(item.id,200),clean(item.title,500),clean(item.video_description,2000),integer(item.create_time),integer(item.duration),clean(item.cover_image_url),clean(item.embed_link),integer(item.view_count),integer(item.like_count),integer(item.comment_count),integer(item.share_count)));
  if(statements.length)await env.DB.batch(statements);return {profile,videos};
}

export async function revokeTikTokToken(token,fetchImpl=fetch){await fetchImpl('https://open.tiktokapis.com/v2/oauth/revoke/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})}).catch(()=>null)}
