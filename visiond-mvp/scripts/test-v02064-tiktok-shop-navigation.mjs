import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [source, html, css, version, home, admin] = await Promise.all([
  read('public/tiktok-analyzer.js'),
  read('public/tiktok-analyzer.html'),
  read('public/tiktok-analyzer.css'),
  read('VERSION.txt'),
  read('public/index.html'),
  read('public/admin.html')
]);

const helperSource = source.slice(0, source.indexOf('const $ ='));
let networkCalls = 0;
const rejectNetwork = () => { networkCalls += 1; throw new Error('NAVIGATION_MUST_NOT_FETCH'); };
const context = vm.createContext({ encodeURIComponent, fetch: rejectNetwork, api: rejectNetwork });
vm.runInContext(`${helperSource}\nthis.createNavigation=createTikTokShopNavigation;`, context);

let workspace = 'input', scope = '', view = '';
const navigated = [];
const state = { selected: 'channel-A', channels: [{ id: 'channel-A' }, { id: 'channel-B' }] };
const navigation = context.createNavigation({
  getState: () => state,
  setOutputScope: value => { scope = value; },
  setWorkspaceView: value => { workspace = value; },
  setChannelView: value => { view = value; },
  navigate: url => navigated.push(url)
});

assert.equal(navigation.showTab('products'), true);
assert.deepEqual({ workspace, scope, view, networkCalls }, { workspace: 'output', scope: 'channel', view: 'products', networkCalls: 0 });
assert.equal(navigation.showManagement(), true);
assert.equal(workspace, 'input');
assert.equal(navigation.showTab('commission'), true);
assert.deepEqual({ workspace, scope, view, networkCalls }, { workspace: 'output', scope: 'channel', view: 'commission', networkCalls: 0 });

assert.equal(navigation.connect(), true);
assert.equal(navigated.at(-1), '/api/tiktok-shop/connect?channel_id=channel-A');
state.selected = 'channel-B';
assert.equal(navigation.connect(), true);
assert.equal(navigated.at(-1), '/api/tiktok-shop/connect?channel_id=channel-B', 'CTA must resolve the current channel at click time');
state.selected = 'missing-channel';
assert.equal(navigation.connect(), false);
state.selected = null;
assert.equal(navigation.connect(), false);
assert.equal(navigation.showManagement(), false);
assert.equal(navigated.length, 2, 'missing selection must never navigate');

assert.doesNotMatch(source, /หน้า\s*1|ไปหน้า/);
assert.doesNotMatch(html, />\s*[12]\s+(?:ตั้งค่าช่อง|จัดการสินค้า)/);
assert.match(source, /data-connect-selected-shop>เชื่อม TikTok Shop สำหรับช่องนี้/);
assert.match(source, /tiktokShopNavigation\.showTab\(button\.dataset\.channelView\)/);
assert.match(source, /connectTikTokShop[^]*?preventDefault\(\)[^]*?tiktokShopNavigation\.connect\(\)/);
assert.match(source, /manageChannelConnections[^]*?showManagement\(\)/);
assert.ok(source.indexOf('$("#manageChannelConnections").hidden = true;') < source.indexOf('const data = await fetchTikTokConnectionData(requestedChannelId)'), 'management must remain hidden while a new channel connection is loading');
assert.match(source, /shop-connection-missing", !shopConnection/);
assert.match(source, /shopConnectionRequired"\)\.hidden = Boolean\(shopConnection\)/);
assert.match(source, /ยังไม่มีข้อมูลค่าคอมของช่องนี้/);
assert.match(source, /กด “\+ ช่องใหม่”/);
assert.match(html, /id="shopConnectionManagement"/);
assert.match(html, /id="disconnectTikTokShop"/);
assert.match(css, /\.manage-channel-connections/);

assert.equal(version.trim(), 'v0.20.65');
assert.match(home, /WEB v0\.20\.65/);
assert.match(admin, /ADMIN v0\.20\.65/);
assert.match(html, /<b>v0\.20\.64<\/b>/);
assert.match(html, /tiktok-analyzer\.css\?v=02094/);
assert.match(html, /tiktok-analyzer\.js\?v=02125/);

console.log('PASS v0.20.64 TikTok Shop CTA selection, two-tab output restore, empty states and zero-fetch navigation');
