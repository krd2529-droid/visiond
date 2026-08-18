-- Vision 7 Key Center: prepare V Easy licenses for later one-key/one-shop binding.
ALTER TABLE vision7_licenses ADD COLUMN binding_state TEXT NOT NULL DEFAULT 'not_required';
CREATE INDEX IF NOT EXISTS idx_v7_license_binding ON vision7_licenses(binding_state,status,created_at DESC);
