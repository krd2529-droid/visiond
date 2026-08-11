import {json,sha256} from './_lib.js';
import {ensureVEasyShopSchema} from './_veasy_shop.js';

const clean=(value,max=160)=>String(value||'').trim().slice(0,max);
const token=()=>`VEL_${crypto.randomUUID().replaceAll('-','')}_${crypto.randomUUID().replaceAll('-','')}`;
export const cleanConversationId=value=>clean(value,160);
export const cleanMessageId=value=>clean(value,180);
export const cleanIdempotencyKey=value=>clean(value,180);

export async function ensureVEasyRuntimeSchema(env){
  await ensureVEasyShopSchema(env);
  const sql=[
    `CREATE TABLE IF NOT EXISTS veasy_runtime_leases (shop_id TEXT PRIMARY KEY,app_session_id TEXT NOT NULL,device_hash TEXT NOT NULL,lease_token_hash TEXT NOT NULL UNIQUE,acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,FOREIGN KEY(app_session_id) REFERENCES vision7_app_sessions(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS veasy_conversation_leases (shop_id TEXT NOT NULL,conversation_id TEXT NOT NULL,runtime_lease_hash TEXT NOT NULL,lease_token_hash TEXT NOT NULL UNIQUE,acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,PRIMARY KEY(shop_id,conversation_id),FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS veasy_message_claims (shop_id TEXT NOT NULL,platform_message_id TEXT NOT NULL,conversation_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'processing',claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT,PRIMARY KEY(shop_id,platform_message_id),FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS veasy_order_claims (shop_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,conversation_id TEXT NOT NULL,order_ref TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'processing',claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT,PRIMARY KEY(shop_id,idempotency_key),FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS veasy_conversations (shop_id TEXT NOT NULL,id TEXT NOT NULL,platform TEXT NOT NULL DEFAULT 'facebook',participant_hash TEXT NOT NULL,display_name TEXT NOT NULL DEFAULT 'ลูกค้า',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(shop_id,id),UNIQUE(shop_id,platform,participant_hash),FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,CHECK(status IN ('active','closed','blocked')))`,
    `CREATE TABLE IF NOT EXISTS veasy_chat_messages (id TEXT PRIMARY KEY,shop_id TEXT NOT NULL,conversation_id TEXT NOT NULL,platform_message_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(shop_id,conversation_id) REFERENCES veasy_conversations(shop_id,id) ON DELETE CASCADE,UNIQUE(shop_id,platform_message_id,role))`,
    `CREATE TABLE IF NOT EXISTS veasy_conversation_controls (shop_id TEXT NOT NULL,conversation_id TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'bot' CHECK(mode IN ('bot','human')),provider TEXT NOT NULL,target_ciphertext TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(shop_id,conversation_id),FOREIGN KEY(shop_id,conversation_id) REFERENCES veasy_conversations(shop_id,id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS veasy_sales_contexts (id TEXT PRIMARY KEY,shop_id TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'ทั่วไป',title TEXT NOT NULL,content TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'system' CHECK(source IN ('system','shop','chat_review')),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','review')),risk_flag TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE)`,
    `CREATE INDEX IF NOT EXISTS idx_veasy_sales_context_shop ON veasy_sales_contexts(shop_id,status,category,updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_veasy_runtime_expiry ON veasy_runtime_leases(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_veasy_conversation_expiry ON veasy_conversation_leases(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_veasy_conversation_shop ON veasy_conversations(shop_id,status,updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_veasy_chat_history ON veasy_chat_messages(shop_id,conversation_id,created_at DESC)`
  ];for(const statement of sql)await env.DB.prepare(statement).run();
  const shops=(await env.DB.prepare("SELECT id FROM veasy_shops WHERE status='active'").all()).results||[],seed=[['ทั่วไป','ถามความต้องการก่อนเสนอ','ถ้าลูกค้าถามกว้าง ให้ถามการใช้งาน งบประมาณ หรือสิ่งที่ให้ความสำคัญเพียงหนึ่งคำถาม แล้วค่อยเสนอสินค้าที่ตรงที่สุด'],['ทั่วไป','เชียร์แบบมีเหตุผล','บอกประโยชน์จากข้อมูลสินค้าจริงหนึ่งถึงสองข้อ แล้วเชื่อมกับความต้องการของลูกค้า ห้ามชมลอย ๆ หรือเร่งให้ซื้อ'],['ทั่วไป','รับคำว่าสนใจ','เมื่อลูกค้าบอกว่าสนใจ ให้สรุปชื่อสินค้า ราคา สต็อก และจุดเด่นสั้น ๆ จากนั้นถามว่าจะให้สรุปรายการหรืออยากรู้ข้อมูลส่วนใดเพิ่ม'],['มือถือ','ขายมือถืออย่างเป็นธรรมชาติ','ถามลักษณะการใช้งาน เช่น ถ่ายรูป เล่นเกม ทำงาน หรือเน้นแบต แล้วอธิบายสเปกที่มีอยู่ให้สัมพันธ์กับการใช้งาน ห้ามเดาสเปก'],['แฟชั่น','ขายแฟชั่นอย่างเป็นธรรมชาติ','ถามสไตล์ สี หรือโอกาสใช้งาน แล้วแนะนำจากสี วัสดุ ขนาด และรายละเอียดที่ร้านระบุเท่านั้น'],['อาหาร','ขายอาหารอย่างเป็นธรรมชาติ','ถามรสชาติ ปริมาณ หรือข้อจำกัดการกินที่ลูกค้าสนใจ ห้ามแต่งส่วนผสม วันหมดอายุ หรือคำรับรองสุขภาพ'],['ของสะสม','ขายของสะสมอย่างเป็นธรรมชาติ','ถามรุ่น ธีม งบ หรือวัตถุประสงค์สะสม ใช้คำว่าแท้ หายาก หรือลิมิเต็ดได้เฉพาะเมื่อข้อมูลสินค้าระบุชัด']];for(const shop of shops)for(const item of seed)await env.DB.prepare("INSERT OR IGNORE INTO veasy_sales_contexts(id,shop_id,category,title,content,source,status) VALUES(?,?,?,?,?,'system','active')").bind(`seed:${shop.id}:${item[0]}:${item[1]}`,shop.id,...item).run();
}

export async function ownedActiveShop(env,userId,shopId){
  return env.DB.prepare(`SELECT s.id,s.user_id,s.license_id,s.name,s.meta_page_id,s.status,l.status license_status,l.expires_at,p.active program_active FROM veasy_shops s JOIN vision7_licenses l ON l.id=s.license_id AND l.user_id=s.user_id JOIN vision7_programs p ON p.id=l.program_id AND p.platform_type='veasy' WHERE s.id=? AND s.user_id=? AND s.status='active' AND l.status IN ('active','trial') AND p.active=1 AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)`).bind(clean(shopId,80),userId).first();
}

export function requireAppSession(user){
  if(!user?.vision7_session_id||!user?.vision7_device_hash)return json({error:'คำสั่ง Runtime ต้องมาจากโปรแกรม V Easy ที่ล็อกอินแล้ว',code:'VEASY_APP_SESSION_REQUIRED'},401);
  return null;
}

export async function acquireRuntimeLease(env,user,shopId){
  const shop=await ownedActiveShop(env,user.id,shopId);if(!shop)return {error:'ไม่พบร้านที่พร้อมใช้งานในบัญชีนี้',status:404,code:'VEASY_SHOP_NOT_OWNED'};
  await env.DB.prepare('DELETE FROM veasy_runtime_leases WHERE shop_id=? AND expires_at<=CURRENT_TIMESTAMP').bind(shop.id).run();
  const raw=token(),hash=await sha256(raw);
  const existing=await env.DB.prepare('SELECT app_session_id,device_hash,expires_at FROM veasy_runtime_leases WHERE shop_id=?').bind(shop.id).first();
  if(existing&&existing.app_session_id!==user.vision7_session_id)return {error:'ร้านนี้มีโปรแกรมอีกเครื่องกำลังทำงานอยู่',status:409,code:'VEASY_SHOP_ALREADY_RUNNING',expires_at:existing.expires_at};
  if(existing){await env.DB.prepare("UPDATE veasy_runtime_leases SET lease_token_hash=?,device_hash=?,heartbeat_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+45 seconds') WHERE shop_id=? AND app_session_id=?").bind(hash,user.vision7_device_hash,shop.id,user.vision7_session_id).run()}
  else {const result=await env.DB.prepare("INSERT OR IGNORE INTO veasy_runtime_leases(shop_id,app_session_id,device_hash,lease_token_hash,expires_at) VALUES(?,?,?,?,datetime('now','+45 seconds'))").bind(shop.id,user.vision7_session_id,user.vision7_device_hash,hash).run();if(!result.meta?.changes)return {error:'ร้านนี้มีโปรแกรมอีกเครื่องกำลังเริ่มทำงานอยู่',status:409,code:'VEASY_SHOP_LEASE_RACE'}}
  return {ok:true,lease_token:raw,expires_in:45,shop};
}

export async function verifyRuntimeLease(env,user,shopId,raw){
  const hash=await sha256(clean(raw,240));
  return env.DB.prepare(`SELECT r.shop_id,r.app_session_id,r.device_hash,r.expires_at FROM veasy_runtime_leases r JOIN veasy_shops s ON s.id=r.shop_id WHERE r.shop_id=? AND r.lease_token_hash=? AND r.app_session_id=? AND r.device_hash=? AND r.expires_at>CURRENT_TIMESTAMP AND s.user_id=?`).bind(clean(shopId,80),hash,user.vision7_session_id,user.vision7_device_hash,user.id).first();
}

export async function acquireConversationLease(env,user,{shopId,conversationId,runtimeToken}){
  const runtime=await verifyRuntimeLease(env,user,shopId,runtimeToken);if(!runtime)return {error:'Runtime Lease หมดอายุหรือไม่ใช่ของเครื่องนี้',status:409,code:'VEASY_RUNTIME_LEASE_INVALID'};
  const conversation=cleanConversationId(conversationId);if(!conversation)return {error:'ไม่พบรหัสบทสนทนา',status:400,code:'VEASY_CONVERSATION_INVALID'};
  const owned=await env.DB.prepare("SELECT id FROM veasy_conversations WHERE shop_id=? AND id=? AND status='active'").bind(runtime.shop_id,conversation).first();
  if(!owned)return {error:'บทสนทนานี้ไม่ได้อยู่ในร้านที่กำลังทำงาน',status:404,code:'VEASY_CONVERSATION_NOT_OWNED'};
  await env.DB.prepare('DELETE FROM veasy_conversation_leases WHERE shop_id=? AND conversation_id=? AND expires_at<=CURRENT_TIMESTAMP').bind(runtime.shop_id,conversation).run();
  const runtimeHash=await sha256(clean(runtimeToken,240)),raw=token(),hash=await sha256(raw);
  const result=await env.DB.prepare("INSERT OR IGNORE INTO veasy_conversation_leases(shop_id,conversation_id,runtime_lease_hash,lease_token_hash,expires_at) VALUES(?,?,?,?,datetime('now','+30 seconds'))").bind(runtime.shop_id,conversation,runtimeHash,hash).run();
  if(!result.meta?.changes)return {error:'แชทนี้กำลังถูกประมวลผลโดยงานอื่น',status:409,code:'VEASY_CONVERSATION_BUSY'};
  return {ok:true,conversation_lease_token:raw,expires_in:30,conversation_id:conversation};
}

export async function verifyConversationLease(env,user,{shopId,conversationId,leaseToken}){
  const hash=await sha256(clean(leaseToken,240));
  return env.DB.prepare(`SELECT c.shop_id,c.conversation_id,c.expires_at FROM veasy_conversation_leases c JOIN veasy_shops s ON s.id=c.shop_id JOIN veasy_runtime_leases r ON r.shop_id=c.shop_id AND r.lease_token_hash=c.runtime_lease_hash WHERE c.shop_id=? AND c.conversation_id=? AND c.lease_token_hash=? AND c.expires_at>CURRENT_TIMESTAMP AND r.expires_at>CURRENT_TIMESTAMP AND r.app_session_id=? AND r.device_hash=? AND s.user_id=?`).bind(clean(shopId,80),cleanConversationId(conversationId),hash,user.vision7_session_id,user.vision7_device_hash,user.id).first();
}
