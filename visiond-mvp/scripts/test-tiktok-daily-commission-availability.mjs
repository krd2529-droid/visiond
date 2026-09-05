import assert from "node:assert/strict";
import fs from "node:fs";
import { dateRange } from "../functions/api/admin/tiktok-connections/index.js";
import { commissionAvailability, commissionRange } from "../functions/_tiktok_commission.js";

const beforeNoon = Date.parse("2026-09-06T04:59:59Z");
const atNoon = Date.parse("2026-09-06T05:00:00Z");
const fourthAtNoon = Date.parse("2026-09-04T05:00:00Z");
assert.deepEqual(commissionAvailability(beforeNoon), { ready: false, today: "2026-09-06", latestDate: "2026-09-05", nextReadyAt: "2026-09-06T12:00:00+07:00" });
assert.deepEqual(commissionAvailability(atNoon), { ready: true, today: "2026-09-06", latestDate: "2026-09-05", nextReadyAt: "2026-09-07T12:00:00+07:00" });
assert.equal(commissionAvailability(fourthAtNoon).latestDate, "2026-09-03", "วันที่ 4 ตอนเที่ยงต้องดึงยอดล่าสุดของวันที่ 3");

const requestedToday = new URL("https://visiondonline.com/api/admin/tiktok-connections?date_from=2026-08-08&date_to=2026-09-06");
assert.equal(dateRange(requestedToday, beforeNoon).to, "2026-09-05");
assert.equal(dateRange(requestedToday, atNoon).to, "2026-09-05");
assert.equal(commissionRange(new URL("https://visiondonline.com/api/admin/tiktok-commissions?from=2026-08-08&to=2026-09-06"), beforeNoon).to, "2026-09-05");
assert.equal(commissionRange(new URL("https://visiondonline.com/api/admin/tiktok-commissions?from=2026-08-08&to=2026-09-06"), atNoon).to, "2026-09-05");

const api = fs.readFileSync(new URL("../functions/api/admin/tiktok-connections/index.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
assert.match(api, /TIKTOK_DAILY_TOTALS_NOT_READY/);
assert.match(api, /mode!=='showcase'&&!availability\.ready/);
assert.match(ui, /กรุณารอ 12:00 น\./);
console.log("TikTok daily commission availability: PASS");
