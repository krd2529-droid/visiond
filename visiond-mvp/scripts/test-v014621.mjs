import assert from 'node:assert/strict';
import { File as BufferFile } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { PPTX_MIME, powerpointHeaders, safePptxName, validatedPptx } from '../functions/_powerpoint-library.js';

globalThis.File ||= BufferFile;

const fakePptxBytes = new TextEncoder().encode('PK\x03\x04...[Content_Types].xml...ppt/presentation.xml...');
const valid = new File([fakePptxBytes], 'ทดสอบ.pptx', { type: PPTX_MIME });
assert.deepEqual(await validatedPptx(valid), new Uint8Array(fakePptxBytes));
await assert.rejects(() => validatedPptx(new File(['not a zip'], 'bad.pptx', { type: PPTX_MIME })), /PPTX_ZIP/);
await assert.rejects(() => validatedPptx(new File([fakePptxBytes], 'bad.zip', { type: 'application/zip' })), /PPTX_TYPE/);
assert.equal(safePptxName('../deck?.pptx'), '..-deck-.pptx');
const headers = powerpointHeaders('งานสอน.pptx', 123);
assert.equal(headers['content-type'], PPTX_MIME);
assert.equal(headers['cache-control'], 'private, no-store');
assert.match(headers['content-disposition'], /filename\*=UTF-8''/);

const files = {
  libraryIndex: await readFile(new URL('../functions/api/powerpoints/index.js', import.meta.url), 'utf8'),
  libraryItem: await readFile(new URL('../functions/api/powerpoints/[id].js', import.meta.url), 'utf8'),
  attach: await readFile(new URL('../functions/api/course-seller/[id]/lessons/[lessonId]/powerpoints.js', import.meta.url), 'utf8'),
  notesHtml: await readFile(new URL('../public/work-notes.html', import.meta.url), 'utf8'),
  notesJs: await readFile(new URL('../public/work-notes.js', import.meta.url), 'utf8'),
  basketHtml: await readFile(new URL('../public/course-basket-edit.html', import.meta.url), 'utf8'),
  basketJs: await readFile(new URL('../public/course-basket-edit.js', import.meta.url), 'utf8'),
};

for (const source of [files.libraryIndex, files.libraryItem, files.attach]) assert.match(source, /created_by=\?/);
assert.match(files.attach, /c\.owner_user_id=\?/);
assert.match(files.attach, /seller-course-\$\{lesson\.course_id\}-file-/);
assert.match(files.attach, /FILES\.delete\(key\)/);
assert.match(files.notesHtml, /สร้างและบันทึกเข้าคลัง/);
assert.match(files.notesHtml, /สร้างและดาวน์โหลด/);
assert.match(files.notesJs, /\/api\/powerpoints/);
assert.match(files.basketHtml, /powerpoint_library_id/);
assert.match(files.basketJs, /\/powerpoints`/);
assert.match(files.basketJs, /lessonData\.delete\("powerpoint_library_id"\)/);

console.log('v0.14.621 PowerPoint library checks passed');
