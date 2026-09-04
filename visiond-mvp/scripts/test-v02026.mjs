import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewImageKey, previewManifestKey, validatedPowerpointPreview } from '../functions/_powerpoint-preview.js';

const preview = validatedPowerpointPreview(JSON.stringify({ deck_title: '<งาน>', subtitle: 'สรุป', colors: { accent: '0abAb5', pale: 'bad' }, pages: [{ title: 'ขั้นตอน', bullets: [{ text: '<script>ไม่รัน</script>', attachment_numbers: [1, 1, 2, 99] }] }] }), 2);
assert.equal(preview.colors.accent, '0ABAB5');
assert.equal(preview.colors.pale, 'FFFFFF');
assert.deepEqual(preview.pages[0].bullets[0].attachment_numbers, [1, 2]);
assert.equal(previewManifestKey('powerpoints/1/a.pptx'), 'powerpoints/1/a.pptx.preview.json');
assert.equal(previewImageKey('powerpoints/1/a.pptx', 2), 'powerpoints/1/a.pptx.preview/image-2');
assert.throws(() => validatedPowerpointPreview('{bad', 0), /PREVIEW_JSON/);
assert.throws(() => validatedPowerpointPreview(JSON.stringify({ pages: [] }), 0), /PREVIEW_EMPTY/);

const files = await Promise.all(['../public/work-notes.js','../public/powerpoint-viewer.html','../public/powerpoint-viewer.js','../functions/api/powerpoints/index.js','../functions/api/powerpoints/[id]/preview.js','../functions/api/powerpoints/[id]/preview-image/[number].js'].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
const [notes, html, viewer, indexApi, previewApi, imageApi] = files;
assert.match(notes, /upload\.set\('preview',JSON\.stringify\(preview\)\)/);
assert.match(notes, /เปิดดูออนไลน์/);
assert.match(html, /powerpoint-viewer\.js\?v=02026/);
assert.match(viewer, /textContent=value/);
assert.match(viewer, /กดเพื่อดูใหญ่/);
for (const api of [previewApi, imageApi]) assert.match(api, /created_by=\?/);
assert.match(indexApi, /\['boss', 'admin'\]\.includes\(auth\.user\.role\)/);
assert.match(indexApi, /previewManifestKey/);
console.log('v0.20.26 online PowerPoint preview checks passed');
