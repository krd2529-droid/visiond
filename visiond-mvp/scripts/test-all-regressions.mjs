import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Only tests declared as forward-compatible contracts belong in this runner.
// Historical release snapshots intentionally assert old badges, copy and layouts;
// running them against a newer release creates false failures instead of regressions.
const evergreen = new Set([
  'test-commerce-final.mjs',
  'test-elon-access.mjs',
  'test-elon-frontend-only.mjs',
  'test-elon-provider.mjs',
  'test-elon-widget-surfaces.mjs',
  'test-first-order-promo.mjs',
  'test-maintenance-worker.mjs',
  'test-mobile-frontend.mjs',
  'test-v01486-vision5-two-account-e2e.mjs',
  'test-v014181.mjs',
]);
const all = fs.readdirSync('scripts').filter(x => /^test-.*\.mjs$/.test(x) && x !== 'test-all-regressions.mjs').sort();
const files = all.filter(x => evergreen.has(x));
const skipped = all.filter(x => !evergreen.has(x));
const missing = [...evergreen].filter(x => !all.includes(x));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [`scripts/${file}`], { encoding: 'utf8' });
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${file}`);
  if (result.status !== 0) {
    failed++;
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
}
for (const file of missing) console.log(`FAIL ${file} (forward-compatible contract missing)`);
failed += missing.length;
console.log(`SKIP historical-release-snapshots=${skipped.length} (run only inside their original release)`);
console.log(`REGRESSION: contracts=${files.length + missing.length} passed=${files.length - (failed - missing.length)} failed=${failed}`);
if (failed) process.exit(1);
