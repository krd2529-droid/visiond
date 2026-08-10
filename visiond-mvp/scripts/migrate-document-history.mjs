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
const legacyVersionsDir = 'work-history/visiond/legacy-versions';
let removed = 0, preserved = 0, skipped = 0, conflicts = 0;
for (const item of manifest.files) {
  if (!fs.existsSync(item.legacy_root)) { skipped++; continue; }
  if (!fs.existsSync(item.archive)) {
    conflicts++;
    console.error(`DOC MIGRATION BLOCKED: archive missing for ${item.legacy_root}`);
    continue;
  }
  const legacyHash = hash(item.legacy_root);
  const archiveHash = hash(item.archive);
  const accepted = new Set([archiveHash, ...(item.accepted_legacy_sha256 || [])]);
  if (!accepted.has(legacyHash)) {
    conflicts++;
    console.error(`DOC MIGRATION BLOCKED: content differs ${item.legacy_root}`);
    continue;
  }
  if (legacyHash === archiveHash) {
    if (!dryRun) fs.unlinkSync(item.legacy_root);
    removed++;
    console.log(`${dryRun ? 'WOULD REMOVE IDENTICAL' : 'REMOVED IDENTICAL'} ${item.legacy_root}`);
    continue;
  }
  // A recognized older version is never deleted. Keep it under a hash-qualified
  // recovery name so a damaged/newer archive cannot silently destroy history.
  const safeName = item.legacy_root.replace(/[\\/]/g, '__');
  const recovery = `${legacyVersionsDir}/${safeName}.${legacyHash.slice(0, 16)}.legacy`;
  if (!dryRun) {
    fs.mkdirSync(legacyVersionsDir, { recursive: true });
    if (fs.existsSync(recovery) && hash(recovery) !== legacyHash) {
      conflicts++;
      console.error(`DOC MIGRATION BLOCKED: recovery conflict ${recovery}`);
      continue;
    }
    if (fs.existsSync(recovery)) fs.unlinkSync(item.legacy_root);
    else fs.renameSync(item.legacy_root, recovery);
  }
  preserved++;
  console.log(`${dryRun ? 'WOULD PRESERVE' : 'PRESERVED'} ${item.legacy_root} -> ${recovery}`);
}

console.log(`DOC MIGRATION: removed_identical=${removed} preserved_legacy=${preserved} absent=${skipped} conflicts=${conflicts} dryRun=${dryRun}`);
if (conflicts) process.exit(1);
