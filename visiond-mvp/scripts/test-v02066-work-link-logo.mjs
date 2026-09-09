import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = (file) => fs.readFile(file, 'utf8');
const [source, css, html, version, indexHtml, adminHtml] = await Promise.all([
  'public/work-links.js',
  'public/work-links.css',
  'public/work-links.html',
  'VERSION.txt',
  'public/index.html',
  'public/admin.html'
].map(read));

class FakeTarget {
  constructor(text = '') { this._text = text; this.children = []; }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); this.children = []; }
  append(node) { node.parent = this; this.children.push(node); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; for (const node of nodes) node.parent = this; }
}

class FakeImage {
  constructor(mode = 'pending') {
    this.mode = mode;
    this.listeners = {};
    this.complete = false;
    this.naturalWidth = 0;
    this.listenersBeforeSrc = false;
  }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  set src(value) {
    this._src = value;
    this.listenersBeforeSrc = Boolean(this.listeners.load && this.listeners.error);
    if (this.mode === 'cached-load') { this.complete = true; this.naturalWidth = 32; }
    if (this.mode === 'cached-error') { this.complete = true; this.naturalWidth = 0; }
  }
  get src() { return this._src; }
  emit(name) { this.listeners[name]?.(); }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((node) => node !== this);
    this.parent = null;
  }
}

const modes = [];
const images = [];
const document = {
  createElement(tagName) {
    assert.equal(tagName, 'img');
    const image = new FakeImage(modes.shift() || 'pending');
    images.push(image);
    return image;
  }
};
const start = source.indexOf('const platformIcons=');
const end = source.indexOf('function render()');
assert.ok(start >= 0 && end > start);
const context = vm.createContext({ document, URL });
vm.runInContext(`${source.slice(start, end)};globalThis.logoApi={iconUrl,addLogo}`, context);
const { addLogo, iconUrl } = context.logoApi;
const item = { platform: 'TikTok', url: 'https://partner.tiktokshop.com/path' };

const loaded = new FakeTarget('🔗');
addLogo(loaded, item, '', true);
const loadedImage = images.at(-1);
assert.equal(loadedImage.listenersBeforeSrc, true, 'load/error listeners must be attached before src');
assert.equal(loaded.textContent, '', 'the chain must not remain beside a pending image');
assert.deepEqual(loaded.children, [loadedImage]);
loadedImage.emit('load');
assert.equal(loaded.textContent, '');
assert.deepEqual(loaded.children, [loadedImage], 'successful tile must contain exactly one whole image');

const failed = new FakeTarget('🔗');
addLogo(failed, item, '', true);
const failedImage = images.at(-1);
failedImage.emit('error');
assert.equal(failed.textContent, '🔗');
assert.equal(failed.children.length, 0, 'failed tile must not retain a broken image');

modes.push('cached-load');
const cached = new FakeTarget('🔗');
addLogo(cached, item, '', true);
const cachedImage = images.at(-1);
assert.equal(cachedImage.listenersBeforeSrc, true);
assert.equal(cached.textContent, '');
assert.deepEqual(cached.children, [cachedImage], 'cached complete image must show without a fallback sibling');

modes.push('cached-error');
const cachedFailure = new FakeTarget('🔗');
addLogo(cachedFailure, item, '', true);
assert.equal(cachedFailure.textContent, '🔗');
assert.equal(cachedFailure.children.length, 0);

const badge = new FakeTarget();
addLogo(badge, item, 'platform-icon');
const badgeImage = images.at(-1);
assert.equal(badgeImage.className, 'platform-icon');
assert.deepEqual(badge.children, [badgeImage], 'compact badge behavior must remain unchanged');
badgeImage.emit('error');
assert.equal(badge.children.length, 0);

assert.equal(iconUrl(item), 'https://www.tiktok.com/favicon.ico');
assert.match(source, /addLogo\(logo,item,'',true\)/);
assert.match(source, /addLogo\(meta,item,'platform-icon'\)/);
assert.doesNotMatch(source, /logo\.textContent='🔗';addLogo\(logo,item\);/);
assert.match(css, /\.link-logo\{[^}]*place-items:center[^}]*line-height:1/);
assert.match(css, /\.link-logo img\{[^}]*width:32px[^}]*height:32px[^}]*object-fit:contain/);
assert.match(html, /work-links\.js\?v=02067/);
assert.match(html, /work-links\.css\?v=014590/);
assert.equal(version.trim(), 'v0.20.70');
assert.match(indexHtml, /WEB v0\.20\.70/);
assert.match(adminHtml, /ADMIN v0\.20\.70/);

console.log('PASS v0.20.66 work-link logo single-image load, cached completion and fallback-only error states');
