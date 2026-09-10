import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createTikTokState, consumeTikTokState, tikTokProfileBindingStatement } from "../functions/_tiktok_oauth.js";
import { vxChannelInsert, vxChannelRestore } from "../functions/_vx_access.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await read("migrations/0095_tiktok_browser_profile_bindings.sql");
const callbackSource = (await read("functions/api/tiktok/callback.js"))
  .replace(/^import[^\n]*\n/gm, "")
  .replaceAll("export async function ", "async function ");
const SLOT = "11111111-1111-4111-8111-111111111111";
const SLOT_2 = "22222222-2222-4222-8222-222222222222";
const CHANNEL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class Bound {
  constructor(owner, sql) { this.owner = owner; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { return this.owner.sqlite.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: this.owner.sqlite.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = this.owner.sqlite.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE tiktok_channels(
        id TEXT PRIMARY KEY,name TEXT NOT NULL DEFAULT '',channel_url TEXT NOT NULL DEFAULT '',handle TEXT NOT NULL DEFAULT '',
        created_by INTEGER NOT NULL,archived_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE tiktok_connections(
        id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL,open_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',
        token TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,open_id),
        FOREIGN KEY(channel_id) REFERENCES tiktok_channels(id)
      );
      CREATE TABLE tiktok_oauth_states(state_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,channel_id TEXT NOT NULL DEFAULT '',expires_at TEXT NOT NULL);
    `);
    this.sqlite.exec(migration);
    this.sqlite.exec("ALTER TABLE tiktok_browser_profile_bindings ADD COLUMN profile_kind TEXT NOT NULL DEFAULT 'slot'");
  }
  prepare(sql) { return new Bound(this, sql); }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

const throws = (fn, pattern) => {
  let error;
  try { fn(); } catch (caught) { error = caught; }
  assert.ok(error, "expected SQLite statement to fail");
  if (pattern) assert.match(String(error.message), pattern);
};

{
  const DB = new TestD1();
  throws(() => DB.sqlite.prepare("INSERT INTO tiktok_oauth_profile_slots(state_hash,slot_id,user_id,expires_at) VALUES('bad',?,1,datetime('now','+10 minutes'))")
    .run("11111111-1111-4111-8111-11111111111-"));
  DB.sqlite.prepare("INSERT INTO tiktok_channels(id,created_by) VALUES(?,1)").run(CHANNEL);
  throws(() => DB.sqlite.prepare("INSERT INTO tiktok_browser_profile_bindings(slot_id,user_id,channel_id,provider_open_id) VALUES(?,1,?,'provider-a')")
    .run(SLOT, CHANNEL), /PREREQUISITE/);
  DB.sqlite.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id) VALUES('conn-a',1,?,'provider-a')").run(CHANNEL);
  DB.sqlite.prepare("INSERT INTO tiktok_browser_profile_bindings(slot_id,user_id,channel_id,provider_open_id) VALUES(?,1,?,'provider-a')").run(SLOT, CHANNEL);
  throws(() => DB.sqlite.prepare("UPDATE tiktok_browser_profile_bindings SET slot_id=? WHERE slot_id=?").run(SLOT_2, SLOT), /IMMUTABLE/);
  DB.sqlite.prepare("DELETE FROM tiktok_connections WHERE id='conn-a'").run();
  assert.equal(DB.sqlite.prepare("SELECT slot_id FROM tiktok_browser_profile_bindings WHERE channel_id=?").get(CHANNEL).slot_id, SLOT,
    "ordinary disconnect must preserve the durable browser profile binding");
  DB.sqlite.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id) VALUES('conn-a2',1,?,'provider-a')").run(CHANNEL);
  throws(() => DB.sqlite.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id) VALUES('wrong',1,?,'provider-other')").run(CHANNEL), /PROFILE_BINDING_CONFLICT/);
  const plan = DB.sqlite.prepare("EXPLAIN QUERY PLAN SELECT slot_id FROM tiktok_browser_profile_bindings WHERE user_id=? AND channel_id=?").all(1, CHANNEL);
  assert.ok(plan.some((row) => /SEARCH tiktok_browser_profile_bindings USING INDEX/.test(row.detail)));
}

{
  const DB = new TestD1(), env = { DB };
  const first = await createTikTokState(env, 1, "", SLOT);
  await assert.rejects(createTikTokState(env, 2, "", SLOT), /UNIQUE|constraint/i,
    "a slot reservation must be global across website owners");
  assert.equal(await consumeTikTokState(env, first, 2), null);
  assert.equal((await consumeTikTokState(env, first, 1)).profile_slot_id, SLOT);
  assert.equal(await consumeTikTokState(env, first, 1), null, "OAuth state must be one-use");
  const retryOld = await createTikTokState(env, 1, "", SLOT_2);
  const retryNew = await createTikTokState(env, 1, "", SLOT_2);
  assert.equal(await consumeTikTokState(env, retryOld, 1), null);
  assert.equal((await consumeTikTokState(env, retryNew, 1)).profile_slot_id, SLOT_2);
  const marked = await createTikTokState(env, 1, "", SLOT_2);
  const hash = DB.sqlite.prepare("SELECT state_hash FROM tiktok_oauth_profile_slots WHERE slot_id=?").get(SLOT_2).state_hash;
  DB.sqlite.prepare("DELETE FROM tiktok_oauth_profile_slots WHERE state_hash=?").run(hash);
  assert.equal(await consumeTikTokState(env, marked, 1), null, "missing slot sidecar must fail closed");
}

const loadCallback = (deps) => new Function(...Object.keys(deps), `${callbackSource}\nreturn onRequestGet;`)(...Object.values(deps));
const callbackCase = async ({ atLimit = false, current = () => true } = {}) => {
  const DB = new TestD1();
  if (atLimit) DB.sqlite.prepare("INSERT INTO tiktok_channels(id,name,created_by) VALUES(?,?,1)").run(CHANNEL, "Existing");
  let providerCalls = 0;
  const handler = loadCallback({
    handoffGuardStatements: () => [],
    requireVxUser: async () => ({ user: { id: 1 }, vx: { active: true, admin: false, account_limit: 1, access_source: "paid", order_id: 1 } }),
    vxRequestAccessStillCurrent: async () => current(), vxChannelInsert, vxChannelRestore,
    ensureDatabase: async () => {}, ensureTikTokAnalyzerSchema: async () => {},
    consumeTikTokState: async () => ({ channel_id: "", profile_slot_id: SLOT }),
    exchangeTikTokCode: async () => { providerCalls += 1; return { access_token: "opaque" }; },
    fetchTikTokProfile: async () => ({ open_id: "provider-new", display_name: "New channel" }),
    prepareTikTokConnection: async (env, userId, channelId) => ({ id: "connection-new", openId: "provider-new",
      statement: env.DB.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,status) SELECT 'connection-new',?,?,?,'active' WHERE EXISTS(SELECT 1 FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL) ON CONFLICT(user_id,open_id) DO UPDATE SET channel_id=excluded.channel_id,status='active'")
        .bind(userId, channelId, "provider-new", channelId, userId) }),
    syncTikTokConnection: async () => { throw new Error("quota-deferred"); }, tikTokOAuthConfig: () => ({ configured: true }),
    tikTokProfileBindingStatement, requireD1DataFetchAvailable: async () => new Response("blocked", { status: 503 })
  });
  const response = await handler({ env: { DB }, request: new Request("https://visiond.test/api/tiktok/callback?state=opaque&code=opaque") });
  return { DB, providerCalls, status: new URL(response.headers.get("location")).searchParams.get("tiktok") };
};

{
  const { DB, status } = await callbackCase();
  assert.equal(status, "connected");
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_channels").get().n, 1);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_connections").get().n, 1);
  assert.equal(DB.sqlite.prepare("SELECT slot_id FROM tiktok_browser_profile_bindings").get().slot_id, SLOT);
}
{
  const { DB, status } = await callbackCase({ atLimit: true });
  assert.equal(status, "account_limit");
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_channels").get().n, 1);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_connections").get().n, 0);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_browser_profile_bindings").get().n, 0,
    "quota conflict must roll back connection and binding together");
}
{
  let checks = 0;
  const { DB, status } = await callbackCase({ current: () => ++checks < 4 });
  assert.equal(status, "access_expired");
  assert.equal(checks, 4);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM tiktok_channels").get().n, 0,
    "entitlement revoked at the final persistence boundary must leave no writes");
}

console.log("PASS TikTok profile-slot schema, state, callback atomicity and lifecycle");
