import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js"), css = read("public/tiktok-analyzer.css"), html = read("public/tiktok-analyzer.html");

assert.match(html, /<h3 id="marketplaceTitle">ค้นหาสินค้านางฟ้า<\/h3>/);
assert.doesNotMatch(html, /ค้นหา Open Collaboration Marketplace/);
assert.doesNotMatch(html, /ผลค้นหาเป็นข้อมูลจาก TikTok ณ เวลาที่กดค้นหา/);
assert.doesNotMatch(html, /ผลค้นหาเป็นข้อมูลจาก TikTok ณ เวลาที่กดค้นหา/);
assert.match(client, /class="marketplace-search-choices"/);
assert.match(client, /<h4>ค้นหาจากชื่อสินค้า<\/h4>/);
assert.match(client, /<h4>ค้นหาจากชื่อร้านค้า<\/h4>/);
assert.match(client, /<p class="marketplace-shop-search-note">ค้นหาชื่อร้านค้าจากผลสินค้าที่ TikTok ส่งมา · สูงสุด 200 รายการต่อครั้ง<\/p>/);
assert.doesNotMatch(client, /กรองจากผล Marketplace ที่ TikTok ส่งมา/);
assert.match(css, /\.marketplace-shop-search-note\{/);
assert.match(client, /data-search-mode="product">ค้นหาสินค้า<\/button>/);
assert.match(client, /data-search-mode="shop">ค้นหาชื่อร้านค้า<\/button>/);
assert.match(client, /marketplaceSearchMode: "product"/);
assert.match(client, /event\.submitter\?\.dataset\.searchMode === "shop"/);
assert.match(client, /keyword: shopMode \? "" : \$\("#marketplaceKeyword"\)\.value\.trim\(\)/);
assert.match(client, /shop_keyword: shopMode \? \$\("#marketplaceShopKeyword"\)\?\.value\.trim\(\) \|\| "" : ""/);
assert.match(client, /\$\("#marketplaceSearchForm"\)\.querySelectorAll\("\.marketplace-search-button"\)/);
assert.match(css, /\.marketplace-search-choices\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /@media\(max-width:800px\)\{\.marketplace-search-choices\{grid-template-columns:1fr\}/);
assert.match(html, /tiktok-analyzer\.js\?v=02073/);
assert.match(html, /tiktok-analyzer\.css\?v=02073/);

console.log("TikTok Marketplace separated product/shop search: PASS");
