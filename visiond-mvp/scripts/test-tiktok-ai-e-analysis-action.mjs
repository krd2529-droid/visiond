import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html"), client = read("public/tiktok-analyzer.js"), css = read("public/tiktok-analyzer.css");
assert.match(html, /id="analyzeAiRecommendations"/);
assert.match(html, />ให้ AI วิเคราะห์สินค้าแนะนำ</);
assert.match(client, /#analyzeAiRecommendations/);
assert.match(client, /กรุณาเชื่อม TikTok Shop ก่อนให้ AI วิเคราะห์/);
assert.match(client, /api\("\/api\/admin\/tiktok-analyzer", \{ method: "POST", body: data \}\)/);
assert.match(client, /renderResult\(response\.result \|\| \{\}\)/);
assert.match(client, /AI วิเคราะห์สินค้าแนะนำเกรด E เรียบร้อยแล้ว/);
assert.match(css, /\.ai-recommendations-head button\{/);
assert.match(html, /tiktok-analyzer\.js\?v=02119/);
assert.match(html, /tiktok-analyzer\.css\?v=02089/);
console.log("TikTok AI grade-E analysis action: PASS");
