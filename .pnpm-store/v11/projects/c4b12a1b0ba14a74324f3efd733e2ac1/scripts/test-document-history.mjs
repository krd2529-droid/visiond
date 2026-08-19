import fs from 'node:fs';

const manifestPath = 'work-history/visiond/history-manifest.json';
let failed = 0;
const pass = message => console.log(`PASS ${message}`);
const fail = message => { failed++; console.error(`FAIL ${message}`); };

for (const file of ['START-HERE.md', 'VERSION.txt', manifestPath]) {
  fs.existsSync(file) ? pass(`${file} exists`) : fail(`${file} missing`);
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.files)) fail('manifest files is not an array');
  else {
    for (const item of manifest.files) {
      if (!fs.existsSync(item.archive)) fail(`archive missing ${item.archive}`);
    }
    pass(`manifest archives available: ${manifest.files.length}`);
  }
}

const start = fs.readFileSync('START-HERE.md', 'utf8');
const version = fs.readFileSync('VERSION.txt', 'utf8').trim();
const documentedVersion = start.match(/เวอร์ชันปัจจุบัน:\s*\*\*([^*]+)\*\*/)?.[1];
const latestLedger = start.match(/Patch ledgerล่าสุด:\s*`([^`]+)`/)?.[1];

documentedVersion === version
  ? pass(`START-HERE version matches ${version}`)
  : fail(`START-HERE version does not match ${version}`);
latestLedger && fs.existsSync(latestLedger)
  ? pass(`START-HERE points to ${latestLedger}`)
  : fail('START-HERE does not point to an existing latest ledger');

if (failed) process.exit(1);
console.log('Current document history contract passed');
