import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePptxPreview } from '../public/pptx-preview-parser.js';

const encoder = new TextEncoder(), join = parts => { const size = parts.reduce((sum, part) => sum + part.length, 0), output = new Uint8Array(size); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
const header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
function storedZip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const fileName = encoder.encode(name), data = value instanceof Uint8Array ? value : encoder.encode(value), localHeader = header(30, 0x04034b50), localView = new DataView(localHeader.buffer); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, fileName.length, true); local.push(localHeader, fileName, data);
    const centralHeader = header(46, 0x02014b50), centralView = new DataView(centralHeader.buffer); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, fileName.length, true); centralView.setUint32(42, offset, true); central.push(centralHeader, fileName); offset += localHeader.length + fileName.length + data.length;
  }
  const directory = join(central), end = header(22, 0x06054b50), endView = new DataView(end.buffer), count = Object.keys(files).length; endView.setUint16(8, count, true); endView.setUint16(10, count, true); endView.setUint32(12, directory.length, true); endView.setUint32(16, offset, true); return join([...local, directory, end]);
}
const slide = value => `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><a:p><a:r><a:t>${value}</a:t></a:r></a:p><a:p><a:r><a:t>รายละเอียด</a:t></a:r></a:p><a:blip r:embed="rId1"/></p:sld>`;
const pptx = storedZip({ 'ppt/slides/slide1.xml': slide('หน้าปก'), 'ppt/slides/slide2.xml': slide('ขั้นตอน'), 'ppt/slides/_rels/slide2.xml.rels': '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>', 'ppt/media/image1.png': new Uint8Array([137, 80, 78, 71]) });
const slides = await parsePptxPreview(pptx.buffer);
assert.equal(slides.length, 2); assert.equal(slides[0].title, 'หน้าปก'); assert.equal(slides[1].title, 'ขั้นตอน'); assert.equal(slides[1].bullets[0].text, 'รายละเอียด'); assert.deepEqual(slides[1].bullets[0].attachment_numbers, [1]); assert.match(slides[1].images[1], /^blob:/);
const viewer = await readFile(new URL('../public/powerpoint-viewer.js', import.meta.url), 'utf8'); assert.match(viewer, /PREVIEW_NOT_AVAILABLE/); assert.match(viewer, /parsePptxPreview\(await file\.arrayBuffer\(\)\)/);
console.log('v0.20.27 legacy PowerPoint online fallback checks passed');
