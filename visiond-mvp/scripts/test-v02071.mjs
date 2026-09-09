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
const start = source.indexOf('function createTikTokConnectionPreflight');
const end = source.indexOf('function tiktokShopActionVisibility', start);
assert.ok(start >= 0 && end > start, 'preflight controller source must exist');
const sandbox = vm.createContext({ URL, navigator: {}, location: { origin: 'https://visiondonline.com' } });
vm.runInContext(`${source.slice(start, end)}\nthis.createPreflight=createTikTokConnectionPreflight;`, sandbox);

const makeDialog = () => {
  const names = ['provider', 'channel', 'warning', 'confirm', 'status', 'manual', 'url', 'cancel', 'copy'];
  const fields = Object.fromEntries(names.map(name => [name, {
    textContent: '', value: '', hidden: false, disabled: false, dataset: {}, listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    focus() { this.focused = true; }, select() { this.selected = true; }
  }]));
  const dialog = {
    open: false, listeners: {}, fields,
    querySelector(selector) { return fields[selector.match(/data-preflight-([^\]]+)/)?.[1]] || null; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    showModal() { this.open = true; }, close() { this.open = false; }
  };
  return dialog;
};

let selected = 'A', generation = 1, channels = new Map([['A', 'สัตว์โลกพิศวง'], ['B', 'โล๊ะสต็อคโรงงาน']]);
let writes = [], navigations = [], networkCalls = 0;
const dialog = makeDialog();
const makeIntent = mode => mode === 'tiktok_new'
  ? { mode, revision: generation, channelId: '', channelName: '' }
  : channels.has(selected) ? { mode, generation, channelId: selected, channelName: channels.get(selected) } : null;
const current = target => target.mode === 'tiktok_new'
  ? target.revision === generation
  : target.generation === generation && target.channelId === selected && channels.has(target.channelId);
let clipboard = { writeText: async value => { writes.push(value); } };
const controller = sandbox.createPreflight({
  dialog, getIntent: makeIntent, isCurrent: current,
  navigate: value => { navigations.push(value); }, getClipboard: () => clipboard,
  origin: 'https://visiondonline.com'
});

assert.equal(controller.open('shop'), true);
assert.equal(dialog.fields.channel.textContent, 'สัตว์โลกพิศวง');
assert.equal(dialog.fields.provider.textContent, 'TikTok Shop Creator');
assert.match(dialog.fields.warning.textContent, /ไม่สามารถทราบหรือสลับบัญชี/);
const handoff = new URL(controller.handoffUrl('shop'));
assert.equal(handoff.origin, 'https://visiondonline.com');
assert.equal(handoff.pathname, '/tiktok-analyzer');
assert.deepEqual([...handoff.searchParams].sort(), [['channel_id', 'A'], ['connect', 'shop']]);

selected = 'B'; generation += 1;
assert.equal(controller.confirm(), false, 'captured A must not navigate after switching to B');
assert.equal(navigations.length, 0);
assert.equal(await controller.copy(), false, 'stale intent must not copy a misleading handoff');
assert.equal(writes.length, 0);

assert.equal(controller.open('tiktok'), true);
channels.delete('B');
assert.equal(controller.confirm(), false, 'removed target must not navigate');
channels.set('B', 'โล๊ะสต็อคโรงงาน');
assert.equal(controller.open('tiktok'), true);
assert.equal(controller.confirm(), true);
assert.equal(controller.confirm(), false, 'double confirmation must navigate exactly once');
assert.deepEqual(navigations, ['/api/tiktok/connect?channel_id=B']);

generation += 1;
assert.equal(controller.open('tiktok_new'), true);
assert.match(dialog.fields.channel.textContent, /ช่องใหม่/);
const newHandoff = new URL(controller.handoffUrl('tiktok_new'));
assert.equal(newHandoff.searchParams.get('connect'), 'tiktok_new');
assert.equal(newHandoff.searchParams.has('channel_id'), false, 'new intent must not inherit selected channel');
assert.equal(controller.confirm(), true);
assert.equal(navigations.at(-1), '/api/tiktok/connect?create=1');

generation += 1;
assert.equal(controller.open('shop'), true);
await controller.copy();
assert.equal(writes.at(-1), 'https://visiondonline.com/tiktok-analyzer?channel_id=B&connect=shop');
assert.equal(navigations.length, 2, 'copy must never start OAuth or another request');
clipboard = null;
assert.equal(await controller.copy(), false);
assert.equal(dialog.fields.manual.hidden, false);
assert.equal(dialog.fields.url.value, 'https://visiondonline.com/tiktok-analyzer?channel_id=B&connect=shop');
assert.equal(dialog.fields.url.focused, true);
assert.equal(dialog.fields.url.selected, true);
clipboard = { get writeText() { throw new Error('restricted'); } };
assert.equal(await controller.copy(), false, 'throwing clipboard access must remain an honest manual fallback');
assert.equal(networkCalls, 0);
let finishCopy;
clipboard = { writeText: () => new Promise(resolve => { finishCopy = resolve; }) };
const pendingCopy = controller.copy();
assert.equal(dialog.fields.copy.disabled, true);
assert.equal(await controller.copy(), false, 'rapid copy clicks must join the visible pending state without another write');
finishCopy();
assert.equal(await pendingCopy, true);
assert.equal(dialog.fields.copy.disabled, false);
dialog.listeners.cancel?.({ preventDefault() {} });
assert.equal(dialog.open, false);
assert.equal(controller.confirm(), false, 'Escape/cancelled dialog must discard intent');

assert.match(source, /if \(!handoffOpened && requestedConnectMode && requestedConnectMode !== "tiktok_new"\)/);
assert.match(source, /if \(!handoffChannelId\) throw new Error/);
assert.match(source, /const selected = await selectChannel\(handoffChannelId\)/);
assert.match(source, /sessionStorage\.setItem\('vd_return_to',`\$\{location\.pathname\}\$\{location\.search\}\$\{location\.hash\}`\)/);
const bootstrap = source.slice(source.indexOf('async function bootstrapReviewerAccess'));
assert.ok(bootstrap.indexOf("if(!response.ok)") < bootstrap.indexOf('pageAuthorized=true;'));
assert.ok(bootstrap.indexOf('pageAuthorized=true;') < bootstrap.indexOf('await loadChannels();'));
assert.doesNotMatch(source.slice(source.indexOf('$("#saveChannel")'), source.indexOf('form.addEventListener("submit"')), /pageAuthorized/);
assert.match(source, /connectTikTok"\)\?\.addEventListener[^]*?connectionPreflight\.open\("tiktok"\)/);
assert.match(source, /newChannel"\)\.addEventListener[^]*?connectionPreflight\.open\("tiktok_new"\)/);
assert.match(css, /\.connection-preflight/);
assert.match(source, /ช่อง VisionD และบัญชี TikTok เป็นคนละส่วนกัน/);
assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)[^\n]*connect/);
assert.doesNotMatch(source.slice(start, end), /account_id|open_id|access_token|auth_code|credential/);
assert.doesNotMatch(source.slice(start, end), /\b(?:fetch|api)\s*\(/);
assert.equal(version.trim(), 'v0.20.71');
assert.match(home, /WEB v0\.20\.71/);
assert.match(admin, /ADMIN v0\.20\.71/);
assert.match(html, /<b>v0\.20\.71<\/b>/);
assert.match(html, /tiktok-analyzer\.css\?v=02095/);
assert.match(html, /visiond-button-system\.css\?v=014407/);
assert.match(html, /tiktok-analyzer\.js\?v=02128/);
assert.match(source, /vds-btn vds-btn--secondary/);
assert.match(source, /vds-btn vds-btn--primary/);

console.log('PASS v0.20.71 account-aware preflight, stale-target refusal, safe handoff and zero-network copy');
