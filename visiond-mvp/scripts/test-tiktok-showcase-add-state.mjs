import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
assert.match(html, /\/tiktok-analyzer\.js\?v=02166/, "published page must request the updated Showcase behavior");
const extract = (name) => {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} must be testable`);
  return match[0];
};

const product = { product_id: "factory-product-1", name: "Factory product" };
const state = {
  selected: "factory-channel",
  marketplaceProducts: [product],
  showcaseProducts: [],
  shopConnection: { id: "factory-shop", channel_id: "factory-channel", creator_username: "factory", capabilities: { can_write_showcase: true } },
};
const box = { innerHTML: "", querySelectorAll: () => [] };
const addButton = { hidden: false, disabled: false, dataset: {} };
const snapshot = { textContent: "" };
const toasts = [];
const context = { channelId: "factory-channel" };
let apiResult = { ok: true, requested: 1, added: 1, errors: [], synced: true };
let confirmedProducts = [];
const sandbox = {
  state, box, addButton, snapshot, Date, Number, Boolean,
  marketplaceView: () => ({ box, addButton, snapshot, products: state.marketplaceProducts, searchedAt: null, comparisonDays: 3, nextToken: "" }),
  safeProductImage: () => "", escapeHtml: (value) => String(value ?? ""), productLinkControl: () => "–",
  $: () => null, channelOwnership: { capture: () => context, current: () => true },
  stampChannelOwnedActions: () => {},
  channelContextFor: () => context, showToast: (...args) => toasts.push(args),
  api: async () => apiResult,
  loadTikTokConnection: async () => { state.showcaseProducts = confirmedProducts; },
  document: { querySelectorAll: () => [] }, confirm: () => true,
};
vm.createContext(sandbox);
vm.runInContext(`let acceptedShowcaseAdds = { channelId: "", connectionId: "", ids: new Set() };\n${extract("acceptedShowcaseIdsForCurrentChannel")}\n${extract("renderMarketplaceProducts")}\n${extract("addProductsToShowcase")}\n${extract("showcaseAddErrorMessage")}\n${extract("removeShowcaseProducts")}\nglobalThis.render = renderMarketplaceProducts; globalThis.add = addProductsToShowcase; globalThis.remove = removeShowcaseProducts;`, sandbox);

const loaded = { ...state, showcaseProducts: [], connectionLoadSeq: 0 };
const stopAfterFactoryState = new Error("factory membership captured before hidden dashboard");
const loadSandbox = {
  state: loaded, String, Boolean,
  $: () => ({ hidden: false, classList: { toggle: () => {} } }),
  shopDateQuery: () => "factory-range",
  fetchTikTokConnectionData: async () => ({
    connections: [], shop_connections: [state.shopConnection], shop_products: [product],
  }),
  channelOwnership: { capture: () => context, current: () => true },
  tiktokShopActionVisibility: () => ({ connect: false }),
  tiktokShopNavigation: { connectUrl: () => "" },
  renderShowcasePermission: () => {},
  renderShopDashboard: () => { throw stopAfterFactoryState; },
};
vm.createContext(loadSandbox);
vm.runInContext(`let acceptedShowcaseAdds = { channelId: "", connectionId: "", ids: new Set() };\n${extract("loadTikTokConnection")}\nglobalThis.load = loadTikTokConnection;`, loadSandbox);
await assert.rejects(loadSandbox.load(context.channelId, context), stopAfterFactoryState);
assert.equal(loaded.showcaseProducts[0]?.product_id, product.product_id, "factory GET must own membership before delegated dashboard exits");

const rowButton = { disabled: false };
sandbox.render({ products: state.marketplaceProducts });
assert.match(box.innerHTML, /เพิ่มเข้า Showcase/, "snapshot alone does not prove Showcase membership");

confirmedProducts = [product];
await sandbox.add([product.product_id], rowButton);
assert.match(toasts.at(-1)[0], /เพิ่มสินค้าเข้า Showcase/);
assert.match(box.innerHTML, /เพิ่มแล้ว/, "authoritatively confirmed product must update its row");
assert.match(box.innerHTML, /<button class="marketplace-row-add" type="button" disabled>เพิ่มแล้ว<\/button>/, "confirmed row keeps button alignment and accessible disabled state");
assert.doesNotMatch(box.innerHTML, /data-add-marketplace-product="factory-product-1"/, "confirmed row cannot offer a second add");

state.showcaseProducts = [];
confirmedProducts = [];
await sandbox.add([product.product_id], rowButton);
assert.match(box.innerHTML, /เพิ่มแล้ว/, "exact TikTok single-row acceptance confirms addition despite bounded refresh");

state.shopConnection = { ...state.shopConnection, id: "other-shop", channel_id: "other-channel" };
state.selected = "other-channel";
sandbox.render({ products: state.marketplaceProducts });
assert.match(box.innerHTML, /data-add-marketplace-product="factory-product-1"/, "accepted IDs cannot leak to another channel");
state.shopConnection = { ...state.shopConnection, id: "factory-shop", channel_id: "factory-channel" };
state.selected = "factory-channel";
sandbox.api = async () => ({ removed: 1 });
await sandbox.remove([product.product_id], "สินค้า", rowButton);
assert.match(box.innerHTML, /data-add-marketplace-product="factory-product-1"/, "successful remove must clear accepted state and rerender retryable row");

apiResult = { ok: true, requested: 1, added: 0, errors: [], synced: true };
sandbox.api = async () => apiResult;
confirmedProducts = [product];
await sandbox.add([product.product_id], rowButton);
assert.equal(toasts.at(-1)[1], "warning", "preexisting membership with zero newly added cannot claim success");

state.showcaseProducts = [];
confirmedProducts = [];
sandbox.render({ products: state.marketplaceProducts });

apiResult = new Error("TikTok rejected this product");
apiResult.detail = [{ code: "PRODUCT_NOT_ELIGIBLE", message: "Product cannot be added" }];
sandbox.api = async () => { throw apiResult; };
await sandbox.add([product.product_id], rowButton);
assert.match(toasts.at(-1)[0], /PRODUCT_NOT_ELIGIBLE/);
assert.equal(toasts.at(-1)[1], "error");
assert.match(box.innerHTML, /data-add-marketplace-product="factory-product-1"/, "failed add stays retryable");
assert.equal(rowButton.disabled, false);
apiResult.detail = [{ error_code: "PRODUCT_RESTRICTED", error_message: "Restricted product" }];
await sandbox.add([product.product_id], rowButton);
assert.match(toasts.at(-1)[0], /PRODUCT_RESTRICTED: Restricted product/, "alternate provider detail fields remain visible");
console.log("TikTok Showcase add state: PASS");
