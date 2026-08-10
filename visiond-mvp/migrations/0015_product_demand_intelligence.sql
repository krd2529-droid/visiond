ALTER TABLE products ADD COLUMN inventory_origin TEXT NOT NULL DEFAULT 'premade_stock';
ALTER TABLE products ADD COLUMN family_key TEXT;
ALTER TABLE products ADD COLUMN series_no INTEGER;
ALTER TABLE products ADD COLUMN demand_basis TEXT;
