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
assert.match(permissionRenderer, /#shopConnectionManagement>strong/);
assert.match(permissionRenderer, /เชื่อมบัญชี .* แล้ว แต่สิทธิ์เพิ่มสินค้าเข้า Showcase ยังไม่ครบ/);
assert.match(permissionRenderer, /ข้อมูลที่ได้รับอนุญาตยังใช้งานได้ตามปกติ/);
assert.doesNotMatch(permissionRenderer, /data-update-shop-permissions|href="\/api\/tiktok-shop\/connect/);
assert.doesNotMatch(permissionRenderer, /#channelShopAnalysis|data-open-channel-settings|ไปตั้งค่าช่อง/);
assert.match(client, /\$\("#connectTikTokShop"\)\.hidden = Boolean\(shopConnection\?\.capabilities\?\.showcase_ready\)/);
assert.match(client, /\$\("#connectTikTok"\)\.hidden = false/);
assert.match(client, /connection \? "เชื่อมใหม่ TikTok OAuth" : "เชื่อม TikTok OAuth"/);
assert.match(client, /id="shopConnectionRequired"/);
assert.match(client, /TikTok OAuth ใช้ข้อมูลโปรไฟล์และวิดีโอ/);
assert.match(client, /data-open-shop-settings/);
assert.match(client, /#shopConnectionManagement/);
assert.match(client, /classList\.toggle\("shop-connection-missing", !shopConnection\)/);
assert.match(client, /\$\("#shopConnectionRequired"\)\.hidden = Boolean\(shopConnection\)/);
assert.doesNotMatch(client.match(/id="shopConnectionRequired"[\s\S]*?<\/section>/)?.[0] || "", /href="\/api\/tiktok-shop\/connect/);
assert.match(css, /\.workspace-output #tiktokConnection/);
assert.doesNotMatch(css, /\.showcase-permission a\{/);
assert.match(css, /\.channel-shop-analysis\.shop-connection-missing>\.sold-products-panel[\s\S]*>\.marketplace-panel[\s\S]*>\.showcase-panel\{display:none!important\}/);
assert.match(client, /เชื่อมบัญชี Creator/);
assert.match(client, /Showcase ของ/);
assert.match(html, /class="oauth-connection-card"[\s\S]*TikTok OAuth[\s\S]*id="connectTikTok"/);
assert.match(html, /id="shopConnectionManagement"[\s\S]*TikTok Shop Creator OAuth[\s\S]*id="connectTikTokShop"[\s\S]*id="disconnectTikTokShop"/);
assert.match(html, /tiktok-analyzer\.js\?v=02072/);
assert.match(html, /tiktok-analyzer\.css\?v=02071/);
assert.match(html, /ยกเลิกการเชื่อมต่อ/);
assert.match(css, /\.shop-connection-management>div\{display:flex[^}]*flex-wrap:nowrap/);
assert.match(css, /@media\(max-width:600px\)[^{]*\{\.shop-connection-management>div\{display:grid/);
console.log("TikTok Creator to Showcase readiness regression: PASS");
