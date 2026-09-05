import fs from "node:fs";
import assert from "node:assert/strict";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const search = client.match(/async function searchMarketplace[\s\S]*?\n\}/)?.[0] || "";
const loader = client.match(/async function loadTikTokConnection[\s\S]*?\n\}/)?.[0] || "";
const selector = client.match(/selectChannel = async function[\s\S]*?\n\};/)?.[0] || "";

assert.match(search, /String\(state\.shopConnection\.channel_id\) === String\(state\.selected\)/, "search must reject a stale connection from another channel");
assert.match(search, /const requestedChannelId = state\.selected/, "search must capture the selected channel before waiting");
assert.match(search, /if \(!shopConnection && requestedChannelId\) shopConnection = await loadTikTokConnection\(requestedChannelId\)/, "search must reload the captured channel connection before reporting it missing");
assert.match(search, /connection_id: shopConnection\.id, channel_id: requestedChannelId/, "Marketplace request must use the resolved captured-channel connection");
assert.doesNotMatch(search, /connection_id: state\.shopConnection\.id/, "Marketplace request must not read mutable connection state after resolving it");
assert.doesNotMatch(search, /capabilities\?\.can_search_marketplace/, "search buttons must call the API instead of blocking on stale client-side scopes");
assert.match(loader, /return shopConnection;/, "connection loader must return the selected channel Shop connection");
assert.match(selector, /state\.shopConnection = null;\s*await selectChannelBase\(id\)/, "channel switching must clear the previous channel connection immediately");

console.log("TikTok Marketplace selected-channel connection guard: PASS");
