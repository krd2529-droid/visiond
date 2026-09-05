import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html"), client = read("public/tiktok-analyzer.js"), css = read("public/tiktok-analyzer.css"), helper = read("functions/_tiktok_shop_api.js"), connections = read("functions/api/admin/tiktok-connections/index.js");

assert.doesNotMatch(html, /channelOutputSelect|ช่องที่ต้องการจัดการ|addShowcaseForm|showcaseProductId|เพิ่มด้วยรหัสสินค้า TikTok Shop|syncTikTok"|disconnectTikTok"/);
assert.doesNotMatch(client, /channelOutputSelect|renderChannelOutputOptions|addShowcaseForm|showcaseProductId|\$\("#syncTikTok"\)|\$\("#disconnectTikTok"\)/);
assert.doesNotMatch(css, /channel-output-picker/);
assert.match(html, /หมวดหมู่สินค้า<select id="marketplaceCategory">/);
assert.match(html, /ทุกหมวดหมู่/);
assert.match(client, /renderMarketplaceCategories\(data\.categories \|\| \[\]\)/);
assert.match(helper, /category_id: category\.id, category_name: category\.name/);
assert.match(helper, /return \{ products, categories,/);
assert.match(html, /รีเฟรชสินค้าและออเดอร์ TikTok Shop/);
assert.match(html, /จัดการการเชื่อมต่อ TikTok Shop/);
assert.match(html, /id="disconnectTikTokShop"[^>]*>ยกเลิกการเชื่อมต่อ</);
assert.match(html, /id="showcaseSyncLimit"[^>]+min="1"[^>]+max="2000"[^>]+value="2000"/);
assert.match(client, /max_showcase: maxShowcase/);
assert.match(client, /Math\.min\(2000, Math\.max\(1,/);
assert.match(connections, /body\.max_showcase/);
assert.match(connections, /Math\.min\(2000, Math\.max\(1,/);
assert.match(helper, /maxShowcase = Math\.min\(2000, Math\.max\(1,/);
console.log("TikTok simplified Marketplace UI regression: PASS");
