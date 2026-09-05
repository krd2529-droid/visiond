import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyMarketplaceError } from "../functions/api/admin/tiktok-connections/marketplace.js";
import { tikTokShopRequest } from "../functions/_tiktok_shop_api.js";

assert.deepEqual(classifyMarketplaceError({ message: "TIKTOK_SHOP_SCOPE_CREATOR_AFFILIATE_COLLABORATION_READ_REQUIRED" }), { status: 403, error: "สิทธิ์ค้นหา Marketplace ยังไม่พร้อม กรุณาเชื่อม TikTok Shop ใหม่", reconnect_required: true });
assert.equal(classifyMarketplaceError({ providerStatus: 401, providerMessage: "Access token expired" }).status, 401);
assert.equal(classifyMarketplaceError({ providerStatus: 429, providerMessage: "Too many requests" }).status, 429);
assert.equal(classifyMarketplaceError({ providerStatus: 400, providerMessage: "Invalid sort field" }).status, 422);
assert.equal(classifyMarketplaceError({ message: "The operation was aborted" }).status, 504);
assert.equal(classifyMarketplaceError({ providerStatus: 500, providerMessage: "Internal error" }).status, 502);

await assert.rejects(
  () => tikTokShopRequest({ appKey: "app", appSecret: "secret" }, "token", { path: "/test" }, async () => new Response(JSON.stringify({ code: 105001, message: "Access token expired", request_id: "req-123" }), { status: 401 })),
  error => error.providerStatus === 401 && error.providerMessage === "Access token expired" && error.requestId === "req-123" && error.code === 105001
);

const helper = fs.readFileSync("functions/_tiktok_shop_api.js", "utf8"), endpoint = fs.readFileSync("functions/api/admin/tiktok-connections/marketplace.js", "utf8"), client = fs.readFileSync("public/tiktok-analyzer.js", "utf8");
assert.match(helper, /error\.providerStatus = response\.status/);
assert.match(helper, /error\.providerMessage/);
assert.match(endpoint, /request_id:/);
assert.match(endpoint, /reconnect_required:/);
assert.match(client, /function marketplaceErrorMessage/);
assert.match(client, /TikTok: \$\{detail\}/);
assert.match(client, /Request ID: \$\{requestId\}/);
console.log("TikTok Marketplace upstream error diagnostics: PASS");
