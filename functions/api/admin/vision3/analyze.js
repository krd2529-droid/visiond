import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

const cleanSpecific=value=>{
  let text=String(value||'').normalize('NFKC').replace(/แบบฝึกหัด|เกมเสริมพัฒนาการ|เกม|ชุดที่\s*\d+/gi,' ').replace(/[A-Za-z]+(?:\s*[-–]\s*[A-Za-z]+)?/g,token=>/^a\s*[-–]\s*z$/i.test(token)?'A–Z':' ').replace(/[^\u0E00-\u0E7FA–Z0-9๐-๙\s+\-–]/g,' ').replace(/\s+/g,' ').trim();
  return text.slice(0,80)||'เสริมทักษะ';
};
const fallbackType=name=>/(เขียน|คัด|ลากเส้น|เติม|ระบาย|trace|tracing|writing|worksheet|handwriting|phonics|math|number)/i.test(name)?'worksheet':'game';
const filenameHint=name=>{const value=String(name||'').toLowerCase();const hints=[[/food.*card|food.*flashcard/,'บัตรภาพอาหาร'],[/alphabet.*flashcard|letter.*flashcard/,'บัตรภาพตัวอักษร'],[/alphabet|a\s*[-–]?\s*z/,'ตัวอักษร A–Z'],[/farm.*animal/,'สัตว์ในฟาร์ม'],[/action.*verb/,'คำกริยาแสดงอาการ'],[/animal/,'บัตรภาพสัตว์'],[/fruit/,'บัตรภาพผลไม้'],[/vegetable/,'บัตรภาพผัก'],[/number|counting/,'ตัวเลขและการนับ'],[/color|colour/,'สีและการจำแนกสี'],[/shape/,'รูปทรง'],[/matching|match/,'จับคู่ภาพ'],[/memory/,'ฝึกความจำ'],[/phonics/,'ฝึกอ่านออกเสียง'],[/word|vocabulary/,'คำศัพท์'],[/flashcard|card/,'บัตรภาพ']];return hints.find(([pattern])=>pattern.test(value))?.[1]||''};
const parseJson=text=>{try{return JSON.parse(String(text||'').replace(/^```json\s*|\s*```$/g,''))}catch{return{}}};

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),fileName=String(body.file_name||'').slice(0,200),pages=Math.max(1,Math.floor(Number(body.pages)||1));
  let kind=fallbackType(fileName),specific=filenameHint(fileName)||cleanSpecific(fileName.replace(/\.(zip|pdf)$/i,'')),aiUsed=false,reason='จำแนกสำรองจากชื่อไฟล์';
  const apiKey=String(ctx.env.GEMINI_API_KEY||'').trim(),samples=(Array.isArray(body.samples)?body.samples:[]).slice(0,3);
  if(apiKey&&samples.length){
    const prompt=`วิเคราะห์ภาพตัวอย่างจากไฟล์สินค้าดิจิทัลสำหรับเด็ก ${pages} หน้า แล้วตอบ JSON เท่านั้น\nกติกา:\n1) ถ้าผู้ใช้ต้องเขียน คัด ลากเส้น เติมคำ เติมตัวเลข หรือทำเครื่องหมายลงบนกระดาษ ให้ type=worksheet\n2) ถ้าไม่ต้องเขียน เช่น เกมตัดแปะ จับคู่ด้วยชิ้นส่วน เขาวงกตที่เล่นด้วยสายตา บัตรภาพ หรือกิจกรรมสังเกต ให้ type=game\n3) specific_name ต้องเป็นชื่อเฉพาะภาษาไทยสั้น ชัด ห้ามมีคำว่า แบบฝึกหัด เกม หรือ ชุดที่ อนุโลมอักษร A–Z ได้เท่านั้น และห้ามเว้นวรรคในชื่อ\nรูปแบบ {"type":"worksheet|game","specific_name":"...","reason":"..."}`;
    try{
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt},...samples.filter(x=>x?.data).map(x=>({inlineData:{mimeType:String(x.mime_type||'image/jpeg'),data:String(x.data)}}))]}],generationConfig:{responseMimeType:'application/json',temperature:.15}})}),data=await response.json().catch(()=>({}));
      if(response.ok){const parsed=parseJson(data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join(''));if(['worksheet','game'].includes(parsed.type)){kind=parsed.type;specific=cleanSpecific(parsed.specific_name);reason=String(parsed.reason||'AI วิเคราะห์จากรูปตัวอย่าง').slice(0,200);aiUsed=true}}
    }catch{}
  }
  specific=specific.replace(/\s+/g,'');const category=kind==='worksheet'?'worksheet':'development-game',prefix=kind==='worksheet'?'แบบฝึกหัด':'เกม',base=`${prefix}${specific}`;
  const rows=(await ctx.env.DB.prepare("SELECT title FROM products WHERE category=? AND title LIKE ? AND deleted_at IS NULL").bind(category,`${base}%`).all()).results||[];
  const setNumber=rows.reduce((max,row)=>Math.max(max,Number(String(row.title).match(/ชุดที่\s*(\d+)/)?.[1])||0),0)+1;
  const title=`${base}ชุดที่${setNumber}`,priceBaht=pages<=100&&pages%10===0?pages-1:pages,fileType=/\.pdf$/i.test(fileName)?'PDF':'ZIP';
  return json({ok:true,ai_used:aiUsed,reason,kind,category,title,set_number:setNumber,pages,price_baht:priceBaht,file_type:fileType,short_description:`${title} · ${pages} หน้า`,description:`ไฟล์ ${fileType} พร้อมใช้งาน จำนวน ${pages} หน้า รวมกิจกรรม${specific} พร้อมรูปตัวอย่างติดลายน้ำ SAMPLE 3 รูป เหมาะสำหรับพิมพ์ใช้งานและจัดกิจกรรมเสริมทักษะ`});
}
