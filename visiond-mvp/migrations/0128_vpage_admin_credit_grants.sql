PRAGMA defer_foreign_keys=ON;

CREATE INDEX IF NOT EXISTS idx_users_vpage_username_lookup
ON users(username COLLATE NOCASE,role);
CREATE INDEX IF NOT EXISTS idx_users_vpage_email_lookup
ON users(email COLLATE NOCASE,role);

CREATE TABLE vpage_credit_grants (
  id TEXT PRIMARY KEY CHECK(id GLOB 'vcg_[0-9a-f]*' AND length(id)=36),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  service_days INTEGER NOT NULL DEFAULT 30 CHECK(service_days=30),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=500),
  granted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vpage_credit_grants_user_cursor ON vpage_credit_grants(user_id,created_at DESC,id DESC);
CREATE INDEX idx_vpage_credit_grants_actor_cursor ON vpage_credit_grants(granted_by,created_at DESC,id DESC);

CREATE TABLE vpage_credits_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id INTEGER UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  source_order_item_id INTEGER UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
  grant_id TEXT REFERENCES vpage_credit_grants(id) ON DELETE RESTRICT,
  grant_sequence INTEGER,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','consumed')),
  service_days INTEGER NOT NULL DEFAULT 30 CHECK(service_days=30),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  CHECK((order_id IS NOT NULL AND source_order_item_id IS NOT NULL AND grant_id IS NULL AND grant_sequence IS NULL) OR (order_id IS NULL AND source_order_item_id IS NULL AND grant_id IS NOT NULL AND grant_sequence BETWEEN 1 AND 100)),
  UNIQUE(grant_id,grant_sequence)
);

CREATE TABLE vpage_pages_next (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credit_id INTEGER REFERENCES vpage_credits_next(id) ON DELETE RESTRICT,
  vpage_id TEXT UNIQUE,domain_id TEXT NOT NULL,slug TEXT NOT NULL,display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('provisioning','repair_required','active','suspended','deleted','failed')),
  create_idempotency_key TEXT NOT NULL,create_request_hash TEXT NOT NULL,public_url TEXT,remote_created_at TEXT,expires_at TEXT,last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  media_active_set INTEGER CHECK(media_active_set IN (1,2)),
  media_active_state TEXT NOT NULL DEFAULT 'unknown' CHECK(media_active_state IN ('unknown','pending','synced')),
  CHECK(length(slug) BETWEEN 3 AND 50),CHECK(length(display_name) BETWEEN 1 AND 120),UNIQUE(user_id,create_idempotency_key)
);
CREATE TABLE vpage_credit_claims_next (
  id TEXT PRIMARY KEY,credit_id INTEGER NOT NULL REFERENCES vpage_credits_next(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages_next(id) ON DELETE RESTRICT,state TEXT NOT NULL CHECK(state IN ('held','committed','released')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vpage_renewal_requests_next (
  id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages_next(id) ON DELETE RESTRICT,credit_id INTEGER NOT NULL REFERENCES vpage_credits_next(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('held','remote_committed','committed','released')),
  remote_status TEXT,remote_expires_at TEXT,last_error_code TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,idempotency_key)
);
CREATE TABLE vpage_media_next (
  id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,page_id TEXT NOT NULL REFERENCES vpage_pages_next(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),content_hash TEXT NOT NULL,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting','deleted')),lease_token TEXT NOT NULL DEFAULT '',lease_expires_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(owner_id,idempotency_key)
);
CREATE TABLE vpage_media_save_ops_next (
  id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,page_id TEXT NOT NULL REFERENCES vpage_pages_next(id) ON DELETE RESTRICT,
  vpage_id TEXT NOT NULL,set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','committed','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(owner_id,idempotency_key)
);
CREATE TABLE vpage_media_pending_refs_next (
  op_id TEXT NOT NULL REFERENCES vpage_media_save_ops_next(id) ON DELETE CASCADE,media_id TEXT NOT NULL REFERENCES vpage_media_next(id) ON DELETE RESTRICT,
  slot_key TEXT NOT NULL,PRIMARY KEY(op_id,slot_key)
);
CREATE TABLE vpage_media_refs_next (
  page_id TEXT NOT NULL REFERENCES vpage_pages_next(id) ON DELETE RESTRICT,owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),slot_key TEXT NOT NULL,media_id TEXT NOT NULL REFERENCES vpage_media_next(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(page_id,set_no,slot_key)
);

INSERT INTO vpage_credits_next(id,user_id,order_id,source_order_item_id,status,service_days,granted_at,consumed_at) SELECT id,user_id,order_id,source_order_item_id,status,service_days,granted_at,consumed_at FROM vpage_credits;
INSERT INTO vpage_pages_next SELECT id,user_id,credit_id,vpage_id,domain_id,slug,display_name,status,create_idempotency_key,create_request_hash,public_url,remote_created_at,expires_at,last_error_code,created_at,updated_at,media_active_set,media_active_state FROM vpage_pages;
INSERT INTO vpage_credit_claims_next SELECT * FROM vpage_credit_claims;
INSERT INTO vpage_renewal_requests_next SELECT * FROM vpage_renewal_requests;
INSERT INTO vpage_media_next SELECT * FROM vpage_media;
INSERT INTO vpage_media_save_ops_next SELECT * FROM vpage_media_save_ops;
INSERT INTO vpage_media_pending_refs_next SELECT * FROM vpage_media_pending_refs;
INSERT INTO vpage_media_refs_next SELECT * FROM vpage_media_refs;

DROP TABLE vpage_media_pending_refs;
DROP TABLE vpage_media_refs;
DROP TABLE vpage_media_save_ops;
DROP TABLE vpage_media;
DROP TABLE vpage_credit_claims;
DROP TABLE vpage_renewal_requests;
DROP TABLE vpage_pages;
DROP TABLE vpage_credits;

ALTER TABLE vpage_credits_next RENAME TO vpage_credits;
ALTER TABLE vpage_pages_next RENAME TO vpage_pages;
ALTER TABLE vpage_credit_claims_next RENAME TO vpage_credit_claims;
ALTER TABLE vpage_renewal_requests_next RENAME TO vpage_renewal_requests;
ALTER TABLE vpage_media_next RENAME TO vpage_media;
ALTER TABLE vpage_media_save_ops_next RENAME TO vpage_media_save_ops;
ALTER TABLE vpage_media_pending_refs_next RENAME TO vpage_media_pending_refs;
ALTER TABLE vpage_media_refs_next RENAME TO vpage_media_refs;

CREATE INDEX idx_vpage_credits_owner_cursor ON vpage_credits(user_id,id DESC);
CREATE INDEX idx_vpage_credits_owner_status ON vpage_credits(user_id,status);
CREATE INDEX idx_vpage_credits_grant ON vpage_credits(grant_id,grant_sequence);
CREATE UNIQUE INDEX idx_vpage_pages_domain_slug_live ON vpage_pages(domain_id,slug) WHERE status IN ('provisioning','repair_required','active','suspended');
CREATE INDEX idx_vpage_pages_owner_cursor ON vpage_pages(user_id,id DESC);
CREATE INDEX idx_vpage_pages_owner_status ON vpage_pages(user_id,status,id DESC);
CREATE INDEX idx_vpage_pages_domain_cursor ON vpage_pages(domain_id,status,id DESC);
CREATE UNIQUE INDEX idx_vpage_claims_credit_live ON vpage_credit_claims(credit_id) WHERE state IN ('held','committed');
CREATE UNIQUE INDEX idx_vpage_claims_page_live ON vpage_credit_claims(page_id) WHERE state IN ('held','committed');
CREATE UNIQUE INDEX idx_vpage_renewals_credit_live ON vpage_renewal_requests(credit_id) WHERE state IN ('held','remote_committed');
CREATE UNIQUE INDEX idx_vpage_renewals_page_live ON vpage_renewal_requests(page_id) WHERE state IN ('held','remote_committed');
CREATE INDEX idx_vpage_renewals_owner_page ON vpage_renewal_requests(user_id,page_id,state,id DESC);
CREATE INDEX idx_vpage_media_owner_page ON vpage_media(owner_id,page_id,state,id DESC);
CREATE INDEX idx_vpage_media_page_state ON vpage_media(page_id,state,id);
CREATE INDEX idx_vpage_media_cleanup ON vpage_media(owner_id,page_id,state,updated_at DESC,id DESC);
CREATE UNIQUE INDEX idx_vpage_media_save_live ON vpage_media_save_ops(page_id,set_no) WHERE state='pending';
CREATE INDEX idx_vpage_media_save_page ON vpage_media_save_ops(page_id,set_no,state,created_at DESC);
CREATE INDEX idx_vpage_media_pending_media ON vpage_media_pending_refs(media_id,op_id);
CREATE INDEX idx_vpage_media_refs_media ON vpage_media_refs(media_id,page_id,set_no);
CREATE INDEX idx_vpage_media_refs_page_set ON vpage_media_refs(page_id,set_no,slot_key,media_id);
