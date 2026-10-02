// Search matches are suggestions, never proof that a pictured person is identified.
export const PEOPLE_BATCH=6,MAX_SUGGESTIONS=120;
const letter=/[\p{L}\p{N}]/u;
export function nameInScript(script,name){
  const text=String(script||''),needle=String(name||'').trim();if(!needle||needle.length>100)return false;
  if(/[ก-๙]/u.test(needle))return text.includes(needle);
  let from=0;while((from=text.indexOf(needle,from))!==-1){const before=text[from-1]||'',after=text[from+needle.length]||'';if(!letter.test(before)&&!letter.test(after))return true;from+=needle.length}return false;
}
export function parsePersonSuggestions(raw,script){
  let parsed;try{const match=String(raw||'').match(/\[[\s\S]*\]/u);parsed=JSON.parse(match?.[0]||'[]')}catch{return[]}
  if(!Array.isArray(parsed))return[];const seen=new Set(),people=[];
  const knownAliases={'mohamed salah':['โมฮาเหม็ด ซาลาห์','โมฮัมเหม็ด ซาลาห์'],'virgil van dijk':['เวอร์จิล ฟาน ไดค์'],'erling haaland':['เออร์ลิง ฮาลันด์','เออร์ลิง ฮาแลนด์'],'son heung-min':['ซน ฮึง มิน','ซน ฮึง-มิน']};
  for(const item of parsed){let name=String(item?.name||'').trim(),search=String(item?.search||'').trim();if(!nameInScript(script,name)){const candidates=[String(item?.script_span||'').trim(),String(item?.thai_name||'').trim(),...(knownAliases[name.toLowerCase()]||[])];name=candidates.find(span=>nameInScript(script,span))||''}if(!name||!search||search.length>100||seen.has(name))continue;seen.add(name);people.push({name,search,offset:script.indexOf(name)});if(people.length===MAX_SUGGESTIONS)break}
  return people.sort((a,b)=>a.offset-b.offset);
}
export function mergeManualPeople(people,manual,script){
  const result=[],seen=new Set();for(const raw of String(manual||'').split(/[\n,]/u)){const [left,right]=raw.split('|'),name=String(left||'').trim(),search=String(right||name).trim();if(!nameInScript(script,name)||!search||search.length>100||seen.has(name))continue;seen.add(name);result.push({name,search,offset:script.indexOf(name)});if(result.length===MAX_SUGGESTIONS)break}for(const person of people){if(result.length===MAX_SUGGESTIONS)break;if(!seen.has(person.name)){seen.add(person.name);result.push(person)}}return result.sort((a,b)=>a.offset-b.offset);
}
export function scriptTeamSubjects(script,stories=[]){
  const text=String(script||''),found=[],seen=new Set();
  const aliases={
    'Manchester City':['แมนเชสเตอร์ ซิตี้','แมนเชสเตอร์ซิตี้','แมนฯ ซิตี้','แมนซิตี้'],
    'Manchester United':['แมนเชสเตอร์ ยูไนเต็ด','แมนเชสเตอร์ยูไนเต็ด','แมนฯ ยูไนเต็ด','แมนยู'],
    'Liverpool':['ลิเวอร์พูล'],Arsenal:['อาร์เซนอล','อาร์เซน่อล'],Chelsea:['เชลซี'],Tottenham:['ท็อตแนม','สเปอร์ส'],
    'Real Madrid':['เรอัล มาดริด','รีล มาดริด'],Barcelona:['บาร์เซโลนา','บาร์เซโลน่า'],Bayern:['บาเยิร์น มิวนิค','บาเยิร์น'],
  };
  for(const story of stories){const team=String(story.team_name||'').trim();if(!team||seen.has(team))continue;const key=Object.keys(aliases).find(name=>team.toLowerCase().includes(name.toLowerCase()));const variants=[team,...(key?aliases[key]:[])];const matches=variants.filter(name=>nameInScript(text,name));if(!matches.length)continue;const name=matches.sort((a,b)=>text.indexOf(a)-text.indexOf(b))[0];seen.add(team);found.push({kind:'team',name,search:key||team,offset:text.indexOf(name)});if(found.length>=12)break}
  return found.sort((a,b)=>a.offset-b.offset);
}
export function excludeStoryTeamsFromPeople(people,script,stories=[]){
  const teams=scriptTeamSubjects(script,stories),names=new Set(teams.flatMap(team=>[team.name,team.search].map(value=>String(value).toLocaleLowerCase('en'))));
  return people.filter(person=>!names.has(String(person.name).toLocaleLowerCase('en'))&&!names.has(String(person.search).toLocaleLowerCase('en')));
}
export function scriptEventSubjects(script){
  const known=[['พรีเมียร์ลีก','Premier League'],['ยูฟ่าแชมเปียนส์ลีก','UEFA Champions League'],['แชมเปียนส์ลีก','UEFA Champions League'],['เอฟเอคัพ','FA Cup'],['ฟุตบอลโลก','FIFA World Cup'],['ยูโรปาลีก','UEFA Europa League']];
  const result=[],seen=new Set();for(const [name,search] of known)if(nameInScript(script,name)&&!seen.has(search)){seen.add(search);result.push({kind:'event',name,search,offset:String(script).indexOf(name)})}return result.sort((a,b)=>a.offset-b.offset).slice(0,6)
}
export function parseScriptSubjects(raw,script){
  let items;try{items=JSON.parse(String(raw||'').match(/\[[\s\S]*\]/u)?.[0]||'[]')}catch{return[]}
  if(!Array.isArray(items))return[];const result=[],seen=new Set();for(const item of items){const kind=item?.kind,name=String(item?.name||item?.script_span||'').trim(),search=String(item?.search||'').trim();if(!['event','topic'].includes(kind)||!nameInScript(script,name)||!search||search.length>100||seen.has(name))continue;seen.add(name);result.push({kind,name,search,offset:String(script).indexOf(name)});if(result.length===6)break}return result.sort((a,b)=>a.offset-b.offset)
}
export function commonsSearchUrl(search,{offset=0,cc0=false}={}){const url=new URL('https://commons.wikimedia.org/w/api.php');for(const [key,value] of Object.entries({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:`"${search.replace(/["\[\]{}|<>]/gu,'').slice(0,100)}"${cc0?' haswbstatement:P275=Q6938433':''}`,gsrnamespace:'6',gsrlimit:'18',gsroffset:String(offset),prop:'imageinfo',iiprop:'url|mime|size|thumbmime|extmetadata',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Copyrighted|AttributionRequired',iiurlwidth:'1280'}))url.searchParams.set(key,value);return url.href}
export function licensedCommonsImages(payload,search='',{person=false}={}){
  const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const terms=normalize(search).split(/\s+/u).filter(Boolean),pages=[...(payload?.query?.pages||[])].sort((a,b)=>Number(a.index??999)-Number(b.index??999)),result=[],seen=new Set();
  for(const page of pages){
    const info=page?.imageinfo?.[0],meta=info?.extmetadata||{},license=String(meta.LicenseShortName?.value||'').trim(),licenseUrl=String(meta.LicenseUrl?.value||'').trim(),copyrighted=String(meta.Copyrighted?.value||'').trim().toLowerCase(),required=String(meta.AttributionRequired?.value||'').trim().toLowerCase();
    const publicDomain=license==='CC0'&&/^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0(?:\/|\/deed\.en)?$/u.test(licenseUrl)||license==='Public domain'&&copyrighted==='false';
    const url=String(info?.thumburl||info?.url||''),title=String(page?.title||''),lower=normalize(title);
    if(!publicDomain||required==='true'||!['image/jpeg','image/png','image/webp'].includes(info?.thumbmime||info?.mime)||Number(info?.width)<320||Number(info?.height)<180||!/^https:\/\/upload\.wikimedia\.org\//u.test(url)||!/^File:/u.test(title)||terms.some(term=>!lower.includes(term))||/\b(?:mosque|masjid|sayadi|building)\b/iu.test(title)||person&&/\b(?:stadium|arena|logo|flag|shirt|kit|trophy|statue|poster)\b/iu.test(title)||seen.has(url))continue;
    seen.add(url);result.push({url,pageUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /gu,'_'))}`,license,title});if(result.length===5)break;
  }
  return result;
}
