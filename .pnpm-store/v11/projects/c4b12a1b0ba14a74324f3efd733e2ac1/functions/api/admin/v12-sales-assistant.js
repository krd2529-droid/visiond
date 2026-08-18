import {json,requireAdmin} from '../../_lib.js';
import {selectElonProvider,requestElonProvider,extractProviderText} from '../../_elon-provider.js';
import {enforceElonGlobalBudget} from '../../_elon.js';
import {buildRuleSalesInsight,salesPlaybookPrompt,SALES_PLAYBOOK_VERSION} from '../../_visiond-sales-playbook.js';
import {loadV12PageCaptions,captionKnowledgePrompt} from '../../_v12-page-captions.js';
const headers={'cache-control':'private, no-store'},stages=new Set(['new','exploring','interested','ready','follow_up']);
const clean=(value,max=1600)=>String(value||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export async function ensureV12SalesAssistantSchema(env){
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS v12_lead_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','exploring','interested','ready','follow_up')),
    intent TEXT NOT NULL DEFAULT '',summary TEXT NOT NULL DEFAULT '',objections TEXT NOT NULL DEFAULT '',
    next_action TEXT NOT NULL DEFAULT '',suggested_reply TEXT NOT NULL DEFAULT '',source_message_count INTEGER NOT NULL DEFAULT 0,
    analyzed_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id,conversation_id)
  ); CREATE INDEX IF NOT EXISTS idx_v12_lead_insights_stage ON v12_lead_insights(stage,updated_at DESC);`);
}
export const redactSalesHistory=value=>clean(value,1800).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[อีเมลถูกปิดบัง]').replace(/(?:\+?66|0)[\s-]?\d(?:[\s-]?\d){7,9}/g,'[เบอร์โทรถูกปิดบัง]').replace(/\b\d[\d\s-]{5,}\d\b/g,'[ตัวเลขส่วนตัวถูกปิดบัง]').replace(/(?:\b(?:api[_ -]?key|access[_ -]?token|password)\b|รหัสผ่าน)[^\n]{0,120}/gi,'[ข้อมูลลับถูกปิดบัง]');
export const parseSalesInsight=value=>{try{const data=JSON.parse(String(value||'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim());return {stage:stages.has(data?.stage)?data.stage:'new',intent:clean(data?.intent,300),summary:clean(data?.summary,600),objections:clean(data?.objections,500),next_action:clean(data?.next_action,400),suggested_reply:clean(data?.suggested_reply,1200)}}catch{return null}};
export const buildFallbackInsight=messages=>buildRuleSalesInsight(messages);
const salesPrompt=(products,captions)=>`คุณคือผู้ช่วยฝ่ายขายภายในของ VisionD วิเคราะห์บทสนทนาเพื่อช่วยเจ้าหน้าที่ ห้ามส่งข้อความเอง
${salesPlaybookPrompt()}
${captionKnowledgePrompt(captions)}
กฎ: อ้างอิงเฉพาะประวัติและแคตตาล็อก ห้ามแต่งสินค้า ราคา โปรโมชัน จำนวนหน้า สต็อก ผลลัพธ์ หรือนโยบาย ห้ามขอหรือทวนข้อมูลส่วนตัว ห้ามกดดันหรือหลอกลูกค้า หากข้อมูลไม่พอให้ระบุว่าไม่ทราบ
stage ใช้ได้เฉพาะ new, exploring, interested, ready, follow_up
ตอบ JSON เท่านั้น: {"stage":"...","intent":"สิ่งที่สนใจ","summary":"สรุปข้อเท็จจริง","objections":"ข้อกังวลที่พบหรือไม่พบ","next_action":"สิ่งที่เจ้าหน้าที่ควรทำ","suggested_reply":"ร่างภาษาไทยสุภาพ กระชับ และมีคำถามถัดไปหนึ่งข้อ"}
CATALOG=${JSON.stringify(products)}`;
export async function onRequestGet(ctx){const auth=await requireAdmin(ctx);if(auth.error)return auth.error;await ensureV12SalesAssistantSchema(ctx.env);const url=new URL(ctx.request.url),shopId=clean(url.searchParams.get('shop_id'),80),conversationId=clean(url.searchParams.get('conversation_id'),160);if(!shopId||!conversationId)return json({error:'ข้อมูลบทสนทนาไม่ครบ'},400,headers);const insight=await ctx.env.DB.prepare('SELECT stage,intent,summary,objections,next_action,suggested_reply,source_message_count,updated_at FROM v12_lead_insights WHERE shop_id=? AND conversation_id=?').bind(shopId,conversationId).first();return json({insight:insight||null},200,headers)}
export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureV12SalesAssistantSchema(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),shopId=clean(body.shop_id,80),conversationId=clean(body.conversation_id,160);
  const conversation=await ctx.env.DB.prepare("SELECT id FROM veasy_conversations WHERE shop_id=? AND id=? AND status='active'").bind(shopId,conversationId).first();
  if(!shopId||!conversationId||!conversation)return json({error:'ไม่พบบทสนทนา'},404,headers);
  const messages=(await ctx.env.DB.prepare('SELECT role,content FROM veasy_chat_messages WHERE shop_id=? AND conversation_id=? ORDER BY created_at DESC LIMIT 60').bind(shopId,conversationId).all()).results?.reverse()||[];
  if(!messages.length)return json({error:'ยังไม่มีประวัติแชตให้วิเคราะห์'},409,headers);
  const provider=selectElonProvider(ctx.env),budgetAvailable=provider?await enforceElonGlobalBudget(ctx.env):false,pageKnowledge=await loadV12PageCaptions(ctx.env);
  const products=(await ctx.env.DB.prepare("SELECT slug,title,short_description,price,category,pages FROM products WHERE status='published' AND deleted_at IS NULL AND COALESCE(product_kind,'product')='product' ORDER BY updated_at DESC LIMIT 60").all()).results||[];
  const catalog=products.map(item=>({slug:item.slug,title:clean(item.title,120),summary:clean(item.short_description,180),price_satang:Number(item.price)||0,category:item.category,pages:Number(item.pages)||0}));
  const history=messages.map(item=>({role:item.role==='assistant'?'assistant':'user',content:redactSalesHistory(item.content)}));
  try{
    let insight=buildFallbackInsight(history),analysisSource='rules_fallback',warning=!provider?'AI_NOT_CONFIGURED':!budgetAvailable?'AI_BUDGET_LIMIT':'';
    if(provider&&budgetAvailable)try{const result=await requestElonProvider(provider,{systemPrompt:salesPrompt(catalog,pageKnowledge.captions),history,message:'วิเคราะห์ประวัติข้างต้นและสร้างร่างข้อความขายที่เหมาะสม'}),parsed=parseSalesInsight(extractProviderText(provider.name,result.payload));if(parsed){insight=parsed;analysisSource='ai'}else warning='AI_INVALID_FORMAT'}catch(error){warning=clean(error?.message,80)||'AI_PROVIDER_FAILED'}
    await ctx.env.DB.prepare('INSERT INTO v12_lead_insights(shop_id,conversation_id,stage,intent,summary,objections,next_action,suggested_reply,source_message_count,analyzed_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shop_id,conversation_id) DO UPDATE SET stage=excluded.stage,intent=excluded.intent,summary=excluded.summary,objections=excluded.objections,next_action=excluded.next_action,suggested_reply=excluded.suggested_reply,source_message_count=excluded.source_message_count,analyzed_by=excluded.analyzed_by,updated_at=CURRENT_TIMESTAMP').bind(shopId,conversationId,insight.stage,insight.intent,insight.summary,insight.objections,insight.next_action,insight.suggested_reply,messages.length,auth.user.id).run();
    return json({insight:{...insight,source_message_count:messages.length},analysis_source:analysisSource,playbook_version:SALES_PLAYBOOK_VERSION,page_knowledge:{status:pageKnowledge.status,caption_count:pageKnowledge.captions.length},warning},200,headers);
  }catch(error){const code=clean(error?.message,80)||'UNKNOWN';console.error('V12_SALES_ASSISTANT_FAILED',{code});return json({error:`วิเคราะห์บทสนทนาไม่สำเร็จ (${code})`,code},502,headers)}
}
