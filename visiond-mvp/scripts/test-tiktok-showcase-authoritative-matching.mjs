import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const normalize = source.match(/const normalizeProductName = [^;]+;/)?.[0] || "";
const similarity = source.match(/function productNameSimilarity\(left, right\) \{[\s\S]*?\n\}/)?.[0] || "";
const identities = source.match(/const productIdentityIds = [^;]+;/)?.[0] || "";
assert.ok(normalize && similarity && identities, "matching helpers must remain executable");

const context = {};
vm.createContext(context);
vm.runInContext(`${normalize}\n${similarity}\n${identities}\nglobalThis.similarity=productNameSimilarity;globalThis.ids=productIdentityIds;`, context);

assert.ok(context.similarity("Moo Deng Baby ชุดเด็กผู้หญิง เสื้อผ้าเด็ก", "moodengbabyชุดเด็กผู้หญิง") >= .65, "spacing and a longer suffix must not prevent a strong match");
assert.ok(context.similarity("กระดาษทิชชู 1280 แผ่น", "กระดาษทิชชู 1000 แผ่น") < .65, "conflicting numeric variants must not be merged");
assert.deepEqual([...context.ids("https://shop.test/product/1735398790967953186 รายการ 1735398790967953186")], ["1735398790967953186"]);
assert.match(source, /const mergedProducts = showcaseProducts\.sort/);
assert.doesNotMatch(source, /const analyzedOnly = inventory\.filter/);

console.log("TikTok Showcase authoritative matching: PASS");
