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
assert.match(client, /เชื่อมใหม่เพื่ออัปเดตสิทธิ์/);
assert.match(client, /เชื่อมบัญชี Creator/);
assert.match(client, /Showcase ของ/);
assert.match(html, /id="shopConnectionManagement"[\s\S]*จัดการการเชื่อมต่อ TikTok Shop[\s\S]*id="connectTikTokShop"[\s\S]*id="disconnectTikTokShop"/);
assert.match(html, /ยกเลิกการเชื่อมต่อ/);
assert.match(css, /\.shop-connection-management>div\{display:flex[^}]*flex-wrap:nowrap/);
assert.match(css, /@media\(max-width:600px\)[^{]*\{\.shop-connection-management>div\{display:grid/);
console.log("TikTok Creator to Showcase readiness regression: PASS");
