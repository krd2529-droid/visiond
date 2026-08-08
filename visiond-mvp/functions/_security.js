import {json,sha256} from './_lib.js';

export const requestIp=(request)=>request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';

export async function securityLog(env,request,event_type,severity='info',detail='',user_id=null){
  try{await env.DB.prepare('INSERT INTO security_logs(event_type,severity,user_id,ip,path,detail) VALUES(?,?,?,?,?,?)').bind(event_type,severity,user_id,requestIp(request),new URL(request.url).pathname,String(detail||'').slice(0,500)).run()}catch{}
}

export async function rateLimit(env,request,action,limit,windowMinutes,blockMinutes=15){
  const now=Date.now(),ip=requestIp(request),key=`${action}:${ip}`,
    row=await env.DB.prepare('SELECT * FROM security_rate_limits WHERE rate_key=?').bind(key).first();
  if(row?.blocked_until&&Date.parse(row.blocked_until.replace(' ','T')+'Z')>now)return {error:json({error:`ลองใหม่ภายหลัง ระบบพักคำขอนี้ชั่วคราว`},429,{'retry-after':String(blockMinutes*60)})};
  const windowExpired=!row||Date.parse(String(row.window_start||'').replace(' ','T')+'Z')+windowMinutes*60000<=now;
  if(windowExpired){await env.DB.prepare("INSERT INTO security_rate_limits(rate_key,hits,window_start,blocked_until) VALUES(?,1,CURRENT_TIMESTAMP,NULL) ON CONFLICT(rate_key) DO UPDATE SET hits=1,window_start=CURRENT_TIMESTAMP,blocked_until=NULL").bind(key).run();return {ok:true}}
  const hits=Number(row.hits||0)+1;
  if(hits>limit){await env.DB.prepare("UPDATE security_rate_limits SET hits=?,blocked_until=datetime('now',?) WHERE rate_key=?").bind(hits,`+${blockMinutes} minutes`,key).run();await securityLog(env,request,'rate_limit_block','warning',action);return {error:json({error:'คำขอมากเกินไป ระบบพักชั่วคราว'},429,{'retry-after':String(blockMinutes*60)})}}
  await env.DB.prepare('UPDATE security_rate_limits SET hits=? WHERE rate_key=?').bind(hits,key).run();return {ok:true};
}

export async function verifyTurnstile(env,request,token){
  if(!env.TURNSTILE_SECRET_KEY)return {ok:true,disabled:true};
  if(!token)return {error:json({error:'กรุณายืนยันว่าไม่ใช่โปรแกรมอัตโนมัติ'},400)};
  const body=new FormData();body.set('secret',env.TURNSTILE_SECRET_KEY);body.set('response',String(token));body.set('remoteip',requestIp(request));
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body}),result=await response.json().catch(()=>({success:false}));
  if(!result.success||result.hostname&&result.hostname!==new URL(request.url).hostname){await securityLog(env,request,'turnstile_failed','warning',JSON.stringify(result['error-codes']||[]));return {error:json({error:'การยืนยันความปลอดภัยไม่ผ่าน กรุณาลองใหม่'},403)}}
  return {ok:true};
}

const bytesToHex=(bytes)=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const PBKDF2_ITERATIONS=100000;
export async function hashPassword(password,salt=crypto.randomUUID()){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:PBKDF2_ITERATIONS},key,256);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${bytesToHex(new Uint8Array(bits))}`;
}
export async function verifyPassword(password,stored){
  if(String(stored).startsWith('pbkdf2:')){const [,iterations,salt,hash]=stored.split(':'),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:Number(iterations)},key,256);return bytesToHex(new Uint8Array(bits))===hash}
  const [salt,hash]=String(stored||'').split(':');return Boolean(salt&&hash)&&await sha256(salt+String(password))===hash;
}
