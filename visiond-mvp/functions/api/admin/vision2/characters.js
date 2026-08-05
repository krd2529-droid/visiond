import {json,requireAdmin} from '../../../_lib.js';

const MODEL='gemini-2.5-flash';

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const apiKey=String(ctx.env?.GEMINI_API_KEY||'').trim();
  if(!apiKey)return json({error:'ยังไม่ได้เชื่อม GEMINI_API_KEY',code:'api_key_missing'},503);
  const body=await ctx.request.json().catch(()=>({})),request=String(body.request||'').trim().slice(0,2000),maxItems=Math.min(200,Math.max(1,Number(body.max_items)||200));
  if(!request)return json({error:'กรุณาระบุสิ่งที่ต้องการให้จาวิสช่วย'},400);
  const instruction=`${request}\n\nตอบเป็นรายชื่อหรือรายละเอียดตัวละครเท่านั้น บรรทัดละ 1 รายการ ไม่ใส่เลขลำดับ ไม่ใส่หัวข้อ ไม่อธิบายเพิ่มเติม ห้ามซ้ำกัน และมีได้ไม่เกิน ${maxItems} รายการ`;
  const response=await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:instruction}]}],generationConfig:{temperature:.7,maxOutputTokens:8000}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return json({error:data?.error?.message||'จาวิสจัดรายการไม่สำเร็จ'},response.status>=500?502:400);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('\n');
  const items=text.split('\n').map(value=>value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).slice(0,maxItems);
  if(!items.length)return json({error:'จาวิสยังไม่ได้ส่งรายชื่อกลับมา กรุณาลองใหม่'},502);
  return json({ok:true,items,count:items.length,model:MODEL});
}
