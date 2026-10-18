ALTER TABLE vision7_licenses ADD COLUMN smsmix_first_activated_at TEXT;
ALTER TABLE vision7_licenses ADD COLUMN smsmix_pending_days INTEGER NOT NULL DEFAULT 0;

-- Existing bound keys keep their paid expiry; this marker survives a later slot reset.
UPDATE vision7_licenses
SET smsmix_first_activated_at=(SELECT b.activated_at FROM vision7_smsmix_bindings b WHERE b.license_id=vision7_licenses.id)
WHERE program_id=(SELECT id FROM vision7_programs WHERE code='sms-mix')
  AND EXISTS(SELECT 1 FROM vision7_smsmix_bindings b WHERE b.license_id=vision7_licenses.id);

-- Existing unbound keys retain their old expiry as a lower bound. Already-expired
-- unbound keys still need a paid renewal before first activation.
UPDATE vision7_licenses
SET smsmix_pending_days=MAX(
  COALESCE((SELECT duration_days FROM vision7_plans WHERE id=vision7_licenses.plan_id),0),
  COALESCE(CAST(julianday(expires_at)-julianday(starts_at)+0.999999 AS INTEGER),0)
)
WHERE program_id=(SELECT id FROM vision7_programs WHERE code='sms-mix')
  AND smsmix_first_activated_at IS NULL;
