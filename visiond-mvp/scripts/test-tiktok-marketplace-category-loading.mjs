import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const endpoint = read("functions/api/admin/tiktok-connections/marketplace.js");
const helper = read("functions/_tiktok_shop_api.js");

assert.match(client, /async function loadMarketplaceCategories\(context = channelOwnership\.capture\(\)\)/);
assert.match(client, /channel_id: context\.channelId, categories_only: true/, "category discovery must stay bound to its captured channel");
assert.match(client, /กำลังโหลดหมวดหมู่จาก TikTok/);
assert.match(client, /state\.marketplaceCategoriesForConnection === connection\.id/);
assert.match(client, /state\.marketplaceCategoriesLoadingForConnection === connection\.id/);
assert.match(client, /channelOwnership\.current\(context\)&&state\.shopConnection\?\.id === connection\.id/);
assert.match(client, /if \(shopConnection\) loadMarketplaceCategories\(context\)/);
assert.match(endpoint, /body\.categories_only === true/);
assert.match(endpoint, /categories: categoriesFromStoredProducts\(rows\)/, "stored-only discovery must return locally indexed category data");
assert.ok(endpoint.indexOf("body.categories_only === true") < endpoint.indexOf("tiktok_shop_marketplace_snapshots"), "category discovery must return before snapshot writes");
assert.match(helper, /products\.filter\(product => product\.category_id && product\.category_name\)/);

console.log("TikTok Marketplace automatic category loading: PASS");
