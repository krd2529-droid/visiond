import {json,requireBoss} from '../../../_lib.js';
import {accountVaultEncryptionReady,encryptAccountVaultValue} from '../../../_account_vault_crypto.js';
import {SOCIAL_ACCOUNT_KIND,decodeSocialAccountCursor,encodeSocialAccountCursor,maskedSocialAccount,privateVaultResponse,socialAccountLimit,socialAccountPurpose,socialAccountValues} from '../../../_account_vault_social.js';

const headers={'cache-control':'private, no-store'};
async function authorize(ctx){const auth=await requireBoss(ctx);return auth.error?{error:privateVaultResponse(auth.error)}:auth}
async function list(ctx,userId,requestUrl){
  const url=new URL(requestUrl),limit=socialAccountLimit(url.searchParams.get('limit')),cursor=decodeSocialAccountCursor(url.searchParams.get('cursor'));
  const select="SELECT id,platform,account_name,login_url,note,created_at,updated_at,email_ciphertext<>'' has_email,phone_ciphertext<>'' has_phone,password_hint_ciphertext<>'' has_password_hint FROM admin_account_vault WHERE owner_user_id=? AND record_kind=?";
  const statement=cursor?ctx.env.DB.prepare(select+' AND id<? ORDER BY id DESC LIMIT ?').bind(userId,SOCIAL_ACCOUNT_KIND,cursor,limit+1):ctx.env.DB.prepare(select+' ORDER BY id DESC LIMIT ?').bind(userId,SOCIAL_ACCOUNT_KIND,limit+1);
  const rows=(await statement.all()).results||[],hasMore=rows.length>limit,items=rows.slice(0,limit).map(maskedSocialAccount),last=items.at(-1);
  return{items,pagination:{limit,has_more:hasMore,next_cursor:hasMore&&last?encodeSocialAccountCursor(last.id):null}};
}

export async function onRequestGet(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  try{return json({encryption_ready:accountVaultEncryptionReady(ctx.env),...await list(ctx,auth.user.id,ctx.request.url)},200,headers)}catch(error){return json({error:error?.message==='CURSOR_INVALID'?'cursor ไม่ถูกต้อง':'โหลดบัญชีโซเชียลไม่สำเร็จ'},400,headers)}
}

export async function onRequestPost(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  if(!accountVaultEncryptionReady(ctx.env))return json({error:'ยังไม่ได้ตั้ง ACCOUNT_VAULT_ENCRYPTION_KEY ใน Cloudflare'},503,headers);
  try{
    const value=socialAccountValues(await ctx.request.json().catch(()=>null)),context=crypto.randomUUID();
    const [emailCiphertext,phoneCiphertext,passwordHintCiphertext]=await Promise.all([
      value.email?encryptAccountVaultValue(ctx.env,value.email,socialAccountPurpose(context,'email')):'',
      value.phone?encryptAccountVaultValue(ctx.env,value.phone,socialAccountPurpose(context,'phone')):'',
      encryptAccountVaultValue(ctx.env,value.passwordHint,socialAccountPurpose(context,'password-hint')),
    ]);
    const row=await ctx.env.DB.prepare("INSERT INTO admin_account_vault(owner_user_id,platform,account_name,login_url,login_id_ciphertext,login_id_last4,email_ciphertext,email_hint,phone_ciphertext,phone_last4,password_ciphertext,password_last4,note,record_kind,encryption_context,password_hint_ciphertext) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id,platform,account_name,login_url,note,created_at,updated_at").bind(auth.user.id,value.platform,value.accountName,value.loginUrl,'','',emailCiphertext,'',phoneCiphertext,'','','',value.note,SOCIAL_ACCOUNT_KIND,context,passwordHintCiphertext).first();
    return json({ok:true,item:maskedSocialAccount(row,{hasEmail:Boolean(value.email),hasPhone:Boolean(value.phone),hasPasswordHint:true})},201,headers);
  }catch(error){return json({error:error?.message||'บันทึกบัญชีโซเชียลไม่สำเร็จ'},400,headers)}
}
