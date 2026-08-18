ALTER TABLE vision7_licenses ADD COLUMN issuance_type TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE vision7_licenses ADD COLUMN issue_cost INTEGER NOT NULL DEFAULT 0;
