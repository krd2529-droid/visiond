# PATCH v0.14.305 — Course EP Single Action

- แก้ปุ่มเพิ่ม EP ซ้ำและ native required tooltip
- เพิ่ม EP เฉพาะเมื่อมีชื่อและสื่อจริง
- ลบสล็อตว่างเก่าระหว่างโหลดรายการ และส่งตรวจ/หลังบ้านนับเฉพาะ EP ที่มีข้อมูลจริง
- ทดสอบ: `node scripts/test-v014305.mjs`, `node scripts/test-all-regressions.mjs` และ `node scripts/predeploy-check.mjs`
- Rollback: `git revert <commit-v0.14.305>` แล้วทดสอบใหม่ ห้าม reset
