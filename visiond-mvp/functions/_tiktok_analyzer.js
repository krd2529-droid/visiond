const MODEL_PATTERN=/^[a-zA-Z0-9._:-]{1,100}$/;
const clean=value=>String(value||'').trim();

export async function ensureTikTokAnalyzerSchema(env){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_channels(
      id TEXT PRIMARY KEY,name TEXT NOT NULL,channel_url TEXT NOT NULL DEFAULT '',handle TEXT NOT NULL DEFAULT '',
      direction TEXT NOT NULL DEFAULT '',homework TEXT NOT NULL DEFAULT '',created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_channels_url ON tiktok_channels(channel_url) WHERE channel_url<>\'\''),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_analysis_runs(
      id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',date_range TEXT NOT NULL DEFAULT '',
      strategy TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',candidate_products TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',result_json TEXT NOT NULL DEFAULT '{}',provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',created_by INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_analysis_images(
      id TEXT PRIMARY KEY,run_id TEXT NOT NULL,object_key TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(run_id) REFERENCES tiktok_analysis_runs(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_channel_products(
      id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,name TEXT NOT NULL COLLATE NOCASE,product_url TEXT NOT NULL DEFAULT '',
      product_type TEXT NOT NULL DEFAULT 'B',source_kind TEXT NOT NULL DEFAULT 'winner',score INTEGER NOT NULL DEFAULT 0,evidence TEXT NOT NULL DEFAULT '',source_run_id TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id),UNIQUE(channel_id,name))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_runs_channel ON tiktok_analysis_runs(channel_id,created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_images_run ON tiktok_analysis_images(run_id,sort_order)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_products_channel ON tiktok_channel_products(channel_id,score DESC,last_seen_at DESC)')
  ]);
  for(const sql of["ALTER TABLE tiktok_channel_products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'B'","ALTER TABLE tiktok_channel_products ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'winner'"]){try{await env.DB.prepare(sql).run()}catch(error){if(!String(error).toLowerCase().includes('duplicate column'))throw error}}
}

export function selectTikTokProvider(env={}){
  const openai=clean(env.TIKTOK_ANALYZER_OPENAI_API_KEY)||clean(env.OPENAI_API_KEY);
  if(openai)return {name:'openai',key:openai,model:MODEL_PATTERN.test(clean(env.TIKTOK_ANALYZER_OPENAI_MODEL))?clean(env.TIKTOK_ANALYZER_OPENAI_MODEL):'gpt-4.1-mini'};
  const gemini=clean(env.TIKTOK_ANALYZER_GEMINI_API_KEY)||clean(env.GEMINI_API_KEY)||clean(env.GEMINI_API_KEY_2);
  if(gemini)return {name:'gemini',key:gemini,model:MODEL_PATTERN.test(clean(env.TIKTOK_ANALYZER_GEMINI_MODEL))?clean(env.TIKTOK_ANALYZER_GEMINI_MODEL):'gemini-2.5-flash'};
  return null;
}

const systemPrompt=`คุณเป็นนักวิเคราะห์ช่อง TikTok Commerce ภาษาไทย วิเคราะห์จากภาพหน้าจอและข้อมูลที่ผู้ใช้ให้เท่านั้น ห้ามแต่งตัวเลขหรือลิงก์ที่มองไม่เห็น แยกหลักฐานกับข้อสันนิษฐานให้ชัด จัดสินค้าทุกรายการเป็น product_type เพียงประเภทเดียว: A=ขายดีอยู่แล้ว, B=สินค้าใหม่หรือใกล้เคียง, C=ราคาประหยัดตัดสินใจซื้อง่าย, D=ราคาสูงหรือค่าคอมสูง, E=สร้างภาพจำหรือเอกลักษณ์ช่อง, F=ไม่ควรยุ่งเพราะคะแนนความเหมาะสมต่ำกว่า 40/100 หรือวิวต่ำกว่าฐานปกติของช่องซ้ำหลายคลิป หรือไม่คุ้ม/เสี่ยง/ไม่เข้าช่อง ห้ามใช้คลิปวิวน้อยเพียงคลิปเดียวตัดสินเป็น F และเมื่อข้อมูลไม่พอให้ใส่ data_gaps แทน โดยประเภท F ต้องมีตัวเลข หลักฐาน หรือความเสี่ยงชัด ห้ามเดา คืนค่า JSON เท่านั้น โดยมีคีย์ summary, confidence (0-100), data_gaps (array), winner_products (array of {name,product_url,product_type,score,evidence,decision}), content_formula ({hooks,formats,ideal_duration,cta,posting_frequency,steps}), channel_direction ({recommended,reasons}), next_product_candidates (array of {name,product_url,product_type,fit_score,reasons,risks,test_clips}), avoid_products (array of {name,product_url,product_type,score,evidence,risks}), posting_plan (array of {day,product,angle,hook,format,cta,pass_condition}), homework (array), extracted_metrics (array of {product,views,clicks,orders,gmv,commission,conversion_rate}). product_url ต้องเป็นลิงก์ http/https ที่ปรากฏจริงเท่านั้น ถ้าไม่พบให้เป็นสตริงว่าง ถ้าไม่มีข้อมูลให้ใช้ null หรือ array ว่าง`;

export async function analyzeTikTok(provider,{channel,notes,candidates,strategy,dateRange,images},fetchImpl=fetch){
  if(!provider)throw new Error('AI_NOT_CONFIGURED');
  const prompt=`ช่อง: ${channel.name}\nลิงก์: ${channel.channel_url||'-'}\nช่วงข้อมูล: ${dateRange||'-'}\nแนวทางที่เจ้าของสนใจ: ${strategy||'-'}\nข้อมูลประกอบ: ${notes||'-'}\nสินค้าที่อยากประเมินต่อ: ${candidates||'-'}\nวิเคราะห์สินค้านางฟ้า สูตรคลิป สินค้าใกล้เคียง และทำแผนทดสอบ 7 วัน`;
  const signal=AbortSignal.timeout(50000);
  let response;
  if(provider.name==='openai'){
    const content=[{type:'input_text',text:prompt},...images.map(x=>({type:'input_image',image_url:`data:${x.type};base64,${x.base64}`}))];
    response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${provider.key}`,'content-type':'application/json'},body:JSON.stringify({model:provider.model,instructions:systemPrompt,input:[{role:'user',content}],max_output_tokens:4000,store:false}),signal});
  }else{
    const parts=[{text:systemPrompt+'\n\n'+prompt},...images.map(x=>({inlineData:{mimeType:x.type,data:x.base64}}))];
    response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':provider.key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:4000,temperature:.2}}),signal});
  }
  if(!response.ok)throw new Error(`${provider.name.toUpperCase()}_HTTP_${response.status}`);
  const payload=await response.json();
  const raw=provider.name==='openai'?(payload.output_text||payload.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||''):(payload.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');
  try{return JSON.parse(String(raw).replace(/^```json\s*|```$/g,'').trim())}catch{throw new Error('AI_INVALID_JSON')}
}
