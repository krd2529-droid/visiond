import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ELON_EXTERNAL_LINK_REFUSAL,ELON_HISTORY_LIMIT,ELON_MAX_MESSAGE_LENGTH,ELON_SECRET_REFUSAL,containsExternalLink,containsSensitiveToken,contextContainsExternalLink,elonMemberContext,elonSystemPrompt,enforceElonRateLimit,purgeExpiredElonData,safeElonOutput,sanitizeElonContext} from '../../_elon.js';
import {extractProviderText,requestElonProvider,selectElonProvider} from '../../_elon-provider.js';

const noStore={'cache-control':'no-store'};
const validConversationId=value=>/^[a-f0-9-]{20,64}$/i.test(String(value||''))?String(value):'';

async function ownConversation(env,id,userId,activeOnly=false){
  if(!id)return null;
  return env.DB.prepare(`SELECT id,title,status,created_at,COALESCE((SELECT MAX(activity.created_at) FROM elon_messages activity WHERE activity.conversation_id=c.id),c.created_at) updated_at,ended_at FROM elon_conversations c WHERE id=? AND user_id=? AND datetime(COALESCE((SELECT MAX(m.created_at) FROM elon_messages m WHERE m.conversation_id=c.id),c.created_at))>=datetime('now','-60 days')${activeOnly?" AND status='active'":''}`).bind(id,userId).first();
}

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  await purgeExpiredElonData(ctx.env);
  const url=new URL(ctx.request.url),conversationId=validConversationId(url.searchParams.get('conversation_id'));
  if(!conversationId)return json({error:'ไม่พบรหัสบทสนทนา'},400,noStore);
  const conversation=await ownConversation(ctx.env,conversationId,auth.user.id);
  if(!conversation)return json({error:'ไม่พบบทสนทนานี้'},404,noStore);
  const result=await ctx.env.DB.prepare(`SELECT id,role,content,page_path,page_title,page_context,created_at
    FROM elon_messages WHERE conversation_id=? AND user_id=? ORDER BY id DESC LIMIT 50`).bind(conversationId,auth.user.id).all();
  const messages=(result.results||[]).reverse().map(item=>{const parsed=parseContext(item.page_context);return {...item,content:item.role==='user'&&containsExternalLink(item.content,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกเพื่อความปลอดภัย]':safeElonOutput(item.content,ctx.env),page_context:contextContainsExternalLink(parsed,ctx.env)?{blocked_external_link:true}:parsed}});
  const safeConversation={...conversation,title:containsExternalLink(conversation.title,ctx.env)?'ลิงก์ภายนอกถูกบล็อก':conversation.title};
  return json({conversation:safeConversation,messages},200,noStore);
}

export async function onRequestPost(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>null);
  if(!body||typeof body.message!=='string')return json({error:'กรุณาพิมพ์คำถาม'},400,noStore);
  const message=body.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  if(!message)return json({error:'กรุณาพิมพ์คำถาม'},400,noStore);
  if(message.length>ELON_MAX_MESSAGE_LENGTH)return json({error:`ข้อความยาวเกิน ${ELON_MAX_MESSAGE_LENGTH} ตัวอักษร`},413,noStore);
  if(!(await enforceElonRateLimit(ctx.env,auth.user.id)))return json({error:'ส่งข้อความเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่'},429,{...noStore,'retry-after':'60'});

  const rawPageContext=body.page_context||body.context||body;
  const blockedSecret=containsSensitiveToken(message)||containsSensitiveToken(JSON.stringify(rawPageContext));
  const blockedExternalLink=containsExternalLink(message,ctx.env)||contextContainsExternalLink(rawPageContext,ctx.env);
  const blockedUnsafe=blockedExternalLink||blockedSecret;
  const pageContext=blockedUnsafe?{path:'',title:'',product_slug:'',product_id:'',course_id:'',blocked_external_link:blockedExternalLink,blocked_secret:blockedSecret}:sanitizeElonContext(rawPageContext);
  const requestedId=validConversationId(body.conversation_id);
  let conversation=requestedId?await ownConversation(ctx.env,requestedId,auth.user.id,true):null;
  if(requestedId&&!conversation)return json({error:'ไม่พบบทสนทนานี้ หรือบทสนทนาสิ้นสุดแล้ว'},404,noStore);
  if(!conversation){
    const id=crypto.randomUUID(),title=blockedUnsafe?'เนื้อหาไม่ปลอดภัยถูกบล็อก':message.replace(/\s+/g,' ').slice(0,80)||'สนทนากับ ELON';
    await ctx.env.DB.prepare('INSERT INTO elon_conversations(id,user_id,title,status) VALUES(?,?,?,\'active\')').bind(id,auth.user.id,title).run();
    conversation={id,title,status:'active'};
  }

  if(blockedUnsafe){
    const refusal=blockedSecret?ELON_SECRET_REFUSAL:ELON_EXTERNAL_LINK_REFUSAL;
    const redactedMessage=blockedSecret?'[ข้อมูลลับถูกบล็อกและไม่ได้จัดเก็บ]':'[ลิงก์ภายนอกถูกบล็อกและไม่ได้จัดเก็บ]';
    await persistExchange(ctx.env,conversation.id,auth.user.id,redactedMessage,refusal,pageContext);
    return json({conversation_id:conversation.id,message:{role:'assistant',content:refusal},blocked_external_link:blockedExternalLink,blocked_secret:blockedSecret},200,noStore);
  }
  const provider=selectElonProvider(ctx.env);
  if(!provider)return json({error:'ELON ยังไม่ได้ตั้งค่าระบบ AI กรุณาติดต่อเจ้าหน้าที่ VisionD'},503,noStore);

  const historyResult=await ctx.env.DB.prepare(`SELECT role,content FROM elon_messages
    WHERE conversation_id=? AND user_id=? AND page_context NOT LIKE '%"error":true%' ORDER BY id DESC LIMIT ?`).bind(conversation.id,auth.user.id,ELON_HISTORY_LIMIT).all();
  const history=(historyResult.results||[]).reverse().map(item=>({role:item.role,content:containsExternalLink(item.content,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกและไม่นำส่งให้ AI]':safeElonOutput(item.content,ctx.env)}));
  const memberContext=await elonMemberContext(ctx.env,auth.user.id);
  let providerResult;
  try{
    providerResult=await requestElonProvider(provider,{systemPrompt:elonSystemPrompt(memberContext,pageContext),history,message});
  }catch(error){
    // Provider errors are deliberately reduced to internal codes; request
    // headers and API keys are never logged or persisted.
    console.error('ELON_RESPONSE_FAILED',String(error?.message||'AI_PROVIDER_ERROR').slice(0,120));
    try{await persistErrorExchange(ctx.env,conversation.id,auth.user.id,message,pageContext)}catch(persistError){console.error('ELON_ERROR_AUDIT_FAILED',String(persistError?.message||persistError))}
    return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502,noStore);
  }
  const answer=safeElonOutput(extractProviderText(provider.name,providerResult.payload).slice(0,5000),ctx.env);
  if(!answer){
    try{await persistErrorExchange(ctx.env,conversation.id,auth.user.id,message,pageContext)}catch(persistError){console.error('ELON_ERROR_AUDIT_FAILED',String(persistError?.message||persistError))}
    return json({error:'ELON ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'},502,noStore);
  }
  await persistExchange(ctx.env,conversation.id,auth.user.id,message,answer,pageContext);
  return json({conversation_id:conversation.id,message:{role:'assistant',content:answer},usage:providerResult.usage},200,noStore);
}

async function persistErrorExchange(env,conversationId,userId,message,pageContext){
  const errorContext={...pageContext,error:true};
  await persistExchange(env,conversationId,userId,message,'[ELON ตอบไม่สำเร็จ ระบบบันทึกเหตุการณ์เพื่อให้ Boss ตรวจสอบ]',errorContext);
}

async function persistExchange(env,conversationId,userId,message,answer,pageContext){
  const contextJson=JSON.stringify(pageContext);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO elon_messages(conversation_id,user_id,role,content,page_path,page_title,page_context)
      VALUES(?,?,'user',?,?,?,?)`).bind(conversationId,userId,message,pageContext.path||'',pageContext.title||'',contextJson),
    env.DB.prepare(`INSERT INTO elon_messages(conversation_id,user_id,role,content,page_path,page_title,page_context)
      VALUES(?,?,'assistant',?,?,?,?)`).bind(conversationId,userId,answer,pageContext.path||'',pageContext.title||'',contextJson),
    env.DB.prepare('UPDATE elon_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(conversationId,userId)
  ]);
}

function parseContext(value){try{return JSON.parse(value||'{}')}catch{return {}}}
