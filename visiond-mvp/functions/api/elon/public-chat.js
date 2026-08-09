import {ELON_EXTERNAL_LINK_REFUSAL,ELON_LOGIN_REQUIRED_REFUSAL,ELON_MAX_MESSAGE_LENGTH,ELON_PERSONAL_DATA_REFUSAL,ELON_RESTRICTED_REFUSAL,ELON_SECRET_REFUSAL,containsExternalLink,containsProtectedPersonalData,containsSensitiveToken,contextContainsExternalLink,elonAccessDecision,elonSystemPrompt,enforceGuestElonRateLimit,safeElonOutput,sanitizeElonContext} from '../../_elon.js';
import {extractProviderText,requestElonProvider,selectElonProvider} from '../../_elon-provider.js';

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});

export async function onRequestPost(ctx){
  const body=await ctx.request.json().catch(()=>null);
  if(!body||typeof body.message!=='string')return json({error:'กรุณาพิมพ์คำถาม'},400);
  const message=body.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  if(!message)return json({error:'กรุณาพิมพ์คำถาม'},400);
  if(message.length>ELON_MAX_MESSAGE_LENGTH)return json({error:`ข้อความยาวเกิน ${ELON_MAX_MESSAGE_LENGTH} ตัวอักษร`},413);
  if(!(await enforceGuestElonRateLimit(ctx.request)))return json({error:'ส่งข้อความเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่'},429,{'retry-after':'60'});

  const rawPageContext=body.page_context||body.context||body,guest={authenticated:false,can_use_seller_vision5:false};
  const blockedPersonal=containsProtectedPersonalData(message)||containsProtectedPersonalData(JSON.stringify(rawPageContext));
  const blockedSecret=containsSensitiveToken(message)||containsSensitiveToken(JSON.stringify(rawPageContext));
  const blockedExternalLink=containsExternalLink(message,ctx.env)||contextContainsExternalLink(rawPageContext,ctx.env);
  const messageAccess=elonAccessDecision(message,guest),contextAccess=elonAccessDecision(JSON.stringify(rawPageContext),guest);
  const decision=messageAccess.blocked?messageAccess:contextAccess;
  if(blockedPersonal||blockedSecret||blockedExternalLink||decision.blocked){
    const needsLogin=['login_required','seller_not_eligible'].includes(decision.reason);
    const refusal=blockedPersonal?ELON_PERSONAL_DATA_REFUSAL:blockedSecret?ELON_SECRET_REFUSAL:blockedExternalLink?ELON_EXTERNAL_LINK_REFUSAL:needsLogin?ELON_LOGIN_REQUIRED_REFUSAL:ELON_RESTRICTED_REFUSAL;
    return json({message:{role:'assistant',content:refusal},guest:true,blocked:true});
  }
  const pageContext=sanitizeElonContext(rawPageContext,{authenticated:false}),provider=selectElonProvider(ctx.env);
  if(!provider)return json({error:'ELON ยังไม่ได้ตั้งค่าระบบ AI กรุณาติดต่อเจ้าหน้าที่ VisionD'},503);
  try{
    const result=await requestElonProvider(provider,{systemPrompt:elonSystemPrompt(guest,pageContext),history:[],message});
    const answer=safeElonOutput(extractProviderText(provider.name,result.payload).slice(0,5000),ctx.env,guest);
    return answer?json({message:{role:'assistant',content:answer},usage:result.usage,guest:true}):json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502);
  }catch(error){console.error('ELON_PUBLIC_RESPONSE_FAILED',String(error?.message||'AI_PROVIDER_ERROR').slice(0,120));return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502)}
}
