import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const fail = (message) => { console.error(`PATCH GATE: FAIL — ${message}`); process.exit(1); };
if (!fs.existsSync(path.join(root, 'VERSION.txt')) || !fs.existsSync(path.join(root, 'package.json'))) {
  fail('ต้องรันจากโฟลเดอร์ visiond-mvp');
}
const run = (label, command, args) => {
  console.log(`\n[${label}] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} ไม่ผ่าน`);
};
const capture = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(`เรียก ${command} ไม่สำเร็จ`);
  return result.stdout.trim();
};

const staged = capture('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split(/\r?\n/).filter(Boolean);
if (!staged.length) fail('ยังไม่มีไฟล์ Stage สำหรับ Commit');
const secretName = /(^|\/)(\.env(?:\..+)?|id_rsa|id_ed25519|credentials?\.json|.*\.(?:pem|p12|pfx))$/i;
const invalid = staged.filter((file) => file.includes('.pnpm-store/') || secretName.test(file) || (file !== 'START-HERE.md' && !file.startsWith('visiond-mvp/')));
if (invalid.length) fail(`พบไฟล์ห้าม Commit: ${invalid.join(', ')}`);
console.log(`[STAGED FILES] PASS — ${staged.length} files`);

const version = fs.readFileSync(path.join(root, 'VERSION.txt'), 'utf8').trim();
if (!/^v\d+\.\d+\.\d+$/.test(version)) fail('VERSION.txt ไม่ใช่ semantic version');
const focused = `scripts/test-v${version.slice(1).replaceAll('.', '')}.mjs`;
if (!fs.existsSync(path.join(root, focused))) fail(`ไม่พบ focused test ${focused}`);
run('FOCUSED', process.execPath, [focused]);
run('VISIBLE VERSION', process.execPath, ['scripts/visible-version-check.mjs']);
run('REGRESSION', process.execPath, ['scripts/test-all-regressions.mjs']);
run('PREDEPLOY', process.execPath, ['scripts/predeploy-check.mjs']);
console.log(`\nPATCH GATE: PASS — ${version} พร้อม Commit (ยังไม่ใช่ Push/Deploy)`);
