import {ensureVEasyRuntimeSchema} from './_veasy_runtime.js';

export async function ensureV12Schema(env){
  await ensureVEasyRuntimeSchema(env);
  const conversationColumns=(await env.DB.prepare('PRAGMA table_info(veasy_conversations)').all()).results?.map(x=>x.name)||[];
  if(!conversationColumns.includes('profile_url'))await env.DB.prepare("ALTER TABLE veasy_conversations ADD COLUMN profile_url TEXT NOT NULL DEFAULT ''").run();
  const sql=[
    `CREATE TABLE IF NOT EXISTS v12_channel_credentials (provider TEXT PRIMARY KEY CHECK(provider IN ('facebook')),external_account_id TEXT NOT NULL DEFAULT '',token_ciphertext TEXT NOT NULL,verified_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS v12_broadcast_campaigns (id TEXT PRIMARY KEY,title TEXT NOT NULL,provider TEXT NOT NULL CHECK(provider IN ('line','facebook')),shop_id TEXT,audience TEXT NOT NULL CHECK(audience IN ('all_friends','conversations','selected')),message_text TEXT NOT NULL DEFAULT '',media_url TEXT NOT NULL DEFAULT '',media_mime TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','sending','completed','partial','failed','cancelled')),retry_key TEXT NOT NULL UNIQUE,total_count INTEGER NOT NULL DEFAULT 0,sent_count INTEGER NOT NULL DEFAULT 0,failed_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS v12_broadcast_deliveries (id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES v12_broadcast_campaigns(id) ON DELETE CASCADE,shop_id TEXT NOT NULL,conversation_id TEXT NOT NULL,provider TEXT NOT NULL CHECK(provider IN ('line','facebook')),status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','skipped')),attempt_count INTEGER NOT NULL DEFAULT 0,error_code TEXT NOT NULL DEFAULT '',provider_request_id TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(campaign_id,shop_id,conversation_id))`,
    `CREATE INDEX IF NOT EXISTS idx_v12_campaign_status ON v12_broadcast_campaigns(status,created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_v12_delivery_campaign_status ON v12_broadcast_deliveries(campaign_id,status)`
  ];for(const statement of sql)await env.DB.prepare(statement).run();
  const credentialColumns=(await env.DB.prepare('PRAGMA table_info(v12_channel_credentials)').all()).results?.map(x=>x.name)||[];
  if(!credentialColumns.includes('shop_id'))await env.DB.prepare("ALTER TABLE v12_channel_credentials ADD COLUMN shop_id TEXT NOT NULL DEFAULT ''").run();
  if(!credentialColumns.includes('secret_ciphertext'))await env.DB.prepare("ALTER TABLE v12_channel_credentials ADD COLUMN secret_ciphertext TEXT NOT NULL DEFAULT ''").run();
  if(!credentialColumns.includes('verify_token_ciphertext'))await env.DB.prepare("ALTER TABLE v12_channel_credentials ADD COLUMN verify_token_ciphertext TEXT NOT NULL DEFAULT ''").run();
}
