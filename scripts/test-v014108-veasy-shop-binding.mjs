import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const shop = read("functions/_veasy_shop.js");
const bind = read("functions/api/vision7/shops/bind.js");
const activate = read("functions/api/vision7/auth/veasy-activate.js");
const keyCenter = read("functions/_vision7_key_center.js");

assert.match(shop, /license_id TEXT NOT NULL UNIQUE/);
assert.match(shop, /trg_veasy_shop_license_platform_insert/);
assert.match(shop, /trg_veasy_shop_license_platform_update/);
assert.match(shop, /lower\(p\.platform_type\)='veasy'/);
assert.match(shop, /l\.id=NEW\.license_id AND l\.user_id=NEW\.user_id/);
assert.match(shop, /RAISE\(ABORT,'VEASY_LICENSE_REQUIRED'\)/);
assert.match(shop, /ownedVEasyLicense[\s\S]*p\.platform_type='veasy'/);
assert.match(bind, /ownedVEasyLicense/);
assert.match(bind, /VEASY_KEY_ALREADY_BOUND/);
assert.match(bind, /WHERE NOT EXISTS\(SELECT 1 FROM veasy_shops WHERE license_id=\? OR meta_page_id=\?\)/);
assert.match(activate, /p\.platform_type='veasy'/);
assert.match(keyCenter, /==='veasy'\?'unbound':'not_required'/);
assert.doesNotMatch(read("functions/api/vision7/activate.js"), /veasy_shops|binding_state='bound'/);

console.log("v0.14.108 V Easy one-key-one-shop server enforcement passed");
