import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const ignore = readFileSync(new URL('.gitignore', root), 'utf8');
assert.match(ignore, /^\/\.secrets\/$/m, 'release signing directory must be ignored');
const tracked = execFileSync('git', ['ls-files', '--cached', '--', '.secrets', 'sms-mix-app'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
assert.equal(tracked.some(path => path.startsWith('.secrets/') || /\.(?:jks|keystore|p12|pfx)$/i.test(path)), false, 'no VSMS signing material may be tracked');
const build = readFileSync(new URL('sms-mix-app/app/build.gradle', root), 'utf8');
for (const name of ['VSMS_RELEASE_STORE_FILE', 'VSMS_RELEASE_STORE_PASSWORD', 'VSMS_RELEASE_KEY_ALIAS', 'VSMS_RELEASE_KEY_PASSWORD']) assert.ok(build.includes(name));
console.log('VSMS signing material excluded from Git PASS');
