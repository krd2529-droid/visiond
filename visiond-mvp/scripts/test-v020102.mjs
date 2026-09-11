import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("public/tiktok-analyzer.js", "utf8");
const css = readFileSync("public/tiktok-analyzer.css", "utf8");
const render = source.match(/function renderMarketplaceProducts[\s\S]*?\n\}/)?.[0] || "";
assert.ok(render, "Marketplace renderer must exist");

const product = {
  product_id: "p-density-regression",
  name: "สินค้าทดสอบ",
  image_url: "",
  product_url: "https://example.test/product",
  shop_name: "ร้านทดสอบ",
  units_sold: 42,
  commission_rate: 1250,
  category_name: "หมวดทดสอบ",
  content_creator_count: 12,
  showcase_creator_count: 34,
  growth: { growth_percent: 8.5 },
  previous_snapshot_at: "2026-09-10T00:00:00.000Z",
};

for (const mode of ["product", "shop"]) {
  const box = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };
  const addButton = {};
  const snapshot = {};
  const view = { box, addButton, snapshot, products: [product], comparisonDays: 3, searchedAt: "2026-09-11T00:00:00.000Z" };
  const context = {
    state: { shopConnection: { creator_username: "creator-test" } },
    marketplaceView: () => view,
    safeProductImage: (value) => value || "",
    escapeHtml: (value) => String(value ?? ""),
    productLinkControl: () => '<a data-product-link>เปิดสินค้า</a>',
    channelOwnership: { capture: () => null },
    $: () => null,
  };
  vm.runInNewContext(`${render};renderMarketplaceProducts({},${JSON.stringify(mode)});`, context);

  const headings = [...box.innerHTML.matchAll(/<th>(.*?)<\/th>/g)].map((match) => match[1]);
  const firstRow = box.innerHTML.match(/<tbody><tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] || "";
  const cells = [...firstRow.matchAll(/<td(?:\s[^>]*)?>/g)];

  assert.equal(headings.length, 9, `${mode} headers must have nine columns`);
  assert.equal(cells.length, 9, `${mode} row must align with nine headers`);
  assert.doesNotMatch(box.innerHTML, /ความหนาแน่นครีเอเตอร์|creator-density|ทำคอนเทนต์|เก็บใน Showcase/);
  for (const heading of ["ร้านค้า", "ขายแล้ว", "ค่าคอม", "ลิงก์สินค้า", "Showcase", "ลิสต์คัดสินค้า"]) {
    assert.ok(headings.some((value) => value.includes(heading)), `${mode} must retain ${heading}`);
  }
  if (mode === "product") {
    assert.ok(headings.some((value) => value.includes("เติบโต 3 วัน")), "product growth column retained");
    assert.equal(headings[1], "สินค้า");
  } else {
    assert.ok(headings.includes("หมวดหมู่"), "shop category column retained");
    assert.equal(headings[1], "รูปและสินค้า");
  }
}

assert.doesNotMatch(render, /creatorDensity|content_creator_count|showcase_creator_count/);
assert.doesNotMatch(css, /\.creator-density/);

console.log("PASS v102 actual Marketplace render: density presentation absent, product/shop 9-column alignment retained");
