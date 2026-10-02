import assert from 'node:assert/strict';
import {commonsSearchUrl,excludeStoryTeamsFromPeople,licensedCommonsImages,parsePersonSuggestions} from '../functions/_vsport-people.js';

const script='ข่าว Manchester City และ Mohamed Salah ทำประตู',stories=[{team_name:'Manchester City',headline:'Manchester City soccer update',summary:'Premier League football'}];
const suggestions=parsePersonSuggestions('[{"name":"Manchester City","search":"Manchester City"},{"name":"Mohamed Salah","search":"Mohamed Salah"}]',script);
assert.deepEqual(excludeStoryTeamsFromPeople(suggestions,script,stories).map(item=>item.name),['Mohamed Salah'],'selected-story team must not masquerade as a player');

const file=(title,license='CC0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',overrides={})=>({title:`File:${title}`,imageinfo:[{url:`https://upload.wikimedia.org/wikipedia/commons/${encodeURIComponent(title)}`,mime:'image/jpeg',width:1280,height:720,extmetadata:{LicenseShortName:{value:license},LicenseUrl:{value:licenseUrl},Copyrighted:{value:license==='Public domain'?'False':'True'},AttributionRequired:{value:license==='CC0'||license==='Public domain'?'false':'true'}},...overrides}]});
const portrait=file('Mohamed Salah 2020.jpg');
const older=file('Mohamed-Salah 2015.jpg');
const yearAdjacent=file('Mohamed Salah2018.jpg');
const pd=file('Mohamed Salah 2012.jpg','Public domain','');
const stadium=file('Mohamed Salah stadium.jpg');
const logo=file('Mohamed Salah logo.png');
const by=file('Mohamed Salah 2014.jpg','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/');
const bySa=file('Mohamed Salah 2017.jpg','CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/');
const forged=file('Mohamed Salah 2018.jpg','CC0','https://creativecommons.org.evil.test/publicdomain/zero/1.0/');
const missing=file('Mohamed Salah 2019.jpg','','');
const duplicate={...portrait,index:99};
const payload={query:{pages:[portrait,older,yearAdjacent,pd,stadium,logo,by,bySa,forged,missing,duplicate]}};
assert.deepEqual(licensedCommonsImages(payload,'Mohamed Salah',{person:true}).map(item=>item.title),[portrait.title,older.title,yearAdjacent.title,pd.title],'person search retains historical CC0/PD filenames with a year adjacent to the name, excluding stadium/logo/attribution-required or unverified rights');
assert.equal(licensedCommonsImages({query:{pages:[stadium]}},'Mohamed Salah',{person:false}).length,1,'non-person subject search retains existing behavior');
assert.deepEqual(licensedCommonsImages({query:{pages:[by,bySa,forged,missing]}},'Mohamed Salah',{person:true}),[],'attribution-required and uncertain rights cannot enter no-credit workflow');
assert.deepEqual(licensedCommonsImages({query:{pages:[]}},'Mohamed Salah',{person:true}),[],'zero-result provider remains empty');
assert.equal(new URL(commonsSearchUrl('Mohamed Salah',{offset:18})).searchParams.get('gsroffset'),'18');
console.log('PASS v0.20.153 team/person relevance and strict CC0/public-domain candidate filters');
