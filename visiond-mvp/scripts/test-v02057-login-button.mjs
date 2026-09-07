import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const sharedNav = fs.readFileSync(new URL('public/shared-nav.js', root), 'utf8');
const htmlFiles = fs.readdirSync(new URL('public/', root)).filter(name => name.endsWith('.html'));
const storefrontPages = htmlFiles.filter(name => fs.readFileSync(new URL(`public/${name}`, root), 'utf8').includes('shared-nav.js?v='));

assert.match(sharedNav, /id="navLogin" class="login-link" href="\/login\.html">เข้าสู่ระบบ<\/a>/);
assert.match(sharedNav, /id="navRegister" class="signup-link" href="\/register\.html">สมัครสมาชิก<\/a>/);
assert.ok(storefrontPages.length >= 10);
for (const name of storefrontPages) {
  const html = fs.readFileSync(new URL(`public/${name}`, root), 'utf8');
  assert.match(html, /shared-nav\.js\?v=02057/, `${name} must load the current shared navigation`);
}
console.log(`PASS v0.20.57 login button on ${storefrontPages.length} storefront pages`);

const styles = fs.readFileSync(new URL('public/style.css', root), 'utf8');
assert.ok(styles.includes(':is(.signup-link,.login-link)'));
assert.ok(sharedNav.indexOf('id="navLogin"') < sharedNav.indexOf('id="navRegister"'), 'login precedes registration');
for (const name of htmlFiles) {
  const html = fs.readFileSync(new URL(`public/${name}`, root), 'utf8');
  for (const ref of html.matchAll(/(?:href|src)="\/style\.css\?v=([^" ]+)/g)) assert.equal(ref[1], '02057', name);
}
