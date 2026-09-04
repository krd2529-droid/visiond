import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const presentation = fs.readFileSync('functions/api/admin/work-notes/presentation.js', 'utf8');
const client = fs.readFileSync('public/work-notes.js', 'utf8');
const html = fs.readFileSync('public/work-notes.html', 'utf8');

assert.match(presentation, /work_note_ppt_jobs/);
assert.match(presentation, /ctx\.waitUntil\(runJob/);
assert.match(presentation, /deadlineMs: 25000/);
assert.match(presentation, /WHERE id=\? AND user_id=\?/);
assert.match(client, /waitForPresentation/);
assert.match(client, /usedNumbers=new Set/);
assert.match(client, /button\.closest\('\.note-row'\)\?\./);
assert.match(client, /ensurePptxLibrary\(\)\.catch/);
assert.match(html, /work-notes\.js\?v=014619/);
assert.match(html, /pptxgen\.min\.js\?v=014619/);

const source = fs.readFileSync('public/vendor/pptxgen.min.js', 'utf8');
const context = {
  console,
  navigator: { userAgent: 'node' },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  Blob,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout,
};
context.window = context;
context.self = context;
vm.createContext(context);
vm.runInContext(source, context);
assert.equal(typeof context.PptxGenJS, 'function');
assert.equal(typeof context.JSZip, 'function');
const pptx = new context.PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
const slide = pptx.addSlide();
slide.addText('VisionD งานนำเสนอทดสอบ', { x: 1, y: 1, w: 8, h: 1 });
const bytes = await pptx.write({ outputType: 'arraybuffer' });
assert.ok(bytes.byteLength > 20000);
const zip = await context.JSZip.loadAsync(bytes);
assert.ok(zip.file('[Content_Types].xml'));
assert.ok(zip.file('ppt/presentation.xml'));
const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');
assert.match(slideXml, /VisionD/);
assert.match(slideXml, /งานนำเสนอทดสอบ/);

console.log('v0.14.619 work-notes async PowerPoint and real PPTX test passed');
