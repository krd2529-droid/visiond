import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, index, admin, adminJs, categoriesApi, storefrontApi, ledger] = await Promise.all([
  read('VERSION.txt'),
  read('public/index.html'),
  read('public/admin.html'),
  read('public/admin.js'),
  read('functions/api/admin/categories/index.js'),
  read('functions/api/products/index.js'),
  read('patch-ledgers/v0.14.182.json'),
]);

assert.equal(version.trim(), 'v0.14.182');
assert.match(index, /WEB v0\.14\.182/);
assert.match(admin, /ADMIN v0\.14\.182/);
assert.match(admin, /\/admin\.js\?v=014182/);
for (const condition of [
  "p.status='published'",
  'p.deleted_at IS NULL',
  "COALESCE(p.product_kind,'product')='product'",
  "(p.category<>'resale-rights' OR p.slug='course-selling-rights')",
]) {
  assert.ok(categoriesApi.includes(condition), `admin category count is missing storefront condition: ${condition}`);
  assert.ok(storefrontApi.includes(condition), `storefront query is missing shared condition: ${condition}`);
}
assert.doesNotMatch(categoriesApi, /WHERE p\.category=c\.slug\) product_count/);
assert.match(adminJs, /const populatedFamilies = new Set/);
assert.match(adminJs, /Number\(category\.product_count\) > 0 \|\| !populatedFamilies\.has\(categoryFamily\(category\)\)/);
assert.equal(JSON.parse(ledger).patch, 'v0.14.182');
console.log('v0.14.182 storefront/admin category count parity: PASS');
