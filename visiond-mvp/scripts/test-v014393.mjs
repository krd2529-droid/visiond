import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ensureDatabase} from '../functions/_schema.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.393');
assert.match(read('public/index.html'),/WEB v0\.14\.393/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.393/);

const calls=[];
const DB={prepare(sql){calls.push(sql);return {first:async()=>({version:65})}}};
await ensureDatabase({DB});
await ensureDatabase({DB});
assert.deepEqual(calls,["SELECT version FROM runtime_schema_state WHERE schema_key='core'"],'ready database must use one persistent probe per isolate');

const schema=read('functions/_schema.js');
assert.match(schema,/const RUNTIME_SCHEMA_VERSION=65/);
assert.ok(schema.indexOf('persistentSchemaReady(env)')<schema.indexOf('initializeDatabase(env)'));
assert.match(schema,/ON CONFLICT\(schema_key\) DO UPDATE SET version=excluded\.version/);
assert.ok(schema.lastIndexOf('runtime_schema_state')>schema.lastIndexOf("INSERT OR IGNORE INTO categories"),'marker must be written after legacy initialization');

const migration=read('migrations/0065_runtime_schema_state.sql');
assert.match(migration,/CREATE TABLE IF NOT EXISTS runtime_schema_state/);
assert.doesNotMatch(migration,/INSERT INTO runtime_schema_state/,'migration must not claim readiness before fallback initialization');
assert.match(read('FEATURE-MAP.md'),/SYSTEM-HEALTH-001[\s\S]*?runtime_schema_state\.schema_key\/version/);

console.log('PASS v0.14.393 persistent schema readiness');
