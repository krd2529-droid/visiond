import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { searchTikTokShopOpenCollaborationProducts } from "../functions/_tiktok_shop_api.js";
import { encryptChannelValue } from "../functions/_channel_crypto.js";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");
const start = client.indexOf('const marketplaceProductButton = $("#marketplaceSearchForm .marketplace-search-main button");');
const end = client.indexOf("function shopDateQuery", start);
assert.ok(start >= 0 && end > start, "Marketplace search setup exists");

const fields = new Map();
const main = [];
const button = {
  type: "submit",
  classList: { add(name) { this[name] = true; } },
  textContent: "",
  before(label) { main.splice(main.indexOf(button), 0, label); label.parent = main; },
};
const details = [];
for (const id of ["marketplaceCommissionMin", "marketplaceCommissionMax"]) {
  const label = { id: `${id}-label`, hidden: false, firstChild: { textContent: id === "marketplaceCommissionMax" ? "ค่าคอมสูงสุด (%)" : "ค่าคอมต่ำสุด (%)" }, classList: { add(name) { this[name] = true; } } };
  const input = { id, value: "", closest(name) { assert.equal(name, "label"); return label; } };
  label.input = input;
  details.push(label);
  fields.set(id, input);
}
main.push(button);
vm.runInNewContext(client.slice(start, end), {
  $: selector => selector === "#marketplaceSearchForm .marketplace-search-main button"
    ? button : fields.get(selector.slice(1)),
});

assert.deepEqual(main.map(node => node.id || "submit"), [
  "marketplaceCommissionMin-label", "marketplaceCommissionMax-label", "submit",
]);
assert.equal(details.every(label => label.parent === main && label.classList["marketplace-commission-field"]), true);
assert.equal(details[0].firstChild.textContent, "ค่าคอมต่ำสุด (%)");
assert.equal(details[1].firstChild.textContent, "ค่าคอมต่ำกว่า (%)", "upper bound matches TikTok's exclusive rate_lt");
assert.equal(button.classList["marketplace-search-button"], true, "permission gate still selects this button");
assert.equal(button.type, "submit", "search still submits the existing Marketplace form");
assert.match(button.textContent, /ค่าคอม \(%\)/);
assert.match(css, /#marketplaceSearchForm \.marketplace-search-main>\.marketplace-commission-field:nth-of-type\(4\)\{grid-column:1\/2\}/);
assert.match(css, /#marketplaceSearchForm \.marketplace-search-main>\.marketplace-commission-field:nth-of-type\(5\)\{grid-column:2\/3\}/);
assert.match(css, /#marketplaceSearchForm \.marketplace-commission-field\[hidden\]\{display:none!important\}/,
  "delegate hidden labels must override the global label display rule");
assert.match(css, /body\.vx-workspace-delegate #marketplaceSearchForm \.marketplace-search-main>\.marketplace-search-button\{grid-column:1\/5\}/);
assert.match(client, /for\(const id of\['marketplaceCommissionMin','marketplaceCommissionMax'\]\)\$\("#"\+id\)\?\.closest\('label'\)\?\.setAttribute\('hidden',''\)/,
  "delegate access still hides both percent fields");
assert.match(client, /\$\("#marketplaceSearchForm"\)\.addEventListener\("submit", async \(event\) =>/);
assert.match(client, /commission_percent_min:\$\("#marketplaceCommissionMin"\)\.value,commission_percent_max:\$\("#marketplaceCommissionMax"\)\.value/);

const env = { TIKTOK_SHOP_APP_KEY: "app", TIKTOK_SHOP_APP_SECRET: "secret", VISIOND_CHANNEL_ENCRYPTION_KEY: "test-encryption-key-with-at-least-32-characters" };
const connection = { id: "test", scopes: "creator.affiliate_collaboration.read", access_token_ciphertext: await encryptChannelValue(env, "access"), access_expires_at: new Date(Date.now() + 864e5).toISOString() };
let upstreamBody;
const result = await searchTikTokShopOpenCollaborationProducts(env, connection, { commissionPercentMin: 5, commissionPercentMax: 25, resultLimit: 1 }, async (_url, options) => {
  upstreamBody = JSON.parse(options.body);
  return Response.json({ code: 0, data: { products: [{ id: "p1", title: "matching product", commission_rate: 1200 }], next_page_token: "" } });
});
assert.deepEqual(upstreamBody.commission_rate_range, { rate_ge: 500, rate_lt: 2500 });
assert.equal(result.products[0].product_id, "p1");

console.log("TikTok Marketplace visible commission range UI: PASS");
