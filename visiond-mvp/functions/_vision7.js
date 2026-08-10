import {sha256} from './_lib.js';
import {encryptVision7Key} from './_vision7_license_crypto.js';

const PLAN_CODES=new Set(['lifetime','monthly','yearly']);
const LICENSE_STATES=new Set(['active','trial','expired','suspended','revoked','refunded']);
const clean=(value,max=120)=>String(value||'').trim().slice(0,max);
const b64url=bytes=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};

export const normalizeLicenseKey=value=>String(value||'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,'');
export const hashLicenseKey=value=>sha256(normalizeLicenseKey(value));
export const validPlanCode=value=>PLAN_CODES.has(String(value||''))?String(value):'';
export const validLicenseStatus=value=>LICENSE_STATES.has(String(value||''))?String(value):'';
export const safeDeviceName=value=>clean(value,80);
export const safePlatform=value=>clean(value,40).toLowerCase();
export const safeVersion=value=>/^\d+(?:\.\d+){0,3}(?:[-+][a-z0-9.-]+)?$/i.test(String(value||''))?String(value):'';

export async function issueLicense(env,{userId,programId,planId=null,orderId=null,status='active',maxDevices=3,source='admin',note='',createdBy=null,expiresAt=null}={}){
  const random=crypto.getRandomValues(new Uint8Array(18)),raw=`VD7-${b64url(random).toUpperCase()}`,id=crypto.randomUUID(),hash=await hashLicenseKey(raw),ciphertext=await encryptVision7Key(env,raw),last4=raw.slice(-4);
  await env.DB.prepare(`INSERT INTO vision7_licenses(id,key_hash,key_ciphertext,key_last4,user_id,program_id,plan_id,order_id,status,expires_at,max_devices,source,note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,hash,ciphertext,last4,userId,programId,planId,orderId,status,expiresAt,Math.max(1,Math.min(50,Number(maxDevices)||3)),clean(source,40),clean(note,300),createdBy).run();
  try {
    await licenseEvent(env,id,createdBy,'issued',{source,status,max_devices:maxDevices,order_id:orderId||null});
    return {id,key:raw,key_last4:last4};
  } catch (error) {
    await env.DB.prepare('DELETE FROM vision7_licenses WHERE id=?').bind(id).run().catch(()=>{});
    throw error;
  }
}

export async function licenseEvent(env,licenseId,actorUserId,eventType,detail={}){
  const safe=JSON.stringify(detail||{}).slice(0,1000);
  await env.DB.prepare('INSERT INTO vision7_license_events(license_id,actor_user_id,event_type,detail) VALUES(?,?,?,?)').bind(licenseId,actorUserId||null,clean(eventType,60),safe).run();
}

export const maskedLicense=row=>`VD7-••••-••••-${String(row?.key_last4||'').padStart(4,'•')}`;

export function versionCompare(a,b){
  const left=String(a||'0').split(/[.+-]/).slice(0,4).map(x=>Number(x)||0),right=String(b||'0').split(/[.+-]/).slice(0,4).map(x=>Number(x)||0);
  for(let i=0;i<4;i++){if((left[i]||0)!==(right[i]||0))return (left[i]||0)>(right[i]||0)?1:-1}return 0;
}

export async function refreshLicenseExpiry(env,row){
  if(row?.status==='active'&&row?.expires_at&&Date.parse(String(row.expires_at).replace(' ','T')+'Z')<=Date.now()){
    await env.DB.prepare("UPDATE vision7_licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(row.id).run();
    return {...row,status:'expired'};
  }
  if(row?.status==='trial'&&row?.expires_at&&Date.parse(String(row.expires_at).replace(' ','T')+'Z')<=Date.now()){
    await env.DB.prepare("UPDATE vision7_licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='trial'").bind(row.id).run();
    return {...row,status:'expired'};
  }
  return row;
}
