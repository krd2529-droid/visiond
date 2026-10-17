import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { vRecordActivation } from '../functions/_vrecord_activation.js';
import { hashLicenseKey } from '../functions/_vision7.js';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,active INTEGER);
CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,key_hash TEXT,status TEXT,expires_at TEXT,source TEXT,order_id INTEGER,max_devices INTEGER,program_id INTEGER);
CREATE TABLE vision7_trial_entitlements(license_id TEXT);
CREATE TABLE vision7_license_devices(license_id TEXT,device_hash TEXT,device_name TEXT,platform TEXT,app_version TEXT,revoked_at TEXT,last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(license_id,device_hash));
INSERT INTO orders VALUES(1,'paid'); INSERT INTO vision7_programs VALUES(1,'v-record',1),(2,'another-app',1);`);
const DB = { prepare(sql) { const statement = db.prepare(sql); return { bind(...args) { return { first: async () => statement.get(...args), run: async () => ({ meta: { changes: statement.run(...args).changes } }) }; } }; } };
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const privateDer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const secret = Buffer.from(privateDer).toString('base64');
const key = 'VD7-TEST-PURCHASE-KEY-123456789', device = 'a'.repeat(64), otherDevice = 'b'.repeat(64);
const expires = new Date(Date.now() + 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
db.prepare('INSERT INTO vision7_licenses VALUES(?,?,?,?,?,?,?,?)').run('paid-key', await hashLicenseKey(key), 'active', expires, 'paid_order', 1, 1, 1);
const call = async (licenseKey = key, deviceId = device, refresh = false, signing = secret) => vRecordActivation({
  env: { DB, VRECORD_LICENSE_SIGNING_PKCS8: signing },
  request: new Request('https://visiondonline.com/api/activate', { method: 'POST', body: JSON.stringify({ licenseKey, deviceId }) }),
}, refresh);
assert.equal((await call(key, device, false, '')).status, 503, 'missing signer fails before device bind');
assert.equal(db.prepare('SELECT COUNT(*) n FROM vision7_license_devices').get().n, 0);
assert.equal((await call(key, device, true)).status, 403, 'refresh cannot bind new device');
const activated = await call();
assert.equal(activated.status, 200);
assert.equal(activated.headers.get('cache-control'), 'private, no-store');
const token = await activated.json(), bytes = Buffer.from(token.payload, 'base64');
assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(token.signature, 'base64'), bytes), true);
const claims = JSON.parse(bytes.toString('utf8'));
assert.equal(claims.product, 'v-record'); assert.equal(claims.deviceId, device);
assert.ok(claims.leaseUntil <= claims.expiresAt && claims.leaseUntil <= claims.issuedAt + 7 * 86400);
const temporary = mkdtempSync(join(tmpdir(), 'vrecord-lease-'));
try {
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const xml = `<RSAKeyValue><Modulus>${Buffer.from(publicJwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(publicJwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
  const publicPath = join(temporary, 'public.xml'), tokenPath = join(temporary, 'token.json'), executable = join(temporary, 'verify.exe');
  writeFileSync(publicPath, xml); writeFileSync(tokenPath, JSON.stringify(token));
  const csc = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const source = resolve('../.agents/incoming-vrecord/V-Record-Handoff/Licensing.cs');
  const build = spawnSync(csc, ['/nologo', `/out:${executable}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', '/reference:System.Security.dll', resolve('scripts/VRecordLeaseVerify.cs'), source], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const verify = spawnSync(executable, [publicPath, tokenPath, device], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
  assert.equal(spawnSync(executable, [publicPath, tokenPath, otherDevice], { encoding: 'utf8' }).status, 1, 'C# rejects wrong device');
  if (process.env.VRECORD_DPAPI_SMOKE === '1') {
  const clientExecutable = join(temporary, 'client.exe');
  const clientBuild = spawnSync(csc, ['/nologo', `/out:${clientExecutable}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', '/reference:System.Security.dll', resolve('scripts/VRecordClientSmoke.cs'), source], { encoding: 'utf8' });
  assert.equal(clientBuild.status, 0, clientBuild.stdout + clientBuild.stderr);
  const server = http.createServer(async (incoming, outgoing) => {
    let body = ''; for await (const chunk of incoming) body += chunk;
    const response = await vRecordActivation({ env: { DB, VRECORD_LICENSE_SIGNING_PKCS8: secret }, request: new Request(`http://127.0.0.1${incoming.url}`, { method: 'POST', body }) }, incoming.url === '/api/validate');
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(await response.text());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await new Promise(resolve => { const child = spawn(clientExecutable, [publicPath, `http://127.0.0.1:${server.address().port}`, device, join(temporary, 'cache.dat'), key], { windowsHide: true });let output='';child.stdout.on('data', chunk => output += chunk);child.stderr.on('data', chunk => output += chunk);child.on('close', code => resolve({ code, output })); });
    assert.equal(result.code, 0, result.output);
  } finally { server.close(); }
  } else console.log('C# HTTP/DPAPI smoke skipped in restricted user-profile sandbox; run with VRECORD_DPAPI_SMOKE=1 on trusted host');
} finally { rmSync(temporary, { recursive: true, force: true }); }
assert.equal((await call(key, device, true)).status, 200, 'bound device refreshes');
assert.equal((await call(key, otherDevice)).status, 409, 'second device rejected');
assert.equal((await call('VD7-INVALID-KEY-123456789')).status, 403);
db.prepare("UPDATE orders SET status='refunded' WHERE id=1").run();
assert.equal((await call(key, device, true)).status, 403, 'refunded order denies online refresh');
db.prepare("UPDATE orders SET status='paid' WHERE id=1").run();
db.prepare("UPDATE vision7_licenses SET status='revoked' WHERE id='paid-key'").run();
assert.equal((await call(key, device, true)).status, 403, 'revoked license denied');
db.prepare("UPDATE vision7_licenses SET status='active',expires_at='2000-01-01 00:00:00' WHERE id='paid-key'").run();
assert.equal((await call(key, device, true)).status, 410, 'expired license denied');
db.prepare('INSERT INTO vision7_licenses VALUES(?,?,?,?,?,?,?,?)').run('other-key', await hashLicenseKey('VD7-OTHER-APP-KEY-123456789'), 'active', expires, 'paid_order', 1, 1, 2);
assert.equal((await call('VD7-OTHER-APP-KEY-123456789')).status, 403, 'other program key rejected');
db.close();
console.log('V-Record signed Vision7 activation PASS');
