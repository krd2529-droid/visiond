import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify, createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporary = mkdtempSync(join(tmpdir(), 'vrecord-sign-'));
try {
  const root = join(temporary, 'customer'); mkdirSync(join(root, 'tools'), { recursive: true });
  for (const name of ['V-Record.exe', 'V-Record.Updater.exe', 'tools/ffmpeg.exe']) writeFileSync(join(root, name), Buffer.alloc(10001, name.length));
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const xml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
  const publicPath = join(temporary, 'public.xml'); writeFileSync(publicPath, xml);
  const secret = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const command = resolve('scripts/sign-vrecord-package-stdin.mjs');
  const signed = spawnSync(process.execPath, [command, root, publicPath, '0.6.0'], { input: secret, encoding: 'utf8' });
  assert.equal(signed.status, 0, signed.stdout + signed.stderr);
  assert.ok(!signed.stdout.includes(secret.slice(0, 20)) && !signed.stderr.includes(secret.slice(0, 20)), 'no private material logged');
  const envelope = JSON.parse(readFileSync(join(root, 'package-manifest.json'), 'utf8'));
  const payload = Buffer.from(envelope.payload, 'base64'), data = JSON.parse(payload.toString('utf8'));
  assert.equal(data.product, 'v-record-package'); assert.equal(data.version, '0.6.0');
  assert.equal(createVerify('RSA-SHA256').update(payload).end().verify(pair.publicKey, Buffer.from(envelope.signature, 'base64')), true);
  assert.equal(data.files['tools/ffmpeg.exe'], createHash('sha256').update(readFileSync(join(root, 'tools/ffmpeg.exe'))).digest('hex'));
  const again = spawnSync(process.execPath, [command, root, publicPath, '0.6.0'], { input: secret, encoding: 'utf8' });
  assert.notEqual(again.status, 0, 'refuses manifest overwrite');
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const root2 = join(temporary, 'other');mkdirSync(join(root2, 'tools'), { recursive: true });
  for (const name of ['V-Record.exe', 'V-Record.Updater.exe', 'tools/ffmpeg.exe']) writeFileSync(join(root2, name), Buffer.alloc(10001, name.length));
  const mismatch = spawnSync(process.execPath, [command, root2, publicPath, '0.6.0'], { input: other, encoding: 'utf8' });
  assert.notEqual(mismatch.status, 0);assert.equal(existsSync(join(root2, 'package-manifest.json')), false);
  console.log('V-Record stdin-only signer PASS');
} finally { rmSync(temporary, { recursive: true, force: true }); }
