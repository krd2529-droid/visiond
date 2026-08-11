import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const shared = readFileSync('public/shared-nav.js', 'utf8');
const account = readFileSync('public/nav-account.js', 'utf8');

assert.match(shared, /header-utility'\)\?\.remove\(\)/, 'canonical nav removes stale utility actions before rebuilding');
assert.match(account, /header\.querySelectorAll\('a\[href="\/login\.html"\],a\[href="\/register\.html"\]'\)/, 'signed-in cleanup covers the whole header');
assert.match(account, /header\.querySelectorAll\('\.nav-member-account,\.course-owner-badge,\.nav-logout'\)/, 'account actions are deduplicated before insertion');
assert.match(account, /header\.querySelectorAll\('\.nav-admin-link'\)/, 'admin action is globally deduplicated');

for (const file of globSync('public/**/*.html')) {
  const html = readFileSync(file, 'utf8');
  if (html.includes('shared-nav.js')) {
    assert.doesNotMatch(html, /shared-nav\.js\?v=014134/, `${file} must not cache the duplicate-action initializer`);
  }
}

assert.equal(readFileSync('VERSION.txt', 'utf8').trim(), 'v0.14.135');
console.log('v0.14.135 canonical header actions hotfix PASS');
