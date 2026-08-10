import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ELON_EXTERNAL_LINK_REFUSAL,ELON_HISTORY_LIMIT,ELON_MAX_MESSAGE_LENGTH,ELON_PERSONAL_DATA_REFUSAL,ELON_RESTRICTED_REFUSAL,ELON_SECRET_REFUSAL,containsExternalLink,containsProtectedPersonalData,containsSensitiveToken,contextContainsExternalLink,elonAccessDecision,elonMemberContext,elonPublicSalesContext,elonSystemPrompt,enforceElonGlobalBudget,enforceElonRateLimit,isIncompleteElonAnswer,purgeExpiredElonData,safeElonOutput,sanitizeElonContext} from '../../_elon.js';
import {createElonConversation,loadElonMessages,loadElonProviderHistory,ownElonConversation,persistElonExchange} from '../../_elon-member-store.js';
import {extractProviderText,requestElonProvider,selectElonProvider} from '../../_elon-provider.js';

const noStore={'cache-control':'no-store'};
const validConversationId=value=>/^[a-f0-9-]{20,64}$/i.test(String(value||''))?String(value):'';

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  const memberContext=await elonMemberContext(ctx.env,auth.user.id,auth.user.role);
  const conversationId=validConversationId(new URL(ctx.request.url).searchParams.get('conversation_id'));
  if(!conversationId)return json({error:'ไม่พบรหัสบทสนทนา'},400,noStore);
  const conversation=await ownElonConversation(ctx.env,conversationId,auth.user.id);
  if(!conversation)return json({error:'ไม่พบบทสนทนานี้'},404,noStore);
  const rows=await loadElonMessages(ctx.env,conversationId,auth.user.id,50);
  const messages=rows.reverse().map(item=>{const parsed=parseContext(item.page_context);return {...item,content:item.role==='user'&&containsExternalLink(item.content,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกเพื่อความปลอดภัย]':safeElonOutput(item.content,ctx.env,memberContext),page_context:contextContainsExternalLink(parsed,ctx.env)?{blocked_external_link:true}:parsed}});
  return json({conversation:{...conversation,title:containsExternalLink(conversation.title,ctx.env)?'ลิงก์ภายนอกถูกบล็อก':conversation.title},messages},200,noStore);
}

export async function onRequestPost(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>null);
  if(!body||typeof body.message!=='string')return json({error:'กรุณาพิมพ์คำถาม'},400,noStore);
  const message=body.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  if(!message)return json({error:'กรุณาพิมพ์คำถาม'},400,noStore);
  if(message.length>ELON_MAX_MESSAGE_LENGTH)return json({error:`ข้อความยาวเกิน ${ELON_MAX_MESSAGE_LENGTH} ตัวอักษร`},413,noStore);
  if(!(await enforceElonRateLimit(ctx.env,auth.user.id)))return json({error:'ส่งข้อความเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่'},429,{...noStore,'retry-after':'60'});

  const rawPageContext=body.page_context||body.context||body;
  const blockedPersonal=containsProtectedPersonalData(message)||containsProtectedPersonalData(JSON.stringify(rawPageContext));
  const blockedSecret=containsSensitiveToken(message)||containsSensitiveToken(JSON.stringify(rawPageContext));
  const blockedExternalLink=containsExternalLink(message,ctx.env)||contextContainsExternalLink(rawPageContext,ctx.env);
  const memberContext=await elonMemberContext(ctx.env,auth.user.id,auth.user.role);
  const messageAccess=elonAccessDecision(message,memberContext),contextAccess=elonAccessDecision(JSON.stringify(rawPageContext),memberContext);
  const accessDecision=messageAccess.blocked?messageAccess:contextAccess,blockedRestricted=accessDecision.blocked;
  const blockedUnsafe=blockedPersonal||blockedExternalLink||blockedSecret||blockedRestricted;
  const pageContext=blockedUnsafe?{path:'',title:'',product_slug:'',product_id:'',course_id:'',blocked_external_link:blockedExternalLink,blocked_secret:blockedSecret,blocked_personal:blockedPersonal}:sanitizeElonContext(rawPageContext,{authenticated:true});
  const requestedId=validConversationId(body.conversation_id);
  let conversation=requestedId?await ownElonConversation(ctx.env,requestedId,auth.user.id,true):null;
  if(requestedId&&!conversation)return json({error:'ไม่พบบทสนทนานี้ หรือบทสนทนาสิ้นสุดแล้ว'},404,noStore);
  if(!conversation)conversation=await createElonConversation(ctx.env,auth.user.id,blockedUnsafe?'เนื้อหาไม่ปลอดภัยถูกบล็อก':message.replace(/\s+/g,' ').slice(0,80)||'สนทนากับ ELON');

  if(blockedUnsafe){
    const refusal=blockedPersonal?ELON_PERSONAL_DATA_REFUSAL:blockedSecret?ELON_SECRET_REFUSAL:blockedExternalLink?ELON_EXTERNAL_LINK_REFUSAL:ELON_RESTRICTED_REFUSAL;
    const redactedMessage=blockedPersonal?'[ข้อมูลส่วนบุคคลถูกบล็อกและไม่ได้จัดเก็บ]':blockedSecret?'[ข้อมูลลับถูกบล็อกและไม่ได้จัดเก็บ]':blockedExternalLink?'[ลิงก์ภายนอกถูกบล็อกและไม่ได้จัดเก็บ]':'[คำถามเกี่ยวกับข้อมูลจำกัดสิทธิ์ถูกบล็อก]';
    pageContext.restricted=blockedRestricted;pageContext.restricted_reason=blockedRestricted?accessDecision.reason:'';
    await persistElonExchange(ctx.env,conversation.id,auth.user.id,redactedMessage,refusal,pageContext);
    return json({conversation_id:conversation.id,message:{role:'assistant',content:refusal},blocked_external_link:blockedExternalLink,blocked_secret:blockedSecret,blocked_personal:blockedPersonal,blocked_restricted:blockedRestricted},200,noStore);
  }

  const provider=selectElonProvider(ctx.env);
  if(!provider)return json({error:'ELON ยังไม่ได้ตั้งค่าระบบ AI กรุณาติดต่อเจ้าหน้าที่ VisionD'},503,noStore);
  if(!(await enforceElonGlobalBudget(ctx.env)))return json({error:'ELON พักการตอบชั่วคราวเพื่อความปลอดภัย กรุณาลองใหม่ภายหลัง'},429,{...noStore,'retry-after':'3600'});
  const history=(await loadElonProviderHistory(ctx.env,conversation.id,auth.user.id,ELON_HISTORY_LIMIT)).reverse().map(item=>({role:item.role,content:containsExternalLink(item.content,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกและไม่นำส่งให้ AI]':safeElonOutput(item.content,ctx.env,memberContext)}));
  const salesContext=await elonPublicSalesContext(ctx.env,pageContext,message);
  const systemPrompt=elonSystemPrompt(memberContext,pageContext,salesContext);
  let providerResult,rawAnswer;
  try{
    providerResult=await requestElonProvider(provider,{systemPrompt,history,message});
    rawAnswer=extractProviderText(provider.name,providerResult.payload).slice(0,5000);
    if(isIncompleteElonAnswer(rawAnswer)){
      providerResult=await requestElonProvider(provider,{systemPrompt:`${systemPrompt}\nคำตอบก่อนหน้าขาดกลางประโยค รอบนี้ต้องตอบใหม่ให้ครบและตรวจคำสุดท้ายก่อนส่ง`,history,message});
      rawAnswer=extractProviderText(provider.name,providerResult.payload).slice(0,5000);
    }
    if(isIncompleteElonAnswer(rawAnswer))rawAnswer='ขออภัยครับ คำตอบเมื่อสักครู่ส่งมาไม่ครบ กรุณาถาม ELON อีกครั้งหนึ่ง หรือเลือกคำถามแนะนำด้านล่างได้เลยครับ';
  }
  catch(error){console.error('ELON_RESPONSE_FAILED',String(error?.message||'AI_PROVIDER_ERROR').slice(0,120));try{await persistError(ctx.env,conversation.id,auth.user.id,message,pageContext)}catch{}return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502,noStore)}
  const answer=safeElonOutput(rawAnswer,ctx.env,memberContext);
  if(!answer){try{await persistError(ctx.env,conversation.id,auth.user.id,message,pageContext)}catch{}return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502,noStore)}
  await persistElonExchange(ctx.env,conversation.id,auth.user.id,message,answer,pageContext);
  return json({conversation_id:conversation.id,message:{role:'assistant',content:answer},usage:providerResult.usage},200,noStore);
}

async function persistError(env,conversationId,userId,message,pageContext){return persistElonExchange(env,conversationId,userId,message,'[ELON ตอบไม่สำเร็จ ระบบบันทึกเหตุการณ์เพื่อให้ Boss ตรวจสอบ]',{...pageContext,error:true})}
function parseContext(value){try{return JSON.parse(value||'{}')}catch{return {}}}
