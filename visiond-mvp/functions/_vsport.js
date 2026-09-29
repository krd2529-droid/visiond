const cleanText=value=>String(value??'').replace(/\s+/g,' ').trim();

const entities={amp:'&',apos:"'",quot:'"',lt:'<',gt:'>'};
export function decodeXml(value=''){
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[\da-f]+|#\d+|amp|apos|quot|lt|gt);/gi,(all,key)=>{
    if(key[0]==='#'){
      const point=key[1].toLowerCase()==='x'?Number.parseInt(key.slice(2),16):Number.parseInt(key.slice(1),10);
      return Number.isFinite(point)?String.fromCodePoint(point):all;
    }
    return entities[key.toLowerCase()]||all;
  });
}

const firstTag=(xml,name)=>decodeXml(xml.match(new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`,'i'))?.[1]||'');
const stripHtml=value=>cleanText(decodeXml(String(value||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')));
const DAY_MS=86400000,BANGKOK_OFFSET_MS=7*60*60*1000;
const normalizeTeamText=value=>cleanText(value).normalize('NFKC').toLocaleLowerCase('en').replace(/[.'’]/g,'').replace(/[‐‑–—_-]+/g,' ').replace(/\s+/g,' ').replace(/\s+fc$/,'').trim();
const normalizedTeamPhraseMatches=(normalizedValue,normalizedNeedle)=>{
  if(!normalizedNeedle)return false;
  if(!/[a-z0-9]/i.test(normalizedNeedle))return normalizedValue.includes(normalizedNeedle);
  const escaped=normalizedNeedle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`,'i').test(normalizedValue);
};
const teamDefinitions=[
  {name:'Liverpool FC',aliases:['Liverpool FC','Liverpool','ลิเวอร์พูล','หงส์แดง'],query:['Liverpool FC','Liverpool','ลิเวอร์พูล'],pattern:/\b(?:liverpool|reds)\b/i},
  {name:'Arsenal',aliases:['Arsenal','อาร์เซนอล','ปืนใหญ่'],query:['Arsenal','อาร์เซนอล'],pattern:/\b(?:arsenal|gunners)\b/i},
  {name:'Manchester City',aliases:['Manchester City','Man City','แมนเชสเตอร์ ซิตี้','แมนซิตี้','เรือใบสีฟ้า'],query:['Manchester City','Man City','แมนซิตี้'],pattern:/\b(?:manchester city|man city|cityzens)\b/i},
  {name:'Manchester United',aliases:['Manchester United','Man United','Man Utd','MUFC','Red Devils','แมนเชสเตอร์ ยูไนเต็ด','แมนเชสเตอร์ยูไนเต็ด','แมนยู','ปีศาจแดง'],query:['Manchester United','Man United','Man Utd','แมนเชสเตอร์ ยูไนเต็ด','แมนยู'],pattern:/\b(?:manchester united|man united|man utd|mufc|red devils)\b/i},
  {name:'Chelsea',aliases:['Chelsea','เชลซี','สิงห์บลูส์'],query:['Chelsea','เชลซี'],pattern:/\bchelsea\b/i},
  {name:'Tottenham Hotspur',aliases:['Tottenham Hotspur','Tottenham','Spurs','ท็อตแนม ฮ็อตสเปอร์','ทอตแนม ฮอตสเปอร์','สเปอร์ส'],query:['Tottenham Hotspur','Tottenham','Spurs','สเปอร์ส'],pattern:/\b(?:tottenham|spurs)\b/i},
  {name:'Newcastle United',aliases:['Newcastle United','Newcastle','นิวคาสเซิล ยูไนเต็ด','นิวคาสเซิล'],query:['Newcastle United','Newcastle','นิวคาสเซิล'],pattern:/\bnewcastle\b/i},
  {name:'Aston Villa',aliases:['Aston Villa','แอสตัน วิลลา','แอสตัน วิลล่า'],query:['Aston Villa','แอสตัน วิลลา'],pattern:/\baston villa\b/i},
  {name:'Real Madrid',aliases:['Real Madrid','เรอัล มาดริด'],query:['Real Madrid','เรอัล มาดริด'],pattern:/\breal madrid\b/i},
  {name:'Barcelona',aliases:['Barcelona','Barca','บาร์เซโลนา','บาร์เซโลน่า','บาร์ซา'],query:['Barcelona','Barca','บาร์เซโลนา'],pattern:/\b(?:barcelona|barca)\b/i},
  {name:'Bayern Munich',aliases:['Bayern Munich','Bayern','บาเยิร์น มิวนิก','บาเยิร์น'],query:['Bayern Munich','Bayern','บาเยิร์น มิวนิก'],pattern:/\bbayern(?: munich)?\b/i},
  {name:'Paris Saint-Germain',aliases:['Paris Saint-Germain','Paris Saint Germain','PSG','ปารีส แซงต์ แชร์กแมง','เปแอสเช'],query:['Paris Saint-Germain','PSG','เปแอสเช'],pattern:/\b(?:paris saint[- ]germain|psg)\b/i},
  {name:'Inter Milan',aliases:['Inter Milan','Inter','อินเตอร์ มิลาน','อินเตอร์'],query:['Inter Milan','อินเตอร์ มิลาน'],pattern:/\binter milan\b/i},
  {name:'AC Milan',aliases:['AC Milan','เอซี มิลาน'],query:['AC Milan','เอซี มิลาน'],pattern:/\bac milan\b/i},
];
for(const team of teamDefinitions)team.normalizedAliases=team.aliases.map(normalizeTeamText);
const matchingDefinition=value=>{const normalized=normalizeTeamText(value);return teamDefinitions.find(team=>team.normalizedAliases.includes(normalized))||null};
const matchesTeam=(headline,team)=>{const normalized=normalizeTeamText(headline);return team.pattern.test(headline)||team.normalizedAliases.some(alias=>normalizedTeamPhraseMatches(normalized,alias))};

export function resolveNewsTeam(value=''){
  const entered=cleanText(value).slice(0,120),normalized=normalizeTeamText(entered),definition=matchingDefinition(entered);
  return definition?{canonical:definition.name,recognized:true,query_aliases:[...definition.query]}:{canonical:entered,recognized:false,query_aliases:normalized?[entered]:[]};
}

const strictCalendarEpoch=value=>{
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)throw new Error('INVALID_NEWS_DATE');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),epoch=Date.UTC(year,month-1,day),date=new Date(epoch);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('INVALID_NEWS_DATE');
  return epoch;
};
const shiftedDay=(epoch,offset=0)=>new Date(epoch+offset).toISOString().slice(0,10);

export function bangkokNewsWindow(newsDate,kind='exact'){
  if(!['exact','fallback'].includes(kind))throw new Error('INVALID_NEWS_WINDOW');
  const calendarEpoch=strictCalendarEpoch(newsDate),exactStart=calendarEpoch-BANGKOK_OFFSET_MS,start=kind==='fallback'?exactStart-2*DAY_MS:exactStart,end=kind==='fallback'?exactStart:exactStart+DAY_MS;
  return{kind,start_ms:start,end_ms:end,from_day:shiftedDay(start,BANGKOK_OFFSET_MS),to_day:shiftedDay(end,BANGKOK_OFFSET_MS),query_after:shiftedDay(start),query_before:shiftedDay(end,DAY_MS)};
}

export function isNewsRssEnvelope(xml=''){
  const value=String(xml||'').trim(),rssOpen=value.search(/<rss(?:\s|>)/i),rssClose=value.search(/<\/rss\s*>/i),channelOpen=value.search(/<channel(?:\s|>)/i),channelClose=value.search(/<\/channel\s*>/i);
  return rssOpen>=0&&channelOpen>rssOpen&&channelClose>channelOpen&&rssClose>channelClose;
}

export function detectTeam(headline,scopeMode='all_teams_for_day',requestedTeam=''){
  if(scopeMode==='specific_team')return resolveNewsTeam(requestedTeam).canonical;
  return teamDefinitions.find(team=>matchesTeam(headline,team))?.name||'ฟุตบอลต่างประเทศ';
}

export function storyFingerprint(story){
  const publisher=cleanText(story.publisher).toLowerCase(),escapedPublisher=publisher.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),headline=cleanText(story.headline).toLowerCase().replace(new RegExp(`\\s+-\\s+${escapedPublisher}$`,'i'),'');
  const input=`${publisher}|${headline}`;
  let hash=2166136261;
  for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(16).padStart(8,'0');
}

export function balanceStories(items,{limit=24,maxPerTeam=3}={}){
  const groups=new Map();
  for(const item of items){const key=item.team_name||'ฟุตบอลต่างประเทศ';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
  const balanced=[];
  for(let round=0;balanced.length<limit;round++){
    let added=false;
    for(const group of groups.values()){
      if(round>=maxPerTeam||!group[round])continue;
      balanced.push(group[round]);added=true;if(balanced.length===limit)break;
    }
    if(!added)break;
  }
  return balanced;
}

export function parseNewsRss(xml,{newsDate,windowKind='exact',scopeMode='all_teams_for_day',teamName='',limit=24,retrievedAt=new Date().toISOString()}={}){
  const seen=new Set(),stories=[],window=bangkokNewsWindow(newsDate,windowKind),specificTeam=scopeMode==='specific_team'?matchingDefinition(teamName):null,unknownNeedle=normalizeTeamText(teamName);
  for(const match of String(xml||'').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
    const item=match[1],headline=cleanText(firstTag(item,'title')).slice(0,500),publisher=cleanText(firstTag(item,'source')).slice(0,180),sourceUrl=normalizeNewsSourceUrl(firstTag(item,'link')),publishedRaw=cleanText(firstTag(item,'pubDate')),publishedMs=Date.parse(publishedRaw);
    if(!headline||!publisher||!/^https:\/\//i.test(sourceUrl)||!Number.isFinite(publishedMs)||publishedMs<window.start_ms||publishedMs>=window.end_ms)continue;
    if(scopeMode==='specific_team'&&(!unknownNeedle||!(specificTeam?matchesTeam(headline,specificTeam):normalizedTeamPhraseMatches(normalizeTeamText(headline),unknownNeedle))))continue;
    const story={headline,summary:stripHtml(firstTag(item,'description')).slice(0,1600),team_name:detectTeam(headline,scopeMode,teamName),publisher,source_url:sourceUrl,published_at:new Date(publishedRaw).toISOString(),retrieved_at:retrievedAt};
    story.fingerprint=storyFingerprint(story);
    if(seen.has(story.fingerprint))continue;seen.add(story.fingerprint);stories.push(story);
  }
  stories.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  return scopeMode==='all_teams_for_day'?balanceStories(stories,{limit,maxPerTeam:3}):stories.slice(0,limit);
}

export function newsRssUrl(newsDate,scopeMode='all_teams_for_day',teamName=''){
  return newsRssUrlForWindow(newsDate,scopeMode,teamName,'exact');
}

export function bingNewsRssUrl(newsDate,scopeMode='all_teams_for_day',teamName=''){
  return bingNewsRssUrlForWindow(newsDate,scopeMode,teamName,'exact');
}

const newsSubject=(scopeMode,teamName)=>{
  if(scopeMode!=='specific_team')return'football (Premier League OR Champions League OR transfer OR manager OR player)';
  const resolved=resolveNewsTeam(teamName),terms=resolved.query_aliases.slice(0,5).map(value=>cleanText(value).replace(/["()]/g,' ').slice(0,120)).filter(Boolean).map(value=>`"${value}"`);
  if(!terms.length)throw new Error('INVALID_NEWS_TEAM');
  return`${terms.length>1?`(${terms.join(' OR ')})`:terms[0]} football`;
};

export function newsRssUrlForWindow(newsDate,scopeMode='all_teams_for_day',teamName='',windowKind='exact'){
  const window=bangkokNewsWindow(newsDate,windowKind),subject=newsSubject(scopeMode,teamName);
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${subject} after:${window.query_after} before:${window.query_before}`)}&hl=en-GB&gl=GB&ceid=GB:en`;
}

export function bingNewsRssUrlForWindow(newsDate,scopeMode='all_teams_for_day',teamName='',windowKind='exact'){
  bangkokNewsWindow(newsDate,windowKind);
  const subject=newsSubject(scopeMode,teamName),params=new URLSearchParams({q:subject,format:'rss',setlang:'en-GB',qft:'sortbydate="1"'});
  return `https://www.bing.com/news/search?${params}`;
}

export function normalizeNewsSourceUrl(value){
  try{
    const url=new URL(cleanText(value));
    if(/^https?:$/.test(url.protocol)&&/(^|\.)bing\.com$/i.test(url.hostname)&&url.pathname.toLowerCase()==='/news/apiclick.aspx'){
      const target=new URL(url.searchParams.get('url')||'');return isSafeRemoteUrl(target.href)?target.href:'';
    }
    return isSafeRemoteUrl(url.href)?url.href:'';
  }catch{return''}
}

export function isSafeRemoteUrl(value){
  try{
    const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return false;
    const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
    if(host==='localhost'||host.endsWith('.localhost'))return false;
    const blockedV4=address=>{const octets=address.split('.').map(Number);if(octets.length!==4||octets.some(part=>!Number.isInteger(part)||part<0||part>255))return false;const[a,b]=octets;return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19))};
    if(/^\d+(?:\.\d+){3}$/.test(host)&&blockedV4(host))return false;
    if(host.includes(':')){
      const halves=host.split('::');if(halves.length>2)return false;const left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[],fill=8-left.length-right.length;if(fill<0||(!host.includes('::')&&fill!==0))return false;const parts=[...left,...Array(fill).fill('0'),...right].map(part=>Number.parseInt(part||'0',16));if(parts.length!==8||parts.some(part=>!Number.isInteger(part)||part<0||part>0xffff))return false;
      const first=parts[0];if(parts.every(part=>part===0)||(parts.slice(0,7).every(part=>part===0)&&parts[7]===1)||(first&0xfe00)===0xfc00||(first&0xffc0)===0xfe80||(first&0xffc0)===0xfec0||(first&0xff00)===0xff00)return false;
      const mapped=parts.slice(0,5).every(part=>part===0)&&parts[5]===0xffff,compatible=parts.slice(0,6).every(part=>part===0);if(mapped||compatible){const address=`${parts[6]>>8}.${parts[6]&255}.${parts[7]>>8}.${parts[7]&255}`;if(blockedV4(address))return false}
    }
    return true;
  }catch{return false}
}

const supportedImageExtensions=new Set(['jpg','jpeg','png','webp']),unsupportedImageExtensions=new Set(['svg','gif','ico','avif']);
const decorativeImageDirectories=new Set(['app-store','appstore','badges','chrome','flags','icons','logo','logos','menu','nav','navigation','play-store','playstore','sprites']);
const decorativeImageBasenames=new Set(['app-store','appstore','arrow','covers-header-v2-dropdown-caret','dropdown-caret','favicon','flag','footer-logo','google-play','hamburger','header-logo','icon','logo','menu','menu-arrow','play-store','site-logo','spacer','sprite','tracking-pixel']);
const socialImageMetaNames=new Set(['og:image','og:image:url','twitter:image','twitter:image:src']);
const terminalImageCandidateErrors=new Set(['IMAGE_DECODE_OR_SIZE_INVALID','IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED','IMAGE_TOO_LARGE']);
const retryableImageHttpStatuses=new Set([408,409,425,429]);

const numericImageTransform=(url,names)=>{
  const values=[];
  for(const[name,value]of url.searchParams)if(names.has(name.toLowerCase())&&/^\d+$/.test(value)){const number=Number(value);if(Number.isSafeInteger(number))values.push(number)}
  return values.length?Math.min(...values):null;
};

export function isLikelyContentImageUrl(value){
  if(!isSafeRemoteUrl(value))return false;
  try{
    const url=new URL(value),pathname=decodeURIComponent(url.pathname).toLowerCase(),segments=pathname.split('/').filter(Boolean),basename=segments.at(-1)||'',extensionMatch=basename.match(/\.([a-z0-9]{2,8})$/i),extension=extensionMatch?.[1]?.toLowerCase()||'',stem=extensionMatch?basename.slice(0,-extensionMatch[0].length):basename,canonicalStem=stem.replace(/@(2|3)x$/,''),directorySegments=segments.slice(0,-1);
    if(extension&&(!supportedImageExtensions.has(extension)||unsupportedImageExtensions.has(extension)))return false;
    if(directorySegments.some(segment=>decorativeImageDirectories.has(segment)))return false;
    if(decorativeImageBasenames.has(canonicalStem))return false;
    const width=numericImageTransform(url,new Set(['w','width'])),height=numericImageTransform(url,new Set(['h','height']));
    if(width!==null&&height!==null&&(width<320||height<180))return false;
    return true;
  }catch{return false}
}

export function isDisplayEligibleImageCandidate(candidate){
  if(!isLikelyContentImageUrl(candidate?.source_url))return false;
  if(candidate?.state!=='failed')return true;
  const code=String(candidate?.error_message||'').trim();
  if(terminalImageCandidateErrors.has(code))return false;
  const status=Number(code.match(/^IMAGE_HTTP_(\d{3})$/)?.[1]||0);
  return !(status>=400&&status<500&&!retryableImageHttpStatuses.has(status));
}

export function extractImageUrls(html,baseUrl,limit=12){
  const found=[],social=[],body=[];
  const add=value=>{try{const url=new URL(decodeXml(value),baseUrl).href;if(isLikelyContentImageUrl(url)&&!found.includes(url))found.push(url)}catch{}};
  for(const match of String(html||'').matchAll(/<(meta|img)\b[^>]*>/gi)){
    const attributes={};for(const attribute of match[0].matchAll(/\b([a-z][\w:-]*)\s*=\s*(["'])(.*?)\2/gi)){const name=attribute[1].toLowerCase();if(!Object.hasOwn(attributes,name))attributes[name]=attribute[3]}
    if(match[1].toLowerCase()==='meta'){const name=String(attributes.property||attributes.name||'').toLowerCase();if(socialImageMetaNames.has(name)&&attributes.content)social.push(attributes.content)}else if(attributes.src)body.push(attributes.src);
  }
  for(const value of [...social,...body]){add(value);if(found.length>=limit)return found}
  return found;
}

export function imageDimensions(bytes,mime=''){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]),type=String(mime).toLowerCase();
  if(type==='image/png'&&data.length>=24&&data[0]===0x89&&data[1]===0x50&&data[2]===0x4e&&data[3]===0x47)return{width:(data[16]<<24|data[17]<<16|data[18]<<8|data[19])>>>0,height:(data[20]<<24|data[21]<<16|data[22]<<8|data[23])>>>0};
  if(type==='image/jpeg'&&data[0]===0xff&&data[1]===0xd8){for(let offset=2;offset+9<data.length;){if(data[offset]!==0xff){offset++;continue}const marker=data[offset+1],size=(data[offset+2]<<8)+data[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:(data[offset+5]<<8)+data[offset+6],width:(data[offset+7]<<8)+data[offset+8]};if(size<2)break;offset+=size+2}}
  if(type==='image/webp'&&data.length>=30&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP'){
    const chunk=String.fromCharCode(...data.slice(12,16));
    if(chunk==='VP8X')return{width:1+data[24]+(data[25]<<8)+(data[26]<<16),height:1+data[27]+(data[28]<<8)+(data[29]<<16)};
  }
  return null;
}

export function buildTimeline(assetIds,durationSeconds){
  const ids=[...new Set((assetIds||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))],duration=Math.round(Number(durationSeconds)*1000)/1000;
  if(!ids.length||!Number.isFinite(duration)||duration<=0)return[];
  const share=duration/ids.length,styles=['push-in','pan-left','pan-right','pull-out'],timeline=[];
  let cursor=0;
  ids.forEach((assetId,index)=>{const end=index===ids.length-1?duration:Math.round((cursor+share)*1000)/1000;timeline.push({asset_id:assetId,start_seconds:cursor,end_seconds:end,duration_seconds:Math.round((end-cursor)*1000)/1000,style:styles[index%styles.length]});cursor=end});
  return timeline;
}

export function parseCursor(value){const raw=String(value||''),split=raw.lastIndexOf('|'),id=Number(raw.slice(split+1));return split>0&&Number.isInteger(id)&&id>0?{at:raw.slice(0,split),id}:null}
export function escapeLike(value){return String(value||'').replace(/[\\%_]/g,'\\$&')}
