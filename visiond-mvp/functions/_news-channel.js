export const NEWS_SOURCES=Object.freeze([
  {name:'ไทยรัฐ',domain:'thairath.co.th'},
  {name:'ช่อง 3',domain:'ch3plus.com'},
  {name:'ช่องวัน',domain:'one31.net'},
  {name:'ช่อง 8',domain:'thaich8.com'}
]);
export const NEWS_STYLES=Object.freeze(['ข่าวด่วน','ผู้ประกาศข่าวมืออาชีพ','เล่าข่าวแบบเพื่อนคุย','ข่าวสายแซ่บ','ข่าวสายฮา','ข่าวลึกลับ','ข่าวสืบสวน','ข่าววิเคราะห์','ข่าวเล่าเป็นเรื่อง','ข่าวประเด็นฮิต','ข่าวสรุป 30 วินาที','ข่าวแบบตั้งคำถาม','ข่าวสองพิธีกร','ข่าวสารคดี','ข่าวเล่าจากหลายมุม']);
export const bangkokDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const rollingWindow=(date=new Date())=>({start:new Date(date.getTime()-86400000).toISOString(),end:date.toISOString()});
const exactTime=value=>{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:\+07:00|Z)$/.test(String(value||'')))return null;
  const time=new Date(value);return Number.isFinite(time.getTime())&&bangkokDay(time)===String(value).slice(0,10)?time.toISOString():null;
};
const completeTitle=value=>{const title=String(value||'').replace(/\s+/gu,' ').trim();return title.length>=8&&title.length<=240&&!/(?:\.{3}|…)$/.test(title)?title:null};
export function parseCh3Listing(html,observedAt){
  const script=String(html||'').match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!script||script[1].length>1_000_000)return null;
  let categories;try{categories=JSON.parse(script[1]).props.initialState.newsHome2021Reducer.category}catch{return null}
  if(!Array.isArray(categories))return null;
  const seen=new Set(),items=[];
  for(const category of categories.slice(0,12))for(const row of Array.isArray(category?.data)?category.data.slice(0,12):[]){
    if(!Number.isSafeInteger(row?.id)||!/^\d{5,8}$/.test(String(row.id)))continue;
    if(!/^[a-z0-9_-]+$/i.test(row.category_permalink||'')||!/^[a-z0-9_-]+$/i.test(row.program_permalink||''))continue;
    const link=sourceForUrl(`https://ch3plus.com/news/${row.category_permalink}/${row.program_permalink}/${row.id}`);
    const title=completeTitle(row.title),published=exactTime(row.date);
    if(!link||link.source!=='ช่อง 3'||!title||!published||seen.has(link.url))continue;
    seen.add(link.url);items.push({source:'ช่อง 3',headline:title,source_url:link.url,news_day:bangkokDay(new Date(published)),observed_at:observedAt,published_at:published,origin:'index'});
  }
  return items.sort((a,b)=>b.published_at.localeCompare(a.published_at)).slice(0,12);
}
export function parseCh3Detail(html,id){
  const script=String(html||'').match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!script||script[1].length>500_000)return null;
  let row;try{row=JSON.parse(script[1]).props.initialState.newsDetail2021.data}catch{return null}
  return row?.id===id&&completeTitle(row.title)&&exactTime(row.date)?{headline:completeTitle(row.title),published_at:exactTime(row.date)}:null;
}
export function parseOneSitemap(xml){
  const items=[],seen=new Set();
  for(const match of String(xml||'').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)){
    const link=sourceForUrl(match[1].replace(/&amp;/g,'&'));
    if(link?.source==='ช่องวัน'&&!seen.has(link.url)){seen.add(link.url);items.push(link.url)}
    if(items.length>=12)break;
  }
  return items;
}
export function parseOneDetail(html,id){
  const text=String(html||'');const start=text.indexOf(`newsDetail:{id:${id},`);
  if(start<0)return null;
  const end=text.indexOf('newsDetailList:',start);if(end<0||end-start>20000)return null;
  const block=text.slice(start,end),titleMatch=block.match(/\btitle:("(?:\\.|[^"\\])*")/),timeMatch=block.match(/\bcreatedTime:"([^"]+)"/);
  if(!titleMatch||!timeMatch||!/\bparentCategoryId:151\b/.test(block)||!/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(timeMatch[1]))return null;
  let title;try{title=JSON.parse(titleMatch[1])}catch{return null}
  const published=exactTime(`${timeMatch[1]}+07:00`);
  return completeTitle(title)&&published?{headline:completeTitle(title),published_at:published}:null;
}
export function parseThaiRathListing(html,observedAt){
  const seen=new Set(),items=[];
  for(const match of String(html||'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>/gi)){
    let link;try{link=sourceForUrl(new URL(htmlText(match[1]),'https://www.thairath.co.th/news').toString())}catch{continue}
    const headline=completeTitle(htmlText(match[2]));
    if(link?.source!=='ไทยรัฐ'||!headline||seen.has(link.url))continue;
    seen.add(link.url);items.push({source:'ไทยรัฐ',headline,source_url:link.url,observed_at:observedAt});
    if(items.length>=12)break;
  }
  return items;
}
export function parseThaiRathDetail(html){
  const text=String(html||''),time=text.match(/<meta\b[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const title=text.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const canonical=text.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  const published=exactTime(time?.[1]),headline=completeTitle(htmlText(title?.[1])),link=sourceForUrl(canonical?.[1]);
  return published&&headline&&link?.source==='ไทยรัฐ'?{published_at:published,headline,source_url:link.url}:null;
}
export function sourceForUrl(value){
  let url;try{url=new URL(value)}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.searchParams.has('url'))return null;
  const source=NEWS_SOURCES.find(item=>url.hostname===item.domain||url.hostname===`www.${item.domain}`);
  if(!source)return null;
  const articlePath={
    'thairath.co.th':/^\/news\/(?:[a-z0-9_-]+\/)+\d{5,}(?:\/|$)/i,
    'ch3plus.com':/^\/news\/(?:[a-z0-9_-]+\/){0,3}\d{5,}(?:\/|$)/i,
    'one31.net':/^\/news\/detail\/\d{3,}(?:\/|$)/i,
    'thaich8.com':/^\/news_detail\/\d{3,}(?:\/|$)/i
  };
  if(!articlePath[source.domain].test(url.pathname))return null;
  url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(key))url.searchParams.delete(key);
  return {source:source.name,url:url.toString()};
}
export function gdeltWindow(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('INVALID_DAY');
  const start=Date.parse(`${day}T00:00:00+07:00`);
  if(!Number.isFinite(start)||bangkokDay(new Date(start))!==day)throw new Error('INVALID_DAY');
  const stamp=value=>new Date(value).toISOString().replace(/[-:T]/g,'').slice(0,14);
  return{start,end:start+86400000,from:stamp(start),to:stamp(start+86400000)};
}
export function parseGdeltArticles(payload,day,source){
  const window=gdeltWindow(day),seen=new Set(),result=[];
  for(const article of Array.isArray(payload?.articles)?payload.articles.slice(0,75):[]){
    const link=sourceForUrl(article.url),title=String(article.title||'').replace(/\s+/gu,' ').trim().slice(0,240);
    const raw=String(article.seendate||''),seenAt=/^\d{8}T\d{6}Z$/.test(raw)?Date.parse(`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}Z`):NaN;
    if(!link||link.source!==source.name||!title||!Number.isFinite(seenAt)||seenAt<window.start||seenAt>=window.end||seen.has(link.url))continue;
    seen.add(link.url);result.push({source:source.name,headline:title,source_url:link.url,observed_at:new Date(seenAt).toISOString(),published_at:null,origin:'index'});
  }
  return result.sort((a,b)=>b.observed_at.localeCompare(a.observed_at));
}
const thaiMonths=Object.freeze({'มกราคม':1,'กุมภาพันธ์':2,'มีนาคม':3,'เมษายน':4,'พฤษภาคม':5,'มิถุนายน':6,'กรกฎาคม':7,'สิงหาคม':8,'กันยายน':9,'ตุลาคม':10,'พฤศจิกายน':11,'ธันวาคม':12});
const htmlText=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#(\d+)|#x([0-9a-f]+));/gi,(match,decimal,hex)=>{
  if(decimal||hex){const code=Number.parseInt(decimal||hex,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):' '}
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[match.slice(1,-1).toLowerCase()]||' ';
}).replace(/\s+/gu,' ').trim();
export function extractNewsArticleImage(html,headline,articleUrl){
  const source=sourceForUrl(articleUrl);if(!source)return null;
  const page=String(html||'').slice(0,450_000);
  const meta=(name)=>{for(const tag of page.match(/<meta\b[^>]*>/gi)||[]){if(!new RegExp(`(?:property|name)=["']${name}["']`,'i').test(tag))continue;return tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]||''}return ''};
  let nuxtTitle='';
  if(source.source==='ช่องวัน'){
    const id=new URL(source.url).pathname.match(/^\/news\/detail\/(\d+)/)?.[1];
    const start=id?page.indexOf(`newsDetail:{id:${id},`):-1,end=start<0?-1:page.indexOf('newsDetailList:',start);
    if(end>start&&end-start<250_000){const encoded=page.slice(start,end).match(/\btitle:("(?:\\.|[^"\\])*")/)?.[1];try{nuxtTitle=JSON.parse(encoded||'""')}catch{}}
  }
  const expected=htmlText(headline).toLowerCase(),actual=htmlText(meta('og:title')||nuxtTitle).toLowerCase();
  if(expected.length<8||actual.length<8||(!actual.includes(expected)&&!expected.includes(actual)))return null;
  const candidate=meta('og:image')||meta('twitter:image');let url;try{url=new URL(htmlText(candidate),source.url)}catch{return null}
  const publisher=new URL(source.url).hostname.replace(/^www\./,'');
  const permitted=url.hostname===publisher||url.hostname.endsWith(`.${publisher}`)||source.source==='ช่องวัน'&&url.hostname==='image.onehd.net';
  if(!permitted||url.protocol!=='https:'||url.username||url.password||url.port||url.href.length>1000||!/^\/(?!\/)[^?#]+\.(?:jpe?g|png|webp)$/i.test(url.pathname)||/(?:logo|placeholder|default|favicon)/i.test(url.pathname)||url.search||url.hash)return null;
  return {url:url.toString(),source:source.source,article_url:source.url};
}
export function extractNewsArticleBody(html,headline){
  const source=String(html||'').slice(0,450_000),expected=htmlText(headline).toLowerCase();
  if(expected.length<8)return null;
  const nuxtStart=source.indexOf('newsDetail:{id:');
  const nuxtEnd=nuxtStart<0?-1:source.indexOf('newsDetailList:',nuxtStart);
  const nuxt=nuxtEnd>nuxtStart&&nuxtEnd-nuxtStart<250_000?source.slice(nuxtStart,nuxtEnd):'';
  const encodedTitle=nuxt.match(/\btitle:("(?:\\.|[^"\\])*")/)?.[1];
  const encodedContent=nuxt.match(/\bcontent:("(?:\\.|[^"\\])*")/)?.[1];
  let nuxtTitle='',nuxtContent='';
  try{nuxtTitle=JSON.parse(encodedTitle||'""');nuxtContent=JSON.parse(encodedContent||'""')}catch{}
  const title=nuxtTitle||source.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ||source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const actual=htmlText(title).toLowerCase();
  if(!actual||(!actual.includes(expected)&&!expected.includes(actual)&&!(expected.slice(0,20)&&actual.includes(expected.slice(0,20)))))return null;
  const candidates=[nuxtContent];
  for(const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const visit=(value,depth=0)=>{if(depth>5||!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(item=>visit(item,depth+1));return}if(typeof value.articleBody==='string')candidates.push(value.articleBody);for(const key of ['@graph','mainEntity'])visit(value[key],depth+1)};visit(JSON.parse(match[1]))}catch{}
  }
  const clean=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<nav\b[^>]*>[\s\S]*?<\/nav>|<footer\b[^>]*>[\s\S]*?<\/footer>|<header\b[^>]*>[\s\S]*?<\/header>/gi,' ');
  const article=clean.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||'';
  const paragraphs=[...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match=>htmlText(match[1])).filter(text=>text.length>=35);
  candidates.push(paragraphs.join('\n'));
  const body=candidates.map(value=>htmlText(value).slice(0,9000)).find(value=>value.length>=180&&value!==actual);
  return body?body.slice(0,6500):null;
}
export function parseCh8Headline(html){
  const clean=String(html||'').slice(0,131072).replace(/<!--[^]*?-->|<script\b[^>]*>[^]*?<\/script>|<style\b[^>]*>[^]*?<\/style>/gi,'');
  const title=clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return title?htmlText(title[1]):null;
}
export function parseCh8PublishedAt(html){
  // Prefer the publisher-visible "วันที่ลงข่าว" header over article:published_time when they disagree.
  const clean=String(html||'').slice(0,131072).replace(/<!--[^]*?-->|<script\b[^>]*>[^]*?<\/script>|<style\b[^>]*>[^]*?<\/style>/gi,'');
  const title=clean.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);if(!title)return null;
  const afterTitle=clean.slice((title.index||0)+title[0].length,(title.index||0)+title[0].length+1024);
  const calendar=afterTitle.match(/<div\b[^>]*>(?:(?!<\/div>)[^])*?<i\b[^>]*class\s*=\s*(?:"[^"]*\bfa-calendar\b[^"]*"|'[^']*\bfa-calendar\b[^']*')[^>]*>(?:(?!<\/div>)[^])*?<\/div>/i);
  if(!calendar)return null;
  const header=htmlText(calendar[0]);
  const match=header.match(/วันที่ลงข่าว\s+(\d{1,2})\s+([ก-๙]+)\s+(\d{4})\s+เวลา\s+(\d{1,2}):(\d{2})\s*น\.?/u);
  if(!match||!thaiMonths[match[2]])return null;
  const year=Number(match[3])-543,month=thaiMonths[match[2]],day=Number(match[1]),hour=Number(match[4]),minute=Number(match[5]);
  if(year<2000||hour>23||minute>59)return null;
  const local=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const timestamp=Date.parse(`${local}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+07:00`);
  return Number.isFinite(timestamp)&&bangkokDay(new Date(timestamp))===local?new Date(timestamp).toISOString():null;
}
export function parseCh8Listing(html,day,observedAt=new Date().toISOString(),allowTruncated=false){
  gdeltWindow(day);
  const observationDay=bangkokDay(new Date(observedAt));
  const cleaned=String(html||'').replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const starts=[...cleaned.matchAll(/<div\b[^>]*class\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)].filter(match=>/\bnews-post\b/.test(match[1]||match[2])&&/\b(?:image-post2|standard-post2|standard-main-post2)\b/.test(match[1]||match[2]));
  const seen=new Set(),items=[];let dated=0;
  for(let index=0;index<Math.min(starts.length,100);index++){
    const card=cleaned.slice(starts[index].index,starts[index+1]?.index||cleaned.length).slice(0,16000);
    const heading=card.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i);
    const anchor=heading?.[1].match(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/i);
    const date=card.match(/<div\b[^>]*class\s*=\s*(?:"[^"]*\bdateline\b[^"]*"|'[^']*\bdateline\b[^']*')[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i);
    if(!anchor||!date)continue;
    let link;try{link=sourceForUrl(new URL(htmlText(anchor[1]||anchor[2]),'https://www.thaich8.com/news').toString())}catch{continue}
    if(link?.source!=='ช่อง 8')continue;
    const parts=htmlText(date[1]).match(/^(\d{1,2})\s+([ก-๙]+)\s+(\d{4})$/u);
    if(!parts||!thaiMonths[parts[2]])continue;
    const month=String(thaiMonths[parts[2]]).padStart(2,'0'),calendarDay=String(Number(parts[1])).padStart(2,'0'),year=Number(parts[3])-543;
    const listedDay=`${year}-${month}-${calendarDay}`;
    if(!Number.isInteger(year)||year<2000||bangkokDay(new Date(`${listedDay}T00:00:00+07:00`))!==listedDay)continue;
    dated++;
    if(listedDay!==day||listedDay>observationDay||seen.has(link.url))continue;
    const headline=htmlText(anchor[3]);
    const incomplete=/(?:\.{3}|…)$/.test(headline);
    if(headline.length<8||headline.length>240||(incomplete&&!allowTruncated))continue;
    seen.add(link.url);items.push({source:'ช่อง 8',headline,source_url:link.url,news_day:listedDay,observed_at:observedAt,published_at:null,origin:'index',...(incomplete?{headline_incomplete:true}:{})});
    if(items.length>=25)break;
  }
  return {items,dated};
}
export const gdeltUrl=(day,domain)=>{
  const window=gdeltWindow(day),url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.search=new URLSearchParams({query:`(domainis:${domain} OR domainis:www.${domain}) sourcelang:thai`,mode:'artlist',format:'json',sort:'datedesc',maxrecords:'75',startdatetime:window.from,enddatetime:window.to}).toString();
  return url.toString();
};
