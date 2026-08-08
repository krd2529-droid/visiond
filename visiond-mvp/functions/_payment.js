export async function ensureSettings(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()}
const DEFAULT_FACEBOOK_VIDEO_URL='https://www.facebook.com/share/p/1DWnFhv2Ud/';
export async function loadPaymentSettings(env){
  await ensureSettings(env);
  const {results}=await env.DB.prepare(`SELECT key,value FROM settings WHERE key IN ('bank_name','account_name','account_number','qr_url','accepting_orders','payment_message','vision3_auto_verify','active_payment_account','personal_bank_name','personal_account_name','personal_account_number','company_bank_name','company_account_name','company_account_number','homepage_facebook_video_url')`).all();
  const map=Object.fromEntries(results.map(x=>[x.key,x.value]));
  const profiles={
    personal:{bank_name:map.personal_bank_name||'ธนาคารกรุงศรีอยุธยา',account_name:map.personal_account_name||'รัฐสิทธิ ดำรงรถการ',account_number:map.personal_account_number||'444-118-118-1'},
    company:{bank_name:map.company_bank_name||map.bank_name||env.BANK_NAME||'ธนาคารกสิกรไทย',account_name:map.company_account_name||map.account_name||env.BANK_ACCOUNT_NAME||'บจก. วิชั่น ดี ออนไลน์',account_number:map.company_account_number||map.account_number||env.BANK_ACCOUNT_NUMBER||'209-2-90757-3'}
  };
  const active_account=map.active_payment_account==='company'?'company':'personal';
  return {...profiles[active_account],active_account,profiles,qr_url:map.qr_url||env.PAYMENT_QR_URL||'',accepting_orders:map.accepting_orders!=='0',vision3_auto_verify:map.vision3_auto_verify!=='0',payment_message:map.payment_message||'ส่งสลิปแล้ว กรุณารอแอดมินตรวจสอบและอนุมัติไฟล์',homepage_facebook_video_url:map.homepage_facebook_video_url===undefined?DEFAULT_FACEBOOK_VIDEO_URL:map.homepage_facebook_video_url};
}
export async function saveSetting(env,key,value){await ensureSettings(env);await env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,String(value??'')).run()}
export function publicPaymentSettings(settings){const {bank_name,account_name,account_number,qr_url,accepting_orders,payment_message,active_account}=settings;return {bank_name,account_name,account_number,qr_url,accepting_orders,payment_message,active_account}}
