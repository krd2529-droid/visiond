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
      product_type TEXT NOT NULL DEFAULT 'B',source_kind TEXT NOT NULL DEFAULT 'winner',customer_gender TEXT NOT NULL DEFAULT '',customer_age_range TEXT NOT NULL DEFAULT '',score INTEGER NOT NULL DEFAULT 0,evidence TEXT NOT NULL DEFAULT '',source_run_id TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id),UNIQUE(channel_id,name))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_oauth_states(
      state_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_shop_oauth_states(
      state_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_shop_creator_connections(
      id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL DEFAULT '',open_id TEXT NOT NULL,
      access_token_ciphertext TEXT NOT NULL,refresh_token_ciphertext TEXT NOT NULL,scopes TEXT NOT NULL DEFAULT '',
      access_expires_at TEXT NOT NULL,refresh_expires_at TEXT NOT NULL,user_type INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,open_id),FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_shop_showcase_products(
      connection_id TEXT NOT NULL,product_id TEXT NOT NULL,name TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',product_url TEXT NOT NULL DEFAULT '',origin TEXT NOT NULL DEFAULT '',price_json TEXT NOT NULL DEFAULT 'null',commission_json TEXT NOT NULL DEFAULT 'null',sort_order INTEGER NOT NULL DEFAULT 0,raw_json TEXT NOT NULL DEFAULT '{}',synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(connection_id,product_id),FOREIGN KEY(connection_id) REFERENCES tiktok_shop_creator_connections(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_shop_affiliate_orders(
      connection_id TEXT NOT NULL,order_id TEXT NOT NULL,create_time INTEGER NOT NULL DEFAULT 0,product_ids TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT '',gmv_json TEXT NOT NULL DEFAULT 'null',commission_json TEXT NOT NULL DEFAULT 'null',raw_json TEXT NOT NULL DEFAULT '{}',synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(connection_id,order_id),FOREIGN KEY(connection_id) REFERENCES tiktok_shop_creator_connections(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_connections(
      id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL DEFAULT '',open_id TEXT NOT NULL,
      union_id TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL DEFAULT '',avatar_url TEXT NOT NULL DEFAULT '',
      profile_url TEXT NOT NULL DEFAULT '',bio TEXT NOT NULL DEFAULT '',is_verified INTEGER NOT NULL DEFAULT 0,
      follower_count INTEGER NOT NULL DEFAULT 0,following_count INTEGER NOT NULL DEFAULT 0,likes_count INTEGER NOT NULL DEFAULT 0,video_count INTEGER NOT NULL DEFAULT 0,
      access_token_ciphertext TEXT NOT NULL,refresh_token_ciphertext TEXT NOT NULL,scopes TEXT NOT NULL DEFAULT '',
      access_expires_at TEXT NOT NULL,refresh_expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',
      last_synced_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id,open_id),FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tiktok_connection_videos(
      connection_id TEXT NOT NULL,video_id TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',
      create_time INTEGER NOT NULL DEFAULT 0,duration INTEGER NOT NULL DEFAULT 0,cover_url TEXT NOT NULL DEFAULT '',embed_link TEXT NOT NULL DEFAULT '',
      view_count INTEGER NOT NULL DEFAULT 0,like_count INTEGER NOT NULL DEFAULT 0,comment_count INTEGER NOT NULL DEFAULT 0,share_count INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(connection_id,video_id),FOREIGN KEY(connection_id) REFERENCES tiktok_connections(id))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_runs_channel ON tiktok_analysis_runs(channel_id,created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_images_run ON tiktok_analysis_images(run_id,sort_order)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_products_channel ON tiktok_channel_products(channel_id,score DESC,last_seen_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_connections_channel ON tiktok_connections(channel_id,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_shop_creator_channel ON tiktok_shop_creator_connections(channel_id,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_shop_orders_time ON tiktok_shop_affiliate_orders(connection_id,create_time DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tiktok_videos_connection ON tiktok_connection_videos(connection_id,create_time DESC)')
  ]);
  for(const sql of["ALTER TABLE tiktok_channel_products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'B'","ALTER TABLE tiktok_channel_products ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'winner'","ALTER TABLE tiktok_channel_products ADD COLUMN customer_gender TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_channel_products ADD COLUMN customer_age_range TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN creator_username TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN creator_avatar_url TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN selection_region TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}'","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN last_synced_at TEXT","ALTER TABLE tiktok_shop_creator_connections ADD COLUMN last_sync_error TEXT NOT NULL DEFAULT ''","ALTER TABLE tiktok_shop_showcase_products ADD COLUMN product_grade TEXT NOT NULL DEFAULT 'B'"]){try{await env.DB.prepare(sql).run()}catch(error){if(!String(error).toLowerCase().includes('duplicate column'))throw error}}
}

export function selectTikTokProvider(env={}){
  const openai=clean(env.TIKTOK_ANALYZER_OPENAI_API_KEY)||clean(env.OPENAI_API_KEY);
  if(openai)return {name:'openai',key:openai,model:MODEL_PATTERN.test(clean(env.TIKTOK_ANALYZER_OPENAI_MODEL))?clean(env.TIKTOK_ANALYZER_OPENAI_MODEL):'gpt-4.1-mini'};
  const gemini=clean(env.TIKTOK_ANALYZER_GEMINI_API_KEY)||clean(env.GEMINI_API_KEY)||clean(env.GEMINI_API_KEY_2);
  if(gemini)return {name:'gemini',key:gemini,model:MODEL_PATTERN.test(clean(env.TIKTOK_ANALYZER_GEMINI_MODEL))?clean(env.TIKTOK_ANALYZER_GEMINI_MODEL):'gemini-2.5-flash'};
  return null;
}

const systemPrompt=`คุณเป็นนักวิเคราะห์ช่อง TikTok Commerce ภาษาไทย วิเคราะห์จากภาพหน้าจอและข้อมูลที่ผู้ใช้ให้เท่านั้น ห้ามแต่งตัวเลขหรือลิงก์ที่มองไม่เห็น แยกหลักฐานกับข้อสันนิษฐานให้ชัด วิเคราะห์คลิปย้อนหลังเฉพาะช่วงเวลาที่ผู้ใช้ระบุ เรียงตามวันโพสต์ และหาค่าฐานวิวจาก median ของคลิปที่เปรียบเทียบได้: traffic_status=good เมื่อมีทราฟฟิก, low เมื่อวิวต่ำกว่า 40% ของ median หลังโพสต์อย่างน้อย 72 ชั่วโมง, no_traffic เมื่อวิวไม่เกิน 10% ของ median หรือแทบไม่มีทราฟฟิก, pending เมื่อคลิปใหม่กว่า 72 ชั่วโมงหรือข้อมูลไม่พอ ห้ามตัดสินจากคลิปใหม่ จัดสินค้าทุกรายการเป็น product_type เพียงประเภทเดียว: A=ขายดีอยู่แล้ว, B=สินค้าใหม่หรือใกล้เคียง, C=ราคาประหยัดตัดสินใจซื้อง่าย, D=ราคาสูงหรือค่าคอมสูง, E=สร้างภาพจำหรือเอกลักษณ์ช่อง, F=ไม่ควรยุ่งเพราะคะแนนความเหมาะสมต่ำกว่า 40/100 หรือวิวต่ำกว่าฐานปกติของช่องซ้ำหลายคลิป หรือไม่คุ้ม/เสี่ยง/ไม่เข้าช่อง ห้ามใช้คลิปวิวน้อยเพียงคลิปเดียวตัดสินเป็น F และเมื่อข้อมูลไม่พอให้ใส่ data_gaps แทน โดยประเภท F ต้องมีตัวเลข หลักฐาน หรือความเสี่ยงชัด ห้ามเดา คืนค่า JSON เท่านั้น โดยมีคีย์ summary, confidence (0-100), data_gaps (array), traffic_summary ({period,comparable_clips,median_views,good_count,low_count,no_traffic_count,pending_count}), clip_performance (array of {posted_at,clip_title,product,views,age_hours,traffic_status,baseline_ratio,recommendation,evidence}), winner_products (array of {name,product_url,product_type,score,evidence,decision}), content_formula ({hooks,formats,ideal_duration,cta,posting_frequency,steps}), channel_direction ({recommended,reasons}), next_product_candidates (array of {name,product_url,product_type,fit_score,reasons,risks,test_clips}), avoid_products (array of {name,product_url,product_type,score,evidence,risks}), posting_plan (array of {day,product,angle,hook,format,cta,pass_condition}), homework (array), extracted_metrics (array of {product,views,clicks,orders,gmv,commission,conversion_rate}). product_url ต้องเป็นลิงก์ http/https ที่ปรากฏจริงเท่านั้น ถ้าไม่พบให้เป็นสตริงว่าง ถ้าไม่มีข้อมูลให้ใช้ null หรือ array ว่าง`;

const productNamingAndAudiencePrompt=`กฎรายการสินค้า: ใช้ชื่อสินค้าเต็มตามหลักฐานเท่านั้น ห้ามย่อชื่อ ห้ามตัดคำ และห้ามตั้งชื่อเรียกใหม่ ทุก object ใน winner_products, next_product_candidates และ avoid_products ต้องเพิ่ม customer_gender และ customer_age_range โดยวิเคราะห์จากหลักฐานที่เห็นเท่านั้น หากข้อมูลไม่พอให้ทั้งสองค่าเป็น "ยังระบุไม่ได้" และเพิ่มสิ่งที่ขาดใน data_gaps ห้ามเดาเพศหรืออายุ`;
const oneDayPostingPlanPrompt=`กฎแผนคลิป: posting_plan ต้องเป็นแผนภายใน 1 วัน ไม่ใช่แผนหลายวัน แต่ละรายการต้องมี clip_number, time, product, angle, hook, format, cta, pass_condition เรียง clip_number ตั้งแต่ 1 ตามจำนวนที่ขอ กระจายช่วงเวลาอย่างเหมาะสม ใช้ชื่อสินค้าเต็ม และสลับ Hook/มุมขาย/รูปแบบเพื่อไม่ให้คลิปซ้ำกัน ห้ามใส่สินค้า F ในแผน`;

export async function analyzeTikTok(provider,{channel,notes,candidates,strategy,dateRange,lookbackDays,clipsPerDay=30,images},fetchImpl=fetch){
  if(!provider)throw new Error('AI_NOT_CONFIGURED');
  const prompt=`ช่อง: ${channel.name}\nลิงก์: ${channel.channel_url||'-'}\nช่วงข้อมูลในภาพ: ${dateRange||'-'}\nให้ไล่ดูย้อนหลัง: ${lookbackDays||30} วัน\nจำนวนคลิปที่ต้องวางแผนภายใน 1 วัน: ${clipsPerDay} คลิป\nแนวทางที่เจ้าของสนใจ: ${strategy||'-'}\nข้อมูลประกอบ: ${notes||'-'}\nสินค้าที่อยากประเมินต่อ: ${candidates||'-'}\nวิเคราะห์คลิปย้อนหลังทีละคลิป หาคลิปวิวต่ำ/ไม่มีทราฟฟิก สินค้านางฟ้า สูตรคลิป สินค้าใกล้เคียง และสร้าง posting_plan ภายใน 1 วันให้ครบ ${clipsPerDay} คลิป`;
  const signal=AbortSignal.timeout(110000);
  let response;
  if(provider.name==='openai'){
    const content=[{type:'input_text',text:prompt},...images.map(x=>({type:'input_image',image_url:`data:${x.type};base64,${x.base64}`}))];
    response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${provider.key}`,'content-type':'application/json'},body:JSON.stringify({model:provider.model,instructions:systemPrompt+'\n'+productNamingAndAudiencePrompt+'\n'+oneDayPostingPlanPrompt,input:[{role:'user',content}],max_output_tokens:10000,store:false}),signal});
  }else{
    const parts=[{text:systemPrompt+'\n'+productNamingAndAudiencePrompt+'\n'+oneDayPostingPlanPrompt+'\n\n'+prompt},...images.map(x=>({inlineData:{mimeType:x.type,data:x.base64}}))];
    response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':provider.key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:10000,temperature:.2}}),signal});
  }
  if(!response.ok)throw new Error(`${provider.name.toUpperCase()}_HTTP_${response.status}`);
  const payload=await response.json();
  const raw=provider.name==='openai'?(payload.output_text||payload.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||''):(payload.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');
  const cleaned=String(raw).replace(/^```json\s*|```$/g,'').trim(),start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
  try{return JSON.parse(start>=0&&end>start?cleaned.slice(start,end+1):cleaned)}catch{throw new Error('AI_INVALID_JSON')}
}
