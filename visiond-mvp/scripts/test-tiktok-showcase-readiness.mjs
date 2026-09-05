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

const [callback, endpoint, client] = await Promise.all([
  read("functions/api/tiktok-shop/callback.js"),
  read("functions/api/admin/tiktok-connections/index.js"),
  read("public/tiktok-analyzer.js"),
]);
assert.match(callback, /permissions_required/);
assert.match(endpoint, /shop_connections: shopConnections\.map/);
assert.match(endpoint, /เพิ่มสินค้าเข้า Showcase แล้ว แต่ดึงรายการล่าสุดกลับมาแสดงยังไม่สำเร็จ/);
assert.match(endpoint, /TikTok ปฏิเสธสินค้าทุกรายการ/);
assert.match(client, /showcasePermission/);
assert.match(client, /เชื่อมบัญชี Creator และอนุญาตสิทธิ์ใหม่/);
assert.match(client, /Showcase ของ/);
console.log("TikTok Creator to Showcase readiness regression: PASS");
