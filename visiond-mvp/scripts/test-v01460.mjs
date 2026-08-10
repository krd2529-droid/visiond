import fs from 'node:fs';
import crypto from 'node:crypto';

const manifestPath = 'work-history/visiond/history-manifest.json';
let failed = 0;
const pass = message => console.log(`PASS ${message}`);
const fail = message => { failed++; console.error(`FAIL ${message}`); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (!fs.existsSync('START-HERE.md')) fail('missing START-HERE.md'); else pass('START-HERE.md exists');
if (!fs.existsSync(manifestPath)) fail('missing history manifest');
else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const item of manifest.files) {
    if (!fs.existsSync(item.source)) { fail(`missing source ${item.source}`); continue; }
    if (!fs.existsSync(item.archive)) { fail(`missing archive ${item.archive}`); continue; }
    if (hash(item.source) !== hash(item.archive)) fail(`content mismatch ${item.source}`);
    else pass(`${item.source} -> ${item.archive}`);
  }
}

if (failed) process.exit(1);
console.log('v0.14.60 document history Phase 1 passed');
