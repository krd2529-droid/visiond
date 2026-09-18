import {json,requireAdmin} from '../../_lib.js';
import {balanceStories,escapeLike,extractImageUrls,imageDimensions,isSafeRemoteUrl,newsRssUrl,parseCursor,parseNewsRss} from '../../_vsport.js';
import {requestWorkNotesAI} from '../../_work-notes-ai.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const clean=(value,max)=>String(value??'').trim().slice(0,max);
const integer=(value,min,max)=>{const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:null};
const projectFields='id,title,news_date,scope_mode,team_name,target_minutes,target_seconds,status,thumbnail_headline,thumbnail_subheadline,thumbnail_focus_text,thumbnail_focus_asset_id,thumbnail_palette,thumbnail_layout,created_at,updated_at';
const jobFields='id,project_id,job_type,idempotency_key,status,checkpoint,error_text,created_at,updated_at';
const JOB_LEASE_MS=120000;

async function ownedProject(env,id,ownerId,{withScript=false}={}){
  return env.DB.prepare(`SELECT ${projectFields}${withScript?',narration_script':''} FROM vsport_projects WHERE id=? AND owner_id=?`).bind(id,ownerId).first();
}

async function listProjects(ctx,ownerId){
  const params=new URL(ctx.request.url).searchParams,limit=integer(params.get('limit')||24,1,24),after=parseCursor(params.get('cursor')),query=clean(params.get('q'),120);
  if(!limit||(!after&&params.get('cursor')))return{error:json({error:'ข้อมูลแบ่งหน้าไม่ถูกต้อง'},400,headers)};
  const where=['owner_id=?'],bindings=[ownerId];
  if(query){where.push("title LIKE ? ESCAPE '\\'");bindings.push(`${escapeLike(query)}%`)}
  if(after){where.push('(updated_at<? OR (updated_at=? AND id<?))');bindings.push(after.at,after.at,after.id)}
  const rows=(await ctx.env.DB.prepare(`SELECT ${projectFields} FROM vsport_projects WHERE ${where.join(' AND ')} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(...bindings,limit+1).all()).results||[],items=rows.slice(0,limit),last=items.at(-1);
  return{items,pagination:{limit,has_more:rows.length>limit,next_cursor:rows.length>limit&&last?`${last.updated_at}|${last.id}`:null}};
}

async function projectDetail(ctx,ownerId,id,include){
  const project=await ownedProject(ctx.env,id,ownerId,{withScript:true});if(!project)return null;
  const params=new URL(ctx.request.url).searchParams,parts=new Set(String(include||'').split(',').map(x=>x.trim()).filter(Boolean)),result={project};
  if(parts.has('stories')){const after=integer(params.get('story_cursor')||0,0,Number.MAX_SAFE_INTEGER),rows=(await ctx.env.DB.prepare('SELECT id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,selected,sort_order FROM vsport_stories WHERE project_id=? AND id>? ORDER BY id LIMIT 25').bind(id,after).all()).results||[];result.stories=rows.slice(0,24);result.story_pagination={limit:24,has_more:rows.length>24,next_cursor:rows.length>24?String(result.stories.at(-1).id):null}}
  if(parts.has('media')){
    const candidateAfter=integer(params.get('candidate_cursor')||0,0,Number.MAX_SAFE_INTEGER),assetAfter=integer(params.get('asset_cursor')||0,0,Number.MAX_SAFE_INTEGER),candidateRows=(await ctx.env.DB.prepare('SELECT id,story_id,source_url,source_page_url,publisher,state,error_message,created_at FROM vsport_image_candidates WHERE project_id=? AND id>? ORDER BY id LIMIT 25').bind(id,candidateAfter).all()).results||[],assetRows=(await ctx.env.DB.prepare('SELECT id,story_id,candidate_id,source_url,source_page_url,publisher,mime_type,file_size,width,height,created_at FROM vsport_assets WHERE project_id=? AND id>? ORDER BY id LIMIT 25').bind(id,assetAfter).all()).results||[];
    result.candidates=candidateRows.slice(0,24);result.assets=assetRows.slice(0,24).map(item=>({...item,preview_url:`/api/admin/vsport-assets/${item.id}`}));result.media_pagination={candidates:{limit:24,has_more:candidateRows.length>24,next_cursor:candidateRows.length>24?String(result.candidates.at(-1).id):null},assets:{limit:24,has_more:assetRows.length>24,next_cursor:assetRows.length>24?String(result.assets.at(-1).id):null}};
  }
  return result;
}

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const params=new URL(ctx.request.url).searchParams,job=clean(params.get('job'),80),jobsProject=integer(params.get('jobs_project'),1,Number.MAX_SAFE_INTEGER),id=integer(params.get('id'),1,Number.MAX_SAFE_INTEGER);
  if(job){const row=await ctx.env.DB.prepare(`SELECT ${jobFields} FROM vsport_jobs WHERE id=? AND owner_id=?`).bind(job,auth.user.id).first();return row?json({job:row},200,headers):json({error:'ไม่พบงาน vSport นี้'},404,headers)}
  if(jobsProject){if(!await ownedProject(ctx.env,jobsProject,auth.user.id))return json({error:'ไม่พบโปรเจกต์ vSport'},404,headers);const jobs=(await ctx.env.DB.prepare(`SELECT ${jobFields} FROM vsport_jobs WHERE project_id=? AND owner_id=? ORDER BY updated_at DESC,id LIMIT 24`).bind(jobsProject,auth.user.id).all()).results||[];return json({jobs},200,headers)}
  if(params.get('id')&&!id)return json({error:'รหัสโปรเจกต์ไม่ถูกต้อง'},400,headers);
  if(id){const detail=await projectDetail(ctx,auth.user.id,id,params.get('include'));return detail?json(detail,200,headers):json({error:'ไม่พบโปรเจกต์ vSport'},404,headers)}
  const listed=await listProjects(ctx,auth.user.id);return listed.error||json(listed,200,headers);
}

async function newJob(ctx,auth,project,type,key){
  const idempotencyKey=clean(key,120);if(idempotencyKey.length<8)return{error:json({error:'idempotency key ต้องยาวอย่างน้อย 8 ตัวอักษร'},400,headers)};
  const existing=await ctx.env.DB.prepare(`SELECT ${jobFields} FROM vsport_jobs WHERE owner_id=? AND idempotency_key=?`).bind(auth.user.id,idempotencyKey).first();
  if(existing){
    if(Number(existing.project_id)!==Number(project.id)||existing.job_type!==type)return{error:json({error:'idempotency key นี้ถูกใช้กับงานอื่นแล้ว'},409,headers)};
    const updatedAt=Date.parse(`${String(existing.updated_at).replace(' ','T')}Z`),stale=['queued','running'].includes(existing.status)&&Number.isFinite(updatedAt)&&Date.now()-updatedAt>JOB_LEASE_MS,retryable=existing.status==='failed'||stale;
    if(retryable){const claimed=await ctx.env.DB.prepare("UPDATE vsport_jobs SET status='queued',checkpoint=?,error_text='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND updated_at=?").bind(stale?'recovered_after_stale_lease':'',existing.id,existing.status,existing.updated_at).run();if(Number(claimed.meta?.changes))return{id:existing.id,retry:true};const current=await ctx.env.DB.prepare(`SELECT ${jobFields} FROM vsport_jobs WHERE id=? AND owner_id=?`).bind(existing.id,auth.user.id).first();return{existing:current}}
    return{existing};
  }
  const id=crypto.randomUUID();await ctx.env.DB.prepare('INSERT INTO vsport_jobs(id,owner_id,project_id,job_type,idempotency_key,status) VALUES(?,?,?,?,?,?)').bind(id,auth.user.id,project.id,type,idempotencyKey,'queued').run();return{id};
}
const finishJob=(env,id,status,checkpoint='',error='')=>env.DB.prepare('UPDATE vsport_jobs SET status=?,checkpoint=?,error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,clean(checkpoint,400),clean(error,500),id).run();

async function runDiscovery(env,jobId,project){
  try{
    await finishJob(env,jobId,'running','fetch_news');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),response=await fetch(newsRssUrl(project.news_date,project.scope_mode,project.team_name),{headers:{'user-agent':'VisionD-vSport/1.0'},signal:controller.signal}).finally(()=>clearTimeout(timer));
    if(!response.ok)throw new Error(`NEWS_HTTP_${response.status}`);
    const stories=parseNewsRss(await response.text(),{newsDate:project.news_date,scopeMode:project.scope_mode,teamName:project.team_name,limit:24});if(!stories.length)throw new Error('NO_RELIABLE_NEWS');
    const statements=stories.map((story,index)=>env.DB.prepare(`INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(project_id,fingerprint) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,team_name=excluded.team_name,publisher=excluded.publisher,source_url=excluded.source_url,published_at=excluded.published_at,retrieved_at=excluded.retrieved_at,sort_order=excluded.sort_order`).bind(project.id,story.headline,story.summary,story.team_name,story.publisher,story.source_url,story.published_at,story.retrieved_at,story.fingerprint,index*10));
    statements.push(env.DB.prepare("UPDATE vsport_projects SET status='stories_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(project.id));await env.DB.batch(statements);await finishJob(env,jobId,'completed',`stories:${stories.length}`);
  }catch(error){await finishJob(env,jobId,'failed','',error?.name==='AbortError'?'NEWS_TIMEOUT':error?.message||'DISCOVERY_FAILED')}
}

const scriptPrompt=(project,stories)=>`คุณเป็นบรรณาธิการข่าวฟุตบอลภาษาไทย จงเขียนสคริปต์เสียงแบบฟังต่อเนื่อง ความยาวเป้าหมาย ${project.target_minutes} นาที (ประมาณ ${project.target_minutes*125}-${project.target_minutes*150} คำภาษาไทย) จากรายการข่าวที่ให้เท่านั้น ห้ามเติมข้อเท็จจริง ตัวเลข คำพูด หรือข่าวอื่นที่ไม่มีในรายการ แยกเป็นบทนำ หัวข้อข่าวแต่ละเรื่อง และบทสรุป ทุกหัวข้อต้องลงท้ายบรรทัด [แหล่งข่าว: ชื่อสำนักข่าว | URL] ข้อความเชื่อมเชิงบรรณาธิการต้องใช้ถ้อยคำชัดว่าเป็นการวิเคราะห์หรือบริบท ไม่ใช่ข้อเท็จจริง หากข้อมูลไม่พอให้บอกตรง ๆ ว่าแหล่งข่าวยังไม่มีรายละเอียด ตอบเป็นภาษาไทยล้วนแบบข้อความธรรมดา
ขอบเขตทีม: ${project.scope_mode==='specific_team'?project.team_name:'ทุกทีมที่มีข่าวในวันนั้น'}
วันที่ข่าว: ${project.news_date}
ข่าวที่ผู้ใช้เลือก:
${stories.map((story,index)=>`${index+1}. ${story.headline}\nสำนักข่าว: ${story.publisher}\nเผยแพร่: ${story.published_at}\nURL: ${story.source_url}\nสรุปจากฟีด: ${story.summary||'ไม่มีรายละเอียดเพิ่มเติม'}`).join('\n\n')}`;

async function runScript(env,jobId,project){
  try{
    await finishJob(env,jobId,'running','compose_script');const rows=(await env.DB.prepare('SELECT headline,summary,publisher,source_url,published_at FROM vsport_stories WHERE project_id=? AND selected=1 ORDER BY sort_order,id LIMIT 24').bind(project.id).all()).results||[];if(!rows.length)throw new Error('NO_SELECTED_STORIES');
    const script=clean(await requestWorkNotesAI(env,scriptPrompt(project,rows),{maxTokens:8192,temperature:.25,deadlineMs:55000}),60000);if(script.length<1000)throw new Error('SCRIPT_TOO_SHORT');
    await env.DB.prepare("UPDATE vsport_projects SET narration_script=?,status='script_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(script,project.id).run();await finishJob(env,jobId,'completed',`characters:${script.length}`);
  }catch(error){await finishJob(env,jobId,'failed','',error?.message||'SCRIPT_FAILED')}
}

async function fetchPageImages(story){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await safeFollowFetch(story.source_url,{headers:{'user-agent':'Mozilla/5.0 VisionD-vSport/1.0','accept':'text/html'},signal:controller.signal});if(!response.ok)return[];
    const length=Number(response.headers.get('content-length')||0);if(length>2*1024*1024)return[];
    const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)return[];
    return extractImageUrls(new TextDecoder().decode(bytes),response.url||story.source_url,8);
  }catch{return[]}finally{clearTimeout(timer)}
}

async function safeFollowFetch(input,options={}){
  let url=String(input||'');
  for(let hop=0;hop<5;hop++){
    if(!isSafeRemoteUrl(url))throw new Error('REMOTE_URL_BLOCKED');
    const response=await fetch(url,{...options,redirect:'manual'});
    if(response.status<300||response.status>=400){if(!isSafeRemoteUrl(response.url||url))throw new Error('REMOTE_REDIRECT_BLOCKED');return response}
    const location=response.headers.get('location');if(!location)throw new Error('REMOTE_REDIRECT_INVALID');url=new URL(location,url).href;
  }
  throw new Error('REMOTE_REDIRECT_LIMIT');
}

async function runImageDiscovery(env,jobId,project){
  try{
    await finishJob(env,jobId,'running','find_images');const stories=(await env.DB.prepare('SELECT id,publisher,source_url FROM vsport_stories WHERE project_id=? AND selected=1 ORDER BY sort_order,id LIMIT 24').bind(project.id).all()).results||[];if(!stories.length)throw new Error('NO_SELECTED_STORIES');
    let count=0;
    for(let index=0;index<stories.length;index+=4){
      const group=stories.slice(index,index+4),sets=await Promise.all(group.map(fetchPageImages));
      const statements=[];group.forEach((story,offset)=>sets[offset].forEach(url=>{count++;statements.push(env.DB.prepare(`INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state) VALUES(?,?,?,?,?,'candidate') ON CONFLICT(project_id,source_url) DO NOTHING`).bind(project.id,story.id,url,story.source_url,story.publisher))}));if(statements.length)await env.DB.batch(statements);await finishJob(env,jobId,'running',`stories:${Math.min(index+4,stories.length)}/${stories.length}`);
    }
    if(!count)throw new Error('NO_IMAGE_CANDIDATES');await env.DB.prepare("UPDATE vsport_projects SET status='media_review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(project.id).run();await finishJob(env,jobId,'completed',`candidates:${count}`);
  }catch(error){await finishJob(env,jobId,'failed','',error?.message||'IMAGE_DISCOVERY_FAILED')}
}

async function ingestImage(ctx,auth,project,body){
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อมพื้นที่เก็บรูป FILES'},503,headers);
  const candidateId=integer(body.candidate_id,1,Number.MAX_SAFE_INTEGER),storyId=integer(body.story_id,1,Number.MAX_SAFE_INTEGER);let candidate;
  if(candidateId)candidate=await ctx.env.DB.prepare('SELECT c.id,c.story_id,c.source_url,c.source_page_url,c.publisher FROM vsport_image_candidates c WHERE c.id=? AND c.project_id=?').bind(candidateId,project.id).first();
  else if(storyId&&isSafeRemoteUrl(body.image_url)){
    const story=await ctx.env.DB.prepare('SELECT id,source_url,publisher FROM vsport_stories WHERE id=? AND project_id=?').bind(storyId,project.id).first();if(story){const inserted=await ctx.env.DB.prepare(`INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state) VALUES(?,?,?,?,?,'candidate') ON CONFLICT(project_id,source_url) DO UPDATE SET updated_at=CURRENT_TIMESTAMP RETURNING id`).bind(project.id,story.id,clean(body.image_url,2000),story.source_url,story.publisher).first();candidate={id:inserted.id,story_id:story.id,source_url:clean(body.image_url,2000),source_page_url:story.source_url,publisher:story.publisher}}
  }
  if(!candidate||!isSafeRemoteUrl(candidate.source_url))return json({error:'ไม่พบรูปที่เลือกหรือ URL รูปไม่ปลอดภัย'},400,headers);
  const existing=await ctx.env.DB.prepare('SELECT id FROM vsport_assets WHERE project_id=? AND candidate_id=?').bind(project.id,candidate.id).first();if(existing)return json({ok:true,id:existing.id,preview_url:`/api/admin/vsport-assets/${existing.id}`,reused:true},200,headers);
  let key='';
  try{
    const claimed=await ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='ingesting',error_message='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND (state IN ('candidate','failed') OR (state='ingesting' AND updated_at<datetime('now','-2 minutes')))").bind(candidate.id).run();if(!Number(claimed.meta?.changes))return json({error:'รูปนี้กำลังถูกนำเข้าอยู่ กรุณารอผลเดิม'},409,headers);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),response=await safeFollowFetch(candidate.source_url,{headers:{'user-agent':'Mozilla/5.0 VisionD-vSport/1.0','accept':'image/avif,image/webp,image/png,image/jpeg'},signal:controller.signal}).finally(()=>clearTimeout(timer));if(!response.ok)throw new Error(`IMAGE_HTTP_${response.status}`);
    const mime=clean(response.headers.get('content-type')?.split(';')[0],80).toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('IMAGE_MIME_UNSUPPORTED');const expected=Number(response.headers.get('content-length')||0);if(expected>8*1024*1024)throw new Error('IMAGE_TOO_LARGE');const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)throw new Error('IMAGE_TOO_LARGE');const dimensions=imageDimensions(bytes,mime);if(!dimensions||dimensions.width<320||dimensions.height<180)throw new Error('IMAGE_DECODE_OR_SIZE_INVALID');
    const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';key=`vsport/${auth.user.id}/${project.id}/${crypto.randomUUID()}.${ext}`;await ctx.env.FILES.put(key,bytes,{httpMetadata:{contentType:mime}});
    const row=await ctx.env.DB.prepare('INSERT INTO vsport_assets(project_id,story_id,candidate_id,owner_id,object_key,source_url,source_page_url,publisher,mime_type,file_size,width,height) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(project.id,candidate.story_id,candidate.id,auth.user.id,key,candidate.source_url,candidate.source_page_url,candidate.publisher,mime,bytes.length,dimensions.width,dimensions.height).first();await ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='ready',error_message='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(candidate.id).run();return json({ok:true,id:row.id,preview_url:`/api/admin/vsport-assets/${row.id}`,width:dimensions.width,height:dimensions.height},201,headers);
  }catch(error){if(key)await ctx.env.FILES.delete(key).catch(()=>{});await ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='failed',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(error?.name==='AbortError'?'IMAGE_TIMEOUT':error?.message||'IMAGE_INGEST_FAILED',300),candidate.id).run();return json({error:`นำเข้ารูปไม่สำเร็จ (${clean(error?.message||'IMAGE_INGEST_FAILED',120)})`,candidate_id:candidate.id},422,headers)}
}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({})),action=clean(body.action,40);
  if(action==='create'){
    const scopeMode=body.scope_mode==='specific_team'?'specific_team':body.scope_mode==='all_teams_for_day'?'all_teams_for_day':'',teamName=clean(body.team_name,120),targetMinutes=integer(body.target_minutes,25,35),newsDate=clean(body.news_date,10),title=clean(body.title,180)||`${teamName||'ข่าวฟุตบอล'} · ${newsDate}`;
    if(!scopeMode||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(newsDate)||![25,30,35].includes(targetMinutes)||scopeMode==='specific_team'&&!teamName)return json({error:'กรุณาเลือกวันที่ ขอบเขตทีม และความยาวให้ครบ'},400,headers);
    const row=await ctx.env.DB.prepare('INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(?,?,?,?,?,?) RETURNING id').bind(auth.user.id,title,newsDate,scopeMode,scopeMode==='specific_team'?teamName:'',targetMinutes).first();return json({ok:true,id:row.id},201,headers);
  }
  const projectId=integer(body.project_id,1,Number.MAX_SAFE_INTEGER),project=projectId?await ownedProject(ctx.env,projectId,auth.user.id,{withScript:true}):null;if(!project)return json({error:'ไม่พบโปรเจกต์ vSport'},404,headers);
  if(action==='save'){
    const targetSeconds=Number(body.target_seconds||0),script=clean(body.narration_script,60000),headline=clean(body.thumbnail_headline,180),subheadline=clean(body.thumbnail_subheadline,240),focusText=clean(body.thumbnail_focus_text,120),focusAssetId=integer(body.thumbnail_focus_asset_id,1,Number.MAX_SAFE_INTEGER),palette=['red-yellow','blue-white','black-gold'].includes(body.thumbnail_palette)?body.thumbnail_palette:'red-yellow',layout=['split','stack','spotlight'].includes(body.thumbnail_layout)?body.thumbnail_layout:'split';if(targetSeconds&&(!Number.isFinite(targetSeconds)||targetSeconds<1||targetSeconds>21600))return json({error:'ระยะเวลาเสียงต้องอยู่ระหว่าง 1–21,600 วินาที'},400,headers);if(focusAssetId&&!await ctx.env.DB.prepare('SELECT id FROM vsport_assets WHERE id=? AND project_id=? AND owner_id=?').bind(focusAssetId,project.id,auth.user.id).first())return json({error:'รูปเด่นไม่ได้อยู่ในโปรเจกต์นี้'},400,headers);
    const ids=[...new Set((body.story_ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))].slice(0,24),statements=[ctx.env.DB.prepare("UPDATE vsport_projects SET target_seconds=?,narration_script=?,thumbnail_headline=?,thumbnail_subheadline=?,thumbnail_focus_text=?,thumbnail_focus_asset_id=?,thumbnail_palette=?,thumbnail_layout=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(targetSeconds||0,script,headline,subheadline,focusText,focusAssetId||null,palette,layout,project.id,auth.user.id)];
    if(Array.isArray(body.story_ids)){statements.push(ctx.env.DB.prepare('UPDATE vsport_stories SET selected=0 WHERE project_id=?').bind(project.id));if(ids.length)statements.push(ctx.env.DB.prepare(`UPDATE vsport_stories SET selected=1 WHERE project_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(project.id,...ids))}await ctx.env.DB.batch(statements);return json({ok:true},200,headers);
  }
  if(action==='ingest_image')return ingestImage(ctx,auth,project,body);
  const types={discover:'discover',generate_script:'script',discover_images:'images'},type=types[action];if(!type)return json({error:'คำสั่ง vSport ไม่ถูกต้อง'},400,headers);const queued=await newJob(ctx,auth,project,type,body.idempotency_key);if(queued.error)return queued.error;if(queued.existing)return json({ok:true,job:queued.existing,reused:true},200,headers);
  const runners={discover:runDiscovery,script:runScript,images:runImageDiscovery};ctx.waitUntil(runners[type](ctx.env,queued.id,project));return json({ok:true,job:{id:queued.id,project_id:project.id,job_type:type,status:'queued'}},202,headers);
}
