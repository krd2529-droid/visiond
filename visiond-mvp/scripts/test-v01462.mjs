import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');
const checks=[];
const check=(name,fn)=>{try{fn();checks.push([name,true]);console.log(`PASS ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL ${name}: ${error.message}`)}};

check('version v0.14.62 or newer',()=>assert.ok(Number(read('VERSION.txt').trim().split('.').pop())>=62));

check('document migration preserves a recognized legacy when archive differs',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'visiond-doc-safety-'));
  fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(root,'work-history/visiond'),{recursive:true});
  fs.copyFileSync('scripts/migrate-document-history.mjs',path.join(root,'scripts/migrate-document-history.mjs'));
  fs.writeFileSync(path.join(root,'original.md'),'important original\n');
  fs.writeFileSync(path.join(root,'archive.md'),'CORRUPT ARCHIVE\n');
  const digest=crypto.createHash('sha256').update(read(path.join(root,'original.md'))).digest('hex');
  fs.writeFileSync(path.join(root,'work-history/visiond/history-manifest.json'),JSON.stringify({files:[{legacy_root:'original.md',archive:'archive.md',accepted_legacy_sha256:[digest]}]}));
  const out=spawnSync(process.execPath,['scripts/migrate-document-history.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(out.status,0,out.stderr);
  assert.match(out.stdout,/PRESERVED original\.md/);
  const recovery=fs.readdirSync(path.join(root,'work-history/visiond/legacy-versions'));
  assert.equal(recovery.length,1);
  assert.equal(read(path.join(root,'work-history/visiond/legacy-versions',recovery[0])),'important original\n');
  assert.equal(read(path.join(root,'archive.md')),'CORRUPT ARCHIVE\n');
});

check('document migration only deletes byte-identical duplicate',()=>{
  const code=read('scripts/migrate-document-history.mjs');
  assert.match(code,/legacyHash === archiveHash/);
  assert.match(code,/PRESERVED/);
  assert.match(code,/renameSync/);
});

check('Vision 7 activation atomically enforces active device limit',()=>{
  const code=read('functions/api/vision7/activate.js');
  assert.match(code,/SELECT COUNT\(\*\) FROM vision7_license_devices WHERE license_id=\? AND revoked_at IS NULL\)<\?/);
  assert.match(code,/if\(!saved\.meta\?\.changes\)return json\(\{error:`ครบ/);
  assert.match(code,/known\.revoked_at\?'reactivated':'checked'/);
});

check('Meta webhook reclaims stale processing reservation',()=>{
  const code=read('functions/_meta_messenger.js');
  assert.match(code,/status='processing' AND elon_page_webhook_events\.last_attempt_at<datetime\('now','-5 minutes'\)/);
});

check('unused vulnerable legacy account renderer removed',()=>{
  assert.equal(fs.existsSync('public/account.js'),false);
  const references=fs.readdirSync('public').filter(x=>x.endsWith('.html')).filter(file=>read(`public/${file}`).includes('/account.js'));
  assert.deepEqual(references,[]);
});

check('patch ledgers are continuous from v0.14.54',()=>{
  for(let n=54;n<=62;n++)assert.ok(fs.existsSync(`patch-ledgers/v0.14.${n}.json`),`missing v0.14.${n}`);
  assert.match(read('scripts/requirement-layer2-recheck.mjs'),/Patch Ledger หลุดจากลำดับ/);
});

check('temporary admin artifact removed',()=>assert.equal(fs.existsSync('public/admin.html.tmp'),false));

const failed=checks.filter(([,ok])=>!ok).length;
console.log(`v0.14.62 RESULT: total=${checks.length} passed=${checks.length-failed} failed=${failed}`);
if(failed)process.exit(1);
