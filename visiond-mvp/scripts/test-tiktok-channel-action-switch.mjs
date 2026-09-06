import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js"), css = read("public/tiktok-analyzer.css"), html = read("public/tiktok-analyzer.html");
assert.match(client, /id="channelActionSwitch"/);
assert.match(client, /data-channel-view="products"[^>]*>จัดการสินค้า/);
assert.match(client, /data-channel-view="commission"[^>]*>ดูค่าคอม/);
assert.match(client, /function setChannelView\(view\)/);
assert.match(client, /setChannelView\("products"\);await selectChannel/);
assert.match(client, /\$\("#channels"\)\.addEventListener\("click", \(\) => \{[\s\S]*setChannelView\("products"\)/);
assert.match(client, /ค่าคอมของช่องที่เลือก/);
assert.match(css, /\.channel-action-switch\{/);
assert.match(css, /\.channel-view-products #shopDashboard\{display:none!important\}/);
assert.match(css, /\.channel-view-commission #channelShopAnalysis,\.channel-view-commission #result,\.channel-view-commission #angelInventory\{display:none!important\}/);
assert.match(html, /tiktok-analyzer\.js\?v=02119/);
assert.match(html, /tiktok-analyzer\.css\?v=02089/);
console.log("TikTok selected-channel product/commission action switch: PASS");
