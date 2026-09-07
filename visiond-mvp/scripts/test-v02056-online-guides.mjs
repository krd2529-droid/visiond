import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const guides = read('public/guides.html');
const css = read('public/guides.css');
const version = read('VERSION.txt').trim();

assert.equal(version, 'v0.20.56');
for (const slug of ['visiond-vx-customer-guide', 'visiond-vlearning-partner-customer-guide']) {
  assert.match(guides, new RegExp(`/manuals/${slug}\\.pdf`));
  assert.match(guides, new RegExp(`/manuals/${slug}\\.docx`));
  assert.ok(fs.statSync(new URL(`public/manuals/${slug}.pdf`, root)).size > 100000, `${slug}.pdf`);
  assert.ok(fs.statSync(new URL(`public/manuals/${slug}.docx`, root)).size > 100000, `${slug}.docx`);
}
assert.equal((guides.match(/>อ่านออนไลน์<\/a>/g) || []).length, 2);
assert.equal((guides.match(/target="_blank" rel="noopener"/g) || []).length, 2);
assert.match(css, /\.guide-actions\{display:grid/);
assert.match(css, /@media\(max-width:640px\).*\.guide-actions\{grid-template-columns:1fr\}/);
console.log('PASS v0.20.56 online guide PDFs');
