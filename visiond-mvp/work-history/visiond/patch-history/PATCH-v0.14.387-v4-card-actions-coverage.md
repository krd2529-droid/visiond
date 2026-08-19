# PATCH v0.14.387 — V4 Card Actions Coverage

- Feature: `V4-REVIEW-001`
- ลงทะเบียน edit/soft-delete decorator ของ V4 draft cards จาก runtime จริง
- ยืนยัน `requireAdmin` และ soft delete เข้า Trash 30 วันจาก product DELETE endpoint
- เพิ่ม `data-feature` ให้ dynamic edit/delete controls โดยไม่เปลี่ยน behavior หรือ theme
- บันทึก network rejection, non-retry marker และ inline legacy style เป็น Known Gaps
- Focused: `scripts/test-v014387.mjs`
- Push/Deploy: ไม่ทำ
