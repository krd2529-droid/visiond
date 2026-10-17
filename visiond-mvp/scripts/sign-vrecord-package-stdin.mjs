import { createPrivateKey, createPublicKey, createHash, createSign } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [customerArg, publicArg, version] = process.argv.slice(2);
if (!customerArg || !publicArg || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version || '')) throw new Error('Usage: node sign-vrecord-package-stdin.mjs <customer-dir> <public-key.xml> <version> < private-key-input');
const root = resolve(customerArg), publicPath = resolve(publicArg), manifest = join(root, 'package-manifest.json');
if (existsSync(manifest)) throw new Error('Package manifest already exists; use a new unsigned build');
const publicXml = readFileSync(publicPath, 'utf8').trim();
let privateInput = Buffer.alloc(0);
for await (const chunk of process.stdin) {
  if (privateInput.length + chunk.length > 8192) throw new Error('Signing input too large');
  privateInput = Buffer.concat([privateInput, chunk]);
}
let privateKey;
try {
  const text = privateInput.toString('utf8').trim();
  privateKey = text.startsWith('-----BEGIN')
    ? createPrivateKey(text)
    : createPrivateKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'pkcs8' });
} catch { throw new Error('Private signing key invalid'); }
finally { privateInput.fill(0); }
const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
const derivedXml = `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
if (derivedXml !== publicXml) throw new Error('Signing key does not match the reviewed public XML');
if (existsSync(join(root, 'tools', 'ffmpeg.exe'))) throw new Error('Do not sign a package containing a vendor FFmpeg executable');
const files = {};
for (const name of ['V-Record.exe', 'V-Record.Updater.exe', 'Install-FFmpeg.ps1', 'README.txt']) {
  const file = join(root, name), info = statSync(file);
  if (!info.isFile() || info.size < (name.endsWith('.exe') ? 10000 : 100) || info.size > 200 * 1024 * 1024) throw new Error(`Invalid package component: ${name}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  files[name] = hash.digest('hex');
}
const payload = Buffer.from(JSON.stringify({ v: 1, product: 'v-record-package', version, files }));
const signature = createSign('RSA-SHA256').update(payload).end().sign(privateKey);
writeFileSync(manifest, JSON.stringify({ payload: payload.toString('base64'), signature: signature.toString('base64') }, null, 2), { flag: 'wx' });
console.log('Signed V-Record package manifest with reviewed public key.');
