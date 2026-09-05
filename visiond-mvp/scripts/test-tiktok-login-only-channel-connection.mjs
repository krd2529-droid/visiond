import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const connect = fs.readFileSync(new URL("../functions/api/tiktok/connect.js", import.meta.url), "utf8");
const callback = fs.readFileSync(new URL("../functions/api/tiktok/callback.js", import.meta.url), "utf8");

assert.match(client, /id="tiktokLoginOnly"/);
assert.match(client, /ล็อกอิน TikTok เพื่อเพิ่มช่อง/);
assert.match(client, /ไม่ต้องกรอกชื่อ ลิงก์ หรือแนบรูป/);
assert.match(client, /location\.assign\("\/api\/tiktok\/connect\?create=1"\)/);
assert.match(client, /1 เชื่อมช่องด้วย TikTok/);
assert.match(css, /#analysisForm\{display:none!important\}/);
assert.match(client, /form\.remove\(\);\s*loadChannels\(\);/);
assert.match(css, /\.workspace-output #tiktokLoginOnly\{display:none!important\}/);
assert.match(connect, /createNew=url\.searchParams\.get\('create'\)==='1'/);
assert.match(connect, /if\(!channelId&&!createNew\)/);
assert.match(callback, /async function channelForProfile/);
assert.match(callback, /INSERT INTO tiktok_channels\(id,name,channel_url,handle,created_by\)/);
assert.match(callback, /channelId=await channelForProfile/);
assert.match(callback, /\/tiktok-analyzer\?tiktok=/);
assert.doesNotMatch(callback, /tiktok-analyzer\.html\?tiktok=/);
assert.match(html, /tiktok-analyzer\.js\?v=02101/);
assert.match(html, /tiktok-analyzer\.css\?v=02083/);

console.log("TikTok login-only channel connection: PASS");
