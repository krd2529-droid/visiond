export const SOCIAL_ACCOUNT_KIND='social_password_hint';
export const SOCIAL_ACCOUNT_PAGE_SIZE=24;
const allowedFields=new Set(['platform','account_name','login_url','phone','email','password_hint','note']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hostnamePattern=/^(?=.{1,253}$)(?=.+\..+)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const field=(body,name,max)=>{
  const value=String(body?.[name]??'').trim();
  if(value.length>max)throw new Error(`ข้อมูล ${name} ยาวเกินกำหนด`);
  return value;
};

export function socialAccountValues(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('ข้อมูลบัญชีไม่ถูกต้อง');
  const unknown=Object.keys(body).find(name=>!allowedFields.has(name));
  if(unknown)throw new Error(unknown==='password'||unknown==='login_id'?'ห้ามส่งรหัสผ่านจริงหรือไอดีล็อกอินเข้าคลังคำใบ้':'มีฟิลด์ที่ระบบไม่รองรับ');
  const platform=field(body,'platform',80),accountName=field(body,'account_name',160),loginUrlInput=field(body,'login_url',1000),phone=field(body,'phone',80),email=field(body,'email',320),passwordHint=field(body,'password_hint',64),note=field(body,'note',3000);
  const explicitScheme=/^([a-z][a-z0-9+.-]*):/i.exec(loginUrlInput);
  if(explicitScheme&&!/^https:\/\//i.test(loginUrlInput))throw new Error('ลิงก์เข้าสู่ระบบต้องเป็น HTTPS หรือชื่อโดเมนเท่านั้น');
  if(!explicitScheme&&/^[\\/]/.test(loginUrlInput))throw new Error('ลิงก์เข้าสู่ระบบไม่ถูกต้อง');
  const loginUrlCandidate=explicitScheme?loginUrlInput:`https://${loginUrlInput}`;
  let url;
  try{url=new URL(loginUrlCandidate)}catch{}
  if(!platform||!accountName||!url||url.protocol!=='https:'||!hostnamePattern.test(url.hostname)||!passwordHint)throw new Error('กรุณากรอกแพลตฟอร์ม ชื่อบัญชี ลิงก์ HTTPS หรือโดเมน และคำใบ้รหัสผ่านแบบสั้นให้ครบ');
  if(url.username||url.password)throw new Error('ลิงก์เข้าสู่ระบบต้องไม่มีชื่อผู้ใช้หรือรหัสผ่าน');
  if(url.href.length>1000)throw new Error('ลิงก์เข้าสู่ระบบยาวเกินกำหนด');
  if(!phone&&!email)throw new Error('กรุณากรอกเบอร์โทรหรืออีเมลอย่างน้อยหนึ่งรายการ');
  if(email&&!emailPattern.test(email))throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
  return{platform,accountName,loginUrl:url.href,phone,email,passwordHint,note};
}

export function maskedSocialAccount(row,availability={}){
  const hasEmail=availability.hasEmail??Boolean(row.has_email),hasPhone=availability.hasPhone??Boolean(row.has_phone),hasPasswordHint=availability.hasPasswordHint??Boolean(row.has_password_hint);
  return{id:Number(row.id),platform:row.platform,account_name:row.account_name,login_url:row.login_url,note:row.note||'',created_at:row.created_at,updated_at:row.updated_at,has_email:hasEmail,has_phone:hasPhone,has_password_hint:hasPasswordHint,email_masked:hasEmail?'••••••••':'',phone_masked:hasPhone?'••••••••':'',password_hint_masked:hasPasswordHint?'••••••••':''};
}

export const socialAccountPurpose=(context,fieldName)=>`social:${String(context)}:${fieldName}`;

export function encodeSocialAccountCursor(id){
  if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw new Error('CURSOR_INVALID');
  return `v1.${btoa(String(id)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}`;
}

export function decodeSocialAccountCursor(value){
  if(!value)return null;
  const match=/^v1\.([A-Za-z0-9_-]+)$/.exec(String(value));
  if(!match)throw new Error('CURSOR_INVALID');
  try{
    const encoded=match[1].replaceAll('-','+').replaceAll('_','/'),decoded=atob(encoded+'='.repeat((4-encoded.length%4)%4));
    if(!/^[1-9]\d*$/.test(decoded))throw new Error('CURSOR_INVALID');
    const id=Number(decoded);
    if(!Number.isSafeInteger(id))throw new Error('CURSOR_INVALID');
    return id;
  }catch{throw new Error('CURSOR_INVALID')}
}

export function socialAccountLimit(value){
  const parsed=Number.parseInt(String(value??''),10);
  return Number.isFinite(parsed)?Math.min(SOCIAL_ACCOUNT_PAGE_SIZE,Math.max(1,parsed)):SOCIAL_ACCOUNT_PAGE_SIZE;
}

export function privateVaultResponse(response){
  const headers=new Headers(response.headers);
  headers.set('cache-control','private, no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
