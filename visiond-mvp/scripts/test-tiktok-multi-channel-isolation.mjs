import assert from "node:assert/strict";
import fs from "node:fs";
import { saveTikTokConnection } from "../functions/_tiktok_oauth.js";
import { commissionDashboard } from "../functions/api/admin/tiktok-connections/index.js";

const token={access_token:"access",refresh_token:"refresh",scope:"user.info.basic",expires_in:3600,refresh_expires_in:86400};
const profile={open_id:"creator-1",display_name:"Creator One"};
const fakeEnv=(existing=null,occupied=null)=>{const writes=[];return{VISIOND_CHANNEL_ENCRYPTION_KEY:"test-only-encryption-key-at-least-32-characters",writes,DB:{prepare(sql){return{bind(...args){return{first:async()=>sql.includes("c.channel_id=?")?occupied:existing,run:async()=>{writes.push({sql,args});return{meta:{changes:1}}}}}}}}}};

const moved=fakeEnv({id:"connection-1",channel_id:"channel-1",channel_name:"ช่อง 1",status:"active"});
await assert.rejects(saveTikTokConnection(moved,7,"channel-2",token,profile),error=>error.code==="TIKTOK_ACCOUNT_ALREADY_LINKED");
assert.equal(moved.writes.length,0);

const occupied=fakeEnv(null,{id:"connection-2",account_name:"Creator Two"});
await assert.rejects(saveTikTokConnection(occupied,7,"channel-1",token,profile),error=>error.code==="TIKTOK_CHANNEL_ALREADY_LINKED");
assert.equal(occupied.writes.length,0);

const separate=fakeEnv();
await saveTikTokConnection(separate,7,"channel-2",token,{...profile,open_id:"creator-2"});
assert.equal(separate.writes[0].args[2],"channel-2");

const dashboard=commissionDashboard([
  {connection_id:"a",channel_id:"channel-1",channel_name:"ชื่อซ้ำ",create_time:1722470400,commission_json:JSON.stringify({amount:10,currency:"THB"})},
  {connection_id:"b",channel_id:"channel-2",channel_name:"ชื่อซ้ำ",create_time:1722470400,commission_json:JSON.stringify({amount:20,currency:"THB"})},
]);
assert.equal(dashboard[0].channels.length,2,"channels with duplicate display names must remain separate");
assert.deepEqual(new Set(dashboard[0].channels.map(row=>row.channel_id)),new Set(["channel-1","channel-2"]));

const admin=fs.readFileSync(new URL("../functions/api/admin/tiktok-connections/index.js",import.meta.url),"utf8");
const marketplace=fs.readFileSync(new URL("../functions/api/admin/tiktok-connections/marketplace.js",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../public/tiktok-analyzer.js",import.meta.url),"utf8");
assert.match(admin,/id=\? AND user_id=\? AND channel_id=\?/);
assert.match(admin,/created_by=\? AND archived_at IS NULL/);
assert.match(marketplace,/id=\? AND user_id=\? AND channel_id=\?/);
assert.match(client,/connectionLoadSeq/);
assert.match(client,/requestedChannelId!==state\.selected/);
console.log("TikTok one-card-one-channel isolation: PASS");
