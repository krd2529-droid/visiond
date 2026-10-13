// Configure each Stock store only after its Shopee seller account is verified.
// R2 keys are private and are never returned to browsers or exposed by /api/media.
const configNames={'toys-center':'SHOPEE_TEMPLATE_TOYS_CENTER_R2_KEY',zippo:'SHOPEE_TEMPLATE_ZIPPO_R2_KEY'};
const hashNames={'toys-center':'SHOPEE_TEMPLATE_TOYS_CENTER_SHA256',zippo:'SHOPEE_TEMPLATE_ZIPPO_SHA256'};
const privateKey=/^private\/shopee-templates\/[A-Za-z0-9._-]+\.xlsx$/;
const sha256=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');

export async function loadShopeeTemplate(env,store){
  const name=configNames[store],key=name&&String(env[name]||'').trim(),expected=String(env[hashNames[store]]||'').trim().toLowerCase();
  if(!key)return{error:'ร้านนี้ยังไม่ได้ตั้งค่าไฟล์ตัวอย่าง Shopee ส่วนตัว กรุณาให้ผู้ดูแลระบบตั้งค่าก่อนส่งออก',status:503};
  if(!privateKey.test(key)||!/^[0-9a-f]{64}$/.test(expected)||!env.FILES)return{error:'การตั้งค่าไฟล์ตัวอย่าง Shopee ของร้านไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ',status:503};
  let object;try{object=await env.FILES.get(key)}catch{return{error:'อ่านไฟล์ตัวอย่าง Shopee ส่วนตัวไม่ได้ กรุณาลองใหม่',status:503}}
  if(!object||!Number.isSafeInteger(Number(object.size))||Number(object.size)<1||Number(object.size)>2*1024*1024)return{error:'ไม่พบไฟล์ตัวอย่าง Shopee ของร้าน หรือไฟล์ใหญ่เกิน 2 MB',status:503};
  try{const source=new Uint8Array(await object.arrayBuffer());if(source.length!==Number(object.size)||source[0]!==0x50||source[1]!==0x4b||await sha256(source)!==expected)throw new Error('invalid template');return{source}}
  catch{return{error:'ไฟล์ตัวอย่าง Shopee ของร้านเสียหาย กรุณาให้ผู้ดูแลระบบตรวจสอบ',status:503}}
}
