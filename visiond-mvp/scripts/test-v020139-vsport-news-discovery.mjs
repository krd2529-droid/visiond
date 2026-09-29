import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {bangkokNewsWindow,bingNewsRssUrlForWindow,isNewsRssEnvelope,newsRssUrlForWindow,parseNewsRss,resolveNewsTeam} from '../functions/_vsport.js';
import {discoverNews,newsDiscoveryCheckpoint} from '../functions/api/admin/vsport.js';

const project={news_date:'2026-09-29',scope_mode:'specific_team',team_name:'แมนยู'};
const item=(headline,date='2026-09-28T18:00:00.000Z',publisher='World Sport',suffix='story')=>`<item><title><![CDATA[${headline}]]></title><link>https://publisher.example/${suffix}</link><pubDate>${date}</pubDate><description><![CDATA[<p>รายละเอียด ${headline}</p>]]></description><source url="https://publisher.example">${publisher}</source></item>`;
const rss=(items='')=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title>${items}</channel></rss>`;
const response=body=>new Response(body,{status:200,headers:{'content-type':'application/rss+xml'}});
const queryOf=url=>new URL(url).searchParams.get('q')||'';
const phaseOf=url=>queryOf(url).includes('after:2026-09-26')?'fallback':'exact';
const providerOf=url=>url.includes('news.google.com')?'google':'bing';

assert.deepEqual(bangkokNewsWindow('2026-09-29','exact'),{kind:'exact',start_ms:Date.parse('2026-09-28T17:00:00.000Z'),end_ms:Date.parse('2026-09-29T17:00:00.000Z'),from_day:'2026-09-29',to_day:'2026-09-30',query_after:'2026-09-28',query_before:'2026-09-30'});
assert.deepEqual(bangkokNewsWindow('2026-09-29','fallback'),{kind:'fallback',start_ms:Date.parse('2026-09-26T17:00:00.000Z'),end_ms:Date.parse('2026-09-28T17:00:00.000Z'),from_day:'2026-09-27',to_day:'2026-09-29',query_after:'2026-09-26',query_before:'2026-09-29'});
for(const invalid of ['','2026-02-30','2026-13-01','29-09-2026'])assert.throws(()=>bangkokNewsWindow(invalid),/INVALID_NEWS_DATE/);

const exactEdges=parseNewsRss(rss([
  item('Manchester United boundary start','2026-09-28T17:00:00.000Z','Start','start'),
  item('Man Utd inside Bangkok day','2026-09-29T16:59:59.999Z','Inside','inside'),
  item('Manchester United before Bangkok day','2026-09-28T16:59:59.999Z','Before','before'),
  item('Manchester United after Bangkok day','2026-09-29T17:00:00.000Z','After','after'),
].join('')),{newsDate:project.news_date,scopeMode:project.scope_mode,teamName:project.team_name,retrievedAt:'2026-09-29T18:00:00.000Z'});
assert.deepEqual(exactEdges.map(story=>story.publisher),['Inside','Start'],'Bangkok half-open day includes the UTC evening before and excludes the next Bangkok midnight');
assert.ok(exactEdges.every(story=>story.team_name==='Manchester United'));
assert.equal(exactEdges[0].published_at,'2026-09-29T16:59:59.999Z','real provider timestamp is retained');
const fallbackEdges=parseNewsRss(rss([
  item('Manchester United fallback start','2026-09-26T17:00:00.000Z','Fallback Start','fallback-start'),
  item('Man United fallback end','2026-09-28T16:59:59.999Z','Fallback End','fallback-end'),
  item('Manchester United exact boundary','2026-09-28T17:00:00.000Z','Exact','exact'),
].join('')),{newsDate:project.news_date,windowKind:'fallback',scopeMode:project.scope_mode,teamName:project.team_name});
assert.deepEqual(fallbackEdges.map(story=>story.publisher),['Fallback End','Fallback Start']);

assert.deepEqual(resolveNewsTeam('แมนยู'),{canonical:'Manchester United',recognized:true,query_aliases:['Manchester United','Man United','Man Utd','แมนเชสเตอร์ ยูไนเต็ด','แมนยู']});
for(const [alias,canonical] of [['ลิเวอร์พูล','Liverpool FC'],['อาร์เซนอล','Arsenal'],['แมนซิตี้','Manchester City'],['เชลซี','Chelsea'],['สเปอร์ส','Tottenham Hotspur'],['นิวคาสเซิล','Newcastle United'],['แอสตัน วิลล่า','Aston Villa'],['เรอัล มาดริด','Real Madrid'],['บาร์ซา','Barcelona'],['บาเยิร์น','Bayern Munich'],['เปแอสเช','Paris Saint-Germain'],['อินเตอร์','Inter Milan'],['เอซี มิลาน','AC Milan']])assert.equal(resolveNewsTeam(alias).canonical,canonical,alias);
const aliasParse=(headline,teamName,scopeMode='specific_team')=>parseNewsRss(rss(item(headline,'2026-09-29T10:00:00.000Z','Alias Source',headline.replace(/\W+/g,'-'))),{newsDate:project.news_date,scopeMode,teamName});
assert.equal(resolveNewsTeam('Inter').canonical,'Inter Milan');
assert.equal(aliasParse('Inter win the derby','Inter').length,1);
assert.equal(aliasParse('Inter Milan win the derby','Inter Milan').length,1);
assert.equal(aliasParse('อินเตอร์ มิลาน คว้าชัย','อินเตอร์').length,1);
assert.equal(aliasParse('International football transfer update','Inter').length,0);
assert.equal(aliasParse('Winter international window','Inter Milan').length,0);
assert.equal(aliasParse('Unrelated football update','...').length,0);
assert.deepEqual(resolveNewsTeam('...'),{canonical:'...',recognized:false,query_aliases:[]});
assert.throws(()=>newsRssUrlForWindow(project.news_date,'specific_team','...','exact'),/INVALID_NEWS_TEAM/);
assert.throws(()=>bingNewsRssUrlForWindow(project.news_date,'specific_team','...','exact'),/INVALID_NEWS_TEAM/);
const internationalGroup=aliasParse('International football transfer update','', 'all_teams_for_day');
assert.equal(internationalGroup.length,1);assert.equal(internationalGroup[0].team_name,'ฟุตบอลต่างประเทศ');
const googleExact=queryOf(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'exact')),googleFallback=queryOf(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback')),bingFallback=queryOf(bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback'));
for(const term of ['"Manchester United"','"Man United"','"Man Utd"','"แมนยู"'])assert.ok(googleExact.includes(term),term);
assert.match(googleExact,/after:2026-09-28 before:2026-09-30/);assert.match(googleFallback,/after:2026-09-26 before:2026-09-29/);assert.match(bingFallback,/after:2026-09-26 before:2026-09-29/);
assert.equal(isNewsRssEnvelope(rss()),true);for(const invalid of ['','<html><body>no news</body></html>','<rss></rss>','<channel></channel>'])assert.equal(isNewsRssEnvelope(invalid),false);

const exactCalls=[];
const exact=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{exactCalls.push(url);return response(rss(item('Manchester United exact result')))}});
assert.equal(exact.windowKind,'exact');assert.equal(exact.provider,'google');assert.equal(exact.stories.length,1);assert.equal(exactCalls.length,1,'an exact result wins before any other provider or fallback call');assert.equal(exact.discovery.mode,'exact');assert.deepEqual(exact.discovery.exact,{google:'stories',bing:'skipped'});

const fallbackCalls=[];
const fallback=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{fallbackCalls.push(`${phaseOf(url)}:${providerOf(url)}`);return phaseOf(url)==='exact'?response(rss()):response(rss(item('Man Utd fallback result','2026-09-27T10:00:00.000Z')))}});
assert.deepEqual(fallbackCalls,['exact:google','exact:bing','fallback:google']);assert.equal(fallback.windowKind,'fallback');assert.equal(fallback.discovery.mode,'fallback');assert.equal(fallback.discovery.from,'2026-09-27');assert.equal(fallback.discovery.to,'2026-09-29');assert.deepEqual(fallback.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(fallback.discovery.fallback,{google:'stories',bing:'skipped'});
const checkpoint=newsDiscoveryCheckpoint(fallback.discovery);assert.ok(checkpoint.length<400);assert.deepEqual(JSON.parse(checkpoint),{v:1,kind:'news',mode:'fallback',selected:'2026-09-29',from:'2026-09-27',to:'2026-09-29',count:1,exact:{google:'empty',bing:'empty'},fallback:{google:'stories',bing:'skipped'}});

const partialCalls=[];
const partial=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{const key=`${phaseOf(url)}:${providerOf(url)}`;partialCalls.push(key);if(key==='exact:google')return new Response('',{status:503});if(key==='fallback:google')return response(rss(item('Manchester United partial fallback','2026-09-27T11:00:00.000Z')));return response(rss())}});
assert.equal(partial.discovery.mode,'fallback');assert.deepEqual(partial.discovery.exact,{google:'unavailable',bing:'empty'});assert.equal(partialCalls.filter(value=>value==='exact:google').length,2,'unavailable provider gets one bounded retry');

let zeroCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{zeroCalls++;return response(rss())}}),error=>{assert.equal(error.code,'NEWS_NOT_FOUND');assert.equal(error.discovery.mode,'zero');assert.deepEqual(error.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(error.discovery.fallback,{google:'empty',bing:'empty'});return true});
assert.equal(zeroCalls,4,'two valid-empty providers are checked once in exact and once in the sole 48-hour fallback');

let outageCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{outageCalls++;return new Response('',{status:503})}}),error=>{assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE');assert.equal(error.discovery.mode,'unavailable');assert.deepEqual(error.discovery.exact,{google:'unavailable',bing:'unavailable'});return true});
assert.equal(outageCalls,4,'complete outage is bounded to two attempts per exact provider and never masquerades as zero/fallback');

let malformedCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{malformedCalls++;return providerOf(url)==='google'&&phaseOf(url)==='exact'?response('<html>temporary edge page</html>'):response(rss())}}),error=>{assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE');assert.equal(error.discovery.mode,'unavailable');assert.equal(error.discovery.exact.google,'unavailable');return true});
assert.equal(malformedCalls,5,'HTTP 200 malformed XML is retried and classified unavailable, never valid empty');

const many=[];for(let i=0;i<30;i++)many.push(item(`Liverpool story ${i}`,'2026-09-29T10:00:00.000Z','Liverpool Source',`l${i}`));for(let i=0;i<30;i++)many.push(item(`Arsenal story ${i}`,'2026-09-29T09:00:00.000Z','Arsenal Source',`a${i}`));
const balanced=parseNewsRss(rss(many.join('')),{newsDate:project.news_date,scopeMode:'all_teams_for_day'});assert.equal(balanced.length,6);assert.equal(balanced.filter(story=>story.team_name==='Liverpool FC').length,3);assert.equal(balanced.filter(story=>story.team_name==='Arsenal').length,3);assert.equal(new Set(balanced.map(story=>story.fingerprint)).size,balanced.length);

const migration=await readFile(new URL('../migrations/0111_vsport.sql',import.meta.url),'utf8'),api=await readFile(new URL('../functions/api/admin/vsport.js',import.meta.url),'utf8'),db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users(id) VALUES(1);');db.exec(migration);const projectId=Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(1,'ข่าวแมนยู','2026-09-29','specific_team','แมนยู',30) RETURNING id").get().id),upsert=db.prepare(`INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(project_id,fingerprint) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,team_name=excluded.team_name,publisher=excluded.publisher,source_url=excluded.source_url,published_at=excluded.published_at,retrieved_at=excluded.retrieved_at,sort_order=excluded.sort_order`),story=exact.stories[0];upsert.run(projectId,story.headline,story.summary,story.team_name,story.publisher,story.source_url,story.published_at,story.retrieved_at,story.fingerprint,0);upsert.run(projectId,`${story.headline} updated`,story.summary,story.team_name,story.publisher,story.source_url,story.published_at,story.retrieved_at,story.fingerprint,0);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vsport_stories WHERE project_id=?').get(projectId).count,1,'same fingerprint retry upserts without duplicates');for(const [sql,args,index] of [["SELECT id FROM vsport_stories WHERE project_id=? AND id>? ORDER BY id LIMIT 25",[projectId,0],'idx_vsport_stories_project_id'],["SELECT id FROM vsport_jobs WHERE project_id=? AND owner_id=? ORDER BY updated_at DESC,id LIMIT 24",[projectId,1],'idx_vsport_jobs_owner_project_updated']]){const plan=db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>row.detail).join(' | ');assert.match(plan,new RegExp(index));assert.doesNotMatch(plan,/TEMP B-TREE/)}db.close();
assert.match(api,/NEWS_FETCH_TIMEOUT_MS=4500/);assert.match(api,/NEWS_MAX_BYTES=2\*1024\*1024/);assert.match(api,/ON CONFLICT\(project_id,fingerprint\) DO UPDATE/);assert.match(api,/ORDER BY updated_at DESC,id LIMIT 24/);assert.doesNotMatch(api,/DELETE FROM vsport_stories/,'refresh remains additive and cannot destroy selected stories');

console.log('PASS v0.20.139 vSport Bangkok exact-first/48h fallback, bounded aliases/providers, closed outcomes, dedupe and Tha1 index contract');
