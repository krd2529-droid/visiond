# v0.14.55 QA Hardening + Source Coverage

Base: v0.14.54. แพตนี้เป็น QA-only ไม่มีฟีเจอร์ใหม่

- retry/reclaim Meta event ที่ failed
- UTF-8 payload bytes, บังคับ META_PAGE_ID และใช้ timestamp จริง
- Source-to-Ledger Recheck แบบ atomic
- regression gate ทุกชุดและ Patch Capacity / Quality Gate

งาน Event Case ที่เหลือ: installer/update delivery, operator forms, PAGE_SALES grounded AI และ production Ads API ingestion
