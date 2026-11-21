import { encryptVision7Key, decryptVision7Key } from './_vision7_license_crypto.js';

export const SPLUS_PRICES = Object.freeze({ accounts30:99000, accounts50:149000, accounts100:249000 });
export const SPLUS_TIERS = Object.freeze({ accounts30:30, accounts50:50, accounts100:100 });
const encoder = new TextEncoder();
const PKCS8_PREFIX='302e020100300506032b657004220420';
const b64url = value => btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const iso = value => new Date(value).toISOString().replace(/\.\d{3}Z$/,'Z');

export const normalizeSplusMachine = value => {
  const machine=String(value||'').trim().toUpperCase();
  return /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/.test(machine)?machine:'';
};

export async function splusSigner(env) {
  const seedValue=String(env.SPLUS_SIGNING_SEED||'').trim();
  const publicValue=String(env.SPLUS_PUBLIC_KEY_B64||'').trim();
  if(!/^[A-Za-z0-9+/]{43}=$/.test(seedValue)||!/^[A-Za-z0-9_-]{43}$/.test(publicValue))throw new Error('SPLUS_SIGNER_UNAVAILABLE');
  const seed=decode(seedValue),publicRaw=decode(publicValue);
  if(seed.length!==32||publicRaw.length!==32)throw new Error('SPLUS_SIGNER_UNAVAILABLE');
  const prefix=Uint8Array.from(PKCS8_PREFIX.match(/../g),h=>parseInt(h,16));
  const der=new Uint8Array(prefix.length+seed.length);der.set(prefix);der.set(seed,prefix.length);
  const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'Ed25519'},false,['sign']);
  const publicKey=await crypto.subtle.importKey('raw',publicRaw,{name:'Ed25519'},false,['verify']);
  const probe=encoder.encode('S+ signer check');
  if(!await crypto.subtle.verify('Ed25519',publicKey,await crypto.subtle.sign('Ed25519',privateKey,probe),probe))throw new Error('SPLUS_SIGNER_MISMATCH');
  return privateKey;
}

export async function signSplusKey(privateKey,{machine,tier,name='',issuedAt,expiresAt='',trialId=null}) {
  if(![0,10,30,50,100].includes(tier)||!normalizeSplusMachine(machine))throw new Error('SPLUS_KEY_INPUT_INVALID');
  const payload=encoder.encode(JSON.stringify({m:machine,t:tier,n:String(name).trim().slice(0,120),i:tier===10?issuedAt:issuedAt.slice(0,10),
    ...(expiresAt?{e:expiresAt}:{}),...(trialId!==null?{s:trialId}:{})}));
  return `SPLUS-${b64url(payload)}.${b64url(new Uint8Array(await crypto.subtle.sign('Ed25519',privateKey,payload)))}`;
}

export async function verifySplusKey(env,key) {
  const value=String(key||'').trim();
  if(!/^SPLUS-[A-Za-z0-9_-]{20,800}\.[A-Za-z0-9_-]{86}$/.test(value))return null;
  try {
    const [body,signature]=value.slice(6).split('.');
    const bytes=decode(body),data=JSON.parse(new TextDecoder().decode(bytes));
    const publicRaw=decode(String(env.SPLUS_PUBLIC_KEY_B64||''));
    if(publicRaw.length!==32)return null;
    const publicKey=await crypto.subtle.importKey('raw',publicRaw,{name:'Ed25519'},false,['verify']);
    if(!await crypto.subtle.verify('Ed25519',publicKey,decode(signature),bytes))return null;
    return data;
  } catch { return null; }
}

export const splusReadySql=`SELECT p.id FROM vision7_programs p WHERE p.code='splus' AND p.active=1
  AND EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.status='published') LIMIT 1`;

export const splusPaidPurchaseSql=`SELECT oi.id order_item_id,oi.order_id,o.user_id,p.id program_id,q.plan_code,oi.price,
  u.name,u.email,i.machine_id,i.key_ciphertext,i.key_last4,i.issued_at
  FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
  JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code IN ('accounts30','accounts50','accounts100')
  JOIN vision7_programs p ON p.id=q.program_id AND p.code='splus'
  JOIN products x ON x.id=oi.product_id AND x.product_kind='vision7-key'
  JOIN users u ON u.id=o.user_id LEFT JOIN splus_issues i ON i.order_item_id=oi.id
  WHERE oi.id=? AND o.user_id=? AND
    ((q.plan_code='accounts30' AND oi.price=99000) OR (q.plan_code='accounts50' AND oi.price=149000) OR (q.plan_code='accounts100' AND oi.price=249000))
  LIMIT 1`;

export async function splusPaidPurchase(env,orderItemId,userId){return env.DB.prepare(splusPaidPurchaseSql).bind(orderItemId,userId).first()}

export async function claimSplusPaid(env,purchase,machine,privateKey) {
  if(purchase.machine_id&&purchase.machine_id!==machine)return {conflict:true};
  if(purchase.key_ciphertext)return {key:await decryptVision7Key(env,purchase.key_ciphertext),existing:true};
  await env.DB.prepare(`INSERT OR IGNORE INTO splus_issues(order_item_id,order_id,user_id,program_id,machine_id,tier)
    SELECT oi.id,o.id,o.user_id,p.id,?,? FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
    JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code=? JOIN vision7_programs p ON p.id=q.program_id AND p.code='splus' AND p.active=1
    WHERE oi.id=? AND o.user_id=? AND oi.price=?`).bind(machine,SPLUS_TIERS[purchase.plan_code],purchase.plan_code,purchase.order_item_id,purchase.user_id,purchase.price).run();
  const reserved=await splusPaidPurchase(env,purchase.order_item_id,purchase.user_id);
  if(!reserved?.machine_id)throw new Error('SPLUS_CLAIM_NOT_SAVED');
  if(reserved.machine_id!==machine)return {conflict:true};
  if(!reserved.key_ciphertext){
    const key=await signSplusKey(privateKey,{machine,tier:SPLUS_TIERS[purchase.plan_code],name:reserved.name||reserved.email,
      issuedAt:iso(String(reserved.issued_at).replace(' ','T')+'Z')});
    const ciphertext=await encryptVision7Key(env,key);
    await env.DB.prepare("UPDATE splus_issues SET key_ciphertext=?,key_last4=? WHERE order_item_id=? AND key_ciphertext=''")
      .bind(ciphertext,key.slice(-4),purchase.order_item_id).run();
  }
  const winner=await splusPaidPurchase(env,purchase.order_item_id,purchase.user_id);
  if(!winner?.key_ciphertext)throw new Error('SPLUS_CLAIM_NOT_SAVED');
  return {key:await decryptVision7Key(env,winner.key_ciphertext),existing:Boolean(reserved.key_ciphertext)};
}

export async function claimSplusTrial(env,{userId,name,machine,privateKey}) {
  await env.DB.prepare(`INSERT OR IGNORE INTO splus_trials(user_id,machine_id,program_id,issued_at,expires_at)
    SELECT ?,?,p.id,stamp.issued_at,strftime('%Y-%m-%dT%H:%M:%SZ',unixepoch(stamp.issued_at)+259200,'unixepoch')
    FROM vision7_programs p CROSS JOIN (SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now') issued_at) stamp
    WHERE p.code='splus' AND p.active=1 AND EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.status='published')`)
    .bind(userId,machine).run();
  const row=await env.DB.prepare('SELECT * FROM splus_trials WHERE user_id=?').bind(userId).first();
  if(!row||row.machine_id!==machine)return {conflict:true};
  if(!row.key_ciphertext){
    const key=await signSplusKey(privateKey,{machine,tier:10,name,issuedAt:row.issued_at,expiresAt:row.expires_at,trialId:row.id});
    const ciphertext=await encryptVision7Key(env,key);
    const hash=await crypto.subtle.digest('SHA-256',encoder.encode(key));
    const hex=[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
    await env.DB.prepare("UPDATE splus_trials SET key_ciphertext=?,key_hash=?,key_last4=? WHERE id=? AND key_ciphertext=''")
      .bind(ciphertext,hex,key.slice(-4),row.id).run();
  }
  const winner=await env.DB.prepare('SELECT * FROM splus_trials WHERE id=?').bind(row.id).first();
  if(!winner?.key_ciphertext)throw new Error('SPLUS_TRIAL_NOT_SAVED');
  return {id:winner.id,key:await decryptVision7Key(env,winner.key_ciphertext),expires_at:winner.expires_at,existing:Boolean(row.key_ciphertext)};
}

export async function trialKeyActive(env,key,trialId) {
  const payload=await verifySplusKey(env,key);
  if(!payload||payload.t!==10||!Number.isSafeInteger(payload.s)||payload.s!==trialId||!normalizeSplusMachine(payload.m))return false;
  const hash=await crypto.subtle.digest('SHA-256',encoder.encode(key));
  const hex=[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const row=await env.DB.prepare(`SELECT 1 FROM splus_trials t JOIN vision7_programs p ON p.id=t.program_id AND p.code='splus' AND p.active=1
    WHERE t.id=? AND t.machine_id=? AND t.key_hash=? AND t.key_ciphertext<>'' AND t.expires_at>strftime('%Y-%m-%dT%H:%M:%SZ','now') LIMIT 1`)
    .bind(trialId,payload.m,hex).first();
  return Boolean(row);
}

export async function grantSplusOwner(env,{recipient,issuerId,machine,privateKey}) {
  await env.DB.prepare(`INSERT OR IGNORE INTO splus_owner_grants(recipient_id,issuer_id,machine_id)
    VALUES(?,?,?)`).bind(recipient.id,issuerId,machine).run();
  const row=await env.DB.prepare('SELECT * FROM splus_owner_grants WHERE machine_id=?').bind(machine).first();
  if(!row||row.recipient_id!==recipient.id)return {conflict:true};
  if(!row.key_ciphertext){
    const key=await signSplusKey(privateKey,{machine,tier:0,name:recipient.name||recipient.email,
      issuedAt:iso(String(row.issued_at).replace(' ','T')+'Z')});
    const ciphertext=await encryptVision7Key(env,key);
    await env.DB.prepare("UPDATE splus_owner_grants SET key_ciphertext=?,key_last4=? WHERE id=? AND key_ciphertext=''")
      .bind(ciphertext,key.slice(-4),row.id).run();
  }
  const winner=await env.DB.prepare('SELECT * FROM splus_owner_grants WHERE id=?').bind(row.id).first();
  if(!winner?.key_ciphertext)throw new Error('SPLUS_OWNER_GRANT_NOT_SAVED');
  return {key:await decryptVision7Key(env,winner.key_ciphertext),existing:Boolean(row.key_ciphertext)};
}
