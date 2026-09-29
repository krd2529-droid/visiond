import assert from 'node:assert/strict';

import {bingNewsRssUrlForWindow,newsRssUrlForWindow,parseNewsRss} from '../functions/_vsport.js';
import {discoverNews} from '../functions/api/admin/vsport.js';

const project={news_date:'2026-09-29',scope_mode:'specific_team',team_name:'แมนยู'};
const item=(headline,date,publisher='Fixture Sport',slug=headline.replace(/[^a-z0-9]+/gi,'-').toLowerCase())=>`<item><title><![CDATA[${headline}]]></title><link>https://publisher.example/${slug}</link><pubDate>${date}</pubDate><description><![CDATA[Fixture summary]]></description><source>${publisher}</source></item>`;
const rss=(...items)=>`<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`;
const response=(body,{status=200,headers={}}={})=>new Response(body,{status,headers:{'content-type':'application/rss+xml',...headers}});
const providerOf=url=>url.includes('news.google.com')?'google':'bing';
const googleWindowOf=url=>{const query=new URL(url).searchParams.get('q')||'';return query.includes('after:2026-09-26')?'fallback':'exact'};

const bingExact=bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'exact');
const bingFallback=bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback');
assert.equal(bingExact,bingFallback,'Bing uses one provider-compatible response for both trusted local windows');
const bingParams=new URL(bingExact).searchParams,bingQuery=bingParams.get('q')||'';
assert.match(bingQuery,/"Manchester United"/);assert.match(bingQuery,/"Man United"/);assert.match(bingQuery,/"Man Utd"/);assert.match(bingQuery,/"แมนยู"/);
assert.doesNotMatch(bingQuery,/\b(?:after|before):/i);assert.equal(bingParams.get('format'),'rss');assert.equal(bingParams.get('setlang'),'en-GB');assert.equal(bingParams.get('qft'),'sortbydate="1"');assert.ok(bingExact.length<700,'specific-team Bing URL remains bounded');
const allTeamsBing=bingNewsRssUrlForWindow(project.news_date,'all_teams_for_day','','exact'),allTeamsQuery=new URL(allTeamsBing).searchParams.get('q')||'';
assert.match(allTeamsQuery,/Premier League/);assert.doesNotMatch(allTeamsQuery,/\b(?:after|before):/i);assert.ok(allTeamsBing.length<400,'all-team Bing URL remains bounded');
assert.throws(()=>bingNewsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'other'),/INVALID_NEWS_WINDOW/);

const googleExact=new URL(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'exact')).searchParams.get('q')||'',googleFallback=new URL(newsRssUrlForWindow(project.news_date,project.scope_mode,project.team_name,'fallback')).searchParams.get('q')||'';
assert.match(googleExact,/after:2026-09-28 before:2026-09-30/);assert.match(googleFallback,/after:2026-09-26 before:2026-09-29/);assert.notEqual(googleExact,googleFallback,'Google keeps its distinct dated queries');

const exactCalls=[];
const exact=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{exactCalls.push(url);return providerOf(url)==='google'?response(rss()):response(rss(item('Manchester United exact story','Tue, 29 Sep 2026 10:00:00 GMT')))}});
assert.equal(exact.windowKind,'exact');assert.equal(exact.provider,'bing');assert.equal(exact.stories.length,1);assert.equal(exactCalls.length,2,'exact Bing story wins before fallback');

const reuseCalls=[],reuseAttempts=[];
const reused=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},onAttempt:event=>reuseAttempts.push(`${event.windowKind}:${event.provider}:${event.attempt}`),fetchImpl:async url=>{
  reuseCalls.push(url);const provider=providerOf(url);
  if(provider==='google')return response(rss());
  if(reuseCalls.filter(value=>providerOf(value)==='bing').length>1)assert.fail('valid Bing response must be reused instead of fetched twice');
  return response(rss(item('Man Utd fallback story','Mon, 28 Sep 2026 10:00:00 GMT')));
}});
assert.equal(reused.windowKind,'fallback');assert.equal(reused.provider,'bing');assert.equal(reused.stories.length,1);assert.deepEqual(reused.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(reused.discovery.fallback,{google:'empty',bing:'stories'});
assert.equal(reuseCalls.length,3,'Google exact/fallback remain separate while one successful Bing feed is reused');assert.equal(reuseCalls.filter(value=>providerOf(value)==='bing').length,1);assert.deepEqual(reuseAttempts,['exact:google:1','exact:bing:1','fallback:google:1'],'cache reuse is not reported as a network attempt');

let zeroCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{zeroCalls++;return response(rss())}}),error=>{assert.equal(error.code,'NEWS_NOT_FOUND');assert.deepEqual(error.discovery.exact,{google:'empty',bing:'empty'});assert.deepEqual(error.discovery.fallback,{google:'empty',bing:'empty'});return true});
assert.equal(zeroCalls,3,'valid-empty Bing XML is reused for the fallback parse');

for(const [name,bingFailure] of [
  ['HTTP failure',()=>response('',{status:503})],
  ['malformed envelope',()=>response('<html>temporary edge page</html>')],
  ['oversized response',()=>response('',{headers:{'content-length':String(2*1024*1024+1)}})],
]){
  const calls=[];
  await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{calls.push(url);return providerOf(url)==='google'?response(rss()):bingFailure()}}),error=>{assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE',name);return true});
  assert.equal(calls.filter(url=>providerOf(url)==='bing').length,4,`${name} is never cached and keeps two attempts per window`);
  assert.equal(calls.length,6,`${name} stays inside the existing bounded retry envelope`);
}

let isolatedBingFetches=0;
for(let job=0;job<2;job++){
  const result=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>providerOf(url)==='google'?response(rss()):(isolatedBingFetches++,response(rss(item(`Manchester United exact ${job}`,'Tue, 29 Sep 2026 09:00:00 GMT','Isolated Source',`isolated-${job}`))))});
  assert.equal(result.windowKind,'exact');
}
assert.equal(isolatedBingFetches,2,'successful-response cache cannot cross discoverNews jobs');

const parsed=parseNewsRss(rss(item('Manchester United exact','Tue, 29 Sep 2026 10:00:00 GMT'),item('Man Utd fallback','Mon, 28 Sep 2026 10:00:00 GMT')),{newsDate:project.news_date,windowKind:'exact',scopeMode:project.scope_mode,teamName:project.team_name});
assert.deepEqual(parsed.map(story=>story.headline),['Manchester United exact'],'trusted local Bangkok window still owns selection');

console.log('PASS v0.20.140 provider-compatible Bing query, request-local valid-response reuse, unchanged Google windows and bounded failure semantics');
