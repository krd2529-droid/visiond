import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.textContent = ''; this.className = ''; }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}

const source = await readFile(new URL('../public/work-notes.js', import.meta.url), 'utf8');
const executable = `${source.slice(0, source.indexOf('function insertAtCursor')).replace(/^import[^\n]+\n/, '')}\nglobalThis.__loadPowerpointLibrary=loadPowerpointLibrary;`;
const libraryTarget = new Element('div');
const generic = new Element('div');
const document = {
  querySelector: selector => selector === '#pptLibraryList' ? libraryTarget : generic,
  createElement: tag => new Element(tag),
  head: new Element('head'),
};
const dangerousTitle = 'คลัง <script>globalThis.pwned=1</script> & "ไทย"';
let responseMode = 'success';
const context = {
  document,
  window: { PptxGenJS: function PptxGenJS() {} },
  fetch: async () => responseMode === 'success'
    ? Response.json({ items: [{ id: 7, title: dangerousTitle, file_name: "งาน <ฝ่ายขาย> & 'Q1'.pptx", file_size: 2048, created_at: '2026-09-05T00:00:00Z' }] })
    : Response.json({ error: '<img src=x onerror=globalThis.pwned=1>' }, { status: 500 }),
  Response, console, setTimeout, clearTimeout, confirm: () => false,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(executable, context);
await context.__loadPowerpointLibrary();
assert.equal(libraryTarget.children.length, 1);
const row = libraryTarget.children[0];
assert.equal(row.children[0].children[0].textContent, dangerousTitle);
assert.equal(row.children[1].children[0].href, '/powerpoint-viewer.html?id=7');
assert.equal(row.children[1].children[0].target, '_blank');
assert.equal(row.children[1].children[1].href, '/api/powerpoints/7');
assert.equal(context.pwned, undefined);

responseMode = 'error';
await context.__loadPowerpointLibrary();
assert.equal(libraryTarget.children[0].textContent, '<img src=x onerror=globalThis.pwned=1>');
assert.equal(context.pwned, undefined);
assert.doesNotMatch(source, /\besc\s*\(/);

console.log('v0.14.623 PowerPoint library runtime rendering checks passed');
