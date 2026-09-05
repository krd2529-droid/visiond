import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tikTokShopCreatorCapabilities } from "../functions/_tiktok_shop_oauth.js";

const read = file => readFile(new URL(`../${file}`, import.meta.url), "utf8");

assert.deepEqual(tikTokShopCreatorCapabilities("creator.affiliate_collaboration.read, creator.showcase.write"), {
  can_search_marketplace: true,
  can_write_showcase: true,
  showcase_ready: true,
  missing_scopes: [],
});
assert.equal(tikTokShopCreatorCapabilities(["creator.affiliate_collaboration.read", "creator.video.write"]).showcase_ready, true);
const incomplete = tikTokShopCreatorCapabilities("creator.affiliate_collaboration.read");
assert.equal(incomplete.showcase_ready, false);
assert.equal(incomplete.can_write_showcase, false);
assert.match(incomplete.missing_scopes.join(","), /creator\.showcase\.write/);

const [callback, endpoint, client, html, css] = await Promise.all([
  read("functions/api/tiktok-shop/callback.js"),
  read("functions/api/admin/tiktok-connections/index.js"),
  read("public/tiktok-analyzer.js"),
  read("public/tiktok-analyzer.html"),
  read("public/tiktok-analyzer.css"),
]);
assert.match(callback, /permissions_required/);
assert.match(endpoint, /shop_connections: shopConnections\.map/);
assert.match(endpoint, /เพิ่มสินค้าเข้า Showcase แล้ว แต่ดึงรายการล่าสุดกลับมาแสดงยังไม่สำเร็จ/);
assert.match(endpoint, /TikTok ปฏิเสธสินค้าทุกรายการ/);
assert.match(client, /showcasePermission/);
const permissionRenderer = client.match(/function renderShowcasePermission[\s\S]*?\n\}/)?.[0] || "";
assert.match(permissionRenderer, /#tiktokConnectionState/);
assert.match(permissionRenderer, /data-update-shop-permissions/);
assert.match(permissionRenderer, /href="\/api\/tiktok-shop\/connect/);
assert.match(permissionRenderer, /เชื่อมใหม่เพื่ออัปเดตสิทธิ์/);
assert.doesNotMatch(permissionRenderer, /#channelShopAnalysis|data-open-channel-settings|ไปตั้งค่าช่อง/);
assert.match(client, /\$\("#connectTikTokShop"\)\.hidden = Boolean\(shopConnection\)/);
assert.match(client, /\$\("#connectTikTok"\)\.hidden = false/);
assert.match(client, /connection \? "เชื่อมใหม่ TikTok OAuth" : "เชื่อม TikTok OAuth"/);
assert.match(css, /\.workspace-output #tiktokConnection/);
assert.match(css, /\.showcase-permission a\{/);
assert.match(client, /เชื่อมบัญชี Creator/);
assert.match(client, /Showcase ของ/);
assert.match(html, /class="oauth-connection-card"[\s\S]*TikTok OAuth[\s\S]*id="connectTikTok"/);
assert.match(html, /id="shopConnectionManagement"[\s\S]*TikTok Shop Creator OAuth[\s\S]*id="connectTikTokShop"[\s\S]*id="disconnectTikTokShop"/);
assert.match(html, /tiktok-analyzer\.js\?v=02063/);
assert.match(html, /tiktok-analyzer\.css\?v=02064/);
assert.match(html, /ยกเลิกการเชื่อมต่อ/);
assert.match(css, /\.shop-connection-management>div\{display:flex[^}]*flex-wrap:nowrap/);
assert.match(css, /@media\(max-width:600px\)[^{]*\{\.shop-connection-management>div\{display:grid/);
console.log("TikTok Creator to Showcase readiness regression: PASS");
