import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const forgot=read('functions/api/auth/forgot-password.js');
const reset=read('functions/api/auth/reset-password.js');
const email=read('functions/_password-reset-email.js');
assert.match(forgot,/rateLimitIdentity/);
assert.match(forgot,/account not disclosed/);
assert.match(reset,/used_at IS NULL AND expires_at>datetime\('now'\)/);
assert.match(reset,/DELETE FROM sessions WHERE user_id/);
assert.match(email,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
assert.match(email,/reset-password\.html#token=/);

const trash=read('functions/api/admin/trash/index.js');
const categories=read('functions/api/admin/categories/[id].js');
assert.match(trash,/onRequestDelete[\s\S]*requireBoss/);
assert.match(categories,/onRequestDelete[\s\S]*requireBoss/);
assert.match(read('public/admin.js'),/พิมพ์ DELETE/);

const analytics=read('functions/_analytics.js');
const retention=read('functions/api/internal/analytics-retention.js');
assert.match(analytics,/analytics_daily/);
assert.match(retention,/ANALYTICS_CLEANUP_TOKEN/);
assert.match(retention,/Bearer/);

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE products(id INTEGER PRIMARY KEY);');
db.exec(read('migrations/0012_password_reset_analytics_retention.sql'));
for(const table of ['password_reset_tokens','page_views','analytics_daily','analytics_visitors']){
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)?.['1'],1);
}

console.log('PASS v0.14.31 password recovery, retention migration, and Boss danger guards');
