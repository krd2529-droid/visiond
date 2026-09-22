import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bingNewsRssUrl,normalizeNewsSourceUrl,parseNewsRss,storyFingerprint} from '../functions/_vsport.js';
import {discoverNews} from '../functions/api/admin/vsport.js';

const project={news_date:'2026-09-22',scope_mode:'specific_team',team_name:'Liverpool FC'};
const googleItem=(headline='Liverpool agree deal - World Sport')=>`<item><title><![CDATA[${headline}]]></title><link>https://news.google.com/rss/articles/story-1</link><pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Deal details from the source.</p>]]></description><source url="https://world.example">World Sport</source></item>`;
const bingTarget='https://world.example/football/liverpool-deal?id=7';
const bingLink=`http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=1&amp;url=${encodeURIComponent(bingTarget)}`;
const bingItem=(headline='Liverpool agree deal',date='Tue, 22 Sep 2026 10:00:00 GMT')=>`<item><title>${headline}</title><link>${bingLink}</link><pubDate>${date}</pubDate><description>Deal details from the source.</description><News:Source>World Sport</News:Source></item>`;
const rss=items=>`<?xml version="1.0"?><rss xmlns:News="https://www.bing.com/news/search"><channel>${items.join('')}</channel></rss>`;

assert.match(bingNewsRssUrl(project.news_date,project.scope_mode,project.team_name),/^https:\/\/www\.bing\.com\/news\/search\?/);
assert.match(bingNewsRssUrl(project.news_date,project.scope_mode,project.team_name),/2026-09-22/);
assert.equal(normalizeNewsSourceUrl(bingLink.replaceAll('&amp;','&')),bingTarget);
assert.equal(normalizeNewsSourceUrl('http://publisher.example/story'),'');
assert.equal(normalizeNewsSourceUrl(`https://www.bing.com/news/apiclick.aspx?url=${encodeURIComponent('https://127.0.0.1/story')}`),'');
const parsedBing=parseNewsRss(rss([bingItem(),bingItem('Liverpool old story','Mon, 21 Sep 2026 10:00:00 GMT')]),{newsDate:project.news_date,scopeMode:project.scope_mode,teamName:project.team_name,retrievedAt:'2026-09-22T12:00:00.000Z'});
assert.equal(parsedBing.length,1,'selected-day filter must reject an older fallback item');
assert.equal(parsedBing[0].publisher,'World Sport','namespaced Bing publisher attribution is retained');
assert.equal(parsedBing[0].source_url,bingTarget,'Bing apiclick is replaced by the encoded HTTPS publisher URL');
assert.equal(parsedBing[0].published_at,'2026-09-22T10:00:00.000Z');
assert.equal(parsedBing[0].retrieved_at.slice(0,10),'2026-09-22');

const fallbackCalls=[];
const fallback=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async url=>{
  fallbackCalls.push(url);
  return url.includes('news.google.com')?new Response('temporary outage',{status:503}):new Response(rss([bingItem()]),{status:200,headers:{'content-type':'application/rss+xml'}});
}});
assert.equal(fallbackCalls.length,3,'Google 503 is retried once before the independent Bing fallback');
assert.equal(fallback.provider,'bing');
assert.equal(fallback.stories.length,1);
assert.equal(fallback.stories[0].source_url,bingTarget);

let retryCalls=0;
const retried=await discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{
  retryCalls++;
  return retryCalls===1?new Response('',{status:503}):new Response(rss([googleItem(),googleItem()]),{status:200});
}});
assert.equal(retryCalls,2,'a transient primary failure has a bounded retry');
assert.equal(retried.provider,'google');
assert.equal(retried.stories.length,1,'duplicate feed items collapse before persistence');
assert.equal(storyFingerprint(retried.stories[0]),storyFingerprint(parsedBing[0]),'provider headline suffix differences do not create duplicate stories on retry/fallback');

let outageCalls=0;
await assert.rejects(()=>discoverNews(project,{retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async()=>{outageCalls++;return new Response('',{status:503})}}),error=>{
  assert.equal(error.code,'NEWS_SOURCES_UNAVAILABLE');
  assert.match(error.message,/Google News และ Bing News/);
  assert.match(error.message,/กด “ค้นข่าววันนี้” อีกครั้ง/);
  assert.doesNotMatch(error.message,/NEWS_HTTP|NEWS_PROVIDER_HTTP|503/);
  return true;
});
assert.equal(outageCalls,4,'two providers receive at most two attempts each');

let timeoutCalls=0;
await assert.rejects(()=>discoverNews(project,{timeoutMs:5,retryDelayMs:0,sleepImpl:async()=>{},fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{
  timeoutCalls++;signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
})}),error=>error.code==='NEWS_SOURCES_UNAVAILABLE');
assert.equal(timeoutCalls,4,'timeouts are bounded across both providers');

const api=await readFile(new URL('../functions/api/admin/vsport.js',import.meta.url),'utf8');
assert.match(api,/ON CONFLICT\(project_id,fingerprint\) DO UPDATE/,'database upsert keeps retries idempotent');
assert.match(api,/existing\.status==='failed'/,'failed jobs remain retryable through their existing idempotency key');
assert.match(api,/NEWS_FETCH_TIMEOUT_MS=4500/);
assert.doesNotMatch(api,/NEWS_HTTP_/,'raw provider HTTP status must not be stored by discovery');

console.log('PASS v0.20.124 vSport bounded news retry, attributed Bing fallback, strict selected-day filter, dedupe/idempotency and Thai outage recovery');
