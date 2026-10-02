import {json,requireAdmin,sha256} from '../../_lib.js';
import {balanceStories,bangkokNewsWindow,bingNewsRssUrlForWindow,escapeLike,extractImageUrls,imageDimensions,isSoccerEligibleNews,isDisplayEligibleImageCandidate,isLikelyContentImageUrl,isSafeRemoteUrl,isNewsRssEnvelope,NEWS_RESULT_LIMIT,newsRssUrlForWindow,parseCursor,parseNewsRss} from '../../_vsport.js';
import {requestWorkNotesAI} from '../../_work-notes-ai.js';
import {commonsSearchUrl,licensedCommonsImages,PEOPLE_BATCH,mergeManualPeople,parsePersonSuggestions,nameInScript,scriptTeamSubjects,excludeStoryTeamsFromPeople,scriptEventSubjects,parseScriptSubjects} from '../../_vsport-people.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const clean=(value,max)=>String(value??'').trim().slice(0,max);
const integer=(value,min,max)=>{const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:null};
const projectFields='id,title,news_date,scope_mode,team_name,target_minutes,target_seconds,status,thumbnail_headline,thumbnail_subheadline,thumbnail_focus_text,thumbnail_focus_asset_id,thumbnail_palette,thumbnail_layout,created_at,updated_at';
const jobFields='id,project_id,job_type,idempotency_key,status,checkpoint,error_text,created_at,updated_at';
const JOB_LEASE_MS=120000;
const NEWS_FETCH_TIMEOUT_MS=4500;
const NEWS_FETCH_ATTEMPTS=2;
const NEWS_MAX_BYTES=2*1024*1024;
const BBC_FOOTBALL_RSS='https://feeds.bbci.co.uk/sport/football/rss.xml';
const INGEST_LEASE_MS=120000;
const CLEANUP_LIMIT=24;
const DELETE_KEY_MIN=8;
const DELETE_KEY_MAX=128;
const SELECTED_STORY_SCAN_PAGES=4;
export function personCursorFromJob(key,value){const encoded=String(key||'').match(/:discover_images:cursor:(\d{1,3}):/u),fromKey=encoded?integer(encoded[1],0,120):null,fromBody=value===undefined||value===null?null:integer(value,0,120);if(fromKey!==null&&fromBody!==null&&fromKey!==fromBody)return null;return fromKey??fromBody??0}
export function newsImageCursorFromJob(key,value){
  const match=String(key||'').match(/:nimg:(\d{13}):cursor:(start|-?\d+~\d+):selection:([a-f0-9]{16})(?::|$)/u),token=match?.[2],supplied=String(value??'start');
  if(!match||token!==supplied)return null;
  if(token==='start')return{token,scanId:match[1],sortOrder:null,id:null};
  const [sortOrder,id]=token.split('~').map(Number);
  return Number.isSafeInteger(sortOrder)&&Number.isSafeInteger(id)&&id>0?{token,scanId:match[1],sortOrder,id}:null;
}

async function ownedProject(env,id,ownerId,{withScript=false}={}){
  return env.DB.prepare(`SELECT ${projectFields}${withScript?',narration_script,person_names_override,person_search_summary':''} FROM vsport_projects WHERE id=? AND owner_id=?`).bind(id,ownerId).first();
}

const isoAfter=milliseconds=>new Date(Date.now()+milliseconds).toISOString();
const rowChanges=result=>Number(result?.meta?.changes||0);
const cleanupBackoff=attempts=>Math.min(15*60,Math.max(30,2**Math.min(5,Math.max(0,attempts-1))*30));

async function exactObjectCleanup(files,objectKey){
  await files.head(objectKey);
  await files.delete(objectKey);
  return !(await files.head(objectKey));
}

async function countProjectCleanup(env,ownerId,projectId){
  const row=await env.DB.prepare("SELECT COUNT(*) count FROM vsport_object_cleanup_jobs WHERE owner_id=? AND project_id=? AND status<>'done'").bind(ownerId,projectId).first();
  return Number(row?.count||0);
}

async function updateReceiptCleanupState(env,ownerId,projectId,pending){
  await env.DB.prepare("UPDATE vsport_project_deletions SET cleanup_state=?,cleanup_completed_at=CASE WHEN ?=0 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE owner_id=? AND project_id=?").bind(pending?'pending':'complete',pending?1:0,ownerId,projectId).run();
}

async function processProjectCleanup(env,ownerId,projectId){
  if(!env.FILES){const pending=await countProjectCleanup(env,ownerId,projectId);await updateReceiptCleanupState(env,ownerId,projectId,pending);return{pending,processed:0}}
  const now=new Date().toISOString(),rows=(await env.DB.prepare("SELECT id,object_key,status,attempts FROM vsport_object_cleanup_jobs WHERE owner_id=? AND project_id=? AND status IN ('pending','error') AND (next_attempt_at IS NULL OR julianday(next_attempt_at)<=julianday(?)) ORDER BY COALESCE(next_attempt_at,created_at),id LIMIT ?").bind(ownerId,projectId,now,CLEANUP_LIMIT).all()).results||[];
  let processed=0;
  for(const row of rows){
    const claimUntil=isoAfter(INGEST_LEASE_MS),claimed=await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='pending',attempts=attempts+1,next_attempt_at=?,last_error_code='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND attempts=? AND (next_attempt_at IS NULL OR julianday(next_attempt_at)<=julianday(?))").bind(claimUntil,row.id,row.status,Number(row.attempts||0),now).run();
    if(!rowChanges(claimed))continue;
    processed++;
    let code='';
    try{if(!await exactObjectCleanup(env.FILES,row.object_key))code='R2_OBJECT_REMAINS'}catch(error){code=clean(error?.name==='AbortError'?'R2_CLEANUP_TIMEOUT':'R2_CLEANUP_FAILED',80)}
    if(!code)await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='done',next_attempt_at=NULL,last_error_code='',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(row.id).run();
    else{const attempts=Number(row.attempts||0)+1,next=isoAfter(cleanupBackoff(attempts)*1000);await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='error',next_attempt_at=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(next,code,row.id).run()}
  }
  const pending=await countProjectCleanup(env,ownerId,projectId);await updateReceiptCleanupState(env,ownerId,projectId,pending);return{pending,processed};
}

async function forceCleanupGuard(env,{ownerId,projectId,objectKey,writerFence}){
  const asset=await env.DB.prepare('SELECT id FROM vsport_assets WHERE owner_id=? AND project_id=? AND object_key=?').bind(ownerId,projectId,objectKey).first();
  if(asset)return{recorded:true,assetId:Number(asset.id)};
  const guard=await env.DB.prepare('SELECT id FROM vsport_object_cleanup_jobs WHERE owner_id=? AND project_id=? AND object_key=? AND writer_fence=?').bind(ownerId,projectId,objectKey,writerFence).first();
  if(!guard)return{recorded:false,cleaned:false};
  let cleaned=false,code='';
  try{cleaned=await exactObjectCleanup(env.FILES,objectKey);if(!cleaned)code='R2_OBJECT_REMAINS'}catch{code='R2_CLEANUP_FAILED'}
  if(cleaned)await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='done',reason='orphan_guard',next_attempt_at=NULL,last_error_code='',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND writer_fence=?").bind(guard.id,writerFence).run();
  else await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='error',next_attempt_at=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND writer_fence=?").bind(isoAfter(30000),code||'R2_CLEANUP_FAILED',guard.id,writerFence).run();
  return{recorded:false,cleaned};
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
  if(parts.has('stories')&&project.thumbnail_headline){const source=await ctx.env.DB.prepare('SELECT headline,summary,source_url FROM vsport_stories WHERE project_id=? AND headline=? LIMIT 1').bind(id,project.thumbnail_headline).first();project.thumbnail_headline_eligible=!source||isSoccerEligibleNews(source.headline,source.summary,source.source_url,project.scope_mode)}
  if(parts.has('stories')){const after=integer(params.get('story_cursor')||0,0,Number.MAX_SAFE_INTEGER),rows=(await ctx.env.DB.prepare('SELECT id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,selected,sort_order FROM vsport_stories WHERE project_id=? AND id>? ORDER BY id LIMIT 25').bind(id,after).all()).results||[],rawPage=rows.slice(0,24),stories=rawPage.filter(story=>isSoccerEligibleNews(story.headline,story.summary,story.source_url,project.scope_mode));result.stories=stories;result.story_pagination={limit:24,has_more:rows.length>24,next_cursor:rows.length>24&&rawPage.length?String(rawPage.at(-1).id):null,hidden_non_soccer:rawPage.length-stories.length}}
  if(parts.has('media')){
    project.selected_story_ids=((await ctx.env.DB.prepare('SELECT id FROM vsport_stories WHERE project_id=? AND selected=1 ORDER BY sort_order,id LIMIT 24').bind(id).all()).results||[]).map(row=>Number(row.id));
    const candidateAfter=integer(params.get('candidate_cursor')||0,0,Number.MAX_SAFE_INTEGER),assetAfter=integer(params.get('asset_cursor')||0,0,Number.MAX_SAFE_INTEGER),candidateRows=(await ctx.env.DB.prepare('SELECT c.id,c.story_id,c.source_url,c.source_page_url,c.publisher,c.state,c.error_message,c.created_at,c.person_name,c.subject_kind,c.subject_name,c.script_hash,c.license_code,c.identity_confirmed,c.story_association,s.headline AS story_headline,s.summary AS story_summary,s.source_url AS story_source_url FROM vsport_image_candidates c JOIN vsport_stories s ON s.id=c.story_id AND s.project_id=c.project_id WHERE c.project_id=? AND c.id>? ORDER BY c.id LIMIT 25').bind(id,candidateAfter).all()).results||[],assetRows=(await ctx.env.DB.prepare('SELECT a.id,a.story_id,a.candidate_id,a.source_url,a.source_page_url,a.publisher,a.mime_type,a.file_size,a.width,a.height,a.created_at,c.person_name,c.subject_kind,c.subject_name,c.script_hash,c.license_code,c.identity_confirmed,c.story_association,s.headline AS story_headline,s.summary AS story_summary,s.source_url AS story_source_url FROM vsport_assets a LEFT JOIN vsport_image_candidates c ON c.id=a.candidate_id JOIN vsport_stories s ON s.id=a.story_id AND s.project_id=a.project_id WHERE a.project_id=? AND a.id>? ORDER BY a.id LIMIT 25').bind(id,assetAfter).all()).results||[];
    const candidatePage=candidateRows.slice(0,24),assetPage=assetRows.slice(0,24);result.candidates=candidatePage.map(({story_headline,story_summary,story_source_url,...item})=>{const reason=!isSoccerEligibleNews(story_headline,story_summary,story_source_url,project.scope_mode)?'non_soccer_story':!isLikelyContentImageUrl(item.source_url)?'decorative_or_small_url':!isDisplayEligibleImageCandidate(item)?'failed_validation':'';return{...item,display_eligible:!reason,display_reason:reason}});result.assets=assetPage.map(({story_headline,story_summary,story_source_url,...item})=>({...item,story_eligible:isSoccerEligibleNews(story_headline,story_summary,story_source_url,project.scope_mode),preview_url:`/api/admin/vsport-assets/${item.id}`}));result.media_pagination={candidates:{limit:24,has_more:candidateRows.length>24,next_cursor:candidateRows.length>24?String(candidatePage.at(-1).id):null},assets:{limit:24,has_more:assetRows.length>24,next_cursor:assetRows.length>24?String(assetPage.at(-1).id):null}};
    try{const summary=JSON.parse(project.person_search_summary||'{}');if(/^[a-f0-9]{64}$/u.test(summary.script_hash||'')){const counts=(await ctx.env.DB.prepare("SELECT c.person_name,COUNT(a.id) AS saved FROM vsport_image_candidates c JOIN vsport_assets a ON a.candidate_id=c.id AND a.project_id=c.project_id WHERE c.project_id=? AND c.script_hash=? AND c.identity_confirmed=1 AND c.person_name<>'' GROUP BY c.person_name LIMIT 121").bind(id,summary.script_hash).all()).results||[];project.person_saved_counts=Object.fromEntries(counts.map(row=>[row.person_name,Number(row.saved)]))}}catch{}
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

const newsError=(code,message,discovery)=>Object.assign(new Error(message),{code,discovery});
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const newsProviderState=Object.freeze({stories:'stories',empty:'empty',unavailable:'unavailable',skipped:'skipped'});
const newsFailureClass=error=>error?.name==='AbortError'?'timeout':error?.message==='NEWS_PROVIDER_HTTP'?'http':error?.message==='NEWS_RESPONSE_TOO_LARGE'?'size':error?.message==='NEWS_RSS_ENVELOPE_INVALID'?'envelope':error?.message==='NEWS_RSS_PARSE'?'parse':'network';

export function newsDiscoveryCheckpoint(discovery){
  const states=value=>{const result={google:Object.values(newsProviderState).includes(value?.google)?value.google:'skipped',bing:Object.values(newsProviderState).includes(value?.bing)?value.bing:'skipped'};if(Object.values(newsProviderState).includes(value?.bbc))result.bbc=value.bbc;return result},selected=String(discovery?.selected||''),from=String(discovery?.from||''),to=String(discovery?.to||''),mode=['exact','fallback','zero','unavailable'].includes(discovery?.mode)?discovery.mode:'unavailable',count=integer(discovery?.count||0,0,NEWS_RESULT_LIMIT)??0;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return'';
  const failures={};for(const [phase,prefix] of [['exact','e'],['fallback','f']])for(const [provider,suffix] of [['google','g'],['bing','b'],['bbc','c']]){const reason=discovery?.failures?.[phase]?.[provider];if(['http','timeout','size','envelope','parse','network'].includes(reason))failures[`${prefix}${suffix}`]=reason}
  const checkpoint={v:1,kind:'news',mode,selected,from,to,count,exact:states(discovery?.exact),fallback:states(discovery?.fallback)};if(Object.keys(failures).length)checkpoint.failures=failures;return JSON.stringify(checkpoint);
}

async function readNewsResponse(response){
  const expected=Number(response.headers.get('content-length')||0);if(expected>NEWS_MAX_BYTES)throw new Error('NEWS_RESPONSE_TOO_LARGE');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>NEWS_MAX_BYTES)throw new Error('NEWS_RESPONSE_TOO_LARGE');
  return new TextDecoder().decode(bytes);
}

const mergeWindowStories=(current,incoming,scopeMode)=>{
  const seen=new Set(),merged=[];
  for(const story of [...current,...incoming]){if(seen.has(story.fingerprint))continue;seen.add(story.fingerprint);merged.push(story)}
  merged.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  return scopeMode==='all_teams_for_day'?balanceStories(merged,{limit:NEWS_RESULT_LIMIT}):merged.slice(0,NEWS_RESULT_LIMIT);
};

async function discoverWindow(project,windowKind,{fetchImpl,timeoutMs,retryDelayMs,sleepImpl,onAttempt,successfulResponses}){
  const outcomes={google:'skipped',bing:'skipped'},reasons={},providers=[{id:'google',url:newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,windowKind)},{id:'bing',url:bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,windowKind)},{id:'bbc',url:BBC_FOOTBALL_RSS}];let stories=[],selectedProvider='',selectedAttempt=0;
  for(const provider of providers){
    if(provider.id==='bbc'&&stories.length)break;
    const excludedFingerprints=new Set(stories.map(story=>story.fingerprint));
    const cacheKey=`${provider.id}\n${provider.url}`,cached=successfulResponses.get(cacheKey);
    if(cached){
      const parsed=parseNewsRss(cached.xml,{newsDate:project.news_date,windowKind,scopeMode:project.scope_mode,teamName:project.team_name,limit:NEWS_RESULT_LIMIT,excludedFingerprints,retrievedAt:cached.retrievedAt,bbcOnly:provider.id==='bbc'});outcomes[provider.id]=parsed.length?'stories':'empty';
      if(parsed.length){if(!selectedProvider){selectedProvider=provider.id;selectedAttempt=cached.attempt}stories=mergeWindowStories(stories,parsed,project.scope_mode);if(stories.length>=NEWS_RESULT_LIMIT)break}
      continue;
    }
    for(let attempt=1;attempt<=NEWS_FETCH_ATTEMPTS;attempt++){
      await onAttempt({provider:provider.id,windowKind,attempt,maxAttempts:NEWS_FETCH_ATTEMPTS});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1,timeoutMs));
      try{
        const response=await fetchImpl(provider.url,{headers:{'user-agent':'VisionD-vSport/1.0','accept':'application/rss+xml, application/xml, text/xml'},signal:controller.signal});
        if(!response.ok)throw new Error('NEWS_PROVIDER_HTTP');
        const xml=await readNewsResponse(response);if(!isNewsRssEnvelope(xml))throw new Error('NEWS_RSS_ENVELOPE_INVALID');
        const retrievedAt=new Date().toISOString();let parsed;try{parsed=parseNewsRss(xml,{newsDate:project.news_date,windowKind,scopeMode:project.scope_mode,teamName:project.team_name,limit:NEWS_RESULT_LIMIT,excludedFingerprints,retrievedAt,bbcOnly:provider.id==='bbc'})}catch{throw new Error('NEWS_RSS_PARSE')}successfulResponses.set(cacheKey,{xml,retrievedAt,attempt});outcomes[provider.id]=parsed.length?'stories':'empty';delete reasons[provider.id];
        if(parsed.length){if(!selectedProvider){selectedProvider=provider.id;selectedAttempt=attempt}stories=mergeWindowStories(stories,parsed,project.scope_mode)}
        break;
      }catch(error){
        if(attempt<NEWS_FETCH_ATTEMPTS)await sleepImpl(Math.max(0,retryDelayMs)*attempt);else{outcomes[provider.id]='unavailable';reasons[provider.id]=newsFailureClass(error)}
      }finally{clearTimeout(timer)}
    }
    if(stories.length>=NEWS_RESULT_LIMIT)break;
  }
  return{stories,provider:selectedProvider,attempt:selectedAttempt,outcomes,reasons};
}

export async function discoverNews(project,{fetchImpl=fetch,timeoutMs=NEWS_FETCH_TIMEOUT_MS,retryDelayMs=250,sleepImpl=sleep,onAttempt=async()=>{}}={}){
  const options={fetchImpl,timeoutMs,retryDelayMs,sleepImpl,onAttempt,successfulResponses:new Map()},exactWindow=bangkokNewsWindow(project.news_date,'exact'),fallbackWindow=bangkokNewsWindow(project.news_date,'fallback'),exact=await discoverWindow(project,'exact',options),base={selected:project.news_date,from:exactWindow.from_day,to:exactWindow.to_day,exact:exact.outcomes,fallback:{google:'skipped',bing:'skipped'},failures:{exact:exact.reasons,fallback:{}}};
  if(exact.stories.length)return{...exact,windowKind:'exact',discovery:{...base,mode:'exact',count:exact.stories.length}};
  const exactValid=Object.values(exact.outcomes).some(state=>state==='empty');
  if(!exactValid)throw newsError('NEWS_SOURCES_UNAVAILABLE','แหล่งข่าว Google News, Bing News และ BBC Sport ไม่พร้อมใช้งานชั่วคราว กรุณารอ 1–2 นาที แล้วกด “ค้นข่าววันนี้” อีกครั้ง ระบบจะใช้โปรเจกต์เดิมต่อและไม่สร้างข่าวซ้ำ',{...base,mode:'unavailable',count:0});
  const fallback=await discoverWindow(project,'fallback',options),fallbackBase={...base,from:fallbackWindow.from_day,to:fallbackWindow.to_day,fallback:fallback.outcomes,failures:{exact:exact.reasons,fallback:fallback.reasons}};
  if(fallback.stories.length)return{...fallback,windowKind:'fallback',discovery:{...fallbackBase,mode:'fallback',count:fallback.stories.length}};
  const unavailable=[...Object.values(exact.outcomes),...Object.values(fallback.outcomes)].includes('unavailable');
  if(unavailable)throw newsError('NEWS_SOURCES_UNAVAILABLE','แหล่งข่าวบางส่วนไม่พร้อมใช้งาน จึงยืนยันผลข่าวว่างไม่ได้ กรุณากด “ค้นข่าววันนี้” อีกครั้ง ระบบจะใช้โปรเจกต์เดิมต่อและไม่สร้างข่าวซ้ำ',{...fallbackBase,mode:'unavailable',count:0});
  throw newsError('NEWS_NOT_FOUND',`ไม่พบข่าวตรงวันที่ ${project.news_date} หรือในสองวันก่อนหน้าจากแหล่งข่าวที่ตรวจสำเร็จ กรุณาตรวจวันที่หรือทีม แล้วกด “ค้นข่าววันนี้” อีกครั้ง`,{...fallbackBase,mode:'zero',count:0});
}

async function runDiscovery(env,jobId,project){
  try{
    await finishJob(env,jobId,'running','fetch_news');
    const discovery=await discoverNews(project,{onAttempt:({provider,windowKind,attempt,maxAttempts})=>finishJob(env,jobId,'running',`fetch_news:${windowKind}:${provider}:${attempt}/${maxAttempts}`)}),stories=discovery.stories;
    const statements=stories.map((story,index)=>env.DB.prepare(`INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,?,?,?,?,?,?,?,?,0,?) ON CONFLICT(project_id,fingerprint) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,team_name=excluded.team_name,publisher=excluded.publisher,source_url=excluded.source_url,published_at=excluded.published_at,retrieved_at=excluded.retrieved_at,sort_order=excluded.sort_order`).bind(project.id,story.headline,story.summary,story.team_name,story.publisher,story.source_url,story.published_at,story.retrieved_at,story.fingerprint,index*10));
    statements.push(env.DB.prepare("UPDATE vsport_projects SET status='stories_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(project.id));await env.DB.batch(statements);await finishJob(env,jobId,'completed',newsDiscoveryCheckpoint(discovery.discovery));
  }catch(error){await finishJob(env,jobId,'failed',newsDiscoveryCheckpoint(error?.discovery),error?.message||'ค้นข่าวไม่สำเร็จ กรุณาลองอีกครั้ง')}
}

async function selectedSoccerStories(env,projectId,scopeMode,fields){
  const stories=[];let scanned=0,sortOrder=0,id=0,started=false;
  for(let page=0;page<SELECTED_STORY_SCAN_PAGES&&stories.length<24;page++){
    const where=started?'project_id=? AND selected=1 AND (sort_order>? OR (sort_order=? AND id>?))':'project_id=? AND selected=1',bindings=started?[projectId,sortOrder,sortOrder,id]:[projectId],rows=(await env.DB.prepare(`SELECT id,headline,summary,sort_order,${fields} FROM vsport_stories WHERE ${where} ORDER BY sort_order,id LIMIT 24`).bind(...bindings).all()).results||[];
    scanned+=rows.length;for(const story of rows)if(isSoccerEligibleNews(story.headline,story.summary,story.source_url,scopeMode)){stories.push(story);if(stories.length===24)break}
    if(rows.length<24)return{stories,scanned,complete:true};const last=rows.at(-1);sortOrder=Number(last.sort_order);id=Number(last.id);started=true;
  }
  return{stories,scanned,complete:stories.length===24};
}

const scriptPrompt=(project,stories)=>`คุณเป็นบรรณาธิการข่าวฟุตบอลภาษาไทย จงเขียนสคริปต์เสียงแบบฟังต่อเนื่อง ความยาวเป้าหมาย ${project.target_minutes} นาที (ประมาณ ${project.target_minutes*125}-${project.target_minutes*150} คำภาษาไทย) จากรายการข่าวที่ให้เท่านั้น ห้ามเติมข้อเท็จจริง ตัวเลข คำพูด หรือข่าวอื่นที่ไม่มีในรายการ แยกเป็นบทนำ หัวข้อข่าวแต่ละเรื่อง และบทสรุป ทุกหัวข้อต้องลงท้ายบรรทัด [แหล่งข่าว: ชื่อสำนักข่าว | URL] ข้อความเชื่อมเชิงบรรณาธิการต้องใช้ถ้อยคำชัดว่าเป็นการวิเคราะห์หรือบริบท ไม่ใช่ข้อเท็จจริง หากข้อมูลไม่พอให้บอกตรง ๆ ว่าแหล่งข่าวยังไม่มีรายละเอียด ตอบเป็นภาษาไทยล้วนแบบข้อความธรรมดา
ขอบเขตทีม: ${project.scope_mode==='specific_team'?project.team_name:'ทุกทีมที่มีข่าวในวันนั้น'}
วันที่ข่าว: ${project.news_date}
ข่าวที่ผู้ใช้เลือก:
${stories.map((story,index)=>`${index+1}. ${story.headline}\nสำนักข่าว: ${story.publisher}\nเผยแพร่: ${story.published_at}\nURL: ${story.source_url}\nสรุปจากฟีด: ${story.summary||'ไม่มีรายละเอียดเพิ่มเติม'}`).join('\n\n')}`;

async function runScript(env,jobId,project){
  try{
    await finishJob(env,jobId,'running','compose_script');const selected=await selectedSoccerStories(env,project.id,project.scope_mode,'publisher,source_url,published_at');if(!selected.complete)throw new Error('STORY_SELECTION_REVIEW_REQUIRED');const rows=selected.stories;if(!rows.length)throw new Error(selected.scanned?'NO_ELIGIBLE_SOCCER_STORIES':'NO_SELECTED_STORIES');
    const script=clean(await requestWorkNotesAI(env,scriptPrompt(project,rows),{maxTokens:8192,temperature:.25,deadlineMs:55000}),60000);if(script.length<1000)throw new Error('SCRIPT_TOO_SHORT');
    await env.DB.prepare("UPDATE vsport_projects SET narration_script=?,status='script_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(script,project.id).run();await finishJob(env,jobId,'completed',`characters:${script.length}`);
  }catch(error){await finishJob(env,jobId,'failed','',error?.message||'SCRIPT_FAILED')}
}

async function fetchPageImages(story){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await safeFollowFetch(story.source_url,{headers:{'user-agent':'Mozilla/5.0 VisionD-vSport/1.0','accept':'text/html'},signal:controller.signal});if(!response.ok)return{urls:[],unavailable:true};
    const length=Number(response.headers.get('content-length')||0);if(length>2*1024*1024)return{urls:[],unavailable:true};
    const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)return{urls:[],unavailable:true};
    return{urls:extractImageUrls(new TextDecoder().decode(bytes),response.url||story.source_url,4),unavailable:false};
  }catch{return{urls:[],unavailable:true}}finally{clearTimeout(timer)}
}

async function runNewsImageBatch(env,jobId,project,cursor,expectedIds){
  try{
    await finishJob(env,jobId,'running',`news:${cursor.token}`);
    const selectedIds=async()=>(await env.DB.prepare('SELECT id FROM vsport_stories WHERE project_id=? AND selected=1 ORDER BY sort_order,id LIMIT 25').bind(project.id).all()).results.map(row=>Number(row.id)).sort((a,b)=>a-b);
    const expected=[...new Set(expectedIds)].sort((a,b)=>a-b),sameSelection=ids=>JSON.stringify(ids)===JSON.stringify(expected);
    if(!expected.length||!sameSelection(await selectedIds()))throw new Error('NEWS_SELECTION_CHANGED_RESTART');
    const where=cursor.id===null?'project_id=? AND selected=1':'project_id=? AND selected=1 AND (sort_order>? OR (sort_order=? AND id>?))',bindings=cursor.id===null?[project.id]:[project.id,cursor.sortOrder,cursor.sortOrder,cursor.id];
    const rows=(await env.DB.prepare(`SELECT id,headline,summary,sort_order,publisher,source_url FROM vsport_stories WHERE ${where} ORDER BY sort_order,id LIMIT 4`).bind(...bindings).all()).results||[],page=rows.slice(0,3),next=rows.length>3&&page.length?`${page.at(-1).sort_order}~${page.at(-1).id}`:null;
    const prior=await Promise.all(page.map(story=>env.DB.prepare("SELECT source_url,state,error_message FROM vsport_image_candidates WHERE project_id=? AND story_id=? AND story_association='news_cover' ORDER BY id LIMIT 4").bind(project.id,story.id).all().then(value=>value.results||[])));
    const fetched=await Promise.all(page.map((story,index)=>!isSoccerEligibleNews(story.headline,story.summary,story.source_url,project.scope_mode)?Promise.resolve({urls:[],excluded:true}):prior[index].some(isDisplayEligibleImageCandidate)?Promise.resolve({urls:[],existing:true}):fetchPageImages(story)));
    if(!sameSelection(await selectedIds()))throw new Error('NEWS_SELECTION_CHANGED_RESTART');
    const items=[];
    for(const [index,story] of page.entries()){
      const result=fetched[index];
      if(!result.excluded&&!result.existing){const statements=result.urls.slice(0,4).map(url=>env.DB.prepare("INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state,story_association) VALUES(?,?,?,?,?,'candidate','news_cover') ON CONFLICT(project_id,source_url) DO NOTHING").bind(project.id,story.id,url,story.source_url,story.publisher));if(statements.length)await env.DB.batch(statements)}
      const current=result.excluded?[]:(await env.DB.prepare("SELECT source_url,state,error_message FROM vsport_image_candidates WHERE project_id=? AND story_id=? AND story_association='news_cover' ORDER BY id LIMIT 4").bind(project.id,story.id).all()).results||[],count=current.filter(isDisplayEligibleImageCandidate).length;
      items.push({id:story.id,s:result.excluded?'x':count?'f':result.unavailable?'u':result.urls.length?'d':'e',n:count});
    }
    await finishJob(env,jobId,'completed',JSON.stringify({v:1,next,items}));
  }catch(error){await finishJob(env,jobId,'failed','',error?.message||'NEWS_IMAGE_DISCOVERY_FAILED')}
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

async function fetchCommonsPerson(search,{person=false}={}){
  const found=[],seen=new Set(),queries=[{cc0:true,offset:0},{cc0:true,offset:18},{cc0:false,offset:0}];let responses=0,failed=0;
  for(const query of queries){if(found.length>=5)break;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);try{const response=await fetch(commonsSearchUrl(search,query),{headers:{'user-agent':'VisionD-vSport/1.0 (https://visiondonline.com/)','accept':'application/json'},signal:controller.signal});if(!response.ok){failed++;continue}const size=Number(response.headers.get('content-length')||0);if(size>1024*1024){failed++;continue}const bytes=await response.arrayBuffer();if(bytes.byteLength>1024*1024){failed++;continue}const payload=JSON.parse(new TextDecoder().decode(bytes));if(payload?.error){failed++;break}if(!payload?.query||typeof payload.query!=='object'||Array.isArray(payload.query)||payload.query.pages!==undefined&&!Array.isArray(payload.query.pages)){failed++;continue}responses++;for(const image of licensedCommonsImages(payload,search,{person}))if(!seen.has(image.url)){seen.add(image.url);found.push(image);if(found.length===5)break}}catch{failed++}finally{clearTimeout(timer)}}return{images:found,providerError:responses===0,providerPartial:responses>0&&failed>0};
}

async function runImageDiscovery(env,jobId,project,personCursor=0){
  try{
    await finishJob(env,jobId,'running','extract_people');const selected=await selectedSoccerStories(env,project.id,project.scope_mode,'publisher,source_url,team_name');if(!selected.complete)throw new Error('STORY_SELECTION_REVIEW_REQUIRED');const stories=selected.stories;if(!stories.length)throw new Error(selected.scanned?'NO_ELIGIBLE_SOCCER_STORIES':'NO_SELECTED_STORIES');
    const script=String(project.narration_script||'').trim();if(!script)throw new Error('NO_SCRIPT_SAVE_FIRST');const scriptHash=await sha256(script),rosterHash=await sha256(`${script}\n${project.person_names_override||''}`),previous=(()=>{try{return JSON.parse(project.person_search_summary||'{}')}catch{return{}}})();let people=[];
    if(personCursor>0){if(previous.roster_hash!==rosterHash||!Array.isArray(previous.roster))throw new Error('PERSON_ROSTER_CHANGED_RESTART');people=previous.roster.filter(item=>nameInScript(script,item.name))}
    else{
      const prompt=`Extract every named football person explicitly present in the Thai narration. Return ONLY JSON array [{"name":"exact substring from script","search":"common Latin full name for Commons search","script_span":"exact substring from script"}]. No invented names. Include user-edited names even if the selected story does not mention them. At most 120 names, first-mention order. Text:\n${script}`;
      let suggested=[],aiFailed=false;
      try{const raw=await requestWorkNotesAI(env,prompt,{maxTokens:4800,temperature:0,deadlineMs:20000}),match=String(raw).match(/\[[\s\S]*\]/u);if(!match||!Array.isArray(JSON.parse(match[0])))throw new Error('AI_PERSON_JSON_INVALID');suggested=parsePersonSuggestions(raw,script);if(!suggested.length&&JSON.parse(match[0]).length){const repair=await requestWorkNotesAI(env,`Map each football person named in this script to an EXACT substring visibly present in the script. Return ONLY JSON array [{"name":"exact script substring","search":"common Latin full name"}]. Never invent a person. Script:\n${script}`,{maxTokens:4800,temperature:0,deadlineMs:20000});suggested=parsePersonSuggestions(repair,script)}}catch{aiFailed=true}
      people=excludeStoryTeamsFromPeople(mergeManualPeople(suggested,project.person_names_override,script),script,stories).map(item=>({...item,kind:'person'}));
      if(!people.length)people=scriptTeamSubjects(script,stories);
      if(!people.length){let events=[];try{const raw=await requestWorkNotesAI(env,`Find up to six named football events or visual topics explicitly present in this narration and supported by its selected news. Return ONLY JSON array [{"kind":"event or topic","name":"exact substring from script","search":"short English Commons search"}]. Never invent a person or event. News: ${stories.map(item=>`${item.headline} ${item.summary}`).join(' | ').slice(0,6000)}\nScript:\n${script}`,{maxTokens:2000,temperature:0,deadlineMs:15000});events=parseScriptSubjects(raw,script)}catch{aiFailed=true}people=events.length?events:scriptEventSubjects(script)}
      await env.DB.prepare('UPDATE vsport_projects SET person_search_summary=? WHERE id=? AND narration_script=? AND person_names_override=?').bind(JSON.stringify({script_hash:scriptHash,roster_hash:rosterHash,roster:people,names:people.filter(item=>item.kind==='person').map(item=>item.name),subjects:people.filter(item=>item.kind!=='person'),people:[],next_cursor:0,limit:PEOPLE_BATCH,truncated:people.length===120,ai_failed:aiFailed}),project.id,project.narration_script,project.person_names_override||'').run()
    }
    const cursor=Math.min(Math.max(0,personCursor),people.length),batch=people.slice(cursor,cursor+PEOPLE_BATCH),counts=[],seen=new Set();
    for(let offset=0;offset<batch.length;offset+=2){
      const current=await env.DB.prepare('SELECT narration_script FROM vsport_projects WHERE id=?').bind(project.id).first();if(await sha256(String(current?.narration_script||'').trim())!==scriptHash)throw new Error('SCRIPT_CHANGED_RESTART_DISCOVERY');
      await finishJob(env,jobId,'running',`person:${cursor+offset+1}/${people.length}`);const pair=batch.slice(offset,offset+2),results=await Promise.all(pair.map(person=>fetchCommonsPerson(person.search,{person:person.kind==='person'})));
      for(const [index,person] of pair.entries()){const result=results[index],statements=[],typed=person.kind&&person.kind!=='person',match=stories.find(story=>nameInScript(`${story.headline} ${story.summary}`,person.name)||person.kind==='team'&&String(story.team_name||'')===person.search);for(const image of result.images){if(seen.has(image.url))continue;seen.add(image.url);statements.push(env.DB.prepare("INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state,person_name,subject_kind,subject_name,script_hash,license_code,story_association) VALUES(?,?,?,?,?,'candidate',?,?,?,?,?,?) ON CONFLICT(project_id,source_url) DO NOTHING").bind(project.id,(match||stories[0]).id,image.url,image.pageUrl,'Wikimedia Commons',typed?'':person.name,typed?person.kind:'',typed?person.name:'',scriptHash,image.license,match?'selected_story':'script_only'))}if(statements.length)await env.DB.batch(statements);const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM vsport_image_candidates WHERE project_id=? AND script_hash=? AND subject_kind=? AND subject_name=? AND person_name=?').bind(project.id,scriptHash,typed?person.kind:'',typed?person.name:'',typed?'':person.name).first();counts.push({kind:typed?person.kind:'person',name:person.name,search:person.search,candidates:Number(count?.n||0),shortfall:Math.max(0,3-Number(count?.n||0)),provider_error:result.providerError,provider_partial:result.providerPartial})}
    }
    const old=previous.script_hash===scriptHash&&previous.roster_hash===rosterHash?previous.people||[]:[],merged=new Map(old.map(item=>[item.name,item]));for(const item of counts)merged.set(item.name,item);const summary={script_hash:scriptHash,roster_hash:rosterHash,roster:people,names:people.filter(item=>item.kind==='person').map(item=>item.name),subjects:people.filter(item=>item.kind!=='person'),people:[...merged.values()],next_cursor:cursor+batch.length<people.length?cursor+batch.length:null,limit:PEOPLE_BATCH,provider:'Wikimedia Commons PD/CC0',truncated:people.length===120,ai_failed:previous.script_hash===scriptHash&&previous.roster_hash===rosterHash?Boolean(previous.ai_failed):false};
    await env.DB.prepare("UPDATE vsport_projects SET status='media_review',person_search_summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND narration_script=? AND person_names_override=?").bind(JSON.stringify(summary),project.id,project.narration_script,project.person_names_override||'').run();await finishJob(env,jobId,'completed',`people:${cursor+batch.length}/${people.length};candidates:${counts.reduce((n,item)=>n+item.candidates,0)}`);
  }catch(error){await finishJob(env,jobId,'failed','',error?.message||'IMAGE_DISCOVERY_FAILED')}
}

async function ingestImage(ctx,auth,project,body){
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อมพื้นที่เก็บรูป FILES'},503,headers);
  const candidateId=integer(body.candidate_id,1,Number.MAX_SAFE_INTEGER),storyId=integer(body.story_id,1,Number.MAX_SAFE_INTEGER);let candidate;
  if(candidateId)candidate=await ctx.env.DB.prepare('SELECT c.id,c.story_id,c.source_url,c.source_page_url,c.publisher,c.person_name,c.subject_kind,c.subject_name,c.story_association,c.script_hash,c.license_code,s.headline,s.summary,s.source_url AS story_source_url FROM vsport_image_candidates c JOIN vsport_stories s ON s.id=c.story_id AND s.project_id=c.project_id WHERE c.id=? AND c.project_id=?').bind(candidateId,project.id).first();
  else if(storyId&&isSafeRemoteUrl(body.image_url)){
    const story=await ctx.env.DB.prepare('SELECT id,headline,summary,source_url,publisher FROM vsport_stories WHERE id=? AND project_id=?').bind(storyId,project.id).first();if(story&&!isSoccerEligibleNews(story.headline,story.summary,story.source_url,project.scope_mode))return json({error:'ข่าวนี้ไม่ใช่ข่าวฟุตบอลที่รองรับ'},422,headers);if(story){const personName=clean(body.person_name,100),url=clean(body.image_url,2000);if(personName&&!nameInScript(project.narration_script,personName))return json({error:'ชื่อบุคคลต้องปรากฏในบทที่บันทึกแล้ว'},422,headers);const scriptHash=personName?await sha256(String(project.narration_script||'').trim()):'',existingCandidate=await ctx.env.DB.prepare('SELECT id,person_name,script_hash FROM vsport_image_candidates WHERE project_id=? AND source_url=?').bind(project.id,url).first();if(existingCandidate&&(existingCandidate.person_name!==personName||existingCandidate.script_hash!==scriptHash))return json({error:'URL รูปนี้ถูกผูกกับบุคคลหรือบทอื่นแล้ว กรุณาใช้รูปอื่น',code:'PERSON_IMAGE_URL_CONFLICT'},409,headers);const inserted=existingCandidate||await ctx.env.DB.prepare(`INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state,person_name,script_hash,license_code,story_association) VALUES(?,?,?,?,?,'candidate',?,?,'manual_unverified','selected_story') ON CONFLICT(project_id,source_url) DO NOTHING RETURNING id`).bind(project.id,story.id,url,story.source_url,story.publisher,personName,scriptHash).first();if(!inserted)return json({error:'รูปนี้ถูกเพิ่มพร้อมกัน กรุณาโหลดรายการใหม่',code:'PERSON_IMAGE_URL_CONFLICT'},409,headers);candidate={id:inserted.id,story_id:story.id,source_url:url,source_page_url:story.source_url,publisher:story.publisher,person_name:personName,script_hash:scriptHash,license_code:'manual_unverified',headline:story.headline,summary:story.summary,story_source_url:story.source_url}}
  }
  if(candidate&&!isSoccerEligibleNews(candidate.headline,candidate.summary,candidate.story_source_url,project.scope_mode))return json({error:'ข่าวนี้ไม่ใช่ข่าวฟุตบอลที่รองรับ'},422,headers);
  if(!candidate||!isSafeRemoteUrl(candidate.source_url))return json({error:'ไม่พบรูปที่เลือกหรือ URL รูปไม่ปลอดภัย'},400,headers);
  if(candidate.person_name){if(!body.confirm_identity)return json({error:'กรุณายืนยันด้วยตนเองว่ารูปเป็นบุคคลที่ระบุ และตรวจสิทธิ์การใช้รูป'},422,headers);if(candidate.script_hash!==await sha256(String(project.narration_script||'').trim()))return json({error:'บทเปลี่ยนแล้ว กรุณาค้นรูปบุคคลใหม่'},409,headers)}
  if(['team','event','topic'].includes(candidate.subject_kind)){if(!body.confirm_subject)return json({error:'กรุณายืนยันว่าภาพเกี่ยวข้องกับหัวข้อที่ระบุและตรวจสิทธิ์การใช้รูป'},422,headers);if(!nameInScript(project.narration_script,candidate.subject_name)||candidate.script_hash!==await sha256(String(project.narration_script||'').trim()))return json({error:'บทเปลี่ยนแล้ว กรุณาค้นภาพจากบทใหม่'},409,headers)}
  if(candidate.story_association==='news_cover'&&!body.confirm_news)return json({error:'กรุณาตรวจว่าภาพมาจากข่าวที่เลือกและมีสิทธิ์ใช้เป็นภาพเปิด'},422,headers);
  const existing=await ctx.env.DB.prepare('SELECT id FROM vsport_assets WHERE project_id=? AND candidate_id=?').bind(project.id,candidate.id).first();if(existing)return json({ok:true,id:existing.id,preview_url:`/api/admin/vsport-assets/${existing.id}`,reused:true},200,headers);
  const writerFence=crypto.randomUUID();let key='',guardId='';
  try{
    const claimed=await ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='ingesting',error_message='',ingest_fence=?,ingest_lease_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=? AND EXISTS(SELECT 1 FROM vsport_projects p WHERE p.id=vsport_image_candidates.project_id AND p.owner_id=?) AND (state IN ('candidate','failed') OR (state='ingesting' AND (ingest_lease_expires_at IS NULL OR julianday(ingest_lease_expires_at)<=julianday(?))))").bind(writerFence,isoAfter(INGEST_LEASE_MS),candidate.id,project.id,auth.user.id,new Date().toISOString()).run();if(!rowChanges(claimed))return json({error:'รูปนี้กำลังถูกนำเข้าอยู่ กรุณารอผลเดิม'},409,headers);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),response=await safeFollowFetch(candidate.source_url,{headers:{'user-agent':'Mozilla/5.0 VisionD-vSport/1.0','accept':'image/webp,image/png,image/jpeg'},signal:controller.signal}).finally(()=>clearTimeout(timer));if(!response.ok)throw new Error(`IMAGE_HTTP_${response.status}`);
    const mime=clean(response.headers.get('content-type')?.split(';')[0],80).toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED');const expected=Number(response.headers.get('content-length')||0);if(expected>8*1024*1024)throw new Error('IMAGE_TOO_LARGE');const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)throw new Error('IMAGE_TOO_LARGE');const dimensions=imageDimensions(bytes,mime);if(!dimensions||dimensions.width<320||dimensions.height<180)throw new Error('IMAGE_DECODE_OR_SIZE_INVALID');
    const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg',leaseExpiresAt=isoAfter(INGEST_LEASE_MS);key=`vsport/${auth.user.id}/${project.id}/${crypto.randomUUID()}.${ext}`;guardId=crypto.randomUUID();
    const guarded=await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE vsport_image_candidates SET ingest_lease_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=? AND state='ingesting' AND ingest_fence=? AND EXISTS(SELECT 1 FROM vsport_projects WHERE id=? AND owner_id=?)").bind(leaseExpiresAt,candidate.id,project.id,writerFence,project.id,auth.user.id),
      ctx.env.DB.prepare("INSERT INTO vsport_object_cleanup_jobs(id,owner_id,project_id,object_key,reason,status,writer_fence,lease_expires_at,next_attempt_at) SELECT ?,?,?,?,?, 'reserved',?,?,? WHERE EXISTS(SELECT 1 FROM vsport_image_candidates c JOIN vsport_projects p ON p.id=c.project_id WHERE c.id=? AND c.project_id=? AND c.state='ingesting' AND c.ingest_fence=? AND c.ingest_lease_expires_at=? AND p.owner_id=?)").bind(guardId,auth.user.id,project.id,key,'orphan_guard',writerFence,leaseExpiresAt,leaseExpiresAt,candidate.id,project.id,writerFence,leaseExpiresAt,auth.user.id)
    ]);if(!rowChanges(guarded[0])||!rowChanges(guarded[1]))throw new Error('IMAGE_INGEST_FENCE_LOST');
    const guard=await ctx.env.DB.prepare("SELECT id FROM vsport_object_cleanup_jobs WHERE id=? AND owner_id=? AND project_id=? AND object_key=? AND reason='orphan_guard' AND status='reserved' AND writer_fence=? AND julianday(lease_expires_at)>julianday(?) AND EXISTS(SELECT 1 FROM vsport_image_candidates c JOIN vsport_projects p ON p.id=c.project_id WHERE c.id=? AND c.project_id=? AND c.state='ingesting' AND c.ingest_fence=? AND c.ingest_lease_expires_at=vsport_object_cleanup_jobs.lease_expires_at AND p.owner_id=?)").bind(guardId,auth.user.id,project.id,key,writerFence,new Date().toISOString(),candidate.id,project.id,writerFence,auth.user.id).first();if(!guard)throw new Error('IMAGE_INGEST_FENCE_LOST');
    await ctx.env.FILES.put(key,bytes,{httpMetadata:{contentType:mime}});
    const finalized=await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vsport_assets(project_id,story_id,candidate_id,owner_id,object_key,source_url,source_page_url,publisher,mime_type,file_size,width,height) SELECT c.project_id,c.story_id,c.id,p.owner_id,?,?,?,?,?,?,?,? FROM vsport_image_candidates c JOIN vsport_projects p ON p.id=c.project_id JOIN vsport_object_cleanup_jobs g ON g.id=? AND g.object_key=? WHERE c.id=? AND c.project_id=? AND c.state='ingesting' AND c.ingest_fence=? AND p.owner_id=? AND g.owner_id=p.owner_id AND g.project_id=p.id AND g.reason='orphan_guard' AND g.status='reserved' AND g.writer_fence=? AND julianday(g.lease_expires_at)>julianday(?)").bind(key,candidate.source_url,candidate.source_page_url,candidate.publisher,mime,bytes.length,dimensions.width,dimensions.height,guardId,key,candidate.id,project.id,writerFence,auth.user.id,writerFence,new Date().toISOString()),
      ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='ready',identity_confirmed=CASE WHEN person_name<>'' THEN 1 ELSE identity_confirmed END,error_message='',ingest_fence=NULL,ingest_lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=? AND state='ingesting' AND ingest_fence=? AND EXISTS(SELECT 1 FROM vsport_assets WHERE candidate_id=? AND object_key=?) AND EXISTS(SELECT 1 FROM vsport_object_cleanup_jobs WHERE id=? AND object_key=? AND writer_fence=? AND status='reserved')").bind(candidate.id,project.id,writerFence,candidate.id,key,guardId,key,writerFence),
      ctx.env.DB.prepare("DELETE FROM vsport_object_cleanup_jobs WHERE id=? AND owner_id=? AND project_id=? AND object_key=? AND writer_fence=? AND status='reserved' AND EXISTS(SELECT 1 FROM vsport_assets WHERE candidate_id=? AND object_key=?)").bind(guardId,auth.user.id,project.id,key,writerFence,candidate.id,key)
    ]);if(finalized.some(result=>!rowChanges(result)))throw new Error('IMAGE_INGEST_FINALIZE_FAILED');
    const row=await ctx.env.DB.prepare('SELECT id FROM vsport_assets WHERE project_id=? AND owner_id=? AND candidate_id=? AND object_key=?').bind(project.id,auth.user.id,candidate.id,key).first();if(!row)throw new Error('IMAGE_INGEST_FINALIZE_FAILED');return json({ok:true,id:row.id,preview_url:`/api/admin/vsport-assets/${row.id}`,width:dimensions.width,height:dimensions.height},201,headers);
  }catch(error){
    if(key&&guardId){const cleanup=await forceCleanupGuard(ctx.env,{ownerId:auth.user.id,projectId:project.id,objectKey:key,writerFence});if(cleanup.recorded)return json({ok:true,id:cleanup.assetId,preview_url:`/api/admin/vsport-assets/${cleanup.assetId}`,reused:true},200,headers)}
    const code=clean(error?.name==='AbortError'?'IMAGE_TIMEOUT':error?.message||'IMAGE_INGEST_FAILED',120);await ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='failed',error_message=?,ingest_fence=NULL,ingest_lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=? AND ingest_fence=?").bind(code,candidate.id,project.id,writerFence).run();return json({error:`นำเข้ารูปไม่สำเร็จ (${code})`,candidate_id:candidate.id},422,headers)
  }
}

async function deleteReceiptResponse(ctx,receipt,{replayed}){
  const cleanup=await processProjectCleanup(ctx.env,Number(receipt.owner_id),Number(receipt.project_id)),cleanupPending=cleanup.pending>0,status=cleanupPending?202:200;
  return json({ok:true,deleted:true,project_id:Number(receipt.project_id),title:receipt.project_title,replayed,cleanup_pending:cleanupPending,cleanup_processed:cleanup.processed},status,headers);
}

export async function onRequestDelete(ctx){
  const auth=await requireAdmin(ctx);if(auth.error){const deniedHeaders=new Headers(auth.error.headers);for(const [name,value] of Object.entries(headers))deniedHeaders.set(name,value);return new Response(auth.error.body,{status:auth.error.status,headers:deniedHeaders})}
  const body=await ctx.request.json().catch(()=>null),idempotencyKey=String(ctx.request.headers.get('Idempotency-Key')||'').trim();
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!=='expected_title,project_id')return json({error:'ข้อมูลยืนยันการลบไม่ถูกต้อง'},400,headers);
  const projectId=integer(body.project_id,1,Number.MAX_SAFE_INTEGER),expectedTitle=clean(body.expected_title,180);
  if(!projectId||!expectedTitle||!/^[\x21-\x7e]{8,128}$/.test(idempotencyKey))return json({error:'รหัสโปรเจกต์ ชื่อยืนยัน หรือ Idempotency-Key ไม่ถูกต้อง'},400,headers);
  const requestHash=await sha256(JSON.stringify({project_id:projectId,expected_title:expectedTitle}));
  const byKey=await ctx.env.DB.prepare('SELECT owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state FROM vsport_project_deletions WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,idempotencyKey).first();
  if(byKey){if(Number(byKey.project_id)!==projectId||byKey.request_hash!==requestHash||byKey.project_title!==expectedTitle)return json({error:'Idempotency-Key นี้ถูกใช้กับคำขอลบอื่นแล้ว'},409,headers);return deleteReceiptResponse(ctx,byKey,{replayed:true})}
  const project=await ctx.env.DB.prepare('SELECT id,title FROM vsport_projects WHERE id=? AND owner_id=?').bind(projectId,auth.user.id).first();
  if(!project){const deleted=await ctx.env.DB.prepare('SELECT owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state FROM vsport_project_deletions WHERE owner_id=? AND project_id=?').bind(auth.user.id,projectId).first();return deleted?json({error:'โปรเจกต์นี้ถูกลบแล้วด้วยคำขออื่น'},409,headers):json({error:'ไม่พบโปรเจกต์ vSport'},404,headers)}
  if(project.title!==expectedTitle)return json({error:'ชื่อโปรเจกต์เปลี่ยนแล้ว กรุณารีเฟรชก่อนยืนยันลบ'},409,headers);
  const now=new Date().toISOString();let results;
  try{
    results=await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vsport_project_deletions(owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state) SELECT p.owner_id,p.id,p.title,?,?,'pending' FROM vsport_projects p WHERE p.id=? AND p.owner_id=? AND p.title=? AND NOT EXISTS(SELECT 1 FROM vsport_jobs j WHERE j.project_id=p.id AND j.status IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM vsport_image_candidates c WHERE c.project_id=p.id AND c.state='ingesting' AND (c.ingest_lease_expires_at IS NULL OR julianday(c.ingest_lease_expires_at)>julianday(?))) AND NOT EXISTS(SELECT 1 FROM vsport_object_cleanup_jobs g WHERE g.owner_id=p.owner_id AND g.project_id=p.id AND g.reason='orphan_guard' AND g.status='reserved' AND julianday(g.lease_expires_at)>julianday(?))").bind(idempotencyKey,requestHash,projectId,auth.user.id,expectedTitle,now,now),
      ctx.env.DB.prepare("INSERT INTO vsport_object_cleanup_jobs(id,owner_id,project_id,object_key,reason,status,next_attempt_at) SELECT lower(hex(randomblob(16))),a.owner_id,a.project_id,a.object_key,'deleted','pending',? FROM vsport_assets a WHERE a.project_id=? AND a.owner_id=? AND EXISTS(SELECT 1 FROM vsport_project_deletions d WHERE d.owner_id=? AND d.project_id=? AND d.idempotency_key=? AND d.request_hash=?) ON CONFLICT(object_key) DO UPDATE SET reason='deleted',status=CASE WHEN vsport_object_cleanup_jobs.status='done' THEN 'done' ELSE 'pending' END,next_attempt_at=CASE WHEN vsport_object_cleanup_jobs.status='done' THEN NULL ELSE excluded.next_attempt_at END,last_error_code='',updated_at=CURRENT_TIMESTAMP").bind(now,projectId,auth.user.id,auth.user.id,projectId,idempotencyKey,requestHash),
      ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET reason='deleted',status=CASE WHEN status='done' THEN 'done' ELSE 'pending' END,next_attempt_at=CASE WHEN status='done' THEN NULL ELSE ? END,last_error_code='',updated_at=CURRENT_TIMESTAMP WHERE owner_id=? AND project_id=? AND reason='orphan_guard' AND (status<>'reserved' OR lease_expires_at IS NULL OR julianday(lease_expires_at)<=julianday(?)) AND EXISTS(SELECT 1 FROM vsport_project_deletions WHERE owner_id=? AND project_id=? AND idempotency_key=? AND request_hash=?)").bind(now,auth.user.id,projectId,now,auth.user.id,projectId,idempotencyKey,requestHash),
      ctx.env.DB.prepare('DELETE FROM vsport_projects WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM vsport_project_deletions WHERE owner_id=? AND project_id=? AND idempotency_key=? AND request_hash=?)').bind(projectId,auth.user.id,auth.user.id,projectId,idempotencyKey,requestHash)
    ]);
  }catch{
    const replay=await ctx.env.DB.prepare('SELECT owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state FROM vsport_project_deletions WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,idempotencyKey).first();
    if(replay&&Number(replay.project_id)===projectId&&replay.request_hash===requestHash&&replay.project_title===expectedTitle)return deleteReceiptResponse(ctx,replay,{replayed:true});
    if(replay)return json({error:'Idempotency-Key นี้ถูกใช้กับคำขอลบอื่นแล้ว'},409,headers);
    return json({error:'บันทึกการลบโปรเจกต์ไม่สำเร็จ โปรเจกต์เดิมยังไม่ถูกลบ'},500,headers);
  }
  if(!rowChanges(results[0])||!rowChanges(results[3])){
    const replay=await ctx.env.DB.prepare('SELECT owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state FROM vsport_project_deletions WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,idempotencyKey).first();
    if(replay&&Number(replay.project_id)===projectId&&replay.request_hash===requestHash&&replay.project_title===expectedTitle)return deleteReceiptResponse(ctx,replay,{replayed:true});
    const current=await ctx.env.DB.prepare('SELECT id,title FROM vsport_projects WHERE id=? AND owner_id=?').bind(projectId,auth.user.id).first();
    if(!current)return json({error:'ไม่พบโปรเจกต์ vSport'},404,headers);
    const active=await ctx.env.DB.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM vsport_jobs WHERE project_id=? AND status IN ('queued','running')) THEN 'job' WHEN EXISTS(SELECT 1 FROM vsport_image_candidates WHERE project_id=? AND state='ingesting' AND (ingest_lease_expires_at IS NULL OR julianday(ingest_lease_expires_at)>julianday(?))) THEN 'ingest' WHEN EXISTS(SELECT 1 FROM vsport_object_cleanup_jobs WHERE owner_id=? AND project_id=? AND reason='orphan_guard' AND status='reserved' AND julianday(lease_expires_at)>julianday(?)) THEN 'guard' ELSE '' END reason").bind(projectId,projectId,now,auth.user.id,projectId,now).first();
    if(active?.reason)return json({error:'โปรเจกต์นี้ยังมีงานหรือการนำเข้ารูปที่กำลังทำอยู่ กรุณารอให้เสร็จแล้วลองลบอีกครั้ง'},409,headers);
    if(current.title!==expectedTitle)return json({error:'ชื่อโปรเจกต์เปลี่ยนแล้ว กรุณารีเฟรชก่อนยืนยันลบ'},409,headers);
    return json({error:'ลบโปรเจกต์ไม่สำเร็จ โปรเจกต์เดิมยังอยู่'},500,headers);
  }
  const receipt=await ctx.env.DB.prepare('SELECT owner_id,project_id,project_title,idempotency_key,request_hash,cleanup_state FROM vsport_project_deletions WHERE owner_id=? AND project_id=?').bind(auth.user.id,projectId).first();
  if(!receipt)return json({error:'ไม่พบหลักฐานการลบ โปรเจกต์เดิมอาจยังอยู่'},500,headers);
  return deleteReceiptResponse(ctx,receipt,{replayed:false});
}

export async function prepareThaiThumbnailHeadline(env,project,ownerId,requestAI=requestWorkNotesAI){
  const hasThai=value=>/[\u0e00-\u0e7f]/u.test(String(value||''));
  if(hasThai(project.thumbnail_headline))return{ok:true,headline:project.thumbnail_headline,reused:true};
  const expected=project.thumbnail_headline||'';
  let story;
  if(expected){
    const source=await env.DB.prepare('SELECT headline,summary,publisher,source_url FROM vsport_stories WHERE project_id=? AND headline=? AND selected=1 LIMIT 1').bind(project.id,expected).first();
    if(source&&isSoccerEligibleNews(source.headline,source.summary,source.source_url,project.scope_mode))story=source;
  }else{
    const selected=await selectedSoccerStories(env,project.id,project.scope_mode,'publisher,source_url');
    story=selected.stories[0];
  }
  if(!story){
    const fallback='ข่าวฟุตบอลวันนี้';
    await env.DB.prepare("UPDATE vsport_projects SET thumbnail_headline=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND COALESCE(thumbnail_headline,'')=?").bind(fallback,project.id,ownerId,expected).run();
    const current=await ownedProject(env,project.id,ownerId);
    return{ok:true,headline:current?.thumbnail_headline||fallback,requires_review:true};
  }
  let headline='ข่าวฟุตบอลวันนี้',requiresReview=true;
  try{
    const prompt=`เขียนพาดหัวปกวิดีโอข่าวฟุตบอลภาษาไทยสั้น ๆ ไม่เกิน 70 ตัวอักษร จากข้อมูลข่าวจริงต่อไปนี้เท่านั้น ตอบพาดหัวบรรทัดเดียวเป็นภาษาไทย ห้ามใช้อักษรละติน ห้ามเพิ่มผลการแข่งขัน ตัวเลข ชื่อคน ทีม หรือข้อเท็จจริงที่ไม่มีในข้อมูล หากไม่มั่นใจการถอดชื่อเฉพาะให้ตอบ ข่าวฟุตบอลวันนี้ เท่านั้น\nพาดหัวต้นทาง: ${clean(story.headline,180)}\nสรุปฟีด: ${clean(story.summary,600)}\nสำนักข่าว: ${clean(story.publisher,100)}\nURL: ${clean(story.source_url,500)}`;
    const proposed=clean(await requestAI(env,prompt,{maxTokens:160,temperature:0,deadlineMs:9000}),180).replace(/^['"“”]+|['"“”]+$/gu,'').trim();
    const thaiConsonants=(proposed.match(/[ก-ฮ]/gu)||[]).length,sourceText=`${story.headline} ${story.summary||''}`,numbers=proposed.match(/[0-9]+/gu)||[];
    if(proposed.length<=70&&!/[\r\n]/u.test(proposed)&&!/[A-Za-z]/u.test(proposed)&&thaiConsonants>=5&&proposed!=='ข่าวฟุตบอลวันนี้'&&numbers.every(number=>sourceText.includes(number))){headline=proposed;requiresReview=false}
  }catch{}
  const written=await env.DB.prepare("UPDATE vsport_projects SET thumbnail_headline=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND COALESCE(thumbnail_headline,'')=?").bind(headline,project.id,ownerId,expected).run();
  if(!written.meta?.changes){const current=await ownedProject(env,project.id,ownerId);headline=current?.thumbnail_headline||headline}
  return{ok:true,headline,requires_review:requiresReview};
}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({})),action=clean(body.action,40);
  if(action==='create'){
    const scopeMode=body.scope_mode==='specific_team'?'specific_team':body.scope_mode==='all_teams_for_day'?'all_teams_for_day':'',teamName=clean(body.team_name,120),targetMinutes=integer(body.target_minutes,25,35),newsDate=clean(body.news_date,10),title=clean(body.title,180)||`${teamName||'ข่าวฟุตบอล'} · ${newsDate}`;
    if(!scopeMode||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(newsDate)||![25,30,35].includes(targetMinutes)||scopeMode==='specific_team'&&!teamName)return json({error:'กรุณาเลือกวันที่ ขอบเขตทีม และความยาวให้ครบ'},400,headers);
    const row=await ctx.env.DB.prepare('INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(?,?,?,?,?,?) RETURNING id').bind(auth.user.id,title,newsDate,scopeMode,scopeMode==='specific_team'?teamName:'',targetMinutes).first();return json({ok:true,id:row.id},201,headers);
  }
  const projectId=integer(body.project_id,1,Number.MAX_SAFE_INTEGER),project=projectId?await ownedProject(ctx.env,projectId,auth.user.id,{withScript:true}):null;if(!project)return json({error:'ไม่พบโปรเจกต์ vSport'},404,headers);
  if(action==='prepare_thumbnail_headline'){
    return json(await prepareThaiThumbnailHeadline(ctx.env,project,auth.user.id),200,headers);
  }
  if(action==='save'){
    const targetSeconds=Number(body.target_seconds||0),script=clean(body.narration_script,60000),personNamesOverride=clean(body.person_names_override??project.person_names_override,1500),headline=clean(body.thumbnail_headline,180),subheadline=clean(body.thumbnail_subheadline,240),focusText=clean(body.thumbnail_focus_text,120),focusAssetId=integer(body.thumbnail_focus_asset_id,1,Number.MAX_SAFE_INTEGER),palette=['red-yellow','blue-white','black-gold'].includes(body.thumbnail_palette)?body.thumbnail_palette:'red-yellow',layout=['split','stack','spotlight'].includes(body.thumbnail_layout)?body.thumbnail_layout:'split';if(targetSeconds&&(!Number.isFinite(targetSeconds)||targetSeconds<1||targetSeconds>21600))return json({error:'ระยะเวลาเสียงต้องอยู่ระหว่าง 1–21,600 วินาที'},400,headers);
    if(headline){const source=await ctx.env.DB.prepare('SELECT headline,summary,source_url FROM vsport_stories WHERE project_id=? AND headline=? LIMIT 1').bind(project.id,headline).first();if(source&&!isSoccerEligibleNews(source.headline,source.summary,source.source_url,project.scope_mode))return json({error:'หัวข้อปกนี้มาจากข่าวที่ไม่ใช่ฟุตบอล กรุณาเลือกข่าวฟุตบอล',code:'THUMBNAIL_NOT_SOCCER'},422,headers)}
    if(focusAssetId){const asset=await ctx.env.DB.prepare('SELECT s.headline,s.summary,s.source_url FROM vsport_assets a JOIN vsport_stories s ON s.id=a.story_id AND s.project_id=a.project_id WHERE a.id=? AND a.project_id=? AND a.owner_id=?').bind(focusAssetId,project.id,auth.user.id).first();if(!asset)return json({error:'รูปเด่นไม่ได้อยู่ในโปรเจกต์นี้'},400,headers);if(!isSoccerEligibleNews(asset.headline,asset.summary,asset.source_url,project.scope_mode))return json({error:'รูปเด่นนี้มาจากข่าวที่ไม่ใช่ฟุตบอล กรุณาเลือกรูปอื่น',code:'THUMBNAIL_ASSET_NOT_SOCCER'},422,headers)}
    const ids=[...new Set((body.story_ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];if(ids.length>24)return json({error:'เลือกข่าวได้ไม่เกิน 24 รายการ กรุณาตรวจรายการอีกครั้ง',code:'STORY_SELECTION_LIMIT_EXCEEDED'},422,headers);if(Array.isArray(body.story_ids)&&ids.length){const requested=(await ctx.env.DB.prepare(`SELECT id,headline,summary,source_url FROM vsport_stories WHERE project_id=? AND id IN (${ids.map(()=>'?').join(',')}) LIMIT 24`).bind(project.id,...ids).all()).results||[];if(requested.some(story=>!isSoccerEligibleNews(story.headline,story.summary,story.source_url,project.scope_mode)))return json({error:'รายการที่เลือกมีข่าวที่ไม่ใช่ฟุตบอล กรุณาโหลดรายการใหม่',code:'STORY_NOT_SOCCER'},422,headers)}const statements=[ctx.env.DB.prepare("UPDATE vsport_projects SET target_seconds=?,narration_script=?,person_names_override=?,thumbnail_headline=?,thumbnail_subheadline=?,thumbnail_focus_text=?,thumbnail_focus_asset_id=?,thumbnail_palette=?,thumbnail_layout=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(targetSeconds||0,script,personNamesOverride,headline,subheadline,focusText,focusAssetId||null,palette,layout,project.id,auth.user.id)];
    if(Array.isArray(body.story_ids)){statements.push(ctx.env.DB.prepare('UPDATE vsport_stories SET selected=0 WHERE project_id=?').bind(project.id));if(ids.length)statements.push(ctx.env.DB.prepare(`UPDATE vsport_stories SET selected=1 WHERE project_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(project.id,...ids))}await ctx.env.DB.batch(statements);return json({ok:true},200,headers);
  }
  if(action==='ingest_image')return ingestImage(ctx,auth,project,body);
  const types={discover:'discover',generate_script:'script',discover_images:'images',discover_news_images:'news_images'},type=types[action];if(!type)return json({error:'คำสั่ง vSport ไม่ถูกต้อง'},400,headers);const personCursor=type==='images'?personCursorFromJob(body.idempotency_key,body.person_cursor):0,newsCursor=type==='news_images'?newsImageCursorFromJob(body.idempotency_key,body.news_cursor):null;if(personCursor===null||type==='news_images'&&!newsCursor)return json({error:'cursor กับ idempotency key ไม่ตรงกัน'},409,headers);const expectedIds=type==='news_images'&&Array.isArray(body.selected_story_ids)?[...new Set(body.selected_story_ids.map(Number))].sort((a,b)=>a-b):[];if(type==='news_images'&&(!expectedIds.length||expectedIds.length>24||expectedIds.some(id=>!Number.isSafeInteger(id)||id<=0)))return json({error:'รายการข่าวสำหรับค้นรูปไม่ถูกต้อง'},422,headers);if(type==='news_images'){const stamp=String(body.idempotency_key||'').match(/:selection:([a-f0-9]{16})(?::|$)/u)?.[1],current=(await ctx.env.DB.prepare('SELECT id FROM vsport_stories WHERE project_id=? AND selected=1 ORDER BY sort_order,id LIMIT 25').bind(project.id).all()).results.map(row=>Number(row.id)).sort((a,b)=>a-b);if(!stamp||stamp!==(await sha256(expectedIds.join(','))).slice(0,16)||JSON.stringify(current)!==JSON.stringify(expectedIds))return json({error:'รายการข่าวที่เลือกเปลี่ยนแล้ว กรุณาเริ่มค้นรูปใหม่',code:'NEWS_SELECTION_CHANGED_RESTART'},409,headers)}const queued=await newJob(ctx,auth,project,type,body.idempotency_key);if(queued.error)return queued.error;if(queued.existing)return json({ok:true,job:queued.existing,reused:true},200,headers);
  const runners={discover:()=>runDiscovery(ctx.env,queued.id,project),script:()=>runScript(ctx.env,queued.id,project),images:()=>runImageDiscovery(ctx.env,queued.id,project,personCursor),news_images:()=>runNewsImageBatch(ctx.env,queued.id,project,newsCursor,expectedIds)};ctx.waitUntil(runners[type]());return json({ok:true,job:{id:queued.id,project_id:project.id,job_type:type,status:'queued'}},202,headers);
}
