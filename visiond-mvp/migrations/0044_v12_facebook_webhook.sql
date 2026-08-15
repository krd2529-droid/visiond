ALTER TABLE v12_channel_credentials ADD COLUMN shop_id TEXT NOT NULL DEFAULT '';
ALTER TABLE v12_channel_credentials ADD COLUMN secret_ciphertext TEXT NOT NULL DEFAULT '';
ALTER TABLE v12_channel_credentials ADD COLUMN verify_token_ciphertext TEXT NOT NULL DEFAULT '';
