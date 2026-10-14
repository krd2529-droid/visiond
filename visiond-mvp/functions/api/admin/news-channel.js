import {json,requireAdmin} from '../../_lib.js';
import {requestWorkNotesAI} from '../../_work-notes-ai.js';
import {NEWS_SOURCES,NEWS_STYLES,bangkokDay,rollingWindow,gdeltUrl,parseGdeltArticles,parseCh8Listing,parseCh8PublishedAt,sourceForUrl} from '../../_news-channel.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const reply=(value,status=200)=>json(value,status,headers);
const safeDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&Math.abs(Date.parse(`${value}T00:00:00Z`)-Date.now())<92*86400000?String(value):null;
const maxItems=25;
const ownedItem=(db,owner,id)=>db.prepare('SELECT id,news_day,source,headline,source_url,observed_at,published_at,origin FROM news_channel_items WHERE owner_id=? AND id=?').bind(owner,id).first();

async function page(db,owner,day,cursor=0){
  const rows=(await db.prepare('SELECT id,news_day,source,headline,source_url,observed_at,published_at,origin FROM news_channel_items WHERE owner_id=? AND news_day=? AND id>? ORDER BY id LIMIT 25').bind(owner,day,cursor).all()).results||[];
  const count=await db.prepare('SELECT COUNT(*) AS n FROM news_channel_items WHERE owner_id=? AND news_day=?').bind(owner,day).first();
  return {items:rows.slice(0,24),next_cursor:rows.length>24?rows[23].id:null,total:Number(count?.n||0),limit:maxItems};
}

async function probeSource(day){
  const simple=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  simple.search=new URLSearchParams({query:'domainis:thairath.co.th',mode:'artlist',format:'json',maxrecords:'1',timespan:'1d'}).toString();
  const run=async(variant,url)=>{
    const started=Date.now();let status=null,error_code=null;
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
      status=Number.isInteger(response.status)&&response.status>=100&&response.status<=599?response.status:null;
      if(Number(response.headers.get('content-length')||0)>1_500_000)error_code='too_large';
      else if(response.ok){const body=await response.text();if(body.length>1_500_000)error_code='too_large'}
      else await response.body?.cancel();
    }catch(error){error_code=error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network'}
    return {variant,status,duration_ms:Math.min(30000,Math.max(0,Date.now()-started)),...(error_code?{error_code}:{})};
  };
  return {probes:[await run('simple',simple.toString()),await run('current',gdeltUrl(day,NEWS_SOURCES[0].domain))]};
}

async function probePublishers(){
  const listings=[{name:'ไทยรัฐ',url:'https://www.thairath.co.th/news'},{name:'ช่อง 3',url:'https://ch3plus.com/news'},{name:'ช่องวัน',url:'https://www.one31.net/news'},{name:'ช่องวัน sitemap',source:'ช่องวัน',url:'https://www.one31.net/sitemap.xml',xml:true},{name:'ช่อง 8',url:'https://www.thaich8.com/news'}];
  const run=async({name,source=name,url,xml=false})=>{
    const started=Date.now();let status=null,error_code=null,article_links=0;
    try{
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{accept:xml?'application/xml':'text/html'}});
      status=Number.isInteger(response.status)&&response.status>=100&&response.status<=599?response.status:null;
      if(response.ok){
        if(Number(response.headers.get('content-length')||0)>1_500_000)error_code='too_large';
        else{
          const reader=response.body?.getReader(),decoder=new TextDecoder(),parts=[];let size=0;
          if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1_500_000){error_code='too_large';await reader.cancel();break}parts.push(decoder.decode(value,{stream:true}))}}
          if(!error_code){parts.push(decoder.decode());const html=parts.join(''),found=new Set();let checked=0;
            for(const match of html.matchAll(xml?/<loc\b[^>]*>([^<]*)<\/loc>/gi:/href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
              if(++checked>1000||found.size>=100)break;
              try{const candidate=sourceForUrl(new URL((match[1]||match[2]).replace(/&amp;/gi,'&'),url).toString());if(candidate?.source===source)found.add(candidate.url)}catch{}
            }
            article_links=found.size;
          }
        }
      }else await response.body?.cancel();
    }catch(error){error_code=error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network'}
    return {publisher:name,status,duration_ms:Math.min(20000,Math.max(0,Date.now()-started)),article_links,...(error_code?{error_code}:{})};
  };
  return {probes:await Promise.all(listings.map(run))};
}

async function fetchCh8Listing(day,otherDay=null,observedAt=new Date().toISOString()){
  let response;
  try{
    response=await fetch('https://www.thaich8.com/news',{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{accept:'text/html'}});
    if(!response.ok)return {error_code:Number.isInteger(response.status)&&response.status>=100&&response.status<=599?`http_${response.status}`:'http_error'};
    if(Number(response.headers.get('content-length')||0)>1_500_000)return {error_code:'too_large'};
    const reader=response.body?.getReader();if(!reader)return {error_code:'parse_error'};
    const decoder=new TextDecoder(),parts=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1_500_000){await reader.cancel();return {error_code:'too_large'}}parts.push(decoder.decode(value,{stream:true}))}
    parts.push(decoder.decode());
    let parsed;try{const html=parts.join('');parsed=parseCh8Listing(html,day,observedAt);if(otherDay&&otherDay!==day){const earlier=parseCh8Listing(html,otherDay,observedAt),seen=new Set();parsed={items:[...parsed.items,...earlier.items].filter(item=>{if(seen.has(item.source_url))return false;seen.add(item.source_url);return true}).slice(0,25),dated:parsed.dated+earlier.dated}}}catch{return {error_code:'parse_error'}}
    return parsed.dated?{items:parsed.items}:{error_code:'parse_error'};
  }catch(error){return {error_code:error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network'}}
  finally{if(response&&!response.bodyUsed)await response.body?.cancel().catch(()=>{})}
}

async function fetchCh8Publication(item){
  if(sourceForUrl(item.source_url)?.source!=='ช่อง 8')return null;
  let response,reader;
  try{
    response=await fetch(item.source_url,{redirect:'manual',signal:AbortSignal.timeout(4000),headers:{accept:'text/html'}});
    if(!response.ok||response.redirected)return null;
    reader=response.body?.getReader();if(!reader)return null;
    const decoder=new TextDecoder();let html='',size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)return null;html+=decoder.decode(value,{stream:true});const published=parseCh8PublishedAt(html);if(published)return published}
    return parseCh8PublishedAt(html+decoder.decode());
  }catch{return null}
  finally{if(reader)await reader.cancel().catch(()=>{});else if(response&&!response.bodyUsed)await response.body?.cancel().catch(()=>{})}
}

async function savedCh8Candidates(db,owner,day,previous){
  const candidates=[];
  for(const newsDay of [day,previous]){
    const rows=(await db.prepare("SELECT id,news_day,source,headline,source_url,observed_at FROM news_channel_items INDEXED BY idx_news_channel_owner_day_id WHERE owner_id=? AND news_day=? AND source='ช่อง 8' AND origin='index' AND published_at IS NULL ORDER BY id DESC LIMIT 6").bind(owner,newsDay).all()).results||[];
    candidates.push(...rows);
  }
  const seen=new Set();
  return candidates.filter(item=>{
    if(sourceForUrl(item.source_url)?.source!=='ช่อง 8'||seen.has(item.source_url))return false;
    seen.add(item.source_url);return true;
  });
}

const rollingCursor=value=>{
  if(!value)return null;
  const match=String(value).match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)~(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)~(\d+)~(\d+)$/);
  if(!match||!Number.isSafeInteger(Number(match[3]))||Number(match[3])<1||Number(match[4])<1||Number(match[4])>24||!Number.isFinite(Date.parse(match[1]))||!Number.isFinite(Date.parse(match[2])))return false;
  return {end:match[1],at:match[2],id:Number(match[3]),seen:Number(match[4])};
};
export async function rollingPage(db,owner,now=new Date(),cursor=null){
  const point=rollingCursor(cursor);if(point===false)throw new Error('INVALID_CURSOR');
  const window=rollingWindow(point?new Date(point.end):now);
  if(point&&(point.end>now.toISOString()||Date.parse(point.end)<now.getTime()-300000||point.at<window.start||point.at>window.end))throw new Error('INVALID_CURSOR');
  const filter="owner_id=? AND origin='index' AND published_at>=? AND published_at<=?";
  const order=' ORDER BY published_at DESC,id DESC LIMIT ?';
  const remaining=25-(point?.seen||0),take=Math.min(24,remaining);
  const query=`SELECT id,news_day,source,headline,source_url,observed_at,published_at,origin FROM news_channel_items WHERE ${filter}${point?' AND (published_at<? OR (published_at=? AND id<?))':''}${order}`;
  const args=[owner,window.start,window.end,...(point?[point.at,point.at,point.id]:[]),take+1];
  const rows=(await db.prepare(query).bind(...args).all()).results||[];
  const count=await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT id FROM news_channel_items WHERE ${filter} ORDER BY published_at DESC,id DESC LIMIT 25)`).bind(owner,window.start,window.end).first();
  const manual=await manualPage(db,owner);
  const items=rows.slice(0,take),seen=(point?.seen||0)+items.length;
  return {items,...manual,next_cursor:rows.length>take&&seen<25?`${window.end}~${items.at(-1).published_at}~${items.at(-1).id}~${seen}`:null,total:Number(count?.n||0),limit:maxItems,window_start:window.start,window_end:window.end};
}
async function manualPage(db,owner,cursor=null){
  const rows=(await db.prepare(`SELECT id,news_day,source,headline,source_url,observed_at,published_at,origin FROM news_channel_items WHERE owner_id=? AND origin='manual'${cursor?' AND id<?':''} ORDER BY id DESC LIMIT 25`).bind(owner,...(cursor?[cursor]:[])).all()).results||[];
  return {manual_items:rows.slice(0,24),manual_next_cursor:rows.length>24?rows[23].id:null};
}

export async function rollingRefresh(ctx,owner,now=new Date()){
  const db=ctx.env.DB,day=bangkokDay(now),previous=bangkokDay(new Date(now.getTime()-86400000)),nowIso=now.toISOString(),window=rollingWindow(now),key=`rolling:${day}`;
  const lease=new Date(now.getTime()+60000).toISOString(),stale=new Date(now.getTime()-2*60000).toISOString();
  const claim=await db.prepare("INSERT INTO news_channel_refresh(owner_id,news_day,lease_until,state) VALUES(?, ?, ?, 'running') ON CONFLICT(owner_id,news_day) DO UPDATE SET lease_until=excluded.lease_until,state='running' WHERE (lease_until IS NULL OR lease_until<?) AND (refreshed_at IS NULL OR refreshed_at<?)").bind(owner,key,lease,nowIso,stale).run();
  if(!Number(claim.meta?.changes||0)){
    const recent=await db.prepare('SELECT state FROM news_channel_refresh WHERE owner_id=? AND news_day=?').bind(owner,key).first(),state=recent?.state||'running';
    const result=await rollingPage(db,owner,now);
    return {...result,reused:true,state,sources:NEWS_SOURCES.map(source=>source.name==='ช่อง 8'?{name:source.name,found:state==='partial'||state==='partial_saved'?result.total:0,available:state==='partial',...(state==='partial_saved'?{limited:true,error_code:'recent_attempt'}:state==='unavailable'?{error_code:'recent_attempt'}:{})}:{name:source.name,found:0,available:false,error_code:'timestamp_unverified'}),message:state==='unavailable'?'ยังเปิดรายการข่าวช่อง 8 ไม่ได้; รอ 2 นาทีแล้วลองค้นหาใหม่':state==='running'?'กำลังค้นข่าวอยู่ กรุณารอสักครู่':state==='partial_saved'?'ตรวจเวลาเผยแพร่จากลิงก์ข่าวที่เคยพบได้บางส่วน; รายการข่าวใหม่จากต้นทางยังไม่พร้อม':'ใช้ผลค้นหาล่าสุดชั่วคราว; ข่าวที่พ้น 24 ชั่วโมงถูกตัดออกแล้ว'};
  }
  const listing=await fetchCh8Listing(day,previous,nowIso),verified=[];
  const candidates=listing.items||await savedCh8Candidates(db,owner,day,previous);
  for(let index=0;index<candidates.length;index+=5){
    const batch=await Promise.all(candidates.slice(index,index+5).map(async item=>({item,published:await fetchCh8Publication(item)})));
    for(const {item,published} of batch){
      if(!published||bangkokDay(new Date(published))!==item.news_day||published<window.start||published>window.end)continue;
      verified.push({...item,published_at:published});
    }
  }
  verified.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  let stored=0;
  for(const item of verified.slice(0,25)){
    const existing=await db.prepare('SELECT id,origin FROM news_channel_items WHERE owner_id=? AND source_url=? ORDER BY id DESC LIMIT 1').bind(owner,item.source_url).first();
    if(existing?.origin==='index'){
      await db.prepare('UPDATE news_channel_items SET published_at=?,observed_at=? WHERE owner_id=? AND id=?').bind(item.published_at,item.observed_at,owner,existing.id).run();stored++;continue;
    }
    const result=await db.prepare("INSERT INTO news_channel_items(owner_id,news_day,source,headline,source_url,observed_at,published_at,origin) VALUES(?,?,?,?,?,?,?,'index') ON CONFLICT(owner_id,news_day,source_url) DO NOTHING").bind(owner,item.news_day,item.source,item.headline,item.source_url,item.observed_at,item.published_at).run();
    if(Number(result.meta?.changes||0))stored++;
  }
  const state=listing.error_code?(stored?'partial_saved':'unavailable'):'partial';
  await db.prepare('UPDATE news_channel_refresh SET state=?,refreshed_at=?,lease_until=NULL WHERE owner_id=? AND news_day=?').bind(state,nowIso,owner,key).run();
  const sources=NEWS_SOURCES.map(source=>source.name==='ช่อง 8'?{name:source.name,found:stored,available:!listing.error_code,...(listing.error_code?{error_code:listing.error_code,...(stored?{limited:true}:{})}:{})}:{name:source.name,found:0,available:false,error_code:'timestamp_unverified'});
  const result=await rollingPage(db,owner,now);
  return {...result,state,sources,message:state==='partial_saved'?'ตรวจเวลาเผยแพร่จากลิงก์ข่าวที่เคยพบได้บางส่วน; รายการข่าวใหม่จากต้นทางยังไม่พร้อม':listing.error_code?result.total?'ยังเปิดรายการข่าวช่อง 8 ไม่ได้; แสดงเฉพาะข่าวที่เคยยืนยันเวลาเผยแพร่ไว้':'ยังเปิดรายการข่าวช่อง 8 ไม่ได้; ไม่มีข่าวที่ยืนยันเวลาเผยแพร่ใน 24 ชั่วโมงล่าสุด':stored?'แสดงเฉพาะข่าวที่ยืนยันเวลาเผยแพร่จากต้นทางใน 24 ชั่วโมงล่าสุด':'ยังไม่มีข่าวที่ยืนยันเวลาเผยแพร่ใน 24 ชั่วโมงล่าสุด'};
}

async function refresh(ctx,owner,day){
  const db=ctx.env.DB,now=new Date(),nowIso=now.toISOString(),lease=new Date(now.getTime()+60000).toISOString(),stale=new Date(now.getTime()-30*60000).toISOString();
  const claim=await db.prepare("INSERT INTO news_channel_refresh(owner_id,news_day,lease_until,state) VALUES(?, ?, ?, 'running') ON CONFLICT(owner_id,news_day) DO UPDATE SET lease_until=excluded.lease_until,state='running' WHERE (lease_until IS NULL OR lease_until<?) AND (refreshed_at IS NULL OR refreshed_at<?)").bind(owner,day,lease,nowIso,stale).run();
  if(!Number(claim.meta?.changes||0))return {...await page(db,owner,day),reused:true,message:'ใช้ผลค้นหาที่เก็บไว้ชั่วคราว; ลองรีเฟรชอีกครั้งภายหลัง'};
  const outcomes=await Promise.all(NEWS_SOURCES.map(async source=>{
    const failed=error_code=>({source:source.name,items:[],error_code});
    try{
      const response=await fetch(gdeltUrl(day,source.domain),{signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
      if(!response.ok)return failed(Number.isInteger(response.status)&&response.status>=100&&response.status<=599?`http_${response.status}`:'http_error');
      if(Number(response.headers.get('content-length')||0)>1_500_000)return failed('too_large');
      const body=await response.text();if(body.length>1_500_000)return failed('too_large');
      let payload;try{payload=JSON.parse(body)}catch{return failed('bad_json')}
      try{return {source:source.name,items:parseGdeltArticles(payload,day,source)}}catch{return failed('parse_error')}
    }catch(error){return failed(error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network')};
  }));
  const ch8=outcomes.find(item=>item.source==='ช่อง 8');
  if(ch8?.error_code){
    const fallback=await fetchCh8Listing(day);
    if(fallback.items){ch8.index_error_code=ch8.error_code;delete ch8.error_code;ch8.items=fallback.items;ch8.discovery='publisher'}
    else ch8.fallback_error_code=fallback.error_code;
  }
  const candidates=outcomes.flatMap(x=>x.items).sort((a,b)=>b.observed_at.localeCompare(a.observed_at));
  const known=new Set(((await db.prepare('SELECT source_url FROM news_channel_items WHERE owner_id=? AND news_day=? ORDER BY id LIMIT 25').bind(owner,day).all()).results||[]).map(row=>row.source_url));
  for(const item of candidates){
    if(known.size>=maxItems)break;
    if(known.has(item.source_url))continue;
    const result=await db.prepare("INSERT INTO news_channel_items(owner_id,news_day,source,headline,source_url,observed_at,published_at,origin) SELECT ?,?,?,?,?,?,NULL,'index' WHERE (SELECT COUNT(*) FROM news_channel_items WHERE owner_id=? AND news_day=?)<? ON CONFLICT(owner_id,news_day,source_url) DO NOTHING").bind(owner,day,item.source,item.headline,item.source_url,item.observed_at,owner,day,maxItems).run();
    if(Number(result.meta?.changes||0))known.add(item.source_url);
    else if(Number((await db.prepare('SELECT COUNT(*) n FROM news_channel_items WHERE owner_id=? AND news_day=?').bind(owner,day).first())?.n||0)>=maxItems)break;
  }
  const failed=outcomes.filter(x=>x.error_code),state=failed.length===NEWS_SOURCES.length?'unavailable':failed.length?'partial':'ready';
  await db.prepare('UPDATE news_channel_refresh SET state=?,refreshed_at=?,lease_until=NULL WHERE owner_id=? AND news_day=?').bind(state,state==='unavailable'?null:nowIso,owner,day).run();
  return {...await page(db,owner,day),state,sources:outcomes.map(x=>({name:x.source,found:x.items.length,available:!x.error_code,...(x.discovery?{discovery:x.discovery,index_error_code:x.index_error_code}:{}),...(x.error_code?{error_code:x.error_code}:{}),...(x.fallback_error_code?{fallback_error_code:x.fallback_error_code}:{})})),message:state==='unavailable'?'แหล่งค้นข่าวไม่พร้อมใช้งาน เพิ่มลิงก์ข่าวเองได้':failed.length?'ค้นข่าวได้บางแหล่ง; เพิ่มลิงก์เองได้':''};
}

async function manual(ctx,owner,body){
  const day=safeDay(body.day),link=sourceForUrl(body.url),headline=String(body.headline||'').replace(/\s+/gu,' ').trim().slice(0,240);
  if(!day)return reply({error:'วันที่ข่าวไม่ถูกต้อง'},422);
  if(!link)return reply({error:'ลิงก์นี้ไม่ใช่ URL บทความที่รองรับจากไทยรัฐ ช่อง 3 ช่องวัน หรือช่อง 8'},422);
  if(headline.length<8)return reply({error:'กรุณาใส่พาดหัวจากต้นฉบับอย่างน้อย 8 ตัวอักษร'},422);
  let response;try{
    response=await fetch(link.url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(6000)});
    if(response.status===405||response.status===403){response=await fetch(link.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(6000),headers:{range:'bytes=0-0'}});await response.body?.cancel()}
  }catch{return reply({error:'ตรวจลิงก์ต้นทางไม่ได้ กรุณาลองอีกครั้ง'},502)}
  if(!response.ok||response.redirected)return reply({error:'ลิงก์ต้นทางเปิดตรวจสอบไม่ได้ กรุณาตรวจ URL บทความ'},422);
  const result=await ctx.env.DB.prepare("INSERT INTO news_channel_items(owner_id,news_day,source,headline,source_url,observed_at,published_at,origin) SELECT ?,?,?,?,?,?,NULL,'manual' WHERE (SELECT COUNT(*) FROM news_channel_items WHERE owner_id=? AND news_day=?)<? ON CONFLICT(owner_id,news_day,source_url) DO NOTHING").bind(owner,day,link.source,headline,link.url,new Date().toISOString(),owner,day,maxItems).run();
  if(!Number(result.meta?.changes||0))return reply({error:'ข่าวนี้มีอยู่แล้ว หรือคิววันนี้ครบ 25 เรื่อง'},409);
  return reply({...await page(ctx.env.DB,owner,day),message:'เพิ่มลิงก์แล้ว; พาดหัวนี้ผู้ใช้กรอกเอง กรุณาตรวจต้นฉบับก่อนสร้างบท'});
}

async function script(ctx,owner,body){
  const id=Number(body.id),style=String(body.style||'').trim().slice(0,80);
  if(!Number.isSafeInteger(id)||id<1||!NEWS_STYLES.includes(style))return reply({error:'เลือกข่าวและสไตล์ก่อน'},422);
  const story=await ownedItem(ctx.env.DB,owner,id);if(!story)return reply({error:'ไม่พบข่าวที่เลือก'},404);
  const notes=String(body.notes||'').trim().slice(0,1200);
  if(notes.length<40)return reply({error:'กรุณาอ่านข่าวต้นฉบับและกรอกข้อเท็จจริงที่ตรวจแล้วอย่างน้อย 40 ตัวอักษรก่อนร่างบท'},422);
  const prompt=`คุณเป็นบรรณาธิการบทข่าวสั้นภาษาไทย เขียนตาราง 4 ฉากให้ผู้ประกาศควายผู้ชายชื่อ สมถุ๋ย ในสไตล์ ${style} บทพูดแต่ละฉากประมาณ 25–35 พยางค์ รวม 90–120 พยางค์ ใช้คำแทนตนว่า "สมถุ๋ย" อย่างน้อยหนึ่งฉาก ห้ามแต่งรายละเอียด ตัวเลข ชื่อบุคคล คำพูด สาเหตุ หรือผลลัพธ์ที่ไม่อยู่ในพาดหัว/บันทึกผู้ใช้ ถ้าข้อมูลไม่พอให้ตอบ {"insufficient":true} แทนการเติมเนื้อหาเอง แยก 5 ช่องทุกฉาก: label, text (บทพูด), video_direction (สมถุ๋ยยืนพูดอยู่หน้าปก 9:16 ที่นิ่งสนิท ถ้าปกมีรูปสมถุ๋ยนิ่ง ให้ตัวผู้ประกาศที่เคลื่อนไหววางทับตำแหน่งนั้นเพื่อไม่เห็นควายซ้ำ ขยับได้เฉพาะตัว/สีหน้า/ท่าทาง), vfx (เอฟเฟกต์ภาพที่สอดคล้องอารมณ์ ไม่ทำให้พื้นหลังเคลื่อน), sfx_type (ชนิดเสียงที่ผู้ใช้จะหาเอง ไม่มีไฟล์เสียง), sfx_at_seconds (วินาทีภายในฉาก สอดคล้องท่าทาง 0–12) ห้ามนำเสียง SFX ไปใส่ในบทพูดหรือคำกำกับภาพ ตอบ JSON object เท่านั้น {"scenes":[{"label":"เปิดข่าว","text":"...","video_direction":"...","vfx":"...","sfx_type":"...","sfx_at_seconds":4.5},...]} พาดหัว: ${story.headline}\nสำนักข่าว: ${story.source}\nลิงก์อ้างอิง: ${story.source_url}\nบันทึกข้อเท็จจริงที่ผู้ใช้ตรวจจากต้นฉบับ: ${notes}`;
  try{
    const raw=await requestWorkNotesAI(ctx.env,prompt,{jsonMode:true,maxTokens:2200,deadlineMs:20000,validate:value=>{try{const parsed=JSON.parse(value),scenes=parsed.scenes;return parsed.insufficient===true||Array.isArray(scenes)&&scenes.length>=3&&scenes.length<=4&&scenes.every(x=>typeof x.text==='string'&&x.text.length>=20&&x.text.length<=400&&typeof x.video_direction==='string'&&typeof x.vfx==='string'&&typeof x.sfx_type==='string'&&Number.isFinite(Number(x.sfx_at_seconds))&&Number(x.sfx_at_seconds)>=0&&Number(x.sfx_at_seconds)<=12)}catch{return false}}});
    const parsed=JSON.parse(raw);if(parsed.insufficient)return reply({error:'ข้อมูลข้อเท็จจริงยังไม่พอสำหรับบท 3–4 ฉาก กรุณาเพิ่มบันทึกจากต้นฉบับ'},422);
    const scenes=parsed.scenes.map((scene,index)=>({label:String(scene.label||`ฉาก ${index+1}`).slice(0,40),text:String(scene.text).trim(),video_direction:`พื้นหลัง: ปก 9:16 นิ่งสนิท; สมถุ๋ยที่เคลื่อนไหวทับตำแหน่งตัวละครนิ่งในปกเพื่อไม่ให้ซ้ำ; ${String(scene.video_direction).trim()}`,vfx:String(scene.vfx).trim(),sfx_type:String(scene.sfx_type).trim(),sfx_at_seconds:Number(scene.sfx_at_seconds)}));
    return reply({scenes,grounding:'พาดหัวและบันทึกผู้ใช้เท่านั้น; ตรวจเทียบกับลิงก์ต้นฉบับก่อนเผยแพร่'});
  }catch(error){return reply({error:String(error?.message)==='AI_NOT_CONFIGURED'?'ยังไม่ได้เชื่อม Gemini สำหรับร่างบท':'ร่างบทไม่สำเร็จ กรุณาลองใหม่หรือเขียนเอง',code:'script_unavailable'},503)}
}

export async function onRequestGet(ctx){const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const url=new URL(ctx.request.url);if(url.searchParams.has('manual_cursor')){const cursor=Number(url.searchParams.get('manual_cursor'));return Number.isSafeInteger(cursor)&&cursor>0?reply(await manualPage(ctx.env.DB,auth.user.id,cursor)):reply({error:'cursor ไม่ถูกต้อง'},400)}if(!url.searchParams.has('day')){try{return reply({...await rollingPage(ctx.env.DB,auth.user.id,new Date(),url.searchParams.get('cursor')),styles:NEWS_STYLES})}catch(error){if(error?.message==='INVALID_CURSOR')return reply({error:'cursor ไม่ถูกต้อง'},400);throw error}}const day=safeDay(url.searchParams.get('day')),cursor=Number(url.searchParams.get('cursor')||0);if(!day||!Number.isSafeInteger(cursor)||cursor<0)return reply({error:'วันหรือ cursor ไม่ถูกต้อง'},400);return reply({...await page(ctx.env.DB,auth.user.id,day,cursor),day,styles:NEWS_STYLES});}
export async function onRequestPost(ctx){const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>null);if(!body||typeof body!=='object')return reply({error:'ข้อมูลคำขอไม่ถูกต้อง'},400);if(body.action==='rolling_refresh')return reply(await rollingRefresh(ctx,auth.user.id));if(body.action==='refresh'){const day=safeDay(body.day||bangkokDay());return day?reply(await refresh(ctx,auth.user.id,day)):reply({error:'วันที่ไม่ถูกต้อง'},400)}if(body.action==='probe'){const day=safeDay(body.day||bangkokDay());return day?reply(await probeSource(day)):reply({error:'วันที่ไม่ถูกต้อง'},400)}if(body.action==='publisher_probe')return reply(await probePublishers());if(body.action==='manual')return manual(ctx,auth.user.id,body);if(body.action==='script')return script(ctx,auth.user.id,body);return reply({error:'คำสั่งไม่ถูกต้อง'},400)}
