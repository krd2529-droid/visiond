import assert from "node:assert/strict";
import fs from "node:fs";
import { tikTokOAuthConfig, tikTokAuthorizeUrl } from "../functions/_tiktok_oauth.js";

const config = tikTokOAuthConfig({
  TIKTOK_CLIENT_KEY: "client-key",
  TIKTOK_CLIENT_SECRET: "client-secret",
  TIKTOK_REDIRECT_URI: "https://example.com/api/tiktok/callback",
});
const authorize = new URL(tikTokAuthorizeUrl(config, "state-for-channel-2"));
assert.equal(authorize.searchParams.get("disable_auto_auth"), "1", "TikTok must not silently authorize the cached account");
assert.equal(authorize.searchParams.get("state"), "state-for-channel-2", "the channel-bound state must remain intact");

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const callback = fs.readFileSync(new URL("../functions/api/tiktok/callback.js", import.meta.url), "utf8");
assert.match(client, /เลือกบัญชี TikTok เพื่อเชื่อม/);
assert.match(client, /เลือกบัญชี TikTok ใหม่/);
assert.match(callback, /back\('connected','',stateRow\.channel_id\)/, "callback must return to the card that started OAuth");

console.log("TikTok explicit account selection: PASS");
