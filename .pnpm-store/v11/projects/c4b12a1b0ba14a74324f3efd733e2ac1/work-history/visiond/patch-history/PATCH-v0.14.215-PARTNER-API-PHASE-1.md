# PATCH v0.14.215 — Partner API Phase 1 Foundation

- Website Registry และสถานะ draft/active/paused/revoked
- AES-GCM Credential แยกต่อเว็บไซต์ แสดง Secret ครั้งเดียว พร้อม Hash และ Rotation
- Scope `products:read`, Request ID และ Audit Log
- Product API แบบ Read-only ส่งเฉพาะ Published Metadata
- หน้าควบคุม `/partner-api.html` และ Protocol แยกฐานข้อมูลเว็บ 2
- Rollback ด้วย `git revert` Commit ของแพตนี้ โดย Boss เป็นผู้ Push/Deploy เท่านั้น
