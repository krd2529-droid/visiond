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
    if (!fs.existsSync(item.archive)) { fail(`missing archive ${item.archive}`); continue; }
    const source = item.source || item.legacy_root;
    if (source && fs.existsSync(source)) {
      const accepted = new Set([hash(item.archive), ...(item.accepted_legacy_sha256 || [])]);
      if (!accepted.has(hash(source))) fail(`unrecognized legacy content ${source}`);
      else pass(`${source} is safely archived`);
    } else pass(`${item.archive} exists`);
  }
}

if (failed) process.exit(1);
console.log('v0.14.60 document history Phase 1 passed');
