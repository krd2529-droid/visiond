ALTER TABLE vpage_pages
ADD COLUMN active_set INTEGER NOT NULL DEFAULT 1 CHECK(active_set IN (1,2));

ALTER TABLE vpage_pages
ADD COLUMN public_generation INTEGER NOT NULL DEFAULT 0 CHECK(public_generation>=0);

CREATE TABLE vpage_content_sets (
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE CASCADE,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  product_image_url TEXT NOT NULL DEFAULT '' CHECK(length(product_image_url)<=2048),
  detail_text TEXT NOT NULL DEFAULT '' CHECK(length(detail_text)<=4000),
  text_size TEXT NOT NULL DEFAULT 'medium' CHECK(text_size IN ('small','medium','large')),
  text_style TEXT NOT NULL DEFAULT 'normal' CHECK(text_style IN ('normal','strong','emphasis')),
  youtube_url TEXT NOT NULL DEFAULT '' CHECK(length(youtube_url)<=2048),
  product_url TEXT NOT NULL DEFAULT '' CHECK(length(product_url)<=2048),
  contact_url TEXT NOT NULL DEFAULT '' CHECK(length(contact_url)<=2048),
  background_image_url TEXT NOT NULL DEFAULT '' CHECK(length(background_image_url)<=2048),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(page_id,set_no)
);

CREATE TABLE vpage_editor_requests (
  idempotency_key TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE CASCADE,
  owner_ref TEXT NOT NULL CHECK(owner_ref='system' OR length(owner_ref)=64),
  action TEXT NOT NULL CHECK(action IN ('save_set','switch_set')),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vpage_set_audit (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE REFERENCES vpage_editor_requests(idempotency_key) ON DELETE RESTRICT,
  actor_ref TEXT NOT NULL CHECK(length(actor_ref)=64),
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner','boss')),
  previous_set INTEGER NOT NULL CHECK(previous_set IN (1,2)),
  next_set INTEGER NOT NULL CHECK(next_set IN (1,2)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vpage_editor_guards (
  token TEXT PRIMARY KEY NOT NULL
);

CREATE INDEX idx_vpage_editor_requests_page
ON vpage_editor_requests(page_id,created_at DESC);

CREATE INDEX idx_vpage_set_audit_page_cursor
ON vpage_set_audit(page_id,created_at DESC,id DESC);

INSERT INTO vpage_content_sets(page_id,set_no)
SELECT id,1 FROM vpage_pages;

INSERT INTO vpage_content_sets(page_id,set_no)
SELECT id,2 FROM vpage_pages;
