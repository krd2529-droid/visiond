export const NEWS_SOURCES=Object.freeze([
  {name:'ไทยรัฐ',domain:'thairath.co.th'},
  {name:'ช่อง 3',domain:'ch3plus.com'},
  {name:'ช่องวัน',domain:'one31.net'},
  {name:'ช่อง 8',domain:'thaich8.com'}
]);
export const NEWS_STYLES=Object.freeze(['ข่าวด่วน','ผู้ประกาศข่าวมืออาชีพ','เล่าข่าวแบบเพื่อนคุย','ข่าวสายแซ่บ','ข่าวสายฮา','ข่าวลึกลับ','ข่าวสืบสวน','ข่าววิเคราะห์','ข่าวเล่าเป็นเรื่อง','ข่าวประเด็นฮิต','ข่าวสรุป 30 วินาที','ข่าวแบบตั้งคำถาม','ข่าวสองพิธีกร','ข่าวสารคดี','ข่าวเล่าจากหลายมุม']);
export const bangkokDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
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
export const gdeltUrl=(day,domain)=>{
  const window=gdeltWindow(day),url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.search=new URLSearchParams({query:`(domainis:${domain} OR domainis:www.${domain}) sourcelang:thai`,mode:'artlist',format:'json',sort:'datedesc',maxrecords:'75',startdatetime:window.from,enddatetime:window.to}).toString();
  return url.toString();
};
