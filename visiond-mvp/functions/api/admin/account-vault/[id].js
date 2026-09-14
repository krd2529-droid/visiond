import {json,requireBoss} from '../../../_lib.js';
import {accountVaultEncryptionReady,decryptAccountVaultValue,encryptAccountVaultValue} from '../../../_account_vault_crypto.js';
import {SOCIAL_ACCOUNT_KIND,maskedSocialAccount,privateVaultResponse,socialAccountPurpose,socialAccountValues} from '../../../_account_vault_social.js';

const headers={'cache-control':'private, no-store'};
async function authorize(ctx){const auth=await requireBoss(ctx);return auth.error?{error:privateVaultResponse(auth.error)}:auth}
const validId=value=>/^[1-9]\d*$/.test(String(value||''))&&Number.isSafeInteger(Number(value));
async function ownedSecret(ctx,userId){
  if(!validId(ctx.params.id))return null;
  return ctx.env.DB.prepare('SELECT id,encryption_context,email_ciphertext,phone_ciphertext,password_hint_ciphertext FROM admin_account_vault WHERE id=? AND owner_user_id=? AND record_kind=?').bind(Number(ctx.params.id),userId,SOCIAL_ACCOUNT_KIND).first();
}

export async function onRequestGet(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  if(!accountVaultEncryptionReady(ctx.env))return json({error:'ระบบเข้ารหัสคลังบัญชียังไม่พร้อม'},503,headers);
  const row=await ownedSecret(ctx,auth.user.id);if(!row)return json({error:'ไม่พบบัญชีนี้'},404,headers);
  try{return json({email:row.email_ciphertext?await decryptAccountVaultValue(ctx.env,row.email_ciphertext,socialAccountPurpose(row.encryption_context,'email')):'',phone:row.phone_ciphertext?await decryptAccountVaultValue(ctx.env,row.phone_ciphertext,socialAccountPurpose(row.encryption_context,'phone')):'',password_hint:await decryptAccountVaultValue(ctx.env,row.password_hint_ciphertext,socialAccountPurpose(row.encryption_context,'password-hint'))},200,headers)}catch{return json({error:'ถอดรหัสข้อมูลไม่สำเร็จ'},503,headers)}
}

export async function onRequestPatch(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  if(!accountVaultEncryptionReady(ctx.env))return json({error:'ระบบเข้ารหัสคลังบัญชียังไม่พร้อม'},503,headers);
  try{
    const value=socialAccountValues(await ctx.request.json().catch(()=>null)),current=await ownedSecret(ctx,auth.user.id);
    if(!current)return json({error:'ไม่พบบัญชีนี้'},404,headers);
    const [emailCiphertext,phoneCiphertext,passwordHintCiphertext]=await Promise.all([
      value.email?encryptAccountVaultValue(ctx.env,value.email,socialAccountPurpose(current.encryption_context,'email')):'',
      value.phone?encryptAccountVaultValue(ctx.env,value.phone,socialAccountPurpose(current.encryption_context,'phone')):'',
      encryptAccountVaultValue(ctx.env,value.passwordHint,socialAccountPurpose(current.encryption_context,'password-hint')),
    ]);
    const row=await ctx.env.DB.prepare("UPDATE admin_account_vault SET platform=?,account_name=?,login_url=?,email_ciphertext=?,email_hint='',phone_ciphertext=?,phone_last4='',password_hint_ciphertext=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=? AND record_kind=? RETURNING id,platform,account_name,login_url,note,created_at,updated_at").bind(value.platform,value.accountName,value.loginUrl,emailCiphertext,phoneCiphertext,passwordHintCiphertext,value.note,current.id,auth.user.id,SOCIAL_ACCOUNT_KIND).first();
    if(!row)return json({error:'ไม่พบบัญชีนี้'},404,headers);
    return json({ok:true,item:maskedSocialAccount(row,{hasEmail:Boolean(value.email),hasPhone:Boolean(value.phone),hasPasswordHint:true})},200,headers);
  }catch(error){return json({error:error?.message||'บันทึกบัญชีโซเชียลไม่สำเร็จ'},400,headers)}
}

export async function onRequestDelete(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  if(!validId(ctx.params.id))return json({error:'ไม่พบบัญชีนี้'},404,headers);
  const result=await ctx.env.DB.prepare('DELETE FROM admin_account_vault WHERE id=? AND owner_user_id=? AND record_kind=?').bind(Number(ctx.params.id),auth.user.id,SOCIAL_ACCOUNT_KIND).run();
  return Number(result.meta?.changes)?json({ok:true},200,headers):json({error:'ไม่พบบัญชีนี้'},404,headers);
}
