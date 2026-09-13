import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const html=read('public/launcher-open.html'),bootstrap=read('public/launcher-open.js'),setup=read('public/launcher-setup.js'),analyzer=read('public/tiktok-analyzer.js');

assert.equal(read('VERSION.txt').trim(),'v0.20.115');
assert.match(html,/ติดตั้ง\/ซ่อมตัวช่วยเครื่องนี้/);
assert.match(html,/กลับ TikTok Analyzer/);
assert.match(html,/launcher-pages\.css\?v=3/);
assert.match(html,/launcher-open\.js\?v=2/);
assert.doesNotMatch(bootstrap,/(?:^|[^.])location\.replace\(['"]http:\/\/127\.0\.0\.1/m,'the VisionD-owned top-level must never navigate to localhost');
assert.match(bootstrap,/window\.open\('http:\/\/127\.0\.0\.1:'\+port\+'\/launch\?command_id='\+command_id,'_blank','noopener,noreferrer,popup,width=460,height=260'\)/,'local dispatch requires an explicit user-activated, isolated auxiliary');
assert.doesNotMatch(bootstrap,/ticket|secret|provider=|intent=|channel_id=/,'local transport remains command-id-only');
assert.match(bootstrap,/attempt<8/);
assert.match(bootstrap,/Date\.now\(\)\+25000/);
assert.match(bootstrap,/Math\.min\(5000,deadline-Date\.now\(\)\)/);
assert.match(bootstrap,/HELPER_UPDATE_REQUIRED/);
assert.match(bootstrap,/state:'outdated'/);
assert.match(bootstrap,/ลองเปิดคำขอเดิมอีกครั้ง/);
assert.match(setup,/new URLSearchParams\(location\.search\)\.get\('state'\)/);
assert.match(setup,/Object\.hasOwn\(guides,requestedState\)/);
assert.match(analyzer,/link\.href='\/launcher-setup\?state='\+state/);
assert.match(analyzer,/link\.textContent='ติดตั้ง\/ซ่อมตัวช่วยเครื่องนี้'/);
assert.match(analyzer,/HELPER_UPDATE_REQUIRED'\)helperRecoveryStatus\([^;]+,'outdated'\)/);

const localUrl='http://127.0.0.1:53179/launch?command_id='+id;
assert.equal(new URL(localUrl).searchParams.size,1);
assert.equal(new URL(localUrl).searchParams.get('command_id'),id);
assert.equal(fs.existsSync(new URL('../migrations/0109_helper_fallback.sql',import.meta.url)),false,'no schema migration is introduced');
console.log('PASS v0.20.115 foreground bootstrap, exact recovery CTA, same-command-only dispatch, bounded polling and unchanged security boundary');
