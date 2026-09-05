import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

assert.match(client, /savedUiValue\("visiond_tiktok_channel_id"\)/, "refresh must restore the last selected channel");
assert.match(client, /savedUiValue\("visiond_tiktok_workspace"\) === "output"/, "refresh must restore the last workspace tab");
assert.match(client, /const selectedExists = state\.channels\.some/, "saved channels must be validated against current server data");
assert.match(client, /state\.channels\.find\(\(channel\) => channel\.follower_count !== null/, "missing selection must prefer a connected channel");
assert.match(client, /if \(state\.selected\) await selectChannel\(state\.selected\)/, "initial load must hydrate the selected channel");
assert.match(client, /saveUiValue\("visiond_tiktok_channel_id", String\(id\)\)/, "channel changes must be remembered");
assert.match(client, /await loadTikTokConnection\(\)/, "selected-channel hydration must load TikTok Shop data");
assert.match(html, /tiktok-analyzer\.js\?v=02097/);

console.log("TikTok refresh selected-channel hydration: PASS");
