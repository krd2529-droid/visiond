import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const client=read('public/tiktok-analyzer.js'),html=read('public/tiktok-analyzer.html'),api=read('functions/_tiktok_shop_api.js'),market=read('functions/api/admin/tiktok-connections/marketplace.js'),channels=read('functions/api/admin/tiktok-analyzer/index.js'),login=read('functions/api/auth/login.js'),v7=read('functions/_vision7_auth.js'),shopConnect=read('functions/api/tiktok-shop/connect.js'),shopCallback=read('functions/api/tiktok-shop/callback.js'),oauth=read('functions/_tiktok_shop_oauth.js');
assert.doesNotMatch(html,/reviewDemoLink|review_demo=1|reviewDemoNotice/);
assert.doesNotMatch(client,/reviewDemo|review_demo|demoShopData|demoChannels|renderPendingShopDashboard/);
assert.match(client,/soldProductsPanel/);assert.match(client,/รีเฟรชสินค้าที่ขายได้และออเดอร์/);assert.match(client,/showcaseTableControls/);
assert.match(client,/showcaseHeading = \$\("#channelShopAnalysis \.showcase-panel \.showcase-heading"\)/);
assert.ok(client.indexOf('soldProductsPanel')<client.indexOf('marketplaceShopKeyword'));
assert.match(client,/role="option" aria-selected/);assert.match(client,/channel-card-avatar/);
assert.match(client,/A = 30 ออเดอร์ขึ้นไป/);assert.match(client,/ไม่มีเกรด = 0 ออเดอร์/);
assert.match(api,/shop_name/);assert.match(api,/published_at/);assert.match(api,/normalizedShopKeyword/);assert.match(market,/shopKeyword/);assert.match(client,/marketplaceShopKeyword/);
assert.match(shopConnect,/created_by=\?/);assert.match(shopConnect,/archived_at IS NULL/);assert.match(shopCallback,/channel_id=/);assert.doesNotMatch(oauth,/expires_at<=CURRENT_TIMESTAMP OR user_id/);
assert.match(channels,/c\.created_by=\?/);assert.match(channels,/AND created_by=\?/);
assert.match(login,/u\.role!=='boss'/);assert.match(login,/DELETE FROM sessions WHERE user_id=\?/);assert.match(v7,/user\?\.role!=='boss'/);
for(const slug of ['analyze-tiktok-shop-products','tiktok-open-collaboration-showcase','create-powerpoint-online']){const article=read(`public/blog/${slug}.html`);assert.match(article,/rel="canonical"/);assert.match(article,/application\/ld\+json/);assert.match(read('public/sitemap.xml'),new RegExp(slug));}
assert.equal(read('VERSION.txt').trim(),'v0.20.49');
console.log('VisionD nine-queue delivery contract: PASS');
