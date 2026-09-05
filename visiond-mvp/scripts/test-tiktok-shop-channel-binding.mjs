import assert from "node:assert/strict";
import fs from "node:fs";
import { saveTikTokShopCreatorConnection } from "../functions/_tiktok_shop_oauth.js";

const token = { open_id: "creator-1", access_token: "access", refresh_token: "refresh", granted_scopes: ["creator.affiliate.info"], expires_in: 3600, refresh_expires_in: 86400 };
const fakeEnv = existing => {
  const writes = [];
  return {
    VISIOND_CHANNEL_ENCRYPTION_KEY: "test-only-encryption-key-at-least-32-characters",
    writes,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => existing,
              run: async () => { writes.push({ sql, args }); return { success: true }; },
            };
          },
        };
      },
    },
  };
};

const conflictEnv = fakeEnv({ id: "connection-1", channel_id: "channel-1", channel_name: "ช่อง 1", status: "active" });
await assert.rejects(
  saveTikTokShopCreatorConnection(conflictEnv, 7, "channel-2", token),
  error => error.code === "TIKTOK_SHOP_ACCOUNT_ALREADY_LINKED" && error.channelName === "ช่อง 1",
);
assert.equal(conflictEnv.writes.length, 0, "conflict must not update or move the original connection");

const sameChannelEnv = fakeEnv({ id: "connection-1", channel_id: "channel-1", channel_name: "ช่อง 1", status: "active" });
assert.equal(await saveTikTokShopCreatorConnection(sameChannelEnv, 7, "channel-1", token), "connection-1");
assert.equal(sameChannelEnv.writes.length, 1);
assert.equal(sameChannelEnv.writes[0].args[2], "channel-1");

const disconnectedEnv = fakeEnv({ id: "connection-1", channel_id: "channel-1", channel_name: "ช่อง 1", status: "inactive" });
assert.equal(await saveTikTokShopCreatorConnection(disconnectedEnv, 7, "channel-2", token), "connection-1");
assert.equal(disconnectedEnv.writes[0].args[2], "channel-2");

const callback = fs.readFileSync(new URL("../functions/api/tiktok-shop/callback.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
assert.match(callback, /account_already_linked/);
assert.match(client, /ระบบจึงไม่ย้ายบัญชี/);
assert.match(client, /ออกจาก TikTok Shop แล้วล็อกอินบัญชีของช่องที่เลือก/);
console.log("TikTok Shop account stays bound to its original channel: PASS");
