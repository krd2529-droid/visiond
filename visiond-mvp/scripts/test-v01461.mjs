import fs from 'node:fs';

const manifestPath = 'work-history/visiond/history-manifest.json';
let failed = 0;
const pass = message => console.log(`PASS ${message}`);
const fail = message => { failed++; console.error(`FAIL ${message}`); };

for (const file of ['START-HERE.md', manifestPath, 'scripts/migrate-document-history.mjs', 'APPLY-DOCUMENT-MIGRATION.cmd']) {
  fs.existsSync(file) ? pass(`${file} exists`) : fail(`${file} missing`);
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.phase !== 2) fail('manifest phase is not 2'); else pass('manifest phase 2');
  for (const item of manifest.files) {
    if (!fs.existsSync(item.archive)) fail(`archive missing ${item.archive}`);
    if (fs.existsSync(item.legacy_root)) fail(`legacy root still present ${item.legacy_root}`);
  }
}

const start = fs.readFileSync('START-HERE.md', 'utf8');
if (!start.includes('work-history/visiond/patch-history/PATCH-v0.14.61-DOCUMENT-HISTORY-PHASE2.md')) fail('START-HERE does not point to latest patch');
else pass('START-HERE points to v0.14.61');

if (failed) process.exit(1);
console.log('v0.14.61 document history Phase 2 passed');
