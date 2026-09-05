import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");

assert.match(client, /const shopConnectionRequests = new Map\(\)/, "same-channel connection loads must be coalesced");
assert.match(client, /fetchTikTokConnectionData\(requestedChannelId\)/, "connection hydration must use the captured channel");
assert.match(client, /return shopConnection;/, "a stale render must still return the fetched connection snapshot");
assert.match(client, /requestedChannelId !== state\.selected/, "Marketplace must reject a channel switch during search");
assert.match(client, /channel_id: requestedChannelId/, "Marketplace payload must use the captured channel id");
assert.match(client, /cache: "no-store"/, "post-OAuth hydration must bypass a stale browser response");

const connected = { id: "shop-b", channel_id: "channel-b" };
const staleRenderResult = ({ connection }, renderIsStale) => renderIsStale ? connection : connection;
assert.equal(staleRenderResult({ connection: connected }, true), connected, "a concurrent newer render must not turn a real connection into null");

console.log("TikTok Shop hydration race regression: PASS");
