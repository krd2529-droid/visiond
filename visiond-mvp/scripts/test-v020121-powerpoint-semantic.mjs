import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeDeck } from '../functions/api/admin/work-notes/presentation.js';
import { parsePptxPreview } from '../public/pptx-preview-parser.js';
import { semanticFigureLabel, semanticFigureLabels, visibleFigureLabel, visibleFigureLabels } from '../public/powerpoint-figure-labels.js';

assert.equal(semanticFigureLabel('1.1 เปิดหน้า\n1.2 เลือกเมนู\n1.3 ยืนยันข้อมูล'), '1.1–1.3');
assert.equal(visibleFigureLabel('เข้าลิงก์ https://business.facebook.com/', 'ขั้นตอนที่ 1', 26), 'รูปประกอบลิงก์เริ่มต้น');
assert.equal(visibleFigureLabel('ข้อความไม่มีเลขหรือลิงก์', 'หัวข้อทั่วไป', 26), 'รูปประกอบหัวข้อนี้');
assert.equal(visibleFigureLabel('[ข้อมูลที่ต้องเติม: รูป 35]', 'รูปประกอบตามโน้ต', 35), 'รูปประกอบที่ยังไม่ผูกขั้นตอน');
assert.deepEqual(semanticFigureLabels('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]', [32]), { 32: '' }, 'a source-unbound placeholder must not inherit the adjacent semantic step');
assert.deepEqual(visibleFigureLabels('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]', 'ขั้นตอนที่ 3', [32]), { 32: 'รูปประกอบที่ยังไม่ผูกขั้นตอน' });
assert.deepEqual(visibleFigureLabels('3.1 กดปุ่มเพิ่มสินค้า', 'ขั้นตอนที่ 3', [31]), { 31: 'รูป 3.1' }, 'a genuinely marked attachment keeps its semantic step');
assert.deepEqual(visibleFigureLabels('เข้าลิงก์ https://business.facebook.com/ แล้ว 1.1 กดสร้างแฟ้มทางธุรกิจ', 'ขั้นตอนที่ 1', [1, 26]), { 1: 'รูปประกอบลิงก์เริ่มต้น', 26: 'รูป 1.1' });
assert.equal(new Set(Object.values(visibleFigureLabels('เข้าลิงก์ https://business.facebook.com/ แล้ว 1.1 กดสร้างแฟ้มทางธุรกิจ', 'ขั้นตอนที่ 1', [1, 26]))).size, 2, 'ordered multi-image labels must not duplicate visible identities');

const duplicate = normalizeDeck({ deck_title: 'คู่มือ', slides: [
  { title: 'ขั้นตอนที่ 1', bullets: [{ text: '1.1 กดสร้างแฟ้มทางธุรกิจ', attachment_numbers: [26] }] },
  { title: 'ขั้นตอนที่ 9', bullets: [{ text: '1.1 กดสร้างแฟ้มทางธุรกิจ', attachment_numbers: [1] }] },
] }, 'คู่มือ', 'blue', 26, '1.1 กดสร้างแฟ้มทางธุรกิจ [รูป 1]\n1.1 กดสร้างแฟ้มทางธุรกิจ [รูป 26]');
assert.deepEqual(duplicate.slides.map(slide => slide.bullets[0].attachment_numbers), [[1], [26]], 'equal source occurrences must be consumed sequentially instead of collapsing onto the first bullet');

const absent = normalizeDeck({ deck_title: 'คู่มือ', slides: [{ title: 'ขั้นตอน', bullets: [{ text: 'ไม่มีป้ายรูปในต้นฉบับ', attachment_numbers: [9] }] }] }, 'คู่มือ', 'blue', 9, 'ไม่มีป้ายรูปในต้นฉบับ');
assert.deepEqual(absent.slides[0].bullets[0].attachment_numbers, [], 'AI output must not invent an attachment when the source has no marker');

const encoder = new TextEncoder();
const join = parts => { const size = parts.reduce((sum, part) => sum + part.length, 0), output = new Uint8Array(size); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
const header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
function storedZip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const fileName = encoder.encode(name), data = value instanceof Uint8Array ? value : encoder.encode(value), localHeader = header(30, 0x04034b50), localView = new DataView(localHeader.buffer); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, fileName.length, true); local.push(localHeader, fileName, data);
    const centralHeader = header(46, 0x02014b50), centralView = new DataView(centralHeader.buffer); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, fileName.length, true); centralView.setUint32(42, offset, true); central.push(centralHeader, fileName); offset += localHeader.length + fileName.length + data.length;
  }
  const directory = join(central), end = header(22, 0x06054b50), endView = new DataView(end.buffer), count = Object.keys(files).length; endView.setUint16(8, count, true); endView.setUint16(10, count, true); endView.setUint32(12, directory.length, true); endView.setUint32(16, offset, true); return join([...local, directory, end]);
}
const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const shape = value => `<p:sp><p:txBody><a:p><a:r><a:t>${xml(value)}</a:t></a:r></a:p></p:txBody></p:sp>`;
const picture = (id, attachment = 0) => `<p:pic><p:nvPicPr><p:cNvPr${attachment ? ` descr="visiond-attachment:${attachment}"` : ''}/></p:nvPicPr><p:blipFill><a:blip r:embed="${id}"/></p:blipFill></p:pic>`;
const slide = shapes => `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>${shapes.join('')}</p:spTree></p:cSld></p:sld>`;

const files = {};
for (let number = 1; number <= 68; number++) files[`ppt/slides/slide${number}.xml`] = slide([shape(number === 1 ? 'VISIOND' : `หัวข้อ ${number}`)]);
files['ppt/slides/slide4.xml'] = slide([
  shape('ขั้นตอนที่ 1 - การสร้างพอร์ตโฟลิโอธุรกิจ'),
  shape('1.1 กดสร้างแฟ้มทางธุรกิจ'), picture('rId1'), shape('รูป 1 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'),
  shape('1.2 ตั้งค่าข้อมูลธุรกิจ'), picture('rId26'), shape('รูป 26 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'),
  shape('4 / 68'),
]);
files['ppt/slides/slide20.xml'] = slide([
  shape('ขั้นตอนที่ 2'),
  shape('2.1 เปิดเมนู'), shape('รูป 2.1 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'), picture('rOddB', 15),
  shape('2.2 เลือกรายการ'), shape('รูป 2.2 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'), picture('rOddA', 16),
  shape('20 / 68'),
]);
files['ppt/slides/slide19.xml'] = slide([shape('ขั้นตอนที่ 3'), shape('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]'), picture('rId32'), shape('รูป 32 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'), shape('19 / 68')]);
files['ppt/slides/slide21.xml'] = slide([shape('ขั้นตอนที่ 3'), shape('[ข้อมูลที่ต้องเติม: ขั้นตอนหรือภาพ รูป 35]'), picture('rId35'), shape('รูป 35 · กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่'), shape('21 / 68')]);
files['ppt/slides/slide55.xml'] = slide([shape('รูป 32'), shape('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]'), picture('rId32'), shape('55 / 68')]);
files['ppt/slides/slide58.xml'] = slide([shape('รูป 35'), shape('[ข้อมูลที่ต้องเติม: ขั้นตอนหรือภาพ รูป 35]'), picture('rId35'), shape('58 / 68')]);
files['ppt/slides/slide67.xml'] = slide([shape('รูป 1'), shape('1.1 กดสร้างแฟ้มทางธุรกิจ'), picture('rId1'), shape('67 / 68')]);
files['ppt/slides/slide68.xml'] = slide([shape('รูป 26'), shape('1.2 ตั้งค่าข้อมูลธุรกิจ'), picture('rId26'), shape('68 / 68')]);
files['ppt/slides/_rels/slide4.xml.rels'] = '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/><Relationship Id="rId26" Target="../media/image26.png"/></Relationships>';
files['ppt/slides/_rels/slide20.xml.rels'] = '<Relationships><Relationship Id="rOddA" Target="../media/not-semantic-900.png"/><Relationship Id="rOddB" Target="../media/not-semantic-2.png"/></Relationships>';
files['ppt/slides/_rels/slide19.xml.rels'] = '<Relationships><Relationship Id="rId32" Target="../media/image32.png"/></Relationships>';
files['ppt/slides/_rels/slide21.xml.rels'] = '<Relationships><Relationship Id="rId35" Target="../media/image35.png"/></Relationships>';
files['ppt/slides/_rels/slide55.xml.rels'] = '<Relationships><Relationship Id="rId32" Target="../media/image32.png"/></Relationships>';
files['ppt/slides/_rels/slide58.xml.rels'] = '<Relationships><Relationship Id="rId35" Target="../media/image35.png"/></Relationships>';
files['ppt/slides/_rels/slide67.xml.rels'] = '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>';
files['ppt/slides/_rels/slide68.xml.rels'] = '<Relationships><Relationship Id="rId26" Target="../media/image26.png"/></Relationships>';
files['ppt/media/image1.png'] = new Uint8Array([137, 80, 78, 71, 1]);
files['ppt/media/image26.png'] = new Uint8Array([137, 80, 78, 71, 26]);
files['ppt/media/image32.png'] = new Uint8Array([137, 80, 78, 71, 32]);
files['ppt/media/image35.png'] = new Uint8Array([137, 80, 78, 71, 35]);
files['ppt/media/not-semantic-2.png'] = new Uint8Array([137, 80, 78, 71, 15]);
files['ppt/media/not-semantic-900.png'] = new Uint8Array([137, 80, 78, 71, 16]);

const slides = await parsePptxPreview(storedZip(files).buffer);
assert.equal(slides.length, 68, 'the whole-deck fixture must retain all 68 slides');
assert.deepEqual(slides[3].bullets.map(bullet => ({ text: bullet.text, numbers: bullet.attachment_numbers })), [
  { text: '1.1 กดสร้างแฟ้มทางธุรกิจ', numbers: [1] },
  { text: '1.2 ตั้งค่าข้อมูลธุรกิจ', numbers: [26] },
], 'legacy parsing must retain each paragraph-to-caption association');
assert.deepEqual(slides[3].figure_labels, { 1: '1.1', 26: '1.2' });
assert.deepEqual(slides[19].bullets.map(bullet => ({ text: bullet.text, numbers: bullet.attachment_numbers })), [
  { text: '2.1 เปิดเมนู', numbers: [15] },
  { text: '2.2 เลือกรายการ', numbers: [16] },
], 'caption-before-picture shapes must stay boundary-associated even when relationship targets and media names are non-semantic');
assert.equal(slides[66].title, 'รูป 1.1');
assert.equal(slides[67].title, 'รูป 1.2');
assert.deepEqual(slides[18].figure_labels, {}, 'phantom figure 32 must not receive semantic label 3.1');
assert.deepEqual(slides[20].figure_labels, {}, 'phantom figure 35 must remain source-unbound');
assert.equal(slides[54].title, 'รูปประกอบที่ยังไม่ผูกขั้นตอน');
assert.equal(slides[57].title, 'รูปประกอบที่ยังไม่ผูกขั้นตอน');

const [viewer, notes, parser, helper, viewerHtml, notesHtml, version, home, admin] = await Promise.all([
  '../public/powerpoint-viewer.js', '../public/work-notes.js', '../public/pptx-preview-parser.js', '../public/powerpoint-figure-labels.js', '../public/powerpoint-viewer.html', '../public/work-notes.html', '../VERSION.txt', '../public/index.html', '../public/admin.html',
].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
assert.match(helper, /semanticFigureLabel/);
assert.match(viewer, /visibleFigureLabel/);
assert.match(notes, /visibleFigureLabel/);
assert.match(notes, /altText:`visiond-attachment:\$\{number\}`/);
assert.doesNotMatch(notes, /tooltip:`เปิดรูป \$\{number\}/);
assert.match(parser, /figure_labels/);
assert.match(viewerHtml, /powerpoint-viewer\.js\?v=020121/);
assert.match(notesHtml, /work-notes\.js\?v=020121/);
assert.equal(version.trim(), 'v0.20.121');
assert.match(home, /WEB v0\.20\.121/); assert.match(admin, /ADMIN v0\.20\.121/);
console.log('PASS v0.20.121 semantic PowerPoint labels, occurrence-safe source mapping and 68-slide legacy association');
