import fs from 'node:fs';
import crypto from 'node:crypto';

const manifestPath = 'work-history/visiond/history-manifest.json';
const dryRun = process.argv.includes('--dry-run');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (!fs.existsSync(manifestPath)) {
  console.error(`DOC MIGRATION FAIL: missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let removed = 0, skipped = 0, conflicts = 0;
for (const item of manifest.files) {
  if (!fs.existsSync(item.legacy_root)) { skipped++; continue; }
  if (!fs.existsSync(item.archive)) {
    conflicts++;
    console.error(`DOC MIGRATION BLOCKED: archive missing for ${item.legacy_root}`);
    continue;
  }
  const legacyHash = hash(item.legacy_root);
  const accepted = new Set([hash(item.archive), ...(item.accepted_legacy_sha256 || [])]);
  if (!accepted.has(legacyHash)) {
    conflicts++;
    console.error(`DOC MIGRATION BLOCKED: content differs ${item.legacy_root}`);
    continue;
  }
  if (!dryRun) fs.unlinkSync(item.legacy_root);
  removed++;
  console.log(`${dryRun ? 'WOULD REMOVE' : 'REMOVED'} ${item.legacy_root}`);
}

console.log(`DOC MIGRATION: removed=${removed} absent=${skipped} conflicts=${conflicts} dryRun=${dryRun}`);
if (conflicts) process.exit(1);
