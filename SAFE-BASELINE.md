# VisionD Safe Baseline

Updated: 2026-08-15

## Production-validated safe rollback

- Version: `v0.14.182`
- Commit: `5ea8741`
- Status: `PRODUCTION_VALIDATED`
- Evidence: เว็บและหลังบ้านแสดงเนื้อหาครบพร้อมเลข v0.14.182 ในภาพตรวจของ Boss
- Limitation: ยังมีรายการ UX ที่ได้รับการแก้ต่อในแพตช์ใหม่ แต่ไม่มีอาการหน้าขาวหรือ Runtime หลักพัง

## Current candidate

- Version before this protocol patch: `v0.14.184`
- Commit: `288cd0f`
- Status: `PUSHED`; การ Deploy/Production validation ต้องบันทึกแยกเมื่อ Boss ยืนยัน

## Rollback rule

ห้าม Reset หรือวางไฟล์เก่าทับทั้งระบบ ให้ตรวจ Commit ที่ก่อปัญหาแล้วสร้าง `git revert <bad-commit>` จาก branch ปัจจุบัน รันทดสอบครบและให้ Boss เป็นผู้ Push/Deploy เท่านั้น การเปลี่ยน Safe Baseline ต้องมีหลักฐาน Production validation ใหม่
