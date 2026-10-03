import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/vision7-admin.js', import.meta.url), 'utf8');
const start = source.indexOf('function renderLicenses() {');
const end = source.indexOf('\nlet productOptions = [];', start);
assert.ok(start >= 0 && end > start);
const licensesEl = { innerHTML: '', querySelector: () => null };
const context = {
  window: { __licenses: [
    { id: 'sms', user_id: 1, user_name: 'SMS owner', program_code: 'sms-mix',
      program_title: 'SMS Mix', key_masked: 'SMS-••••', status: 'active',
      active_devices: 1, max_devices: 3 },
    { id: 'legacy', user_id: 2, user_name: 'Legacy owner', program_code: 'other',
      program_title: 'Other', key_masked: 'OTHER-••••', status: 'active',
      active_devices: 1, max_devices: 3 }
  ] },
  licenseSearch: { value: '' }, licenseFilter: 'all', licensesEl,
  esc: value => String(value ?? ''), bindLicenseActions: () => {},
  CSS: { escape: value => String(value) },
  document: { createElement: () => ({ dataset: {} }) }, Intl, Date
};
vm.runInNewContext(source.slice(start, end) + '\nrenderLicenses();', context);
assert.match(licensesEl.innerHTML, /SMS Mix[\s\S]*?1\/1 เครื่อง/);
assert.match(licensesEl.innerHTML, /Other[\s\S]*?1\/3 เครื่อง/);
console.log('PASS SMS Mix admin shows one-device slot without changing legacy slots');
