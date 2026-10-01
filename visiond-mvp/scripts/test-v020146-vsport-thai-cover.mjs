import assert from 'node:assert/strict';
import {prepareThaiThumbnailHeadline} from '../functions/api/admin/vsport.js';

const story={id:1,headline:'Germany vs Serbia: Predicted lineup and team news',summary:'Germany and Serbia are preparing for a football match.',sort_order:0,publisher:'Fixture Sport',source_url:'https://sports.example.test/soccer/germany-serbia'};
function fixture(saved='',sourceSelected=true){
  const project={id:146,scope_mode:'specific_team',thumbnail_headline:saved};
  let reads=0,writes=0;
  const env={DB:{prepare(sql){return{bind(...args){return{
    async all(){assert.match(sql,/FROM vsport_stories/);reads++;return{results:[story]}},
    async first(){if(sql.includes('FROM vsport_stories')){assert.match(sql,/headline=\? AND selected=1/);reads++;return sourceSelected&&args[1]===story.headline?story:null}assert.match(sql,/FROM vsport_projects/);return{...project}},
    async run(){assert.match(sql,/UPDATE vsport_projects/);writes++;if((project.thumbnail_headline||'')!==args[3])return{meta:{changes:0}};project.thumbnail_headline=args[0];return{meta:{changes:1}}},
  }}}}}};
  return{project,env,counts:()=>({reads,writes})};
}

const translated=fixture();let aiCalls=0;
const thai=await prepareThaiThumbnailHeadline(translated.env,translated.project,9,async(_env,prompt,options)=>{
  aiCalls++;assert.match(prompt,/Germany vs Serbia/);assert.match(prompt,/Fixture Sport/);assert.equal(options.deadlineMs,9000);return'เยอรมนีพบเซอร์เบีย: คาดการณ์ตัวจริงและข่าวทีม';
});
assert.equal(thai.headline,'เยอรมนีพบเซอร์เบีย: คาดการณ์ตัวจริงและข่าวทีม');
assert.equal(translated.project.thumbnail_headline,thai.headline);
assert.equal(aiCalls,1);
assert.deepEqual(translated.counts(),{reads:1,writes:1});
const reused=await prepareThaiThumbnailHeadline(translated.env,translated.project,9,async()=>{throw Error('must not call AI again')});
assert.equal(reused.reused,true);
assert.deepEqual(translated.counts(),{reads:1,writes:1});

const unavailable=fixture('Germany vs Serbia: Predicted lineup and team news');
const fallback=await prepareThaiThumbnailHeadline(unavailable.env,unavailable.project,9,async()=>{throw Error('AI unavailable')});
assert.equal(fallback.headline,'ข่าวฟุตบอลวันนี้');
assert.equal(fallback.requires_review,true);
assert.equal(unavailable.project.thumbnail_headline,'ข่าวฟุตบอลวันนี้');
assert.equal((await prepareThaiThumbnailHeadline(unavailable.env,unavailable.project,9,async()=>{throw Error('repeat')})).reused,true);

const invalid=fixture();
assert.equal((await prepareThaiThumbnailHeadline(invalid.env,invalid.project,9,async()=> 'Germany vs Serbia predicted lineup')).headline,'ข่าวฟุตบอลวันนี้','English-only model output cannot appear on cover');
const danglingMark=fixture();
assert.equal((await prepareThaiThumbnailHeadline(danglingMark.env,danglingMark.project,9,async()=> 'Germany vs Serbia ่')).headline,'ข่าวฟุตบอลวันนี้','a dangling Thai mark does not make English copy Thai');
const mixedLatin=fixture();
assert.equal((await prepareThaiThumbnailHeadline(mixedLatin.env,mixedLatin.project,9,async()=> 'Germany vs Serbia พบกัน')).headline,'ข่าวฟุตบอลวันนี้','automatic cover copy must be Thai-only');

const wrongSource=fixture('Arsenal vs Chelsea: team news');let wrongSourceAICalls=0;
const unrelated=await prepareThaiThumbnailHeadline(wrongSource.env,wrongSource.project,9,async()=>{wrongSourceAICalls++;return'เยอรมนีพบเซอร์เบีย'});
assert.equal(unrelated.headline,'ข่าวฟุตบอลวันนี้','unmatched saved story gets neutral Thai review copy');
assert.equal(unrelated.requires_review,true);
assert.equal(wrongSourceAICalls,0,'no unrelated story is sent to AI');

const deselected=fixture(story.headline,false);let deselectedAICalls=0;
const stale=await prepareThaiThumbnailHeadline(deselected.env,deselected.project,9,async()=>{deselectedAICalls++;return'เยอรมนีพบเซอร์เบีย'});
assert.equal(stale.headline,'ข่าวฟุตบอลวันนี้','deselected saved story does not drive current cover');
assert.equal(stale.requires_review,true);
assert.equal(deselectedAICalls,0,'deselected story is not sent to AI');

const concurrent=fixture();
const race=await prepareThaiThumbnailHeadline(concurrent.env,concurrent.project,9,async()=>{
  concurrent.project.thumbnail_headline='เยอรมนีพบเซอร์เบีย ข่าวทีมฉบับแก้เอง';
  return'พาดหัวจาก AI';
});
assert.equal(race.headline,'เยอรมนีพบเซอร์เบีย ข่าวทีมฉบับแก้เอง','compare-and-set retains editor copy');
assert.equal(concurrent.project.thumbnail_headline,race.headline);

console.log('PASS v0.20.146 Thai cover translation, fallback, reuse and editor race');
