import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ensureVpageCreateSchema,vpageCreateSchemaStatements} from '../functions/_vpage-create-schema.js';
const sql=['0131_vpage_owner_assets','0132_vpage_create_drafts'].flatMap(name=>readFileSync(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8').match(/CREATE (?:TABLE|INDEX)[\s\S]*?;|CREATE TRIGGER[\s\S]*?END;/g));
assert.deepEqual(vpageCreateSchemaStatements,sql,'runtime installer exactly matches frozen migrations');
function fixture(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;CREATE TABLE users(id INTEGER PRIMARY KEY)');const calls={reads:0,batches:0};const DB={prepare(sql){const bound=args=>({bind(...values){return bound(values)},async all(){calls.reads++;return{results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}});return bound([])},async batch(statements){calls.batches++;db.exec('BEGIN');try{for(const statement of statements)await statement.run();db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}}};return{db,calls,DB}}
const f=fixture();await Promise.all(Array.from({length:8},()=>ensureVpageCreateSchema({DB:f.DB})));assert.equal(f.calls.batches,1);assert.equal(f.calls.reads,2);await ensureVpageCreateSchema({DB:f.DB});assert.equal(f.calls.reads,2,'ready database performs no repeated metadata reads');
const copied={...f.DB};await ensureVpageCreateSchema({DB:copied});assert.equal(f.calls.batches,1,'fresh isolate with existing schema makes no DDL writes');
f.db.exec('DROP TRIGGER vpage_create_draft_ref_ready');await ensureVpageCreateSchema({DB:{...f.DB}});assert.equal(f.calls.batches,2,'partial schema is repaired');
f.db.exec('DROP TRIGGER vpage_create_draft_ref_ready;CREATE TRIGGER vpage_create_draft_ref_ready BEFORE INSERT ON vpage_create_draft_refs BEGIN SELECT 1; END');
const retry={...f.DB};await assert.rejects(ensureVpageCreateSchema({DB:retry}),/SCHEMA_INVALID/);f.db.exec('DROP TRIGGER vpage_create_draft_ref_ready');await ensureVpageCreateSchema({DB:retry});
const broken=fixture();broken.db.exec('CREATE TABLE vpage_owner_assets(id TEXT PRIMARY KEY)');await assert.rejects(ensureVpageCreateSchema({DB:broken.DB}),/SCHEMA_INVALID/);assert.equal(broken.calls.batches,0);
console.log('PASS create schema exact migration parity, fresh install, coalescing, no repeated queries, partial repair and malformed schema retry');
