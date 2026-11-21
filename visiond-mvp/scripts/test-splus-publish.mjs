import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ensureDatabase} from '../functions/_schema.js';
import {ensureVision7Schema} from '../functions/_vision7_schema.js';

const temp=mkdtempSync(join(tmpdir(),'splus-publish-test-'));
try{
  const setup=join(temp,'SPlus-Setup-1.0.0.exe'),sqlFile=join(temp,'publish.sql');
  writeFileSync(setup,Buffer.alloc(1000001,7));
  const generated=spawnSync(process.execPath,[fileURLToPath(new URL('./prepare-splus-publish.mjs',import.meta.url)),setup,sqlFile],{encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr);
  const metadata=JSON.parse(generated.stdout),sql=readFileSync(sqlFile,'utf8');
  assert.equal(metadata.size,1000001);assert.ok(sql.includes(metadata.sha256));
  const db=new DatabaseSync(':memory:');
  const prepare=(query,args=[])=>({bind(...values){return prepare(query,values)},async first(){return db.prepare(query).get(...args)||null},async all(){return {results:db.prepare(query).all(...args)}},async run(){const r=db.prepare(query).run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}});
  const env={DB:{prepare}};await ensureDatabase(env);await ensureVision7Schema(env);
  db.exec(readFileSync(new URL('../migrations/0148_splus_draft.sql',import.meta.url),'utf8'));
  db.exec("UPDATE vision7_plans SET offer_price=1 WHERE plan_code='accounts30'");
  db.exec(sql);
  assert.equal(db.prepare("SELECT active FROM vision7_programs WHERE code='splus'").get().active,0,'mismatched price keeps draft');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vision7_releases').get().n,0);
  db.exec("UPDATE vision7_plans SET offer_price=99000 WHERE plan_code='accounts30'");
  db.exec(sql);db.exec(sql);
  assert.equal(db.prepare("SELECT active FROM vision7_programs WHERE code='splus'").get().active,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vision7_releases').get().n,1,'idempotent release');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE slug LIKE 'vbot-key-splus-%' AND status='published'").get().n,3);
  console.log('S+ guarded publish SQL draft, price mismatch and idempotency passed');
}finally{rmSync(temp,{recursive:true,force:true})}
