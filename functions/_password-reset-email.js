const encoder=new TextEncoder();

function safeOrigin(env){
  const value=String(env.APP_ORIGIN||'').trim().replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value))throw new Error('PASSWORD_RESET_ORIGIN_NOT_CONFIGURED');
  return value;
}

export function passwordResetEmailReady(env){
  return String(env.PASSWORD_RESET_EMAIL_PROVIDER||'').toLowerCase()==='resend'&&Boolean(env.RESEND_API_KEY&&env.RESET_EMAIL_FROM&&env.APP_ORIGIN);
}

export async function createResetToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(token));
  const tokenHash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return {token,tokenHash};
}

export async function sendPasswordResetEmail(env,{email,name,token}){
  if(!passwordResetEmailReady(env))throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');
  const resetUrl=`${safeOrigin(env)}/reset-password.html#token=${encodeURIComponent(token)}`;
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({
      from:String(env.RESET_EMAIL_FROM),to:[email],subject:'ตั้งรหัสผ่าน VisionD ใหม่',
      text:`สวัสดี ${name||'สมาชิก VisionD'}\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ภายใน 30 นาที:\n${resetUrl}\n\nหากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องดำเนินการใด ๆ`,
      html:`<p>สวัสดี ${escapeHtml(name||'สมาชิก VisionD')}</p><p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ภายใน 30 นาที</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#078a7e;color:#fff;text-decoration:none;border-radius:10px">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องดำเนินการใด ๆ</p>`
    })
  });
  if(!response.ok)throw new Error(`PASSWORD_RESET_EMAIL_FAILED_${response.status}`);
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
