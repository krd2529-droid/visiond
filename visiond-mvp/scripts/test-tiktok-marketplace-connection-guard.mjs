import fs from "node:fs";
import assert from "node:assert/strict";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const search = client.match(/async function searchMarketplace[\s\S]*?\n\}/)?.[0] || "";
const loader = client.match(/async function loadTikTokConnection[\s\S]*?\n\}/)?.[0] || "";
const selector = client.match(/selectChannel = async function[\s\S]*?\n\};/)?.[0] || "";

assert.match(search, /String\(state\.shopConnection\.channel_id\) === requestedChannelId/, "search must reject a connection from another channel");
assert.match(search, /expectedContext \|\| channelOwnership\.capture\(\)/, "search must capture channel ownership before waiting");
assert.match(search, /shopConnection = await loadTikTokConnection\(requestedChannelId, context\)/, "search must reload the captured channel connection before reporting it missing");
assert.match(search, /channelOwnership\.current\(context\)/, "search must reject stale async responses");
assert.match(search, /connection_id: shopConnection\.id, channel_id: requestedChannelId/, "Marketplace request must use the resolved captured-channel connection");
assert.doesNotMatch(search, /connection_id: state\.shopConnection\.id/, "Marketplace request must not read mutable connection state after resolving it");
assert.doesNotMatch(search, /capabilities\?\.can_search_marketplace/, "search buttons must call the API instead of blocking on stale client-side scopes");
assert.match(loader, /return shopConnection;/, "connection loader must return the selected channel Shop connection");
assert.match(selector, /channelOwnership\.begin\(state\.selected\);\s*clearChannelOwnedView\(\)/, "channel switching must clear and invalidate the previous channel immediately");

console.log("TikTok Marketplace selected-channel connection guard: PASS");
