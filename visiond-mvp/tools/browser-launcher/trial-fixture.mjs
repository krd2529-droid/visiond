// Local-only manual fixture. Serves the real candidate analyzer assets with synthetic read-only APIs.
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const requestedPort = process.argv[2] === "--self-test" ? 0 : Number(process.argv[2] || 8091);
if (!Number.isSafeInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error("Port must be an integer from 0 to 65535");

const publicRoot = path.resolve("public");
const ids = {
  A: "11111111-1111-4111-8111-111111111111",
  B: "22222222-2222-4222-8222-222222222222",
  OFFPAGE: "33333333-3333-4333-8333-333333333333",
  SLOT_A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  SLOT_B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  SLOT_OFFPAGE: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
};
const channels = [
  { id: ids.A, name: "Fixture A · ผูก Chrome แล้ว", handle: "@fixture_a", channel_url: "https://www.tiktok.com/@fixture_a", follower_count: 12, likes_count: 34, video_count: 2, analysis_count: 0, browser_profile_slot_id: ids.SLOT_A, updated_at: "2026-09-09 10:00:00" },
  { id: ids.B, name: "Fixture B · ผูก Chrome แล้ว", handle: "@fixture_b", channel_url: "https://www.tiktok.com/@fixture_b", follower_count: 56, likes_count: 78, video_count: 3, analysis_count: 0, browser_profile_slot_id: ids.SLOT_B, updated_at: "2026-09-09 09:00:00" }
];
const offPageChannel = { id: ids.OFFPAGE, name: "Fixture C · อยู่นอกหน้าแรก", handle: "@fixture_c", channel_url: "https://www.tiktok.com/@fixture_c", follower_count: 90, likes_count: 120, video_count: 4, analysis_count: 0, browser_profile_slot_id: ids.SLOT_OFFPAGE, updated_at: "2026-09-08 08:00:00" };
const allChannels = [...channels, offPageChannel];
const requests = [];
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };

const json = (response, value, status = 200) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
};
const channelOverview = (channel) => ({
  channel,
  products: [],
  product_events: [],
  runs: [],
  inventory_counts: { kept: 0, discarded: 0 },
  pagination: { products: { has_more: false, next_cursor: null }, events: { has_more: false, next_cursor: null }, runs: { has_more: false, next_cursor: null } }
});

const server = http.createServer(async (request, response) => {
  const origin = `http://127.0.0.1:${server.address()?.port || requestedPort}`;
  const url = new URL(request.url, origin);
  requests.push({ method: request.method, path: url.pathname, search: url.search });

  if (request.method !== "GET") return json(response, { error: "LOCAL_FIXTURE_READ_ONLY" }, 405);
  if (url.pathname === "/__fixture__/requests") return json(response, { synthetic: true, requests });
  if (url.pathname === "/api/auth/me") return json(response, { user: { id: 999, name: "Local Fixture Boss", role: "boss" }, synthetic: true });
  if (url.pathname === "/api/vtools") return json(response, { access: { active: true, admin: true, account_limit: null }, synthetic: true });
  if (url.pathname === "/api/vx/referrals") return json(response, { link: "https://example.invalid/local-fixture", synthetic: true });
  if (url.pathname === "/api/admin/tiktok-commissions") return json(response, { rows: [], summary: {}, date_range: { from: "2026-08-10", to: "2026-09-08" }, synthetic: true });
  if (url.pathname === "/api/admin/tiktok-connections") {
    const channelId = url.searchParams.get("channel_id") || "";
    const channel = allChannels.find((item) => item.id === channelId);
    if (!channel) return json(response, { error: "LOCAL_FIXTURE_CHANNEL_NOT_FOUND" }, 404);
    return json(response, { configured: true, shop_configured: true, connections: [{ id: `profile-${channelId}`, channel_id: channelId, status: "active", display_name: channel.name }], shop_connections: [], videos: [], shop_products: [], shop_orders: [], synthetic: true });
  }
  if (url.pathname === "/api/admin/tiktok-analyzer") {
    const channelId = url.searchParams.get("channel_id");
    if (!channelId) return json(response, { channels, pagination: { has_more: false, next_cursor: null }, provider_configured: true, synthetic: true });
    const channel = allChannels.find((item) => item.id === channelId);
    return channel ? json(response, { ...channelOverview(channel), synthetic: true }) : json(response, { error: "LOCAL_FIXTURE_CHANNEL_NOT_FOUND" }, 404);
  }

  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!relative || relative === "tiktok-analyzer") relative = "tiktok-analyzer.html";
  else if (!path.extname(relative)) relative += ".html";
  const target = path.resolve(publicRoot, relative);
  if (!target.startsWith(publicRoot + path.sep)) { response.writeHead(403); return response.end("Forbidden"); }
  try {
    let body = await readFile(target);
    if (relative === "tiktok-analyzer.html") {
      const html = body.toString("utf8").replace("<body>", '<body><aside style="position:sticky;top:0;z-index:9999;padding:10px 16px;background:#5b2c83;color:#fff;font:700 14px system-ui;text-align:center">LOCAL PROFILE FIXTURE · ข้อมูลช่องเป็นข้อมูลสังเคราะห์ · ไม่ส่ง OAuth หรือ production mutation อัตโนมัติ</aside>');
      body = Buffer.from(html);
    }
    response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Local fixture file not found");
  }
});

server.listen(requestedPort, "127.0.0.1", async () => {
  const port = server.address().port;
  const trialUrl = `http://127.0.0.1:${port}/tiktok-analyzer`;
  if (process.argv[2] !== "--self-test") {
    process.stdout.write(`VisionD local profile fixture: ${trialUrl}\n`);
    process.stdout.write(`Bound A: ${trialUrl}?channel_id=${ids.A}&launcher_profile=1&launcher_mode=existing&launcher_slot=${ids.SLOT_A}\n`);
    process.stdout.write(`Bound B: ${trialUrl}?channel_id=${ids.B}&launcher_profile=1&launcher_mode=existing&launcher_slot=${ids.SLOT_B}\n`);
    process.stdout.write(`Off-page bound C: ${trialUrl}?channel_id=${ids.OFFPAGE}&launcher_profile=1&launcher_mode=existing&launcher_slot=${ids.SLOT_OFFPAGE}\n`);
    process.stdout.write(`New pending example: ${trialUrl}?launcher_profile=1&launcher_mode=new&launcher_slot=dddddddd-dddd-4ddd-8ddd-dddddddddddd&connect=tiktok_new\n`);
    process.stdout.write(`Local request log: http://127.0.0.1:${port}/__fixture__/requests\n`);
    return;
  }
  try {
    const page = await fetch(trialUrl);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /LOCAL PROFILE FIXTURE/);
    assert.match(html, /tiktok-analyzer\.js\?v=02147/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/browser-profile-launcher.js?v=1`)).status, 200);
    const list = await (await fetch(`http://127.0.0.1:${port}/api/admin/tiktok-analyzer?limit=24`)).json();
    assert.deepEqual(list.channels.map((item) => item.id), [ids.A, ids.B]);
    assert.deepEqual(list.channels.map((item) => item.browser_profile_slot_id), [ids.SLOT_A, ids.SLOT_B]);
    const detail = await (await fetch(`http://127.0.0.1:${port}/api/admin/tiktok-analyzer?channel_id=${ids.B}&resource=inventory&limit=24`)).json();
    assert.equal(detail.channel.id, ids.B);
    const offPage = await (await fetch(`http://127.0.0.1:${port}/api/admin/tiktok-analyzer?channel_id=${ids.OFFPAGE}&limit=24`)).json();
    assert.equal(offPage.channel.browser_profile_slot_id, ids.SLOT_OFFPAGE);
    const denied = await fetch(`http://127.0.0.1:${port}/api/admin/tiktok-analyzer`, { method: "POST", body: "{}" });
    assert.equal(denied.status, 405);
    assert.equal((await denied.json()).error, "LOCAL_FIXTURE_READ_ONLY");
    assert.equal(requests.some((item) => /visiondonline\.com/.test(item.path + item.search)), false);
    console.log("PASS local profile fixture uses bound/off-page candidate data and synthetic read-only APIs");
  } finally {
    server.close();
  }
});
