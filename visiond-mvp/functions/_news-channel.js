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
const thaiMonths=Object.freeze({'มกราคม':1,'กุมภาพันธ์':2,'มีนาคม':3,'เมษายน':4,'พฤษภาคม':5,'มิถุนายน':6,'กรกฎาคม':7,'สิงหาคม':8,'กันยายน':9,'ตุลาคม':10,'พฤศจิกายน':11,'ธันวาคม':12});
const htmlText=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#(\d+)|#x([0-9a-f]+));/gi,(match,decimal,hex)=>{
  if(decimal||hex){const code=Number.parseInt(decimal||hex,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):' '}
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[match.slice(1,-1).toLowerCase()]||' ';
}).replace(/\s+/gu,' ').trim();
export function parseCh8Listing(html,day,observedAt=new Date().toISOString()){
  gdeltWindow(day);
  const observationDay=bangkokDay(new Date(observedAt));
  const cleaned=String(html||'').replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const starts=[...cleaned.matchAll(/<div\b[^>]*class\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)].filter(match=>/\bnews-post\b/.test(match[1]||match[2])&&/\b(?:image-post2|standard-post2)\b/.test(match[1]||match[2]));
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
    if(headline.length<8||headline.length>240||/(?:\.{3}|…)$/.test(headline))continue;
    seen.add(link.url);items.push({source:'ช่อง 8',headline,source_url:link.url,observed_at:observedAt,published_at:null,origin:'index'});
    if(items.length>=25)break;
  }
  return {items,dated};
}
export const gdeltUrl=(day,domain)=>{
  const window=gdeltWindow(day),url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.search=new URLSearchParams({query:`(domainis:${domain} OR domainis:www.${domain}) sourcelang:thai`,mode:'artlist',format:'json',sort:'datedesc',maxrecords:'75',startdatetime:window.from,enddatetime:window.to}).toString();
  return url.toString();
};
