import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const connect = fs.readFileSync(new URL("../functions/api/tiktok/connect.js", import.meta.url), "utf8");
const callback = fs.readFileSync(new URL("../functions/api/tiktok/callback.js", import.meta.url), "utf8");

assert.doesNotMatch(client, /id="tiktokLoginOnly"/);
assert.match(client, /\$\("\.workspace-switch"\)\?\.remove\(\)/);
assert.match(client, /\$\("#channelShopAnalysis > \.result-head"\)\?\.remove\(\)/, "redundant product-management heading must be removed");
assert.match(client, /setWorkspaceView\("output", false\)/);
assert.match(client, /\$\("#channels"\)\.addEventListener\("click", \(\) => \{\s*setOutputScope\("channel"\);\s*setWorkspaceView\("output"\)/);
assert.match(client, /\$\("#newChannel"\)\.textContent = "\+ ช่องใหม่"/);
assert.match(client, /location\.assign\("\/api\/tiktok\/connect\?create=1"\)/);
assert.match(client, /form\.remove\(\)/);
assert.match(client, /const aiState = \$\("#aiState"\);\s*if \(aiState\) aiState\.textContent/, "removed setup form must not block channel rendering");
assert.match(client, /\$\("#channels"\)\.innerHTML = `<p class="shop-error">/, "channel-load errors must remain visible after the setup form is removed");
assert.match(client, /selectChannel\(state\.selected\)\.catch\(\(error\) => showToast/, "detail-load failures must not replace the channel list");
assert.match(client, /if \(\$\("#channelMode"\)\)/, "removed channel-mode label must be optional");
assert.match(client, /if \(\$\("#formHeading"\)\)/, "removed form heading must be optional");
assert.match(client, /if \(\$\("#previews"\)\)/, "removed preview area must be optional");
assert.match(css, /#analysisForm\{display:none!important\}/);
assert.doesNotMatch(css, /\.tiktok-login-only/);
assert.match(connect, /createNew=url\.searchParams\.get\('create'\)==='1'/);
assert.match(callback, /async function channelForProfile/);
assert.match(callback, /channelId=await channelForProfile/);
assert.match(html, /tiktok-analyzer\.js\?v=02119/);
assert.match(html, /tiktok-analyzer\.css\?v=02089/);

console.log("TikTok direct product-management entry with + channel OAuth: PASS");
