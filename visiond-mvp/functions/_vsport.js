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
const isoDay=value=>{const date=new Date(value);return Number.isNaN(date.valueOf())?'':date.toISOString().slice(0,10)};

const teamMatchers=[
  ['Liverpool FC',/\b(?:liverpool|reds)\b/i],['Arsenal',/\b(?:arsenal|gunners)\b/i],['Manchester City',/\b(?:manchester city|man city|cityzens)\b/i],
  ['Manchester United',/\b(?:manchester united|man united|man utd|red devils)\b/i],['Chelsea',/\bchelsea\b/i],['Tottenham Hotspur',/\b(?:tottenham|spurs)\b/i],
  ['Newcastle United',/\bnewcastle\b/i],['Aston Villa',/\baston villa\b/i],['Real Madrid',/\breal madrid\b/i],['Barcelona',/\bbarcelona\b/i],
  ['Bayern Munich',/\bbayern(?: munich)?\b/i],['Paris Saint-Germain',/\b(?:paris saint-germain|psg)\b/i],['Inter Milan',/\binter milan\b/i],['AC Milan',/\bac milan\b/i],
];

export function detectTeam(headline,scopeMode='all_teams_for_day',requestedTeam=''){
  if(scopeMode==='specific_team')return cleanText(requestedTeam).slice(0,120);
  return teamMatchers.find(([,pattern])=>pattern.test(headline))?.[0]||'ฟุตบอลต่างประเทศ';
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

export function parseNewsRss(xml,{newsDate,scopeMode='all_teams_for_day',teamName='',limit=24,retrievedAt=new Date().toISOString()}={}){
  const seen=new Set(),stories=[];
  for(const match of String(xml||'').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
    const item=match[1],headline=cleanText(firstTag(item,'title')).slice(0,500),publisher=cleanText(firstTag(item,'source')).slice(0,180),sourceUrl=normalizeNewsSourceUrl(firstTag(item,'link')),publishedRaw=cleanText(firstTag(item,'pubDate')),publishedDay=isoDay(publishedRaw);
    if(!headline||!publisher||!/^https:\/\//i.test(sourceUrl)||publishedDay!==newsDate)continue;
    if(scopeMode==='specific_team'&&teamName&&!headline.toLocaleLowerCase('en').includes(cleanText(teamName).toLocaleLowerCase('en').replace(/\s+fc$/,'')))continue;
    const story={headline,summary:stripHtml(firstTag(item,'description')).slice(0,1600),team_name:detectTeam(headline,scopeMode,teamName),publisher,source_url:sourceUrl,published_at:new Date(publishedRaw).toISOString(),retrieved_at:retrievedAt};
    story.fingerprint=storyFingerprint(story);
    if(seen.has(story.fingerprint))continue;seen.add(story.fingerprint);stories.push(story);
  }
  stories.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  return scopeMode==='all_teams_for_day'?balanceStories(stories,{limit,maxPerTeam:3}):stories.slice(0,limit);
}

export function newsRssUrl(newsDate,scopeMode='all_teams_for_day',teamName=''){
  const start=new Date(`${newsDate}T00:00:00Z`);if(Number.isNaN(start.valueOf()))throw new Error('INVALID_NEWS_DATE');
  const next=new Date(start.valueOf()+86400000).toISOString().slice(0,10),subject=scopeMode==='specific_team'?`"${cleanText(teamName).slice(0,120)}" football`:'football (Premier League OR Champions League OR transfer OR manager OR player)';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${subject} after:${newsDate} before:${next}`)}&hl=en-GB&gl=GB&ceid=GB:en`;
}

export function bingNewsRssUrl(newsDate,scopeMode='all_teams_for_day',teamName=''){
  const start=new Date(`${newsDate}T00:00:00Z`);if(Number.isNaN(start.valueOf()))throw new Error('INVALID_NEWS_DATE');
  const subject=scopeMode==='specific_team'?`"${cleanText(teamName).slice(0,120)}" football`:'football (Premier League OR Champions League OR transfer OR manager OR player)',params=new URLSearchParams({q:`${subject} ${newsDate}`,format:'rss',setlang:'en-GB',qft:'sortbydate="1"'});
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

export function extractImageUrls(html,baseUrl,limit=12){
  const found=[];
  const add=value=>{try{const url=new URL(decodeXml(value),baseUrl).href;if(isSafeRemoteUrl(url)&&!found.includes(url))found.push(url)}catch{}};
  for(const pattern of [/<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*>/gi,/<img[^>]+src=["']([^"']+)["'][^>]*>/gi]){
    for(const match of String(html||'').matchAll(pattern)){add(match[1]);if(found.length>=limit)return found}
  }
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
