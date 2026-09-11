import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const src=readFileSync('public/tiktok-analyzer.js','utf8'),css=readFileSync('public/tiktok-analyzer.css','utf8'),canonical=readFileSync('public/visiond-button-system.css','utf8'),c={escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;')};
vm.createContext(c);vm.runInContext(src.slice(src.indexOf('function cleanAiSearchQuery('),src.indexOf('async function searchAiRecommendation(')),c);
const html=c.aiRecommendationTable([{name:'ชื่อไทยยาว'.repeat(40)+'<img>',search_query:'ครีมเด็ก',evidence:'ยังไม่ยืนยัน'}]);
assert.match(html,/<article class="ai-concept-card" data-ai-concept>/);
assert.match(html,/<label class="ai-concept-query">คำค้นสินค้า<input data-ai-search-query/);
assert.match(html,/<div class="ai-concept-actions"><button class="vds-btn vds-btn--primary" type="button" data-ai-marketplace-search>/);
assert.doesNotMatch(html,/data-inventory|data-product-grade/); // v96 E concepts are search-only.
assert.match(html,/class="ai-concept-status" data-ai-search-status role="status"/);assert.match(html,/&lt;img>/);
assert.match(css,/\.ai-concept-card\{[^}]*min-width:0/);assert.match(css,/\.ai-concept-query input:focus-visible\{[^}]*outline:3px/);
assert.match(css,/@media\(max-width:640px\)\{\.ai-concept-card[^\n]*grid-template-columns:minmax\(0,1fr\)[^\n]*\.ai-concept-actions \.vds-btn\{width:100%\}/);
for(const selector of ['.vds-btn:focus-visible','.vds-btn:disabled','.vds-btn--primary:hover','.vds-btn--secondary'])assert.ok(canonical.includes(selector));
assert.equal((html.match(/<button /g)||[]).length,1);assert.ok(!html.includes('<img>'));
await import('./test-v02094.mjs');
console.log('v95 actual E semantic controls, canonical states, wrapping/mobile/accessibility and v94 behavior: PASS');
