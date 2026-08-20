# PATCH v0.14.393 — Persistent Schema Readiness

## เป้าหมาย

หยุด schema checks, seed และ data repair ซ้ำใน Worker cold isolate หลังฐานข้อมูลผ่าน runtime initialization แล้ว

## การเปลี่ยนแปลง

- เพิ่ม migration `0065_runtime_schema_state.sql`
- `ensureDatabase()` ตรวจ persistent version หนึ่งครั้งต่อ DB binding/isolate
- ฐาน version 65 ข้าม initializer เดิมทั้งหมด
- ฐานเก่าหรือ marker หายยังใช้ initializer เดิม และเขียน marker หลังสำเร็จเท่านั้น

## งานที่ค้นพบ

- Migration 1–64 ยัง replay จากฐานว่างไม่ได้ เพราะ `0001` และ `0002` มี username ซ้ำ ต้อง rebaseline แยกแพต

## หลักฐานทดสอบ

- Focused: `scripts/test-v014393.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
- Deploy ต้องใช้ migration 0065 ก่อน Production Validation
