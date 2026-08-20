CREATE TABLE IF NOT EXISTS analytics_summary (
  summary_key TEXT PRIMARY KEY,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO analytics_summary(summary_key,unique_visitors)
SELECT 'site',COUNT(*) FROM analytics_visitors WHERE true
ON CONFLICT(summary_key) DO UPDATE SET
  unique_visitors=excluded.unique_visitors,
  updated_at=CURRENT_TIMESTAMP;

CREATE TRIGGER IF NOT EXISTS trg_analytics_visitors_summary
AFTER INSERT ON analytics_visitors
BEGIN
  INSERT INTO analytics_summary(summary_key,unique_visitors)
  VALUES('site',1)
  ON CONFLICT(summary_key) DO UPDATE SET
    unique_visitors=unique_visitors+1,
    updated_at=CURRENT_TIMESTAMP;
END;

INSERT INTO runtime_schema_state(schema_key,version)
VALUES('core',66)
ON CONFLICT(schema_key) DO UPDATE SET
  version=excluded.version,
  updated_at=CURRENT_TIMESTAMP;
