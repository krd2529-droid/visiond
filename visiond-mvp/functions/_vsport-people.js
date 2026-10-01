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
  for(const item of parsed){const name=String(item?.name||'').trim(),search=String(item?.search||'').trim();if(!nameInScript(script,name)||!search||search.length>100||seen.has(name))continue;seen.add(name);people.push({name,search,offset:script.indexOf(name)});if(people.length===MAX_SUGGESTIONS)break}
  return people.sort((a,b)=>a.offset-b.offset);
}
export function mergeManualPeople(people,manual,script){
  const result=[],seen=new Set();for(const raw of String(manual||'').split(/[\n,]/u)){const [left,right]=raw.split('|'),name=String(left||'').trim(),search=String(right||name).trim();if(!nameInScript(script,name)||!search||search.length>100||seen.has(name))continue;seen.add(name);result.push({name,search,offset:script.indexOf(name)});if(result.length===MAX_SUGGESTIONS)break}for(const person of people){if(result.length===MAX_SUGGESTIONS)break;if(!seen.has(person.name)){seen.add(person.name);result.push(person)}}return result.sort((a,b)=>a.offset-b.offset);
}
export function commonsSearchUrl(search,{offset=0,cc0=false}={}){const url=new URL('https://commons.wikimedia.org/w/api.php');for(const [key,value] of Object.entries({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:`"${search.replace(/["\[\]{}|<>]/gu,'').slice(0,100)}"${cc0?' haswbstatement:P275=Q6938433':''}`,gsrnamespace:'6',gsrlimit:'18',gsroffset:String(offset),prop:'imageinfo',iiprop:'url|mime|size|thumbmime|extmetadata',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Copyrighted|AttributionRequired',iiurlwidth:'1280'}))url.searchParams.set(key,value);return url.href}
export function licensedCommonsImages(payload,search=''){
  const result=[],seen=new Set(),terms=String(search).toLocaleLowerCase('en').split(/\s+/u).filter(Boolean),pages=[...(payload?.query?.pages||[])].sort((a,b)=>Number(a.index??999)-Number(b.index??999));for(const page of pages){const info=page?.imageinfo?.[0],meta=info?.extmetadata||{},license=String(meta.LicenseShortName?.value||'').trim(),licenseUrl=String(meta.LicenseUrl?.value||'').trim(),copyrighted=String(meta.Copyrighted?.value||'').trim().toLowerCase(),required=String(meta.AttributionRequired?.value||'').trim().toLowerCase(),allowed=license==='CC0'&&/^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0(?:\/|\/deed\.en)?$/u.test(licenseUrl)||license==='Public domain'&&copyrighted==='false',url=String(info?.thumburl||info?.url||''),title=String(page?.title||''),lower=title.toLocaleLowerCase('en');if(!allowed||required==='true'||!['image/jpeg','image/png','image/webp'].includes(info?.thumbmime||info?.mime)||Number(info?.width)<320||Number(info?.height)<180||!/^https:\/\/upload\.wikimedia\.org\//u.test(url)||!/^File:/u.test(title)||terms.some(term=>!lower.includes(term))||/\b(?:mosque|masjid|sayadi|building)\b/iu.test(title)||seen.has(url))continue;seen.add(url);result.push({url,pageUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /gu,'_'))}`,license,title});if(result.length===5)break}return result;
}
