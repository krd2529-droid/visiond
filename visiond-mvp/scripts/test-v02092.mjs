import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('public/tiktok-analyzer.html','utf8'),js=readFileSync('public/tiktok-analyzer.js','utf8'),css=readFileSync('public/tiktok-analyzer.css','utf8');
for(const text of [html,js,css])assert.doesNotMatch(text,/direction-analysis|data-field="direction"/);
assert.doesNotMatch(html,/ทิศทางช่อง/);
for(const token of ['data-field="summary"','data-list="ai-recommendations"','id="manualCForm"','data-list="plan"','name="strategy"'])assert.ok(html.includes(token),token);
assert.ok(readFileSync('functions/_tiktok_analyzer.js','utf8').includes('channel_direction'),'stored/generated contract retained');
await import('./test-v02089.mjs');
console.log('PASS v92 no visible direction card; actual saved/empty render and late ownership intact; strategy/data retained');
