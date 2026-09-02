const KEY='visiond_basket_visibility';
const fallback={mode:'all',action:'open',prefixes:[]};
const text=value=>String(value??'').trim();
export function normalizeBasketVisibility(value){
  let input=value;if(typeof value==='string')try{input=JSON.parse(value)}catch{input={}};
  const mode=input?.mode==='specific'?'specific':'all',action=input?.action==='closed'?'closed':'open',seen=new Set(),prefixes=[];
  for(const raw of Array.isArray(input?.prefixes)?input.prefixes:String(input?.prefixes||'').split(',')){const prefix=text(raw).slice(0,100);if(!prefix)continue;const key=prefix.toLocaleLowerCase('th-TH');if(seen.has(key))continue;seen.add(key);prefixes.push(prefix);if(prefixes.length===100)break}
  return {mode,action,prefixes};
}
export async function loadBasketVisibility(env){const row=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(KEY).first();return row?.value?normalizeBasketVisibility(row.value):fallback}
export function basketVisible(title,config){const rule=normalizeBasketVisibility(config),match=rule.prefixes.some(prefix=>text(title).toLocaleLowerCase('th-TH').startsWith(prefix.toLocaleLowerCase('th-TH')));if(rule.mode==='all')return rule.action==='open';return rule.action==='open'?match:!match}
export async function saveBasketVisibility(env,value){const rule=normalizeBasketVisibility(value);if(rule.mode==='specific'&&!rule.prefixes.length)throw new Error('กรุณากรอกชื่อขึ้นต้นอย่างน้อย 1 รายการ');await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(KEY,JSON.stringify(rule)).run();return rule}
