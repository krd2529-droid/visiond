import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = (file) => fs.readFile(file, 'utf8');
const [source, css, html, version, indexHtml, adminHtml] = await Promise.all([
  'public/work-links.js',
  'public/work-links.css',
  'public/work-links.html',
  'VERSION.txt',
  'public/index.html',
  'public/admin.html'
].map(read));

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = {};
    this.classList = new FakeClassList();
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.selected = false;
    this.focused = false;
    this.listeners = {};
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  focus() { this.focused = true; this.listeners.focus?.(); }
  select() { this.selected = true; }
}

const context = vm.createContext({ navigator: {}, fetch: () => { throw new Error('copy must not fetch'); } });
const prefix = source.split('const $=')[0];
vm.runInContext(`${prefix};globalThis.copyApi={copySavedWorkLink,createWorkLinkCopyControl}`, context);
const { createWorkLinkCopyControl } = context.copyApi;
const doc = { createElement: (tagName) => new FakeElement(tagName) };
const item = {
  id: 7,
  label: 'DEV TikTok',
  note: 'email-note@example.com',
  url: 'https://partner.tiktokshop.com/path?a=1%2B2#saved'
};

let networkCalls = 0;
context.fetch = () => { networkCalls += 1; throw new Error('unexpected fetch'); };
const written = [];
let clipboard = { writeText: async (value) => { written.push(value); } };
const control = createWorkLinkCopyControl(item, { doc, getClipboard: () => clipboard });
assert.equal(control.button.tagName, 'BUTTON');
assert.equal(control.button.type, 'button');
assert.equal(control.button.textContent, 'คัดลอกลิงก์');
assert.equal(control.button.attributes['aria-label'], `คัดลอกลิงก์ ${item.label}`);
assert.equal(control.button.attributes['aria-describedby'], control.feedback.id);
assert.equal(control.feedback.attributes.role, 'status');
assert.equal(control.feedback.attributes['aria-live'], 'polite');
await control.button.onclick();
assert.deepEqual(written, [item.url], 'copy must use the exact saved URL, never note/label/platform');
assert.equal(control.feedback.textContent, 'คัดลอกลิงก์แล้ว');
assert.equal(control.feedback.classList.contains('error'), false);
assert.equal(control.manual.hidden, true);
assert.equal(networkCalls, 0);

clipboard = { writeText: async () => { throw new Error('permission denied'); } };
await control.button.onclick();
assert.match(control.feedback.textContent, /คัดลอกอัตโนมัติไม่สำเร็จ/);
assert.equal(control.feedback.classList.contains('error'), true);
assert.equal(control.manual.hidden, false);
assert.equal(control.manual.value, item.url);
assert.equal(control.manual.readOnly, true);
assert.equal(control.manual.selected, true, 'manual fallback should select the exact URL');

clipboard = undefined;
control.manual.selected = false;
await control.button.onclick();
assert.equal(control.manual.hidden, false);
assert.equal(control.manual.selected, true, 'missing Clipboard API must retain the manual fallback');

const restricted = createWorkLinkCopyControl(item, { doc, getClipboard: () => { throw new Error('restricted getter'); } });
await restricted.button.onclick();
assert.equal(restricted.manual.hidden, false);
assert.match(restricted.feedback.textContent, /คัดลอกอัตโนมัติไม่สำเร็จ/);

let resolveFirst;
let resolveSecond;
let call = 0;
clipboard = {
  writeText(value) {
    written.push(value);
    call += 1;
    return new Promise((resolve, reject) => {
      if (call === 1) resolveFirst = () => reject(new Error('older denied result'));
      else resolveSecond = resolve;
    });
  }
};
const repeated = createWorkLinkCopyControl(item, { doc, getClipboard: () => clipboard });
const older = repeated.button.onclick();
const newer = repeated.button.onclick();
resolveSecond();
await newer;
resolveFirst();
await older;
assert.equal(repeated.feedback.textContent, 'คัดลอกลิงก์แล้ว', 'an older async failure must not overwrite newer success');
assert.equal(repeated.feedback.classList.contains('error'), false);
assert.equal(repeated.manual.hidden, true);
assert.equal(networkCalls, 0);

assert.match(source, /actionButtons\.append\(open,copy\.button,edit,remove\)/, 'Open/Copy/Edit/Delete order must be preserved');
assert.doesNotMatch(prefix, /\bfetch\s*\(|\brequest\s*\(|\bloadMore\s*\(|location\./, 'copy control must be isolated from network/navigation/list reloads');
assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'mobile actions must fit as two columns');
assert.match(css, /\.link-row p\{[^}]*overflow-wrap:anywhere/);
assert.match(css, /\.copy-link-manual\{min-width:0;width:100%/);
assert.match(html, /work-links\.js\?v=02067/);
assert.match(html, /work-links\.css\?v=014590/);
assert.equal(version.trim(), 'v0.20.71');
assert.match(indexHtml, /WEB v0\.20\.71/);
assert.match(adminHtml, /ADMIN v0\.20\.71/);

console.log('PASS v0.20.65 work-link exact URL copy, honest fallback, repeat ordering, zero-network and mobile fit');
