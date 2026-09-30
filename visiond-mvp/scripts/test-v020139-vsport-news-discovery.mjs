import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {bangkokNewsWindow,bingNewsRssUrlForWindow,isNewsRssEnvelope,NEWS_RESULT_LIMIT,newsRssUrlForWindow,parseNewsRss,resolveNewsTeam} from '../functions/_vsport.js';
import {discoverNews,newsDiscoveryCheckpoint} from '../functions/api/admin/vsport.js';

const project={news_date:'2026-09-29',scope_mode:'specific_team',team_name:'แมนยู'};
const item=(headline,date='2026-09-28T18:00:00.000Z',publisher='World Sport',suffix='story',summary=`รายละเอียด ${headline}`)=>`<item><title><![CDATA[${headline}]]></title><link>https://publisher.example/${suffix}</link><pubDate>${date}</pubDate><description><![CDATA[<p>${summary}</p>]]></description><source url="https://publisher.example">${publisher}</source></item>`;
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
const sportFiltered=parseNewsRss(rss([
  item('High-school football state championship preview','2026-09-29T10:00:00.000Z','Local Sport','american-high-school'),
  item('UMass Dartmouth football player earns weekly honor','2026-09-29T09:59:00.000Z','College Sport','american-umass'),
  item('NCAAF betting odds and picks for Saturday','2026-09-29T09:58:00.000Z','Betting Sport','american-ncaaf'),
  item('Liverpool visit NFL stadium during preseason tour','2026-09-29T09:57:30.000Z','World Sport','american-nfl-headline'),
  item('Local sports bulletin','2026-09-29T09:57:15.000Z','Local Sport','american-summary-phrase','American football team prepares for its next game'),
  item('Weekend sports round-up','2026-09-29T09:57:00.000Z','Local Sport','american-summary','The HIGH—SCHOOL football game decides the state title'),
  item('Saturday betting guide','2026-09-29T09:56:00.000Z','Betting Sport','ncaaf-summary','Latest N.C.A.A.F. picks'),
  item('American-football team starts camp','2026-09-29T09:55:45.000Z','Local Sport','american-hyphen-headline'),
  item('NCAA-football title odds released','2026-09-29T09:55:30.000Z','College Sport','ncaa-hyphen-headline'),
  item('High-school-football state final','2026-09-29T09:55:15.000Z','Local Sport','high-school-hyphen-headline'),
  item('Weekend sports notes','2026-09-29T09:55:10.000Z','Local Sport','american-hyphen-summary','An American-football team prepares for its next game'),
  item('UMass-Dartmouth football-player earns weekly honor','2026-09-29T09:55:05.000Z','College Sport','umass-hyphen-context'),
  item('Liverpool football player leads Premier League title race','2026-09-29T09:55:00.000Z','World Sport','soccer-liverpool'),
  item('Champions League football championship preview','2026-09-29T09:54:00.000Z','Europe Sport','soccer-champions-league'),
  item('American footballer Christian Pulisic targets a strong season','2026-09-29T09:53:00.000Z','Europe Sport','soccer-american-footballer'),
  item('American-footballer Christian Pulisic targets a strong season','2026-09-29T09:52:30.000Z','Europe Sport','soccer-american-hyphen-footballer'),
  item('UMass Dartmouth soccer player earns weekly honor','2026-09-29T09:52:00.000Z','College Sport','soccer-umass'),
  item('College Football Club signs a new striker','2026-09-29T09:51:00.000Z','London Sport','soccer-college-club'),
  item('Football betting odds for Liverpool against Arsenal','2026-09-29T09:50:00.000Z','Betting Sport','soccer-betting'),
  item('Inter Miami football player returns to training','2026-09-29T09:49:00.000Z','US Soccer','soccer-inter-miami'),
  item('New England Revolution football player signs extension','2026-09-29T09:48:00.000Z','US Soccer','soccer-new-england'),
  item('Manchester United football player returns to training','2026-09-29T09:47:00.000Z','World Sport','soccer-nfl-summary','An NFL comparison appears in background context only'),
  item('UMass soccer player joins Liverpool academy','2026-09-29T09:46:00.000Z','College Sport','soccer-umass-only'),
  item('Dartmouth football player joins Liverpool academy','2026-09-29T09:45:00.000Z','College Sport','soccer-dartmouth-only'),
].join('')),{newsDate:project.news_date,scopeMode:'all_teams_for_day'});
assert.deepEqual(new Set(sportFiltered.map(story=>story.headline)),new Set([
  'Liverpool football player leads Premier League title race',
  'Champions League football championship preview',
  'American footballer Christian Pulisic targets a strong season',
  'American-footballer Christian Pulisic targets a strong season',
  'UMass Dartmouth soccer player earns weekly honor',
  'College Football Club signs a new striker',
  'Football betting odds for Liverpool against Arsenal',
  'Inter Miami football player returns to training',
  'New England Revolution football player signs extension',
  'Manchester United football player returns to training',
  'UMass soccer player joins Liverpool academy',
  'Dartmouth football player joins Liverpool academy',
]),'high-confidence American-football cues are rejected without filtering association-football controls');
const googleExact=queryOf(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'exact')),googleFallback=queryOf(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback')),bingExact=queryOf(bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'exact')),bingFallback=queryOf(bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback'));
for(const term of ['"Manchester United"','"Man United"','"Man Utd"','"แมนยู"'])assert.ok(googleExact.includes(term),term);
assert.match(googleExact,/after:2026-09-28 before:2026-09-30/);assert.match(googleFallback,/after:2026-09-26 before:2026-09-29/);assert.equal(bingExact,bingFallback);assert.doesNotMatch(bingFallback,/\b(?:after|before):/);
assert.equal(isNewsRssEnvelope(rss()),true);for(const invalid of ['','<html><body>no news</body></html>','<rss></rss>','<channel></channel>'])assert.equal(isNewsRssEnvelope(invalid),false);

const exactCalls=[];
const exact=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{exactCalls.push(url);return response(rss(providerOf(url)==='google'?item('Manchester United exact result'):''))}});
assert.equal(exact.windowKind,'exact');assert.equal(exact.provider,'google');assert.equal(exact.stories.length,1);assert.equal(exactCalls.length,2,'a short exact result checks the second provider in the same window only');assert.equal(exact.discovery.mode,'exact');assert.deepEqual(exact.discovery.exact,{google:'stories',bing:'empty'});

const fallbackCalls=[];
const fallback=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{fallbackCalls.push(`${phaseOf(url)}:${providerOf(url)}`);return phaseOf(url)==='exact'?response(rss()):response(rss(item('Man Utd fallback result','2026-09-27T10:00:00.000Z')))}});
assert.deepEqual(fallbackCalls,['exact:google','exact:bing','fallback:google'],'the same operator-free valid-empty Bing response is reparsed from the request-local cache');assert.equal(fallback.windowKind,'fallback');assert.equal(fallback.discovery.mode,'fallback');assert.equal(fallback.discovery.from,'2026-09-27');assert.equal(fallback.discovery.to,'2026-09-29');assert.deepEqual(fallback.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(fallback.discovery.fallback,{google:'stories',bing:'empty'});
const checkpoint=newsDiscoveryCheckpoint(fallback.discovery);assert.ok(checkpoint.length<400);assert.deepEqual(JSON.parse(checkpoint),{v:1,kind:'news',mode:'fallback',selected:'2026-09-29',from:'2026-09-27',to:'2026-09-29',count:1,exact:{google:'empty',bing:'empty'},fallback:{google:'stories',bing:'empty'}});
assert.equal(JSON.parse(newsDiscoveryCheckpoint({...fallback.discovery,count:15})).count,15,'new checkpoints retain the maximum valid per-search result count');
assert.equal(JSON.parse(newsDiscoveryCheckpoint({...fallback.discovery,count:99})).count,0,'invalid producer counts fail closed instead of emitting a legacy-sized new result');

const partialCalls=[];
const partial=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{const key=`${phaseOf(url)}:${providerOf(url)}`;partialCalls.push(key);if(key==='exact:google')return new Response('',{status:503});if(key==='fallback:google')return response(rss(item('Manchester United partial fallback','2026-09-27T11:00:00.000Z')));return response(rss())}});
assert.equal(partial.discovery.mode,'fallback');assert.deepEqual(partial.discovery.exact,{google:'unavailable',bing:'empty'});assert.equal(partialCalls.filter(value=>value==='exact:google').length,2,'unavailable provider gets one bounded retry');

let zeroCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{zeroCalls++;return response(rss())}}),error=>{assert.equal(error.code,'NEWS_NOT_FOUND');assert.equal(error.discovery.mode,'zero');assert.deepEqual(error.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(error.discovery.fallback,{google:'empty',bing:'empty'});return true});
assert.equal(zeroCalls,3,'valid-empty Bing response is reused while Google keeps distinct exact/fallback requests');

let outageCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{outageCalls++;return new Response('',{status:503})}}),error=>{assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE');assert.equal(error.discovery.mode,'unavailable');assert.deepEqual(error.discovery.exact,{google:'unavailable',bing:'unavailable'});return true});
assert.equal(outageCalls,4,'complete outage is bounded to two attempts per exact provider and never masquerades as zero/fallback');

let malformedCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{malformedCalls++;return providerOf(url)==='google'&&phaseOf(url)==='exact'?response('<html>temporary edge page</html>'):response(rss())}}),error=>{assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE');assert.equal(error.discovery.mode,'unavailable');assert.equal(error.discovery.exact.google,'unavailable');return true});
assert.equal(malformedCalls,4,'HTTP 200 malformed XML is retried and classified unavailable, never valid empty or cached');

assert.equal(NEWS_RESULT_LIMIT,15);
const many=[];for(let i=0;i<10;i++)many.push(item(`Liverpool story ${i}`,'2026-09-29T10:00:00.000Z','Liverpool Source',`l${i}`));for(let i=0;i<10;i++)many.push(item(`Arsenal story ${i}`,'2026-09-29T09:00:00.000Z','Arsenal Source',`a${i}`));for(let i=0;i<2;i++)many.push(item(`Chelsea story ${i}`,'2026-09-29T08:00:00.000Z','Chelsea Source',`c${i}`));
const balanced=parseNewsRss(rss(many.join('')),{newsDate:project.news_date,scopeMode:'all_teams_for_day',limit:24});assert.equal(balanced.length,15,'all-team searches cap the total result set, not each group');assert.deepEqual(balanced.slice(0,6).map(story=>story.team_name),['Liverpool FC','Arsenal','Chelsea','Liverpool FC','Arsenal','Chelsea'],'round-robin keeps a sparse team visible while it has stories');assert.equal(balanced.filter(story=>story.team_name==='Liverpool FC').length,7);assert.equal(balanced.filter(story=>story.team_name==='Arsenal').length,6);assert.equal(balanced.filter(story=>story.team_name==='Chelsea').length,2);assert.equal(new Set(balanced.map(story=>story.fingerprint)).size,balanced.length);
const specificMany=[];for(let i=0;i<20;i++)specificMany.push(item(`Manchester United specific story ${i}`,`2026-09-29T10:${String(i).padStart(2,'0')}:00.000Z`,'United Source',`u${i}`));
const specificCapped=parseNewsRss(rss(specificMany.join('')),{newsDate:project.news_date,scopeMode:'specific_team',teamName:'แมนยู',limit:24});assert.equal(specificCapped.length,15,'specific-team searches share the same total result cap');assert.equal(specificCapped[0].headline,'Manchester United specific story 19','specific-team cap keeps the newest eligible stories');assert.equal(specificCapped.at(-1).headline,'Manchester United specific story 5');
const unknownSpecific=[];for(let i=0;i<20;i++)unknownSpecific.push(item(`Wrexham specific story ${i}`,`2026-09-29T11:${String(i).padStart(2,'0')}:00.000Z`,'Welsh Source',`wrexham-${i}`));
const unknownCapped=parseNewsRss(rss(unknownSpecific.join('')),{newsDate:project.news_date,scopeMode:'specific_team',teamName:'Wrexham'});assert.equal(resolveNewsTeam('Wrexham').recognized,false);assert.equal(unknownCapped.length,15,'a valid unknown team keeps bounded canonical phrase matching and newest-fifteen behavior');assert.equal(unknownCapped[0].headline,'Wrexham specific story 19');assert.equal(unknownCapped.at(-1).headline,'Wrexham specific story 5');

const fillProject={...project,scope_mode:'all_teams_for_day',team_name:''},googleThree=[item('Liverpool Google one','2026-09-29T10:15:00.000Z','Google Source','g-l1'),item('Arsenal Google one','2026-09-29T10:14:00.000Z','Google Source','g-a1'),item('Chelsea Google one','2026-09-29T10:13:00.000Z','Google Source','g-c1')],bingTwelve=[];for(let i=0;i<12;i++)bingTwelve.push(item(`${i%2?'Arsenal':'Liverpool'} Bing ${i}`,`2026-09-29T09:${String(59-i).padStart(2,'0')}:00.000Z`,'Bing Source',`b${i}`));
const fillCalls=[];const filled=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{fillCalls.push(providerOf(url));return response(rss((providerOf(url)==='google'?googleThree:bingTwelve).join('')))}});assert.deepEqual(fillCalls,['google','bing']);assert.equal(filled.stories.length,15,'Bing fills the same exact window only while Google has fewer than fifteen unique stories');assert.deepEqual(filled.discovery.exact,{google:'stories',bing:'stories'});assert.equal(new Set(filled.stories.map(story=>story.fingerprint)).size,15);
const filledAgain=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>response(rss((providerOf(url)==='google'?googleThree:bingTwelve).join('')))});assert.deepEqual(filledAgain.stories.map(story=>story.fingerprint),filled.stories.map(story=>story.fingerprint),'repeat discovery preserves stable provider merge and round-robin order');

const duplicateBing=[item('Liverpool Google one','2026-09-29T10:15:00.000Z','Google Source','bing-duplicate'),...bingTwelve];const duplicateCalls=[];const deduped=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{duplicateCalls.push(providerOf(url));return response(rss((providerOf(url)==='google'?googleThree:duplicateBing).join('')))}});assert.deepEqual(duplicateCalls,['google','bing']);assert.equal(deduped.stories.length,15);assert.equal(deduped.stories.find(story=>story.headline==='Liverpool Google one').source_url,'https://publisher.example/g-l1','Google story wins a duplicate fingerprint from Bing');

const overlapProject={...project,team_name:'Liverpool FC'},olderGoogle=[item('Liverpool overlap one','2026-09-29T08:03:00.000Z','Shared Source','og-1'),item('Liverpool overlap two','2026-09-29T08:02:00.000Z','Shared Source','og-2'),item('Liverpool overlap three','2026-09-29T08:01:00.000Z','Shared Source','og-3')],overlapRows=[];
for(let repeat=0;repeat<5;repeat++)for(let index=0;index<olderGoogle.length;index++)overlapRows.push(item(`Liverpool overlap ${['one','two','three'][index]}`,`2026-09-29T10:${String(59-(repeat*3+index)).padStart(2,'0')}:00.000Z`,'Shared Source',`overlap-${repeat}-${index}`));
for(let index=0;index<15;index++)overlapRows.push(item(`Liverpool later unique ${index}`,`2026-09-29T09:${String(44-index).padStart(2,'0')}:00.000Z`,'Later Source',`later-${index}`));
const excludedDirect=new Set(parseNewsRss(rss(olderGoogle.join('')),{newsDate:project.news_date,scopeMode:'specific_team',teamName:'Liverpool FC'}).map(story=>story.fingerprint)),excludedParsed=parseNewsRss(rss(overlapRows.join('')),{newsDate:project.news_date,scopeMode:'specific_team',teamName:'Liverpool FC',excludedFingerprints:excludedDirect});assert.equal(excludedParsed.length,15,'cross-provider fingerprints are excluded before the provider result cap');assert.ok(excludedParsed.every(story=>story.headline.startsWith('Liverpool later unique')),'repeated earlier-provider rows never hide later unique feed entries');
const overlapCalls=[];const overlapFilled=await discoverNews(overlapProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{overlapCalls.push(providerOf(url));return response(rss((providerOf(url)==='google'?olderGoogle:overlapRows).join('')))}});assert.deepEqual(overlapCalls,['google','bing']);assert.equal(overlapFilled.stories.length,15,'Google three plus a duplicate-heavy Bing feed still returns fifteen unique selected-day stories');assert.equal(new Set(overlapFilled.stories.map(story=>story.fingerprint)).size,15);assert.ok(overlapFilled.stories.some(story=>story.headline==='Liverpool later unique 14'),'later eligible Bing rows remain reachable after cross-provider dedupe');

let partialBingAttempts=0;const partialFill=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>providerOf(url)==='google'?response(rss(googleThree.join(''))):(partialBingAttempts++,new Response('',{status:503}))});assert.equal(partialFill.stories.length,3,'valid exact stories remain truthful when the fill provider is unavailable');assert.equal(partialBingAttempts,2);assert.deepEqual(partialFill.discovery.exact,{google:'stories',bing:'unavailable'});assert.equal(partialFill.discovery.mode,'exact');

const bingOnlyCalls=[];const bingOnly=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{bingOnlyCalls.push(providerOf(url));return response(rss((providerOf(url)==='google'?[]:bingTwelve).join('')))}});assert.deepEqual(bingOnlyCalls,['google','bing']);assert.equal(bingOnly.stories.length,12);assert.deepEqual(bingOnly.discovery.exact,{google:'empty',bing:'stories'});

const alreadyFullCalls=[];const alreadyFull=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{alreadyFullCalls.push(providerOf(url));return response(rss(many.join('')))}});assert.equal(alreadyFull.stories.length,15);assert.deepEqual(alreadyFullCalls,['google'],'Bing stays skipped after Google already fills all fifteen slots');assert.deepEqual(alreadyFull.discovery.exact,{google:'stories',bing:'skipped'});

const rejectedFifteen=[];for(let i=0;i<15;i++)rejectedFifteen.push(item(`High-school football game ${i}`,`2026-09-29T08:${String(59-i).padStart(2,'0')}:00.000Z`,'Gridiron Source',`reject-${i}`));
const validAfterRejected=[];for(let i=0;i<18;i++)validAfterRejected.push(item(`${i%2?'Arsenal':'Liverpool'} soccer report ${i}`,`2026-09-29T07:${String(59-i).padStart(2,'0')}:00.000Z`,'Soccer Source',`valid-after-${i}`));
const scannedPastRejected=parseNewsRss(rss([...rejectedFifteen,...validAfterRejected].join('')),{newsDate:project.news_date,scopeMode:'all_teams_for_day'});assert.equal(scannedPastRejected.length,15,'rejected leading RSS rows never consume the fifteen eligible-story slots');assert.ok(scannedPastRejected.every(story=>!story.headline.includes('High-school')));
const rejectedFillCalls=[];const rejectedThenBing=await discoverNews(fillProject,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{rejectedFillCalls.push(providerOf(url));return response(rss((providerOf(url)==='google'?rejectedFifteen:bingTwelve).join('')))}});assert.deepEqual(rejectedFillCalls,['google','bing']);assert.equal(rejectedThenBing.stories.length,12,'a valid feed whose Google rows are all rejected is eligible-empty and lets Bing fill');assert.deepEqual(rejectedThenBing.discovery.exact,{google:'empty',bing:'stories'});

const migration=await readFile(new URL('../migrations/0111_vsport.sql',import.meta.url),'utf8'),api=await readFile(new URL('../functions/api/admin/vsport.js',import.meta.url),'utf8'),db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users(id) VALUES(1);');db.exec(migration);const projectId=Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(1,'ข่าวแมนยู','2026-09-29','specific_team','แมนยู',30) RETURNING id").get().id),upsert=db.prepare(`INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(project_id,fingerprint) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,team_name=excluded.team_name,publisher=excluded.publisher,source_url=excluded.source_url,published_at=excluded.published_at,retrieved_at=excluded.retrieved_at,sort_order=excluded.sort_order`),insertStory=(target,story,order=0)=>upsert.run(target,story.headline,story.summary,story.team_name,story.publisher,story.source_url,story.published_at,story.retrieved_at,story.fingerprint,order),story=exact.stories[0];insertStory(projectId,story);insertStory(projectId,{...story,headline:`${story.headline} updated`});assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vsport_stories WHERE project_id=?').get(projectId).count,1,'same fingerprint retry upserts without duplicates');
const filledProjectId=Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(1,'ข่าวรวม','2026-09-29','all_teams_for_day','',30) RETURNING id").get().id);for(const [index,value] of filled.stories.entries())insertStory(filledProjectId,value,index);for(const [index,value] of filled.stories.entries())insertStory(filledProjectId,value,index);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vsport_stories WHERE project_id=?').get(filledProjectId).count,15,'new-project detail persists every unique result and same-feed retry remains idempotent');insertStory(filledProjectId,{...story,fingerprint:'historical-story',headline:'Historical association football story'},99);for(const [index,value] of filled.stories.entries())insertStory(filledProjectId,value,index);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vsport_stories WHERE project_id=?').get(filledProjectId).count,16,'a later discovery is additive and never prunes historical stories or dependent media');assert.equal(db.prepare('SELECT COUNT(*) AS count FROM (SELECT id FROM vsport_stories WHERE project_id=? AND id>? ORDER BY id LIMIT 25)').get(filledProjectId,0).count,16,'the bounded keyset page returns every new result plus retained history without hidden client truncation');for(const [sql,args,index] of [["SELECT id FROM vsport_stories WHERE project_id=? AND id>? ORDER BY id LIMIT 25",[filledProjectId,0],'idx_vsport_stories_project_id'],["SELECT id FROM vsport_jobs WHERE project_id=? AND owner_id=? ORDER BY updated_at DESC,id LIMIT 24",[projectId,1],'idx_vsport_jobs_owner_project_updated']]){const plan=db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>row.detail).join(' | ');assert.match(plan,new RegExp(index));assert.doesNotMatch(plan,/TEMP B-TREE/)}db.close();
assert.match(api,/NEWS_FETCH_TIMEOUT_MS=4500/);assert.match(api,/NEWS_MAX_BYTES=2\*1024\*1024/);assert.match(api,/ON CONFLICT\(project_id,fingerprint\) DO UPDATE/);assert.match(api,/ORDER BY updated_at DESC,id LIMIT 24/);assert.doesNotMatch(api,/DELETE FROM vsport_stories/,'refresh remains additive and cannot destroy selected stories');

console.log('PASS v0.20.139 vSport Bangkok exact-first/48h fallback, bounded aliases/providers, closed outcomes, dedupe and Tha1 index contract');
