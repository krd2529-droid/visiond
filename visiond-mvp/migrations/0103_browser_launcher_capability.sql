-- Claim failure metadata is read through the existing exact command owner index.
ALTER TABLE browser_launcher_commands ADD COLUMN error_code TEXT;
