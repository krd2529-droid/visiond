import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../functions/api/admin/vision7/releases.js';

const apk=await readFile(new URL('../../sms-mix-app/app/build/outputs/apk/release/VSMS-v0.5.10-release.apk',import.meta.url));
const expected='9d545f3dc8d8be7dc5dc2fd41cee9f8be8a293740b1dc1869c328f7095caa547';
assert.equal(createHash('sha256').update(apk).digest('hex'),expected,'gate pins exact inspected signed APK');
let role='boss',current='0.5.8',minimum='0.5.4',force=0,old=true,badHead=false,ignoreAdvance=false;
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT NOT NULL,active INTEGER,current_version TEXT,minimum_version TEXT,force_update INTEGER,updated_at TEXT);
CREATE TABLE vision7_releases(id INTEGER PRIMARY KEY,program_id INTEGER,version TEXT,minimum_version TEXT,mandatory INTEGER,object_key TEXT UNIQUE,file_name TEXT,mime_type TEXT,file_size INTEGER,sha256 TEXT,release_notes TEXT,created_by INTEGER,status TEXT DEFAULT 'published',UNIQUE(program_id,version));
INSERT INTO vision7_programs VALUES(9,'sms-mix',1,'0.5.8','0.5.4',0,NULL);
INSERT INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes)
VALUES(9,'0.5.4','0.5.4',0,'old-054','old.apk','application/vnd.android.package-archive',40000,'old',''),
(9,'0.5.5','0.5.4',0,'old-055','old.apk','application/vnd.android.package-archive',54952,'old',''),
(9,'0.5.6','0.5.4',0,'old-056','old.apk','application/vnd.android.package-archive',58104,'old',''),
(9,'0.5.7','0.5.4',0,'old-057','old.apk','application/vnd.android.package-archive',58140,'old',''),
(9,'0.5.8','0.5.4',0,'old-058','old.apk','application/vnd.android.package-archive',62784,'old','');`);
const objects=new Map([['old-054',{size:40000}],['old-055',{size:54952}],['old-056',{size:58104}],['old-057',{size:58140}],['old-058',{size:62784}]]);
const db={
  prepare(sql){const query={sql,args:[]};return{
    bind(...args){query.args=args;return this;},
    async first(){
      if(sql.includes('runtime_schema_state'))return{version:999999};
      if(sql.includes('FROM sessions'))return{id:8,role};
      if(sql.includes('SELECT id,code,active,current_version'))return{id:9,code:'sms-mix',active:1,current_version:current,minimum_version:minimum,force_update:force};
      if(sql.includes('SELECT id FROM vision7_releases WHERE'))return old?sqlite.prepare(sql).get(...query.args)||null:null;
      return sqlite.prepare(sql).get(...query.args)||null;
    },
    async all(){return{results:[]};},async run(){return{meta:{changes:0}};},get __query(){return query;}
  };},
  async batch(statements){
    assert.equal(statements.length,3);
    assert.deepEqual(statements[0].__query.args.slice(0,4),[9,'0.5.10','0.5.4',0]);
    assert.equal(statements[0].__query.args[8],expected);
    sqlite.exec('BEGIN');
    try{
      const results=statements.map((statement,index)=>{
        const {sql,args}=statement.__query;
        if(index===1&&ignoreAdvance)return{meta:{changes:0}};
        const x=sqlite.prepare(sql).run(...args);return{meta:{changes:x.changes,last_row_id:Number(x.lastInsertRowid)}};
      });
      sqlite.exec('COMMIT');current=sqlite.prepare('SELECT current_version FROM vision7_programs WHERE id=9').get().current_version;
      return results;
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
};
const env={DB:db,FILES:{
  async put(key,bytes,options){objects.set(key,{size:bytes.byteLength,customMetadata:options.customMetadata});},
  async head(key){const x=objects.get(key);return badHead&&x?{...x,size:x.size-1}:x;},
  async delete(key){objects.delete(key);}
}};
function context({version='0.5.10',minimum_version='0.5.4',mandatory=false,bytes=apk,name='VSMS-v0.5.10-release.apk'}={}){
  const form=new FormData();form.set('program_id','9');form.set('version',version);form.set('minimum_version',minimum_version);
  if(mandatory)form.set('mandatory','1');
  form.set('file',new File([bytes],name,{type:'application/vnd.android.package-archive'}));
  return{env,request:new Request('https://visiondonline.com/api/admin/vision7/releases',{method:'POST',headers:{cookie:'vd_session=test'},body:form})};
}
const status=async options=>(await onRequestPost(context(options))).status;
role='admin';assert.equal(await status(),403);role='boss';
assert.equal(await status({version:'0.5.8'}),409);
assert.equal(await status({version:'0.5.9'}),409,'unpublished buggy 0.5.9 cannot be published');
assert.equal(await status({version:'0.5.11'}),409);
assert.equal(await status({minimum_version:'0.5.5'}),409);
assert.equal(await status({mandatory:true}),409);
assert.equal(await status({name:'wrong.zip'}),409);
const altered=Buffer.from(apk);altered[100]^=1;assert.equal(await status({bytes:altered}),409);
minimum='0.5.5';assert.equal(await status(),409);minimum='0.5.4';
force=1;assert.equal(await status(),409);force=0;
current='0.5.9';assert.equal(await status(),409,'0.5.9 is not a required intermediate release');current='0.5.8';
old=false;assert.equal(await status(),409);old=true;
assert.equal(objects.size,5);
badHead=true;assert.equal(await status(),502);badHead=false;
assert.equal(objects.size,5);
ignoreAdvance=true;assert.equal(await status(),409,'partial program no-op rolls batch back');ignoreAdvance=false;
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_releases').get().n,5);
assert.equal(objects.size,5);
const response=await onRequestPost(context());assert.equal(response.status,201);
assert.equal((await response.json()).sha256,expected);
assert.equal(current,'0.5.10');assert.equal(minimum,'0.5.4');assert.equal(force,0);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_releases').get().n,6,'0.5.4–0.5.8 releases preserved');
assert.ok(['old-054','old-055','old-056','old-057','old-058'].every(key=>objects.has(key)));
assert.equal(await status(),409,'no second 0.5.10 upload');
console.log('VSMS 0.5.10 direct 0.5.8 upgrade pinned signed release PASS');
