import {json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ELON_EXTERNAL_LINK_REFUSAL,ELON_HISTORY_LIMIT,ELON_LOGIN_REQUIRED_REFUSAL,ELON_MAX_MESSAGE_LENGTH,ELON_PERSONAL_DATA_REFUSAL,ELON_RESTRICTED_REFUSAL,ELON_SECRET_REFUSAL,containsExternalLink,containsProtectedPersonalData,containsSensitiveToken,contextContainsExternalLink,elonAccessDecision,elonPublicSalesContext,elonSystemPrompt,enforceElonGlobalBudget,enforceGuestElonRateLimit,isIncompleteElonAnswer,purgeExpiredElonData,safeElonProviderOutput,sanitizeElonContext} from '../../_elon.js';
import {createElonConversation,loadElonProviderHistory,ownElonConversation,persistElonExchange} from '../../_elon-member-store.js';
import {extractProviderText,requestElonProvider,selectElonProvider} from '../../_elon-provider.js';
import {ensureElonWebSchema,isElonWebEnabled} from '../../_elon_databases.js';

const headers={'cache-control':'no-store'};
const validId=value=>/^ew_[a-f0-9-]{20,64}$/i.test(String(value||''))?String(value):'';
async function guestSubject(request){
  const source=String(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||request.headers.get('user-agent')||'guest').split(',')[0].slice(0,160);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  return `guest:${[...new Uint8Array(digest)].slice(0,16).map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}

export async function onRequestPost(ctx){
  if(!await isElonWebEnabled(ctx.env))return json({error:'ELON เว็บปิดให้บริการชั่วคราว'},503,headers);
  await ensureDatabase(ctx.env);await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>null),message=String(body?.message||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
  if(!message)return json({error:'กรุณาพิมพ์คำถาม'},400,headers);
  if(message.length>ELON_MAX_MESSAGE_LENGTH)return json({error:`ข้อความยาวเกิน ${ELON_MAX_MESSAGE_LENGTH} ตัวอักษร`},413,headers);
  if(!await enforceGuestElonRateLimit(ctx.env,ctx.request))return json({error:'ส่งข้อความเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่'},429,{...headers,'retry-after':'60'});
  const subject=await guestSubject(ctx.request),memberContext={authenticated:false,can_use_seller_vision5:false};
  const rawContext=body.page_context||{},personal=containsProtectedPersonalData(message)||containsProtectedPersonalData(JSON.stringify(rawContext));
  const secret=containsSensitiveToken(message)||containsSensitiveToken(JSON.stringify(rawContext)),external=containsExternalLink(message,ctx.env)||contextContainsExternalLink(rawContext,ctx.env);
  const decision=elonAccessDecision(message,memberContext),blocked=personal||secret||external||decision.blocked;
  const pageContext=blocked?{path:'',title:'',product_slug:'',product_id:'',course_id:''}:sanitizeElonContext(rawContext,{authenticated:false});
  const requested=validId(body.conversation_id);let conversation=requested?await ownElonConversation(ctx.env,requested,subject,true):null;
  if(requested&&!conversation)return json({error:'ไม่พบบทสนทนานี้ หรือบทสนทนาสิ้นสุดแล้ว'},404,headers);
  if(!conversation)conversation=await createElonConversation(ctx.env,subject,blocked?'เนื้อหาไม่ปลอดภัยถูกบล็อก':message.slice(0,80),'guest');
  if(blocked){
    const answer=personal?ELON_PERSONAL_DATA_REFUSAL:secret?ELON_SECRET_REFUSAL:external?ELON_EXTERNAL_LINK_REFUSAL:decision.reason==='login_required'||decision.reason==='seller_not_eligible'?ELON_LOGIN_REQUIRED_REFUSAL:ELON_RESTRICTED_REFUSAL;
    await persistElonExchange(ctx.env,conversation.id,subject,'[คำถามไม่ปลอดภัยหรือข้อมูลเฉพาะบัญชีถูกบล็อก]',answer,{...pageContext,restricted_reason:decision.reason||''});
    return json({conversation_id:conversation.id,message:{role:'assistant',content:answer},guest:true},200,headers);
  }
  const salesContext=await elonPublicSalesContext(ctx.env,pageContext,message),provider=selectElonProvider(ctx.env);
  if(!provider)return json({error:'ELON ยังไม่ได้ตั้งค่าระบบ AI กรุณาติดต่อเจ้าหน้าที่ VisionD'},503,headers);
  if(!await enforceElonGlobalBudget(ctx.env))return json({error:'ELON พักการตอบชั่วคราว กรุณาลองใหม่ภายหลัง'},429,{...headers,'retry-after':'3600'});
  const history=(await loadElonProviderHistory(ctx.env,conversation.id,subject,ELON_HISTORY_LIMIT)).reverse().map(item=>({role:item.role,content:item.role==='assistant'?safeElonProviderOutput(item.content,ctx.env,salesContext):String(item.content).slice(0,ELON_MAX_MESSAGE_LENGTH)}));
  const systemPrompt=elonSystemPrompt(memberContext,pageContext,salesContext);
  try{
    let result=await requestElonProvider(provider,{systemPrompt,history,message});let raw=extractProviderText(provider.name,result.payload).slice(0,5000);
    if(isIncompleteElonAnswer(raw)){result=await requestElonProvider(provider,{systemPrompt:`${systemPrompt}\nตอบใหม่ให้จบทุกประโยค`,history,message});raw=extractProviderText(provider.name,result.payload).slice(0,5000)}
    const answer=safeElonProviderOutput(raw,ctx.env,salesContext);
    await persistElonExchange(ctx.env,conversation.id,subject,message,answer,pageContext);
    return json({conversation_id:conversation.id,message:{role:'assistant',content:answer},guest:true},200,headers);
  }catch(error){console.error('ELON_GUEST_RESPONSE_FAILED',String(error?.message||'AI_PROVIDER_ERROR').slice(0,120));return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502,headers)}
}
