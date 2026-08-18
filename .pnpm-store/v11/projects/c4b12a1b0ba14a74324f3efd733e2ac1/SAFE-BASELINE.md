# VisionD Safe Baseline

Updated: 2026-08-15

## Production-validated safe rollback

- Version: `v0.14.182`
- Commit: `5ea8741`
- Status: `PRODUCTION_VALIDATED`
- Evidence: เว็บและหลังบ้านแสดงเนื้อหาครบพร้อมเลข v0.14.182 ในภาพตรวจของ Boss

## Current candidate

- Version before this protocol patch: `v0.14.184`
- Commit: `288cd0f`
- Status: `PUSHED`; การ Deploy/Production validation ต้องบันทึกแยกเมื่อ Boss ยืนยัน

## Rollback rule

ใช้ `git revert <bad-commit>` จาก branch ปัจจุบัน ทดสอบครบ และให้ Boss Push/Deploy เท่านั้น ห้าม Reset หรือวางไฟล์เก่าทับทั้งระบบ
