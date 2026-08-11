#!/usr/bin/env node
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const results = [];
const add = (level, check, detail) => results.push({ level, check, detail });
const exists = file => access(path.join(root, file)).then(() => true, () => false);
const text = file => readFile(path.join(root, file), 'utf8');
async function files(dir, filter = () => true) {
  const out = [];
  async function walk(current) {
    for (const entry of await readdir(path.join(root, current), { withFileTypes: true })) {
      const name = path.posix.join(current, entry.name);
      if (entry.isDirectory()) await walk(name); else if (filter(name)) out.push(name);
    }
  }
  if (await exists(dir)) await walk(dir);
  return out.sort();
}
function configValue(source, key) {
  return source.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, 'm'))?.[1] ?? null;
}

async function checkConfig() {
  const name = await exists('wrangler.toml') ? 'wrangler.toml' : 'wrangler.toml.example';
  const source = await text(name);
  add(name.endsWith('.example') ? 'WARN' : 'PASS', 'Cloudflare config', name.endsWith('.example') ? 'พบเฉพาะไฟล์ตัวอย่าง โปรดสร้าง config จริงหรือกำหนดค่าใน Cloudflare Dashboard' : 'พบ wrangler.toml');
  for (const binding of ['DB', 'FILES']) {
    const ok = new RegExp(`binding\\s*=\\s*["']${binding}["']`).test(source);
    add(ok ? 'PASS' : 'FAIL', `Binding ${binding}`, ok ? `ประกาศใน ${name}` : `ไม่พบ binding ที่จำเป็นใน ${name}`);
  }
  const d1 = configValue(source, 'database_id');
  add(d1 && !/^(?:REPLACE_|YOUR_|EXAMPLE)/i.test(d1) ? 'PASS' : 'WARN', 'D1 database ID', d1 && !/^(?:REPLACE_|YOUR_|EXAMPLE)/i.test(d1) ? 'ตั้งค่าแล้ว (ไม่แสดงค่า)' : 'ยังเป็น placeholder; ต้องตั้ง ID จริงก่อน deploy production');
  for (const [key, pattern] of [
    ['ADMIN_EMAIL', /example\.com|ตั้งค่า|replace|your_/i], ['BANK_NAME', /ตั้งค่า|replace|your_|example/i],
    ['BANK_ACCOUNT_NAME', /ตั้งค่า|replace|your_|example/i], ['BANK_ACCOUNT_NUMBER', /ตั้งค่า|replace|your_|example/i],
    ['RESET_EMAIL_FROM', /example\.com|ตั้งค่า|replace|your_/i]
  ]) {
    const value = configValue(source, key);
    add(value && !pattern.test(value) ? 'PASS' : 'WARN', key, value && !pattern.test(value) ? 'ตั้งค่าแล้ว (ไม่แสดงค่า)' : value == null ? 'ไม่พบใน config; ตรวจว่าตั้งใน Cloudflare Dashboard แล้ว' : 'ยังเป็นค่าตัวอย่าง/placeholder');
  }
  const origin = configValue(source, 'APP_ORIGIN');
  add(origin?.startsWith('https://') ? 'PASS' : 'WARN', 'APP_ORIGIN', origin?.startsWith('https://') ? 'เป็น HTTPS origin' : 'ควรเป็น production HTTPS origin');
  add('PASS', 'Optional providers', 'OpenAI/Gemini, Resend, EasySlip และ Turnstile ตรวจเมื่อเปิดใช้ฟีเจอร์ ไม่บล็อก deploy');
}

async function checkMigrations() {
  const list = await files('migrations', file => /\/\d{4}_[^/]+\.sql$/.test(file));
  if (!list.length) return add('FAIL', 'Migrations', 'ไม่พบ migration');
  const nums = list.map(file => Number(path.basename(file).slice(0, 4)));
  const dupes = nums.filter((number, i) => nums.indexOf(number) !== i);
  const missing = [];
  for (let number = Math.min(...nums); number <= Math.max(...nums); number++) if (!nums.includes(number)) missing.push(number);
  add(dupes.length || missing.length ? 'FAIL' : 'PASS', 'Migrations', dupes.length || missing.length ? `เลขซ้ำ: ${dupes.join(',') || '-'}; เลขขาด: ${missing.join(',') || '-'}` : `${list.length} ไฟล์ เรียงต่อเนื่อง ${nums[0]}–${nums.at(-1)}`);
  for (const file of list) if ((await stat(path.join(root, file))).size === 0) add('FAIL', 'Migration file', `${file} เป็นไฟล์ว่าง`);
}

async function checkImports() {
  const list = await files('functions', file => /\.(?:js|mjs)$/.test(file));
  let broken = 0;
  for (const file of list) {
    const source = await text(file);
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["'](\.[^"']+)["']/g)) {
      const target = path.resolve(root, path.dirname(file), match[1]);
      const candidates = [target, `${target}.js`, `${target}.mjs`, path.join(target, 'index.js')];
      if (!(await Promise.all(candidates.map(item => access(item).then(() => true, () => false)))).some(Boolean)) {
        broken++; add('FAIL', 'API import', `${file} อ้างไฟล์ที่ไม่มีอยู่: ${match[1]}`);
      }
    }
  }
  if (!broken) add('PASS', 'API imports', `ตรวจ relative imports ใน Functions ${list.length} ไฟล์แล้ว`);
}

async function checkHtml() {
  const pages = await files('public', file => file.endsWith('.html'));
  const assets = new Set(await files('public'));
  let duplicates = 0, missing = 0, unversioned = 0;
  for (const file of pages) {
    const source = await text(file);
    const ids = [...source.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dupes.length) { duplicates += dupes.length; add('FAIL', 'Duplicate HTML IDs', `${file}: ${dupes.join(', ')}`); }
    for (const match of source.matchAll(/<(?:script|link)\b[^>]+?(?:src|href)=["']([^"'#?]+)([^"']*)["']/gi)) {
      const raw = match[1];
      if (/^(?:https?:|data:|\/\/)/i.test(raw)) continue;
      const normalized = raw.startsWith('/')
        ? path.posix.join('public', raw.slice(1))
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), raw));
      if (!assets.has(normalized)) { missing++; add('FAIL', 'HTML asset', `${file} อ้าง asset ที่ไม่มีอยู่: ${raw}`); }
      else if (/\.(?:js|css)$/i.test(raw) && !match[2].includes('?v=')) unversioned++;
    }
  }
  if (!duplicates) add('PASS', 'Duplicate HTML IDs', `ไม่พบ ID ซ้ำใน ${pages.length} หน้า`);
  if (!missing) add('PASS', 'HTML assets', 'ไฟล์ JS/CSS ภายในที่อ้างถึงมีอยู่ครบ');
  add(unversioned ? 'WARN' : 'PASS', 'HTML cache versions', unversioned ? `พบ JS/CSS ${unversioned} จุดที่ไม่มี ?v= (ตรวจว่ายอมรับ cache เดิมได้)` : 'JS/CSS ภายในมี cache version ครบ');
}

await checkConfig(); await checkMigrations(); await checkImports(); await checkHtml();
const rank = { FAIL: 0, WARN: 1, PASS: 2 };
results.sort((a, b) => rank[a.level] - rank[b.level]);
for (const item of results) console.log(`[${item.level}] ${item.check}: ${item.detail}`);
const counts = Object.fromEntries(['PASS', 'WARN', 'FAIL'].map(level => [level, results.filter(item => item.level === level).length]));
console.log(`\nSummary: PASS ${counts.PASS} | WARN ${counts.WARN} | FAIL ${counts.FAIL}`);
console.log('Security: ไม่อ่าน environment variables และไม่แสดงค่าคีย์/Secret');
process.exitCode = counts.FAIL ? 1 : 0;
