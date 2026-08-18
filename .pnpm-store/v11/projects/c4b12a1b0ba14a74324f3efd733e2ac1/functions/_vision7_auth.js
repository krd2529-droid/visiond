import {cookie,json,sha256} from './_lib.js';
import {safeDeviceName,safeVersion} from './_vision7.js';

const bearer=request=>{
  const value=String(request.headers.get('authorization')||'').trim();
  return /^Bearer\s+\S+$/i.test(value)?value.replace(/^Bearer\s+/i,''):'';
};

export async function ensureVision7AuthSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vision7_app_sessions (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,device_hash TEXT NOT NULL,device_name TEXT NOT NULL DEFAULT '',app_version TEXT NOT NULL DEFAULT '',expires_at TEXT NOT NULL,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v7_app_session_user ON vision7_app_sessions(user_id,revoked_at,expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v7_app_session_device ON vision7_app_sessions(user_id,device_hash,revoked_at)').run();
}

export async function issueVision7AppSession(env,userId,{deviceId,deviceName='',appVersion=''}={}){
  const token=`VD7S_${crypto.randomUUID().replaceAll('-','')}_${crypto.randomUUID().replaceAll('-','')}`;
  const tokenHash=await sha256(token),deviceHash=await sha256(String(deviceId||'')),id=crypto.randomUUID();
  await env.DB.prepare("UPDATE vision7_app_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND device_hash=? AND revoked_at IS NULL").bind(userId,deviceHash).run();
  await env.DB.prepare("INSERT INTO vision7_app_sessions(id,token_hash,user_id,device_hash,device_name,app_version,expires_at) VALUES(?,?,?,?,?,?,datetime('now','+30 days'))").bind(id,tokenHash,userId,deviceHash,safeDeviceName(deviceName),safeVersion(appVersion)).run();
  return {token,expires_in:2592000};
}

export async function currentVision7User(ctx){
  const token=bearer(ctx.request);
  if(token){
    const tokenHash=await sha256(token);
    const user=await ctx.env.DB.prepare(`SELECT u.id,u.email,u.username,u.name,u.phone,u.role,s.id vision7_session_id,s.device_hash vision7_device_hash FROM vision7_app_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now')`).bind(tokenHash).first();
    const deviceId=String(ctx.request.headers.get('x-vision7-device-id')||'').trim();
    if(user&&(!deviceId||await sha256(deviceId)!==user.vision7_device_hash))return null;
    if(user)await ctx.env.DB.prepare('UPDATE vision7_app_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.vision7_session_id).run();
    return user||null;
  }
  const sid=cookie(ctx.request,'vd_session');
  if(!sid)return null;
  return ctx.env.DB.prepare(`SELECT u.id,u.email,u.username,u.name,u.phone,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>datetime('now')`).bind(sid).first();
}

export async function requireVision7User(ctx){
  await ensureVision7AuthSchema(ctx.env);
  const user=await currentVision7User(ctx);
  if(!user)return {error:json({error:'กรุณาเข้าสู่ระบบ VisionD ในโปรแกรมก่อนใช้งาน',code:'VISION7_LOGIN_REQUIRED'},401,{'cache-control':'no-store'})};
  return {user};
}

export async function revokeVision7Session(ctx){
  const token=bearer(ctx.request);if(!token)return false;
  const tokenHash=await sha256(token);
  const result=await ctx.env.DB.prepare("UPDATE vision7_app_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND revoked_at IS NULL").bind(tokenHash).run();
  return Boolean(result.meta?.changes);
}
