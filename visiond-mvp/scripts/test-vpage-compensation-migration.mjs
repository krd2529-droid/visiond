import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {applyMigration} from './apply-vpage-compensation-migration.mjs';

const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE vpage_pages(id TEXT PRIMARY KEY);CREATE TABLE users(id INTEGER PRIMARY KEY)");
const sql=readFileSync(new URL('../services/vpage/migrations/0005_vpage_compensation.sql',import.meta.url),'utf8');
const run=args=>{if(args[0]==='--file'){db.exec(sql);return[]}return db.prepare(args[1]).all()};
applyMigration(run);applyMigration(run);
assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='vpage_compensation_requests'").get());
assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='vpage_compensation_guards'").get());
assert.throws(()=>applyMigration(args=>args[0]==='--file'?[]:args[1].includes('vpage_compensation_guards')?[]:run(args)),/schema verification failed/);
console.log('PASS Worker compensation migration idempotence and fail-closed verification');
