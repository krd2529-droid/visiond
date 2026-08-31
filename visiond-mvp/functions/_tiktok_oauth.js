import {sha256} from './_lib.js';
import {encryptChannelValue,decryptChannelValue} from './_channel_crypto.js';

const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const integer=value=>Math.max(0,Number(value)||0);
const redirectDefault='https://visiondonline.com/api/tiktok/callback';
const scopes=['user.info.basic','user.info.profile','user.info.stats','video.list'];

export function tikTokOAuthConfig(env={}){
  const clientKey=clean(env.TIKTOK_CLIENT_KEY,200),clientSecret=clean(env.TIKTOK_CLIENT_SECRET,500),redirectUri=clean(env.TIKTOK_REDIRECT_URI,1000)||redirectDefault;
  return {clientKey,clientSecret,redirectUri,configured:Boolean(clientKey&&clientSecret),scopes:[...scopes]};
}

export async function createTikTokState(env,userId,channelId=''){
  const state=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),stateHash=await sha256(state);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE expires_at<=CURRENT_TIMESTAMP OR user_id=?").bind(userId),
    env.DB.prepare("INSERT INTO tiktok_oauth_states(state_hash,user_id,channel_id,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))").bind(stateHash,userId,clean(channelId,80))
  ]);
  return state;
}

export async function consumeTikTokState(env,state,userId){
  const stateHash=await sha256(clean(state,200)),row=await env.DB.prepare("SELECT state_hash,user_id,channel_id FROM tiktok_oauth_states WHERE state_hash=? AND user_id=? AND expires_at>CURRENT_TIMESTAMP").bind(stateHash,userId).first();
  if(!row)return null;
  const deleted=await env.DB.prepare("DELETE FROM tiktok_oauth_states WHERE state_hash=? AND user_id=?").bind(stateHash,userId).run();
  return deleted.meta?.changes===1?row:null;
}

export function tikTokAuthorizeUrl(config,state){
  const url=new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.search=new URLSearchParams({client_key:config.clientKey,scope:config.scopes.join(','),response_type:'code',redirect_uri:config.redirectUri,state}).toString();
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
export async function saveTikTokConnection(env,userId,channelId,token,profile){
  const existing=await env.DB.prepare('SELECT id FROM tiktok_connections WHERE user_id=? AND open_id=?').bind(userId,clean(profile.open_id,200)).first(),id=existing?.id||crypto.randomUUID();
  const access=await encryptChannelValue(env,token.access_token),refresh=await encryptChannelValue(env,token.refresh_token);
  await env.DB.prepare(`INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,union_id,display_name,avatar_url,profile_url,bio,is_verified,follower_count,following_count,likes_count,video_count,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status,last_synced_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP) ON CONFLICT(user_id,open_id) DO UPDATE SET channel_id=excluded.channel_id,union_id=excluded.union_id,display_name=excluded.display_name,avatar_url=excluded.avatar_url,profile_url=excluded.profile_url,bio=excluded.bio,is_verified=excluded.is_verified,follower_count=excluded.follower_count,following_count=excluded.following_count,likes_count=excluded.likes_count,video_count=excluded.video_count,access_token_ciphertext=excluded.access_token_ciphertext,refresh_token_ciphertext=excluded.refresh_token_ciphertext,scopes=excluded.scopes,access_expires_at=excluded.access_expires_at,refresh_expires_at=excluded.refresh_expires_at,status='active',last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(id,userId,clean(channelId,80),clean(profile.open_id,200),clean(profile.union_id,200),clean(profile.display_name,200),clean(profile.avatar_url),clean(profile.profile_deep_link),clean(profile.bio_description,2000),profile.is_verified?1:0,integer(profile.follower_count),integer(profile.following_count),integer(profile.likes_count),integer(profile.video_count),access,refresh,clean(token.scope,500),isoAfter(token.expires_in),isoAfter(token.refresh_expires_in)).run();
  return id;
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
